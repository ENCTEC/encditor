"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type {
  Acao,
  Elemento,
  ItemLateral,
  Quadro,
  Tela,
} from "@/conexoes/demosMeta";

// Desenho animado "onde clicar" de um passo do tutorial da Meta (/conectar):
// mostra a tela simplificada, leva o cursor até o alvo e clica (ou digita,
// marca, aponta). Toca sozinho em ciclo; dá para pausar e andar quadro a
// quadro. Os quadros vêm de src/conexoes/demosMeta.ts.

const TEMPO = {
  mover: 900,
  moverRapido: 500,
  segurar: 1300,
  segurarRapido: 450,
  // ver/conferir/evitar: tempo para ler a legenda
  apontar: 2600,
  letra: 60,
  fimDoCiclo: 2000,
};

type Contexto = {
  alvo?: string;
  acao?: Acao;
  // 0 = indo até o alvo; 1 = clicou (ou está digitando)
  fase: 0 | 1;
  digitado: string;
  trocar: (s: string) => string;
};

const CLICA: Acao[] = ["clicar", "marcar", "escolher"];
const clicado = (c: Contexto, id?: string) =>
  !!id && id === c.alvo && c.fase === 1 && !!c.acao && CLICA.includes(c.acao);

const destaque = (c: Contexto, id?: string) => {
  if (!id || id !== c.alvo) return "";
  if (c.acao === "conferir")
    return "outline outline-2 outline-offset-2 outline-verde";
  if (c.acao === "evitar")
    return "outline outline-2 outline-dashed outline-offset-2 outline-spray";
  return `outline outline-2 outline-offset-2 outline-spray ${c.fase === 0 ? "demo-pulsa" : ""}`;
};

const En: React.FC<{ en?: string; claro?: boolean }> = ({ en, claro }) =>
  en ? (
    <span
      className={`ml-1 text-[9px] font-normal ${claro ? "opacity-70" : "text-zinc-500"}`}
    >
      ({en})
    </span>
  ) : null;

const Elem: React.FC<{ e: Elemento; c: Contexto }> = ({ e, c }) => {
  const t = c.trocar;
  const d = destaque(c, e.id);
  const alvo = e.id ? { "data-alvo": e.id } : {};
  switch (e.tipo) {
    case "titulo":
      return (
        <p className="text-[14px] leading-tight font-bold">
          {t(e.texto ?? "")}
        </p>
      );
    case "texto":
      return (
        <p className="text-[11px] leading-snug text-zinc-500">
          {t(e.texto ?? "")}
        </p>
      );
    case "aviso":
      return (
        <p
          {...alvo}
          className={`border-l-4 border-amber-400 bg-amber-400/10 p-1.5 text-[10px] leading-snug ${d}`}
        >
          ⓘ {t(e.texto ?? "")}
        </p>
      );
    case "botao":
    case "principal": {
      const cheio = e.tipo === "principal" || e.marcado;
      return (
        <span
          {...alvo}
          className={`inline-flex items-center rounded-[3px] px-2 py-1 text-[11px] font-semibold whitespace-nowrap transition-transform ${
            cheio ? "bg-tinta text-papel" : "border border-zinc-600 bg-white"
          } ${clicado(c, e.id) ? "scale-95" : ""} ${d}`}
        >
          {t(e.texto ?? "")}
          <En en={e.en} claro={cheio} />
        </span>
      );
    }
    case "campo": {
      const noAlvo = e.id === c.alvo;
      const digitando = noAlvo && c.acao === "digitar";
      const escolheu = noAlvo && c.acao === "escolher" && c.fase === 1;
      const valor = digitando || escolheu ? c.digitado : t(e.valor ?? "");
      return (
        <div className="space-y-0.5">
          <p className="text-[10px] font-semibold text-zinc-500">
            {t(e.texto ?? "")}
          </p>
          <div
            {...alvo}
            className={`h-6 truncate rounded-[3px] border border-zinc-600 bg-white px-2 py-0.5 text-[11px] ${d}`}
          >
            {valor}
            {digitando && c.fase === 1 ? (
              <span className="demo-caret">|</span>
            ) : null}
          </div>
        </div>
      );
    }
    case "opcao":
    case "check": {
      const marcado = e.marcado || clicado(c, e.id);
      const redondo = e.tipo === "opcao";
      return (
        <div
          {...alvo}
          className={`flex items-start gap-1.5 rounded-[3px] px-1 py-0.5 text-[11px] ${d}`}
        >
          <span
            className={`mt-[2px] flex h-3 w-3 shrink-0 items-center justify-center border border-tinta ${
              redondo ? "rounded-full" : ""
            } ${marcado ? "bg-tinta" : "bg-white"}`}
          >
            {marcado ? (
              redondo ? (
                <span className="block h-1 w-1 rounded-full bg-white" />
              ) : (
                <span className="text-[8px] leading-none text-white">✓</span>
              )
            ) : null}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="font-semibold">{t(e.texto ?? "")}</span>
            <En en={e.en} />
            {e.valor ? (
              <span className="block text-[9px] text-zinc-500">
                {t(e.valor)}
              </span>
            ) : null}
          </span>
        </div>
      );
    }
    case "linha":
      return (
        <div
          {...(e.botao ? {} : alvo)}
          className={`flex items-center gap-2 border-b border-zinc-800 px-1 py-1 text-[11px] ${
            e.botao ? "" : d
          } ${!e.botao && clicado(c, e.id) ? "bg-zinc-900" : ""}`}
        >
          <span className="min-w-0 flex-1 truncate">
            <span className="font-semibold">{t(e.texto ?? "")}</span>
            <En en={e.en} />
          </span>
          {e.valor ? (
            <span className="shrink-0 text-[10px] text-zinc-500">
              {t(e.valor)}
            </span>
          ) : null}
          {e.botao ? (
            <span
              {...alvo}
              className={`shrink-0 rounded-[3px] border border-zinc-600 bg-white px-1.5 py-0.5 text-[10px] font-semibold transition-transform ${
                clicado(c, e.id) ? "scale-95" : ""
              } ${d}`}
            >
              {t(e.botao)}
            </span>
          ) : null}
        </div>
      );
    case "fila":
      return (
        <div
          className={`flex flex-wrap items-center gap-1.5 ${e.espaco ? "justify-between" : ""}`}
        >
          {e.itens?.map((x, i) => (
            <Elem key={i} e={x} c={c} />
          ))}
        </div>
      );
    case "grade":
      return (
        <div className="grid grid-cols-2 gap-x-2">
          {e.itens?.map((x, i) => (
            <Elem key={i} e={x} c={c} />
          ))}
        </div>
      );
    case "chave":
      return (
        <p
          {...alvo}
          className={`truncate border border-zinc-600 bg-zinc-900 px-2 py-1 font-mono text-[11px] ${d}`}
        >
          {t(e.texto ?? "")}
        </p>
      );
    case "fotos":
      return (
        <div className="grid grid-cols-3 gap-0.5">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="aspect-square bg-zinc-800" />
          ))}
        </div>
      );
  }
};

