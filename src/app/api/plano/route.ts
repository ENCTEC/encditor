import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { briefingSchema, lerPlanoSalvo, planoSalvoSchema } from "@/plano/tipos";
import { apagarArquivos } from "@/servidor/armazenamento";
import { lerPlano, lerProjeto, salvarPlano } from "@/servidor/banco";
import { mensagemDeErroOpenAI, openaiConfigurada } from "@/servidor/openai";
import { conversarComPlanejador } from "@/servidor/planejador";

// Plano de um projeto (aba Planejar).
// GET  ?projeto=<id>                  → { plano }
// PUT  ?projeto=<id> { briefing?, vinculos?, musicaPulada?, montadoEm?,
//                      recomecar? }   → { plano }   (salva o que veio)
// POST ?projeto=<id> { mensagem }     → { plano }   (conversa com a IA)

const idDoProjeto = (req: NextRequest) => {
  const id = req.nextUrl.searchParams.get("projeto") ?? "";
  return /^[a-z0-9-]{1,40}$/.test(id) && lerProjeto(id) ? id : null;
};

const erro = (mensagem: string, status: number) =>
  NextResponse.json({ erro: mensagem }, { status });

export async function GET(req: NextRequest) {
  const id = idDoProjeto(req);
  if (!id) return erro("Projeto não encontrado.", 404);
  return NextResponse.json({ plano: lerPlanoSalvo(lerPlano(id)) });
}

export async function PUT(req: NextRequest) {
  const id = idDoProjeto(req);
  if (!id) return erro("Projeto não encontrado.", 404);
  const corpo = z
    .object({
      briefing: briefingSchema.optional(),
      vinculos: planoSalvoSchema.shape.vinculos.optional(),
      musicaPulada: z.boolean().optional(),
      montadoEm: z.number().nullable().optional(),
      // Apaga a conversa e o plano gerado (o briefing fica).
      recomecar: z.boolean().optional(),
    })
    .safeParse(await req.json().catch(() => null));
  if (!corpo.success) return erro("Pedido inválido.", 400);
  const { recomecar, ...mudancas } = corpo.data;
  const atual = lerPlanoSalvo(lerPlano(id));
  const novo = {
    ...atual,
    ...Object.fromEntries(
      Object.entries(mudancas).filter(([, v]) => v !== undefined),
    ),
    ...(recomecar
      ? {
          conversa: [],
          gerado: null,
          geradoEm: null,
          montadoEm: null,
          vozTeste: null,
        }
      : {}),
  };
  // Recomeçar: a narração de exemplo (voz sintética) sai do disco.
  if (recomecar && atual.vozTeste) {
    await apagarArquivos([
      atual.vozTeste.arquivo,
      ...atual.vozTeste.trechos.map((t) => t.arquivo),
    ]);
  }
  // Exemplos tirados do briefing: o arquivo sai do disco.
  if (mudancas.briefing) {
    const ficam = new Set(mudancas.briefing.exemplos.map((e) => e.url));
    await apagarArquivos(
      atual.briefing.exemplos
        .filter((e) => !ficam.has(e.url))
        .map((e) => e.url.split("/").pop() ?? ""),
    );
  }
  salvarPlano(id, novo);
  return NextResponse.json({ plano: novo });
}

export async function POST(req: NextRequest) {
  const id = idDoProjeto(req);
  if (!id) return erro("Projeto não encontrado.", 404);
  if (!openaiConfigurada()) {
    return erro(
      "O planejador usa a OpenAI: falta a chave OPENAI_API_KEY no .env.local.",
      503,
    );
  }
  const corpo = z
    .object({ mensagem: z.string().trim().min(1).max(8000) })
    .safeParse(await req.json().catch(() => null));
  if (!corpo.success) return erro("Escreva uma mensagem.", 400);
  try {
    const plano = await conversarComPlanejador(id, corpo.data.mensagem);
    return NextResponse.json({ plano });
  } catch (e) {
    const conhecido = mensagemDeErroOpenAI(e);
    if (conhecido) return erro(conhecido.erro, conhecido.status);
    console.error(e);
    return erro(
      `Não consegui planejar: ${e instanceof Error ? e.message : String(e)}`,
      500,
    );
  }
}
