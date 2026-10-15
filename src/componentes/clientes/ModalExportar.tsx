"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MetaProjeto, useProjeto } from "@/projeto/ProjetoProvider";
import { FORMATOS, formatoDaTimeline, IdFormato } from "@/timeline/formatos";

// Exportar o vídeo final (MP4) do projeto aberto, em uma ou mais
// proporções. Cada MP4 vira uma VERSÃO do projeto, listada na página do
// cliente — é nela que se registra o resultado no tráfego. A renderização
// roda no servidor (uma por vez): dá para fechar esta janela e voltar
// depois (o andamento fica guardado na aba).

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

const lerIds = (projetoId: string): string[] => {
  try {
    const valor = JSON.parse(sessionStorage.getItem(chave(projetoId)) ?? "[]");
    return Array.isArray(valor) ? valor : [valor];
  } catch {
    return [];
  }
};

const campo =
  "w-full border-2 border-tinta bg-zinc-950 px-3 py-2 text-sm outline-none focus:shadow-[3px_3px_0_var(--color-spray)]";

const botaoSecundario =
  "border-2 border-tinta px-3 py-2 font-mono text-[11px] tracking-wider uppercase hover:bg-tinta hover:text-papel";

// Desenho da proporção (retângulo proporcional) para os botões.
const Proporcao: React.FC<{ largura: number; altura: number }> = ({
  largura,
  altura,
}) => {
  const escala = 22 / Math.max(largura, altura);
  return (
    <span
      className="inline-block border-2 border-current"
      style={{ width: largura * escala, height: altura * escala }}
    />
  );
};

