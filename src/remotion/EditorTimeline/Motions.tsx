import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Motion } from "../../timeline/schema";
import { segParaFrames } from "../../timeline/calculos";
import { FONTES } from "./fontes";

// Motion graphics: textos e grafismos animados por cima do vídeo (acima
// das cenas e inserts, abaixo das legendas). Tudo é medido em "u" = 1% do
// lado menor do vídeo, então o mesmo modelo serve em 9:16, 16:9, 1:1 e 4:5.
// Em qualquer texto, *palavra* entre asteriscos sai na cor de destaque.

const TINTA = "#111110";
const PAPEL = "#EBE8E1";
const BRANCO = "#FFFFFF";
const AMARELO = "#FFD60A";
const VERMELHO = "#E1251B";

const LIMITE = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

const CONTORNO = (u: number) =>
  `0 ${u * 0.3}px ${u * 1.2}px rgba(0,0,0,0.55), 0 0 ${u * 0.25}px rgba(0,0,0,0.8)`;

// "*palavra*" → palavra na cor de destaque.
const comDestaque = (texto: string, cor: string) =>
  texto.split(/(\*[^*]+\*)/g).map((parte, i) =>
    parte.startsWith("*") && parte.endsWith("*") && parte.length > 2 ? (
      <span key={i} style={{ color: cor }}>
        {parte.slice(1, -1)}
      </span>
    ) : (
      <React.Fragment key={i}>{parte}</React.Fragment>
    ),
  );

const semAsteriscos = (texto: string) => texto.replace(/\*/g, "");

