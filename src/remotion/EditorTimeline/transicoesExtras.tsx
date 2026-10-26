import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";
import { Direcao } from "../../timeline/schema";

// Transições próprias do encEditor, no mesmo formato das do
// @remotion/transitions (servem na trilha principal e nos exemplos da aba
// Estilos). Regras de todas:
// - "saindo" com progresso 0 e "entrando" com progresso 1 desenham o quadro
//   normal, sem nenhum estilo (fora da transição a cena fica idêntica);
// - a ESTRUTURA é sempre a mesma (Camada), só o estilo muda: se o conteúdo
//   mudasse de lugar na árvore, o React recriaria os vídeos no começo e no
//   fim da transição e o preview "piscaria".

type Props = { direcao?: Direcao };
type PropsDoEfeito = TransitionPresentationComponentProps<Props>;

const LIMITE = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

const emRepouso = (p: PropsDoEfeito) =>
  (p.presentationDirection === "exiting" && p.presentationProgress === 0) ||
  (p.presentationDirection === "entering" && p.presentationProgress === 1);

// Número "aleatório" fixo para cada semente (o mesmo quadro sai sempre
// igual, no preview e no vídeo final).
export const aleatorio = (semente: number) => {
  const x = Math.sin(semente * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// Sempre: fora > dentro > conteúdo (+ uma camada por cima, opcional).
const Camada: React.FC<{
  fora?: React.CSSProperties;
  estilo?: React.CSSProperties;
  porCima?: React.ReactNode;
  children: React.ReactNode;
}> = ({ fora, estilo, porCima, children }) => (
  <AbsoluteFill style={fora}>
    <AbsoluteFill style={estilo}>{children}</AbsoluteFill>
    {porCima ?? null}
  </AbsoluteFill>
);

// Mergulho: a cena que sai aproxima e desfoca; a que entra vem de perto e
// foca.
const Mergulho: React.FC<PropsDoEfeito> = (props) => {
  const { children, presentationProgress: p } = props;
  const estilo: React.CSSProperties | undefined = emRepouso(props)
    ? undefined
    : props.presentationDirection === "exiting"
      ? {
          transform: `scale(${1 + p * 1.4})`,
          filter: `blur(${p * 14}px)`,
          opacity: interpolate(p, [0.55, 1], [1, 0], LIMITE),
        }
      : {
          transform: `scale(${1.9 - 0.9 * p})`,
          filter: `blur(${(1 - p) * 14}px)`,
          opacity: interpolate(p, [0, 0.45], [0, 1], LIMITE),
        };
  return <Camada estilo={estilo}>{children}</Camada>;
};

// Chicote (whip pan): as duas cenas correm juntas para o lado, borradas.
const VETOR: Record<Direcao, [number, number]> = {
  direita: [1, 0],
  esquerda: [-1, 0],
  baixo: [0, 1],
  cima: [0, -1],
};
const Chicote: React.FC<PropsDoEfeito> = (props) => {
  const { children, presentationProgress: p, passedProps } = props;
  const [vx, vy] = VETOR[passedProps.direcao ?? "direita"];
  // A cena nova entra do lado "direcao"; a antiga sai pelo lado oposto.
  const desloc =
    props.presentationDirection === "exiting" ? -p * 100 : (1 - p) * 100;
  const estilo: React.CSSProperties | undefined = emRepouso(props)
    ? undefined
    : {
        transform: `translate(${vx * desloc}%, ${vy * desloc}%) scale(1.04)`,
        filter: `blur(${Math.sin(Math.PI * p) * 22}px)`,
      };
  return <Camada estilo={estilo}>{children}</Camada>;
};

// Clarão: a cena antiga estoura de brilho, um flash branco cobre a troca e
// a nova aparece clareando.
const Clarao: React.FC<PropsDoEfeito> = (props) => {
  const { children, presentationProgress: p } = props;
  if (emRepouso(props)) return <Camada>{children}</Camada>;
  if (props.presentationDirection === "exiting") {
    return (
      <Camada estilo={{ filter: `brightness(${1 + p * 3})` }}>
        {children}
      </Camada>
    );
  }
  const flash = 1 - Math.min(1, Math.abs(p - 0.5) / 0.5);
  return (
    <Camada
      estilo={{
        opacity: interpolate(p, [0.42, 0.55], [0, 1], LIMITE),
        filter: `brightness(${1 + (1 - p) * 2.5})`,
      }}
      porCima={
        <AbsoluteFill
          style={{ backgroundColor: "white", opacity: flash * flash }}
        />
      }
    >
      {children}
    </Camada>
  );
};

// Faixas coloridas do glitch, sorteadas por "passo" (mudam a cada 2
// quadros).
export const FaixasDeGlitch: React.FC<{ semente: number; forca: number }> = ({
  semente,
  forca,
}) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {[0, 1, 2, 3].map((i) => {
      const r = aleatorio(semente * 7 + i);
      const altura = 2 + aleatorio(semente * 13 + i) * 9;
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${-10 + aleatorio(semente * 3 + i) * 20}%`,
            width: "120%",
            top: `${r * 100}%`,
            height: `${altura}%`,
            backgroundColor: i % 2 ? "#00f0ff" : "#ff1e5a",
            mixBlendMode: "difference",
            opacity: forca * (0.5 + 0.5 * aleatorio(semente + i * 5)),
          }}
        />
      );
    })}
  </AbsoluteFill>
);

// Falha (glitch): as cenas tremem, mudam de cor e trocam de uma vez no
// meio, com faixas coloridas por cima.
const Falha: React.FC<PropsDoEfeito> = (props) => {
  const { children, presentationProgress: p } = props;
  if (emRepouso(props)) return <Camada>{children}</Camada>;
  const forca = Math.max(0, 1 - Math.abs(p - 0.5) / 0.3);
  const passo = Math.floor(p * props.presentationDurationInFrames * 0.5);
  const entrando = props.presentationDirection === "entering";
  // A cena nova (por cima) só aparece da metade em diante.
  const visivel = entrando ? p >= 0.5 : true;
  const dx = (aleatorio(passo + 1) - 0.5) * 8 * forca;
  const inclinacao = (aleatorio(passo + 2) - 0.5) * 10 * forca;
  return (
    <Camada
      fora={{ opacity: visivel ? 1 : 0 }}
      estilo={{
        transform: `translateX(${dx}%) skewX(${inclinacao}deg)`,
        filter: `hue-rotate(${aleatorio(passo + 3) * 90 * forca}deg) saturate(${1 + forca}) contrast(${1 + forca * 0.5})`,
      }}
      porCima={
        entrando && forca > 0 ? (
          <FaixasDeGlitch semente={passo} forca={forca} />
        ) : null
      }
    >
      {children}
    </Camada>
  );
};

// Borrão: a cena antiga desfoca; a nova surge entrando em foco.
const Borrao: React.FC<PropsDoEfeito> = (props) => {
  const { children, presentationProgress: p } = props;
  const estilo: React.CSSProperties | undefined = emRepouso(props)
    ? undefined
    : props.presentationDirection === "exiting"
      ? { filter: `blur(${p * 20}px) brightness(${1 + p * 0.15})` }
      : {
          opacity: p,
          filter: `blur(${(1 - p) * 20}px) brightness(${1 + (1 - p) * 0.15})`,
        };
  return <Camada estilo={estilo}>{children}</Camada>;
};

// Giro: a cena antiga gira e aproxima até sumir; a nova chega girando.
const Giro: React.FC<PropsDoEfeito> = (props) => {
  const { children, presentationProgress: p } = props;
  const estilo: React.CSSProperties | undefined = emRepouso(props)
    ? undefined
    : props.presentationDirection === "exiting"
      ? {
          transform: `rotate(${p * 120}deg) scale(${1 + p * 1.6})`,
          filter: `blur(${p * 8}px)`,
          opacity: interpolate(p, [0.5, 1], [1, 0], LIMITE),
        }
      : {
          transform: `rotate(${-(1 - p) * 120}deg) scale(${2.6 - 1.6 * p})`,
          filter: `blur(${(1 - p) * 8}px)`,
          opacity: interpolate(p, [0, 0.5], [0, 1], LIMITE),
        };
  return <Camada estilo={estilo}>{children}</Camada>;
};

// Degradê: uma faixa azul→roxo atravessa a tela (de baixo para cima, salvo
// outra direção), cobre a cena antiga e, ao passar, revela a nova.
const Degrade: React.FC<PropsDoEfeito> = (props) => {
  const { children, presentationProgress: p, passedProps } = props;
  if (emRepouso(props) || props.presentationDirection === "exiting") {
    return <Camada>{children}</Camada>;
  }
  // "direcao" = de onde a faixa vem (padrão: de baixo). A faixa tem 1,5
  // tela de comprimento: a frente é sólida e a traseira some no
  // transparente. Ela entra por um lado e sai pelo outro; no meio da
  // transição cobre a tela toda e é aí que a cena troca.
  const de = passedProps.direcao ?? "baixo";
  const vertical = de === "baixo" || de === "cima";
  const pos = de === "baixo" || de === "direita" ? 100 - p * 250 : -150 + p * 250;
  const angulo = { baixo: 180, cima: 0, direita: 90, esquerda: 270 }[de];
  return (
    <Camada
      estilo={{ opacity: p >= 0.5 ? 1 : 0 }}
      porCima={
        <div
          style={{
            position: "absolute",
            ...(vertical
              ? { left: 0, width: "100%", top: `${pos}%`, height: "150%" }
              : { top: 0, height: "100%", left: `${pos}%`, width: "150%" }),
            background: `linear-gradient(${angulo}deg, #2DD4FF 0%, #4F7BFF 40%, #A855F7 85%, rgba(168,85,247,0) 100%)`,
          }}
        />
      }
    >
      {children}
    </Camada>
  );
};

const EFEITOS = {
  mergulho: Mergulho,
  chicote: Chicote,
  clarao: Clarao,
  falha: Falha,
  borrao: Borrao,
  giro: Giro,
  degrade: Degrade,
};

export type TransicaoExtra = keyof typeof EFEITOS;

export const ehTransicaoExtra = (tipo: string): tipo is TransicaoExtra =>
  tipo in EFEITOS;

export const transicaoExtra = (
  tipo: TransicaoExtra,
  direcao: Direcao | undefined,
): TransitionPresentation<Props> => ({
  component: EFEITOS[tipo],
  props: { direcao },
});
