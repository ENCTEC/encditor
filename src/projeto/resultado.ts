import { z } from "zod";

// Resultado de um vídeo no tráfego pago. É o que a IA vai usar para
// aprender o que funciona com cada cliente.
export const resultadoSchema = z.object({
  avaliacao: z.enum(["bom", "ruim", "neutro"]),
  metricas: z.object({
    investimento: z.number().nullable(),
    ctr: z.number().nullable(),
    cpa: z.number().nullable(),
    roas: z.number().nullable(),
  }),
  nota: z.string().max(2000),
  // O que ficou bom ou ruim no VISUAL dos clipes ("ângulo ruim da modelo",
  // "a loja apareceu pouco"). Pesa menos que os números, mas a IA condensa
  // essas opiniões em aprendizados para os próximos roteiros.
  opiniaoVisual: z.string().max(3000).default(""),
  registradoEm: z.number(),
});

export type Resultado = z.infer<typeof resultadoSchema>;

export const ROTULO_AVALIACAO: Record<Resultado["avaliacao"], string> = {
  bom: "✓ Deu resultado",
  ruim: "✗ Não deu resultado",
  neutro: "~ Neutro",
};
