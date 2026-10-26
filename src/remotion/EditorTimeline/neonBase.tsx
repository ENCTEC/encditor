import React from "react";
import { ModeloMotion } from "../../timeline/schema";
import { LINHA_BARRA } from "../../timeline/palavras";
import { BRANCO, Ctx } from "./motionBase";

// Peças comuns do kit "neon" (MotionsNeon.tsx e MotionsTelas.tsx): cores,
// degradê, texto em degradê, palavras com destaque e o tempo de cada uma.

export const COR_NEON = "#8B5CF6";
export const CIANO = "#2DD4FF";
export const AZUL = "#4F7BFF";
export const ROXO = "#A855F7";
export const MAGENTA = "#FF3DCB";
export const VIDRO = "rgba(14, 16, 32, 0.88)";
export const LINHA_VIDRO = "rgba(255, 255, 255, 0.13)";
export const CINZA = "rgba(255, 255, 255, 0.62)";

export const MODELOS_DO_KIT_NEON = [
  "fala",
  "etiqueta",
  "anel",
  "digitando",
  "barra",
  "comentario",
  "curtida",
  "toque",
  "brilho",
  "microfone",
  "confirmado",
  "conversa",
  "edicao",
  "rec",
] as const satisfies readonly ModeloMotion[];
export type ModeloNeon = (typeof MODELOS_DO_KIT_NEON)[number];

export const ehModeloNeon = (m: ModeloMotion): m is ModeloNeon =>
  (MODELOS_DO_KIT_NEON as readonly string[]).includes(m);

// "#rrggbb" → rgba com transparência (outra cor qualquer fica como está).
export const comAlfa = (cor: string, alfa: number) => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(cor);
  return m
    ? `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alfa})`
    : cor;
};

// Mistura duas cores #rrggbb (t = 0 → a, 1 → b).
export const misturar = (a: string, b: string, t: number) => {
  const ca = /^#(..)(..)(..)$/.exec(a)!.slice(1).map((x) => parseInt(x, 16));
  const cb = /^#(..)(..)(..)$/.exec(b)!.slice(1).map((x) => parseInt(x, 16));
  const [r, g, bl] = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `rgb(${r}, ${g}, ${bl})`;
};

// Degradê do kit (ou a cor escolhida, lisa) e a cor do brilho.
export const degrade = (c: Ctx, angulo = 90) =>
  c.corEscolhida
    ? `linear-gradient(${angulo}deg, ${c.cor}, ${c.cor})`
    : `linear-gradient(${angulo}deg, ${CIANO} 0%, ${AZUL} 48%, ${ROXO} 100%)`;
export const corDoBrilho = (c: Ctx) => (c.corEscolhida ? c.cor : COR_NEON);
export const corNaPosicao = (c: Ctx, t: number) =>
  c.corEscolhida
    ? c.cor
    : t < 0.5
      ? misturar(CIANO, AZUL, t * 2)
      : misturar(AZUL, ROXO, (t - 0.5) * 2);

// Texto em degradê com brilho. Sombra de texto não serve aqui (cobriria o
// degradê): o brilho e o "fantasma" colorido da entrada usam drop-shadow.
export const TextoDegrade: React.FC<{
  c: Ctx;
  children: React.ReactNode;
  estilo?: React.CSSProperties;
  filtroExtra?: string;
}> = ({ c, children, estilo, filtroExtra }) => (
  <span
    style={{
      backgroundImage: degrade(c),
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
      WebkitTextFillColor: "transparent",
      ...estilo,
      filter: `${filtroExtra ?? ""} drop-shadow(0 0 ${c.u * 1.1}px ${comAlfa(corDoBrilho(c), 0.55)})`,
    }}
  >
    {children}
  </span>
);

