"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatarTempo } from "@/componentes/Biblioteca";
import { ModalResultado } from "@/componentes/clientes/ModalResultado";
import { abrirProjeto } from "@/projeto/ProjetoProvider";
import { Resultado, ROTULO_AVALIACAO } from "@/projeto/resultado";
import { Midia } from "@/projeto/tipos";

// Página de um cliente: os vídeos (projetos) dele, com o resultado de
// cada um no tráfego, e o banco de mídia compartilhado.

type Projeto = {
  id: string;
  nome: string;
  atualizadoEm: number;
  resultado: Resultado | null;
  cenas: number;
};

type Dados = {
  cliente: { id: string; nome: string; projetos: number; midias: number };
  projetos: Projeto[];
};

const CORES: Record<Resultado["avaliacao"], string> = {
  bom: "bg-verde text-papel",
  ruim: "bg-spray text-papel",
  neutro: "bg-tinta text-papel",
};

const data = (ms: number) =>
  new Date(ms).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const metricasEmTexto = (r: Resultado) =>
  [
    r.metricas.investimento !== null && `R$ ${r.metricas.investimento}`,
    r.metricas.ctr !== null && `CTR ${r.metricas.ctr}%`,
    r.metricas.cpa !== null && `CPA R$ ${r.metricas.cpa}`,
    r.metricas.roas !== null && `ROAS ${r.metricas.roas}`,
  ]
    .filter(Boolean)
    .join(" · ");