// Letra menor para textos longos.
const tamanhoPeloTexto = (texto: string, grande: number, u: number) => {
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

type Ctx = {
  motion: Motion;
  frame: number;
  fps: number;
  duracao: number;
  u: number;
  largura: number;
  altura: number;
  cor: string;
  // 1 → 0 nos últimos quadros.
  saida: number;
};

const entrada = (c: Ctx, atraso = 0, rigidez = 170, amortecimento = 13) =>
  spring({
    frame: c.frame - atraso,
    fps: c.fps,
    config: { stiffness: rigidez, damping: amortecimento, mass: 0.7 },
  });

// Onde o bloco fica: topo / centro / base (a base fica acima das legendas).
const Lugar: React.FC<{
  posicao: Motion["posicao"];
  padrao: NonNullable<Motion["posicao"]>;
  children: React.ReactNode;
  estilo?: React.CSSProperties;
}> = ({ posicao, padrao, children, estilo }) => {
  const p = posicao ?? padrao;
  return (
    <AbsoluteFill
      style={{
        justifyContent:
          p === "topo" ? "flex-start" : p === "base" ? "flex-end" : "center",
        alignItems: "center",
        paddingTop: p === "topo" ? "13%" : 0,
        paddingBottom: p === "base" ? "24%" : 0,
        paddingLeft: "6%",
        paddingRight: "6%",
        ...estilo,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// ---------- modelos ----------

const Frase: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, frame, motion } = c;
  const s = entrada(c, 0, 210, 11);
  const escala = interpolate(s, [0, 1], [2.6, 1]);
  // Treme logo depois de bater na tela.
  const tremor =
    frame > 3 && frame < 16
      ? Math.sin(frame * 2.7) * u * 0.7 * (1 - (frame - 3) / 13)
      : 0;
  const tamanho = tamanhoPeloTexto(motion.texto, 12, u);
  return (
    <Lugar posicao={motion.posicao} padrao="centro">
      <div
        style={{
          transform: `translate(${tremor}px, ${tremor * 0.4}px) scale(${escala * (0.9 + 0.1 * c.saida)}) rotate(-2.5deg)`,
          opacity: Math.min(1, s * 2) * c.saida,
          backgroundColor: TINTA,
          color: PAPEL,
          padding: `${u * 1.6}px ${u * 3.2}px`,
          boxShadow: `${u * 0.9}px ${u * 0.9}px 0 ${c.cor}`,
          fontFamily: FONTES.condensada,
          fontSize: tamanho,
          lineHeight: 1,
          textTransform: "uppercase",
          textAlign: "center",
          maxWidth: "88%",
          letterSpacing: u * 0.05,
        }}
      >
        {comDestaque(motion.texto, c.cor)}
      </div>
    </Lugar>
  );
};

const Preco: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, frame, motion } = c;
  const temAntigo = !!motion.detalhe?.trim();
  const inicioNovo = temAntigo ? 16 : 2;
  const antigo = entrada(c, 0);
  const risco = interpolate(frame, [8, 15], [0, 100], LIMITE);
  const novo = entrada(c, inicioNovo, 230, 10);
  const balanco = Math.sin((frame - inicioNovo) / 6) * 1.5;
  return (
    <Lugar
      posicao={motion.posicao}
      padrao="centro"
      estilo={{ flexDirection: "column", gap: u * 1.2, opacity: c.saida }}
    >
      {temAntigo ? (
        <div
          style={{
            position: "relative",
            transform: `translateY(${(1 - antigo) * u * 4}px)`,
            opacity: antigo,
            fontFamily: FONTES.forte,
            fontWeight: 800,
            fontSize: u * 5.2,
            color: BRANCO,
            textShadow: CONTORNO(u),
          }}
        >
          DE {semAsteriscos(motion.detalhe!)}
          <div
            style={{
              position: "absolute",
              left: "-4%",
              top: "48%",
              height: u * 0.9,
              width: `${risco * 1.08}%`,
              backgroundColor: c.cor,
              transform: "rotate(-7deg)",
              transformOrigin: "left center",
            }}
          />
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: u * 1.5,
          transform: `scale(${novo}) rotate(${-3 + balanco * (1 - novo)}deg)`,
          opacity: Math.min(1, novo * 3),
        }}
      >
        {temAntigo ? (
          <span
            style={{
              fontFamily: FONTES.forte,
              fontWeight: 900,
              fontSize: u * 4.5,
              color: BRANCO,
              textShadow: CONTORNO(u),
            }}
          >
            POR
          </span>
        ) : null}
        <div
          style={{
            position: "relative",
            backgroundColor: AMARELO,
            color: TINTA,
            fontFamily: FONTES.condensada,
            fontSize: tamanhoPeloTexto(motion.texto, 13, u),
            lineHeight: 1,
            padding: `${u * 1.4}px ${u * 3}px ${u * 1.4}px ${u * 4.6}px`,
            borderRadius: u * 1.2,
            border: `${u * 0.5}px solid ${TINTA}`,
            boxShadow: `${u * 0.8}px ${u * 0.8}px 0 ${c.cor}`,
          }}
        >
          {/* Furo da etiqueta. */}
          <span
            style={{
              position: "absolute",
              left: u * 1.4,
              top: "50%",
              width: u * 1.8,
              height: u * 1.8,
              marginTop: -u * 0.9,
              borderRadius: "50%",
              backgroundColor: TINTA,
            }}
          />
          {comDestaque(motion.texto, c.cor)}
        </div>
      </div>
    </Lugar>
  );
};

// "+5.000 clientes", "50% OFF", "R$ 1.299,90": acha o número para contar.
const partesDoNumero = (texto: string) => {
  const m = /(\d{1,3}(?:\.\d{3})+|\d+)(,\d+)?/.exec(texto);
  if (!m) return null;
  const inteiro = m[1];
  const decimais = m[2] ? m[2].length - 1 : 0;
  return {
    antes: texto.slice(0, m.index),
    depois: texto.slice(m.index + m[0].length),
    valor: Number(
      inteiro.replace(/\./g, "") + (m[2] ? "." + m[2].slice(1) : ""),
    ),
    decimais,
    agrupar: inteiro.includes(".") || inteiro.length > 4,
  };
};

const Contador: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, frame, fps, motion } = c;
  const texto = semAsteriscos(motion.texto);
  const partes = partesDoNumero(texto);
  const fimDaConta = 4 + Math.round(fps * 1.1);
  const progresso = interpolate(frame, [4, fimDaConta], [0, 1], {
    ...LIMITE,
    easing: Easing.out(Easing.cubic),
  });
  const mostrado = partes
    ? `${partes.antes}${(partes.valor * progresso).toLocaleString("pt-BR", {
        minimumFractionDigits: partes.decimais,
        maximumFractionDigits: partes.decimais,
        useGrouping: partes.agrupar,
      })}${partes.depois}`
    : texto;
  const chegada = entrada(c, 0);
  // "Pulo" quando termina de contar.
  const pulo = interpolate(
    frame,
    [fimDaConta, fimDaConta + 4, fimDaConta + 10],
    [1, 1.12, 1],
    LIMITE,
  );
  const rotulo = entrada(c, 10);
  return (
    <Lugar
      posicao={motion.posicao}
      padrao="centro"
      estilo={{ flexDirection: "column", gap: u * 1.5, opacity: c.saida }}
    >
      <div
        style={{
          transform: `scale(${chegada * pulo})`,
          fontFamily: FONTES.condensada,
          fontSize: tamanhoPeloTexto(texto, 19, u),
          lineHeight: 1,
          color: BRANCO,
          textShadow: `${u * 0.6}px ${u * 0.6}px 0 ${c.cor}, ${CONTORNO(u)}`,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        }}
      >
        {mostrado}
      </div>
      {motion.detalhe?.trim() ? (
        <div
          style={{
            transform: `translateY(${(1 - rotulo) * u * 5}px)`,
            opacity: rotulo,
            backgroundColor: TINTA,
            color: PAPEL,
            fontFamily: FONTES.forte,
            fontWeight: 800,
            fontSize: u * 4,
            textTransform: "uppercase",
            padding: `${u * 0.8}px ${u * 2.2}px`,
            letterSpacing: u * 0.1,
          }}
        >
          {comDestaque(motion.detalhe, c.cor)}
        </div>
      ) : null}
    </Lugar>
  );
};

