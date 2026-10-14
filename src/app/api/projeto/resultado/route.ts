import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { lerProjeto, renomearProjeto } from "@/servidor/banco";

// Renomear o projeto. (O resultado no tráfego agora fica em cada vídeo
// exportado: /api/exportacoes/[id].)

export async function PUT(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!lerProjeto(id)) {
    return NextResponse.json(
      { erro: "Projeto não encontrado." },
      { status: 404 },
    );
  }
  const corpo = z
    .object({ nome: z.string().trim().min(1).max(80) })
    .safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  renomearProjeto(id, corpo.data.nome);
  return NextResponse.json({ ok: true });
}
