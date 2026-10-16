"use client";

import { useRef, useState } from "react";
import { CenaPlano } from "@/plano/tipos";
import { UsoPlano } from "@/plano/usePlano";
import { Voz, VOZES } from "@/plano/vozes";

// Roteiro para GRAVAR a narração: cada fala com a entonação, as palavras
// que saem mais fortes, o ritmo e a pausa depois. A voz sintética lê tudo
// seguindo essas indicações para o usuário ouvir e copiar o jeito de falar
// (dá para ouvir fala por fala).

const RITMO: Record<CenaPlano["ritmo"], string> = {
  lento: "🐢 devagar",
  normal: "→ normal",
  rapido: "⚡ rápido",
};

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Destaca as palavras com ênfase dentro da fala.
const FalaComEnfase: React.FC<{ fala: string; enfase: string[] }> = ({
  fala,
  enfase,
}) => {
  const alvos = enfase.map(sem).filter(Boolean);
  if (!alvos.length) return <>{fala}</>;
  const pedacos: { texto: string; forte: boolean }[] = [];
  const base = sem(fala);
  let i = 0;
  while (i < fala.length) {
    const achado = alvos
      .map((a) => ({ a, pos: base.indexOf(a, i) }))
      .filter((x) => x.pos >= 0)
      .sort((x, y) => x.pos - y.pos)[0];
    if (!achado) {
      pedacos.push({ texto: fala.slice(i), forte: false });
      break;
    }
    if (achado.pos > i) {
      pedacos.push({ texto: fala.slice(i, achado.pos), forte: false });
    }
    pedacos.push({
      texto: fala.slice(achado.pos, achado.pos + achado.a.length),
      forte: true,
    });
    i = achado.pos + achado.a.length;
  }
  return (
    <>
      {pedacos.map((p, j) =>
        p.forte ? (
          <b key={j} className="bg-spray px-0.5 text-papel">
            {p.texto}
          </b>
        ) : (
          <span key={j}>{p.texto}</span>
        ),
      )}
    </>
  );
};

