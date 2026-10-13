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
      className="fixed bottom-4 right-4 z-50 flex max-w-md items-start gap-3 border-2 border-red-800 bg-red-950 px-4 py-3 font-mono text-xs text-red-100 shadow-[4px_4px_0_var(--color-spray)]"
    >
      <span>{erro}</span>
      <button
        onClick={limparErro}
        className="text-red-300 hover:text-papel"
        aria-label="Fechar"
      >
        ✕
      </button>
    </div>
  );
};
