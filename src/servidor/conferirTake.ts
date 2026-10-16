import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import OpenAI from "openai";
import { z } from "zod";
import { chaveCena } from "@/plano/pendencias";
import { lerPlanoSalvo, PlanoSalvo } from "@/plano/tipos";
import { Midia } from "@/projeto/tipos";
import { caminhoDoArquivo, nomeDaUrl } from "./armazenamento";
import {
  lerAprendizados,
  lerMidiasDoCliente,
  lerPlano,
  lerProjeto,
  listarElementos,
  salvarPlano,
} from "./banco";
import { esquemaEstrito } from "./esquema-estrito";
import { extrairQuadros } from "./ffmpeg";
import { clienteOpenAI, comNovaTentativa, MODELOS } from "./openai";
import { descreverAnalise, imagemParaIA } from "./planejador";

// Olhada da IA num take enviado: confere com o que a cena pedia? Só
// informa (o take continua aceito). Compara alguns quadros do vídeo com a
// descrição/prompt da cena, as fotos dos @elementos e os problemas visuais
// que o cliente já apontou.

const QUADROS = 5;

const respostaSchema = z.object({
  confere: z.boolean(),
  resumo: z.string(),
  observacoes: z.array(z.string()),
  prompt_sugerido: z.string().nullable(),
});

const INSTRUCOES = `Você confere takes gerados no Higgsfield (Seedance 2.0) para um anúncio em vídeo. Recebe quadros do take, o que a cena pedia (descrição e prompt), as fotos dos elementos que deveriam aparecer e os problemas visuais que o cliente já reclamou. Responda em português do Brasil, curto e objetivo.
- confere = true se o take serve para a cena (o essencial está lá), mesmo com detalhes pequenos diferentes; false se falta algo essencial (personagem/produto errado ou ausente, ação diferente, ângulo pedido não aparece) ou há defeito que estraga (rosto/mãos deformados, texto embaralhado em destaque, produto com rótulo errado, cena preta).
- resumo: 1 frase dizendo o que o take mostra e se bate com o pedido.
- observacoes: até 4 pontos concretos (o que está diferente, defeitos, problemas que o cliente já apontou e voltaram a aparecer). Vazio se estiver tudo certo.
- prompt_sugerido: só quando confere = false — o prompt original ajustado (em inglês, com os mesmos @elementos e a mesma duração) para corrigir os pontos; null quando confere = true.
- Não comente o som (você só vê quadros). Não invente o que não dá para ver.`;

const quadrosDoTake = async (midia: Midia) => {
  const temporaria = await mkdtemp(path.join(os.tmpdir(), "encditor-take-"));
  try {
    const duracao = midia.duracao ?? 5;
    const intervalo = Math.max(0.5, Math.round((duracao / QUADROS) * 10) / 10);
    const quadros = (
      await extrairQuadros(
        caminhoDoArquivo(nomeDaUrl(midia.url)),
        temporaria,
        midia.formato === "imagem" ? null : intervalo,
      )
    ).slice(0, QUADROS);
    return await Promise.all(
      quadros.map(async (q) => ({
        segundo: q.segundo,
        dataUrl: `data:image/jpeg;base64,${(await readFile(q.caminho)).toString("base64")}`,
      })),
    );
  } finally {
    await rm(temporaria, { recursive: true, force: true });
  }
};

export const conferirTake = async (
  projetoId: string,
  chave: string,
): Promise<PlanoSalvo> => {
  const projeto = lerProjeto(projetoId);
  if (!projeto) throw new Error("Projeto não encontrado.");
  const plano = lerPlanoSalvo(lerPlano(projetoId));
  const cena = plano.gerado?.cenas.find((c) => chaveCena(c) === chave);
  if (!cena) throw new Error("Cena não encontrada no plano.");
  const midia = (lerMidiasDoCliente(projeto.cliente.id) as Midia[]).find(
    (m) => m.id === plano.vinculos[chave],
  );
  if (!midia) throw new Error("Esse take ainda não foi enviado.");
  // Já olhado (mesmo arquivo): não paga de novo.
  if (plano.conferenciaTakes[chave]?.midiaId === midia.id) return plano;

  const quadros = await quadrosDoTake(midia);
  const elementos = listarElementos(projeto.cliente.id).filter((e) =>
    cena.elementos.includes(e.nome),
  );
  const fotos: { titulo: string; dataUrl: string }[] = [];
  for (const e of elementos) {
    if (!e.imagem) continue;
    const dataUrl = await imagemParaIA(`/api/midia/${e.imagem}`);
    if (dataUrl) fotos.push({ titulo: `@${e.nome}: ${e.descricao}`, dataUrl });
  }
  const aprendizados = lerAprendizados(projeto.cliente.id)?.dados as
    | { problemas_visuais_a_evitar?: string[] }
    | undefined;
  const problemas = aprendizados?.problemas_visuais_a_evitar ?? [];

  const conteudo: OpenAI.Responses.ResponseInputContent[] = [
    {
      type: "input_text",
      text: [
        `CENA ${cena.numero} — o que deveria mostrar: ${cena.descricao}`,
        cena.prompt_higgsfield ? `Prompt usado: ${cena.prompt_higgsfield}` : "",
        cena.feito_no_higgsfield
          ? `Feito na geração: ${cena.feito_no_higgsfield}`
          : "",
        `Formato do vídeo: ${plano.gerado?.formato ?? "9:16"}. Duração do take: ${midia.duracao ?? "?"}s; a cena usa ~${cena.duracao_s}s.`,
        problemas.length
          ? `Problemas visuais que o cliente já reclamou (não podem voltar): ${problemas.join("; ")}`
          : "",
        `Descrição automática do take: ${descreverAnalise(midia.analise ?? null)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
    ...fotos.flatMap((f) => [
      { type: "input_text" as const, text: `Referência ${f.titulo}` },
      {
        type: "input_image" as const,
        image_url: f.dataUrl,
        detail: "low" as const,
      },
    ]),
    ...quadros.flatMap((q) => [
      { type: "input_text" as const, text: `Quadro do take em ${q.segundo}s:` },
      {
        type: "input_image" as const,
        image_url: q.dataUrl,
        detail: "low" as const,
      },
    ]),
  ];

  const resposta = await comNovaTentativa(() =>
    clienteOpenAI().responses.create({
      model: MODELOS.visao,
      instructions: INSTRUCOES,
      input: [{ role: "user", content: conteudo }],
      text: {
        format: {
          type: "json_schema",
          name: "conferencia_do_take",
          strict: true,
          schema: esquemaEstrito(respostaSchema),
        },
      },
    }),
  );
  console.log(
    `[ia] conferência do take ${chave}: ${resposta.usage?.input_tokens ?? 0} tokens de entrada, ${resposta.usage?.output_tokens ?? 0} de saída`,
  );
  const r = respostaSchema.parse(JSON.parse(resposta.output_text));

  // Lê de novo antes de salvar (o plano pode ter mudado enquanto a IA olhava).
  const atual = lerPlanoSalvo(lerPlano(projetoId));
  const novo: PlanoSalvo = {
    ...atual,
    conferenciaTakes: {
      ...atual.conferenciaTakes,
      [chave]: {
        midiaId: midia.id,
        em: Date.now(),
        confere: r.confere,
        resumo: r.resumo,
        observacoes: r.observacoes.slice(0, 4),
        prompt_sugerido: r.confere ? null : r.prompt_sugerido,
      },
    },
  };
  salvarPlano(projetoId, novo);
  return novo;
};
