import { z } from "zod";

// Elemento do Higgsfield (personagem, produto, lugar) salvo no cliente.
export type Elemento = {
  id: string;
  clienteId: string;
  nome: string;
  descricao: string;
  imagem: string | null;
  criadoEm: number;
};

// Nome = o mesmo usado no @ do Higgsfield (sem espaços).
export const nomeDeElemento = z
  .string()
  .trim()
  .transform((n) => n.replace(/^@+/, ""))
  .pipe(
    z
      .string()
      .min(1, "Dê um nome (o mesmo do @ no Higgsfield).")
      .max(60)
      .regex(
        /^[\p{L}\p{N}_.-]+$/u,
        "Use o nome sem espaços, como no @ do Higgsfield.",
      ),
  );