export default function PaginaCliente() {
  const { id } = useParams<{ id: string }>();
  const [dados, setDados] = useState<Dados | null>(null);
  const [banco, setBanco] = useState<Midia[]>([]);
  const [nomeNovo, setNomeNovo] = useState("");
  const [resultadoDe, setResultadoDe] = useState<Projeto | null>(null);
  const [naoAchou, setNaoAchou] = useState(false);

  const carregar = useCallback(async () => {
    const [r1, r2] = await Promise.all([
      fetch(`/api/clientes/${id}`, { cache: "no-store" }),
      fetch(`/api/clientes/${id}/banco`, { cache: "no-store" }),
    ]);
    if (!r1.ok) {
      setNaoAchou(true);
      return;
    }
    setDados((await r1.json()) as Dados);
    setBanco(((await r2.json()) as { midias: Midia[] }).midias);
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const criarProjeto = async () => {
    const nome = nomeNovo.trim();
    if (!nome) return;
    const resposta = await fetch(`/api/clientes/${id}/projetos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome }),
    });
    const r = (await resposta.json()) as { id?: string };
    if (r.id) abrirProjeto(r.id);
  };

  const renomearCliente = async () => {
    const nome = prompt("Novo nome do cliente:", dados?.cliente.nome)?.trim();
    if (!nome) return;
    await fetch(`/api/clientes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome }),
    });
    await carregar();
  };

  const salvarResultado = async (
    projeto: Projeto,
    resultado: Resultado | null,
  ) => {
    await fetch(`/api/projeto/resultado?id=${projeto.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultado }),
    });
    setResultadoDe(null);
    await carregar();
  };

  if (naoAchou) {
    return (
      <div className="p-6">
        <p>Cliente não encontrado.</p>
        <Link href="/clientes" className="underline">
          Voltar para Clientes
        </Link>
      </div>
    );
  }
  if (!dados) return <p className="p-6 text-sm text-zinc-500">Carregando…</p>;

  const avaliados = dados.projetos.filter((p) => p.resultado);
  const bons = avaliados.filter((p) => p.resultado?.avaliacao === "bom").length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-10 p-6">
        <header>
          <Link
            href="/clientes"
            className="font-mono text-[11px] tracking-wider text-zinc-500 uppercase hover:text-spray"
          >
            ‹ Clientes
          </Link>
          <div className="mt-1 flex flex-wrap items-baseline gap-4">
            <h1 className="font-display text-6xl leading-none tracking-tight uppercase">
              {dados.cliente.nome}
            </h1>
            <button
              onClick={() => void renomearCliente()}
              className="font-mono text-[11px] tracking-wider text-zinc-500 uppercase hover:text-spray"
            >
              renomear
            </button>
          </div>
          <p className="mt-2 font-mono text-xs tracking-wider text-zinc-500 uppercase">
            {dados.projetos.length} vídeo(s) · {banco.length} arquivo(s) no
            banco · {avaliados.length} com resultado ({bons} deram resultado)
          </p>
        </header>

        <section>
          <h2 className="rotulo-zine mb-3">Vídeos</h2>
          <div className="mb-5 flex max-w-xl gap-2">
            <input
              value={nomeNovo}
              onChange={(e) => setNomeNovo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void criarProjeto()}
              placeholder="Nome do novo vídeo (ex.: Promo Dia das Mães #1)"
              className="min-w-0 flex-1 border-2 border-tinta bg-zinc-950 px-3 py-2 text-sm outline-none focus:shadow-[3px_3px_0_var(--color-spray)]"
            />
            <button
              onClick={() => void criarProjeto()}
              disabled={!nomeNovo.trim()}
              className="botao-spray"
            >
              Novo vídeo
            </button>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {dados.projetos.map((p) => (
              <article key={p.id} className="cartao-zine flex flex-col p-4">
                <div className="flex items-start gap-2">
                  <h3 className="min-w-0 flex-1 truncate font-display text-2xl leading-none tracking-wide uppercase">
                    {p.nome}
                  </h3>
                  {p.resultado ? (
                    <span
                      className={`shrink-0 px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase ${CORES[p.resultado.avaliacao]}`}
                    >
                      {ROTULO_AVALIACAO[p.resultado.avaliacao]}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 font-mono text-[11px] text-zinc-500">
                  {p.cenas} cena(s) · editado {data(p.atualizadoEm)}
                </p>
                {p.resultado ? (
                  <p className="mt-2 text-xs">
                    {metricasEmTexto(p.resultado)}
                    {p.resultado.nota ? (
                      <span className="block text-zinc-500 italic">
                        “{p.resultado.nota}”
                      </span>
                    ) : null}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-zinc-500">
                    Sem resultado registrado.
                  </p>
                )}
                <div className="mt-auto flex gap-2 pt-4">
                  <button
                    onClick={() => abrirProjeto(p.id)}
                    className="botao-spray flex-1 !py-1.5 !text-sm"
                  >
                    Abrir
                  </button>
                  <button
                    onClick={() => setResultadoDe(p)}
                    className="flex-1 border-2 border-tinta px-2 py-1.5 font-mono text-[11px] tracking-wider uppercase hover:bg-tinta hover:text-papel"
                  >
                    {p.resultado ? "Editar resultado" : "Registrar resultado"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h2 className="rotulo-zine mb-1">Banco de mídia ({banco.length})</h2>
          <p className="mb-3 text-sm text-zinc-500">
            Compartilhado por todos os vídeos deste cliente. Para enviar
            arquivos, abra qualquer vídeo dele e use a aba Arquivos.
          </p>
          {banco.length ? (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-zinc-500">
                <tr className="border-b-2 border-tinta">
                  <th className="py-2 font-medium">Arquivo</th>
                  <th className="py-2 font-medium">Tipo</th>
                  <th className="py-2 font-medium">Duração</th>
                  <th className="py-2 font-medium">O que a IA sabe</th>
                </tr>
              </thead>
              <tbody>
                {banco.map((m) => (
                  <tr key={m.id} className="border-b border-zinc-800 align-top">
                    <td className="py-2 pr-3">
                      <div className="font-mono text-xs text-spray">
                        @{m.apelido}
                      </div>
                      <div
                        className="max-w-56 truncate text-xs text-zinc-500"
                        title={m.nomeArquivo}
                      >
                        {m.nomeArquivo}
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-zinc-400">{m.nome}</td>
                    <td className="py-2 pr-3 tabular-nums text-zinc-400">
                      {m.duracao !== null ? formatarTempo(m.duracao) : "—"}
                    </td>
                    <td className="py-2 text-xs">
                      {m.usarIA === false
                        ? "❄ arquivo frio (sem análise)"
                        : m.analise?.status === "pronta"
                          ? [
                              m.analise.visual?.resumo,
                              m.analise.transcricao
                                ? `Fala: “${m.analise.transcricao.texto.slice(0, 120)}${m.analise.transcricao.texto.length > 120 ? "…" : ""}”`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" ")
                          : (m.analise?.status ?? "não analisado")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-zinc-500">Nenhum arquivo ainda.</p>
          )}
        </section>
      </div>

      {resultadoDe ? (
        <ModalResultado
          nomeProjeto={resultadoDe.nome}
          atual={resultadoDe.resultado}
          aoSalvar={(r) => void salvarResultado(resultadoDe, r)}
          aoFechar={() => setResultadoDe(null)}
        />
      ) : null}
    </div>
  );
}