// Texto para copiar: ênfase em CAIXA ALTA, entonação entre parênteses e
// as pausas marcadas.
const textoParaCopiar = (cenas: CenaPlano[], tom: string) =>
  [
    tom ? `TOM GERAL: ${tom}` : "",
    "",
    ...cenas.map((c) => {
      let fala = c.fala;
      for (const e of c.enfase) {
        fala = fala.replace(
          new RegExp(e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
          (m) => m.toUpperCase(),
        );
      }
      return `${fala}  (${[c.entonacao, RITMO[c.ritmo].replace(/^\S+ /, "")].filter(Boolean).join("; ")})${c.pausa_depois_s > 0 ? ` [pausa ${c.pausa_depois_s.toString().replace(".", ",")}s]` : ""}`;
    }),
  ]
    .join("\n")
    .trim();

export const GuiaDeGravacao: React.FC<{ uso: UsoPlano }> = ({ uso }) => {
  const { plano, gerarVoz, gerandoVoz } = uso;
  const [voz, setVoz] = useState<Voz>(
    (plano?.vozTeste?.voz as Voz | undefined) ?? "marin",
  );
  const [copiado, setCopiado] = useState(false);
  const [tocando, setTocando] = useState<number | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const g = plano?.gerado;
  if (!plano || !g || g.modo_audio !== "narracao") return null;

  const cenas = g.cenas.filter((c) => c.fala.trim());
  const tom = g.narracao?.orientacoes ?? "";
  const v = plano.vozTeste;
  const atualizada = v && v.doPlano === plano.geradoEm && v.voz === voz;
  const trechoDe = (cena: number) =>
    atualizada ? v.trechos.find((t) => t.cena === cena) : undefined;
  const segundos = Math.round(
    cenas.reduce((s, c) => s + c.fala.split(/\s+/).length / 2.6, 0),
  );

  const tocar = (cena: number) => {
    const t = trechoDe(cena);
    if (!t) return;
    audio.current?.pause();
    if (tocando === cena) {
      setTocando(null);
      return;
    }
    const a = new Audio(`/api/midia/${t.arquivo}`);
    a.onended = () => setTocando(null);
    void a.play();
    audio.current = a;
    setTocando(cena);
  };

  return (
    <section className="space-y-3 border-[3px] border-tinta p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-2xl leading-none uppercase">
          Roteiro para gravar
        </h3>
        <button
          onClick={() => {
            void navigator.clipboard
              .writeText(textoParaCopiar(cenas, tom))
              .then(() => {
                setCopiado(true);
                setTimeout(() => setCopiado(false), 1500);
              });
          }}
          className="ml-auto border-2 border-tinta px-2 py-0.5 font-mono text-[10px] uppercase hover:bg-tinta hover:text-papel"
        >
          {copiado ? "copiado!" : "copiar roteiro"}
        </button>
      </div>
      {tom ? (
        <p className="border-l-4 border-spray pl-2 text-sm">
          <b>Tom geral:</b> {tom}
        </p>
      ) : null}

      {/* Voz de exemplo */}
      <div className="flex flex-wrap items-center gap-2 bg-zinc-900 p-2">
        <span className="text-xs">🔊 Ouvir como falar:</span>
        <select
          value={voz}
          onChange={(e) => setVoz(e.target.value as Voz)}
          className="border-2 border-tinta bg-zinc-950 px-1 py-0.5 text-xs"
        >
          {Object.entries(VOZES).map(([id, nome]) => (
            <option key={id} value={id}>
              {nome}
            </option>
          ))}
        </select>
        <button
          onClick={() => void gerarVoz(voz)}
          disabled={gerandoVoz || !!atualizada}
          className="botao-spray !px-3 !py-1 !text-sm"
          title={`Lê o roteiro com voz sintética seguindo a entonação (≈ US$ ${Math.max(
            0.01,
            (segundos / 60) * 0.015,
          )
            .toFixed(2)
            .replace(".", ",")})`}
        >
          {gerandoVoz
            ? "Gerando a voz…"
            : atualizada
              ? "✓ Narração de exemplo pronta"
              : v
                ? "Gerar de novo"
                : "Gerar narração de exemplo"}
        </button>
        {v && !atualizada && !gerandoVoz ? (
          <span className="text-[11px] text-zinc-500">
            {v.doPlano !== plano.geradoEm
              ? "o roteiro mudou desde a última voz"
              : "voz diferente da gerada"}
          </span>
        ) : null}
        {atualizada ? (
          <audio
            src={`/api/midia/${v.arquivo}`}
            controls
            className="h-8 min-w-60 flex-1"
          />
        ) : null}
      </div>

      <ol className="space-y-2">
        {cenas.map((c) => (
          <li
            key={c.numero}
            className="flex gap-2 border-b border-zinc-800 pb-2"
          >
            <button
              onClick={() => tocar(c.numero)}
              disabled={!trechoDe(c.numero)}
              className="mt-0.5 h-7 w-7 shrink-0 border-2 border-tinta text-xs hover:bg-tinta hover:text-papel disabled:border-zinc-700 disabled:text-zinc-600 disabled:hover:bg-transparent"
              title={
                trechoDe(c.numero)
                  ? "Ouvir esta fala"
                  : "Gere a narração de exemplo para ouvir"
              }
            >
              {tocando === c.numero ? "■" : "▶"}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-base leading-snug">
                <span className="mr-1 font-mono text-[10px] text-zinc-500">
                  {c.numero}
                </span>
                <FalaComEnfase fala={c.fala} enfase={c.enfase} />
                {c.pausa_depois_s > 0 ? (
                  <span
                    className="ml-1 font-mono text-[11px] text-spray"
                    title="Pausa depois desta frase"
                  >
                    ‖ {c.pausa_depois_s.toString().replace(".", ",")}s
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-zinc-400">
                <span className="mr-2 font-mono">{RITMO[c.ritmo]}</span>
                {c.entonacao ? <i>{c.entonacao}</i> : null}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-zinc-500">
        Em vermelho: palavras para falar mais forte. ‖ = pausa. Grave a narração
        com o seu jeito, usando a voz de exemplo como referência de ritmo e
        entonação, e envie no item “Narração” lá embaixo.
      </p>
    </section>
  );
};