const Titulo: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, frame, motion } = c;
  const faixa = interpolate(frame, [2, 11], [0, 1], {
    ...LIMITE,
    easing: Easing.out(Easing.cubic),
  });
  const texto = interpolate(frame, [6, 14], [0, 100], LIMITE);
  const chapeu = entrada(c, 0);
  return (
    <Lugar
      posicao={motion.posicao}
      padrao="topo"
      estilo={{ flexDirection: "column", gap: u * 1.2, opacity: c.saida }}
    >
      {motion.detalhe?.trim() ? (
        <div
          style={{
            opacity: chapeu,
            transform: `translateY(${(1 - chapeu) * -u * 3}px)`,
            backgroundColor: c.cor,
            color: BRANCO,
            fontFamily: FONTES.mono,
            fontWeight: 700,
            fontSize: u * 3,
            letterSpacing: u * 0.4,
            padding: `${u * 0.4}px ${u * 1.6}px`,
            textTransform: "uppercase",
          }}
        >
          {semAsteriscos(motion.detalhe)}
        </div>
      ) : null}
      <div style={{ position: "relative", maxWidth: "90%" }}>
        {/* Marca-texto passando por trás. */}
        <div
          style={{
            position: "absolute",
            inset: `${u * 0.4}px -${u * 1.6}px`,
            backgroundColor: c.cor,
            transform: `scaleX(${faixa}) rotate(-1.5deg)`,
            transformOrigin: "left center",
          }}
        />
        <div
          style={{
            position: "relative",
            fontFamily: FONTES.condensada,
            fontSize: tamanhoPeloTexto(motion.texto, 10, u),
            lineHeight: 1.05,
            color: BRANCO,
            textTransform: "uppercase",
            textAlign: "center",
            padding: `${u * 0.6}px ${u * 1}px`,
            clipPath: `inset(0 ${100 - texto}% 0 0)`,
          }}
        >
          {comDestaque(motion.texto, AMARELO)}
        </div>
      </div>
    </Lugar>
  );
};

