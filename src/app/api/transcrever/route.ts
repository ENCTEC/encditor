import { NextRequest, NextResponse } from "next/server";
import {
  clienteOpenAI,
  mensagemDeErroOpenAI,
  MODELOS,
  openaiConfigurada,
} from "@/servidor/openai";

// Ditado do chat: recebe a gravação do microfone e devolve o texto.

const LIMITE_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (!openaiConfigurada()) {
    return NextResponse.json(
      { erro: "Ditado desligado: falta OPENAI_API_KEY no arquivo .env.local." },
      { status: 503 },
    );
  }

  const dados = await req.formData().catch(() => null);
  const audio = dados?.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ erro: "Gravação vazia." }, { status: 400 });
  }
  if (audio.size > LIMITE_BYTES) {
    return NextResponse.json(
      { erro: "Gravação longa demais (máx. 25 MB)." },
      { status: 413 },
    );
  }

  try {
    const resposta = await clienteOpenAI().audio.transcriptions.create({
      file: audio,
      model: MODELOS.ditado,
    });
    return NextResponse.json({ texto: resposta.text.trim() });
  } catch (e) {
    const conhecido = mensagemDeErroOpenAI(e);
    if (conhecido) {
      return NextResponse.json(
        { erro: conhecido.erro },
        { status: conhecido.status },
      );
    }
    throw e;
  }
}
