"use client";

import { useCallback, useEffect, useState } from "react";
import { ModalResultado } from "@/componentes/clientes/ModalResultado";
import { useProjeto } from "@/projeto/ProjetoProvider";
import {
  lerResultado,
  REDES,
  Rede,
  Resultado,
  ROTULO_AVALIACAO,
  temOrganico,
  temPago,
} from "@/projeto/resultado";

// Aba "Resultados": os vídeos exportados (versões) com o resultado de
// cada um, separado em PAGO (Meta Ads) e ORGÂNICO (TikTok e Instagram).
// Por padrão mostra só o projeto aberto; dá para ver o cliente inteiro.

type Exportacao = {
  id: string;
  projetoId: string;
  nome: string;
  arquivo: string;
  duracao: number;
  criadoEm: number;
  resultado: Resultado | null;
};

const CORES: Record<Resultado["avaliacao"], string> = {
  bom: "bg-verde text-papel",
  ruim: "bg-spray text-papel",
  neutro: "bg-tinta text-papel",
};

const br = (n: number, casas = 0) =>
  n.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });

const Numero: React.FC<{ rotulo: string; valor: string | null }> = ({
  rotulo,
  valor,
}) => (
  <div className="border-2 border-tinta px-2 py-1.5">
    <p className="font-mono text-[10px] tracking-wider text-zinc-500 uppercase">
      {rotulo}
    </p>
    <p
      className={`font-display text-2xl leading-none ${valor === null ? "text-zinc-600" : ""}`}
    >
      {valor ?? "—"}
    </p>
  </div>
);

const Bloco: React.FC<{
  titulo: string;
  vazio: boolean;
  children: React.ReactNode;
}> = ({ titulo, vazio, children }) => (
  <div className="space-y-1.5">
    <p className="rotulo-zine">{titulo}</p>
    {vazio ? (
      <p className="text-xs text-zinc-500">Sem números ainda.</p>
    ) : (
      <div className="grid grid-cols-2 gap-1.5">{children}</div>
    )}
  </div>
);

const n = (v: number | null, casas = 0, antes = "", depois = "") =>
  v === null ? null : `${antes}${br(v, casas)}${depois}`;

