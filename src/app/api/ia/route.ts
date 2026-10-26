import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { editarComClaude, mensagemDeErroClaude } from "@/ia/claude";
import { resumoDoProjeto } from "@/ia/estado";
import { criarFerramentas, SessaoEdicao } from "@/ia/ferramentas";
import { editarComOpenAI } from "@/ia/openai";
import { analiseSchema } from "@/projeto/analise";
import { mensagemDeErroOpenAI, openaiConfigurada } from "@/servidor/openai";
import { Midia } from "@/projeto/tipos";
import { timelineSchema } from "@/timeline/schema";
import { chaveCena, chaveInsert } from "@/plano/pendencias";
import { lerPlanoSalvo } from "@/plano/tipos";
import { lerMidiasDoCliente, lerPlano, lerProjeto } from "@/servidor/banco";
import { enderecoInterno } from "@/servidor/endereco";
import { renderizarQuadros } from "@/servidor/quadros";
import {
  conferirEdicao,
  descreverMomento,
  ehEdicaoGrande,
  momentosParaRevisar,
} from "@/ia/conferencia";
import {
  criarProgresso,
  Progresso,
  rotuloDaFerramenta,
  semProgresso,
  textoEscrevendo,
} from "@/ia/progresso";

// Resumo do plano para o editor: copy e o que cada cena deveria ser.
const resumoDoPlano = (projetoId: string, biblioteca: Midia[]) => {
  const plano = lerPlanoSalvo(lerPlano(projetoId));
  const g = plano.gerado;
  if (!g) return null;
  // Apelido real do arquivo ligado a cada item (pode ter ganhado sufixo).
  const apelidoDe = (chave: string, planejado: string) =>
    `@${biblioteca.find((m) => m.id === plano.vinculos[chave])?.apelido ?? planejado}`;
  return JSON.stringify({
    titulo: g.titulo,
    modo_audio: g.modo_audio,
    copy: g.copy,
    cenas: g.cenas.map((c) => ({
      cena: c.numero,
      take:
        c.origem === "banco"
          ? `@${c.apelido_banco}`
          : apelidoDe(chaveCena(c), c.apelido),
      fala: c.fala,
      descricao: c.descricao,
      no_enceditor: c.feito_no_enceditor,
      som: c.som_do_take,
      volume_do_som: c.volume_do_take,
    })),
    inserts: g.inserts.map((x) => ({
      insert: x.apelido_banco
        ? `@${x.apelido_banco}`
        : apelidoDe(chaveInsert(x), x.apelido),
      frase: x.frase,
      posicao: x.posicao,
    })),
    legendas: g.legendas,
  });
};

// Recebe um pedido do chat, deixa a IA editar a timeline com as
// ferramentas e devolve a timeline nova + a resposta em texto.
// Usa a OpenAI (GPT) se houver OPENAI_API_KEY; senão, o Claude.

const LIMITE_HISTORICO = 12;

const corpoSchema = z.object({
  pedido: z.string(),
  // Nomes das mídias anexadas nesta mensagem ("esse insert").
  anexos: z.array(z.string()),
  historico: z.array(
    z.object({ autor: z.enum(["usuario", "ia"]), texto: z.string() }),
  ),
  timeline: timelineSchema,
  projetoId: z.string().optional(),
  biblioteca: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      papel: z.enum(["cena", "insert", "audio"]),
      formato: z.enum(["video", "imagem", "audio"]),
      url: z.string(),
      nomeArquivo: z.string(),
      apelido: z.string().default(""),
      usarIA: z.boolean().default(true),
      efeitosAudio: z.array(z.string()).optional(),
      urlOriginal: z.string().optional(),
      duracao: z.number().nullable(),
      largura: z.number().nullable(),
      altura: z.number().nullable(),
      analise: analiseSchema.optional(),
    }),
  ),
});

export type RespostaIA = {
  resposta: string;
  // Arquivos alterados pela IA (ex.: efeitos de áudio aplicados).
  midiasAlteradas?: Midia[];
  // Inserts que o usuário deve posicionar no popup.
  insertsParaPosicionar?: number[];
  timeline: z.infer<typeof timelineSchema> | null;
  acoes: string[];
};

const erro = (mensagem: string, status: number) =>
  NextResponse.json({ erro: mensagem }, { status });

// Resposta "OK" da revisão = nada a corrigir.
const ehOk = (texto: string) => /^\s*ok[.!]?\s*$/i.test(texto);

const mensagemDaConferencia = (problemas: string[], estado: string) =>
  `CONFERÊNCIA AUTOMÁTICA da sua edição, antes de entregar ao usuário. Pontos encontrados:
${problemas.map((p) => `- ${p}`).join("\n")}

Corrija com as ferramentas o que for erro de verdade (o estado atual está abaixo; use os números dos itens). Se algum ponto foi pedido pelo usuário ou é de propósito, deixe como está. Depois responda com o resumo FINAL e completo do que foi feito no pedido (incluindo as correções). Se não mudar nada, responda exatamente: OK.

Estado atual do projeto:
${estado}`;

