"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatarTempo } from "@/componentes/Biblioteca";
import { ModalResultado } from "@/componentes/clientes/ModalResultado";
import { abrirProjeto, esquecerProjetos } from "@/projeto/ProjetoProvider";
import {
  lerResultado,
  Resultado,
  resumoDoResultado,
  ROTULO_AVALIACAO,
} from "@/projeto/resultado";
import { Midia } from "@/projeto/tipos";

// Página de um cliente: CLIENTE → PROJETOS → VÍDEOS EXPORTADOS (versões).
// O resultado no tráfego é registrado em cada vídeo exportado (o MP4 que
// foi para o ar). Embaixo, o banco de mídia compartilhado pelo cliente.

type Projeto = {
  id: string;
  nome: string;
  atualizadoEm: number;
  cenas: number;
};

type Exportacao = {
  id: string;
  projetoId: string;
  nome: string;
  arquivo: string;
  duracao: number;
  criadoEm: number;
  resultado: Resultado | null;
  // Campos que a Meta preenche (versão ligada a post/anúncio).
  metricas?: { automaticos?: { pago: string[]; instagram: string[] } } | null;
};

type Dados = {
  cliente: { id: string; nome: string; projetos: number; midias: number };
  projetos: Projeto[];
  exportacoes: Exportacao[];
};

const CLIENTE_PADRAO = "geral";

const CORES: Record<Resultado["avaliacao"], string> = {
  bom: "bg-verde text-papel",
  ruim: "bg-spray text-papel",
  neutro: "bg-tinta text-papel",
};

const botaoMini =
  "border-2 border-tinta px-2 py-1 font-mono text-[10px] tracking-wider uppercase hover:bg-tinta hover:text-papel";
const botaoApagar =
  "font-mono text-[10px] tracking-wider text-zinc-500 uppercase hover:text-spray";

