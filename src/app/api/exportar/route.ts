import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { exportarProjeto, lerTrabalho } from "@/servidor/exportar";
import { IDS_FORMATO } from "@/timeline/formatos";

// Exportar o MP4 final de um projeto.
// POST { projetoId, nome?, formatos? } → { trabalhos }  (começam na fila)
// GET ?trabalho=<id>        → { trabalho }   (progresso)

// O renderizador busca os vídeos no próprio servidor: usa "localhost" (com
// a mesma porta), seja qual for o nome usado no navegador (ex.:
// enceditor.localhost).
const enderecoInterno = (req: NextRequest) => {
  const url = new URL(req.nextUrl.origin);
  // 127.0.0.1 (e não "localhost", que pode virar ::1): o app só escuta no
  // endereço local IPv4.
  url.hostname = "127.0.0.1";
  return url.origin;
};

export async function POST(req: NextRequest) {
  const corpo = z
    .object({
      projetoId: z.string(),
      nome: z.string().max(80).optional(),
      // Proporções a exportar (uma versão para cada). Vazio = a do projeto.
      formatos: z.array(z.enum(IDS_FORMATO)).max(4).default([]),
    })
    .safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  try {
    const trabalhos = exportarProjeto(
      corpo.data.projetoId,
      enderecoInterno(req),
      corpo.data.nome,
      corpo.data.formatos,
    );
    return NextResponse.json({ trabalhos });
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
}

export async function GET(req: NextRequest) {
  const trabalho = lerTrabalho(req.nextUrl.searchParams.get("trabalho") ?? "");
  if (!trabalho) {
    return NextResponse.json(
      { erro: "Exportação não encontrada." },
      { status: 404 },
    );
  }
  return NextResponse.json({ trabalho });
}
