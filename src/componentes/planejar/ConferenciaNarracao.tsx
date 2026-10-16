"use client";

import { CenaPlano, VerificacaoNarracao } from "@/plano/tipos";

// Resultado da conferência da narração gravada: quanto o vídeo vai durar,
// onde cada cena começa, quanto dura e quanto gerar no Higgsfield — e se o
// que foi falado bate com o roteiro.

const br = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export const ConferenciaNarracao: React.FC<{
  verificacao: VerificacaoNarracao;
  cenas: CenaPlano[];
}> = ({ verificacao: v, cenas }) => (
  <div className="space-y-2 border-2 border-verde p-3">
    <p className="text-sm">
      <b className="text-verde">✓ Narração conferida:</b> {br(v.duracao)}s. Os
      tempos das cenas e o quanto gerar de cada take (inclusive o número de
      segundos no prompt) foram ajustados à sua gravação.
    </p>
    {v.avisos.map((a, i) => (
      <p key={i} className="text-xs text-zinc-400">
        ↻ {a}
      </p>
    ))}
    <table className="w-full text-left text-xs">
      <thead className="text-zinc-500">
        <tr className="border-b border-zinc-800">
          <th className="py-1 pr-3 font-medium">Cena</th>
          <th className="py-1 pr-3 font-medium">Começa</th>
          <th className="py-1 pr-3 font-medium">Dura</th>
          <th className="py-1 pr-3 font-medium">Gerar</th>
          <th className="py-1 pr-3 font-medium">O que você falou</th>
        </tr>
      </thead>
      <tbody>
        {v.cenas.map((c) => {
          const cena = cenas.find((x) => x.numero === c.numero);
          return (
            <tr
              key={c.numero}
              className="border-b border-zinc-800/60 align-top"
            >
              <td className="py-1 pr-3 font-mono">{c.numero}</td>
              <td className="py-1 pr-3 tabular-nums">{br(c.inicio)}s</td>
              <td className="py-1 pr-3 tabular-nums">{br(c.duracao)}s</td>
              <td className="py-1 pr-3 tabular-nums">
                {cena?.origem === "banco" ? "banco" : `${c.gerar}s`}
              </td>
              <td className="py-1">
                {c.confere ? "✓ " : "↻ "}
                {c.falou || "(nada nesse trecho)"}
                {!c.confere && cena?.fala ? (
                  <span className="block text-zinc-500">
                    (adaptado; no roteiro era: “{cena.fala}”)
                  </span>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    <p className="text-[11px] text-zinc-500">
      “Gerar” já está entre 4 s (mínimo do Higgsfield) e 30 s (máximo), com ~1 s
      de folga — o ENCeditor apara o que sobrar.
    </p>
  </div>
);
