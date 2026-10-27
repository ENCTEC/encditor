import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { lerProjeto } from "@/servidor/banco";
import { conferirTake } from "@/servidor/conferirTake";
import { comCusto } from "@/servidor/custos";
import { mensagemDeErroOpenAI, openaiConfigurada } from "@/servidor/openai";

// Olhada da IA num take enviado (só informa; não trava nada).
// POST ?projeto=<id> { chave: "cena:<apelido>" } → { plano }

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
      { erro: "Falta a OPENAI_API_KEY." },
      { status: 503 },
    );
  }
  const corpo = z
    .object({ chave: z.string().min(1).max(120) })
    .safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  try {
    return NextResponse.json({
      plano: await comCusto(
        {
          projetoId: id,
          clienteId: lerProjeto(id)?.cliente.id ?? null,
          tipo: "olhada no take",
          descricao: corpo.data.chave,
        },
        () => conferirTake(id, corpo.data.chave),
      ),
    });
  } catch (e) {
    const conhecido = mensagemDeErroOpenAI(e);
    return NextResponse.json(
      { erro: conhecido?.erro ?? (e instanceof Error ? e.message : String(e)) },
      { status: conhecido?.status ?? 500 },
    );
  }
}