export default function PaginaResultados() {
  const { carregado, meta } = useProjeto();
  const [exportacoes, setExportacoes] = useState<Exportacao[] | null>(null);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [doCliente, setDoCliente] = useState(false);
  const [editando, setEditando] = useState<Exportacao | null>(null);
  const [assistindo, setAssistindo] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!meta) return;
    const r = await fetch(`/api/clientes/${meta.cliente.id}`, {
      cache: "no-store",
    });
    const d = (await r.json()) as {
      projetos: { id: string; nome: string }[];
      exportacoes: (Exportacao & { resultado: unknown })[];
    };
    setNomes(Object.fromEntries(d.projetos.map((p) => [p.id, p.nome])));
    setExportacoes(
      d.exportacoes.map((e) => ({
        ...e,
        resultado: lerResultado(e.resultado),
      })),
    );
  }, [meta]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (!carregado || !meta) return null;

  const lista = (exportacoes ?? []).filter(
    (e) => doCliente || e.projetoId === meta.id,
  );

  const salvar = async (e: Exportacao, resultado: Resultado | null) => {
    await fetch(`/api/exportacoes/${e.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultado }),
    });
    setEditando(null);
    await carregar();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <header className="flex flex-wrap items-end gap-4">
          <div>
            <h1 className="font-display text-6xl leading-none tracking-tight uppercase">
              Resultados
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Como cada vídeo exportado foi no <b>pago</b> (Meta Ads) e no{" "}
              <b>orgânico</b> (TikTok e Instagram). O planejador usa esses
              números para os próximos roteiros.
            </p>
          </div>
          <div className="ml-auto flex border-2 border-tinta font-mono text-[11px] uppercase">
            {[
              [false, "Este vídeo"],
              [true, `Todo o cliente`],
            ].map(([valor, rotulo]) => (
              <button
                key={String(valor)}
                onClick={() => setDoCliente(valor as boolean)}
                className={`px-3 py-1.5 ${doCliente === valor ? "bg-tinta text-papel" : "hover:bg-zinc-900"}`}
              >
                {rotulo as string}
              </button>
            ))}
          </div>
        </header>

        {exportacoes === null ? (
          <p className="text-sm text-zinc-500">Carregando…</p>
        ) : !lista.length ? (
          <p className="border-2 border-dashed border-zinc-700 p-6 text-center text-sm text-zinc-500">
            {doCliente
              ? "Este cliente ainda não tem vídeos exportados."
              : "Este projeto ainda não tem vídeos exportados. Use o botão “Exportar” no topo; cada exportação vira uma versão aqui."}
          </p>
        ) : (
          lista.map((e) => {
            const r = e.resultado;
            return (
              <article key={e.id} className="cartao-zine space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-2xl leading-none uppercase">
                      {e.nome}
                    </h2>
                    <p className="font-mono text-[11px] tracking-wider text-zinc-500 uppercase">
                      {doCliente ? `${nomes[e.projetoId] ?? "?"} · ` : ""}
                      {new Date(e.criadoEm).toLocaleDateString("pt-BR")} ·{" "}
                      {br(e.duracao, 1)}s
                    </p>
                  </div>
                  {r ? (
                    <span
                      className={`border-2 border-tinta px-2 py-1 text-xs ${CORES[r.avaliacao]}`}
                    >
                      {ROTULO_AVALIACAO[r.avaliacao]}
                    </span>
                  ) : null}
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={() =>
                        setAssistindo(assistindo === e.id ? null : e.id)
                      }
                      className="border-2 border-tinta px-2 py-1 font-mono text-[11px] uppercase hover:bg-tinta hover:text-papel"
                    >
                      {assistindo === e.id ? "fechar" : "▶ assistir"}
                    </button>
                    <a
                      href={`/api/midia/${e.arquivo}?baixar=${encodeURIComponent(`${nomes[e.projetoId] ?? "video"} - ${e.nome}.mp4`)}`}
                      className="border-2 border-tinta px-2 py-1 font-mono text-[11px] uppercase hover:bg-tinta hover:text-papel"
                    >
                      baixar
                    </a>
                    <button
                      onClick={() => setEditando(e)}
                      className="botao-spray !px-3 !py-1 !text-sm"
                    >
                      {r ? "Editar resultado" : "Registrar resultado"}
                    </button>
                  </div>
                </div>

                {assistindo === e.id ? (
                  <video
                    src={`/api/midia/${e.arquivo}`}
                    controls
                    autoPlay
                    className="max-h-96 border-2 border-tinta bg-black"
                  />
                ) : null}

                {r ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-3">
                      <Bloco titulo="Pago · Meta Ads" vazio={!temPago(r.pago)}>
                        <Numero
                          rotulo={
                            r.pago.tipo === "conversas"
                              ? "Conversas"
                              : "Cliques"
                          }
                          valor={n(r.pago.resultados)}
                        />
                        <Numero
                          rotulo="CTR"
                          valor={n(r.pago.ctr, 2, "", "%")}
                        />
                        <Numero
                          rotulo={`Custo/${r.pago.tipo === "conversas" ? "conversa" : "clique"}`}
                          valor={n(r.pago.custoPorResultado, 2, "R$ ")}
                        />
                        <Numero rotulo="Vendas" valor={n(r.pago.vendas)} />
                      </Bloco>
                      {(Object.keys(REDES) as Rede[]).map((rede) => {
                        const o = r.organico[rede];
                        return (
                          <Bloco
                            key={rede}
                            titulo={`Orgânico · ${REDES[rede]}`}
                            vazio={!temOrganico(o)}
                          >
                            <Numero
                              rotulo="Visualizações"
                              valor={n(o.visualizacoes)}
                            />
                            <Numero rotulo="Curtidas" valor={n(o.curtidas)} />
                            <Numero
                              rotulo="Comentários"
                              valor={n(o.comentarios)}
                            />
                            <Numero
                              rotulo="Compartilh."
                              valor={n(o.compartilhamentos)}
                            />
                            <Numero
                              rotulo="Salvamentos"
                              valor={n(o.salvamentos)}
                            />
                            <Numero
                              rotulo="Seguidores"
                              valor={n(o.seguidores, 0, "+")}
                            />
                          </Bloco>
                        );
                      })}
                    </div>
                    {r.nota || r.opiniaoVisual ? (
                      <div className="space-y-1 border-l-4 border-spray pl-3 text-sm">
                        {r.nota ? <p className="italic">“{r.nota}”</p> : null}
                        {r.opiniaoVisual ? (
                          <p className="text-zinc-400">
                            👁 Visual: {r.opiniaoVisual}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-zinc-500">
                    Resultado ainda não registrado.
                  </p>
                )}
              </article>
            );
          })
        )}
      </div>

      {editando ? (
        <ModalResultado
          nomeProjeto={`${nomes[editando.projetoId] ?? ""} › ${editando.nome}`}
          atual={editando.resultado}
          aoSalvar={(r) => void salvar(editando, r)}
          aoFechar={() => setEditando(null)}
        />
      ) : null}
    </div>
  );
}
