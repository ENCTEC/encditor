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
import { Caixa } from "../../timeline/caixas";
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

// Celular: o insert vira a tela de um celular. Ele sobe de baixo ao
// entrar e desce ao sair — salvo quando outro insert de celular continua
// no mesmo lugar (continuaAntes/continuaDepois): aí só a tela troca.
const Celular: React.FC<{
  insert: Insert;
  caixa: Caixa;
  duracao: number;
  continuaAntes: boolean;
  continuaDepois: boolean;
}> = ({ insert, caixa, duracao, continuaAntes, continuaDepois }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const u = Math.min(width, height) / 100;
  const larguraPx = (caixa.largura / 100) * width;
  const alturaPx = (caixa.altura / 100) * height;
  const borda = larguraPx * 0.034;
  const raio = larguraPx * 0.13;
  const sobe = continuaAntes
    ? 1
    : spring({ frame, fps, config: { stiffness: 120, damping: 17, mass: 0.9 } });
  const desce = continuaDepois
    ? 0
    : interpolate(frame, [duracao - 9, duracao], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  // Tela nova (continuação): aparece rápido, como um app trocando de tela.
  const tela = continuaAntes
    ? interpolate(frame, [0, 5], [0.35, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: `${caixa.x}%`,
          top: `${caixa.y}%`,
          width: `${caixa.largura}%`,
          height: `${caixa.altura}%`,
          transform: `translateY(${(1 - sobe + desce) * (height - (caixa.y / 100) * height + alturaPx * 0.1) * 0.9}px) rotate(${(insert.rotacao ?? 0) - (1 - sobe) * 7}deg)`,
          opacity: Math.min(1, sobe * 3) * (1 - desce * 0.6),
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: raio,
            background:
              "linear-gradient(145deg, #3B3E4B 0%, #15161C 42%, #2B2D38 100%)",
            boxShadow: `0 ${u * 3}px ${u * 8}px rgba(0,0,0,0.55), 0 0 ${u * 5}px rgba(124,58,237,0.35), inset 0 0 0 ${Math.max(1, u * 0.25)}px rgba(255,255,255,0.2)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: borda,
            borderRadius: raio - borda,
            overflow: "hidden",
            backgroundColor: "#000",
          }}
        >
          <div style={{ position: "absolute", inset: 0, opacity: tela }}>
            <Midia insert={insert} />
          </div>
          <div
            style={{
              position: "absolute",
              top: larguraPx * 0.03,
              left: "50%",
              width: larguraPx * 0.28,
              height: larguraPx * 0.075,
              transform: "translateX(-50%)",
              borderRadius: larguraPx,
              backgroundColor: "#000",
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ConteudoInsert: React.FC<{
  insert: Insert;
  duracao: number;
  continuaAntes: boolean;
  continuaDepois: boolean;
}> = ({ insert, duracao, continuaAntes, continuaDepois }) => {
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

  if (insert.acabamento?.celular) {
    return (
      <Celular
        insert={insert}
        caixa={caixa}
        duracao={duracao}
        continuaAntes={continuaAntes}
        continuaDepois={continuaDepois}
      />
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

// Dois inserts de celular colados (um termina quando o outro começa) no
// mesmo lugar: é o mesmo celular trocando de tela.
const mesmaCaixa = (a: Caixa, b: Caixa) =>
  Math.abs(a.x - b.x) < 0.6 &&
  Math.abs(a.y - b.y) < 0.6 &&
  Math.abs(a.largura - b.largura) < 0.6 &&
  Math.abs(a.altura - b.altura) < 0.6;
const colados = (antes: Insert, depois: Insert) =>
  !!antes.acabamento?.celular &&
  !!depois.acabamento?.celular &&
  Math.abs(antes.fim - depois.inicio) <= 0.1 &&
  mesmaCaixa(
    antes.caixa ?? caixaPadrao(antes.posicao),
    depois.caixa ?? caixaPadrao(depois.posicao),
  );

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
            <div data-item={`insert:${i}`} style={{ position: "absolute", inset: 0 }}>
              <ConteudoInsert
                insert={insert}
                duracao={duracao}
                continuaAntes={inserts.some(
                  (outro, j) => j !== i && colados(outro, insert),
                )}
                continuaDepois={inserts.some(
                  (outro, j) => j !== i && colados(insert, outro),
                )}
              />
            </div>
          </Sequence>
        );
      })}
    </>
  );
};
