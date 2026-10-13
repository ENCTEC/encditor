"use client";

import { useEffect, useMemo, useState } from "react";
import { useProjeto } from "@/projeto/ProjetoProvider";
import { atualizarItem, Faixa } from "@/timeline/operacoes";
import { Bloco, calcularBlocos, FAIXAS_VISUAIS } from "./blocos";

export type Selecao = { faixa: Faixa; indice: number } | null;

type Arrasto = {
  bloco: Bloco;
  // "mover" desloca o item inteiro; "inicio"/"fim" aparam uma ponta.
  modo: "mover" | "inicio" | "fim";
  xInicial: number;
  delta: number;
};

const LARGURA_ROTULO = 96;
const ALTURA_FAIXA = 40;
const BORDA_APARAR = 8;
const MINIMO = 0.1;

const arredondar = (n: number) => Math.round(n * 100) / 100;

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

  const blocos = useMemo(
    () => calcularBlocos(timeline, biblioteca),
    [timeline, biblioteca],
  );

  const duracaoVisivel =
    Math.max(
      5,
      ...Object.values(blocos)
        .flat()
        .map((b) => b.fim),
    ) + 2;

  // Aplica o arrasto na timeline quando o mouse é solto.
  const concluirArrasto = (a: Arrasto) => {
    const { bloco, modo, delta } = a;
    if (Math.abs(delta) < 0.01) return;

    if (bloco.faixa === "clipes") {
      // Em clipes, as pontas aparam o trecho do vídeo de origem.
      const clipe = timeline.clipes[bloco.indice];
      const duracaoOrigem =
        biblioteca.find((m) => m.url === clipe.url)?.duracao ?? Infinity;
      const mudancas =
        modo === "inicio"
          ? {
              inicio: arredondar(
                Math.min(Math.max(0, clipe.inicio + delta), clipe.fim - MINIMO),
              ),
            }
          : {
              fim: arredondar(
                Math.max(
                  Math.min(duracaoOrigem, clipe.fim + delta),
                  clipe.inicio + MINIMO,
                ),
              ),
            };
      aplicar((t) => atualizarItem(t, "clipes", bloco.indice, mudancas));
      return;
    }

    const { inicio, fim } = bloco;
    const mudancas =
      modo === "mover"
        ? {
            inicio: arredondar(Math.max(0, inicio + delta)),
            fim: arredondar(Math.max(0, inicio + delta) + (fim - inicio)),
          }
        : modo === "inicio"
          ? {
              inicio: arredondar(
                Math.min(Math.max(0, inicio + delta), fim - MINIMO),
              ),
            }
          : { fim: arredondar(Math.max(fim + delta, inicio + MINIMO)) };
    aplicar((t) => atualizarItem(t, bloco.faixa, bloco.indice, mudancas));
  };

  useEffect(() => {
    if (!arrasto) return;
    const mover = (e: PointerEvent) =>
      setArrasto((a) =>
        a ? { ...a, delta: (e.clientX - a.xInicial) / pxPorSegundo } : a,
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
  }, [arrasto, pxPorSegundo]);

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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-zinc-800 px-3 py-1.5 text-xs text-zinc-400">
        <span>Arraste as pontas para aparar; o meio para mover.</span>
        <label className="ml-auto flex items-center gap-2">
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
                  style={{ left: s * pxPorSegundo }}
                >
                  {s}s
                </span>
              ))}
            </div>
          </div>

          {FAIXAS_VISUAIS.map(({ faixa, rotulo, cor }) => (
            <div
              key={faixa}
              className="flex border-b border-zinc-800/70"
              style={{ height: ALTURA_FAIXA }}
            >
              <div
                className="sticky left-0 z-30 flex shrink-0 items-center bg-zinc-900 px-3 text-xs text-zinc-400"
                style={{ width: LARGURA_ROTULO }}
              >
                {rotulo}
              </div>
              <div className="relative flex-1">
                {blocos[faixa].map((original) => {
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
                        left: b.inicio * pxPorSegundo,
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

          {/* Cursor de reprodução. */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-red-500"
            style={{ left: LARGURA_ROTULO + segundoAtual * pxPorSegundo }}
          />
        </div>
      </div>
    </div>
  );
};
