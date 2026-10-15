import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nomeDeElemento } from "@/plano/elementos";
import { apagarArquivos, nomeDaUrl } from "@/servidor/armazenamento";
import {
  apagarElemento,
  atualizarElemento,
  lerElemento,
  listarElementos,
} from "@/servidor/banco";

// Um elemento do Higgsfield: editar (nome, descrição, imagem) ou apagar.

type Contexto = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const { id } = await params;
  const atual = lerElemento(id);
  if (!atual) {
    return NextResponse.json(
      { erro: "Elemento não encontrado." },
      { status: 404 },
    );
  }
  const corpo = z
    .object({
      nome: nomeDeElemento.optional(),
      descricao: z.string().trim().max(1000).optional(),
      imagem: z.string().nullable().optional(),
    })
    .safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json(
      { erro: corpo.error.issues[0]?.message ?? "Pedido inválido." },
      { status: 400 },
    );
  }
  const { nome, descricao, imagem } = corpo.data;
  if (
    nome &&
    nome !== atual.nome &&
    listarElementos(atual.clienteId).some((e) => e.nome === nome)
  ) {
    return NextResponse.json(
      { erro: `Já existe o elemento @${nome}.` },
      { status: 409 },
    );
  }
  let novaImagem: string | null | undefined;
  try {
    novaImagem =
      imagem === undefined ? undefined : imagem ? nomeDaUrl(imagem) : null;
  } catch {
    return NextResponse.json({ erro: "Imagem inválida." }, { status: 400 });
  }
  // Imagem trocada: a antiga sai do disco.
  if (novaImagem !== undefined && atual.imagem && novaImagem !== atual.imagem) {
    await apagarArquivos([atual.imagem]);
  }
  atualizarElemento(id, {
    ...(nome ? { nome } : {}),
    ...(descricao !== undefined ? { descricao } : {}),
    ...(novaImagem !== undefined ? { imagem: novaImagem } : {}),
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const { id } = await params;
  await apagarArquivos(apagarElemento(id));
  return NextResponse.json({ ok: true });
}
