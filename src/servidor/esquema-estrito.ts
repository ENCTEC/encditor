import { z } from "zod";

// Converte um esquema zod para o "JSON Schema estrito" das respostas
// estruturadas da OpenAI: todo objeto com additionalProperties false e
// todas as chaves em "required" ("opcional" = aceitar null). Limites
// numéricos e de texto saem do esquema (são conferidos no código depois).

const CHAVES_FORA = new Set([
  "$schema",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "pattern",
  "format",
  "default",
]);

const limpar = (no: unknown): unknown => {
  if (Array.isArray(no)) return no.map(limpar);
  if (!no || typeof no !== "object") return no;
  const saida: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(no)) {
    if (CHAVES_FORA.has(chave)) continue;
    saida[chave] = limpar(valor);
  }
  if (saida.type === "object" && saida.properties) {
    saida.additionalProperties = false;
    saida.required = Object.keys(saida.properties as object);
  }
  return saida;
};

export const esquemaEstrito = (esquema: z.ZodType) =>
  limpar(z.toJSONSchema(esquema, { io: "output" })) as Record<string, unknown>;
