import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  lerCliente,
  lerMidiasDoCliente,
  salvarMidiasDoCliente,
} from "@/servidor/banco";

// Banco de mídia do cliente: arquivos compartilhados por todos os
// projetos dele (com as análises de IA).

type Contexto = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { id } = await params;
  return NextResponse.json({ midias: lerMidiasDoCliente(id) });
}

const salvar = async (req: NextRequest, { params }: Contexto) => {
  const { id } = await params;
  const corpo = z
    .object({
      midias: z.array(z.looseObject({ id: z.string(), url: z.string() })),
    })
    .safeParse(await req.json().catch(() => null));
  if (!corpo.success || !lerCliente(id)) {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  salvarMidiasDoCliente(id, corpo.data.midias);
  return NextResponse.json({ ok: true });
};

export const PUT = salvar;
// POST: usado pelo navegador ao fechar a página (sendBeacon).
export const POST = salvar;