const Corpo: React.FC<{ itens: Elemento[]; c: Contexto }> = ({ itens, c }) => (
  <>
    {itens.map((e, i) => (
      <Elem key={i} e={e} c={c} />
    ))}
  </>
);

const Lateral: React.FC<{
  itens: ItemLateral[];
  ativo?: string;
  c: Contexto;
}> = ({ itens, ativo, c }) => (
  <nav className="w-[150px] shrink-0 space-y-px overflow-hidden border-r border-zinc-800 bg-zinc-900/60 p-1.5">
    {itens.map((it, i) =>
      it.grupo ? (
        <p
          key={i}
          className="px-1.5 pt-1.5 text-[9px] font-bold tracking-wide text-zinc-500 uppercase"
        >
          {c.trocar(it.texto)}
        </p>
      ) : (
        <p
          key={i}
          data-alvo={it.id}
          className={`rounded-[3px] px-1.5 py-1 text-[11px] leading-tight ${
            it.id === ativo ? "bg-white font-bold" : ""
          } ${clicado(c, it.id) ? "bg-white" : ""} ${destaque(c, it.id)}`}
        >
          {c.trocar(it.texto)}
          {it.en ? (
            <span className="block text-[8.5px] text-zinc-500">{it.en}</span>
          ) : null}
        </p>
      ),
    )}
  </nav>
);

const Janela: React.FC<{
  janela: NonNullable<Tela["janela"]>;
  c: Contexto;
}> = ({ janela, c }) => (
  <div className="absolute inset-0 z-10 flex items-center justify-center bg-tinta/35 p-3">
    <div
      key={janela.titulo}
      className="demo-janela max-h-full w-[80%] space-y-1.5 overflow-hidden rounded-[4px] border-2 border-tinta bg-white p-3 shadow-[4px_4px_0_#111110]"
    >
      <p className="border-b border-zinc-800 pb-1 text-[13px] font-bold">
        {c.trocar(janela.titulo)}
      </p>
      <Corpo itens={janela.corpo} c={c} />
    </div>
  </div>
);

