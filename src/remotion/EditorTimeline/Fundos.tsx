import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  random,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AjustesDoFundo, EstiloFundo } from "../../timeline/schema";

// Fundos animados: cenas da trilha principal desenhadas pelo próprio vídeo
// (sem arquivo), para vídeos feitos só de motion — o texto falado e os
// grafismos ficam por cima. Todos usam a PALETA do vídeo (direção de arte:
// [principal, secundária, destaque]), têm "energia" (calmo ↔ agitado) e
// podem pulsar com a voz (ajustes.onda). Nunca ficam parados e são iguais em
// qualquer quadro do preview e do vídeo final.

// Paleta padrão de cada estilo (quando o vídeo não tem direção de arte).
const PALETA_PADRAO: Record<EstiloFundo, string[]> = {
  neon: ["#7C3AED", "#0EA5E9", "#A855F7"],
  formas: ["#7C3AED", "#2563EB", "#06B6D4"],
  brilhos: ["#7C3AED", "#0EA5E9", "#F472B6"],
  ondas: ["#06B6D4", "#7C3AED", "#A855F7"],
  grade: ["#EC4899", "#06B6D4", "#A855F7"],
  gradiente: ["#7C3AED", "#EC4899", "#F59E0B"],
  claro: ["#F472B6", "#FBBF24", "#EC4899"],
  papel: ["#E1251B", "#111110", "#E1251B"],
};

// Fundos claros (o texto por cima fica escuro).
export const FUNDOS_CLAROS: EstiloFundo[] = ["papel", "claro"];

const hex = (cor: string) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(cor.trim());
  return m ? m.slice(1).map((x) => parseInt(x, 16)) : [124, 58, 237];
};
const rgba = (cor: string, a: number) => {
  const [r, g, b] = hex(cor);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};
// Mistura com preto (f < 1) ou com branco (claro = true).
const tom = (cor: string, f: number, claro = false) => {
  const [r, g, b] = hex(cor).map((v) =>
    Math.round(claro ? v + (255 - v) * f : v * f),
  );
  return `rgb(${r}, ${g}, ${b})`;
};

type Base = {
  t: number; // segundos desde o começo da cena, já na velocidade da energia
  lado: number;
  largura: number;
  altura: number;
  cores: string[];
  voz: number; // 0 a 1: volume da fala agora (0 sem onda)
};

// Fundo escuro na cor principal, com vinheta.
const Escuro: React.FC<Base & { children?: React.ReactNode }> = ({
  cores,
  children,
}) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse at 50% 42%, ${tom(cores[0], 0.2)} 0%, ${tom(cores[0], 0.09)} 52%, #04040A 100%)`,
    }}
  >
    {children}
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)",
      }}
    />
  </AbsoluteFill>
);

// Uma "luz" desfocada.
const Luz: React.FC<{
  x: number;
  y: number;
  tamanho: number;
  cor: string;
  forca: number;
}> = ({ x, y, tamanho, cor, forca }) => (
  <div
    style={{
      position: "absolute",
      width: tamanho,
      height: tamanho,
      left: `${x}%`,
      top: `${y}%`,
      transform: "translate(-50%, -50%)",
      borderRadius: "50%",
      background: `radial-gradient(circle, ${rgba(cor, forca)} 0%, ${rgba(cor, 0)} 65%)`,
    }}
  />
);

// Neon: duas luzes grandes passeando e anéis finos girando.
const Neon: React.FC<Base> = (b) => {
  const { t, lado, cores, voz } = b;
  const anel = (raio: number, opacidade: number, giro: number) => (
    <circle
      key={raio}
      cx="50%"
      cy="58%"
      r={raio * lado * (1 + voz * 0.04)}
      fill="none"
      stroke={rgba(cores[2] ?? cores[0], opacidade * (0.8 + voz * 0.8))}
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
    <Escuro {...b}>
      <Luz x={12 + 6 * Math.sin(t / 7)} y={8 + 4 * Math.cos(t / 9)} tamanho={lado * 1.1} cor={cores[0]} forca={0.42 + voz * 0.25} />
      <Luz x={86 - 5 * Math.sin(t / 8)} y={86 + 4 * Math.sin(t / 6)} tamanho={lado * 1.2} cor={cores[1]} forca={0.3 + voz * 0.25} />
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        {anel(0.42, 0.3, t * 4)}
        {anel(0.62, 0.17, -t * 3)}
        {anel(0.86, 0.1, t * 2)}
      </svg>
    </Escuro>
  );
};

