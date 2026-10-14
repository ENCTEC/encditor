import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  apagarArquivos,
  caminhoDoArquivo,
  nomeDaUrl,
  reservarArquivo,
} from "@/servidor/armazenamento";
import { extrairAudioParaUso } from "@/servidor/ffmpeg";

// Extrai o áudio de um vídeo enviado e grava como um arquivo mp3 novo
// (ex.: a narração gravada em vídeo, para virar faixa de áudio e legenda).
// apagarOriginal: true = o vídeo foi enviado só para isso e pode sair do
// disco depois da extração.

const corpoSchema = z.object({
  url: z.string(),
  apagarOriginal: z.boolean().optional(),
});

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

  const destino = await reservarArquivo(".mp3");
  try {
    const temAudio = await extrairAudioParaUso(
      caminhoDoArquivo(original),
      destino.caminho,
    );
    if (!temAudio) {
      await apagarArquivos([destino.nome]);
      return NextResponse.json(
        { erro: "Esse vídeo não tem som para extrair." },
        { status: 422 },
      );
    }
  } catch (e) {
    await apagarArquivos([destino.nome]);
    return NextResponse.json(
      {
        erro: `Não consegui extrair o áudio: ${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 500 },
    );
  }

  if (corpo.data.apagarOriginal) await apagarArquivos([original]);
  return NextResponse.json({ url: `/api/midia/${destino.nome}` });
}
