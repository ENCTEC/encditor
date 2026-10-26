"use client";

import { Player } from "@remotion/player";
import { useEffect, useMemo, useRef, useState } from "react";
import { Midia } from "@/projeto/tipos";
import { EditorTimeline } from "@/remotion/EditorTimeline/EditorTimeline";
import { TAGS_DE_AUDIO_DO_PLAYER } from "@/remotion/EditorTimeline/premontar";
import {
  AcabamentoCaixa,
  Caixa,
  caixaDoCelular,
  caixaDoLayout,
  caixaNaGrade,
  Layout,
  limitarCaixa,
  POSICOES,
  PosicaoGrade,
  redimensionar,
  Tamanho,
  TAMANHOS,
} from "@/timeline/caixas";
import { calcularClipes, calcularDuracaoTotal } from "@/timeline/calculos";
import { Timeline } from "@/timeline/schema";

// Popup para escolher onde o insert fica e o tamanho dele, vendo o quadro
// real do vídeo ao fundo. Arraste para mover, use o scroll (ou a alça do
// canto) para aumentar/diminuir, ou os atalhos de posição/tamanho/layout.

const ROTULO_POSICAO: Record<PosicaoGrade, string> = {
  "canto-sup-esq": "Canto superior esquerdo",
  topo: "Em cima, no meio",
  "canto-sup-dir": "Canto superior direito",
  esquerda: "Esquerda, no meio",
  centro: "Centro",
  direita: "Direita, no meio",
  "canto-inf-esq": "Canto inferior esquerdo",
  base: "Embaixo, no meio",
  "canto-inf-dir": "Canto inferior direito",
};

const LAYOUTS_BOTOES: { layout: Layout; rotulo: string }[] = [
  { layout: "tela-cheia", rotulo: "Tela cheia" },
  { layout: "metade-esquerda", rotulo: "Metade esq." },
  { layout: "metade-direita", rotulo: "Metade dir." },
  { layout: "metade-cima", rotulo: "Metade cima" },
  { layout: "metade-baixo", rotulo: "Metade baixo" },
];

const botao =
  "border-2 border-tinta px-2 py-1 font-mono text-[11px] tracking-wider uppercase hover:bg-tinta hover:text-papel";
const botaoAtivo = "bg-tinta text-papel";