// Formas "3D" flutuando nas bordas (cubos, anéis, esferas, cápsulas),
// algumas desfocadas como se estivessem longe. O meio fica livre para o
// conteúdo. Chegam voando no começo da cena.
const TIPOS = ["cubo", "anel", "esfera", "capsula"] as const;

const Forma: React.FC<{
  tipo: (typeof TIPOS)[number];
  cor: string;
  tamanho: number;
}> = ({ tipo, cor, tamanho }) => {
  if (tipo === "cubo") {
    return (
      <svg width={tamanho} height={tamanho} viewBox="-1 -1 2 2">
        <polygon points="0,-0.95 0.82,-0.47 0,0 -0.82,-0.47" fill={tom(cor, 1)} />
        <polygon points="-0.82,-0.47 0,0 0,0.95 -0.82,0.47" fill={tom(cor, 0.7)} />
        <polygon points="0.82,-0.47 0.82,0.47 0,0.95 0,0" fill={tom(cor, 0.45)} />
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
          background: `radial-gradient(circle at 35% 30%, ${tom(cor, 0.75, true)} 0%, ${cor} 38%, ${tom(cor, 0.15)} 100%)`,
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
        background: `linear-gradient(90deg, ${cor} 0%, ${tom(cor, 0.7, true)} 45%, ${cor} 70%, ${tom(cor, 0.25)} 100%)`,
      }}
    />
  );
};

const Formas: React.FC<Base> = (b) => {
  const { t, lado, cores, voz } = b;
  return (
    <AbsoluteFill>
      <Neon {...b} />
      {Array.from({ length: 14 }, (_, i) => {
        const r = (n: string) => random(`forma-${i}-${n}`);
        const x = i % 2 === 0 ? r("x") * 20 - 4 : 84 + r("x") * 20;
        const y = 4 + (i / 14) * 92 + (r("y") - 0.5) * 8;
        const longe = r("longe") < 0.35;
        const tamanho = lado * (longe ? 0.04 + r("t") * 0.03 : 0.07 + r("t") * 0.07);
        const flutua = Math.sin(t * (0.6 + r("v")) + r("f") * 6.28) * lado * 0.02;
        const giro = (r("g") - 0.5) * 60 + t * (r("gv") - 0.5) * 30;
        const chega = interpolate(t, [i * 0.04, i * 0.04 + 0.55], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.back(1.7)),
        });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              transform: `translate(-50%, calc(-50% + ${flutua + (1 - chega) * lado * 0.08}px)) rotate(${giro - (1 - chega) * 90}deg) scale(${chega * (1 + voz * 0.06)})`,
              filter: longe ? `blur(${lado * 0.004}px)` : undefined,
              opacity: longe ? 0.55 : 0.95,
            }}
          >
            <Forma
              tipo={TIPOS[Math.floor(r("tipo") * TIPOS.length)]}
              cor={cores[Math.floor(r("cor") * cores.length)]}
              tamanho={tamanho}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// Brilhos (bokeh): luzes desfocadas de tamanhos diferentes subindo devagar
// e piscando.
const Brilhos: React.FC<Base> = (b) => {
  const { t, lado, cores, voz } = b;
  return (
    <Escuro {...b}>
      {Array.from({ length: 22 }, (_, i) => {
        const r = (n: string) => random(`brilho-${i}-${n}`);
        const tamanho = lado * (0.05 + r("t") * 0.22);
        const y = ((r("y") * 120 - t * (2 + r("v") * 4)) % 120 + 120) % 120 - 10;
        const x = r("x") * 100 + Math.sin(t / 3 + i) * 3;
        const pisca = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * (0.8 + r("p")) + i));
        return (
          <Luz key={i} x={x} y={y} tamanho={tamanho} cor={cores[i % cores.length]} forca={Math.min(0.9, pisca + voz * 0.3)} />
        );
      })}
    </Escuro>
  );
};

