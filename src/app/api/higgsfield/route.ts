import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CenaPlano, lerPlanoSalvo } from "@/plano/tipos";
import { lerPlano, lerProjeto } from "@/servidor/banco";
import { cotacaoDoDia } from "@/servidor/cotacao";
import {
  acompanhar,
  geracoesParaTela,
  iniciarGeracoes,
  prepararTake,
} from "@/servidor/geracoes";
import { higgsfieldConfigurado, RESOLUCOES } from "@/servidor/higgsfield";

// Gerar os takes do plano no Higgsfield (aba Planejar).
// GET ?projeto=<id>: se a chave está configurada, as gerações do projeto
// e o preço de cada take em cada qualidade. POST ?projeto=<id>
// {chaves, resolucao}: pede os vídeos.

const idDoProjeto = (req: NextRequest) => {
  const id = req.nextUrl.searchParams.get("projeto") ?? "";
  return lerProjeto(id) ? id : null;
};

export async function GET(req: NextRequest) {
  const id = idDoProjeto(req);
  if (!id) return NextResponse.json({ erro: "Projeto não encontrado." }, { status: 404 });
  const geracoes = geracoesParaTela(id);
  if (geracoes.some((g) => ["subindo", "na fila", "gerando", "baixando"].includes(g.estado))) {
    acompanhar();
  }
  const plano = lerPlanoSalvo(lerPlano(id));
  const takes = (plano.gerado?.cenas ?? [])
    .filter((c: CenaPlano) => c.origem === "higgsfield")
    .map((c: CenaPlano) => {
      const chave = `cena:${c.apelido}`;
      const porQualidade = Object.fromEntries(
        RESOLUCOES.map((r) => [r, prepararTake(id, chave, r).dados.custo]),
      );
      const { dados } = prepararTake(id, chave, "720p");
      return {
        chave,
        segundos: dados.segundos,
        elementos: dados.elementos,
        aviso: dados.erro ?? null,
        custo: porQualidade,
      };
    });
  return NextResponse.json(
    {
      configurado: higgsfieldConfigurado(),
      takes,
      geracoes: geracoes.map((g) => ({
        id: g.id,
        chave: g.chave,
        estado: g.estado,
        criadoEm: g.criadoEm,
        atualizadoEm: g.atualizadoEm,
        segundos: g.dados.segundos,
        resolucao: g.dados.resolucao,
        custo: g.dados.custo,
        erro: g.dados.erro ?? null,
        midia: g.dados.midia ?? null,
      })),
      cotacao: await cotacaoDoDia(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  const id = idDoProjeto(req);
  if (!id) return NextResponse.json({ erro: "Projeto não encontrado." }, { status: 404 });
  if (!higgsfieldConfigurado()) {
    return NextResponse.json(
      { erro: "Falta a chave da API do Higgsfield (HIGGSFIELD_KEY_ID e HIGGSFIELD_KEY_SECRET no .env.local)." },
      { status: 503 },
    );
  }
  const corpo = z
    .object({ chaves: z.array(z.string()).min(1).max(30), resolucao: z.enum(RESOLUCOES) })
    .safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  try {
    const novas = iniciarGeracoes(id, corpo.data.chaves, corpo.data.resolucao);
    return NextResponse.json({ pedidos: novas.length });
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