const Navegador: React.FC<{ tela: Tela; c: Contexto }> = ({ tela, c }) => (
  <div className="flex h-full flex-col bg-white">
    <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-2 py-1">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2 w-2 rounded-full bg-zinc-800" />
        ))}
      </span>
      <span className="min-w-0 flex-1 truncate rounded-full bg-white px-3 py-0.5 font-mono text-[10px] text-zinc-600">
        🔒 {c.trocar(tela.endereco ?? "")}
      </span>
    </div>
    {tela.topo ? (
      <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-1.5">
        <span
          data-alvo="topo"
          className={`truncate text-[12px] font-bold ${destaque(c, "topo")}`}
        >
          {c.trocar(tela.topo)}
        </span>
        <span className="ml-auto flex shrink-0 gap-1.5">
          {tela.topoBotoes ? <Corpo itens={tela.topoBotoes} c={c} /> : null}
        </span>
      </div>
    ) : null}
    <div className="flex min-h-0 flex-1">
      {tela.lateral ? (
        <Lateral itens={tela.lateral} ativo={tela.ativo} c={c} />
      ) : null}
      <div className="min-w-0 flex-1 space-y-1.5 overflow-hidden p-3">
        <Corpo itens={tela.corpo} c={c} />
      </div>
    </div>
  </div>
);

const Celular: React.FC<{ tela: Tela; c: Contexto }> = ({ tela, c }) => (
  <div className="flex h-full items-center justify-center">
    <div className="flex h-[92%] w-[210px] flex-col overflow-hidden rounded-[22px] border-[3px] border-tinta bg-white">
      <div className="flex justify-between px-4 pt-1 font-mono text-[8px] text-zinc-500">
        <span>9:41</span>
        <span>●●●</span>
      </div>
      <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-1.5">
        <span className="truncate text-[12px] font-bold">
          {c.trocar(tela.topo ?? "")}
        </span>
        <span className="ml-auto flex shrink-0 gap-1">
          {tela.topoBotoes ? <Corpo itens={tela.topoBotoes} c={c} /> : null}
        </span>
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-hidden p-2.5">
        <Corpo itens={tela.corpo} c={c} />
      </div>
    </div>
  </div>
);

