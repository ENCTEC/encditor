import { z } from "zod";
import {
  lerResultado,
  Resultado,
  ResultadoOrganico,
  ResultadoPago,
  resultadoVazio,
} from "@/projeto/resultado";

// Cada versão exportada pode ser ligada ao post do Instagram e aos
// anúncios em que ela foi usada. Com isso o encEditor lê os números
// sozinho (src/conexoes/meta.ts) e preenche o resultado da versão.

// IDs da Meta são só números (contas de anúncios: "act_" + números). Eles
// vão no endereço das chamadas à Meta: nada além disso é aceito.
const idMeta = z.string().regex(/^\d{1,30}$/);
const idContaAnuncio = z.string().regex(/^(act_)?\d{1,30}$/);

export const vinculoInstagramSchema = z.object({
  contaId: idMeta,
  usuario: z.string().nullable(),
  midiaId: idMeta,
  link: z.string().nullable(),
  miniatura: z.string().nullable(),
  legenda: z.string().nullable(),
  publicadoEm: z.string().nullable(),
  // REELS, FEED…: algumas métricas só existem para um tipo.
  tipo: z.string().nullable(),
});

export const vinculoAnuncioSchema = z.object({
  contaId: idContaAnuncio,
  anuncioId: idMeta,
  nome: z.string(),
  miniatura: z.string().nullable(),
  // Objetivo do conjunto de anúncios (ver tipoDoConjunto em meta.ts).
  tipo: z.enum(["conversas", "cliques"]).nullable().optional(),
});

export const vinculosSchema = z.object({
  instagram: vinculoInstagramSchema.nullable(),
  // O mesmo vídeo pode estar em vários anúncios: os números são somados.
  anuncios: z.array(vinculoAnuncioSchema),
});

export type VinculoInstagram = z.infer<typeof vinculoInstagramSchema>;
export type VinculoAnuncio = z.infer<typeof vinculoAnuncioSchema>;
export type Vinculos = z.infer<typeof vinculosSchema>;

export const vinculosVazios = (): Vinculos => ({
  instagram: null,
  anuncios: [],
});

export const lerVinculos = (bruto: unknown): Vinculos => {
  const v = vinculosSchema.safeParse(bruto);
  return v.success ? v.data : vinculosVazios();
};

export const temVinculo = (v: Vinculos) =>
  !!v.instagram || v.anuncios.length > 0;

// Números de UM anúncio, já lidos da Meta.
export type NumerosAnuncio = {
  gasto: number;
  impressoes: number;
  cliquesNoLink: number;
  conversas: number;
  // null = o anúncio não rastreia compras (não é "zero vendas").
  compras: number | null;
  // O que o conjunto de anúncios otimiza (objetivo/destino): conversas
  // (WhatsApp, Direct, Messenger) ou cliques. null = não deu para saber.
  tipo: "conversas" | "cliques" | null;
  moeda: string | null;
};

const arred = (n: number) => Math.round(n * 100) / 100;
const somar = (
  lista: NumerosAnuncio[],
  campo: "gasto" | "impressoes" | "cliquesNoLink" | "conversas",
) => lista.reduce((t, a) => t + a[campo], 0);

// Soma os anúncios e monta o bloco "Pago" do resultado.
// - O tipo (conversas ou cliques) vem do objetivo dos anúncios que tiveram
//   entrega (um anúncio de WhatsApp sem conversas ainda é de conversas).
// - O custo por resultado usa só o gasto dos anúncios desse tipo: somar o
//   gasto de um impulsionamento de tráfego ao de WhatsApp inflaria o custo
//   por conversa.
// - O CTR é de todos (cliques no link ÷ impressões). Moedas diferentes não
//   se somam: o custo fica vazio e vira aviso.
export const pagoDosAnuncios = (
  lista: NumerosAnuncio[],
): { pago: ResultadoPago; avisos: string[] } => {
  const avisos: string[] = [];
  const comEntrega = lista.filter((a) => a.impressoes > 0);
  const base = comEntrega.length ? comEntrega : lista;
  const tipos = base.map((a) => a.tipo);
  const tipo: "conversas" | "cliques" = tipos.includes("conversas")
    ? "conversas"
    : tipos.includes("cliques")
      ? "cliques"
      : somar(lista, "conversas") > 0
        ? "conversas"
        : "cliques";
  // Anúncios que contam para o resultado: os do tipo escolhido e os de
  // objetivo desconhecido.
  const doTipo = lista.filter((a) => a.tipo === tipo || a.tipo === null);
  const resultados =
    tipo === "conversas"
      ? somar(doTipo, "conversas")
      : somar(doTipo, "cliquesNoLink");
  const gastoTotal = somar(lista, "gasto");
  const gastoDoTipo = somar(doTipo, "gasto");
  if (gastoTotal > 0 && (gastoTotal - gastoDoTipo) / gastoTotal > 0.2) {
    avisos.push(
      `Parte do gasto (${arred(gastoTotal - gastoDoTipo)}) é de anúncios com outro objetivo e ficou fora do custo por ${tipo === "conversas" ? "conversa" : "clique"}.`,
    );
  }
  const moedas = [
    ...new Set(lista.map((a) => a.moeda).filter(Boolean)),
  ] as string[];
  if (moedas.length > 1) {
    avisos.push(
      `Os anúncios ligados estão em moedas diferentes (${moedas.join(", ")}): o custo por resultado não foi calculado.`,
    );
  }
  const impressoes = somar(lista, "impressoes");
  const comCompras = lista.filter((a) => a.compras !== null);
  return {
    pago: {
      tipo,
      resultados,
      ctr: impressoes
        ? arred((somar(lista, "cliquesNoLink") / impressoes) * 100)
        : null,
      custoPorResultado:
        resultados && moedas.length <= 1
          ? arred(gastoDoTipo / resultados)
          : null,
      vendas: comCompras.length
        ? comCompras.reduce((t, a) => t + (a.compras ?? 0), 0)
        : null,
      ...(moedas.length === 1 ? { moeda: moedas[0] } : {}),
    },
    avisos,
  };
};

