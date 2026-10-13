// Traços de spray vermelho feitos "à mão" (SVG), para destacar elementos
// como num pôster grafitado. Ficam por cima do conteúdo e não recebem
// cliques.

const traco = {
  fill: "none",
  stroke: "var(--color-spray)",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

// Círculo torto em volta de algo (aba ativa, destaque).
export const CirculoSpray: React.FC<{ className?: string }> = ({
  className,
}) => (
  <svg
    viewBox="0 0 120 50"
    preserveAspectRatio="none"
    aria-hidden
    className={`pointer-events-none absolute ${className ?? ""}`}
  >
    <path
      {...traco}
      strokeWidth={3}
      d="M14 30 C 6 12, 60 2, 102 10 C 122 15, 118 38, 84 44 C 52 50, 12 46, 8 30 C 6 22, 20 14, 34 12"
    />
  </svg>
);

// Sublinhado rápido de spray.
export const SublinhadoSpray: React.FC<{ className?: string }> = ({
  className,
}) => (
  <svg
    viewBox="0 0 200 20"
    preserveAspectRatio="none"
    aria-hidden
    className={`pointer-events-none absolute ${className ?? ""}`}
  >
    <path {...traco} strokeWidth={5} d="M4 13 C 50 6, 110 4, 196 9" />
    <path {...traco} strokeWidth={2.5} d="M30 17 C 80 12, 140 12, 180 15" />
  </svg>
);

// "X" riscado, como os riscos sobre os olhos do pôster.
export const XSpray: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 60 40"
    aria-hidden
    className={`pointer-events-none absolute ${className ?? ""}`}
  >
    <path
      {...traco}
      strokeWidth={4}
      d="M6 8 L 54 32 M8 32 L 52 6 M4 20 L 56 19"
    />
  </svg>
);

// Seta curva desenhada.
export const SetaSpray: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 60 80"
    aria-hidden
    className={`pointer-events-none absolute ${className ?? ""}`}
  >
    <path {...traco} strokeWidth={4} d="M30 76 C 8 56, 10 26, 34 8" />
    <path {...traco} strokeWidth={4} d="M20 10 L 35 6 L 38 22" />
  </svg>
);
