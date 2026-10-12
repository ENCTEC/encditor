import React from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Legenda } from "../timeline/schema";
import { segParaFrames } from "../timeline/calculos";

const FADE_FRAMES = 6;

const TextoLegenda: React.FC<{ texto: string; duracao: number }> = ({
  texto,
  duracao,
}) => {
  const frame = useCurrentFrame();
  // Fade-in e fade-out curtos para a legenda não "piscar".
  const fade = Math.min(FADE_FRAMES, Math.floor(duracao / 2));
  const opacidade =
    fade > 0
      ? interpolate(frame, [0, fade, duracao - fade, duracao], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: "8%",
      }}
    >
      <div
        style={{
          opacity: opacidade,
          maxWidth: "80%",
          padding: "12px 28px",
          borderRadius: 12,
          backgroundColor: "rgba(0, 0, 0, 0.65)",
          color: "white",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: 48,
          fontWeight: 700,
          textAlign: "center",
          lineHeight: 1.2,
        }}
      >
        {texto}
      </div>
    </AbsoluteFill>
  );
};

export const Legendas: React.FC<{ legendas: Legenda[] }> = ({ legendas }) => {
  const { fps } = useVideoConfig();

  return (
    <>
      {legendas.map((legenda, i) => {
        const de = segParaFrames(legenda.inicio, fps);
        const duracao = segParaFrames(legenda.fim, fps) - de;
        if (duracao <= 0) {
          return null;
        }
        return (
          <Sequence
            key={i}
            from={de}
            durationInFrames={duracao}
            name={`Legenda: ${legenda.texto}`}
            layout="none"
          >
            <TextoLegenda texto={legenda.texto} duracao={duracao} />
          </Sequence>
        );
      })}
    </>
  );
};