const Rodape: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, frame, motion } = c;
  const barra = interpolate(frame, [0, 6], [0, 1], LIMITE);
  const caixa = entrada(c, 3, 190, 16);
  // Sai deslizando de volta.
  const volta = 1 - c.saida;
  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "flex-start",
        paddingLeft: "6%",
        paddingBottom: "24%",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "stretch", overflow: "hidden" }}
      >
        <div
          style={{
            width: u * 1.4,
            backgroundColor: c.cor,
            transform: `scaleY(${barra * c.saida})`,
          }}
        />
        <div
          style={{
            backgroundColor: PAPEL,
            color: TINTA,
            padding: `${u * 1.2}px ${u * 2.6}px`,
            transform: `translateX(${(-1 + caixa - volta) * 105}%)`,
            maxWidth: c.largura * 0.78,
          }}
        >
          <div
            style={{
              fontFamily: FONTES.condensada,
              fontSize: tamanhoPeloTexto(motion.texto, 8, u),
              lineHeight: 1.05,
              textTransform: "uppercase",
            }}
          >
            {comDestaque(motion.texto, c.cor)}
          </div>
          {motion.detalhe?.trim() ? (
            <div
              style={{
                fontFamily: FONTES.forte,
                fontWeight: 800,
                fontSize: u * 3.2,
                opacity: 0.75,
                marginTop: u * 0.3,
              }}
            >
              {comDestaque(motion.detalhe, c.cor)}
            </div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Lista: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, fps, motion } = c;
  const itens = (motion.detalhe?.trim() ? motion.detalhe : motion.texto)
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);
  const temTitulo = !!motion.detalhe?.trim() && !!motion.texto.trim();
  const passo = Math.round(fps * 0.35);
  const titulo = entrada(c, 0);
  return (
    <Lugar
      posicao={motion.posicao}
      padrao="centro"
      estilo={{ opacity: c.saida }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: u * 1.6,
          alignItems: "flex-start",
          maxWidth: "88%",
        }}
      >
        {temTitulo ? (
          <div
            style={{
              opacity: titulo,
              transform: `translateY(${(1 - titulo) * u * 3}px)`,
              fontFamily: FONTES.condensada,
              fontSize: u * 7,
              lineHeight: 1,
              color: BRANCO,
              textTransform: "uppercase",
              textShadow: CONTORNO(u),
              borderBottom: `${u * 0.8}px solid ${c.cor}`,
              paddingBottom: u * 0.4,
            }}
          >
            {comDestaque(motion.texto, c.cor)}
          </div>
        ) : null}
        {itens.map((item, i) => {
          const s = entrada(c, (temTitulo ? 8 : 2) + i * passo, 200, 14);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: u * 1.6,
                opacity: Math.min(1, s * 2),
                transform: `translateX(${(1 - s) * -u * 8}px)`,
                backgroundColor: "rgba(17,17,16,0.82)",
                padding: `${u * 1}px ${u * 2.4}px ${u * 1}px ${u * 1.2}px`,
                borderLeft: `${u * 0.6}px solid ${c.cor}`,
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: u * 5.4,
                  height: u * 5.4,
                  borderRadius: "50%",
                  backgroundColor: c.cor,
                  color: BRANCO,
                  fontFamily: FONTES.forte,
                  fontWeight: 900,
                  fontSize: u * 3.4,
                  transform: `scale(${s})`,
                  flexShrink: 0,
                }}
              >
                ✓
              </span>
              <span
                style={{
                  fontFamily: FONTES.forte,
                  fontWeight: 800,
                  fontSize: tamanhoPeloTexto(item, 6.2, u),
                  color: BRANCO,
                }}
              >
                {comDestaque(item, AMARELO)}
              </span>
            </div>
          );
        })}
      </div>
    </Lugar>
  );
};

