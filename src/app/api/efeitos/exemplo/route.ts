import { readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { IDS_EFEITOS_AUDIO } from "@/catalogo/estilos";
import { exemploDoEfeito } from "@/servidor/efeitos";

// Exemplo para ouvir na aba Estilos: a voz de exemplo com o efeito pedido.
// Uso: GET /api/efeitos/exemplo?efeito=eco

export async function GET(req: NextRequest) {
  const efeito = req.nextUrl.searchParams.get("efeito") ?? "";
  if (!(IDS_EFEITOS_AUDIO as string[]).includes(efeito)) {
    return NextResponse.json({ erro: "Efeito desconhecido." }, { status: 400 });
  }
  const arquivo = await exemploDoEfeito(
    efeito as (typeof IDS_EFEITOS_AUDIO)[number],
  );
  return new Response(new Uint8Array(await readFile(arquivo)), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
