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
  timeline: z.infer<typeof timelineSchema> | null;
  acoes: string[];
};

const erro = (mensagem: string, status: number) =>
  NextResponse.json({ erro: mensagem }, { status });

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
  const { pedido, anexos, historico, timeline, biblioteca } = corpo.data;

  const sessao: SessaoEdicao = { timeline, biblioteca, acoes: [] };

  // Histórico só em texto; a conversa precisa começar pelo usuário.
  const anteriores = historico
    .filter((m) => m.texto.trim())
    .slice(-LIMITE_HISTORICO);
  while (anteriores[0]?.autor === "ia") anteriores.shift();

  const conversa = {
    ferramentas: criarFerramentas(sessao),
    historico: anteriores.map((m) => ({
      papel: m.autor === "usuario" ? ("user" as const) : ("assistant" as const),
      texto: m.texto,
    })),
    pedido: [
      "Estado atual do projeto:",
      JSON.stringify(resumoDoProjeto(timeline, biblioteca)),
      anexos.length ? `Anexados nesta mensagem: ${anexos.join(", ")}.` : "",
      `Pedido: ${pedido}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };

  try {
    const texto = usarOpenAI
      ? await editarComOpenAI(conversa)
      : await editarComClaude(conversa);

    return NextResponse.json<RespostaIA>({
      resposta:
        texto ||
        (sessao.acoes.length
          ? "Pronto."
          : "Não entendi o que mudar. Pode detalhar?"),
      timeline: sessao.acoes.length ? sessao.timeline : null,
      acoes: sessao.acoes,
      midiasAlteradas: sessao.midiasAlteradas,
    });
  } catch (e) {
    const conhecido = usarOpenAI
      ? mensagemDeErroOpenAI(e)
      : mensagemDeErroClaude(e);
    if (conhecido) return erro(conhecido.erro, conhecido.status);
    throw e;
  }
}
