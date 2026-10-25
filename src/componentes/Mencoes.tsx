"use client";

import {
  EFEITOS_AUDIO,
  EFEITOS_VISUAIS,
  ESTILOS_LEGENDA,
  MOTIONS,
  SONS,
  TRANSICOES,
} from "@/catalogo/estilos";
import { Midia } from "@/projeto/tipos";

// Menções no chat: @apelido cita um arquivo; #tag cita uma transição, um
// estilo de legenda, um motion, um efeito ou um som. Aqui ficam o destaque no texto das mensagens, a lista
// de sugestões ao digitar "@"/"#" e o "citar no chat" do menu Estilos.

export type Prefixo = "@" | "#";

export type Sugestao = {
  chave: string;
  // O que entra no texto depois do prefixo ("videolael", "fade").
  valor: string;
  titulo: string;
  detalhe: string;
  extra?: string;
};

const CATALOGO = [
  ...TRANSICOES.map((t) => ({ ...t, grupo: "transição" })),
  ...ESTILOS_LEGENDA.map((e) => ({ ...e, grupo: "legenda" })),
  ...EFEITOS_AUDIO.map((e) => ({ ...e, grupo: "áudio" })),
  ...MOTIONS.map((m) => ({ ...m, grupo: "motion" })),
  ...EFEITOS_VISUAIS.map((e) => ({ ...e, grupo: "efeito" })),
  ...SONS.map((s) => ({ ...s, grupo: "som" })),
];

const PADRAO = /([@#][a-z0-9_-]+)/gi;

export const TextoComMencoes: React.FC<{
  texto: string;
  biblioteca: Midia[];
}> = ({ texto, biblioteca }) => (
  <>
    {texto.split(PADRAO).map((parte, i) => {
      const chave = parte.slice(1).toLowerCase();
      const midia =
        parte.startsWith("@") && biblioteca.find((m) => m.apelido === chave);
      if (midia) {
        return (
          <span
            key={i}
            className="bg-tinta px-1 font-mono text-[0.85em] text-papel"
            title={`${midia.nome} — ${midia.nomeArquivo}`}
          >
            {parte}
          </span>
        );
      }
      const estilo =
        parte.startsWith("#") && CATALOGO.find((c) => c.tag === `#${chave}`);
      if (estilo) {
        return (
          <span
            key={i}
            className="border border-current px-1 font-mono text-[0.85em]"
            title={`${estilo.grupo}: ${estilo.nome} — ${estilo.descricao}`}
          >
            {parte}
          </span>
        );
      }
      return <span key={i}>{parte}</span>;
    })}
  </>
);

// "@vid" ou "#fa" digitado logo antes do cursor, ou null.
export const termoDeMencao = (texto: string, cursor: number) => {
  const achado = /(^|\s)([@#])([a-z0-9_-]*)$/i.exec(texto.slice(0, cursor));
  return achado
    ? { prefixo: achado[2] as Prefixo, termo: achado[3].toLowerCase() }
    : null;
};

export const sugestoesDeMencao = (
  biblioteca: Midia[],
  prefixo: Prefixo,
  termo: string,
): Sugestao[] => {
  if (prefixo === "@") {
    return biblioteca
      .filter(
        (m) =>
          m.apelido.includes(termo) ||
          m.nome.toLowerCase().replace(/\s/g, "").includes(termo) ||
          m.nomeArquivo.toLowerCase().includes(termo),
      )
      .slice(0, 8)
      .map((m) => ({
        chave: m.id,
        valor: m.apelido,
        titulo: `@${m.apelido}`,
        detalhe: m.nome,
        extra: m.nomeArquivo,
      }));
  }
  return CATALOGO.filter(
    (c) =>
      c.tag.slice(1).includes(termo) ||
      c.nome.toLowerCase().includes(termo) ||
      c.grupo.startsWith(termo),
  ).map((c) => ({
    chave: `${c.grupo}-${c.id}`,
    valor: c.tag.slice(1),
    titulo: c.tag,
    detalhe: c.nome,
    extra: c.grupo,
  }));
};

// Troca o "@termo"/"#termo" antes do cursor pela menção completa.
export const inserirMencao = (
  texto: string,
  cursor: number,
  prefixo: Prefixo,
  valor: string,
) => {
  const antes = texto
    .slice(0, cursor)
    .replace(/[@#][a-z0-9_-]*$/i, `${prefixo}${valor} `);
  return { texto: antes + texto.slice(cursor), cursor: antes.length };
};

// Botão "citar no chat" (menu Estilos): avisa o chat por um evento, para
// funcionar em qualquer aba.
export const EVENTO_CITAR = "encditor:citar";
export const citarNoChat = (tag: string) =>
  window.dispatchEvent(new CustomEvent(EVENTO_CITAR, { detail: tag }));

export const SugestoesMencao: React.FC<{
  opcoes: Sugestao[];
  ativa: number;
  aoEscolher: (s: Sugestao) => void;
}> = ({ opcoes, ativa, aoEscolher }) => (
  <ul className="absolute bottom-full left-0 z-30 mb-2 max-h-80 w-96 overflow-y-auto border-2 border-tinta bg-zinc-950 py-1 text-sm shadow-[4px_4px_0_var(--color-tinta)]">
    {opcoes.map((s, i) => (
      <li key={s.chave}>
        <button
          // onMouseDown para escolher antes de a caixa de texto perder o foco.
          onMouseDown={(e) => {
            e.preventDefault();
            aoEscolher(s);
          }}
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${
            i === ativa ? "bg-violet-950" : "hover:bg-zinc-900"
          }`}
        >
          <span className="font-mono font-bold text-violet-300">
            {s.titulo}
          </span>
          <span className="text-zinc-400">{s.detalhe}</span>
          {s.extra ? (
            <span className="ml-auto max-w-32 truncate font-mono text-[10px] tracking-wider text-zinc-500 uppercase">
              {s.extra}
            </span>
          ) : null}
        </button>
      </li>
    ))}
  </ul>
);
