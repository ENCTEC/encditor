import React from "react";
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";
import { EstiloFundo } from "../../timeline/schema";

// Fundos animados: cenas da trilha principal desenhadas pelo próprio vídeo
// (sem arquivo), para vídeos feitos só de motion — o texto falado e os
// grafismos ficam por cima. Tudo se mexe devagar (nunca fica parado) e é
// igual em qualquer quadro do preview e do vídeo final.

// Brilhos e anéis do neon (também a base do "formas").
const Neon: React.FC<{ t: number; lado: number }> = ({ t, lado }) => {
  const anel = (raio: number, opacidade: number, giro: number) => (
    <circle
      key={raio}
      cx="50%"
      cy="58%"
      r={raio * lado}
      fill="none"
      stroke={`rgba(124, 58, 237, ${opacidade})`}
      strokeWidth={Math.max(1.5, lado * 0.0025)}
      strokeDasharray={`${lado * 0.9} ${lado * 0.25}`}
      style={{
        transform: `rotate(${giro}deg)`,
        transformOrigin: "50% 58%",
        transformBox: "view-box",
      }}
    />
  );
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 42%, #10123A 0%, #080A1C 52%, #04050D 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: lado * 1.1,
          height: lado * 1.1,
          left: `${12 + 6 * Math.sin(t / 7)}%`,
          top: `${8 + 4 * Math.cos(t / 9)}%`,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(124, 58, 237, 0.42) 0%, rgba(124, 58, 237, 0) 65%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: lado * 1.2,
          height: lado * 1.2,
          left: `${86 - 5 * Math.sin(t / 8)}%`,
          top: `${86 + 4 * Math.sin(t / 6)}%`,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(14, 165, 233, 0.30) 0%, rgba(14, 165, 233, 0) 65%)",
        }}
      />
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        {anel(0.42, 0.28, t * 4)}
        {anel(0.62, 0.16, -t * 3)}
        {anel(0.86, 0.1, t * 2)}
      </svg>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

// Formas "3D" flutuando nas bordas (cubos, anéis, esferas, cápsulas),
// algumas desfocadas como se estivessem longe. O meio fica livre para o
// conteúdo.
const CORES = ["#7C3AED", "#4F46E5", "#2563EB", "#06B6D4", "#A855F7"];
const TIPOS = ["cubo", "anel", "esfera", "capsula"] as const;

// Cor #rrggbb mais escura (fator 0–1), para as faces de sombra do cubo
// (filtro CSS não vale dentro de SVG).
const escurecer = (cor: string, fator: number) => {
  const [r, g, b] = /^#(..)(..)(..)$/
    .exec(cor)!
    .slice(1)
    .map((x) => Math.round(parseInt(x, 16) * fator));
  return `rgb(${r}, ${g}, ${b})`;
};

const Forma: React.FC<{
  tipo: (typeof TIPOS)[number];
  cor: string;
  tamanho: number;
}> = ({ tipo, cor, tamanho }) => {
  if (tipo === "cubo") {
    return (
      <svg width={tamanho} height={tamanho} viewBox="-1 -1 2 2">
        <polygon points="0,-0.95 0.82,-0.47 0,0 -0.82,-0.47" fill={cor} />
        <polygon
          points="-0.82,-0.47 0,0 0,0.95 -0.82,0.47"
          fill={escurecer(cor, 0.7)}
        />
        <polygon
          points="0.82,-0.47 0.82,0.47 0,0.95 0,0"
          fill={escurecer(cor, 0.45)}
        />
      </svg>
    );
  }
  if (tipo === "anel") {
    return (
      <div
        style={{
          width: tamanho,
          height: tamanho * 0.62,
          borderRadius: "50%",
          border: `${tamanho * 0.17}px solid ${cor}`,
          boxShadow: `inset 0 ${tamanho * 0.05}px ${tamanho * 0.06}px rgba(255,255,255,0.35), 0 ${tamanho * 0.06}px ${tamanho * 0.1}px rgba(0,0,0,0.4)`,
        }}
      />
    );
  }
  if (tipo === "esfera") {
    return (
      <div
        style={{
          width: tamanho * 0.8,
          height: tamanho * 0.8,
          borderRadius: "50%",
          background: `radial-gradient(circle at 35% 30%, #E0F7FF 0%, ${cor} 38%, #0B1030 100%)`,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: tamanho * 0.42,
        height: tamanho,
        borderRadius: tamanho,
        background: `linear-gradient(90deg, ${cor} 0%, #E0D4FF 45%, ${cor} 70%, #1B1446 100%)`,
      }}
    />
  );
};

const Formas: React.FC<{ t: number; lado: number }> = ({ t, lado }) => (
  <AbsoluteFill>
    {Array.from({ length: 14 }, (_, i) => {
      const r = (n: string) => random(`forma-${i}-${n}`);
      // Metade de cada lado; as de cima/baixo um pouco para dentro.
      const lado1 = i % 2 === 0;
      const x = lado1 ? r("x") * 20 - 4 : 84 + r("x") * 20;
      const y = 4 + (i / 14) * 92 + (r("y") - 0.5) * 8;
      const longe = r("longe") < 0.35;
      const tamanho = lado * (longe ? 0.04 + r("t") * 0.03 : 0.07 + r("t") * 0.07);
      const flutua = Math.sin(t * (0.6 + r("v")) + r("f") * 6.28) * lado * 0.02;
      const giro = (r("g") - 0.5) * 60 + t * (r("gv") - 0.5) * 30;
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${x}%`,
            top: `${y}%`,
            transform: `translate(-50%, calc(-50% + ${flutua}px)) rotate(${giro}deg)`,
            filter: longe ? `blur(${lado * 0.004}px)` : undefined,
            opacity: longe ? 0.55 : 0.95,
          }}
        >
          <Forma
            tipo={TIPOS[Math.floor(r("tipo") * TIPOS.length)]}
            cor={CORES[Math.floor(r("cor") * CORES.length)]}
            tamanho={tamanho}
          />
        </div>
      );
    })}
  </AbsoluteFill>
);

// Papel claro com retícula e grão (a cara do encEditor).
const Papel: React.FC<{ t: number; lado: number }> = ({ t, lado }) => (
  <AbsoluteFill style={{ backgroundColor: "#EBE8E1" }}>
    <AbsoluteFill
      style={{
        backgroundImage:
          "radial-gradient(rgba(17,17,16,0.13) 1px, transparent 1.6px)",
        backgroundSize: `${lado * 0.012}px ${lado * 0.012}px`,
        backgroundPosition: `${Math.sin(t / 5) * lado * 0.004}px 0`,
      }}
    />
    <div
      style={{
        position: "absolute",
        width: lado * 0.9,
        height: lado * 0.9,
        left: `${80 + 4 * Math.sin(t / 6)}%`,
        top: `${14 + 3 * Math.cos(t / 7)}%`,
        transform: "translate(-50%, -50%)",
        borderRadius: "50%",
        background:
          "radial-gradient(circle, rgba(225, 37, 27, 0.16) 0%, rgba(225, 37, 27, 0) 62%)",
      }}
    />
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 60%, rgba(60,50,40,0.22) 100%)",
      }}
    />
  </AbsoluteFill>
);

export const FundoAnimado: React.FC<{ estilo: EstiloFundo }> = ({ estilo }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const lado = Math.min(width, height);
  if (estilo === "papel") return <Papel t={t} lado={lado} />;
  return (
    <AbsoluteFill>
      <Neon t={t} lado={lado} />
      {estilo === "formas" ? <Formas t={t} lado={lado} /> : null}
    </AbsoluteFill>
  );
};
