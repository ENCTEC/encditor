"use client";

import { Biblioteca } from "@/componentes/Biblioteca";
import { PreviewPlayer } from "@/componentes/PreviewPlayer";
import { useProjeto } from "@/projeto/ProjetoProvider";

// Aba "Criar" (principal): o chat fica à esquerda (ele mora no layout, para
// não sumir ao trocar de aba); aqui ficam o preview e a biblioteca.
export default function PaginaCriar() {
  const { projeto, carregado } = useProjeto();

  if (!carregado) return null;

  return (
    <aside className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <PreviewPlayer timeline={projeto.timeline} className="aspect-video" />
      <div>
        <h2 className="rotulo-zine mb-2">Biblioteca</h2>
        <Biblioteca biblioteca={projeto.biblioteca} />
      </div>
    </aside>
  );
}