export const PopupPosicao: React.FC<{
  titulo: string;
  midia: Pick<Midia, "url" | "formato" | "largura" | "altura">;
  // Timeline de fundo (sem o insert que está sendo posicionado).
  fundo: Timeline;
  segundo: number;
  inicial: { caixa: Caixa; acabamento: AcabamentoCaixa };
  aoConfirmar: (caixa: Caixa, acabamento: AcabamentoCaixa) => void;
  aoCancelar: () => void;
}> = ({ titulo, midia, fundo, segundo, inicial, aoConfirmar, aoCancelar }) => {
  const [caixa, setCaixa] = useState(inicial.caixa);
  const [acabamento, setAcabamento] = useState(inicial.acabamento);
  const [ancora, setAncora] = useState<PosicaoGrade>("canto-sup-dir");
  const palco = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{
    modo: "mover" | "redimensionar";
    x0: number;
    y0: number;
    caixa: Caixa;
  } | null>(null);

  const proporcaoVideo = fundo.largura / fundo.altura;
  const proporcaoMidia =
    midia.largura && midia.altura ? midia.largura / midia.altura : 16 / 9;

  const duracao = useMemo(
    () => Math.max(1, calcularDuracaoTotal(calcularClipes(fundo))),
    [fundo],
  );
  const frame = Math.min(duracao - 1, Math.round(segundo * fundo.fps));

  // Scroll do mouse no palco = aumentar/diminuir (mantendo o centro).
  useEffect(() => {
    const el = palco.current;
    if (!el) return;
    const aoRolar = (e: WheelEvent) => {
      e.preventDefault();
      setCaixa((c) => redimensionar(c, e.deltaY < 0 ? 1.06 : 1 / 1.06));
    };
    el.addEventListener("wheel", aoRolar, { passive: false });
    return () => el.removeEventListener("wheel", aoRolar);
  }, []);

  // Esc cancela; Enter confirma.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoCancelar();
      if (e.key === "Enter") aoConfirmar(caixa, acabamento);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [caixa, acabamento, aoCancelar, aoConfirmar]);

  const iniciarArrasto = (
    e: React.PointerEvent,
    modo: "mover" | "redimensionar",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    arrasto.current = { modo, x0: e.clientX, y0: e.clientY, caixa };
    const mover = (ev: PointerEvent) => {
      const a = arrasto.current;
      const ret = palco.current?.getBoundingClientRect();
      if (!a || !ret) return;
      const dx = ((ev.clientX - a.x0) / ret.width) * 100;
      const dy = ((ev.clientY - a.y0) / ret.height) * 100;
      if (a.modo === "mover") {
        setCaixa(
          limitarCaixa({ ...a.caixa, x: a.caixa.x + dx, y: a.caixa.y + dy }),
        );
      } else {
        // Alça do canto: muda o tamanho mantendo a proporção.
        const fator = Math.max(0.1, (a.caixa.largura + dx) / a.caixa.largura);
        setCaixa(
          limitarCaixa({
            ...a.caixa,
            largura: a.caixa.largura * fator,
            altura: a.caixa.altura * fator,
          }),
        );
      }
    };
    const soltar = () => {
      arrasto.current = null;
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };

  const naGrade = (posicao: PosicaoGrade, largura = caixa.largura) => {
    setAncora(posicao);
    setCaixa(
      caixaNaGrade(
        posicao,
        Math.min(largura, 90),
        proporcaoMidia,
        proporcaoVideo,
      ),
    );
  };

  const telaCheia = caixa.largura >= 99.5 && caixa.altura >= 99.5;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/60 p-6"
      onPointerDown={(e) => e.target === e.currentTarget && aoCancelar()}
      role="dialog"
      aria-label={titulo}
    >
      <div className="cartao-zine flex max-h-full w-full max-w-6xl flex-col gap-4 overflow-auto p-5 lg:flex-row">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-3xl leading-none tracking-wide uppercase">
            {titulo}
          </h2>
          <p className="mt-1 mb-3 font-mono text-[11px] tracking-wider text-zinc-500 uppercase">
            Arraste para mover · scroll do mouse para aumentar/diminuir · Enter
            confirma
          </p>
          <div
            ref={palco}
            className="relative w-full overflow-hidden border-[3px] border-tinta bg-black select-none"
            style={{ aspectRatio: `${fundo.largura} / ${fundo.altura}` }}
          >
            {fundo.clipes.length ? (
              <Player
                component={EditorTimeline}
                inputProps={fundo}
                durationInFrames={duracao}
                fps={fundo.fps}
                compositionWidth={fundo.largura}
                compositionHeight={fundo.altura}
                initialFrame={frame}
                style={{ width: "100%", height: "100%" }}
                numberOfSharedAudioTags={TAGS_DE_AUDIO_DO_PLAYER}
                acknowledgeRemotionLicense
              />
            ) : null}
            {/* Grade de terços, para ajudar a alinhar. */}
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className="border border-white/15" />
              ))}
            </div>
            <div
              onPointerDown={(e) => iniciarArrasto(e, "mover")}
              className="absolute cursor-move overflow-hidden outline-2 outline-offset-2 outline-spray"
              style={{
                left: `${caixa.x}%`,
                top: `${caixa.y}%`,
                width: `${caixa.largura}%`,
                height: `${caixa.altura}%`,
                borderRadius: !telaCheia && acabamento.cantos ? 12 : 0,
                border:
                  !telaCheia && acabamento.borda ? "3px solid white" : "none",
                boxShadow:
                  !telaCheia && acabamento.sombra
                    ? "0 8px 24px rgba(0,0,0,0.5)"
                    : "none",
              }}
            >
              {midia.formato === "imagem" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={midia.url}
                  alt=""
                  draggable={false}
                  className="h-full w-full object-cover"
                />
              ) : (
                <video
                  src={midia.url}
                  muted
                  preload="metadata"
                  className="h-full w-full object-cover"
                />
              )}
              <span
                onPointerDown={(e) => iniciarArrasto(e, "redimensionar")}
                className="absolute right-0 bottom-0 h-4 w-4 cursor-nwse-resize bg-spray"
                title="Arraste para mudar o tamanho"
              />
            </div>
          </div>
          <p className="mt-2 font-mono text-[11px] text-zinc-500">
            x {caixa.x}% · y {caixa.y}% · {caixa.largura}% × {caixa.altura}%
          </p>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-5 lg:w-64">
          <div>
            <p className="rotulo-zine mb-2">Onde</p>
            <div className="grid grid-cols-3 gap-1.5">
              {POSICOES.map((p) => (
                <button
                  key={p}
                  onClick={() => naGrade(p)}
                  title={ROTULO_POSICAO[p]}
                  aria-label={ROTULO_POSICAO[p]}
                  className={`flex aspect-video items-center justify-center border-2 border-tinta ${
                    ancora === p && !telaCheia
                      ? "bg-spray"
                      : "hover:bg-zinc-800"
                  }`}
                >
                  <span className="h-2 w-2 bg-tinta" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="rotulo-zine mb-2">Tamanho</p>
            <div className="flex gap-1.5">
              {(Object.keys(TAMANHOS) as Tamanho[]).map((t) => (
                <button
                  key={t}
                  onClick={() => naGrade(ancora, TAMANHOS[t])}
                  className={`${botao} flex-1 ${
                    !telaCheia && Math.abs(caixa.largura - TAMANHOS[t]) < 1
                      ? botaoAtivo
                      : ""
                  }`}
                >
                  {t} · {TAMANHOS[t]}%
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex gap-1.5">
              <button
                onClick={() => setCaixa((c) => redimensionar(c, 1 / 1.1))}
                className={`${botao} flex-1`}
              >
                − menor
              </button>
              <button
                onClick={() => setCaixa((c) => redimensionar(c, 1.1))}
                className={`${botao} flex-1`}
              >
                + maior
              </button>
            </div>
          </div>

          <div>
            <p className="rotulo-zine mb-2">Layouts</p>
            <div className="flex flex-wrap gap-1.5">
              {LAYOUTS_BOTOES.map(({ layout, rotulo }) => (
                <button
                  key={layout}
                  onClick={() => setCaixa(caixaDoLayout(layout))}
                  className={botao}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="rotulo-zine mb-2">Acabamento da janela</p>
            {(
              [
                ["borda", "Borda branca"],
                ["cantos", "Cantos arredondados"],
                ["sombra", "Sombra"],
                ["polaroid", "Foto polaroid"],
                ["alfinete", "Alfinete (quadro de cortiça)"],
                ["celular", "Dentro de um celular"],
              ] as const
            ).map(([chave, rotulo]) => (
              <label key={chave} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!acabamento[chave]}
                  onChange={(e) => {
                    setAcabamento({ ...acabamento, [chave]: e.target.checked });
                    // Celular: caixa no formato de um celular, no mesmo
                    // centro (de tela cheia, no lugar padrão).
                    if (chave === "celular" && e.target.checked) {
                      setCaixa((c) => {
                        const cel = caixaDoCelular(proporcaoVideo, null);
                        return telaCheia
                          ? cel
                          : limitarCaixa({
                              ...cel,
                              x: c.x + c.largura / 2 - cel.largura / 2,
                            });
                      });
                    }
                  }}
                  className="accent-spray"
                />
                {rotulo}
              </label>
            ))}
          </div>

          <div className="mt-auto flex gap-2">
            <button onClick={aoCancelar} className={`${botao} flex-1 py-2`}>
              Cancelar
            </button>
            <button
              onClick={() => aoConfirmar(caixa, acabamento)}
              className="botao-spray flex-1"
            >
              OK
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};
