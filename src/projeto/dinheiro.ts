// Dinheiro nas telas. Os custos da IA são cobrados em dólar; o encEditor
// mostra em REAL, com o dólar do dia e o IOF do cartão (src/servidor/
// cotacao.ts). Sem cotação (sem internet), cai para o dólar.

export type CotacaoNaTela = { dolar: number; comIof: number; iof: number; fonte: string; quando: number };

// Valor em dólar no jeito brasileiro: US$ 0,41 (centavos: US$ 0,004).
export const dolares = (valor: number) =>
  `US$ ${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: valor > 0 && valor < 0.01 ? 3 : 2,
  })}`;

// Valor em dólar mostrado em real (com o IOF): R$ 2,27.
export const reais = (valorEmDolar: number, cotacao: CotacaoNaTela | null) => {
  if (!cotacao) return dolares(valorEmDolar);
  const valor = valorEmDolar * cotacao.comIof;
  return `R$ ${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// "Dólar R$ 5,34 + IOF 3,5% = R$ 5,53" (para explicar a conta).
export const explicarCotacao = (c: CotacaoNaTela) =>
  `dólar de hoje R$ ${c.dolar.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${c.fonte}) + IOF ${(c.iof * 100).toLocaleString("pt-BR")}% = R$ ${c.comIof.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} por US$ 1`;
