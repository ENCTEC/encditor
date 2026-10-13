"use client";

import { useEffect } from "react";
import { useProjeto } from "@/projeto/ProjetoProvider";

// Mostra no canto da tela o último erro (ex.: edição inválida), e some
// sozinho depois de alguns segundos.
export const AvisoErro: React.FC = () => {
  const { erro, limparErro } = useProjeto();

  useEffect(() => {
    if (!erro) return;
    const timer = setTimeout(limparErro, 6000);
    return () => clearTimeout(timer);
  }, [erro, limparErro]);

  if (!erro) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 z-50 flex max-w-md items-start gap-3 rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-100 shadow-xl"
    >
      <span>{erro}</span>
      <button
        onClick={limparErro}
        className="text-red-300 hover:text-white"
        aria-label="Fechar"
      >
        ✕
      </button>
    </div>
  );
};
