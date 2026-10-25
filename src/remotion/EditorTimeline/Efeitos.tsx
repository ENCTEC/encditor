import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Efeito } from "../../timeline/schema";
import { aleatorio, FaixasDeGlitch } from "./transicoesExtras";

// Efeitos de imagem num trecho (tremor, flash, glitch, cor…). Como o zoom,
// valem para tudo que estiver dentro (cenas e inserts); motions e legendas
// ficam fora. Sem efeito ativo no quadro, nada é aplicado.

const INTENSIDADE_PADRAO = 0.6;

const LIMITE = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

// Grão de filme: ruído em SVG. 6 versões, trocadas a cada quadro.
const grao = (semente: number) =>
  `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='${semente}' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 1.4 -0.2'/></filter><rect width='100%' height='100%' filter='url(%23g)'/></svg>")`;

// Tremor suave e "nervoso" ao mesmo tempo: soma de senos + um pouco de
// sorteio por quadro.
const balanco = (frame: number, semente: number) =>
  Math.sin(frame * 0.9 + semente) * 0.45 +
  Math.sin(frame * 2.3 + semente * 2) * 0.3 +
  (aleatorio(frame * 3 + semente) - 0.5) * 0.5;

export const Efeitos: React.FC<{
  efeitos: Efeito[];
  children: React.ReactNode;
}> = ({ efeitos, children }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const ativos = efeitos.filter((e) => t >= e.inicio && t < e.fim);
  if (!ativos.length) return <AbsoluteFill>{children}</AbsoluteFill>;

  const menor = Math.min(width, height);
  const filtros: string[] = [];
  const camadas: React.ReactNode[] = [];
  let dx = 0;
  let dy = 0;
  let giro = 0;
  let escala = 1;

  ativos.forEach((e, n) => {
    const k = e.intensidade ?? INTENSIDADE_PADRAO;
    const duracao = e.fim - e.inicio;
    const local = t - e.inicio;
    // Entra e sai suave (efeitos de cor) ou quase na hora (impactos).
    const envelope = (rampa: number) => {
      const r = Math.min(rampa, duracao / 2);
      return r > 0 ? Math.min(1, local / r, (duracao - local) / r) : 1;
    };
    switch (e.tipo) {
      case "tremor": {
        // Forte no começo e acalmando até o fim.
        const forca =
          k * envelope(0.04) * interpolate(local, [0, duracao], [1, 0.35]);
        const amp = menor * 0.03 * forca;
        dx += amp * balanco(frame, 1);
        dy += amp * balanco(frame, 7);
        giro += 1.6 * forca * balanco(frame, 13);
        escala *= 1 + 0.06 * forca;
        break;
      }
      case "flash": {
        const brilho = interpolate(
          local,
          [0, Math.min(0.05, duracao * 0.2), duracao],
          [0, 1, 0],
          { ...LIMITE, easing: Easing.out(Easing.quad) },
        );
        camadas.push(
          <AbsoluteFill
            key={`flash-${n}`}
            style={{ backgroundColor: "white", opacity: brilho * k * 1.4 }}
          />,
        );
        break;
      }
      case "glitch": {
        // Sorteio novo a cada 2 quadros.
        const passo = Math.floor(frame / 2) + n * 31;
        const forca = k * envelope(0.03);
        dx += (aleatorio(passo) - 0.5) * width * 0.05 * forca;
        dy += (aleatorio(passo + 9) - 0.5) * height * 0.012 * forca;
        filtros.push(
          `hue-rotate(${(aleatorio(passo + 4) - 0.5) * 200 * forca}deg)`,
          `saturate(${1 + forca})`,
          `contrast(${1 + forca * 0.4})`,
        );
        camadas.push(
          <FaixasDeGlitch key={`glitch-${n}`} semente={passo} forca={forca} />,
        );
        break;
      }
      case "desfoque":
        filtros.push(`blur(${menor * 0.02 * k * envelope(0.25)}px)`);
        break;
      case "batida": {
        // Pulso: aproxima rápido e volta.
        const pulso = interpolate(
          local,
          [0, duracao * 0.3, duracao],
          [0, 1, 0],
          { ...LIMITE, easing: Easing.out(Easing.cubic) },
        );
        escala *= 1 + 0.18 * k * pulso;
        break;
      }
      case "pb":
        filtros.push(`grayscale(${Math.min(1, k * 1.6) * envelope(0.25)})`);
        break;
      case "quente": {
        const f = k * envelope(0.3);
        filtros.push(`sepia(${0.3 * f})`, `saturate(${1 + 0.35 * f})`);
        camadas.push(
          <AbsoluteFill
            key={`quente-${n}`}
            style={{
              backgroundColor: "rgb(255,140,40)",
              mixBlendMode: "soft-light",
              opacity: 0.45 * f,
            }}
          />,
        );
        break;
      }
      case "frio": {
        const f = k * envelope(0.3);
        filtros.push(`saturate(${1 - 0.15 * f})`);
        camadas.push(
          <AbsoluteFill
            key={`frio-${n}`}
            style={{
              backgroundColor: "rgb(40,110,255)",
              mixBlendMode: "soft-light",
              opacity: 0.55 * f,
            }}
          />,
        );
        break;
      }
      case "vibrante": {
        const f = k * envelope(0.3);
        filtros.push(`contrast(${1 + 0.3 * f})`, `saturate(${1 + 0.7 * f})`);
        break;
      }
      case "vinheta":
        camadas.push(
          <AbsoluteFill
            key={`vinheta-${n}`}
            style={{
              background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 42%, rgba(0,0,0,${0.85 * k}) 100%)`,
              opacity: envelope(0.3),
            }}
          />,
        );
        break;
      case "grao":
        camadas.push(
          <AbsoluteFill
            key={`grao-${n}`}
            style={{
              backgroundImage: grao(frame % 6),
              backgroundSize: `${menor * 0.25}px`,
              mixBlendMode: "overlay",
              opacity: 0.9 * k * envelope(0.3),
            }}
          />,
        );
        break;
      case "vhs": {
        const f = k * envelope(0.15);
        filtros.push(
          `saturate(${1 - 0.4 * f})`,
          `contrast(${1 + 0.2 * f})`,
          `brightness(${1 + 0.06 * f})`,
        );
        dx += (aleatorio(frame) - 0.5) * menor * 0.006 * f;
        // Faixa de "tracking" descendo a tela.
        const faixa = ((frame * 2.2) % 120) - 10;
        camadas.push(
          <AbsoluteFill key={`vhs-${n}`} style={{ opacity: f }}>
            <AbsoluteFill
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, rgba(0,0,0,0.28) 0px, rgba(0,0,0,0.28) 2px, transparent 2px, transparent 5px)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: `${faixa}%`,
                height: "6%",
                background:
                  "linear-gradient(180deg, transparent, rgba(255,255,255,0.22), transparent)",
                mixBlendMode: "screen",
              }}
            />
          </AbsoluteFill>,
        );
        break;
      }
    }
  });

  // Tremor e giro mostrariam as bordas pretas: aproxima o suficiente.
  const folga =
    1 + (2 * (Math.abs(dx) + Math.abs(dy))) / menor + Math.abs(giro) * 0.012;

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          transform: `translate(${dx}px, ${dy}px) rotate(${giro}deg) scale(${escala * folga})`,
          filter: filtros.length ? filtros.join(" ") : undefined,
        }}
      >
        {children}
      </AbsoluteFill>
      {camadas}
    </AbsoluteFill>
  );
};
