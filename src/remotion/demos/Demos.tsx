import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { EFEITOS_VISUAIS, MOTIONS } from "../../catalogo/estilos";
import {
  EstiloLegenda,
  ModeloMotion,
  TipoEfeito,
  TipoTransicao,
} from "../../timeline/schema";
import { Efeitos } from "../EditorTimeline/Efeitos";
import { MotionAnimado } from "../EditorTimeline/Motions";
import { LegendaAnimada } from "../EditorTimeline/Legendas";
import { FONTES } from "../EditorTimeline/fontes";
import { CURVA_TRANSICAO, criarTransicao } from "../EditorTimeline/transicoes";

// Pequenos vídeos de exemplo para o menu "Estilos": mostram cada
// transição, estilo de legenda, motion e efeito de imagem funcionando, em
// loop.

export const DEMO = { fps: 30, largura: 640, altura: 360 };
export const DURACAO_DEMO_TRANSICAO = 75; // 2,5s
export const DURACAO_DEMO_LEGENDA = 105; // 3,5s
export const DURACAO_DEMO_MOTION = 105; // 3,5s
export const DURACAO_DEMO_EFEITO = 90; // 3s

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
          timing={linearTiming({
            durationInFrames: duracaoTransicao,
            easing: CURVA_TRANSICAO,
          })}
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

// Fundo escuro com retícula (como o das legendas) e um "produto" para a
// seta e o círculo apontarem.
const FundoEscuro: React.FC<{ comProduto?: boolean }> = ({ comProduto }) => (
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
    {comProduto ? (
      <div
        style={{
          position: "absolute",
          left: "56%",
          top: "36%",
          width: "12%",
          height: "40%",
          borderRadius: "18px 18px 10px 10px",
          background: "linear-gradient(90deg, #d8cfc0, #f4efe6 45%, #b9ae9c)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}
      />
    ) : null}
  </AbsoluteFill>
);

export const DemoMotion: React.FC<{ modelo: ModeloMotion }> = ({ modelo }) => {
  const item = MOTIONS.find((m) => m.id === modelo)!;
  const aponta = modelo === "seta" || modelo === "circulo";
  const duracao = DURACAO_DEMO_MOTION - 8;
  return (
    <AbsoluteFill>
      <FundoEscuro comProduto={aponta} />
      <Sequence from={6} durationInFrames={duracao}>
        <MotionAnimado
          duracaoFrames={duracao}
          motion={{
            modelo,
            inicio: 0,
            fim: duracao / DEMO.fps,
            texto: item.exemplo.texto,
            ...(item.exemplo.detalhe ? { detalhe: item.exemplo.detalhe } : {}),
            ...(aponta ? { x: 62, y: 52 } : {}),
          }}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

// Cena colorida (céu, sol, morro e um frasco) para mostrar efeitos de cor,
// tremor e glitch.
const CenaColorida: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "linear-gradient(180deg, #f6c177 0%, #ea6f4f 55%, #7b2d43 100%)",
    }}
  >
    <div
      style={{
        position: "absolute",
        left: "14%",
        top: "16%",
        width: 110,
        height: 110,
        borderRadius: "50%",
        background: "#fff2c7",
        boxShadow: "0 0 60px #ffe08a",
      }}
    />
    <div
      style={{
        position: "absolute",
        left: "-10%",
        right: "-10%",
        bottom: "-30%",
        height: "62%",
        borderRadius: "50%",
        background: "#2f5d50",
      }}
    />
    <div
      style={{
        position: "absolute",
        left: "60%",
        top: "30%",
        width: "11%",
        height: "48%",
        borderRadius: "16px 16px 8px 8px",
        background: "linear-gradient(90deg, #3d7fd1, #9cc8ff 45%, #2b5e9e)",
        boxShadow: "0 10px 26px rgba(0,0,0,0.45)",
      }}
    />
    <span
      style={{
        position: "absolute",
        left: "8%",
        bottom: "12%",
        fontFamily: FONTES.condensada,
        fontSize: 64,
        color: "#ebe8e1",
        letterSpacing: -1,
      }}
    >
      CENA
    </span>
  </AbsoluteFill>
);

export const DemoEfeito: React.FC<{ tipo: TipoEfeito }> = ({ tipo }) => {
  const tipico = EFEITOS_VISUAIS.find((e) => e.id === tipo)?.duracao ?? 1;
  // Impactos curtos aparecem duas vezes; os de clima ficam mais tempo.
  const trechos =
    tipico < 1
      ? [
          { inicio: 0.6, fim: 0.6 + tipico },
          { inicio: 1.8, fim: 1.8 + tipico },
        ]
      : [{ inicio: 0.5, fim: 2.6 }];
  return (
    <Efeitos efeitos={trechos.map((t) => ({ tipo, ...t, intensidade: 0.8 }))}>
      <CenaColorida />
    </Efeitos>
  );
};
