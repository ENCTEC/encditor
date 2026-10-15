import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nomeDeElemento } from "@/plano/elementos";
import { nomeDaUrl } from "@/servidor/armazenamento";
import { criarElemento, lerCliente, listarElementos } from "@/servidor/banco";

// Elementos do Higgsfield de um cliente (personagens, produtos, lugares):
// GET lista; POST { nome, descricao, imagem? (url) } cria.

type Contexto = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { id } = await params;
  if (!lerCliente(id)) {
    return NextResponse.json(
      { erro: "Cliente não encontrado." },
      { status: 404 },
    );
  }
  return NextResponse.json({ elementos: listarElementos(id) });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const { id } = await params;
  if (!lerCliente(id)) {
    return NextResponse.json(
      { erro: "Cliente não encontrado." },
      { status: 404 },
    );
  }
  const corpo = z
    .object({
      nome: nomeDeElemento,
      descricao: z.string().trim().max(1000),
      imagem: z.string().nullable(),
    })
    .safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json(
      { erro: corpo.error.issues[0]?.message ?? "Pedido inválido." },
      { status: 400 },
    );
  }
  if (listarElementos(id).some((e) => e.nome === corpo.data.nome)) {
    return NextResponse.json(
      { erro: `Já existe o elemento @${corpo.data.nome}.` },
      { status: 409 },
    );
  }
  let imagem: string | null = null;
  try {
    imagem = corpo.data.imagem ? nomeDaUrl(corpo.data.imagem) : null;
  } catch {
    return NextResponse.json({ erro: "Imagem inválida." }, { status: 400 });
  }
  const elemento = criarElemento({
    clienteId: id,
    nome: corpo.data.nome,
    descricao: corpo.data.descricao,
    imagem,
  });
  return NextResponse.json({ id: elemento });
}
