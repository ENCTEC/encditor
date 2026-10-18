import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sincronizarCliente } from "@/conexoes/sincronizar";
import { lerCliente } from "@/servidor/banco";

// Lê da Meta os números das versões ligadas a posts/anúncios.
// POST { cliente, exportacao?, forcar? } → resumo da leitura

export async function POST(req: NextRequest) {
  const corpo = z
    .object({
      cliente: z.string().regex(/^[a-z0-9-]{1,60}$/),
      exportacao: z.string().max(80).optional(),
      forcar: z.boolean().optional(),
    })
    .safeParse(await req.json().catch(() => null));
  if (!corpo.success || !lerCliente(corpo.data.cliente)) {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  const { cliente, exportacao, forcar } = corpo.data;
  return NextResponse.json(
    await sincronizarCliente(cliente, { exportacaoId: exportacao, forcar }),
  );
}
