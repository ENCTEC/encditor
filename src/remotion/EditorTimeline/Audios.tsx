import React from "react";
import { Html5Audio, interpolate, Sequence, useVideoConfig } from "remotion";
import { AudioFaixa } from "../../timeline/schema";
import { segParaFrames } from "../../timeline/calculos";
import { PREMONTAR_S } from "./premontar";

// Volume ao longo do tempo: sobe no fade de entrada, desce no de saída.
const curvaVolume = (
  frame: number,
  duracao: number,
  audio: AudioFaixa,
  fps: number,
) => {
  const entrada = Math.min(
    segParaFrames(audio.fadeEntrada, fps),
    Math.floor(duracao / 2),
  );
  const saida = Math.min(
    segParaFrames(audio.fadeSaida, fps),
    Math.floor(duracao / 2),
  );
  const subida =
    entrada > 0
      ? interpolate(frame, [0, entrada], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;
  const descida =
    saida > 0
      ? interpolate(frame, [duracao - saida, duracao], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;
  return audio.volume * Math.min(subida, descida);
};

export const Audios: React.FC<{ audios: AudioFaixa[] }> = ({ audios }) => {
  const { fps } = useVideoConfig();

  return (
    <>
      {audios.map((audio, i) => {
        const de = segParaFrames(audio.inicio, fps);
        const duracao = segParaFrames(audio.fim, fps) - de;
        if (duracao <= 0) {
          return null;
        }
        return (
          <Sequence
            key={i}
            from={de}
            durationInFrames={duracao}
            name={`Áudio ${i + 1}`}
            premountFor={PREMONTAR_S * fps}
          >
            <Html5Audio
              src={audio.url}
              trimBefore={segParaFrames(audio.origemInicio, fps)}
              volume={(f) => curvaVolume(f, duracao, audio, fps)}
            />
          </Sequence>
        );
      })}
    </>
  );
};
