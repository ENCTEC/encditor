"use client";

import { useEffect, useState } from "react";
import type { Aprendizados as Dados } from "@/servidor/planejador";

// O que o ENCeditor aprendeu com os resultados (números) e as opiniões
// sobre o visual dos vídeos já exportados deste cliente.

export const Aprendizados: React.FC<{ clienteId: string | null }> = ({
  clienteId,
}) => {
  const [dados, setDados] = useState<Dados | null | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!clienteId) return;
    let cancelado = false;
    void fetch(`/api/clientes/${clienteId}/aprendizados`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { aprendizados?: Dados | null; erro?: string }) => {
        if (cancelado) return;
        if (d.erro) setErro(d.erro);
        setDados(d.aprendizados ?? null);
      })
      .catch(() => !cancelado && setDados(null));
    return () => {
      cancelado = true;
    };
  }, [clienteId]);

  const lista = (titulo: string, itens: string[], cor: string) =>
    itens.length ? (
      <div>
        <p className={`font-mono text-[10px] tracking-wider uppercase ${cor}`}>
          {titulo}
        </p>
        <ul className="list-disc space-y-0.5 pl-4 text-xs">
          {itens.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <section className="space-y-2">
      <h3 className="rotulo-zine">O que já aprendi com este cliente</h3>
      {dados === undefined ? (
        <p className="animate-pulse text-xs text-zinc-500">
          Lendo os resultados…
        </p>
      ) : dados === null ? (
        <p className="text-xs text-zinc-500">
          {erro ??
            "Ainda não há resultados. Exporte vídeos e registre o resultado (números + opinião sobre o visual) na página do cliente: o planejador usa isso nos próximos roteiros."}
        </p>
      ) : (
        <div className="space-y-2 border-2 border-tinta p-2">
          <p className="text-xs">{dados.resumo}</p>
          {lista("Funciona", dados.o_que_funciona, "text-verde")}
          {lista("Não funciona", dados.o_que_nao_funciona, "text-spray")}
          {lista(
            "Problemas visuais a evitar nos clipes",
            dados.problemas_visuais_a_evitar,
            "text-spray",
          )}
        </div>
      )}
    </section>
  );
};
