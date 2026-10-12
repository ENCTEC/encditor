import React from "react";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  OffthreadVideo,
} from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { Timeline } from "../timeline/schema";
import {
  calcularClipes,
  calcularDuracaoTotal,
  ClipeCalculado,
} from "../timeline/calculos";
import { Legendas } from "./Legendas";

// Ajusta duração, fps e tamanho do vídeo a partir do JSON recebido.
export const calcularMetadata: CalculateMetadataFunction<Timeline> = ({
  props,
}) => {
  const clipes = calcularClipes(props);
  return {
    durationInFrames: Math.max(1, calcularDuracaoTotal(clipes)),
    fps: props.fps,
    width: props.largura,
    height: props.altura,
  };
};

const apresentacao = (clipe: ClipeCalculado) =>
  clipe.transicao === "slide" ? slide({ direction: "from-right" }) : fade();

export const EditorTimeline: React.FC<Timeline> = (timeline) => {
  const clipes = calcularClipes(timeline);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <TransitionSeries>
        {clipes.map((clipe, i) => (
          <React.Fragment key={i}>
            {clipe.transicaoFrames > 0 ? (
              <TransitionSeries.Transition
                presentation={apresentacao(clipe)}
                timing={linearTiming({
                  durationInFrames: clipe.transicaoFrames,
                })}
              />
            ) : null}
            <TransitionSeries.Sequence
              durationInFrames={clipe.duracaoFrames}
              name={`Clipe ${i + 1}`}
            >
              <OffthreadVideo
                src={clipe.url}
                trimBefore={clipe.trimInicio}
                trimAfter={clipe.trimFim}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </TransitionSeries.Sequence>
          </React.Fragment>
        ))}
      </TransitionSeries>
      <Legendas legendas={timeline.legendas} />
    </AbsoluteFill>
  );
};
