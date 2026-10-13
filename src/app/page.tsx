"use client";

import { Biblioteca } from "@/componentes/Biblioteca";
import { Chat } from "@/componentes/criar/Chat";
import { PreviewPlayer } from "@/componentes/PreviewPlayer";
import { useProjeto } from "@/projeto/ProjetoProvider";

// Aba "Criar" (principal): chat à esquerda; preview e biblioteca à direita.
export default function PaginaCriar() {
  const { projeto, carregado } = useProjeto();

  if (!carregado) return null;

  return (
    <div className="flex h-full">
      <section className="min-w-0 flex-1 border-r border-zinc-800">
        <Chat />
      </section>
      <aside className="flex w-[44%] max-w-2xl flex-col gap-4 overflow-y-auto p-4">
        <PreviewPlayer timeline={projeto.timeline} className="aspect-video" />
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Biblioteca
          </h2>
          <Biblioteca biblioteca={projeto.biblioteca} />
        </div>
      </aside>
    </div>
  );
}