// Ondas: faixas de luz ondulando (parecem som), mais altas quando a voz
// está forte.
const Ondas: React.FC<Base> = (b) => {
  const { t, largura, altura, lado, cores, voz } = b;
  const linhas = 5;
  return (
    <Escuro {...b}>
      <Luz x={50} y={72} tamanho={lado * 1.3} cor={cores[0]} forca={0.28 + voz * 0.2} />
      <svg width={largura} height={altura} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: linhas }, (_, i) => {
          const base = altura * (0.62 + i * 0.05);
          const amp = altura * (0.03 + 0.02 * i) * (1 + voz * 1.4);
          const fase = t * (0.8 + i * 0.25) + i;
          const pontos = Array.from({ length: 41 }, (_, k) => {
            const x = (k / 40) * largura;
            const y = base + Math.sin(k / 5 + fase) * amp * Math.sin((k / 40) * Math.PI);
            return `${k ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
          }).join(" ");
          const cor = cores[i % cores.length];
          return (
            <path
              key={i}
              d={pontos}
              fill="none"
              stroke={rgba(cor, 0.75 - i * 0.1)}
              strokeWidth={lado * (0.006 - i * 0.0007)}
              style={{ filter: `drop-shadow(0 0 ${lado * 0.012}px ${rgba(cor, 0.9)})` }}
            />
          );
        })}
      </svg>
    </Escuro>
  );
};

// Grade em perspectiva correndo para a frente, com o horizonte brilhando.
const Grade: React.FC<Base> = (b) => {
  const { t, largura, altura, lado, cores, voz } = b;
  const horizonte = altura * 0.58;
  const corrida = (t * 0.6) % 1;
  return (
    <Escuro {...b}>
      <Luz x={50} y={58} tamanho={lado * 1.4} cor={cores[0]} forca={0.45 + voz * 0.3} />
      <svg width={largura} height={altura} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: 13 }, (_, i) => {
          const fr = ((i + corrida) / 12) ** 2.2;
          const y = horizonte + (altura - horizonte) * fr;
          return <line key={`h${i}`} x1={0} x2={largura} y1={y} y2={y} stroke={rgba(cores[1], 0.15 + fr * 0.55)} strokeWidth={Math.max(1, lado * 0.003)} />;
        })}
        {Array.from({ length: 17 }, (_, i) => {
          const x = largura / 2 + (i - 8) * largura * 0.09;
          const xBase = largura / 2 + (i - 8) * largura * 0.5;
          return <line key={`v${i}`} x1={x} y1={horizonte} x2={xBase} y2={altura} stroke={rgba(cores[1], 0.45)} strokeWidth={Math.max(1, lado * 0.003)} />;
        })}
        <rect x={0} y={horizonte - lado * 0.004} width={largura} height={lado * 0.008} fill={rgba(cores[2] ?? cores[0], 0.9)} style={{ filter: `drop-shadow(0 0 ${lado * 0.02}px ${rgba(cores[2] ?? cores[0], 1)})` }} />
      </svg>
    </Escuro>
  );
};

// Gradiente: três manchas grandes de cor se misturando e passeando (vivo,
// sem fundo preto).
const Gradiente: React.FC<Base> = (b) => {
  const { t, lado, cores, voz } = b;
  return (
    <AbsoluteFill style={{ background: tom(cores[0], 0.45) }}>
      {cores.map((cor, i) => (
        <Luz
          key={i}
          x={50 + 35 * Math.sin(t / (4 + i) + i * 2)}
          y={50 + 35 * Math.cos(t / (5 + i) + i)}
          tamanho={lado * (1.6 + voz * 0.2)}
          cor={cor}
          forca={0.75}
        />
      ))}
      {/* Um pouco mais escuro no meio, onde fica o texto. */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(10,6,20,0.38) 0%, rgba(10,6,20,0.15) 55%, rgba(0,0,0,0.35) 100%)" }} />
    </AbsoluteFill>
  );
};

// Claro: fundo claro e limpo com manchas suaves de cor passeando.
const Claro: React.FC<Base> = (b) => {
  const { t, lado, cores, voz } = b;
  return (
    <AbsoluteFill style={{ background: tom(cores[0], 0.94, true) }}>
      {cores.map((cor, i) => (
        <Luz
          key={i}
          x={[15, 85, 60][i] + 8 * Math.sin(t / (5 + i) + i)}
          y={[12, 30, 88][i] + 6 * Math.cos(t / (6 + i))}
          tamanho={lado * (0.9 + i * 0.2)}
          cor={cor}
          forca={0.28 + voz * 0.15}
        />
      ))}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${rgba(cores[1] ?? cores[0], 0.12)} 1px, transparent 1.6px)`,
          backgroundSize: `${lado * 0.02}px ${lado * 0.02}px`,
        }}
      />
    </AbsoluteFill>
  );
};

