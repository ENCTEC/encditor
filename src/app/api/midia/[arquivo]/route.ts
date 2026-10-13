import { NextRequest, NextResponse } from "next/server";
import {
  infoArquivo,
  lerArquivo,
  tipoDoArquivo,
} from "@/servidor/armazenamento";

// Entrega um arquivo enviado. Aceita "Range" (pedir só um pedaço do
// arquivo), que o navegador usa para pular para qualquer ponto do vídeo.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ arquivo: string }> },
) {
  const { arquivo } = await params;
  const info = await infoArquivo(arquivo);
  if (!info) {
    return NextResponse.json(
      { erro: "Arquivo não encontrado." },
      { status: 404 },
    );
  }

  const cabecalhos = {
    "Content-Type": tipoDoArquivo(arquivo),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=31536000, immutable",
  };

  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (!range) {
    return new Response(lerArquivo(arquivo), {
      headers: { ...cabecalhos, "Content-Length": String(info.tamanho) },
    });
  }

  const ultimo = info.tamanho - 1;
  const inicio = range[1]
    ? Number(range[1])
    : Math.max(0, info.tamanho - Number(range[2]));
  const fim =
    range[1] && range[2] ? Math.min(Number(range[2]), ultimo) : ultimo;

  if (inicio > fim || inicio > ultimo) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${info.tamanho}` },
    });
  }

  return new Response(lerArquivo(arquivo, { inicio, fim }), {
    status: 206,
    headers: {
      ...cabecalhos,
      "Content-Length": String(fim - inicio + 1),
      "Content-Range": `bytes ${inicio}-${fim}/${info.tamanho}`,
    },
  });
}
