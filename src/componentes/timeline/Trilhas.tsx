"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useProjeto } from "@/projeto/ProjetoProvider";
import { calcularClipes } from "@/timeline/calculos";
import {
  apararItem,
  atualizarItem,
  cortarTrecho,
  dividirClipe,
  dividirItemNoTempo,
  duplicarItem,
  Faixa,
  juntarItens,
  removerItem,
  urlsDeMusica,
} from "@/timeline/operacoes";
import { Timeline } from "@/timeline/schema";
import { Bloco, calcularBlocos, linhasDaTimeline } from "./blocos";

export type Selecao = { faixa: Faixa; indice: number } | null;

type Arrasto = {
  bloco: Bloco;
  // "mover" desloca o item inteiro; "inicio"/"fim" aparam uma ponta.
  modo: "mover" | "inicio" | "fim";
  xInicial: number;
  delta: number;
};

// Trecho marcado com I (entrada) e O (saída), como nos editores.
type Marcas = { entrada: number | null; saida: number | null };

const LARGURA_ROTULO = 150;
const ALTURA_FAIXA = 40;
const BORDA_APARAR = 8;
const MINIMO = 0.1;
// Distância (em px) em que o ímã puxa para o cursor, marcas e pontas.
const IMA_PX = 8;

const arredondar = (n: number) => Math.round(n * 100) / 100;

// Atalhos (também no painel "Atalhos").
const ATALHOS: [string, string][] = [
  ["Espaço", "tocar / pausar"],
  ["← →", "1 quadro (Shift: 1 s)"],
  ["Home / End", "começo / fim"],
  ["S", "dividir o item selecionado no cursor"],
  ["Q", "aparar o começo do item até o cursor"],
  ["W", "aparar o fim do item até o cursor"],
  ["J", "juntar com o pedaço seguinte (desfaz o dividir)"],
  ["Ctrl+D", "duplicar o item"],
  ["Delete", "apagar o item (deixa o espaço)"],
  ["Shift+Delete", "remover e fechar o buraco (em todas as trilhas)"],
  ["I / O", "marcar entrada / saída de um trecho"],
  ["Shift+Delete com trecho marcado", "tira o trecho do vídeo inteiro"],
  ["Esc", "limpar marcas e seleção"],
  ["Alt+← →", "empurrar o item 1 quadro (Shift: 10)"],
  ["Ctrl+Z / Ctrl+Y", "desfazer / refazer"],
];

