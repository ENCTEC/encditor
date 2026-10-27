// O que o Medidor (Medidor.tsx) manda pelo console em cada quadro da
// conferência, e o servidor lê (src/servidor/quadros.ts). Fica num arquivo
// sem React para o servidor poder importar.

export const PREFIXO_CAIXAS = "__CAIXAS__";

// [tipo, x0, y0, x1, y1] em % da tela; tipo "t" = texto, "f" = forma.
export type CaixaMedida = ["t" | "f", number, number, number, number];
export type ItemMedido = { item: string; caixas: CaixaMedida[] };
export type MedidaDoQuadro = { frame: number; itens: ItemMedido[] };
