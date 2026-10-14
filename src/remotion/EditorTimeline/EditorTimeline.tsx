import React from "react";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Easing,
  Img,
  OffthreadVideo,
  useVideoConfig,
} from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { Timeline } from "../../timeline/schema";
import {
  calcularClipes,
  calcularDuracaoTotal,
  validarTimeline,
} from "../../timeline/calculos";
import { Audios } from "./Audios";
import { Inserts } from "./Inserts";
import { Legendas } from "./Legendas";
import { PREMONTAR_S } from "./premontar";
import { criarTransicao } from "./transicoes";
import { Zoom } from "./Zoom";

// Ajusta duração, fps e tamanho do vídeo a partir do JSON recebido.
export const calcularMetadata: CalculateMetadataFunction<Timeline> = ({
  props,
}) => {
  validarTimeline(props);
  const clipes = calcularClipes(props);
  return {
    durationInFrames: Math.max(1, calcularDuracaoTotal(clipes)),
    fps: props.fps,
    width: props.largura,
    height: props.altura,
  };
};

// Camadas, de baixo para cima: trilha principal → inserts (os dois sob o
// zoom, como uma câmera) → legendas. O áudio não aparece na tela.
export const EditorTimeline: React.FC<Timeline> = (timeline) => {
  const clipes = calcularClipes(timeline);
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Zoom zooms={timeline.zooms}>
        <TransitionSeries>
          {clipes.map((clipe, i) => (
            <React.Fragment key={i}>
              {clipe.transicaoFrames > 0 && clipe.transicao !== "corte" ? (
                <TransitionSeries.Transition
                  presentation={criarTransicao(
                    clipe.transicao,
                    clipe.direcao,
                    width,
                    height,
                  )}
                  timing={linearTiming({
                    durationInFrames: clipe.transicaoFrames,
                    // Acelera e desacelera: a mistura fica mais natural
                    // que a linear (que "anda" e para de repente).
                    easing: Easing.inOut(Easing.cubic),
                  })}
                />
              ) : null}
              <TransitionSeries.Sequence
                durationInFrames={clipe.duracaoFrames}
                name={`Clipe ${i + 1}`}
                premountFor={PREMONTAR_S * timeline.fps}
              >
                {clipe.tipo === "imagem" ? (
                  <Img
                    src={clipe.url}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <OffthreadVideo
                    src={clipe.url}
                    trimBefore={clipe.trimInicio}
                    trimAfter={clipe.trimFim}
                    volume={clipe.volume}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                )}
              </TransitionSeries.Sequence>
            </React.Fragment>
          ))}
        </TransitionSeries>
        <Inserts inserts={timeline.inserts} />
      </Zoom>
      <Legendas
        legendas={timeline.legendas}
        estiloPadrao={timeline.estiloLegenda}
      />
      <Audios audios={timeline.audios} />
    </AbsoluteFill>
  );
};
