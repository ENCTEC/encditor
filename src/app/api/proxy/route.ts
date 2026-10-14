import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nomeDaUrl } from "@/servidor/armazenamento";
import { gerarProxy } from "@/servidor/proxy";

// Gera (ou devolve do cache) a cópia leve de um vídeo para o preview.

const corpoSchema = z.object({ url: z.string() });

export async function POST(req: NextRequest) {
  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  let original: string;
  try {
    original = nomeDaUrl(corpo.data.url);
  } catch {
    return NextResponse.json({ erro: "Arquivo inválido." }, { status: 400 });
  }
  try {
    return NextResponse.json({
      url: `/api/midia/${await gerarProxy(original)}`,
    });
  } catch (e) {
    return NextResponse.json(
      {
        erro: `Não consegui gerar o preview leve: ${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 500 },
    );
  }
}