// Texto com *destaque* em degradê (o resto na cor normal).
export const TextoNeon: React.FC<{ c: Ctx; texto: string }> = ({ c, texto }) => (
  <>
    {texto.split(/(\*[^*]+\*)/g).map((parte, i) =>
      parte.startsWith("*") && parte.endsWith("*") && parte.length > 2 ? (
        <TextoDegrade key={i} c={c}>
          {parte.slice(1, -1)}
        </TextoDegrade>
      ) : (
        <React.Fragment key={i}>{parte}</React.Fragment>
      ),
    )}
  </>
);

// Palavras do texto em linhas ("|" quebra a linha), cada uma sabendo se
// está em *destaque*. "*muito bom*" marca as duas palavras. O "indice" é a
// posição da palavra no texto todo (a mesma de motion.palavras).
// A linha "[barra]" vira uma barra de nível (barra = true, sem palavras).
export type Pedaco = { texto: string; destaque: boolean; indice: number };
export type Linha = { barra: boolean; pedacos: Pedaco[] };
export const linhasDoTexto = (texto: string): Linha[] => {
  let indice = 0;
  let dentro = false;
  return texto.split("|").map((linha) =>
    linha.trim().toLowerCase() === LINHA_BARRA
      ? { barra: true, pedacos: [] }
      : {
          barra: false,
          pedacos: linha
            .split(/\s+/)
            .filter(Boolean)
            .flatMap((bruto) => {
              const destaque = dentro || bruto.startsWith("*");
              if ((bruto.match(/\*/g)?.length ?? 0) % 2 === 1) dentro = !dentro;
              const limpo = bruto.replace(/\*/g, "");
              return limpo ? [{ texto: limpo, destaque, indice: indice++ }] : [];
            }),
        },
  );
};
export const pedacos = (texto: string): Pedaco[][] =>
  linhasDoTexto(texto)
    .filter((l) => !l.barra)
    .map((l) => l.pedacos);

// Quadro (contado do início do motion) em que cada palavra aparece: o da
// fala, quando se sabe o tempo de cada palavra; senão um ritmo fixo.
export const quadrosDasPalavras = (
  c: Ctx,
  n: number,
  primeiro = 2,
  ditas = c.motion.palavras,
) => {
  if (ditas && ditas.length === n) {
    return ditas.map((p) => Math.max(0, Math.round(p.de * c.fps)));
  }
  const ritmo = Math.max(
    2,
    Math.min(0.3 * c.fps, (c.duracao * 0.5) / Math.max(1, n)),
  );
  return Array.from({ length: n }, (_, i) => Math.round(primeiro + i * ritmo));
};

// Em x/y (% da tela), centrado; sem x/y, no lugar padrão.
export const NoPonto: React.FC<{
  c: Ctx;
  x: number;
  y: number;
  children: React.ReactNode;
}> = ({ c, x, y, children }) => (
  <div
    style={{
      position: "absolute",
      left: ((c.motion.x ?? x) / 100) * c.largura,
      top: ((c.motion.y ?? y) / 100) * c.altura,
      transform: "translate(-50%, -50%)",
    }}
  >
    {children}
  </div>
);

// Ícone de microfone (desenho próprio), centrado em (0, 0), altura ~2.
export const IconeMicrofone: React.FC<{ tamanho: number; cor?: string }> = ({
  tamanho,
  cor = BRANCO,
}) => (
  <svg width={tamanho} height={tamanho} viewBox="-12 -12 24 24">
    <rect x={-3.6} y={-10} width={7.2} height={12.5} rx={3.6} fill={cor} />
    <path
      d="M -7 0 A 7 7 0 0 0 7 0 M 0 7 L 0 10.5 M -4 10.5 L 4 10.5"
      fill="none"
      stroke={cor}
      strokeWidth={2.2}
      strokeLinecap="round"
    />
  </svg>
);

// Mão de "curtir" (desenho próprio) num quadrado 24×24.
export const MAO =
  "M2 10.5h4.2V21H2z M7.6 21h9.6a2.1 2.1 0 0 0 2-1.6l1.6-6.6a2.1 2.1 0 0 0-2-2.6h-5.3l0.9-4.2a1.9 1.9 0 0 0-3.4-1.5L7.6 10.4z";