const mensagemDaRevisao = (estado: string) =>
  `REVISÃO ANTES DE ENTREGAR. Abaixo estão quadros do vídeo depois da sua edição; cada um vem com o segundo, o que está sendo falado naquele momento e o que deveria estar na tela. Olhe como um editor exigente: texto cortado ou saindo da tela; texto pequeno demais para ler no celular; uma coisa por cima da outra; algo cobrindo rosto ou produto; elemento que falta ou que não combina com a fala daquele momento; tela vazia. Se achar problema REAL, corrija com as ferramentas e depois responda com o resumo FINAL e completo do que foi feito no pedido (incluindo as correções). Se estiver tudo certo, responda exatamente: OK.

Estado atual do projeto:
${estado}`;

export async function POST(req: NextRequest) {
  const usarOpenAI = openaiConfigurada();
  if (!usarOpenAI && !process.env.ANTHROPIC_API_KEY) {
    return erro(
      "A IA ainda não está configurada: falta a chave OPENAI_API_KEY no arquivo .env.local (veja o README).",
      503,
    );
  }

  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return erro("Pedido inválido.", 400);
  }
  const { pedido, anexos, historico, timeline, biblioteca, projetoId } =
    corpo.data;
  // Banco inteiro do cliente: a IA pode reaproveitar arquivos de outros
  // vídeos dele (o app manda só os deste projeto).
  const clienteId = projetoId ? lerProjeto(projetoId)?.cliente.id : null;
  const banco = clienteId
    ? (lerMidiasDoCliente(clienteId) as Midia[])
    : undefined;
  const plano = projetoId
    ? resumoDoPlano(projetoId, banco ?? (biblioteca as Midia[]))
    : null;

  const sessao: SessaoEdicao = { timeline, biblioteca, banco, acoes: [] };

  // Histórico só em texto; a conversa precisa começar pelo usuário.
  const anteriores = historico
    .filter((m) => m.texto.trim())
    .slice(-LIMITE_HISTORICO);
  while (anteriores[0]?.autor === "ia") anteriores.shift();
  const historicoIA = anteriores.map((m) => ({
    papel: m.autor === "usuario" ? ("user" as const) : ("assistant" as const),
    texto: m.texto,
  }));

  const pedidoCompleto = [
    "Estado atual do projeto:",
    JSON.stringify(resumoDoProjeto(timeline, biblioteca)),
    plano
      ? `Plano do vídeo (feito na aba Planejar; siga o que foi imaginado quando o pedido for vago):
${plano}`
      : "",
    anexos.length ? `Anexados nesta mensagem: ${anexos.join(", ")}.` : "",
    `Pedido: ${pedido}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  // O pedido inteiro: editar → conferir (regras) → olhar quadros (pedidos
  // grandes) → corrigir. "progresso" alimenta a barra do chat.
  const executar = async (progresso: Progresso): Promise<RespostaIA> => {
    progresso.fase(1, 4, "Lendo o projeto…");
    const ferramentas = criarFerramentas(sessao).map((f) => ({
      ...f,
      run: (entrada: unknown) => {
        progresso.passo(`${rotuloDaFerramenta(f.name, entrada)}…`);
        return f.run(entrada);
      },
    }));
    // "pensando" = o texto da barra enquanto a IA pensa: [na 1ª etapa, nas
    // seguintes]. Enquanto ela escreve o pedido de uma ferramenta, a barra
    // diz o que está sendo escrito (só quando o texto muda).
    let ultimoEscrevendo = "";
    const rodar = (
      texto: string,
      historicoAtual: typeof historicoIA,
      pensando: [string, string],
      imagens?: { legenda: string; base64: string }[],
    ) =>
      (usarOpenAI ? editarComOpenAI : editarComClaude)({
        ferramentas,
        historico: historicoAtual,
        pedido: texto,
        imagens,
        aoPensar: (etapa) => progresso.passo(pensando[etapa === 0 ? 0 : 1]),
        aoEscrever: (nome, argumentos) => {
          const agora = textoEscrevendo(nome, argumentos);
          if (agora !== ultimoEscrevendo) progresso.detalhe(agora);
          ultimoEscrevendo = agora;
        },
      });
    const estado = () =>
      JSON.stringify(resumoDoProjeto(sessao.timeline, sessao.biblioteca));

    progresso.fase(4, 60, "Entendendo o pedido…");
    const primeira = await rodar(pedidoCompleto, historicoIA, [
      "Entendendo o pedido…",
      "Pensando no próximo passo…",
    ]);
    let resposta = primeira;
    const notas: string[] = [];

    if (sessao.acoes.length) {
      const conversa = [
        ...historicoIA,
        { papel: "user" as const, texto: pedido },
        { papel: "assistant" as const, texto: primeira },
      ];

      // 1) Conferência automática (regras, sem custo). Se achar algo, a
      //    IA corrige; confere de novo uma vez.
      let corrigidos = 0;
      for (let rodada = 0; rodada < 2; rodada++) {
        progresso.fase(
          60 + rodada * 7,
          66 + rodada * 7,
          rodada
            ? "Conferindo de novo…"
            : "Conferindo a edição (sobreposições, tempos, textos)…",
        );
        const problemas = conferirEdicao(
          timeline,
          sessao.timeline,
          sessao.biblioteca,
        );
        if (!problemas.length) break;
        progresso.passo(
          `A conferência achou ${problemas.length} ponto(s) — corrigindo…`,
        );
        const acoesAntes = sessao.acoes.length;
        const r = await rodar(
          mensagemDaConferencia(problemas, estado()),
          conversa,
          [
            `Corrigindo o que a conferência achou (${problemas.length} ponto(s))…`,
            "Corrigindo…",
          ],
        );
        conversa.push(
          { papel: "user", texto: "(conferência automática da edição)" },
          { papel: "assistant", texto: r },
        );
        if (sessao.acoes.length === acoesAntes) break;
        corrigidos += problemas.length;
        if (!ehOk(r)) resposta = r;
      }
      notas.push(
        corrigidos
          ? `a conferência automática achou e corrigiu ${corrigidos} ponto(s)`
          : "a conferência automática não achou problemas",
      );

      // 2) Revisão olhando quadros (só em pedidos grandes).
      const momentos = ehEdicaoGrande(timeline, sessao.timeline)
        ? momentosParaRevisar(timeline, sessao.timeline)
        : [];
      if (momentos.length) {
        progresso.fase(74, 86, "Gerando quadros do vídeo para revisar…");
        try {
          const quadros = await renderizarQuadros(
            sessao.timeline,
            enderecoInterno(req),
            momentos,
            (feitos, total) =>
              progresso.em(
                74 + (12 * feitos) / total,
                `Gerando quadros para revisar (${feitos} de ${total})…`,
              ),
          );
          progresso.fase(87, 97, "Olhando os quadros do vídeo…");
          const acoesAntes = sessao.acoes.length;
          const r = await rodar(
            mensagemDaRevisao(estado()),
            conversa,
            [
              `Olhando os ${quadros.length} quadros do vídeo…`,
              "Corrigindo o que vi nos quadros…",
            ],
            quadros.map((q) => ({
              base64: q.base64,
              legenda: descreverMomento(
                sessao.timeline,
                sessao.biblioteca,
                q.segundo,
              ),
            })),
          );
          const corrigiu = sessao.acoes.length > acoesAntes;
          if (corrigiu && !ehOk(r)) resposta = r;
          notas.push(
            `olhei ${quadros.length} quadros do vídeo${corrigiu ? " e corrigi o que vi" : " e está tudo certo"}`,
          );
        } catch (e) {
          console.error("[ia] revisão por quadros falhou:", e);
          notas.push("não deu para gerar os quadros da revisão desta vez");
        }
      }
    }

    progresso.em(98, "Finalizando…");
    const texto =
      resposta ||
      (sessao.acoes.length
        ? "Pronto."
        : "Não entendi o que mudar. Pode detalhar?");
    return {
      resposta: notas.length
        ? `${texto}\n\n✓ Conferência: ${notas.join("; ")}.`
        : texto,
      timeline: sessao.acoes.length ? sessao.timeline : null,
      acoes: sessao.acoes,
      midiasAlteradas: sessao.midiasAlteradas,
      insertsParaPosicionar: sessao.insertsParaPosicionar,
    };
  };

  const mensagemDeErro = (e: unknown) =>
    usarOpenAI ? mensagemDeErroOpenAI(e) : mensagemDeErroClaude(e);

  // Sem streaming (scripts de teste): espera tudo e devolve JSON.
  if (!req.headers.get("accept")?.includes("application/x-ndjson")) {
    try {
      return NextResponse.json<RespostaIA>(await executar(semProgresso));
    } catch (e) {
      const conhecido = mensagemDeErro(e);
      if (conhecido) return erro(conhecido.erro, conhecido.status);
      throw e;
    }
  }

  // Com streaming (o chat): uma linha JSON por evento — o progresso
  // enquanto trabalha e, no fim, a resposta (ou o erro).
  const codificador = new TextEncoder();
  const fluxo = new ReadableStream({
    async start(controle) {
      const enviar = (evento: object) =>
        controle.enqueue(codificador.encode(`${JSON.stringify(evento)}\n`));
      try {
        const resultado = await executar(
          criarProgresso((pct, texto) =>
            enviar({ tipo: "progresso", pct, texto }),
          ),
        );
        enviar({ tipo: "fim", ...resultado });
      } catch (e) {
        console.error("[ia] pedido falhou:", e);
        enviar({
          tipo: "erro",
          erro:
            mensagemDeErro(e)?.erro ??
            (e instanceof Error ? e.message : String(e)),
        });
      } finally {
        controle.close();
      }
    },
  });
  return new Response(fluxo, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
