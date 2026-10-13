import { NextRequest, NextResponse } from "next/server";
import { extensaoPermitida, salvarArquivo } from "@/servidor/armazenamento";

// Upload: o navegador envia o arquivo "cru" no corpo (PUT), e ele é gravado
// em disco aos pedaços, sem carregar o vídeo inteiro na memória.
// Uso: PUT /api/midia?nome=cena.mp4

const LIMITE_MB = Number(process.env.MIDIA_LIMITE_MB ?? 1024);

export async function PUT(req: NextRequest) {
  const nomeOriginal = req.nextUrl.searchParams.get("nome") ?? "";
  const extensao = extensaoPermitida(nomeOriginal);
  if (!extensao) {
    return NextResponse.json(
      { erro: `Formato não suportado: "${nomeOriginal}".` },
      { status: 415 },
    );
  }

  const tamanho = Number(req.headers.get("content-length") ?? 0);
  if (tamanho > LIMITE_MB * 1024 * 1024) {
    return NextResponse.json(
      { erro: `Arquivo maior que ${LIMITE_MB} MB.` },
      { status: 413 },
    );
  }

  if (!req.body) {
    return NextResponse.json({ erro: "Arquivo vazio." }, { status: 400 });
  }

  const nome = await salvarArquivo(req.body, extensao);
  return NextResponse.json({ url: `/api/midia/${nome}` });
}