export const ModalExportar: React.FC<{
  meta: MetaProjeto;
  aoFechar: () => void;
}> = ({ meta, aoFechar }) => {
  const { projeto, salvamento } = useProjeto();
  const atual = formatoDaTimeline(projeto.timeline);
  const [nome, setNome] = useState("");
  const [formatos, setFormatos] = useState<IdFormato[]>([atual ?? "9:16"]);
  const [trabalhos, setTrabalhos] = useState<Trabalho[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const acompanhar = useCallback(
    async (ids: string[]) => {
      const lidos = await Promise.all(
        ids.map(async (id) => {
          const r = await fetch(`/api/exportar?trabalho=${id}`, {
            cache: "no-store",
          });
          // 404 = o servidor reiniciou e esqueceu o trabalho.
          return r.ok
            ? ((await r.json()) as { trabalho: Trabalho }).trabalho
            : null;
        }),
      );
      const validos = lidos.filter((t): t is Trabalho => t !== null);
      if (!validos.length) sessionStorage.removeItem(chave(meta.id));
      setTrabalhos(validos);
    },
    [meta.id],
  );

  // Retoma exportações em andamento deste projeto.
  useEffect(() => {
    const ids = lerIds(meta.id);
    if (ids.length) void acompanhar(ids);
  }, [meta.id, acompanhar]);

  // Enquanto alguma renderiza, consulta o andamento a cada 1,5s.
  const emAndamento = trabalhos.some(
    (t) => t.estado !== "pronto" && t.estado !== "erro",
  );
  useEffect(() => {
    if (!emAndamento) return;
    const ids = trabalhos.map((t) => t.id);
    const timer = setInterval(() => void acompanhar(ids), 1500);
    return () => clearInterval(timer);
  }, [emAndamento, trabalhos, acompanhar]);

  const alternarFormato = (id: IdFormato) =>
    setFormatos((atuais) =>
      atuais.includes(id)
        ? atuais.filter((f) => f !== id)
        : FORMATOS.map((f) => f.id).filter(
            (f) => f === id || atuais.includes(f),
          ),
    );

  const exportar = async () => {
    setErro(null);
    const r = await fetch("/api/exportar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projetoId: meta.id, nome: nome.trim(), formatos }),
    });
    const d = (await r.json()) as { trabalhos?: Trabalho[]; erro?: string };
    if (!d.trabalhos?.length) {
      setErro(d.erro ?? "Não consegui começar a exportação.");
      return;
    }
    sessionStorage.setItem(
      chave(meta.id),
      JSON.stringify(d.trabalhos.map((t) => t.id)),
    );
    setTrabalhos(d.trabalhos);
  };

  const recomecar = () => {
    sessionStorage.removeItem(chave(meta.id));
    setTrabalhos([]);
    setNome("");
  };

  const semCenas = projeto.timeline.clipes.length === 0;
  const salvando = salvamento !== "salvo";
  const podeExportar = !semCenas && !salvando && formatos.length > 0;
  const prontos = trabalhos.filter((t) => t.estado === "pronto" && t.arquivo);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/60 p-6"
      onPointerDown={(e) => e.target === e.currentTarget && aoFechar()}
      role="dialog"
      aria-label="Exportar vídeo"
    >
      <div className="cartao-zine max-h-full w-full max-w-lg overflow-y-auto p-5">
        <h2 className="font-display text-3xl leading-none tracking-wide uppercase">
          Exportar vídeo
        </h2>
        <p className="mt-1 font-mono text-[11px] tracking-wider text-zinc-500 uppercase">
          📁 {meta.cliente.nome} › {meta.nome}
        </p>

        {!trabalhos.length ? (
          <>
            <p className="mt-4 text-sm">
              Gera o MP4 final desta edição e guarda como uma <b>versão</b> do
              projeto. Depois, na página do cliente, você registra se essa
              versão deu resultado no tráfego.
            </p>

            <div className="mt-4">
              <span className="rotulo-zine mb-1 block">
                Proporção (pode escolher várias)
              </span>
              <div className="grid grid-cols-2 gap-2">
                {FORMATOS.map((f) => {
                  const marcado = formatos.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      onClick={() => alternarFormato(f.id)}
                      aria-pressed={marcado}
                      className={`flex items-center gap-3 border-2 px-3 py-2 text-left ${
                        marcado
                          ? "border-tinta bg-tinta text-papel"
                          : "border-zinc-700 hover:border-tinta"
                      }`}
                    >
                      <span className="flex w-6 justify-center">
                        <Proporcao largura={f.largura} altura={f.altura} />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-mono text-sm font-bold">
                          {f.id}
                          {f.id === atual ? (
                            <span className="ml-1 text-[10px] font-normal opacity-70">
                              (atual)
                            </span>
                          ) : null}
                        </span>
                        <span className="block truncate text-[11px] opacity-80">
                          {f.nome}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {formatos.some((f) => f !== atual) ? (
                <p className="mt-2 text-xs text-zinc-500">
                  Em outra proporção, as cenas são reenquadradas pelo centro
                  (corta as sobras), os inserts em janela mantêm o formato e as
                  legendas se ajustam. Vale conferir o resultado.
                </p>
              ) : null}
            </div>

            <label className="mt-4 block">
              <span className="rotulo-zine mb-1 block">
                Nome da versão (opcional)
              </span>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && podeExportar && void exportar()
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
          <div className="mt-4 space-y-4">
            {trabalhos.map((t) => (
              <div key={t.id}>
                <div className="flex items-baseline justify-between font-mono text-xs tracking-wider uppercase">
                  <span>
                    {t.nome} — {ROTULO[t.estado]}
                  </span>
                  <span className="tabular-nums">
                    {Math.round(t.progresso * 100)}%
                  </span>
                </div>
                <div className="mt-2 h-4 border-2 border-tinta">
                  <div
                    className={`h-full transition-[width] ${
                      t.estado === "erro" ? "bg-spray" : "bg-verde"
                    }`}
                    style={{ width: `${Math.round(t.progresso * 100)}%` }}
                  />
                </div>
                {t.estado === "erro" ? (
                  <p className="mt-2 text-sm text-spray">{t.erro}</p>
                ) : null}
                {t.estado === "pronto" && t.arquivo ? (
                  <div className="mt-2 flex items-start gap-3">
                    <video
                      src={`/api/midia/${t.arquivo}`}
                      controls
                      className="max-h-56 max-w-[60%] border-2 border-tinta bg-black"
                    />
                    <a
                      href={`/api/midia/${t.arquivo}?baixar=${encodeURIComponent(`${meta.nome} - ${t.nome}.mp4`)}`}
                      className="botao-spray"
                    >
                      Baixar MP4
                    </a>
                  </div>
                ) : null}
              </div>
            ))}
            {emAndamento ? (
              <p className="text-xs text-zinc-500">
                Pode fechar esta janela: a renderização continua no servidor
                (uma de cada vez).
              </p>
            ) : null}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {trabalhos.length && !emAndamento ? (
            <button onClick={recomecar} className={botaoSecundario}>
              Nova exportação
            </button>
          ) : null}
          <button onClick={aoFechar} className={`ml-auto ${botaoSecundario}`}>
            Fechar
          </button>
          {!trabalhos.length ? (
            <button
              onClick={() => void exportar()}
              disabled={!podeExportar}
              className="botao-spray"
            >
              {salvando
                ? "Salvando…"
                : formatos.length > 1
                  ? `Exportar ${formatos.length} MP4`
                  : "Exportar MP4"}
            </button>
          ) : null}
          {prontos.length ? (
            <Link
              href={`/clientes/${meta.cliente.id}`}
              onClick={aoFechar}
              className={botaoSecundario}
            >
              Ver versões
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
};
