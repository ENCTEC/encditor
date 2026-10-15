"use client";

import { Aprendizados } from "@/componentes/planejar/Aprendizados";
import { Briefing } from "@/componentes/planejar/Briefing";
import { ConversaPlano } from "@/componentes/planejar/ConversaPlano";
import { Elementos } from "@/componentes/planejar/Elementos";
import { MapaDoPlano } from "@/componentes/planejar/MapaDoPlano";
import { useProjeto } from "@/projeto/ProjetoProvider";
import { usePlano } from "@/plano/usePlano";

// Aba "Planejar": antes de gerar os takes no Higgsfield. O usuário passa o
// roteiro (ou nada), exemplos, cenas obrigatórias e elementos; a IA cria o
// plano (copy, takes com prompt, reaproveitamento do banco, edição) usando
// os resultados do cliente. Depois, cada take enviado é ligado ao plano e,
// quando tudo chega, a edição é montada sozinha.
export default function PaginaPlanejar() {
  const { carregado, meta } = useProjeto();
  const uso = usePlano();

  if (!carregado || !meta) return null;
  if (!uso.plano) {
    return (
      <p className="p-6 font-mono text-xs text-zinc-500 uppercase">
        Carregando o plano…
      </p>
    );
  }

  return (
    <div className="flex h-full">
      <aside className="w-[380px] shrink-0 space-y-6 overflow-y-auto border-r-[3px] border-tinta p-4">
        <div>
          <h1 className="font-display text-5xl leading-none tracking-tight uppercase">
            Planejar
          </h1>
          <p className="mt-1 font-mono text-[11px] tracking-wider text-zinc-500 uppercase">
            📁 {meta.cliente.nome} › {meta.nome}
            {uso.salvando ? " · salvando…" : ""}
          </p>
        </div>
        <Briefing uso={uso} />
        <Elementos uso={uso} />
        <Aprendizados clienteId={uso.clienteId} />
      </aside>

      <section className="w-[400px] shrink-0 border-r-[3px] border-tinta">
        <ConversaPlano uso={uso} />
      </section>

      <main className="min-w-0 flex-1 overflow-y-auto p-4">
        <MapaDoPlano uso={uso} />
      </main>
    </div>
  );
}