const data = (ms: number) =>
  new Date(ms).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function PaginaCliente() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [dados, setDados] = useState<Dados | null>(null);
  const [banco, setBanco] = useState<Midia[]>([]);
  const [nomeNovo, setNomeNovo] = useState("");
  const [resultadoDe, setResultadoDe] = useState<Exportacao | null>(null);
  const [assistindo, setAssistindo] = useState<string | null>(null);
  const [naoAchou, setNaoAchou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [r1, r2] = await Promise.all([
      fetch(`/api/clientes/${id}`, { cache: "no-store" }),
      fetch(`/api/clientes/${id}/banco`, { cache: "no-store" }),
    ]);
    if (!r1.ok) {
      setNaoAchou(true);
      return;
    }
    const lidos = (await r1.json()) as Dados;
    // Resultados antigos (investimento/CPA/ROAS) viram o formato novo.
    setDados({
      ...lidos,
      exportacoes: lidos.exportacoes.map((e) => ({
        ...e,
        resultado: lerResultado(e.resultado),
      })),
    });
    setBanco(((await r2.json()) as { midias: Midia[] }).midias);
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Chama a API; se der erro, mostra a mensagem. Depois recarrega a tela.
  const pedir = async (url: string, metodo: string, corpo?: unknown) => {
    setErro(null);
    const resposta = await fetch(url, {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    if (!resposta.ok) {
      const d = (await resposta.json().catch(() => ({}))) as { erro?: string };
      setErro(d.erro ?? "Não deu certo. Tente de novo.");
      return false;
    }
    return true;
  };

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
    await pedir(`/api/clientes/${id}`, "PATCH", { nome });
    await carregar();
  };

  const apagarCliente = async () => {
    if (!dados) return;
    const { nome } = dados.cliente;
    const digitado = prompt(
      `Apagar o cliente "${nome}" com TUDO dentro: ${dados.projetos.length} projeto(s), ` +
        `${dados.exportacoes.length} vídeo(s) exportado(s) e ${banco.length} arquivo(s) do banco de mídia.\n\n` +
        `Isso não pode ser desfeito. Para confirmar, digite o nome do cliente:`,
    );
    if (digitado === null) return;
    if (digitado.trim().toLowerCase() !== nome.trim().toLowerCase()) {
      setErro("O nome digitado não confere — nada foi apagado.");
      return;
    }
    if (await pedir(`/api/clientes/${id}`, "DELETE")) {
      esquecerProjetos(dados.projetos.map((p) => p.id));
      router.push("/clientes");
    }
  };

  const renomearProjeto = async (p: Projeto) => {
    const nome = prompt("Novo nome do projeto:", p.nome)?.trim();
    if (!nome) return;
    await pedir(`/api/projeto/resultado?id=${p.id}`, "PUT", { nome });
    await carregar();
  };

  const apagarProjeto = async (p: Projeto, versoes: number) => {
    const ok = confirm(
      `Apagar o projeto "${p.nome}"` +
        (versoes ? ` e os ${versoes} vídeo(s) exportado(s) dele` : "") +
        `?\n\nOs arquivos do banco de mídia do cliente continuam. Isso não pode ser desfeito.`,
    );
    if (!ok) return;
    if (await pedir(`/api/projeto?id=${p.id}`, "DELETE")) {
      esquecerProjetos([p.id]);
      await carregar();
    }
  };

  const renomearExportacao = async (e: Exportacao) => {
    const nome = prompt("Novo nome da versão:", e.nome)?.trim();
    if (!nome) return;
    await pedir(`/api/exportacoes/${e.id}`, "PATCH", { nome });
    await carregar();
  };

  const apagarExportacao = async (e: Exportacao) => {
    if (
      !confirm(
        `Apagar o vídeo exportado "${e.nome}" (e o resultado registrado nele)?`,
      )
    ) {
      return;
    }
    if (await pedir(`/api/exportacoes/${e.id}`, "DELETE")) await carregar();
  };

  const salvarResultado = async (
    e: Exportacao,
    resultado: Resultado | null,
  ) => {
    await pedir(`/api/exportacoes/${e.id}`, "PATCH", { resultado });
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

  const avaliadas = dados.exportacoes.filter((e) => e.resultado);
  const boas = avaliadas.filter((e) => e.resultado?.avaliacao === "bom").length;
  const nomeDoProjeto = (projetoId: string) =>
    dados.projetos.find((p) => p.id === projetoId)?.nome ?? "";

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
            {id !== CLIENTE_PADRAO ? (
              <button
                onClick={() => void apagarCliente()}
                className="font-mono text-[11px] tracking-wider text-zinc-500 uppercase hover:text-spray"
              >
                apagar cliente
              </button>
            ) : null}
          </div>
          <p className="mt-2 font-mono text-xs tracking-wider text-zinc-500 uppercase">
            {dados.projetos.length} projeto(s) · {dados.exportacoes.length}{" "}
            vídeo(s) exportado(s) · {banco.length} arquivo(s) no banco ·{" "}
            {avaliadas.length} com resultado ({boas} deram resultado)
          </p>
          {erro ? <p className="mt-2 text-sm text-spray">{erro}</p> : null}
        </header>

        <section>
          <h2 className="rotulo-zine mb-3">Projetos e vídeos exportados</h2>
          <div className="mb-5 flex max-w-xl gap-2">
            <input
              value={nomeNovo}
              onChange={(e) => setNomeNovo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void criarProjeto()}
              placeholder="Nome do novo projeto (ex.: Promo Dia das Mães)"
              className="min-w-0 flex-1 border-2 border-tinta bg-zinc-950 px-3 py-2 text-sm outline-none focus:shadow-[3px_3px_0_var(--color-spray)]"
            />
            <button
              onClick={() => void criarProjeto()}
              disabled={!nomeNovo.trim()}
              className="botao-spray"
            >
              Novo projeto
            </button>
          </div>

          <div className="space-y-5">
            {dados.projetos.map((p) => {
              const versoes = dados.exportacoes.filter(
                (e) => e.projetoId === p.id,
              );
              return (
                <article key={p.id} className="cartao-zine p-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <h3 className="min-w-0 truncate font-display text-2xl leading-none tracking-wide uppercase">
                      {p.nome}
                    </h3>
                    <span className="font-mono text-[11px] text-zinc-500">
                      {p.cenas} cena(s) · editado {data(p.atualizadoEm)}
                    </span>
                    <div className="ml-auto flex items-center gap-3">
                      <button
                        onClick={() => void renomearProjeto(p)}
                        className={botaoApagar}
                      >
                        renomear
                      </button>
                      <button
                        onClick={() => void apagarProjeto(p, versoes.length)}
                        className={botaoApagar}
                      >
                        apagar
                      </button>
                      <button
                        onClick={() => abrirProjeto(p.id)}
                        className="botao-spray !py-1.5 !text-sm"
                      >
                        Abrir
                      </button>
                    </div>
                  </div>

                  {versoes.length ? (
                    <ul className="mt-4 divide-y divide-zinc-800 border-t-2 border-tinta">
                      {versoes.map((e) => (
                        <li key={e.id} className="py-3">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <span className="font-mono text-xs font-bold tracking-wider uppercase">
                              🎬 {e.nome}
                            </span>
                            <span className="font-mono text-[11px] text-zinc-500">
                              {data(e.criadoEm)} · {formatarTempo(e.duracao)}
                            </span>
                            {e.resultado ? (
                              <span
                                className={`px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase ${CORES[e.resultado.avaliacao]}`}
                              >
                                {ROTULO_AVALIACAO[e.resultado.avaliacao]}
                              </span>
                            ) : (
                              <span className="font-mono text-[10px] tracking-wider text-zinc-500 uppercase">
                                sem resultado
                              </span>
                            )}
                            <div className="ml-auto flex flex-wrap items-center gap-2">
                              <button
                                onClick={() =>
                                  setAssistindo(
                                    assistindo === e.id ? null : e.id,
                                  )
                                }
                                className={botaoMini}
                              >
                                {assistindo === e.id ? "Fechar" : "▶ Assistir"}
                              </button>
                              <a
                                href={`/api/midia/${e.arquivo}?baixar=${encodeURIComponent(`${p.nome} - ${e.nome}.mp4`)}`}
                                className={botaoMini}
                              >
                                ⬇ Baixar
                              </a>
                              <button
                                onClick={() => setResultadoDe(e)}
                                className={`${botaoMini} !border-spray text-spray`}
                              >
                                {e.resultado
                                  ? "Editar resultado"
                                  : "Registrar resultado"}
                              </button>
                              <button
                                onClick={() => void renomearExportacao(e)}
                                className={botaoApagar}
                              >
                                renomear
                              </button>
                              <button
                                onClick={() => void apagarExportacao(e)}
                                className={botaoApagar}
                              >
                                apagar
                              </button>
                            </div>
                          </div>
                          {e.resultado ? (
                            <p className="mt-1 text-xs">
                              {resumoDoResultado(e.resultado)}
                              {e.resultado.nota ? (
                                <span className="block text-zinc-500 italic">
                                  “{e.resultado.nota}”
                                </span>
                              ) : null}
                              {e.resultado.opiniaoVisual ? (
                                <span className="block text-zinc-500">
                                  👁 Visual: {e.resultado.opiniaoVisual}
                                </span>
                              ) : null}
                            </p>
                          ) : null}
                          {assistindo === e.id ? (
                            <video
                              src={`/api/midia/${e.arquivo}`}
                              controls
                              autoPlay
                              className="mt-3 max-h-96 border-2 border-tinta bg-black"
                            />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-zinc-500">
                      Nenhum vídeo exportado ainda. Abra o projeto e clique em{" "}
                      <b>Exportar</b> quando a edição estiver pronta.
                    </p>
                  )}
                </article>
              );
            })}
            {dados.projetos.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhum projeto ainda.</p>
            ) : null}
          </div>
        </section>

        <section className="cartao-zine flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <h2 className="rotulo-zine mb-1">Resultados automáticos</h2>
            <p className="text-sm text-zinc-500">
              Ligue o Instagram e os anúncios da Meta deste cliente: os números
              de cada vídeo entram sozinhos na aba Resultados (passo a passo,
              sem aprovação da Meta).
            </p>
          </div>
          <a
            href={`/conectar?cliente=${id}`}
            className="botao-spray !px-3 !py-1.5 !text-sm"
          >
            Conectar Instagram e anúncios
          </a>
        </section>

        <section>
          <h2 className="rotulo-zine mb-1">Banco de mídia ({banco.length})</h2>
          <p className="mb-3 text-sm text-zinc-500">
            Compartilhado por todos os projetos deste cliente. Para enviar
            arquivos, abra qualquer projeto dele e use a aba Arquivos.
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
          nomeProjeto={`${nomeDoProjeto(resultadoDe.projetoId)} › ${resultadoDe.nome}`}
          atual={resultadoDe.resultado}
          automatico={
            resultadoDe.metricas?.automaticos ?? { pago: [], instagram: [] }
          }
          aoSalvar={(r) => void salvarResultado(resultadoDe, r)}
          aoFechar={() => setResultadoDe(null)}
        />
      ) : null}
    </div>
  );
}
