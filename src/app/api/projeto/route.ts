import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apagarArquivos } from "@/servidor/armazenamento";
import {
  apagarProjeto,
  CLIENTE_PADRAO,
  lerProjeto,
  salvarMidiasDoCliente,
  salvarProjeto,
} from "@/servidor/banco";
import { timelineSchema } from "@/timeline/schema";

// Projeto (vídeo) salvo no banco: timeline e conversa. Os arquivos ficam
// no banco de mídia do CLIENTE do projeto (compartilhado entre projetos).
// ?id=<projeto> escolhe o projeto (padrão "principal").

const idDoProjeto = (req: NextRequest) => {
  const id = req.nextUrl.searchParams.get("id") ?? "principal";
  return /^[a-z0-9-]{1,40}$/.test(id) ? id : null;
};

const projetoSchema = z.object({
  timeline: timelineSchema,
  mensagens: z.array(z.looseObject({ id: z.string(), texto: z.string() })),
  // Versões antigas do app mandavam a biblioteca junto: vai para o banco
  // do cliente.
  biblioteca: z
    .array(z.looseObject({ id: z.string(), url: z.string() }))
    .optional(),
});

export async function GET(req: NextRequest) {
  const id = idDoProjeto(req);
  if (!id) return NextResponse.json({ erro: "Id inválido." }, { status: 400 });
  const salvo = lerProjeto(id);
  return NextResponse.json(salvo ?? { projeto: null, atualizadoEm: null });
}

const salvar = async (req: NextRequest) => {
  const id = idDoProjeto(req);
  if (!id) return NextResponse.json({ erro: "Id inválido." }, { status: 400 });
  const corpo = projetoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ erro: "Projeto inválido." }, { status: 400 });
  }
  const { timeline, mensagens, biblioteca } = corpo.data;
  const atualizadoEm = salvarProjeto(id, { timeline, mensagens });
  if (biblioteca?.length) {
    salvarMidiasDoCliente(
      lerProjeto(id)?.cliente.id ?? CLIENTE_PADRAO,
      biblioteca,
    );
  }
  return NextResponse.json({ atualizadoEm });
};

export const PUT = salvar;
// POST também salva: é o método que o navegador usa ao fechar a página
// (navigator.sendBeacon).
export const POST = salvar;

// Apaga o projeto e os vídeos exportados dele (o banco de mídia é do
// cliente e continua).
export async function DELETE(req: NextRequest) {
  const id = idDoProjeto(req);
  if (!id) return NextResponse.json({ erro: "Id inválido." }, { status: 400 });
  await apagarArquivos(apagarProjeto(id));
  return NextResponse.json({ ok: true });
}