// Campos que a Meta preencheu (para não deixar a leitura apagar o que a
// pessoa digitou nos outros, e para o modal saber o que é automático).
export type CamposAutomaticos = { pago: string[]; instagram: string[] };
export const semAutomaticos = (): CamposAutomaticos => ({
  pago: [],
  instagram: [],
});

const CAMPOS_PAGO = [
  "tipo",
  "resultados",
  "ctr",
  "custoPorResultado",
  "vendas",
  "moeda",
] as const;
const CAMPOS_ORGANICO = [
  "visualizacoes",
  "curtidas",
  "comentarios",
  "compartilhamentos",
  "salvamentos",
  "seguidores",
] as const;

const resultadoBase = (atual: unknown): Resultado =>
  lerResultado(atual) ?? {
    ...resultadoVazio(),
    // Sem avaliação da pessoa ainda: não dizer que "deu resultado".
    avaliacao: "neutro" as const,
  };

// Escreve os números da Meta no resultado da versão, CAMPO A CAMPO: só o
// que a Meta informou (não nulo) substitui. O resto — o que a pessoa
// digitou, avaliação, anotação, visual e TikTok — fica.
export const comNumerosAutomaticos = (
  atual: unknown,
  novos: { pago?: ResultadoPago; instagram?: ResultadoOrganico },
  antes: CamposAutomaticos = semAutomaticos(),
): { resultado: Resultado; automaticos: CamposAutomaticos } => {
  const base = resultadoBase(atual);
  const pago: Record<string, unknown> = { ...base.pago };
  const instagram: Record<string, unknown> = { ...base.organico.instagram };
  const automaticos: CamposAutomaticos = {
    pago: [...antes.pago],
    instagram: [...antes.instagram],
  };
  if (novos.pago) {
    for (const k of CAMPOS_PAGO) {
      const v = novos.pago[k];
      if (v === null || v === undefined) continue;
      pago[k] = v;
      if (!automaticos.pago.includes(k)) automaticos.pago.push(k);
    }
  }
  if (novos.instagram) {
    for (const k of CAMPOS_ORGANICO) {
      const v = novos.instagram[k];
      if (v === null || v === undefined) continue;
      instagram[k] = v;
      if (!automaticos.instagram.includes(k)) automaticos.instagram.push(k);
    }
  }
  return {
    resultado: {
      ...base,
      pago: pago as ResultadoPago,
      organico: { ...base.organico, instagram: instagram as ResultadoOrganico },
      registradoEm: base.registradoEm || Date.now(),
    },
    automaticos,
  };
};

// A pessoa salvou o resultado à mão numa versão ligada: os campos que vêm
// da Meta continuam com o valor da Meta (o do banco), o resto é da pessoa.
export const preservarAutomaticos = (
  daPessoa: Resultado,
  doBanco: unknown,
  automaticos: CamposAutomaticos,
): Resultado => {
  const banco = lerResultado(doBanco);
  if (!banco) return daPessoa;
  const pago: Record<string, unknown> = { ...daPessoa.pago };
  const instagram: Record<string, unknown> = { ...daPessoa.organico.instagram };
  for (const k of automaticos.pago) {
    pago[k] = (banco.pago as Record<string, unknown>)[k];
  }
  for (const k of automaticos.instagram) {
    instagram[k] = (banco.organico.instagram as Record<string, unknown>)[k];
  }
  return {
    ...daPessoa,
    pago: pago as ResultadoPago,
    organico: {
      ...daPessoa.organico,
      instagram: instagram as ResultadoOrganico,
    },
  };
};

// Ligação trocada ou desfeita: os números que vieram da fonte antiga saem
// (sem eles, pareceriam digitados pela pessoa).
export const semNumerosDe = (
  atual: unknown,
  automaticos: CamposAutomaticos,
  fontes: { pago: boolean; instagram: boolean },
): unknown => {
  const r = lerResultado(atual);
  if (!r) return atual;
  const pago: Record<string, unknown> = { ...r.pago };
  const instagram: Record<string, unknown> = { ...r.organico.instagram };
  if (fontes.pago) {
    for (const k of automaticos.pago) {
      if (k === "tipo") continue;
      pago[k] = k === "moeda" ? undefined : null;
    }
  }
  if (fontes.instagram) {
    for (const k of automaticos.instagram) instagram[k] = null;
  }
  return {
    ...r,
    pago,
    organico: { ...r.organico, instagram },
  };
};
