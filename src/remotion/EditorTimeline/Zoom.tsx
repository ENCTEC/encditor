import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Zoom as ZoomItem } from "../../timeline/schema";
import { segParaFrames } from "../../timeline/calculos";

// Tempo para aproximar e para voltar ao normal.
const RAMPA_SEGUNDOS = 0.4;

// Aplica os zooms da timeline em tudo que estiver dentro (a trilha principal).
export const Zoom: React.FC<{
  zooms: ZoomItem[];
  children: React.ReactNode;
}> = ({ zooms, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let escala = 1;
  let origem = "50% 50%";

  for (const zoom of zooms) {
    const de = segParaFrames(zoom.inicio, fps);
    const ate = segParaFrames(zoom.fim, fps);
    if (frame < de || frame > ate) {
      continue;
    }
    const rampa = Math.min(
      segParaFrames(RAMPA_SEGUNDOS, fps),
      Math.floor((ate - de) / 2),
    );
    escala =
      rampa > 0
        ? interpolate(
            frame,
            [de, de + rampa, ate - rampa, ate],
            [1, zoom.escala, zoom.escala, 1],
            {
              easing: Easing.inOut(Easing.ease),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          )
        : zoom.escala;
    origem = `${zoom.focoX}% ${zoom.focoY}%`;
    break;
  }

  return (
    <AbsoluteFill
      style={{ transform: `scale(${escala})`, transformOrigin: origem }}
    >
      {children}
    </AbsoluteFill>
  );
};
