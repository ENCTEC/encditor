import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Insert } from "../../timeline/schema";
import { segParaFrames } from "../../timeline/calculos";
import { caixaPadrao, ehTelaCheia } from "../../timeline/caixas";

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
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: `${caixa.x}%`,
          top: `${caixa.y}%`,
          width: `${caixa.largura}%`,
          height: `${caixa.altura}%`,
          overflow: "hidden",
          borderRadius: acabamento.cantos ? 16 : 0,
          border: acabamento.borda ? "4px solid white" : "none",
          boxShadow: acabamento.sombra
            ? "0 10px 30px rgba(0, 0, 0, 0.5)"
            : "none",
          opacity: opacidade,
        }}
      >
        <Midia insert={insert} />
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
            layout="none"
          >
            <ConteudoInsert insert={insert} duracao={duracao} />
          </Sequence>
        );
      })}
    </>
  );
};
