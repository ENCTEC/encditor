import { NextRequest, NextResponse } from "next/server";
import { apagarTrabalhoIA, lerTrabalhoIA } from "@/servidor/trabalhosIA";

// O pedido do chat em andamento (ou pronto, esperando o chat aplicar) de
// um projeto: GET ?projeto=<id>; DELETE ?projeto=<id>&trabalho=<id> depois
// de aplicar.

export async function GET(req: NextRequest) {
  const projeto = req.nextUrl.searchParams.get("projeto") ?? "";
  return NextResponse.json({ trabalho: projeto ? lerTrabalhoIA(projeto) : null });
}

export async function DELETE(req: NextRequest) {
  const projeto = req.nextUrl.searchParams.get("projeto") ?? "";
  const trabalho = req.nextUrl.searchParams.get("trabalho") ?? "";
  if (projeto && trabalho) apagarTrabalhoIA(projeto, trabalho);
  return NextResponse.json({ ok: true });
}
