import React from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { EstiloLegenda, Legenda } from "../../timeline/schema";
import { segParaFrames } from "../../timeline/calculos";
import { FONTES } from "./fontes";

// Legendas animadas. Cada estilo usa o tempo de cada palavra (quando a
// legenda veio da transcrição) para animar no ritmo da fala.

const AMARELO = "#FFD60A";
const VERMELHO = "#E1251B";
const CONTORNO =
  "0 0 2px #000, 2px 2px 0 #000, -2px 2px 0 #000, 2px -2px 0 #000, -2px -2px 0 #000, 0 4px 8px rgba(0,0,0,0.5)";

type Palavra = { texto: string; de: number; ate: number };

// Palavras com seus tempos (segundos desde o início da legenda). Se não
// houver tempos (legenda escrita à mão) ou o texto foi editado depois,
// divide a duração igualmente entre as palavras.
const palavrasDa = (legenda: Legenda, duracao: number): Palavra[] => {
  const textos = legenda.texto.split(/\s+/).filter(Boolean);
  const salvas = legenda.palavras;
  if (
    salvas &&
    salvas.length === textos.length &&
    salvas.every((p, i) => p.texto === textos[i])
  ) {
    return salvas;
  }
  const passo = duracao / Math.max(1, textos.length);
  return textos.map((texto, i) => ({
    texto,
    de: i * passo,
    ate: (i + 1) * passo,
  }));
};

