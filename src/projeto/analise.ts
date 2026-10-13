import { z } from "zod";

// Resultado da análise de um arquivo enviado: o que é falado (com o tempo
// de cada palavra, para legendar e achar frases) e o que aparece na tela.
// Todos os tempos são em segundos DENTRO DO ARQUIVO de origem.

const intervalo = { de: z.number(), ate: z.number() };

export const transcricaoSchema = z.object({
  idioma: z.string().nullable(),
  texto: z.string(),
  segmentos: z.array(z.object({ ...intervalo, texto: z.string() })),
  palavras: z.array(z.object({ ...intervalo, palavra: z.string() })),
});

export const visualSchema = z.object({
  resumo: z.string(),
  momentos: z.array(
    z.object({
      ...intervalo,
      descricao: z.string(),
      // Texto escrito que aparece na imagem ("" se não houver).
      texto_na_tela: z.string(),
    }),
  ),
});

export const analiseSchema = z.object({
  status: z.enum(["analisando", "pronta", "erro"]),
  erro: z.string().nullable(),
  // null = arquivo sem fala (ou sem áudio).
  transcricao: transcricaoSchema.nullable(),
  // null = não se aplica (áudio) ou não analisado.
  visual: visualSchema.nullable(),
});

export type Transcricao = z.infer<typeof transcricaoSchema>;
export type Visual = z.infer<typeof visualSchema>;
export type Analise = z.infer<typeof analiseSchema>;
