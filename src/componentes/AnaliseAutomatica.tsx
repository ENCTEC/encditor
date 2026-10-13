"use client";

import { useEffect } from "react";
import {
  analiseEmAndamento,
  analisarMidia,
  podeAnalisar,
} from "@/projeto/midia-cliente";
import { useProjeto } from "@/projeto/ProjetoProvider";
import { Midia } from "@/projeto/tipos";

// Sem interface: analisa (fala + conteúdo visual) os arquivos que ainda
// não foram analisados, inclusive os que ficaram pela metade quando a
// página foi recarregada.
export const iniciarAnalise = (
  midia: Midia,
  atualizarAnalise: ReturnType<typeof useProjeto>["atualizarAnalise"],
) => {
  atualizarAnalise(midia.id, {
    status: "analisando",
    erro: null,
    transcricao: null,
    visual: null,
  });
  void analisarMidia(midia).then((analise) =>
    atualizarAnalise(midia.id, analise),
  );
};

export const AnaliseAutomatica: React.FC = () => {
  const { projeto, carregado, atualizarAnalise } = useProjeto();

  useEffect(() => {
    if (!carregado) return;
    for (const midia of projeto.biblioteca) {
      const pendente =
        !midia.analise ||
        (midia.analise.status === "analisando" &&
          !analiseEmAndamento(midia.id));
      if (podeAnalisar(midia) && pendente) {
        iniciarAnalise(midia, atualizarAnalise);
      }
    }
  }, [projeto.biblioteca, carregado, atualizarAnalise]);

  return null;
};
