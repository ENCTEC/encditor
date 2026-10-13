import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Analise } from "@/projeto/analise";
import { analisarArquivo } from "@/servidor/analise";
import { nomeDaUrl } from "@/servidor/armazenamento";
import { mensagemDeErroOpenAI, openaiConfigurada } from "@/servidor/openai";

// Analisa um arquivo já enviado (fala + conteúdo visual).
// Pode levar de segundos a alguns minutos, conforme o tamanho do vídeo.

const corpoSchema = z.object({
  url: z.string(),
  formato: z.enum(["video", "imagem", "audio"]),
  duracao: z.number().nullable(),
});

const falha = (erro: string, status: number) =>
  NextResponse.json<Analise>(
    { status: "erro", erro, transcricao: null, visual: null },
    { status },
  );

export async function POST(req: NextRequest) {
  if (!openaiConfigurada()) {
    return falha(
      "Análise desligada: falta OPENAI_API_KEY no arquivo .env.local.",
      503,
    );
  }
  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return falha("Pedido inválido.", 400);

  let nome: string;
  try {
    nome = nomeDaUrl(corpo.data.url);
  } catch {
    return falha("Só arquivos enviados ao Encditor podem ser analisados.", 400);
  }

  try {
    const analise = await analisarArquivo(
      nome,
      corpo.data.formato,
      corpo.data.duracao,
    );
    return NextResponse.json(analise);
  } catch (e) {
    const conhecido = mensagemDeErroOpenAI(e);
    if (conhecido) return falha(conhecido.erro, conhecido.status);
    return falha(e instanceof Error ? e.message : String(e), 500);
  }
}
