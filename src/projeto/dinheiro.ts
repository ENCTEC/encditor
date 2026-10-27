// Valor em dólar no jeito brasileiro: US$ 0,41 (centavos: US$ 0,004).
export const dolares = (valor: number) =>
  `US$ ${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: valor > 0 && valor < 0.01 ? 3 : 2,
  })}`;
