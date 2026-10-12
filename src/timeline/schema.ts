import { z } from "zod";

// Tipos de transição de entrada de um clipe (em relação ao clipe anterior).
export const tipoTransicaoSchema = z.enum(["corte", "fade", "slide"]);

export const clipeSchema = z.object({
  // URL pública do vídeo (Supabase Storage no futuro).
  url: z.string(),
  // Trecho do vídeo de origem a ser usado, em segundos.
  inicio: z.number().min(0),
  fim: z.number().min(0),
  // Como este clipe entra: corte seco, fade ou slide.
  transicao: tipoTransicaoSchema,
});

export const legendaSchema = z.object({
  texto: z.string(),
  // Tempo na timeline FINAL (já editada), em segundos.
  inicio: z.number().min(0),
  fim: z.number().min(0),
});

export const timelineSchema = z.object({
  fps: z.number().int().positive(),
  largura: z.number().int().positive(),
  altura: z.number().int().positive(),
  // Duração das transições fade/slide, em segundos.
  duracaoTransicao: z.number().min(0),
  clipes: z.array(clipeSchema).min(1),
  legendas: z.array(legendaSchema),
});

export type TipoTransicao = z.infer<typeof tipoTransicaoSchema>;
export type Clipe = z.infer<typeof clipeSchema>;
export type Legenda = z.infer<typeof legendaSchema>;
export type Timeline = z.infer<typeof timelineSchema>;
