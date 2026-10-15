"use client";

import { useEffect, useRef, useState } from "react";
import { UsoPlano } from "@/plano/usePlano";

// Conversa com a IA planejadora: ela pergunta o que faltar, monta o plano
// e ajusta conforme o usuário pede.

const SUGESTOES = [
  "Monte o plano do vídeo",
  "Crie o roteiro do zero com base no objetivo",
  "Use mais clipes do banco que deram resultado",
  "Deixe o gancho mais forte nos 2 primeiros segundos",
];

export const ConversaPlano: React.FC<{ uso: UsoPlano }> = ({ uso }) => {
  const { plano, conversar, pensando, erro, limparErro } = uso;
  const [texto, setTexto] = useState("");
  const fim = useRef<HTMLDivElement>(null);
  const conversa = plano?.conversa ?? [];

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conversa.length, pensando]);

  const enviar = async (mensagem: string) => {
    const m = mensagem.trim();
    if (!m || pensando) return;
    setTexto("");
    if (!(await conversar(m))) setTexto(m);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b-[3px] border-tinta px-3 py-2">
        <span className="font-mono text-[11px] tracking-[0.2em] text-zinc-500 uppercase">
          Conversa com o planejador
        </span>
        {conversa.length ? (
          <button
            onClick={() => {
              if (
                confirm(
                  "Recomeçar apaga esta conversa e o plano gerado (o briefing, os exemplos e os arquivos enviados ficam). Continuar?",
                )
              ) {
                void uso.mudar({ recomecar: true });
              }
            }}
            className="font-mono text-[10px] tracking-wider text-zinc-500 uppercase hover:text-spray"
          >
            Recomeçar
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {!conversa.length ? (
          <div className="space-y-3 text-sm text-zinc-400">
            <p>
              Preencha o que tiver no briefing (pode ser só o objetivo) e peça o
              plano. Eu uso os resultados dos vídeos deste cliente, as suas
              opiniões, os exemplos e o banco de mídia — e pergunto o que
              faltar.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => void enviar(s)}
                  disabled={pensando}
                  className="border-2 border-tinta px-2 py-1 text-left text-xs hover:bg-tinta hover:text-papel"
                >
                  “{s}”
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {conversa.map((m, i) => (
          <div
            key={i}
            className={
              m.autor === "usuario"
                ? "ml-8 border-2 border-tinta bg-spray px-3 py-2 text-sm text-papel"
                : "mr-4 border-2 border-tinta bg-zinc-950 px-3 py-2 text-sm whitespace-pre-wrap shadow-[3px_3px_0_var(--color-tinta)]"
            }
          >
            {m.texto}
          </div>
        ))}
        {pensando ? (
          <p className="animate-pulse font-mono text-xs text-zinc-500 uppercase">
            Planejando… (lendo dados, exemplos e banco; leva uns segundos)
          </p>
        ) : null}
        {erro ? (
          <p className="border-2 border-spray p-2 text-sm text-spray">
            {erro}{" "}
            <button onClick={limparErro} className="underline">
              ok
            </button>
          </p>
        ) : null}
        <div ref={fim} />
      </div>

      <div className="border-t-[3px] border-tinta p-3">
        <div className="flex gap-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void enviar(texto);
              }
            }}
            rows={2}
            placeholder={
              plano?.gerado
                ? "Peça ajustes: ‘troque a cena 3’, ‘menos texto’, ‘use a loja no começo’…"
                : "Responda às perguntas ou peça ‘monte o plano’…"
            }
            className="min-w-0 flex-1 resize-none border-2 border-tinta bg-zinc-950 px-2 py-1.5 text-sm outline-none focus:shadow-[3px_3px_0_var(--color-spray)]"
          />
          <button
            onClick={() => void enviar(texto)}
            disabled={pensando || !texto.trim()}
            className="botao-spray self-end"
          >
            {pensando ? "…" : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
};
