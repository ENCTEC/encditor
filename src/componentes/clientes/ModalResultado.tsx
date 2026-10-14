"use client";

import { useState } from "react";
import { Resultado, ROTULO_AVALIACAO } from "@/projeto/resultado";

// Registrar o resultado de um vídeo no tráfego: avaliação (deu resultado
// ou não) e, se tiver, as métricas. Alimenta o aprendizado da IA.

const campo =
  "w-full border-2 border-tinta bg-zinc-950 px-2 py-1.5 text-sm outline-none focus:shadow-[3px_3px_0_var(--color-spray)]";

const numero = (texto: string) => {
  const n = Number(texto.replace(",", "."));
  return texto.trim() && Number.isFinite(n) ? n : null;
};

export const ModalResultado: React.FC<{
  nomeProjeto: string;
  atual: Resultado | null;
  aoSalvar: (resultado: Resultado | null) => void;
  aoFechar: () => void;
}> = ({ nomeProjeto, atual, aoSalvar, aoFechar }) => {
  const [avaliacao, setAvaliacao] = useState<Resultado["avaliacao"]>(
    atual?.avaliacao ?? "bom",
  );
  const texto = (n: number | null | undefined) => (n ?? "") + "";
  const [investimento, setInvestimento] = useState(
    texto(atual?.metricas.investimento),
  );
  const [ctr, setCtr] = useState(texto(atual?.metricas.ctr));
  const [cpa, setCpa] = useState(texto(atual?.metricas.cpa));
  const [roas, setRoas] = useState(texto(atual?.metricas.roas));
  const [nota, setNota] = useState(atual?.nota ?? "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/60 p-6"
      onPointerDown={(e) => e.target === e.currentTarget && aoFechar()}
      role="dialog"
      aria-label="Resultado do vídeo"
    >
      <div className="cartao-zine w-full max-w-lg p-5">
        <h2 className="font-display text-3xl leading-none tracking-wide uppercase">
          Resultado
        </h2>
        <p className="mt-1 font-mono text-[11px] tracking-wider text-zinc-500 uppercase">
          {nomeProjeto}
        </p>

        <p className="rotulo-zine mt-5 mb-2">Esse vídeo deu resultado?</p>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(ROTULO_AVALIACAO) as Resultado["avaliacao"][]).map(
            (a) => (
              <button
                key={a}
                onClick={() => setAvaliacao(a)}
                className={`border-2 border-tinta px-2 py-2 text-sm ${
                  avaliacao === a
                    ? a === "bom"
                      ? "bg-verde text-papel"
                      : a === "ruim"
                        ? "bg-spray text-papel"
                        : "bg-tinta text-papel"
                    : "hover:bg-zinc-900"
                }`}
              >
                {ROTULO_AVALIACAO[a]}
              </button>
            ),
          )}
        </div>

        <p className="rotulo-zine mt-5 mb-2">Métricas (opcional)</p>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["Investimento (R$)", investimento, setInvestimento],
              ["CTR (%)", ctr, setCtr],
              ["CPA (R$)", cpa, setCpa],
              ["ROAS", roas, setRoas],
            ] as const
          ).map(([rotulo, valor, mudar]) => (
            <label key={rotulo} className="block">
              <span className="mb-1 block text-xs text-zinc-400">{rotulo}</span>
              <input
                value={valor}
                onChange={(e) => mudar(e.target.value)}
                inputMode="decimal"
                className={campo}
              />
            </label>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-xs text-zinc-400">
            Anotação (o que funcionou ou não, público, gancho…)
          </span>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
            className={`${campo} resize-none`}
          />
        </label>

        <div className="mt-5 flex gap-2">
          {atual ? (
            <button
              onClick={() => aoSalvar(null)}
              className="border-2 border-tinta px-3 py-2 font-mono text-[11px] tracking-wider uppercase hover:bg-tinta hover:text-papel"
            >
              Apagar
            </button>
          ) : null}
          <button
            onClick={aoFechar}
            className="ml-auto border-2 border-tinta px-3 py-2 font-mono text-[11px] tracking-wider uppercase hover:bg-tinta hover:text-papel"
          >
            Cancelar
          </button>
          <button
            onClick={() =>
              aoSalvar({
                avaliacao,
                metricas: {
                  investimento: numero(investimento),
                  ctr: numero(ctr),
                  cpa: numero(cpa),
                  roas: numero(roas),
                },
                nota: nota.trim(),
                registradoEm: Date.now(),
              })
            }
            className="botao-spray"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};
