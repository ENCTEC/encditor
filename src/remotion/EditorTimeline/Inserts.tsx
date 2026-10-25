import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Insert } from "../../timeline/schema";
import { segParaFrames } from "../../timeline/calculos";
import { PREMONTAR_S } from "./premontar";
import { caixaPadrao, ehTelaCheia } from "../../timeline/caixas";
import { Alfinete } from "./Alfinete";
import { FONTES } from "./fontes";

const FADE_FRAMES = 6;

const Midia: React.FC<{ insert: Insert }> = ({ insert }) => {
  const { fps } = useVideoConfig();
  const estilo: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };

  if (insert.tipo === "imagem") {
    return <Img src={insert.url} style={estilo} />;
  }
  return (
    <OffthreadVideo
      src={insert.url}
      trimBefore={segParaFrames(insert.origemInicio, fps)}
      volume={insert.volume}
      style={estilo}
    />
  );
};

const ConteudoInsert: React.FC<{ insert: Insert; duracao: number }> = ({
  insert,
  duracao,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  // Entrada e saída suaves para o insert não "estourar" na tela.
  const fade = Math.min(FADE_FRAMES, Math.floor(duracao / 2));
  const opacidade =
    fade > 0
      ? interpolate(frame, [0, fade, duracao - fade, duracao], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  const caixa = insert.caixa ?? caixaPadrao(insert.posicao);
  if (ehTelaCheia(caixa)) {
    return (
      <AbsoluteFill style={{ opacity: opacidade }}>
        <Midia insert={insert} />
      </AbsoluteFill>
    );
  }

  // Janela: posição/tamanho da caixa. Sem acabamento definido, usa borda
  // branca, cantos arredondados e sombra (o visual "picture-in-picture").
  const acabamento = insert.acabamento ?? {
    borda: true,
    cantos: true,
    sombra: true,
  };
  const polaroid = !!acabamento.polaroid;
  const u = Math.min(width, height) / 100;
  const larguraPx = (caixa.largura / 100) * width;
  // Moldura polaroid: margem fina em cima e dos lados, faixa larga embaixo.
  const margem = polaroid ? larguraPx * 0.055 : 0;
  const faixa = polaroid ? larguraPx * 0.19 : 0;
  // Foto presa no quadro: chega maior e mais torta, "assenta" e o alfinete
  // espeta logo depois.
  const preso = polaroid || !!acabamento.alfinete;
  const assenta = preso
    ? spring({
        frame,
        fps,
        config: { stiffness: 190, damping: 15, mass: 0.8 },
      })
    : 1;
  const espeta = spring({
    frame: frame - 6,
    fps,
    config: { stiffness: 260, damping: 11 },
  });
  const solta = 1 - assenta;
  const sombra = preso
    ? `0 ${u * (0.7 + solta * 4)}px ${u * (1.6 + solta * 5)}px rgba(0, 0, 0, ${0.55 - solta * 0.2})`
    : "0 10px 30px rgba(0, 0, 0, 0.5)";
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: `${caixa.x}%`,
          top: `${caixa.y}%`,
          width: `${caixa.largura}%`,
          height: `${caixa.altura}%`,
          transform:
            preso || insert.rotacao
              ? `rotate(${(insert.rotacao ?? 0) + solta * 9}deg) scale(${1 + solta * 0.35})`
              : undefined,
          opacity: opacidade,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            borderRadius: !polaroid && acabamento.cantos ? 16 : 0,
            border: !polaroid && acabamento.borda ? "4px solid white" : "none",
            background: polaroid
              ? "linear-gradient(170deg, #F8F5EE 0%, #ECE7DB 100%)"
              : undefined,
            boxShadow: acabamento.sombra || polaroid ? sombra : "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: margem,
              right: margem,
              top: margem,
              bottom: polaroid ? faixa : 0,
              overflow: "hidden",
              boxShadow: polaroid ? "inset 0 0 0 1px rgba(0,0,0,0.15)" : undefined,
            }}
          >
            <Midia insert={insert} />
          </div>
          {polaroid && insert.rotulo?.trim() ? (
            <div
              style={{
                position: "absolute",
                left: margem,
                right: margem,
                bottom: 0,
                height: faixa,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONTES.spray,
                fontSize: Math.min(
                  faixa * 0.46,
                  (larguraPx * 1.5) / Math.max(8, insert.rotulo.length),
                ),
                color: "#1D1B18",
                transform: "rotate(-2deg)",
                whiteSpace: "nowrap",
              }}
            >
              {insert.rotulo}
            </div>
          ) : null}
        </div>
        {acabamento.alfinete ? (
          <Alfinete
            x={larguraPx / 2}
            y={polaroid ? margem * 0.9 : larguraPx * 0.04}
            tamanho={larguraPx * 0.085}
            escala={espeta}
          />
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export const Inserts: React.FC<{ inserts: Insert[] }> = ({ inserts }) => {
  const { fps } = useVideoConfig();

  return (
    <>
      {inserts.map((insert, i) => {
        const de = segParaFrames(insert.inicio, fps);
        const duracao = segParaFrames(insert.fim, fps) - de;
        if (duracao <= 0) {
          return null;
        }
        return (
          <Sequence
            key={i}
            from={de}
            durationInFrames={duracao}
            name={`Insert ${i + 1}`}
            premountFor={PREMONTAR_S * fps}
          >
            <ConteudoInsert insert={insert} duracao={duracao} />
          </Sequence>
        );
      })}
    </>
  );
};
