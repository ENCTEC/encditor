import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { IDS_EFEITOS_AUDIO } from "@/catalogo/estilos";
import { nomeDaUrl } from "@/servidor/armazenamento";
import { aplicarEfeitos } from "@/servidor/efeitos";

// Aplica efeitos de áudio num arquivo enviado e devolve a URL do novo
// arquivo (o original continua guardado).

const corpoSchema = z.object({
  url: z.string(),
  efeitos: z.array(z.enum(IDS_EFEITOS_AUDIO)).min(1),
});

export async function POST(req: NextRequest) {
  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  try {
    const nome = await aplicarEfeitos(
      nomeDaUrl(corpo.data.url),
      corpo.data.efeitos,
    );
    return NextResponse.json({ url: `/api/midia/${nome}` });
  } catch (e) {
    return NextResponse.json(
      {
        erro: `Não consegui aplicar os efeitos: ${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 500 },
    );
  }
}
