import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { lerProjeto, salvarProjeto } from "@/servidor/banco";
import { timelineSchema } from "@/timeline/schema";

// Projeto salvo no banco do servidor. Por enquanto o app usa o projeto
// "principal"; outro id (?id=...) serve para testes e, no futuro, para
// vários projetos por usuário.

const idDoProjeto = (req: NextRequest) => {
  const id = req.nextUrl.searchParams.get("id") ?? "principal";
  return /^[a-z0-9-]{1,40}$/.test(id) ? id : null;
};

const projetoSchema = z.object({
  timeline: timelineSchema,
  biblioteca: z.array(z.looseObject({ id: z.string(), url: z.string() })),
  mensagens: z.array(z.looseObject({ id: z.string(), texto: z.string() })),
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
  const atualizadoEm = salvarProjeto(id, corpo.data);
  return NextResponse.json({ atualizadoEm });
};

export const PUT = salvar;
// POST também salva: é o método que o navegador usa ao fechar a página
// (navigator.sendBeacon).
export const POST = salvar;
