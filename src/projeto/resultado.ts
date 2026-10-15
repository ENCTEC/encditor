import { z } from "zod";

// Resultado de um vídeo exportado. É o que a IA usa para aprender o que
// funciona com cada cliente (números pesam mais que opinião).
// - Pago (Meta Ads): só o que importa — cliques ou conversas, CTR, custo
//   por clique/conversa e vendas.
// - Orgânico: TikTok e Instagram, separados.

const numero = z.number().nullable();

export const pagoSchema = z.object({
  // O que a campanha otimiza: conversas (WhatsApp/Direct) ou cliques.
  tipo: z.enum(["conversas", "cliques"]),
  resultados: numero,
  ctr: numero, // %
  custoPorResultado: numero, // R$ por conversa/clique
  vendas: numero,
});

export const organicoRedeSchema = z.object({
  visualizacoes: numero,
  curtidas: numero,
  comentarios: numero,
  compartilhamentos: numero,
  salvamentos: numero,
  // Seguidores ganhos com o vídeo.
  seguidores: numero,
});

export const REDES = { tiktok: "TikTok", instagram: "Instagram" } as const;
export type Rede = keyof typeof REDES;

const pagoVazio = (): z.infer<typeof pagoSchema> => ({
  tipo: "conversas",
  resultados: null,
  ctr: null,
  custoPorResultado: null,
  vendas: null,
});

export const organicoVazio = (): z.infer<typeof organicoRedeSchema> => ({
  visualizacoes: null,
  curtidas: null,
  comentarios: null,
  compartilhamentos: null,
  salvamentos: null,
  seguidores: null,
});

export const resultadoSchema = z.object({
  avaliacao: z.enum(["bom", "ruim", "neutro"]),
  pago: pagoSchema,
  organico: z.object({
    tiktok: organicoRedeSchema,
    instagram: organicoRedeSchema,
  }),
  nota: z.string().max(2000),
  // O que ficou bom ou ruim no VISUAL dos clipes ("ângulo ruim da modelo",
  // "a loja apareceu pouco"). Pesa menos que os números, mas a IA condensa
  // essas opiniões em aprendizados para os próximos roteiros.
  opiniaoVisual: z.string().max(3000),
  registradoEm: z.number(),
});

export type Resultado = z.infer<typeof resultadoSchema>;
export type ResultadoPago = Resultado["pago"];
export type ResultadoOrganico = z.infer<typeof organicoRedeSchema>;

export const resultadoVazio = (): Resultado => ({
  avaliacao: "bom",
  pago: pagoVazio(),
  organico: { tiktok: organicoVazio(), instagram: organicoVazio() },
  nota: "",
  opiniaoVisual: "",
  registradoEm: 0,
});

// Lê um resultado salvo, inclusive no formato antigo (investimento, CTR,
// CPA e ROAS): o CTR e o CPA viram CTR e custo por resultado.
export const lerResultado = (bruto: unknown): Resultado | null => {
  if (!bruto || typeof bruto !== "object") return null;
  const atual = resultadoSchema.safeParse(bruto);
  if (atual.success) return atual.data;
  const b = bruto as Record<string, unknown>;
  const antigas = (b.metricas ?? {}) as Record<string, number | null>;
  const vazio = resultadoVazio();
  const avaliacao = z
    .enum(["bom", "ruim", "neutro"])
    .catch("neutro")
    .parse(b.avaliacao);
  return {
    ...vazio,
    avaliacao,
    pago: {
      ...vazio.pago,
      ...pagoSchema
        .partial()
        .catch({})
        .parse(b.pago ?? {}),
      ...(b.pago
        ? {}
        : {
            ctr: antigas.ctr ?? null,
            custoPorResultado: antigas.cpa ?? null,
          }),
    },
    organico: {
      tiktok: {
        ...vazio.organico.tiktok,
        ...organicoRedeSchema
          .partial()
          .catch({})
          .parse(
            (b.organico as Record<string, unknown> | undefined)?.tiktok ?? {},
          ),
      },
      instagram: {
        ...vazio.organico.instagram,
        ...organicoRedeSchema
          .partial()
          .catch({})
          .parse(
            (b.organico as Record<string, unknown> | undefined)?.instagram ??
              {},
          ),
      },
    },
    nota: typeof b.nota === "string" ? b.nota : "",
    opiniaoVisual: typeof b.opiniaoVisual === "string" ? b.opiniaoVisual : "",
    registradoEm: typeof b.registradoEm === "number" ? b.registradoEm : 0,
  };
};

export const ROTULO_AVALIACAO: Record<Resultado["avaliacao"], string> = {
  bom: "✓ Deu resultado",
  ruim: "✗ Não deu resultado",
  neutro: "~ Neutro",
};

// ---------- Resumos em texto ----------

const br = (n: number, casas = 0) =>
  n.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });

const compacto = (n: number) =>
  n >= 1_000_000
    ? `${br(n / 1_000_000, 1)} mi`
    : n >= 10_000
      ? `${br(n / 1000, 0)} mil`
      : br(n);

export const temPago = (p: ResultadoPago) =>
  [p.resultados, p.ctr, p.custoPorResultado, p.vendas].some((v) => v !== null);

export const temOrganico = (o: ResultadoOrganico) =>
  Object.values(o).some((v) => v !== null);

export const resumoPago = (p: ResultadoPago) => {
  const singular = p.tipo === "conversas" ? "conversa" : "clique";
  return [
    p.resultados !== null && `${br(p.resultados)} ${p.tipo}`,
    p.ctr !== null && `CTR ${br(p.ctr, 2)}%`,
    p.custoPorResultado !== null &&
      `R$ ${br(p.custoPorResultado, 2)} por ${singular}`,
    p.vendas !== null && `${br(p.vendas)} venda${p.vendas === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" · ");
};

export const resumoOrganico = (o: ResultadoOrganico) =>
  [
    o.visualizacoes !== null && `${compacto(o.visualizacoes)} visualizações`,
    o.curtidas !== null && `${compacto(o.curtidas)} curtidas`,
    o.comentarios !== null && `${compacto(o.comentarios)} comentários`,
    o.compartilhamentos !== null &&
      `${compacto(o.compartilhamentos)} compartilhamentos`,
    o.salvamentos !== null && `${compacto(o.salvamentos)} salvamentos`,
    o.seguidores !== null && `+${compacto(o.seguidores)} seguidores`,
  ]
    .filter(Boolean)
    .join(" · ");

// Tudo numa linha (para listas e para a IA).
export const resumoDoResultado = (r: Resultado) =>
  [
    temPago(r.pago) && `Pago (Meta Ads): ${resumoPago(r.pago)}`,
    ...(Object.keys(REDES) as Rede[]).map(
      (rede) =>
        temOrganico(r.organico[rede]) &&
        `${REDES[rede]}: ${resumoOrganico(r.organico[rede])}`,
    ),
  ]
    .filter(Boolean)
    .join(" | ") || "sem métricas";
