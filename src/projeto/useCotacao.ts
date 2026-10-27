"use client";

import { useEffect, useState } from "react";
import { CotacaoNaTela } from "./dinheiro";

// O dólar do dia com o IOF, para as telas mostrarem custos em real. Uma
// leitura por aba do navegador (o servidor guarda por 6 h).
let lida: Promise<CotacaoNaTela | null> | null = null;

export const useCotacao = () => {
  const [cotacao, setCotacao] = useState<CotacaoNaTela | null>(null);
  useEffect(() => {
    lida ??= fetch("/api/cotacao", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { cotacao: CotacaoNaTela | null }) => d.cotacao)
      .catch(() => {
        lida = null;
        return null;
      });
    let vivo = true;
    void lida.then((c) => {
      if (vivo) setCotacao(c);
    });
    return () => {
      vivo = false;
    };
  }, []);
  return cotacao;
};
