import React from "react";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Img,
  OffthreadVideo,
  Sequence,
  useVideoConfig,
} from "remotion";
import { Timeline } from "../../timeline/schema";
import {
  calcularClipes,
  calcularDuracaoTotal,
  inicioDosClipes,
  validarTimeline,
} from "../../timeline/calculos";
import { Audios } from "./Audios";
import { Inserts } from "./Inserts";
import { Legendas } from "./Legendas";
import { PREMONTAR_S } from "./premontar";
import { ClipeComTransicoes } from "./transicoes";
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
  const inicios = inicioDosClipes(clipes);
  const duracaoTotal = calcularDuracaoTotal(clipes);
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Zoom zooms={timeline.zooms}>
        {clipes.map((clipe, i) => (
          <Sequence
            key={i}
            from={inicios[i]}
            durationInFrames={clipe.duracaoFrames}
            name={`Clipe ${i + 1}`}
            premountFor={PREMONTAR_S * timeline.fps}
            // A 1ª cena continua montada até o fim: ao repetir o vídeo
            // (ou voltar ao início) ela já está carregada, sem piscar.
            postmountFor={i === 0 ? duracaoTotal : undefined}
          >
            <ClipeComTransicoes
              clipe={clipe}
              proximo={clipes[i + 1]}
              largura={width}
              altura={height}
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
            </ClipeComTransicoes>
          </Sequence>
        ))}
        <Inserts inserts={timeline.inserts} />
      </Zoom>
      <Legendas
        legendas={timeline.legendas}
        estiloPadrao={timeline.estiloLegenda}
        aparencia={timeline.aparenciaLegendas}
      />
      <Audios audios={timeline.audios} />
    </AbsoluteFill>
  );
};