// Some suavemente nos últimos quadros.
const useSaida = (duracaoFrames: number) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [duracaoFrames - 5, duracaoFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

const Base: React.FC<{
  children: React.ReactNode;
  centro?: boolean;
  opacidade?: number;
}> = ({ children, centro, opacidade = 1 }) => (
  <AbsoluteFill
    style={{
      justifyContent: centro ? "center" : "flex-end",
      alignItems: "center",
      paddingBottom: centro ? 0 : "9%",
      paddingLeft: "6%",
      paddingRight: "6%",
      opacity: opacidade,
    }}
  >
    {children}
  </AbsoluteFill>
);

export const LegendaAnimada: React.FC<{
  legenda: Legenda;
  estilo: EstiloLegenda;
  duracaoFrames: number;
}> = ({ legenda, estilo, duracaoFrames }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const base = Math.min(width, height);
  const saida = useSaida(duracaoFrames);
  const palavras = palavrasDa(legenda, duracaoFrames / fps);
  // Palavra sendo falada agora (ou a última já falada).
  const atual = palavras.reduce((acc, p, i) => (t >= p.de ? i : acc), -1);

  const linhaDePalavras = (
    render: (p: Palavra, i: number) => React.ReactNode,
    estiloTexto: React.CSSProperties,
  ) => (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: `0 ${base * 0.018}px`,
        textAlign: "center",
        lineHeight: 1.15,
        ...estiloTexto,
      }}
    >
      {palavras.map((p, i) => (
        <span key={i} style={{ display: "inline-block" }}>
          {render(p, i)}
        </span>
      ))}
    </div>
  );

  switch (estilo) {
    case "karaoke":
      return (
        <Base opacidade={saida}>
          {linhaDePalavras(
            (p, i) => (
              <span
                style={{
                  color: t >= p.de ? AMARELO : "white",
                  display: "inline-block",
                  transform: `scale(${i === atual ? 1.08 : 1})`,
                }}
              >
                {p.texto}
              </span>
            ),
            {
              fontFamily: FONTES.forte,
              fontWeight: 900,
              fontSize: base * 0.062,
              textShadow: CONTORNO,
            },
          )}
        </Base>
      );

    case "pop":
      return (
        <Base opacidade={saida}>
          {linhaDePalavras(
            (p) => {
              const entrada = spring({
                frame: frame - Math.round(p.de * fps),
                fps,
                config: { damping: 9, stiffness: 200 },
              });
              return (
                <span
                  style={{
                    display: "inline-block",
                    opacity: t >= p.de ? 1 : 0,
                    transform: `scale(${0.4 + entrada * 0.6}) translateY(${(1 - entrada) * 20}px)`,
                  }}
                >
                  {p.texto}
                </span>
              );
            },
            {
              fontFamily: FONTES.forte,
              fontWeight: 900,
              fontSize: base * 0.066,
              color: "white",
              textTransform: "uppercase",
              textShadow: CONTORNO,
            },
          )}
        </Base>
      );

    case "destaque":
      return (
        <Base opacidade={saida}>
          {linhaDePalavras(
            (p, i) => (
              <span
                style={{
                  display: "inline-block",
                  padding: `0 ${base * 0.01}px`,
                  borderRadius: base * 0.008,
                  background: i === atual ? VERMELHO : "transparent",
                  transform: `scale(${i === atual ? 1.06 : 1}) rotate(${i === atual ? -2 : 0}deg)`,
                }}
              >
                {p.texto}
              </span>
            ),
            {
              fontFamily: FONTES.forte,
              fontWeight: 900,
              fontSize: base * 0.062,
              color: "white",
              textTransform: "uppercase",
              textShadow: CONTORNO,
            },
          )}
        </Base>
      );

    case "gigante": {
      const batida = spring({
        frame,
        fps,
        config: { damping: 12, stiffness: 220 },
      });
      return (
        <Base centro opacidade={saida}>
          <div
            style={{
              fontFamily: FONTES.condensada,
              fontSize: base * 0.14,
              lineHeight: 0.95,
              color: "white",
              textTransform: "uppercase",
              textAlign: "center",
              textShadow: `${base * 0.008}px ${base * 0.008}px 0 ${VERMELHO}, 0 8px 24px rgba(0,0,0,0.5)`,
              transform: `scale(${1.5 - batida * 0.5})`,
              opacity: batida,
            }}
          >
            {legenda.texto}
          </div>
        </Base>
      );
    }

    case "spray": {
      const revelado = interpolate(
        frame,
        [0, Math.max(2, Math.min(fps * 0.6, duracaoFrames * 0.4))],
        [100, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      );
      return (
        <Base opacidade={saida}>
          <div
            style={{
              fontFamily: FONTES.spray,
              fontSize: base * 0.075,
              color: VERMELHO,
              textAlign: "center",
              transform: "rotate(-3deg)",
              clipPath: `inset(-20% ${revelado}% -20% -5%)`,
              textShadow:
                "0 2px 0 rgba(255,255,255,0.85), 0 4px 10px rgba(0,0,0,0.45)",
            }}
          >
            {legenda.texto}
          </div>
        </Base>
      );
    }

    case "maquina": {
      const total = legenda.texto.length;
      const visiveis = Math.min(
        total,
        Math.floor(
          interpolate(frame, [0, duracaoFrames * 0.6], [0, total], {
            extrapolateRight: "clamp",
          }),
        ),
      );
      const cursor = Math.floor(t * 2) % 2 === 0;
      return (
        <Base opacidade={saida}>
          <div
            style={{
              fontFamily: FONTES.mono,
              fontWeight: 700,
              fontSize: base * 0.048,
              color: "#F4F1EA",
              background: "rgba(10,10,10,0.85)",
              padding: `${base * 0.012}px ${base * 0.022}px`,
              textAlign: "left",
              whiteSpace: "pre-wrap",
            }}
          >
            {legenda.texto.slice(0, visiveis)}
            <span style={{ opacity: cursor ? 1 : 0, color: VERMELHO }}>▌</span>
          </div>
        </Base>
      );
    }

    case "neon": {
      // Pisca ao acender, como letreiro.
      const piscadas = [0, 1, 0.2, 1, 0.5, 1];
      const passo = Math.floor(frame / 3);
      const brilho = passo < piscadas.length ? piscadas[passo] : 1;
      return (
        <Base opacidade={saida * brilho}>
          <div
            style={{
              fontFamily: FONTES.forte,
              fontWeight: 800,
              fontSize: base * 0.064,
              color: "#FFFFFF",
              textAlign: "center",
              textShadow:
                "0 0 6px #fff, 0 0 14px #00E5FF, 0 0 28px #00E5FF, 0 0 46px #FF2BD6",
            }}
          >
            {legenda.texto}
          </div>
        </Base>
      );
    }

    case "classico":
    default: {
      const entrada = interpolate(frame, [0, 6], [0, 1], {
        extrapolateRight: "clamp",
      });
      return (
        <Base opacidade={Math.min(entrada, saida)}>
          <div
            style={{
              maxWidth: "85%",
              padding: `${base * 0.012}px ${base * 0.026}px`,
              borderRadius: base * 0.012,
              backgroundColor: "rgba(0, 0, 0, 0.65)",
              color: "white",
              fontFamily: FONTES.forte,
              fontWeight: 800,
              fontSize: base * 0.048,
              textAlign: "center",
              lineHeight: 1.2,
            }}
          >
            {legenda.texto}
          </div>
        </Base>
      );
    }
  }
};

export const Legendas: React.FC<{
  legendas: Legenda[];
  estiloPadrao?: EstiloLegenda;
}> = ({ legendas, estiloPadrao }) => {
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
            <LegendaAnimada
              legenda={legenda}
              estilo={legenda.estilo ?? estiloPadrao ?? "classico"}
              duracaoFrames={duracao}
            />
          </Sequence>
        );
      })}
    </>
  );
};
