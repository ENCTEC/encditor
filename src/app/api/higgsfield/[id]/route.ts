import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { lerGeracao } from "@/servidor/banco";
import { cancelarGeracao, Geracao, marcarLigada } from "@/servidor/geracoes";

// Uma geração do Higgsfield: cancelar (só na fila) ou marcar que o Mapa
// do Plano já ligou o vídeo ao take.
type Contexto = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Contexto) {
  const { id } = await params;
  const g = lerGeracao(id) as Geracao | null;
  if (!g) return NextResponse.json({ erro: "Geração não encontrada." }, { status: 404 });
  const corpo = z
    .object({ acao: z.enum(["cancelar", "ligado"]) })
    .safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  try {
    if (corpo.data.acao === "cancelar") await cancelarGeracao(g);
    else marcarLigada(g);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
