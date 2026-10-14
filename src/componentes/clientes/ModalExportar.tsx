"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MetaProjeto, useProjeto } from "@/projeto/ProjetoProvider";

// Exportar o vídeo final (MP4) do projeto aberto. Cada exportação vira uma
// VERSÃO do projeto, listada na página do cliente — é nela que se registra
// o resultado no tráfego. A renderização roda no servidor: dá para fechar
// esta janela e voltar depois (o andamento fica guardado na aba).

type Trabalho = {
  id: string;
  nome: string;
  estado: "na-fila" | "preparando" | "renderizando" | "pronto" | "erro";
  progresso: number;
  erro: string | null;
  arquivo: string | null;
};

const ROTULO: Record<Trabalho["estado"], string> = {
  "na-fila": "Na fila…",
  preparando: "Preparando…",
  renderizando: "Renderizando",
  pronto: "Pronto!",
  erro: "Deu erro",
};

const chave = (projetoId: string) => `encditor:exportando:${projetoId}`;

const campo =
  "w-full border-2 border-tinta bg-zinc-950 px-3 py-2 text-sm outline-none focus:shadow-[3px_3px_0_var(--color-spray)]";

export const ModalExportar: React.FC<{
  meta: MetaProjeto;
  aoFechar: () => void;
}> = ({ meta, aoFechar }) => {
  const { projeto, salvamento } = useProjeto();
  const [nome, setNome] = useState("");
  const [trabalho, setTrabalho] = useState<Trabalho | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const acompanhar = useCallback(
    async (id: string) => {
      const r = await fetch(`/api/exportar?trabalho=${id}`, {
        cache: "no-store",
      });
      if (!r.ok) {
        // O servidor reiniciou e esqueceu o trabalho.
        sessionStorage.removeItem(chave(meta.id));
        setTrabalho(null);
        return null;
      }
      const t = ((await r.json()) as { trabalho: Trabalho }).trabalho;
      setTrabalho(t);
      return t;
    },
    [meta.id],
  );

  // Retoma uma exportação em andamento deste projeto.
  useEffect(() => {
    const id = sessionStorage.getItem(chave(meta.id));
    if (id) void acompanhar(id);
  }, [meta.id, acompanhar]);

  // Enquanto renderiza, consulta o andamento a cada 1,5s.
  const emAndamento =
    trabalho !== null &&
    trabalho.estado !== "pronto" &&
    trabalho.estado !== "erro";
  useEffect(() => {
    if (!emAndamento || !trabalho) return;
    const timer = setInterval(() => void acompanhar(trabalho.id), 1500);
    return () => clearInterval(timer);
  }, [emAndamento, trabalho, acompanhar]);

  const exportar = async () => {
    setErro(null);
    const r = await fetch("/api/exportar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projetoId: meta.id, nome: nome.trim() }),
    });
    const d = (await r.json()) as { trabalho?: Trabalho; erro?: string };
    if (!d.trabalho) {
      setErro(d.erro ?? "Não consegui começar a exportação.");
      return;
    }
    sessionStorage.setItem(chave(meta.id), d.trabalho.id);
    setTrabalho(d.trabalho);
  };

  const recomecar = () => {
    sessionStorage.removeItem(chave(meta.id));
    setTrabalho(null);
    setNome("");
  };

  const semCenas = projeto.timeline.clipes.length === 0;
  const salvando = salvamento !== "salvo";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/60 p-6"
      onPointerDown={(e) => e.target === e.currentTarget && aoFechar()}
      role="dialog"
      aria-label="Exportar vídeo"
    >
      <div className="cartao-zine w-full max-w-lg p-5">
        <h2 className="font-display text-3xl leading-none tracking-wide uppercase">
          Exportar vídeo
        </h2>
        <p className="mt-1 font-mono text-[11px] tracking-wider text-zinc-500 uppercase">
          📁 {meta.cliente.nome} › {meta.nome}
        </p>

        {!trabalho ? (
          <>
            <p className="mt-4 text-sm">
              Gera o MP4 final desta edição e guarda como uma <b>versão</b> do
              projeto. Depois, na página do cliente, você registra se essa
              versão deu resultado no tráfego.
            </p>
            <label className="mt-4 block">
              <span className="rotulo-zine mb-1 block">
                Nome da versão (opcional)
              </span>
              <input
                autoFocus
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !semCenas && !salvando && void exportar()
                }
                placeholder="ex.: Gancho com pergunta (padrão: Versão N)"
                maxLength={80}
                className={campo}
              />
            </label>
            {semCenas ? (
              <p className="mt-2 text-sm text-spray">
                O projeto ainda não tem cenas na trilha principal.
              </p>
            ) : null}
            {erro ? <p className="mt-2 text-sm text-spray">{erro}</p> : null}
          </>
        ) : (
          <div className="mt-4">
            <div className="flex items-baseline justify-between font-mono text-xs tracking-wider uppercase">
              <span>
                {trabalho.nome} — {ROTULO[trabalho.estado]}
              </span>
              <span className="tabular-nums">
                {Math.round(trabalho.progresso * 100)}%
              </span>
            </div>
            <div className="mt-2 h-4 border-2 border-tinta">
              <div
                className={`h-full transition-[width] ${
                  trabalho.estado === "erro" ? "bg-spray" : "bg-verde"
                }`}
                style={{ width: `${Math.round(trabalho.progresso * 100)}%` }}
              />
            </div>
            {emAndamento ? (
              <p className="mt-2 text-xs text-zinc-500">
                Pode fechar esta janela: a renderização continua no servidor.
              </p>
            ) : null}
            {trabalho.estado === "erro" ? (
              <p className="mt-2 text-sm text-spray">{trabalho.erro}</p>
            ) : null}
            {trabalho.estado === "pronto" && trabalho.arquivo ? (
              <video
                src={`/api/midia/${trabalho.arquivo}`}
                controls
                className="mt-4 max-h-72 w-full border-2 border-tinta bg-black"
              />
            ) : null}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {trabalho && !emAndamento ? (
            <button
              onClick={recomecar}
              className="border-2 border-tinta px-3 py-2 font-mono text-[11px] tracking-wider uppercase hover:bg-tinta hover:text-papel"
            >
              Nova exportação
            </button>
          ) : null}
          <button
            onClick={aoFechar}
            className="ml-auto border-2 border-tinta px-3 py-2 font-mono text-[11px] tracking-wider uppercase hover:bg-tinta hover:text-papel"
          >
            Fechar
          </button>
          {!trabalho ? (
            <button
              onClick={() => void exportar()}
              disabled={semCenas || salvando}
              className="botao-spray"
            >
              {salvando ? "Salvando…" : "Exportar MP4"}
            </button>
          ) : null}
          {trabalho?.estado === "pronto" && trabalho.arquivo ? (
            <>
              <Link
                href={`/clientes/${meta.cliente.id}`}
                onClick={aoFechar}
                className="border-2 border-tinta px-3 py-2 font-mono text-[11px] tracking-wider uppercase hover:bg-tinta hover:text-papel"
              >
                Ver versões
              </Link>
              <a
                href={`/api/midia/${trabalho.arquivo}?baixar=${encodeURIComponent(`${meta.nome} - ${trabalho.nome}.mp4`)}`}
                className="botao-spray"
              >
                Baixar MP4
              </a>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
