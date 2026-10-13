import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { EstiloLegenda, TipoTransicao } from "../../timeline/schema";
import { LegendaAnimada } from "../EditorTimeline/Legendas";
import { FONTES } from "../EditorTimeline/fontes";
import { criarTransicao } from "../EditorTimeline/transicoes";

// Pequenos vídeos de exemplo para o menu "Estilos": mostram cada transição
// e cada estilo de legenda funcionando, em loop.

export const DEMO = { fps: 30, largura: 640, altura: 360 };
export const DURACAO_DEMO_TRANSICAO = 75; // 2,5s
export const DURACAO_DEMO_LEGENDA = 105; // 3,5s

const Painel: React.FC<{ texto: string; fundo: string; cor: string }> = ({
  texto,
  fundo,
  cor,
}) => (
  <AbsoluteFill
    style={{
      backgroundColor: fundo,
      // retícula, como no app
      backgroundImage: `radial-gradient(rgba(0,0,0,0.12) 1px, transparent 1.4px)`,
      backgroundSize: "6px 6px",
      justifyContent: "center",
      alignItems: "center",
    }}
  >
    <span
      style={{
        fontFamily: FONTES.condensada,
        fontSize: 110,
        color: cor,
        letterSpacing: -2,
      }}
    >
      {texto}
    </span>
  </AbsoluteFill>
);

export const DemoTransicao: React.FC<{ tipo: TipoTransicao }> = ({ tipo }) => {
  const { width, height } = useVideoConfig();
  const duracaoTransicao = tipo === "corte" ? 0 : 24;
  const cena = (DURACAO_DEMO_TRANSICAO + duracaoTransicao) / 2;

  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={cena}>
        <Painel texto="CENA 1" fundo="#ebe8e1" cor="#111110" />
      </TransitionSeries.Sequence>
      {tipo !== "corte" ? (
        <TransitionSeries.Transition
          presentation={criarTransicao(tipo, undefined, width, height)}
          timing={linearTiming({ durationInFrames: duracaoTransicao })}
        />
      ) : null}
      <TransitionSeries.Sequence durationInFrames={cena}>
        <Painel texto="CENA 2" fundo="#e1251b" cor="#ebe8e1" />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};

// Frase de exemplo com o tempo de cada palavra, como sai da transcrição.
const FRASE = ["Essa", "é", "a", "nossa", "promoção", "de", "verão!"];
const TEMPOS = [0.15, 0.45, 0.65, 0.8, 1.15, 1.75, 1.95, 2.6];

export const DemoLegenda: React.FC<{ estilo: EstiloLegenda }> = ({
  estilo,
}) => (
  <AbsoluteFill
    style={{
      background:
        "linear-gradient(160deg, #3a3631 0%, #1b1a18 55%, #4a1410 100%)",
    }}
  >
    <AbsoluteFill
      style={{
        backgroundImage: `radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1.4px)`,
        backgroundSize: "6px 6px",
      }}
    />
    <LegendaAnimada
      estilo={estilo}
      duracaoFrames={DURACAO_DEMO_LEGENDA}
      legenda={{
        texto: FRASE.join(" "),
        inicio: 0,
        fim: DURACAO_DEMO_LEGENDA / DEMO.fps,
        palavras: FRASE.map((texto, i) => ({
          texto,
          de: TEMPOS[i],
          ate: TEMPOS[i + 1],
        })),
      }}
    />
  </AbsoluteFill>
);
