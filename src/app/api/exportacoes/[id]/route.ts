import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardarMiniatura } from "@/conexoes/miniaturas";
import { MetricasGuardadas, sincronizarCliente } from "@/conexoes/sincronizar";
import {
  lerVinculos,
  preservarAutomaticos,
  semAutomaticos,
  semNumerosDe,
  Vinculos,
  vinculosSchema,
} from "@/conexoes/vinculos";
import { resultadoSchema } from "@/projeto/resultado";
import { apagarArquivos } from "@/servidor/armazenamento";
import {
  apagarExportacao,
  atualizarExportacao,
  lerExportacao,
} from "@/servidor/banco";

// Um vídeo exportado: renomear, registrar o resultado no tráfego, ligar ao
// post/anúncio (métricas automáticas), apagar.

const ehLocal = (u: string | null | undefined): u is string =>
  !!u?.startsWith("/api/midia/");
const miniaturasDe = (v: Vinculos) =>
  [v.instagram?.miniatura, ...v.anuncios.map((a) => a.miniatura)].filter(
    ehLocal,
  );

// Miniaturas: links da Meta são baixados e guardados; o mesmo post/anúncio
// reaproveita a miniatura já guardada; um link local só é aceito se já era
// o desta versão (o navegador não aponta para outro arquivo do disco — ele
// seria apagado junto com a versão).
const comMiniaturasGuardadas = async (
  novos: Vinculos,
  anteriores: Vinculos,
): Promise<Vinculos> => {
  const locais = new Set(miniaturasDe(anteriores));
  const jaGuardada = (id: string) =>
    anteriores.instagram?.midiaId === id &&
    ehLocal(anteriores.instagram.miniatura)
      ? anteriores.instagram.miniatura
      : (anteriores.anuncios.find(
          (a) => a.anuncioId === id && ehLocal(a.miniatura),
        )?.miniatura ?? null);
  const guardar = async (id: string, url: string | null) =>
    jaGuardada(id) ??
    (ehLocal(url) ? (locais.has(url) ? url : null) : guardarMiniatura(url));
  return {
    instagram: novos.instagram
      ? {
          ...novos.instagram,
          miniatura: await guardar(
            novos.instagram.midiaId,
            novos.instagram.miniatura,
          ),
        }
      : null,
    anuncios: await Promise.all(
      novos.anuncios.map(async (a) => ({
        ...a,
        miniatura: await guardar(a.anuncioId, a.miniatura),
      })),
    ),
  };
};

const nomeDoArquivo = (u: string) => u.split("?")[0].split("/").pop() ?? "";

type Contexto = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const { id } = await params;
  const atual = lerExportacao(id);
  if (!atual) {
    return NextResponse.json(
      { erro: "Vídeo não encontrado." },
      { status: 404 },
    );
  }
  const corpo = z
    .object({
      nome: z.string().trim().min(1).max(80).optional(),
      resultado: resultadoSchema.nullable().optional(),
      vinculos: vinculosSchema.optional(),
    })
    .safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  const { vinculos, resultado, nome } = corpo.data;
  const metricas = atual.metricas as MetricasGuardadas | null;
  const automaticos = metricas?.automaticos ?? semAutomaticos();

  if (nome !== undefined) atualizarExportacao(id, { nome });
  if (resultado !== undefined) {
    // Numa versão ligada, os campos que vêm da Meta continuam com o valor
    // da Meta (o modal pode ter números antigos); o resto é da pessoa.
    atualizarExportacao(id, {
      resultado: resultado
        ? preservarAutomaticos(
            resultado,
            lerExportacao(id)?.resultado,
            automaticos,
          )
        : null,
    });
  }
  if (!vinculos) return NextResponse.json({ ok: true });

  const anteriores = lerVinculos(atual.vinculos);
  const idsAnuncios = (v: Vinculos) =>
    v.anuncios
      .map((a) => a.anuncioId)
      .sort()
      .join(",");
  const mudouPago = idsAnuncios(anteriores) !== idsAnuncios(vinculos);
  const mudouInstagram =
    (anteriores.instagram?.midiaId ?? null) !==
    (vinculos.instagram?.midiaId ?? null);

  const novos = await comMiniaturasGuardadas(vinculos, anteriores);
  const resultadoAtual = lerExportacao(id)?.resultado;
  atualizarExportacao(id, {
    vinculos: novos,
    // Ligação trocada/desfeita: os números da fonte antiga saem (senão
    // pareceriam digitados pela pessoa).
    ...(mudouPago || mudouInstagram
      ? {
          resultado: semNumerosDe(resultadoAtual, automaticos, {
            pago: mudouPago,
            instagram: mudouInstagram,
          }),
          metricas: null,
        }
      : {}),
  });
  // Miniaturas que ficaram sem uso.
  const usadas = new Set(miniaturasDe(novos));
  const sobras = miniaturasDe(anteriores).filter((u) => !usadas.has(u));
  if (sobras.length) await apagarArquivos(sobras.map(nomeDoArquivo));

  // Já busca os números desta versão (entra na fila se outra leitura do
  // cliente estiver rodando).
  const leitura = await sincronizarCliente(atual.clienteId, {
    exportacaoId: id,
    forcar: true,
  });
  return NextResponse.json({ ok: true, leitura });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const { id } = await params;
  await apagarArquivos(apagarExportacao(id));
  return NextResponse.json({ ok: true });
}
