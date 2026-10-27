import React, { createContext } from "react";
import { AbsoluteFill, spring, useVideoConfig } from "remotion";
import { Motion } from "../../timeline/schema";

// Peças comuns a todos os motions (Motions.tsx e MotionsNeon.tsx). Tudo é
// medido em "u" = 1% do lado menor do vídeo, então o mesmo modelo serve em
// 9:16, 16:9, 1:1 e 4:5. Em qualquer texto, *palavra* entre asteriscos sai
// na cor de destaque.

export const TINTA = "#111110";
export const PAPEL = "#EBE8E1";
export const BRANCO = "#FFFFFF";
export const AMARELO = "#FFD60A";
export const VERMELHO = "#E1251B";

export const LIMITE = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

export const CONTORNO = (u: number) =>
  `0 ${u * 0.3}px ${u * 1.2}px rgba(0,0,0,0.55), 0 0 ${u * 0.25}px rgba(0,0,0,0.8)`;

// "*palavra*" → palavra na cor de destaque.
export const comDestaque = (texto: string, cor: string) =>
  texto.split(/(\*[^*]+\*)/g).map((parte, i) =>
    parte.startsWith("*") && parte.endsWith("*") && parte.length > 2 ? (
      <span key={i} style={{ color: cor }}>
        {parte.slice(1, -1)}
      </span>
    ) : (
      <React.Fragment key={i}>{parte}</React.Fragment>
    ),
  );

export const semAsteriscos = (texto: string) => texto.replace(/\*/g, "");

// Letra menor para textos longos.
export const tamanhoPeloTexto = (texto: string, grande: number, u: number) => {
  const n = semAsteriscos(texto).length;
  return (
    u *
    (n <= 10
      ? grande
      : n <= 18
        ? grande * 0.85
        : n <= 28
          ? grande * 0.7
          : grande * 0.55)
  );
};

export type Ctx = {
  motion: Motion;
  frame: number;
  fps: number;
  duracao: number;
  u: number;
  largura: number;
  altura: number;
  // Cor de destaque escolhida (sem valor = a padrão do modelo).
  cor: string;
  corEscolhida: boolean;
  // 1 → 0 nos últimos quadros.
  saida: number;
  // Paleta da direção de arte do vídeo ([principal, secundária, destaque])
  // e se o fundo atrás do motion é claro (texto solto fica escuro).
  paleta: string[] | null;
  claro: boolean;
};

// Tema do vídeo para os motions: a paleta da direção de arte e quando o
// fundo é claro (papel, claro). Vem do EditorTimeline.
export type TemaDoVideo = {
  cores: string[] | null;
  fundoClaroEm: (segundo: number) => boolean;
};
export const TemaContexto = createContext<TemaDoVideo>({
  cores: null,
  fundoClaroEm: () => false,
});

export const entrada = (c: Ctx, atraso = 0, rigidez = 170, amortecimento = 13) =>
  spring({
    frame: c.frame - atraso,
    fps: c.fps,
    config: { stiffness: rigidez, damping: amortecimento, mass: 0.7 },
  });

// Onde o bloco fica: topo / centro / base (a base fica acima das legendas).
// As margens são em u (1% do lado menor): porcentagem no padding do CSS é
// sempre da LARGURA, e no vídeo deitado a "base" ia parar no meio da tela.
export const Lugar: React.FC<{
  posicao: Motion["posicao"];
  padrao: NonNullable<Motion["posicao"]>;
  children: React.ReactNode;
  estilo?: React.CSSProperties;
}> = ({ posicao, padrao, children, estilo }) => {
  const p = posicao ?? padrao;
  const { width, height } = useVideoConfig();
  const u = Math.min(width, height) / 100;
  return (
    <AbsoluteFill
      style={{
        justifyContent:
          p === "topo" ? "flex-start" : p === "base" ? "flex-end" : "center",
        alignItems: "center",
        paddingTop: p === "topo" ? u * 13 : 0,
        paddingBottom: p === "base" ? u * 24 : 0,
        paddingLeft: "6%",
        paddingRight: "6%",
        ...estilo,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
