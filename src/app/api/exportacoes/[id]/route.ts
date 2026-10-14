import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resultadoSchema } from "@/projeto/resultado";
import { apagarArquivos } from "@/servidor/armazenamento";
import {
  apagarExportacao,
  atualizarExportacao,
  lerExportacao,
} from "@/servidor/banco";

// Um vídeo exportado: renomear, registrar o resultado no tráfego, apagar.

type Contexto = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const { id } = await params;
  if (!lerExportacao(id)) {
    return NextResponse.json(
      { erro: "Vídeo não encontrado." },
      { status: 404 },
    );
  }
  const corpo = z
    .object({
      nome: z.string().trim().min(1).max(80).optional(),
      resultado: resultadoSchema.nullable().optional(),
    })
    .safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  atualizarExportacao(id, corpo.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const { id } = await params;
  await apagarArquivos(apagarExportacao(id));
  return NextResponse.json({ ok: true });
}