const Chamada: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, frame, fps, motion } = c;
  const s = entrada(c, 0, 220, 11);
  const pulso = 1 + 0.05 * Math.sin((frame / fps) * Math.PI * 2 * 1.4);
  const seta = Math.sin((frame / fps) * Math.PI * 2 * 1.4) * u * 1.4;
  return (
    <Lugar
      posicao={motion.posicao}
      padrao="base"
      estilo={{ flexDirection: "column", gap: u * 1.2, opacity: c.saida }}
    >
      {motion.detalhe?.trim() ? (
        <div
          style={{
            opacity: s,
            fontFamily: FONTES.mono,
            fontWeight: 700,
            fontSize: u * 3.2,
            letterSpacing: u * 0.3,
            color: BRANCO,
            textTransform: "uppercase",
            textShadow: CONTORNO(u),
          }}
        >
          {semAsteriscos(motion.detalhe)}
        </div>
      ) : null}
      <div
        style={{
          transform: `scale(${s * pulso})`,
          backgroundColor: c.cor,
          color: BRANCO,
          fontFamily: FONTES.condensada,
          fontSize: tamanhoPeloTexto(motion.texto, 8.5, u),
          lineHeight: 1,
          padding: `${u * 2}px ${u * 5}px`,
          borderRadius: u * 10,
          border: `${u * 0.55}px solid ${TINTA}`,
          boxShadow: `0 ${u * 1}px 0 ${TINTA}`,
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {comDestaque(motion.texto, AMARELO)}
      </div>
      {/* Seta apontando para o botão. */}
      <svg
        width={u * 9}
        height={u * 9}
        viewBox="0 0 100 100"
        style={{ transform: `translateY(${seta}px)`, opacity: s }}
      >
        <path
          d="M50 92 L50 20 M24 44 L50 16 L76 44"
          fill="none"
          stroke={TINTA}
          strokeWidth={20}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M50 92 L50 20 M24 44 L50 16 L76 44"
          fill="none"
          stroke={BRANCO}
          strokeWidth={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Lugar>
  );
};

// Explosão de 24 pontas (contorno do selo).
const pontasDoSelo = (() => {
  const pontos: string[] = [];
  for (let i = 0; i < 48; i++) {
    const r = i % 2 ? 44 : 50;
    const a = (i / 48) * Math.PI * 2;
    pontos.push(`${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`);
  }
  return pontos.join(" ");
})();

const Selo: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, frame, fps, motion } = c;
  const s = entrada(c, 0, 240, 12);
  const escala = interpolate(s, [0, 1], [3, 1]);
  const balanco = -10 + Math.sin((frame / fps) * 1.6) * 5;
  const texto = semAsteriscos(motion.texto);
  // Texto comprido: selo maior e letra pela maior palavra (cabe numa linha).
  const diametro = u * (texto.length > 12 ? 36 : 30);
  const maiorPalavra = Math.max(...texto.split(/\s+/).map((p) => p.length), 1);
  const letra = Math.min(
    diametro * 0.3,
    (diametro * 0.62) / (maiorPalavra * 0.5),
  );
  const x = motion.x ?? 74;
  const y = motion.y ?? 24;
  return (
    <AbsoluteFill style={{ opacity: c.saida }}>
      <div
        style={{
          position: "absolute",
          left: `${x}%`,
          top: `${y}%`,
          width: diametro,
          height: diametro,
          marginLeft: -diametro / 2,
          marginTop: -diametro / 2,
          transform: `scale(${escala}) rotate(${balanco}deg)`,
          opacity: Math.min(1, s * 2),
        }}
      >
        <svg
          viewBox="0 0 100 100"
          width="100%"
          height="100%"
          style={{ position: "absolute", inset: 0 }}
        >
          <polygon
            points={pontasDoSelo}
            fill={c.cor}
            stroke={TINTA}
            strokeWidth={2}
          />
          <circle
            cx={50}
            cy={50}
            r={36}
            fill="none"
            stroke={PAPEL}
            strokeWidth={1.6}
            strokeDasharray="4 3"
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: "18%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            fontFamily: FONTES.condensada,
            fontSize: letra,
            lineHeight: 0.95,
            color: BRANCO,
            textTransform: "uppercase",
          }}
        >
          {texto}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Seta desenhada de um rótulo até o ponto (x, y).
