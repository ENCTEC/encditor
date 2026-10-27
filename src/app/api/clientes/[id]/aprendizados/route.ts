import { NextRequest, NextResponse } from "next/server";
import { lerCliente } from "@/servidor/banco";
import { mensagemDeErroOpenAI, openaiConfigurada } from "@/servidor/openai";
import { obterAprendizados } from "@/servidor/planejador";
import { comCusto } from "@/servidor/custos";

// O que o encEditor aprendeu com os resultados e opiniões dos vídeos do
// cliente (resumido pela IA; só refaz quando algum resultado muda).

type Contexto = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { id } = await params;
  if (!lerCliente(id)) {
    return NextResponse.json(
      { erro: "Cliente não encontrado." },
      { status: 404 },
    );
  }
  if (!openaiConfigurada()) return NextResponse.json({ aprendizados: null });
  try {
    return NextResponse.json({
      aprendizados: await comCusto(
        { projetoId: null, clienteId: id, tipo: "aprendizados", descricao: "aprendizados dos resultados" },
        () => obterAprendizados(id),
      ),
    });
  } catch (e) {
    const conhecido = mensagemDeErroOpenAI(e);
    return NextResponse.json(
      { erro: conhecido?.erro ?? String(e) },
      { status: conhecido?.status ?? 500 },
    );
  }
}
