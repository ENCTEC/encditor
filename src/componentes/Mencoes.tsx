"use client";

import { Midia } from "@/projeto/tipos";

// Menções a arquivos com @apelido: o destaque no texto das mensagens e a
// lista de sugestões que aparece ao digitar "@" na caixa do chat.

const PADRAO = /(@[a-z0-9_-]+)/gi;

export const TextoComMencoes: React.FC<{
  texto: string;
  biblioteca: Midia[];
}> = ({ texto, biblioteca }) => (
  <>
    {texto.split(PADRAO).map((parte, i) => {
      const midia =
        parte.startsWith("@") &&
        biblioteca.find((m) => m.apelido === parte.slice(1).toLowerCase());
      return midia ? (
        <span
          key={i}
          className="rounded bg-black/30 px-1 font-medium"
          title={`${midia.nome} — ${midia.nomeArquivo}`}
        >
          {parte}
        </span>
      ) : (
        <span key={i}>{parte}</span>
      );
    })}
  </>
);

// Termo sendo digitado logo antes do cursor ("@vid" -> "vid"), ou null.
export const termoDeMencao = (texto: string, cursor: number) => {
  const antes = texto.slice(0, cursor);
  const achado = /(^|\s)@([a-z0-9_-]*)$/i.exec(antes);
  return achado ? achado[2].toLowerCase() : null;
};

export const filtrarMencoes = (biblioteca: Midia[], termo: string) =>
  biblioteca
    .filter(
      (m) =>
        m.apelido.includes(termo) ||
        m.nome.toLowerCase().replace(/\s/g, "").includes(termo) ||
        m.nomeArquivo.toLowerCase().includes(termo),
    )
    .slice(0, 8);

// Troca o "@termo" antes do cursor por "@apelido ".
export const inserirMencao = (
  texto: string,
  cursor: number,
  apelido: string,
) => {
  const antes = texto
    .slice(0, cursor)
    .replace(/@[a-z0-9_-]*$/i, `@${apelido} `);
  return { texto: antes + texto.slice(cursor), cursor: antes.length };
};

export const SugestoesMencao: React.FC<{
  opcoes: Midia[];
  ativa: number;
  aoEscolher: (midia: Midia) => void;
}> = ({ opcoes, ativa, aoEscolher }) => (
  <ul className="absolute bottom-full left-0 z-30 mb-2 w-80 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 py-1 text-sm shadow-xl">
    {opcoes.map((m, i) => (
      <li key={m.id}>
        <button
          // onMouseDown para escolher antes de a caixa de texto perder o foco.
          onMouseDown={(e) => {
            e.preventDefault();
            aoEscolher(m);
          }}
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${
            i === ativa ? "bg-violet-600/30" : "hover:bg-zinc-800"
          }`}
        >
          <span className="font-medium text-violet-300">@{m.apelido}</span>
          <span className="text-zinc-400">{m.nome}</span>
          <span className="ml-auto max-w-32 truncate text-xs text-zinc-500">
            {m.nomeArquivo}
          </span>
        </button>
      </li>
    ))}
  </ul>
);