export const Trilhas: React.FC<{
  segundoAtual: number;
  aoBuscar: (segundo: number) => void;
  selecao: Selecao;
  aoSelecionar: (s: Selecao) => void;
}> = ({ segundoAtual, aoBuscar, selecao, aoSelecionar }) => {
  const { projeto, aplicar } = useProjeto();
  const { timeline, biblioteca } = projeto;
  const [pxPorSegundo, setPxPorSegundo] = useState(80);
  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const [marcas, setMarcas] = useState<Marcas>({ entrada: null, saida: null });
  const [ima, setIma] = useState(true);
  const [verAtalhos, setVerAtalhos] = useState(false);

  const blocos = useMemo(
    () => calcularBlocos(timeline, biblioteca),
    [timeline, biblioteca],
  );

  const linhas = useMemo(
    () => linhasDaTimeline(timeline, blocos, biblioteca),
    [timeline, blocos, biblioteca],
  );

  const blocoSelecionado = selecao
    ? blocos[selecao.faixa].find((b) => b.indice === selecao.indice)
    : undefined;

  const total = Math.max(0, ...blocos.clipes.map((c) => c.fim));
  const fps = timeline.fps;

  // Mostra um erro na barra de avisos do app (mesmo caminho dos erros
  // das operações).
  const avisar = (mensagem: string) =>
    aplicar(() => {
      throw new Error(mensagem);
    });

  // Onde a cena "é dona" do tempo: depois da transição de entrada (que
  // pertence à cena anterior).
  const donoDaCena = (b: Bloco) =>
    b.inicio + calcularClipes(timeline)[b.indice].transicaoFrames / fps;

  const trechoMarcado =
    marcas.entrada !== null &&
    marcas.saida !== null &&
    marcas.saida - marcas.entrada > 0.02
      ? { de: marcas.entrada, ate: marcas.saida }
      : null;

  const ripple = (de: number, ate: number) =>
    aplicar((t) => cortarTrecho(t, de, ate, urlsDeMusica(t, biblioteca)));

  // ---------- Ferramentas ----------

  const dividirNoCursor = () => {
    const b = blocoSelecionado;
    if (!b) return avisar("Selecione um item para dividir.");
    const tempo = segundoAtual;
    if (tempo <= b.inicio + 0.05 || tempo >= b.fim - 0.05) {
      return avisar(
        "Ponha o cursor (linha vermelha) dentro do item para dividir.",
      );
    }
    const { faixa, indice, inicio } = b;
    if (faixa === "legendas") {
      return avisar("Legendas não se dividem; edite o texto no inspetor.");
    }
    const ok = aplicar((t) =>
      faixa === "clipes"
        ? dividirClipe(t, indice, tempo - inicio)
        : dividirItemNoTempo(t, faixa, indice, tempo),
    );
    // Fica selecionada a segunda parte (a que começa no cursor).
    if (ok) aoSelecionar({ faixa, indice: indice + 1 });
  };

  // Q / W: apara uma ponta do item até o cursor. Em cenas, o tempo sai do
  // vídeo inteiro (fecha o buraco em todas as trilhas, nada dessincroniza).
  const apararAteCursor = (ponta: "inicio" | "fim") => {
    const b = blocoSelecionado;
    if (!b) return avisar("Selecione um item para aparar.");
    const tempo = segundoAtual;
    if (tempo <= b.inicio + 0.05 || tempo >= b.fim - 0.05) {
      return avisar("Ponha o cursor (linha vermelha) dentro do item.");
    }
    const { faixa, indice } = b;
    if (faixa === "clipes") {
      const de = ponta === "inicio" ? donoDaCena(b) : tempo;
      const ate = ponta === "inicio" ? tempo : b.fim;
      if (ate - de < 0.02) return avisar("Nada para aparar aí.");
      ripple(de, ate);
      return;
    }
    aplicar((t) => apararItem(t, faixa, indice, ponta, tempo));
  };

  const juntar = () => {
    const b = blocoSelecionado;
    if (!b) return avisar("Selecione o primeiro dos dois pedaços.");
    const { faixa, indice } = b;
    aplicar((t) => juntarItens(t, faixa, indice));
  };

  const duplicar = () => {
    const b = blocoSelecionado;
    if (!b) return avisar("Selecione um item para duplicar.");
    const { faixa, indice } = b;
    if (aplicar((t) => duplicarItem(t, faixa, indice))) {
      aoSelecionar({ faixa, indice: indice + 1 });
    }
  };

  const apagar = () => {
    const b = blocoSelecionado;
    if (!b) return;
    const { faixa, indice } = b;
    if (aplicar((t) => removerItem(t, faixa, indice))) aoSelecionar(null);
  };

  // Shift+Delete: com trecho marcado (I/O), tira o trecho; senão, tira o
  // tempo do item selecionado. Sempre fechando o buraco em todas as faixas
  // (a música de fundo só termina mais cedo).
  const removerTrecho = () => {
    if (trechoMarcado) {
      if (ripple(trechoMarcado.de, trechoMarcado.ate)) {
        setMarcas({ entrada: null, saida: null });
        aoBuscar(trechoMarcado.de);
      }
      return;
    }
    const b = blocoSelecionado;
    if (!b) {
      return avisar(
        "Selecione um item ou marque um trecho com I (entrada) e O (saída).",
      );
    }
    const de = b.faixa === "clipes" ? donoDaCena(b) : b.inicio;
    if (
      b.fim - de > total * 0.5 &&
      !window.confirm(
        `Isso tira ${(b.fim - de).toFixed(1)}s do vídeo (mais da metade). Continuar?`,
      )
    ) {
      return;
    }
    if (ripple(de, b.fim)) aoSelecionar(null);
  };

  const marcar = (qual: "entrada" | "saida") =>
    setMarcas((m) => {
      const novo = { ...m, [qual]: arredondar(segundoAtual) };
      // Entrada depois da saída: a outra marca sai.
      if (
        novo.entrada !== null &&
        novo.saida !== null &&
        novo.saida <= novo.entrada
      ) {
        return qual === "entrada"
          ? { entrada: novo.entrada, saida: null }
          : { entrada: null, saida: novo.saida };
      }
      return novo;
    });

  // Empurra o item selecionado (não as cenas, que são em sequência).
  const empurrar = (quadros: number) => {
    const b = blocoSelecionado;
    if (!b || b.faixa === "clipes") return;
    const d = quadros / fps;
    const { faixa, indice } = b;
    const inicio = Math.max(0, b.inicio + d);
    aplicar((t: Timeline) =>
      atualizarItem(t, faixa, indice, {
        inicio: arredondar(inicio),
        fim: arredondar(inicio + (b.fim - b.inicio)),
      }),
    );
  };

  // Teclado (fora de campos de texto). Delete sozinho fica na página.
  const teclas = useRef<(e: KeyboardEvent) => void>(() => {});
  teclas.current = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input, textarea, select")) return;
    const k = e.key;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && k.toLowerCase() === "d") {
      e.preventDefault();
      duplicar();
      return;
    }
    if (ctrl) return;
    if (e.altKey && (k === "ArrowLeft" || k === "ArrowRight")) {
      e.preventDefault();
      empurrar((k === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 10 : 1));
      return;
    }
    if (e.altKey) return;
    const acao: Record<string, () => void> = {
      s: dividirNoCursor,
      q: () => apararAteCursor("inicio"),
      w: () => apararAteCursor("fim"),
      j: juntar,
      i: () => marcar("entrada"),
      o: () => marcar("saida"),
    };
    if (!e.shiftKey && acao[k.toLowerCase()]) {
      e.preventDefault();
      acao[k.toLowerCase()]();
    } else if (e.shiftKey && (k === "Delete" || k === "Backspace")) {
      e.preventDefault();
      removerTrecho();
    } else if (k === "Escape") {
      setMarcas({ entrada: null, saida: null });
      aoSelecionar(null);
    } else if (k === "ArrowLeft" || k === "ArrowRight") {
      e.preventDefault();
      const passo = e.shiftKey ? 1 : 1 / fps;
      aoBuscar(
        Math.max(
          0,
          Math.min(total, segundoAtual + (k === "ArrowLeft" ? -passo : passo)),
        ),
      );
    } else if (k === "Home") {
      e.preventDefault();
      aoBuscar(0);
    } else if (k === "End") {
      e.preventDefault();
      aoBuscar(Math.max(0, total - 1 / fps));
    }
  };
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => teclas.current(e);
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  const duracaoVisivel =
    Math.max(
      5,
      ...Object.values(blocos)
        .flat()
        .map((b) => b.fim),
    ) + 2;

  // ---------- Arrastar (com ímã) ----------

  // Pontos onde o ímã gruda: cursor, marcas e pontas dos outros itens.
  const pontosDoIma = (exceto: Bloco) => [
    segundoAtual,
    ...(marcas.entrada !== null ? [marcas.entrada] : []),
    ...(marcas.saida !== null ? [marcas.saida] : []),
    ...Object.values(blocos)
      .flat()
      .filter((b) => !(b.faixa === exceto.faixa && b.indice === exceto.indice))
      .flatMap((b) => [b.inicio, b.fim]),
  ];

  const comIma = (a: Arrasto, delta: number) => {
    if (!ima) return delta;
    const limite = IMA_PX / pxPorSegundo;
    const pontas =
      a.modo === "mover"
        ? [a.bloco.inicio, a.bloco.fim]
        : [a.modo === "inicio" ? a.bloco.inicio : a.bloco.fim];
    let melhor: number | null = null;
    for (const ponto of pontosDoIma(a.bloco)) {
      for (const p of pontas) {
        const ajuste = ponto - (p + delta);
        if (
          Math.abs(ajuste) <= limite &&
          (melhor === null || Math.abs(ajuste) < Math.abs(melhor))
        ) {
          melhor = ajuste;
        }
      }
    }
    return melhor === null ? delta : delta + melhor;
  };

  // Aplica o arrasto na timeline quando o mouse é solto.
  const concluirArrasto = (a: Arrasto) => {
    const { bloco, modo, delta } = a;
    if (Math.abs(delta) < 0.01) return;
    const { faixa, indice } = bloco;

    if (faixa === "clipes") {
      // Em clipes, as pontas aparam o trecho do vídeo de origem.
      const clipe = timeline.clipes[indice];
      // O arrasto é em tempo do vídeo final; no arquivo, conta a velocidade.
      const passo = delta * (clipe.velocidade ?? 1);
      const duracaoOrigem =
        biblioteca.find((m) => m.url === clipe.url)?.duracao ?? Infinity;
      const mudancas =
        modo === "inicio"
          ? {
              inicio: arredondar(
                Math.min(Math.max(0, clipe.inicio + passo), clipe.fim - MINIMO),
              ),
            }
          : {
              fim: arredondar(
                Math.max(
                  Math.min(duracaoOrigem, clipe.fim + passo),
                  clipe.inicio + MINIMO,
                ),
              ),
            };
      aplicar((t) => atualizarItem(t, "clipes", indice, mudancas));
      return;
    }

    const { inicio, fim } = bloco;
    if (modo === "mover") {
      const novo = arredondar(Math.max(0, inicio + delta));
      aplicar((t) =>
        atualizarItem(t, faixa, indice, {
          inicio: novo,
          fim: arredondar(novo + (fim - inicio)),
        }),
      );
      return;
    }
    // Aparar a ponta: o conteúdo fica no lugar (o começo de um áudio anda
    // no arquivo junto, sem "escorregar" a fala).
    const tempo =
      modo === "inicio"
        ? Math.min(Math.max(0, inicio + delta), fim - MINIMO)
        : Math.max(fim + delta, inicio + MINIMO);
    aplicar((t) => apararItem(t, faixa, indice, modo, arredondar(tempo)));
  };

  useEffect(() => {
    if (!arrasto) return;
    const mover = (e: PointerEvent) =>
      setArrasto((a) =>
        a
          ? {
              ...a,
              delta: e.altKey
                ? (e.clientX - a.xInicial) / pxPorSegundo
                : comIma(a, (e.clientX - a.xInicial) / pxPorSegundo),
            }
          : a,
      );
    const soltar = () => {
      concluirArrasto(arrasto);
      setArrasto(null);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    return () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
    };
  });

  // Posição exibida durante o arrasto (antes de aplicar).
  const posicaoVisual = (b: Bloco) => {
    if (
      !arrasto ||
      arrasto.bloco.faixa !== b.faixa ||
      arrasto.bloco.indice !== b.indice
    ) {
      return b;
    }
    const d = arrasto.delta;
    if (arrasto.modo === "mover") {
      const inicio = Math.max(0, b.inicio + d);
      return { ...b, inicio, fim: inicio + (b.fim - b.inicio) };
    }
    if (arrasto.modo === "inicio") {
      return { ...b, inicio: Math.min(b.inicio + d, b.fim - MINIMO) };
    }
    return { ...b, fim: Math.max(b.fim + d, b.inicio + MINIMO) };
  };

  const iniciarArrasto = (e: React.PointerEvent, b: Bloco) => {
    e.stopPropagation();
    aoSelecionar({ faixa: b.faixa, indice: b.indice });
    const ret = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - ret.left;
    const modo: Arrasto["modo"] =
      x < BORDA_APARAR
        ? "inicio"
        : x > ret.width - BORDA_APARAR
          ? "fim"
          : "mover";
    // Clipes não se movem arrastando (a ordem muda pelo inspetor).
    if (b.faixa === "clipes" && modo === "mover") return;
    setArrasto({ bloco: b, modo, xInicial: e.clientX, delta: 0 });
  };

  const largura = duracaoVisivel * pxPorSegundo;
  const passoRegua = pxPorSegundo >= 60 ? 1 : pxPorSegundo >= 25 ? 2 : 5;

  const buscarPeloMouse = (e: React.PointerEvent<HTMLDivElement>) => {
    const ret = e.currentTarget.getBoundingClientRect();
    aoBuscar(Math.max(0, (e.clientX - ret.left) / pxPorSegundo));
  };

  const temSelecao = !!blocoSelecionado;
  const botao =
    "border border-zinc-600 px-1.5 py-0.5 whitespace-nowrap text-zinc-200 hover:border-white disabled:opacity-40";
  const ferramentas: {
    rotulo: string;
    titulo: string;
    acao: () => void;
    ativo: boolean;
  }[] = [
    {
      rotulo: "✂ Dividir (S)",
      titulo: "Divide o item selecionado no cursor (linha vermelha)",
      acao: dividirNoCursor,
      ativo: temSelecao,
    },
    {
      rotulo: "⇤ Aparar (Q)",
      titulo:
        "Apara o começo do item até o cursor. Em cenas, tira esse tempo do vídeo inteiro (tudo anda junto)",
      acao: () => apararAteCursor("inicio"),
      ativo: temSelecao,
    },
    {
      rotulo: "Aparar ⇥ (W)",
      titulo:
        "Apara o fim do item a partir do cursor. Em cenas, tira esse tempo do vídeo inteiro (tudo anda junto)",
      acao: () => apararAteCursor("fim"),
      ativo: temSelecao,
    },
    {
      rotulo: "⊕ Juntar (J)",
      titulo:
        "Junta o item com o pedaço seguinte do mesmo arquivo (desfaz o dividir)",
      acao: juntar,
      ativo: temSelecao,
    },
    {
      rotulo: "⧉ Duplicar (Ctrl+D)",
      titulo: "Cria uma cópia logo depois do item",
      acao: duplicar,
      ativo: temSelecao,
    },
    {
      rotulo: "🗑 Apagar (Del)",
      titulo: "Apaga o item e deixa o espaço vazio",
      acao: apagar,
      ativo: temSelecao,
    },
    {
      rotulo: trechoMarcado
        ? "⟷ Tirar trecho marcado (Shift+Del)"
        : "⟷ Remover e fechar (Shift+Del)",
      titulo: trechoMarcado
        ? "Tira o trecho marcado (I/O) do vídeo inteiro e puxa o resto para trás"
        : "Tira o tempo do item selecionado do vídeo inteiro e puxa o resto para trás, em todas as trilhas",
      acao: removerTrecho,
      ativo: temSelecao || !!trechoMarcado,
    },
  ];

  const xDe = (s: number) => s * pxPorSegundo;

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-zinc-800 px-3 py-1.5 text-xs text-zinc-400">
        {ferramentas.map((f) => (
          <button
            key={f.rotulo}
            type="button"
            onClick={f.acao}
            disabled={!f.ativo}
            className={botao}
            title={f.titulo}
          >
            {f.rotulo}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-zinc-700" />
        <button
          type="button"
          onClick={() => marcar("entrada")}
          className={botao}
          title="Marca o começo de um trecho no cursor (tecla I)"
        >
          [ Entrada (I)
        </button>
        <button
          type="button"
          onClick={() => marcar("saida")}
          className={botao}
          title="Marca o fim de um trecho no cursor (tecla O)"
        >
          Saída (O) ]
        </button>
        {marcas.entrada !== null || marcas.saida !== null ? (
          <button
            type="button"
            onClick={() => setMarcas({ entrada: null, saida: null })}
            className={botao}
            title="Limpa as marcas (Esc)"
          >
            {trechoMarcado
              ? `${trechoMarcado.de.toFixed(2)}–${trechoMarcado.ate.toFixed(2)}s ✕`
              : "Limpar ✕"}
          </button>
        ) : null}
        <span className="mx-1 h-4 w-px bg-zinc-700" />
        <button
          type="button"
          onClick={() => setIma((v) => !v)}
          className={`${botao} ${ima ? "border-spray text-spray" : "line-through"}`}
          title="Ímã: ao arrastar, gruda no cursor, nas marcas e nas pontas dos outros itens (segure Alt para soltar)"
        >
          🧲 Ímã {ima ? "ligado" : "desligado"}
        </button>
        <button
          type="button"
          onClick={() => setVerAtalhos((v) => !v)}
          className={botao}
          title="Lista de atalhos"
        >
          ? Atalhos
        </button>
        <label className="ml-auto flex shrink-0 items-center gap-2">
          Zoom
          <input
            type="range"
            min={10}
            max={200}
            value={pxPorSegundo}
            onChange={(e) => setPxPorSegundo(Number(e.target.value))}
            className="accent-violet-500"
          />
        </label>
      </div>

      {verAtalhos ? (
        <div className="absolute top-10 bottom-1 left-3 z-40 overflow-y-auto border-2 border-tinta bg-papel p-3 text-xs shadow-[4px_4px_0_var(--color-tinta)]">
          <p className="rotulo-zine mb-1">Atalhos da Timeline</p>
          <table>
            <tbody>
              {ATALHOS.map(([tecla, faz]) => (
                <tr key={tecla}>
                  <td className="pr-3 font-mono whitespace-nowrap">{tecla}</td>
                  <td>{faz}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-zinc-500">
            Arraste as pontas para aparar e o meio para mover.
          </p>
        </div>
      ) : null}

      <div
        className="relative min-h-0 flex-1 overflow-auto select-none"
        onPointerDown={() => aoSelecionar(null)}
      >
        <div
          className="relative"
          style={{ width: largura + LARGURA_ROTULO, minHeight: "100%" }}
        >
          {/* Régua: clicar/arrastar move o cursor de reprodução. */}
          <div className="sticky top-0 z-20 flex h-6 bg-zinc-900">
            <div
              className="sticky left-0 z-30 shrink-0 bg-zinc-900"
              style={{ width: LARGURA_ROTULO }}
            />
            <div
              className="relative flex-1 cursor-pointer border-b border-zinc-800"
              onPointerDown={(e) => {
                e.stopPropagation();
                buscarPeloMouse(e);
              }}
              onPointerMove={(e) => {
                if (e.buttons === 1) buscarPeloMouse(e);
              }}
            >
              {Array.from(
                { length: Math.ceil(duracaoVisivel / passoRegua) },
                (_, i) => i * passoRegua,
              ).map((s) => (
                <span
                  key={s}
                  className="absolute top-0 h-full border-l border-zinc-700 pl-1 text-[10px] leading-6 text-zinc-500"
                  style={{ left: xDe(s) }}
                >
                  {s}s
                </span>
              ))}
              {[marcas.entrada, marcas.saida].map((m, i) =>
                m === null ? null : (
                  <span
                    key={i}
                    className="pointer-events-none absolute top-0 h-full font-mono text-[11px] font-bold text-sky-500"
                    style={{ left: xDe(m) - (i === 0 ? 0 : 6) }}
                  >
                    {i === 0 ? "[" : "]"}
                  </span>
                ),
              )}
            </div>
          </div>

          {linhas.map(({ chave, faixa, rotulo, cor, blocos: daLinha }) => (
            <div
              key={chave}
              className="flex border-b border-zinc-800/70"
              style={{ height: ALTURA_FAIXA }}
            >
              <div
                className="sticky left-0 z-30 flex shrink-0 items-center truncate bg-zinc-900 px-3 text-xs text-zinc-400"
                style={{ width: LARGURA_ROTULO }}
                title={rotulo}
              >
                {rotulo}
              </div>
              <div className="relative flex-1">
                {daLinha.map((original) => {
                  const b = posicaoVisual(original);
                  const selecionado =
                    selecao?.faixa === faixa && selecao.indice === b.indice;
                  return (
                    <div
                      key={b.indice}
                      onPointerDown={(e) => iniciarArrasto(e, original)}
                      className={`absolute top-1 bottom-1 flex items-center overflow-hidden border px-2 text-xs text-white ${cor} ${
                        selecionado
                          ? "z-10 ring-2 ring-white"
                          : "border-transparent opacity-90"
                      } ${faixa === "clipes" ? "cursor-pointer" : "cursor-grab"}`}
                      style={{
                        left: xDe(b.inicio),
                        width: Math.max(4, (b.fim - b.inicio) * pxPorSegundo),
                      }}
                      title={b.rotulo}
                    >
                      {/* Alças das pontas (aparar). */}
                      <span className="absolute inset-y-0 left-0 w-2 cursor-ew-resize hover:bg-white/30" />
                      <span className="absolute inset-y-0 right-0 w-2 cursor-ew-resize hover:bg-white/30" />
                      <span className="truncate">{b.rotulo}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Trecho marcado (I/O). */}
          {trechoMarcado ? (
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-20 border-x border-sky-500 bg-sky-500/15"
              style={{
                left: LARGURA_ROTULO + xDe(trechoMarcado.de),
                width: xDe(trechoMarcado.ate - trechoMarcado.de),
              }}
            />
          ) : null}

          {/* Cursor de reprodução. */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-red-500"
            style={{ left: LARGURA_ROTULO + xDe(segundoAtual) }}
          />
        </div>
      </div>
    </div>
  );
};
