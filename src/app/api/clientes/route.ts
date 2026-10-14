import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { criarCliente, listarClientes } from "@/servidor/banco";

// Clientes (pastas): listar e criar.

export async function GET() {
  return NextResponse.json({ clientes: listarClientes() });
}

export async function POST(req: NextRequest) {
  const corpo = z
    .object({ nome: z.string().trim().min(1).max(80) })
    .safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ erro: "Nome inválido." }, { status: 400 });
  }
  return NextResponse.json({ id: criarCliente(corpo.data.nome) });
}
