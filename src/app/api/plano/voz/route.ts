import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { lerProjeto } from "@/servidor/banco";
import { mensagemDeErroOpenAI, openaiConfigurada } from "@/servidor/openai";
import { VOZES } from "@/plano/vozes";
import { gerarVozTeste } from "@/servidor/voz";

// Narração de exemplo do roteiro (voz sintética), para o usuário copiar a
// entonação. POST ?projeto=<id> { voz } → { plano }

export async function POST(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("projeto") ?? "";
  if (!/^[a-z0-9-]{1,40}$/.test(id) || !lerProjeto(id)) {
    return NextResponse.json(
      { erro: "Projeto não encontrado." },
      { status: 404 },
    );
  }
  if (!openaiConfigurada()) {
    return NextResponse.json(
      { erro: "A voz de exemplo usa a OpenAI: falta a OPENAI_API_KEY." },
      { status: 503 },
    );
  }
  const corpo = z
    .object({ voz: z.enum(Object.keys(VOZES) as [keyof typeof VOZES]) })
    .safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ erro: "Voz inválida." }, { status: 400 });
  }
  try {
    return NextResponse.json({
      plano: await gerarVozTeste(id, corpo.data.voz),
    });
  } catch (e) {
    const conhecido = mensagemDeErroOpenAI(e);
    return NextResponse.json(
      {
        erro:
          conhecido?.erro ??
          `Não consegui gerar a voz: ${e instanceof Error ? e.message : String(e)}`,
      },
      { status: conhecido?.status ?? 500 },
    );
  }
}
