import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resultadoSchema } from "@/projeto/resultado";
import { lerProjeto, renomearProjeto, salvarResultado } from "@/servidor/banco";

// Resultado do vídeo no tráfego (e nome do projeto). O resultado é o que a
// IA vai usar para aprender o que funciona com cada cliente.

export async function PUT(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!lerProjeto(id)) {
    return NextResponse.json(
      { erro: "Projeto não encontrado." },
      { status: 404 },
    );
  }
  const corpo = z
    .object({
      resultado: resultadoSchema.nullable().optional(),
      nome: z.string().trim().min(1).max(80).optional(),
    })
    .safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  if (corpo.data.resultado !== undefined)
    salvarResultado(id, corpo.data.resultado);
  if (corpo.data.nome) renomearProjeto(id, corpo.data.nome);
  return NextResponse.json({ ok: true });
}