// Papel claro com retícula e uma mancha de spray (a cara do encEditor).
const Papel: React.FC<Base> = (b) => {
  const { t, lado, cores } = b;
  return (
    <AbsoluteFill style={{ backgroundColor: "#EBE8E1" }}>
      <AbsoluteFill
        style={{
          backgroundImage: "radial-gradient(rgba(17,17,16,0.13) 1px, transparent 1.6px)",
          backgroundSize: `${lado * 0.012}px ${lado * 0.012}px`,
          backgroundPosition: `${Math.sin(t / 5) * lado * 0.004}px 0`,
        }}
      />
      <Luz x={80 + 4 * Math.sin(t / 6)} y={14 + 3 * Math.cos(t / 7)} tamanho={lado * 0.9} cor={cores[0]} forca={0.16} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 60%, rgba(60,50,40,0.22) 100%)" }} />
    </AbsoluteFill>
  );
};

const ESTILOS: Record<EstiloFundo, React.FC<Base>> = {
  neon: Neon,
  formas: Formas,
  brilhos: Brilhos,
  ondas: Ondas,
  grade: Grade,
  gradiente: Gradiente,
  claro: Claro,
  papel: Papel,
};

export const paletaDoFundo = (
  estilo: EstiloFundo,
  ajustes?: AjustesDoFundo,
  paletaDoVideo?: string[],
) => {
  const cores = ajustes?.cores ?? paletaDoVideo ?? PALETA_PADRAO[estilo];
  return cores.length >= 3 ? cores : [...cores, cores[0]];
};

export const FundoAnimado: React.FC<{
  estilo: EstiloFundo;
  ajustes?: AjustesDoFundo;
  // Cores da direção de arte do vídeo (quando a cena não tem as suas).
  paleta?: string[];
}> = ({ estilo, ajustes, paleta }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = frame / fps;
  // Energia: 0 = bem devagar, 1 = agitado (o tempo "corre" mais rápido).
  const energia = ajustes?.energia ?? 0.5;
  const onda = ajustes?.onda;
  const i = onda ? Math.floor((s - onda.de) * onda.taxa) : -1;
  const voz = onda && i >= 0 && i < onda.valores.length ? onda.valores[i] : 0;
  const Estilo = ESTILOS[estilo] ?? Neon;
  return (
    <Estilo
      t={s * (0.5 + energia * 1.5)}
      lado={Math.min(width, height)}
      largura={width}
      altura={height}
      cores={paletaDoFundo(estilo, ajustes, paleta)}
      voz={voz * (0.6 + energia * 0.6)}
    />
  );
};
