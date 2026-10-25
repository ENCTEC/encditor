import React, { useId } from "react";

// Alfinete de quadro de cortiça visto de frente: cabeça redonda com brilho
// e a sombra no quadro. O centro da cabeça fica em (x, y), em px dentro do
// elemento pai; "tamanho" = diâmetro da cabeça. Usado pelos inserts presos
// no quadro e pelos motions fio e nota.
export const Alfinete: React.FC<{
  x: number;
  y: number;
  tamanho: number;
  // Entrada (0 → 1): o alfinete "espeta" crescendo.
  escala?: number;
  cor?: string;
}> = ({ x, y, tamanho, escala = 1, cor = "#D7261E" }) => {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 100 100"
      width={tamanho * 1.7}
      height={tamanho * 1.7}
      style={{
        position: "absolute",
        left: x - tamanho * 0.85,
        top: y - tamanho * 0.85,
        transform: `scale(${escala})`,
        overflow: "visible",
        pointerEvents: "none",
      }}
    >
      <defs>
        <radialGradient id={`cabeca-${id}`} cx="38%" cy="34%" r="70%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.9} />
          <stop offset="18%" stopColor={cor} />
          <stop offset="100%" stopColor="#4A0805" />
        </radialGradient>
      </defs>
      {/* Sombra no quadro (luz vindo de cima, à esquerda). */}
      <ellipse cx={58} cy={64} rx={27} ry={24} fill="rgba(0,0,0,0.38)" />
      <circle cx={50} cy={50} r={29} fill={`url(#cabeca-${id})`} />
      <circle
        cx={50}
        cy={50}
        r={29}
        fill="none"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth={2}
      />
      <ellipse cx={41} cy={39} rx={8} ry={5} fill="rgba(255,255,255,0.7)" />
    </svg>
  );
};