export const DemoAnimada: React.FC<{
  quadros: Quadro[];
  // Valores dos marcadores ({marca}, {nomeApp}, {appId}).
  valores: Record<string, string>;
  // Pedido de mostrar uma ação da lista (o `vez` muda a cada clique).
  pedido?: { item: number; vez: number } | null;
  aoMudarItem?: (item: number | null) => void;
}> = ({ quadros, valores, pedido, aoMudarItem }) => {
  const [reduzido] = useState(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  const [i, setI] = useState(0);
  const [ciclo, setCiclo] = useState(0);
  const [tocando, setTocando] = useState(!reduzido);
  const [fase, setFase] = useState<0 | 1>(0);
  const [digitado, setDigitado] = useState("");
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [semTransicao, setSemTransicao] = useState(true);
  const palco = useRef<HTMLDivElement>(null);

  const trocar = useCallback(
    (s: string) => s.replace(/\{(\w+)\}/g, (m, k: string) => valores[k] ?? m),
    [valores],
  );
  const q = quadros[Math.min(i, quadros.length - 1)];
  const rapido = !!q.rapido;
  const tempoMover = reduzido ? 0 : rapido ? TEMPO.moverRapido : TEMPO.mover;

  // Leva o cursor até o alvo do quadro (no começo do ciclo, sai do canto).
  useLayoutEffect(() => {
    const p = palco.current;
    if (!p) return;
    const el = q.alvo
      ? p.querySelector<HTMLElement>(`[data-alvo="${CSS.escape(q.alvo)}"]`)
      : null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const base = p.getBoundingClientRect();
    const destino = {
      x: r.left - base.left + Math.min(r.width * 0.5, 48),
      y: r.top - base.top + r.height * 0.6,
    };
    if (i !== 0) {
      setSemTransicao(false);
      setPos(destino);
      return;
    }
    setSemTransicao(true);
    setPos({ x: p.clientWidth - 36, y: p.clientHeight - 36 });
    const t = window.setTimeout(() => {
      setSemTransicao(false);
      setPos(destino);
    }, 60);
    return () => window.clearTimeout(t);
  }, [i, ciclo, q]);

  // Linha do tempo do quadro: chega → clica (ou digita) → segura → próximo.
  useEffect(() => {
    const timers: number[] = [];
    const em = (ms: number, f: () => void) =>
      timers.push(window.setTimeout(f, ms));
    setFase(0);
    setDigitado("");
    const chegada = (q.alvo ? tempoMover : 0) + (i === 0 ? 60 : 0) + 80;
    em(chegada, () => setFase(1));
    let fim = chegada;
    const texto = q.digitar ? trocar(q.digitar) : "";
    if (q.acao === "digitar") {
      for (let k = 1; k <= texto.length; k++) {
        em(chegada + k * TEMPO.letra, () => setDigitado(texto.slice(0, k)));
      }
      fim += texto.length * TEMPO.letra;
    } else if (q.acao === "escolher") {
      em(chegada, () => setDigitado(texto));
    }
    fim +=
      q.acao === "ver" || q.acao === "conferir" || q.acao === "evitar"
        ? TEMPO.apontar
        : rapido
          ? TEMPO.segurarRapido
          : TEMPO.segurar;
    if (tocando) {
      if (i + 1 < quadros.length) {
        em(fim, () => setI(i + 1));
      } else {
        em(fim + TEMPO.fimDoCiclo, () => {
          setI(0);
          setCiclo((x) => x + 1);
        });
      }
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [i, ciclo, tocando, q, quadros.length, trocar, tempoMover, rapido]);

  useEffect(() => {
    aoMudarItem?.(q.item ?? null);
  }, [q, aoMudarItem]);

  // Clique numa ação da lista: pula para o primeiro quadro dela.
  useEffect(() => {
    if (!pedido) return;
    const k = quadros.findIndex((x) => x.item === pedido.item);
    if (k < 0) return;
    setI(k);
    setCiclo((x) => x + 1);
    setTocando(true);
  }, [pedido, quadros]);

  const ir = (k: number) => {
    setTocando(false);
    setI((k + quadros.length) % quadros.length);
    setCiclo((x) => x + 1);
  };

  const c: Contexto = { alvo: q.alvo, acao: q.acao, fase, digitado, trocar };
  const clicou = fase === 1 && !!q.acao && CLICA.includes(q.acao);

  return (
    <div className="space-y-0">
      <div
        ref={palco}
        aria-hidden
        className="relative h-[360px] overflow-hidden border-2 border-tinta bg-zinc-900 select-none"
      >
        {q.tela.tipo === "celular" ? (
          <Celular tela={q.tela} c={c} />
        ) : (
          <Navegador tela={q.tela} c={c} />
        )}
        {q.tela.janela ? <Janela janela={q.tela.janela} c={c} /> : null}
        {q.alvo ? (
          <div
            className="pointer-events-none absolute top-0 left-0 z-20"
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px)`,
              transition:
                semTransicao || reduzido
                  ? "none"
                  : `transform ${tempoMover}ms cubic-bezier(.45,0,.2,1)`,
            }}
          >
            {clicou ? (
              <span
                key={`${ciclo}-${i}`}
                className="demo-clique absolute -top-3.5 -left-3.5 h-8 w-8 rounded-full border-[3px] border-spray"
              />
            ) : null}
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              className="-translate-x-[3px] -translate-y-[2px] drop-shadow"
            >
              <path
                d="M3 2l7 19 2.6-7.6L20 11z"
                fill="#111110"
                stroke="#fff"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            {fase === 1 && q.acao === "evitar" ? (
              <span className="absolute top-5 left-4 bg-spray px-1.5 py-0.5 font-mono text-[10px] font-bold whitespace-nowrap text-papel uppercase">
                ⊘ não clique
              </span>
            ) : null}
            {fase === 1 && q.acao === "conferir" ? (
              <span className="absolute top-5 left-4 bg-verde px-1.5 py-0.5 font-mono text-[10px] font-bold whitespace-nowrap text-papel uppercase">
                ✓ deu certo
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex items-start gap-2 border-2 border-t-0 border-tinta bg-papel p-2">
        <span className="shrink-0 bg-spray px-1.5 py-0.5 font-mono text-[11px] font-bold text-papel">
          {i + 1}/{quadros.length}
        </span>
        <p className="min-w-0 flex-1 text-sm leading-snug" aria-live="polite">
          {trocar(q.legenda)}
        </p>
        <div className="flex shrink-0 gap-1">
          {[
            { rotulo: "◀", titulo: "Quadro anterior", f: () => ir(i - 1) },
            {
              rotulo: tocando ? "❚❚" : "▶",
              titulo: tocando ? "Pausar" : "Tocar",
              f: () => setTocando((x) => !x),
            },
            { rotulo: "▶|", titulo: "Próximo quadro", f: () => ir(i + 1) },
          ].map((b) => (
            <button
              key={b.titulo}
              type="button"
              title={b.titulo}
              onClick={b.f}
              className="border-2 border-tinta px-2 py-0.5 font-mono text-[11px] hover:bg-tinta hover:text-papel"
            >
              {b.rotulo}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
