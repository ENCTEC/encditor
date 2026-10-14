import { readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { IDS_EFEITOS_AUDIO } from "@/catalogo/estilos";
import { audioDeExemplo, exemploDoEfeito } from "@/servidor/efeitos";

// Exemplo para ouvir na aba Estilos: o áudio de exemplo sem efeito
// (?efeito=original) ou com o efeito pedido (?efeito=eco).

export async function GET(req: NextRequest) {
  const efeito = req.nextUrl.searchParams.get("efeito") ?? "";
  let arquivo: string;
  if (efeito === "original") {
    arquivo = audioDeExemplo();
  } else if ((IDS_EFEITOS_AUDIO as string[]).includes(efeito)) {
    arquivo = await exemploDoEfeito(
      efeito as (typeof IDS_EFEITOS_AUDIO)[number],
    );
  } else {
    return NextResponse.json({ erro: "Efeito desconhecido." }, { status: 400 });
  }
  return new Response(new Uint8Array(await readFile(arquivo)), {
    headers: {
      "Content-Type": "audio/mpeg",
      // Sem cache longo: se o áudio de exemplo mudar, toca o novo.
      "Cache-Control": "no-cache",
    },
  });
}
