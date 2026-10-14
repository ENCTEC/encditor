import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { criarProjeto, lerCliente } from "@/servidor/banco";
import { timelineVazia } from "@/timeline/operacoes";

// Cria um projeto (vídeo) vazio dentro de um cliente.

type Contexto = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Contexto) {
  const { id } = await params;
  const corpo = z
    .object({ nome: z.string().trim().min(1).max(80) })
    .safeParse(await req.json().catch(() => null));
  if (!corpo.success || !lerCliente(id)) {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  const projetoId = criarProjeto(id, corpo.data.nome, {
    timeline: timelineVazia(),
    mensagens: [],
  });
  return NextResponse.json({ id: projetoId });
}
