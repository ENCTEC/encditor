"use client";

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
          <span className="ml-auto shrink-0 tabular-nums text-zinc-500">
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
