import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import type { TransitionPresentation } from "@remotion/transitions";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { fade } from "@remotion/transitions/fade";
import { flip } from "@remotion/transitions/flip";
import { iris } from "@remotion/transitions/iris";
import { pushCut } from "@remotion/transitions/push-cut";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { ClipeCalculado } from "../../timeline/calculos";
import { Direcao, TipoTransicao } from "../../timeline/schema";
import { ehTransicaoExtra, transicaoExtra } from "./transicoesExtras";

// Traduz o tipo de transição do JSON para o efeito do Remotion.

type Lado = "from-left" | "from-right" | "from-top" | "from-bottom";

const LADO: Record<Direcao, Lado> = {
  esquerda: "from-left",
  direita: "from-right",
  cima: "from-top",
  baixo: "from-bottom",
};

type Apresentacao = TransitionPresentation<Record<string, unknown>>;

export const criarTransicao = (
  tipo: Exclude<TipoTransicao, "corte">,
  direcao: Direcao | undefined,
  largura: number,
  altura: number,
): Apresentacao => {
  if (ehTransicaoExtra(tipo)) {
    return transicaoExtra(tipo, direcao) as unknown as Apresentacao;
  }
  const efeito = (() => {
    switch (tipo) {
      case "fade":
        return fade();
      case "slide":
        return slide({ direction: LADO[direcao ?? "direita"] });
      case "cortina":
        return wipe({ direction: LADO[direcao ?? "esquerda"] });
      case "virar":
        return flip({ direction: LADO[direcao ?? "direita"] });
      case "relogio":
        return clockWipe({ width: largura, height: altura });
      case "iris":
        return iris({ width: largura, height: altura });
      case "impacto":
        return pushCut();
    }
  })();
  return efeito as unknown as Apresentacao;
};

// Curva das transições: acelera e desacelera (mais natural que a linear,
// que "anda" e para de repente).
export const CURVA_TRANSICAO = Easing.inOut(Easing.cubic);

const nada = () => undefined;

// Em repouso, anula o que os efeitos aplicam mesmo parados (translate(0),
// rotate(0), scale(1), perspectiva, recorte cheio): sem isso o navegador
// desenha a cena numa camada própria e o quadro sai levemente diferente
// do vídeo sem efeito.
const SEM_EFEITO: Record<string, React.CSSProperties> = {
  exitStyle: { transform: "none" },
  innerExitStyle: {
    transform: "none",
    willChange: "auto",
    clipPath: "none",
    backfaceVisibility: "visible",
    WebkitBackfaceVisibility: "visible",
  },
  outerExitStyle: { perspective: "none", transformStyle: "flat" },
};

// Envolve o conteúdo com o efeito. Fora da transição fica em repouso
// ("saindo" com progresso 0), que em todos os efeitos usados é o quadro
// normal, sem alteração.
const Envoltorio: React.FC<{
  apresentacao: Apresentacao | null;
  direcao: "entering" | "exiting";
  progresso: number;
  duracaoFrames: number;
  children: React.ReactNode;
}> = ({ apresentacao, direcao, progresso, duracaoFrames, children }) => {
  if (!apresentacao) return <AbsoluteFill>{children}</AbsoluteFill>;
  const Efeito = apresentacao.component;
  const repouso = direcao === "exiting" && progresso === 0;
  return (
    <Efeito
      presentationDirection={direcao}
      presentationProgress={progresso}
      presentationDurationInFrames={duracaoFrames}
      passedProps={
        repouso ? { ...apresentacao.props, ...SEM_EFEITO } : apresentacao.props
      }
      onElementImage={nada}
      onUnmount={nada}
      bothEnteringAndExiting={false}
    >
      {children}
    </Efeito>
  );
};

const efeitoDe = (
  clipe: ClipeCalculado | undefined,
  largura: number,
  altura: number,
) =>
  clipe && clipe.transicaoFrames > 0 && clipe.transicao !== "corte"
    ? criarTransicao(clipe.transicao, clipe.direcao, largura, altura)
    : null;

// Uma cena com a transição de ENTRADA (dela) e a de SAÍDA (a da próxima
// cena). Os mesmos elementos ficam montados do começo ao fim e só o
// progresso muda: o TransitionSeries do Remotion recriava os vídeos no
// início de cada transição e o preview "piscava" por alguns quadros.
export const ClipeComTransicoes: React.FC<{
  clipe: ClipeCalculado;
  proximo: ClipeCalculado | undefined;
  largura: number;
  altura: number;
  children: React.ReactNode;
}> = ({ clipe, proximo, largura, altura, children }) => {
  const frame = useCurrentFrame();
  const progresso = (de: number, duracao: number) =>
    interpolate(frame - de, [0, duracao], [0, 1], {
      easing: CURVA_TRANSICAO,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  const entrada = efeitoDe(clipe, largura, altura);
  const entrando = entrada !== null && frame < clipe.transicaoFrames;

  const saida = efeitoDe(proximo, largura, altura);
  const inicioSaida = clipe.duracaoFrames - (proximo?.transicaoFrames ?? 0);
  const saindo = saida !== null && frame >= inicioSaida;

  return (
    <Envoltorio
      apresentacao={entrada}
      direcao={entrando ? "entering" : "exiting"}
      progresso={entrando ? progresso(0, clipe.transicaoFrames) : 0}
      duracaoFrames={clipe.transicaoFrames}
    >
      <Envoltorio
        apresentacao={saida}
        direcao="exiting"
        progresso={
          saindo ? progresso(inicioSaida, proximo!.transicaoFrames) : 0
        }
        duracaoFrames={proximo?.transicaoFrames ?? 0}
      >
        {children}
      </Envoltorio>
    </Envoltorio>
  );
};
