import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { esquemaEstrito } from "@/servidor/esquema-estrito";
import {
  clienteOpenAI,
  comNovaTentativa,
  MODELOS,
  openaiConfigurada,
} from "@/servidor/openai";

// Revisor INDEPENDENTE: outra chamada à IA, sem o histórico da edição e
// sem ferramentas, que só olha os quadros do vídeo e aponta erros — como
// um segundo editor. Quem fez a edição tende a aprovar as próprias
// escolhas; o revisor não sabe por que cada coisa foi feita.

const INSTRUCOES_REVISOR = `Você é um revisor de vídeos curtos (Reels, TikTok, anúncios) muito exigente. Você NÃO fez esta edição: seu trabalho é achar o que está errado ANTES de o cliente ver.

Você recebe pranchas com quadros do vídeo (até 4 por prancha). Cada quadro foi tirado perto do FIM de uma tela, quando tudo o que ela mostra já apareceu. O texto antes das imagens diz, para cada posição da prancha, o segundo, o que está sendo falado e o que deveria estar na tela (motion N, insert N, legenda N — os números da timeline).

Aponte SÓ problemas reais, que o cliente notaria:
1) texto em cima de texto ou de desenho (mesmo que seja só um pedaço);
2) texto cortado, saindo da tela ou encostado na borda;
3) texto difícil de ler: pequeno para celular ou com pouco contraste com o fundo ou com o cartão onde está (ex.: roxo escuro num cartão escuro);
4) emoji ou ícone que virou silhueta/mancha sem cor ou que não dá para entender;
5) elemento solto, sem sentido ou que parece esquecido (ex.: bolinha só com um ícone num canto, pílula vazia);
6) o mesmo grafismo ou ícone genérico repetido várias vezes no vídeo;
7) a mesma informação duas vezes na tela ao mesmo tempo (ex.: o número na frase e de novo num grafismo);
8) palavra faltando ou errada no texto da tela comparado com o que é falado (o texto falado aparece palavra por palavra junto com a voz: só aponte palavra que já foi dita; para um trecho inteiro que falta, sugira uma tela nova com ele, nunca esticar a frase da tela);
9) desenho com cor que não combina com o resto (ex.: círculo cinza-escuro "sujo" num fundo claro);
10) algo que contraria o pedido do usuário (ex.: ele pediu as logos dos bancos e aparece um ícone genérico);
11) tela desequilibrada ou pobre: texto só no topo com o resto vazio, ou várias telas seguidas só com texto num vídeo de animação;
12) logo ou produto pequeno demais, cortado ou escondido num canto (principalmente na chamada final, onde a marca deve aparecer bem).

Não aponte gosto pessoal nem coisa que está certa. Para cada problema: o segundo, o que está errado (curto, em português simples) e como corrigir com o editor (posição topo/centro/base ou x/y, tamanho, encurtar ou trocar o texto, trocar o modelo, mudar a cor, tirar o item, mudar os tempos), citando os números dos itens. Se estiver tudo certo, devolva a lista vazia.`;

const revisaoSchema = z.object({
  problemas: z.array(
    z.object({
      segundo: z.number(),
      problema: z.string(),
      como_corrigir: z.string(),
    }),
  ),
});
export type ProblemaVisto = z.infer<typeof revisaoSchema>["problemas"][number];

export type Prancha = { legenda: string; base64: string };

const MODELO_CLAUDE = "claude-opus-5-5";

export const revisarQuadros = async ({
  contexto,
  pranchas,
}: {
  // O que o usuário pediu e a direção do vídeo (texto curto).
  contexto: string;
  pranchas: Prancha[];
}): Promise<ProblemaVisto[]> => {
  if (!pranchas.length) return [];
  const abertura = `${contexto}\n\nQuadros do vídeo a revisar (${pranchas.length} prancha(s)):`;

  if (openaiConfigurada()) {
    const resposta = await comNovaTentativa(() =>
      clienteOpenAI().responses.create({
        model: MODELOS.editor,
        instructions: INSTRUCOES_REVISOR,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: abertura },
              ...pranchas.flatMap((p) => [
                { type: "input_text" as const, text: p.legenda },
                {
                  type: "input_image" as const,
                  image_url: `data:image/jpeg;base64,${p.base64}`,
                  detail: "high" as const,
                },
              ]),
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "revisao",
            strict: true,
            schema: esquemaEstrito(revisaoSchema),
          },
        },
      }),
    );
    console.log(
      `[ia] revisor ${MODELOS.editor}: ${pranchas.length} prancha(s), ${resposta.usage?.input_tokens ?? 0} tokens de entrada, ${resposta.usage?.output_tokens ?? 0} de saída`,
    );
    return revisaoSchema.parse(JSON.parse(resposta.output_text)).problemas;
  }

  // Sem a OpenAI: o Claude revisa (pede o JSON no texto).
  const resposta = await new Anthropic().messages.create({
    model: MODELO_CLAUDE,
    max_tokens: 4000,
    system: `${INSTRUCOES_REVISOR}\n\nResponda só com JSON: {"problemas": [{"segundo": número, "problema": "...", "como_corrigir": "..."}]}.`,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: abertura },
          ...pranchas.flatMap((p): Anthropic.ContentBlockParam[] => [
            { type: "text", text: p.legenda },
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: p.base64 },
            },
          ]),
        ],
      },
    ],
  });
  const texto = resposta.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const json = texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1);
  return revisaoSchema.parse(JSON.parse(json || '{"problemas":[]}')).problemas;
};
