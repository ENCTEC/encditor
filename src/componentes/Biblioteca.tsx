"use client";

import { iniciarAnalise } from "@/componentes/AnaliseAutomatica";
import { podeAnalisar } from "@/projeto/midia-cliente";
import { useProjeto } from "@/projeto/ProjetoProvider";
import { Midia } from "@/projeto/tipos";

const ICONE: Record<Midia["formato"], string> = {
  video: "🎬",
  imagem: "🖼️",
  audio: "🎵",
};

export const formatarTempo = (segundos: number) => {
  const m = Math.floor(segundos / 60);
  const s = segundos - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
};

// Situação da análise (fala + visual) de um arquivo, em poucas palavras.
const EstadoAnalise: React.FC<{ midia: Midia }> = ({ midia }) => {
  const { atualizarAnalise } = useProjeto();
  const analise = midia.analise;
  if (midia.usarIA === false) {
    return (
      <span
        className="text-xs text-sky-300"
        title="Arquivo frio: a IA não lê o conteúdo. Mude na aba Arquivos."
      >
        ❄ frio
      </span>
    );
  }
  if (!podeAnalisar(midia) || !analise) return null;

  if (analise.status === "analisando") {
    return (
      <span className="animate-pulse text-xs text-violet-300">analisando…</span>
    );
  }
  if (analise.status === "erro") {
    return (
      <button
        onClick={() => iniciarAnalise(midia, atualizarAnalise)}
        title={analise.erro ?? "Erro na análise"}
        className="text-xs text-amber-400 hover:text-amber-200"
      >
        ⚠ analisar de novo
      </button>
    );
  }
  const partes = [
    analise.transcricao ? "fala" : null,
    analise.visual ? "visual" : null,
  ].filter(Boolean);
  return (
    <span
      className="text-xs text-emerald-400"
      title={
        [analise.visual?.resumo, analise.transcricao?.texto]
          .filter(Boolean)
          .join("\n\n") || "Sem fala nem conteúdo visual"
      }
    >
      ✓ {partes.length ? partes.join(" + ") : "sem fala"}
    </span>
  );
};

// Lista os arquivos do projeto. "acao" é opcional: na aba Timeline vira o
// botão de colocar o item na posição atual.
export const Biblioteca: React.FC<{
  biblioteca: Midia[];
  acao?: { rotulo: string; executar: (midia: Midia) => void };
}> = ({ biblioteca, acao }) => {
  if (biblioteca.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Nenhum arquivo ainda. Anexe cenas, inserts ou áudios no chat.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {biblioteca.map((midia) => (
        <li
          key={midia.id}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-800/60"
        >
          <span>{ICONE[midia.formato]}</span>
          <span className="shrink-0 whitespace-nowrap font-medium">
            {midia.nome}
          </span>
          <span className="truncate text-zinc-500" title={midia.nomeArquivo}>
            {midia.nomeArquivo}
          </span>
          <span className="ml-auto shrink-0">
            <EstadoAnalise midia={midia} />
          </span>
          <span className="shrink-0 tabular-nums text-zinc-500">
            {midia.duracao !== null ? formatarTempo(midia.duracao) : ""}
          </span>
          {acao && midia.papel !== "cena" ? (
            <button
              onClick={() => acao.executar(midia)}
              className="shrink-0 rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300 hover:bg-violet-600 hover:text-white"
            >
              {acao.rotulo}
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
};
