import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apagarArquivos } from "@/servidor/armazenamento";
import {
  apagarCliente,
  CLIENTE_PADRAO,
  lerCliente,
  listarExportacoesDoCliente,
  listarProjetos,
  renomearCliente,
} from "@/servidor/banco";

// Um cliente: dados, projetos e vídeos exportados; renomear; apagar.

type Contexto = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { id } = await params;
  const cliente = lerCliente(id);
  if (!cliente) {
    return NextResponse.json(
      { erro: "Cliente não encontrado." },
      { status: 404 },
    );
  }
  return NextResponse.json({
    cliente,
    projetos: listarProjetos(id),
    exportacoes: listarExportacoesDoCliente(id),
  });
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const { id } = await params;
  const corpo = z
    .object({ nome: z.string().trim().min(1).max(80) })
    .safeParse(await req.json().catch(() => null));
  if (!corpo.success || !lerCliente(id)) {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  renomearCliente(id, corpo.data.nome);
  return NextResponse.json({ ok: true });
}

// Apaga o cliente com tudo dentro: projetos, vídeos exportados e o banco
// de mídia (inclusive os arquivos). A pasta padrão não pode ser apagada.
export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const { id } = await params;
  if (id === CLIENTE_PADRAO) {
    return NextResponse.json(
      { erro: "A pasta padrão não pode ser apagada." },
      { status: 400 },
    );
  }
  if (!lerCliente(id)) {
    return NextResponse.json(
      { erro: "Cliente não encontrado." },
      { status: 404 },
    );
  }
  await apagarArquivos(apagarCliente(id));
  return NextResponse.json({ ok: true });
}
