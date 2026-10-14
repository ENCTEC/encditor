import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { exportarProjeto, lerTrabalho } from "@/servidor/exportar";

// Exportar o MP4 final de um projeto.
// POST { projetoId, nome? } → { trabalho }   (começa na fila)
// GET ?trabalho=<id>        → { trabalho }   (progresso)

export async function POST(req: NextRequest) {
  const corpo = z
    .object({ projetoId: z.string(), nome: z.string().max(80).optional() })
    .safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  try {
    const trabalho = exportarProjeto(
      corpo.data.projetoId,
      req.nextUrl.origin,
      corpo.data.nome,
    );
    return NextResponse.json({ trabalho });
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
}

export async function GET(req: NextRequest) {
  const trabalho = lerTrabalho(req.nextUrl.searchParams.get("trabalho") ?? "");
  if (!trabalho) {
    return NextResponse.json(
      { erro: "Exportação não encontrada." },
      { status: 404 },
    );
  }
  return NextResponse.json({ trabalho });
}