const Seta: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, frame, motion, largura, altura } = c;
  const alvoX = ((motion.x ?? 62) / 100) * largura;
  const alvoY = ((motion.y ?? 55) / 100) * altura;
  // O rótulo fica do lado com mais espaço, sempre dentro da tela; a seta
  // sai dele e faz uma curva até o ponto.
  const ladoX = alvoX > largura / 2 ? -1 : 1;
  const ladoY = alvoY > altura / 2 ? -1 : 1;
  const rotuloX = Math.min(
    largura * 0.72,
    Math.max(largura * 0.28, alvoX + ladoX * largura * 0.2),
  );
  const rotuloY = Math.min(
    altura * 0.85,
    Math.max(altura * 0.15, alvoY + ladoY * altura * 0.16),
  );
  const inicioX = rotuloX;
  const inicioY = rotuloY - ladoY * u * 5;
  const controleX = inicioX;
  const controleY = alvoY + ladoY * altura * 0.01;
  const desenho = interpolate(frame, [3, 13], [1, 0], {
    ...LIMITE,
    easing: Easing.out(Easing.cubic),
  });
  const rotulo = entrada(c, 0);
  // Ponta da seta: direção do fim da curva.
  const ang = Math.atan2(alvoY - controleY, alvoX - controleX);
  const tamPonta = u * 3.2;
  const ponta = [ang - 0.5, ang + 0.5]
    .map(
      (a) =>
        `M ${alvoX} ${alvoY} L ${alvoX - tamPonta * Math.cos(a)} ${alvoY - tamPonta * Math.sin(a)}`,
    )
    .join(" ");
  const caminho = `M ${inicioX} ${inicioY} Q ${controleX} ${controleY} ${alvoX} ${alvoY}`;
  return (
    <AbsoluteFill style={{ opacity: c.saida }}>
      <svg
        width={largura}
        height={altura}
        style={{ position: "absolute", inset: 0 }}
      >
        {[TINTA, BRANCO].map((cor, i) => (
          <g key={cor}>
            <path
              d={caminho}
              fill="none"
              stroke={cor}
              strokeWidth={i ? u * 0.8 : u * 1.6}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={desenho}
            />
            <path
              d={ponta}
              fill="none"
              stroke={cor}
              strokeWidth={i ? u * 0.8 : u * 1.6}
              strokeLinecap="round"
              opacity={desenho < 0.05 ? 1 : 0}
            />
          </g>
        ))}
      </svg>
      {motion.texto.trim() ? (
        <div
          style={{
            position: "absolute",
            left: rotuloX,
            top: rotuloY,
            transform: `translate(-50%, -50%) rotate(-4deg) scale(${rotulo})`,
            fontFamily: FONTES.spray,
            fontSize: tamanhoPeloTexto(motion.texto, 7.5, u),
            lineHeight: 1.1,
            color: BRANCO,
            textShadow: `${u * 0.35}px ${u * 0.35}px 0 ${c.cor}, ${CONTORNO(u)}`,
            textAlign: "center",
            width: "max-content",
            maxWidth: largura * 0.5,
          }}
        >
          {comDestaque(motion.texto, AMARELO)}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// Círculo "feito à mão" em volta de (x, y).
const Circulo: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, frame, motion, largura, altura } = c;
  const cx = ((motion.x ?? 50) / 100) * largura;
  const cy = ((motion.y ?? 50) / 100) * altura;
  const rx = u * 17;
  const ry = u * 12;
  const desenho = interpolate(frame, [0, 12], [1, 0], {
    ...LIMITE,
    easing: Easing.inOut(Easing.cubic),
  });
  // Volta e pouco, com a ponta passando do começo (traço de caneta).
  const pontos: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const a = -0.5 + (i / 60) * (Math.PI * 2 + 0.6);
    const r = 1 + 0.06 * Math.sin(i * 0.4);
    pontos.push(`${cx + rx * r * Math.cos(a)},${cy + ry * r * Math.sin(a)}`);
  }
  const rotulo = entrada(c, 10);
  return (
    <AbsoluteFill style={{ opacity: c.saida }}>
      <svg
        width={largura}
        height={altura}
        style={{ position: "absolute", inset: 0 }}
      >
        <g transform={`rotate(-8 ${cx} ${cy})`}>
          {[TINTA, c.cor].map((cor, i) => (
            <polyline
              key={i}
              points={pontos.join(" ")}
              fill="none"
              stroke={cor}
              strokeWidth={i ? u * 1 : u * 1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={desenho}
            />
          ))}
        </g>
      </svg>
      {motion.texto.trim() ? (
        <div
          style={{
            position: "absolute",
            left: cx,
            top: cy + ry + u * 2,
            transform: `translateX(-50%) rotate(-3deg) scale(${rotulo})`,
            fontFamily: FONTES.spray,
            fontSize: tamanhoPeloTexto(motion.texto, 6, u),
            color: BRANCO,
            textShadow: `${u * 0.35}px ${u * 0.35}px 0 ${c.cor}, ${CONTORNO(u)}`,
            whiteSpace: "nowrap",
          }}
        >
          {comDestaque(motion.texto, AMARELO)}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const MODELOS: Record<Motion["modelo"], React.FC<{ c: Ctx }>> = {
  frase: Frase,
  preco: Preco,
  contador: Contador,
  titulo: Titulo,
  rodape: Rodape,
  lista: Lista,
  chamada: Chamada,
  selo: Selo,
  seta: Seta,
  circulo: Circulo,
};

// Um motion, com o tempo contado do começo dele.
export const MotionAnimado: React.FC<{
  motion: Motion;
  duracaoFrames: number;
}> = ({ motion, duracaoFrames }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const Modelo = MODELOS[motion.modelo];
  const saida = interpolate(
    frame,
    [duracaoFrames - 7, duracaoFrames],
    [1, 0],
    LIMITE,
  );
  return (
    <Modelo
      c={{
        motion,
        frame,
        fps,
        duracao: duracaoFrames,
        u: Math.min(width, height) / 100,
        largura: width,
        altura: height,
        cor: motion.cor?.trim() || VERMELHO,
        saida,
      }}
    />
  );
};

export const Motions: React.FC<{ motions: Motion[] }> = ({ motions }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {motions.map((m, i) => {
        const de = segParaFrames(m.inicio, fps);
        const duracao = segParaFrames(m.fim, fps) - de;
        if (duracao <= 0) return null;
        return (
          <Sequence
            key={i}
            from={de}
            durationInFrames={duracao}
            name={`Motion ${i + 1}`}
          >
            <MotionAnimado motion={m} duracaoFrames={duracao} />
          </Sequence>
        );
      })}
    </>
  );
};
