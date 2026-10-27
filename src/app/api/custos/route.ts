import { NextRequest, NextResponse } from "next/server";
import { custosDoCliente } from "@/servidor/banco";

// O que a IA já custou em cada vídeo (projeto) de um cliente: os pedidos,
// do mais antigo ao mais novo, com o valor de cada um (aba Resultados).
export async function GET(req: NextRequest) {
  const cliente = req.nextUrl.searchParams.get("cliente") ?? "";
  if (!/^[a-z0-9-]{1,60}$/.test(cliente)) {
    return NextResponse.json({ erro: "Cliente inválido." }, { status: 400 });
  }
  return NextResponse.json(
    { pedidos: custosDoCliente(cliente) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
