import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resumoDoProjeto } from "@/ia/estado";
import { criarFerramentas, SessaoEdicao } from "@/ia/ferramentas";
import { INSTRUCOES } from "@/ia/instrucoes";
import { Midia } from "@/projeto/tipos";
import { timelineSchema } from "@/timeline/schema";

// Recebe um pedido do chat, deixa o Claude editar a timeline com as
// ferramentas e devolve a timeline nova + a resposta em texto.

const MODELO = "claude-opus-5-5";
const LIMITE_HISTORICO = 12;

const corpoSchema = z.object({
  pedido: z.string(),
  // Nomes das mídias anexadas nesta mensagem ("esse insert").
  anexos: z.array(z.string()),
  historico: z.array(
    z.object({ autor: z.enum(["usuario", "ia"]), texto: z.string() }),
  ),
  timeline: timelineSchema,
  biblioteca: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      papel: z.enum(["cena", "insert", "audio"]),
      formato: z.enum(["video", "imagem", "audio"]),
      url: z.string(),
      nomeArquivo: z.string(),
      duracao: z.number().nullable(),
      largura: z.number().nullable(),
      altura: z.number().nullable(),
    }),
  ),
});

export type RespostaIA = {
  resposta: string;
  timeline: z.infer<typeof timelineSchema> | null;
  acoes: string[];
};

const erro = (mensagem: string, status: number) =>
  NextResponse.json({ erro: mensagem }, { status });

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return erro(
      "A IA ainda não está configurada: falta a chave ANTHROPIC_API_KEY no arquivo .env.local (veja o README).",
      503,
    );
  }

  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return erro("Pedido inválido.", 400);
  }
  const { pedido, anexos, historico, timeline, biblioteca } = corpo.data;

  const sessao: SessaoEdicao = {
    timeline,
    biblioteca: biblioteca as Midia[],
    acoes: [],
  };

  // Histórico só em texto; a API exige que a conversa comece pelo usuário.
  const anteriores = historico
    .filter((m) => m.texto.trim())
    .slice(-LIMITE_HISTORICO);
  while (anteriores[0]?.autor === "ia") anteriores.shift();

  const mensagens: Anthropic.Beta.BetaMessageParam[] = [
    ...anteriores.map(
      (m): Anthropic.Beta.BetaMessageParam => ({
        role: m.autor === "usuario" ? "user" : "assistant",
        content: m.texto,
      }),
    ),
    {
      role: "user",
      content: [
        "Estado atual do projeto:",
        JSON.stringify(resumoDoProjeto(timeline, sessao.biblioteca)),
        anexos.length ? `Anexados nesta mensagem: ${anexos.join(", ")}.` : "",
        `Pedido: ${pedido}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];

  const client = new Anthropic();

  try {
    const final = await client.beta.messages.toolRunner({
      model: MODELO,
      max_tokens: 16000,
      max_iterations: 20,
      output_config: { effort: "medium" },
      // Se o modelo recusar por engano (falso positivo de segurança), a API
      // tenta automaticamente outro modelo adequado.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      cache_control: { type: "ephemeral" },
      system: INSTRUCOES,
      tools: criarFerramentas(sessao),
      messages: mensagens,
    });

    if (final.stop_reason === "refusal") {
      return NextResponse.json<RespostaIA>({
        resposta:
          "Não consegui fazer esse pedido. Tente descrever de outro jeito.",
        timeline: null,
        acoes: [],
      });
    }

    const texto = final.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return NextResponse.json<RespostaIA>({
      resposta:
        texto ||
        (sessao.acoes.length
          ? "Pronto."
          : "Não entendi o que mudar. Pode detalhar?"),
      timeline: sessao.acoes.length ? sessao.timeline : null,
      acoes: sessao.acoes,
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return erro(
        "A chave da API da Anthropic é inválida (ANTHROPIC_API_KEY).",
        401,
      );
    }
    if (e instanceof Anthropic.PermissionDeniedError) {
      return erro("A chave da API não tem permissão para esse modelo.", 403);
    }
    if (e instanceof Anthropic.RateLimitError) {
      return erro("Muitos pedidos seguidos à IA. Espere alguns segundos.", 429);
    }
    if (e instanceof Anthropic.APIConnectionError) {
      return erro("Sem conexão com a API da Anthropic.", 502);
    }
    if (e instanceof Anthropic.APIError) {
      return erro(`Erro da API da Anthropic (${e.status}): ${e.message}`, 502);
    }
    throw e;
  }
}
