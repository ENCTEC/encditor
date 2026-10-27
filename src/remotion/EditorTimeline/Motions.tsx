import React, { useContext } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Motion } from "../../timeline/schema";
import { segParaFrames } from "../../timeline/calculos";
import { Alfinete } from "./Alfinete";
import { FONTES } from "./fontes";
import {
  AMARELO,
  BRANCO,
  comDestaque,
  CONTORNO,
  Ctx,
  entrada,
  LIMITE,
  Lugar,
  PAPEL,
  semAsteriscos,
  tamanhoPeloTexto,
  TemaContexto,
  TINTA,
  VERMELHO,
} from "./motionBase";
import { MODELOS_NEON } from "./MotionsNeon";
import { MODELOS_DESENHO } from "./MotionsDesenho";
import { MODELOS_TELAS } from "./MotionsTelas";
import { COR_NEON, ehModeloNeon } from "./neonBase";

// Motion graphics: textos e grafismos animados por cima do vídeo (acima
// das cenas e inserts, abaixo das legendas). Tudo é medido em "u" = 1% do
// lado menor do vídeo, então o mesmo modelo serve em 9:16, 16:9, 1:1 e 4:5.
// Em qualquer texto, *palavra* entre asteriscos sai na cor de destaque.
// Os modelos do kit "neon" (motion design falado) ficam em MotionsNeon.tsx.

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
        paddingBottom: c.u * 24,
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

// ---------- kit "investigação" (quadro de cortiça, perícia) ----------

// Textura de tinta falhada do carimbo (ruído usado como máscara).
const MASCARA_CARIMBO = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='f'><feTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' seed='4'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  6 0 0 0 -1.7'/></filter><rect width='100%' height='100%' filter='url(#f)'/></svg>",
)}")`;

// Carimbo que bate na tela em (x, y), torto, com a tinta falhada.
const Carimbo: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, frame, motion, largura, altura } = c;
  const texto = semAsteriscos(motion.texto);
  const s = entrada(c, 0, 420, 19);
  const escala = interpolate(s, [0, 1], [2.4, 1]);
  const n = texto.length;
  const letra = u * (n <= 8 ? 8.5 : n <= 14 ? 6.6 : n <= 20 ? 5.4 : 4.5);
  return (
    <AbsoluteFill style={{ opacity: c.saida }}>
      <div
        style={{
          position: "absolute",
          left: ((motion.x ?? 50) / 100) * largura,
          top: ((motion.y ?? 45) / 100) * altura,
          transform: `translate(-50%, -50%) rotate(-12deg) scale(${escala})`,
          opacity: interpolate(frame, [0, 3], [0, 0.93], LIMITE),
          color: c.cor,
          border: `${u * 0.9}px solid ${c.cor}`,
          padding: u * 0.7,
          maskImage: MASCARA_CARIMBO,
          WebkitMaskImage: MASCARA_CARIMBO,
          maskSize: `${u * 22}px`,
          WebkitMaskSize: `${u * 22}px`,
        }}
      >
        <div
          style={{
            border: `${u * 0.35}px solid ${c.cor}`,
            padding: `${u * 0.9}px ${u * 2.2}px`,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: FONTES.condensada,
              fontSize: letra,
              lineHeight: 1,
              letterSpacing: u * 0.3,
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            {texto}
          </div>
          {motion.detalhe?.trim() ? (
            <div
              style={{
                fontFamily: FONTES.mono,
                fontWeight: 700,
                fontSize: u * 2.6,
                letterSpacing: u * 0.3,
                marginTop: u * 0.6,
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {semAsteriscos(motion.detalhe)}
            </div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Fita zebrada de isolamento: duas faixas cruzando a tela com o texto
// repetido.
const Fita: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, frame, motion, largura, altura } = c;
  const texto = (semAsteriscos(motion.texto).trim() || "NÃO ULTRAPASSE")
    .toUpperCase()
    .concat("   ✕   ");
  const centro =
    motion.y !== undefined
      ? motion.y / 100
      : motion.posicao === "topo"
        ? 0.26
        : motion.posicao === "base"
          ? 0.68
          : 0.46;
  const comprimento = Math.hypot(largura, altura) * 1.2;
  const faixas = [
    { angulo: -11, dy: 0, lado: -1, atraso: 0 },
    { angulo: 8, dy: altura * 0.08, lado: 1, atraso: 5 },
  ];
  return (
    <AbsoluteFill style={{ opacity: c.saida }}>
      {faixas.map((f, i) => {
        const s = entrada(c, f.atraso, 150, 18);
        const tremula = Math.sin((frame + i * 9) / 7) * 0.3;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: largura / 2 - comprimento / 2,
              top: altura * centro + f.dy - u * 3.6,
              width: comprimento,
              height: u * 7.2,
              transform: `rotate(${f.angulo + tremula}deg) translateX(${(1 - s) * f.lado * 105}%)`,
              backgroundColor: AMARELO,
              borderTop: `${u * 0.55}px solid ${TINTA}`,
              borderBottom: `${u * 0.55}px solid ${TINTA}`,
              boxShadow: `0 ${u * 0.7}px ${u * 1.6}px rgba(0,0,0,0.5)`,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontFamily: FONTES.condensada,
                fontSize: u * 4.3,
                letterSpacing: u * 0.35,
                color: TINTA,
                whiteSpace: "nowrap",
                transform: `translateX(${-((frame * u * 0.5 * (i ? -1 : 1)) % (u * 60)) - u * 30}px)`,
              }}
            >
              {texto.repeat(12)}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// Fio vermelho de quadro de investigação, de (x, y) até (x2, y2), preso por
// alfinetes nas pontas e com uma etiqueta no meio (texto, opcional).
const Fio: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, frame, motion, largura, altura } = c;
  const x1 = ((motion.x ?? 25) / 100) * largura;
  const y1 = ((motion.y ?? 30) / 100) * altura;
  const x2 = ((motion.x2 ?? 75) / 100) * largura;
  const y2 = ((motion.y2 ?? 60) / 100) * altura;
  // Fio frouxo: faz uma barriga para baixo.
  const barriga = Math.hypot(x2 - x1, y2 - y1) * 0.07;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 + barriga * 2;
  const caminho = `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
  const desenho = interpolate(frame, [3, 15], [1, 0], {
    ...LIMITE,
    easing: Easing.inOut(Easing.cubic),
  });
  const etiqueta = entrada(c, 13);
  const texto = motion.texto.trim();
  return (
    <AbsoluteFill style={{ opacity: c.saida }}>
      <svg
        width={largura}
        height={altura}
        style={{ position: "absolute", inset: 0 }}
      >
        {[
          { cor: "rgba(0,0,0,0.35)", d: u * 0.8, largura: u * 0.55 },
          { cor: c.cor, d: 0, largura: u * 0.5 },
        ].map((l, i) => (
          <path
            key={i}
            d={caminho}
            transform={`translate(${l.d * 0.6} ${l.d})`}
            fill="none"
            stroke={l.cor}
            strokeWidth={l.largura}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={desenho}
          />
        ))}
      </svg>
      <Alfinete x={x1} y={y1} tamanho={u * 3.6} escala={entrada(c, 0, 260, 11)} />
      <Alfinete
        x={x2}
        y={y2}
        tamanho={u * 3.6}
        escala={entrada(c, 13, 260, 11)}
      />
      {texto ? (
        <div
          style={{
            position: "absolute",
            left: (x1 + 2 * mx + x2) / 4,
            top: (y1 + 2 * my + y2) / 4,
            transform: `translate(-50%, -50%) rotate(-4deg) scale(${etiqueta})`,
            backgroundColor: PAPEL,
            color: TINTA,
            fontFamily: FONTES.spray,
            fontSize: tamanhoPeloTexto(texto, 4.8, u),
            lineHeight: 1.1,
            padding: `${u * 0.6}px ${u * 1.6}px`,
            boxShadow: `0 ${u * 0.4}px ${u * 1.2}px rgba(0,0,0,0.45)`,
            whiteSpace: "nowrap",
          }}
        >
          {comDestaque(texto, c.cor)}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// Bilhete amarelo preso por um alfinete em (x, y), escrito à mão; detalhe
// = linha pequena de cima ("PISTA Nº 2").
const Nota: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, frame, fps, motion, largura, altura } = c;
  const x = ((motion.x ?? 50) / 100) * largura;
  const y = ((motion.y ?? 40) / 100) * altura;
  const s = entrada(c, 0, 200, 14);
  // Balança no alfinete depois de cair e vai parando.
  const balanco =
    -4 + Math.sin((frame / fps) * 7) * 5 * Math.exp(-frame / (fps * 0.5));
  const larguraNota = u * 34;
  return (
    <AbsoluteFill style={{ opacity: c.saida }}>
      <div
        style={{
          position: "absolute",
          left: x - larguraNota / 2,
          top: y - u * 1.6,
          width: larguraNota,
          transformOrigin: `50% ${u * 1.6}px`,
          transform: `translateY(${(1 - s) * -u * 14}px) rotate(${balanco + (1 - s) * 12}deg)`,
          opacity: Math.min(1, s * 2),
          background: "linear-gradient(180deg, #F9E784 0%, #F2D85E 100%)",
          padding: `${u * 3.2}px ${u * 2.6}px ${u * 2.6}px`,
          boxShadow: `0 ${u * 1}px ${u * 2.2}px rgba(0,0,0,0.45)`,
        }}
      >
        {motion.detalhe?.trim() ? (
          <div
            style={{
              fontFamily: FONTES.mono,
              fontWeight: 700,
              fontSize: u * 2.6,
              letterSpacing: u * 0.25,
              color: TINTA,
              opacity: 0.75,
              borderBottom: `${u * 0.25}px solid rgba(17,17,16,0.5)`,
              paddingBottom: u * 0.5,
              marginBottom: u * 1,
              textTransform: "uppercase",
            }}
          >
            {semAsteriscos(motion.detalhe)}
          </div>
        ) : null}
        <div
          style={{
            fontFamily: FONTES.spray,
            fontSize: tamanhoPeloTexto(motion.texto, 6.4, u),
            lineHeight: 1.15,
            color: TINTA,
          }}
        >
          {comDestaque(motion.texto, c.cor)}
        </div>
      </div>
      <Alfinete x={x} y={y} tamanho={u * 3.6} escala={entrada(c, 5, 260, 11)} />
    </AbsoluteFill>
  );
};

// Clipe de papel (desenho) da ficha.
const ClipeDePapel: React.FC<{ u: number }> = ({ u }) => (
  <svg
    viewBox="0 0 40 100"
    width={u * 4}
    height={u * 10}
    style={{ position: "absolute", left: u * 5, top: -u * 3.4 }}
  >
    <path
      d="M12 70 V18 a8 8 0 0 1 16 0 V78 a12 12 0 0 1 -24 0 V30"
      fill="none"
      stroke="#8A8F96"
      strokeWidth={4.5}
      strokeLinecap="round"
    />
  </svg>
);

// Ficha de arquivo policial: cabeçalho (detalhe) e linhas "CAMPO: valor"
// (texto, separadas por |) datilografadas uma letra por vez.
const Ficha: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, frame, fps, motion, altura } = c;
  const linhas = semAsteriscos(motion.texto)
    .split("|")
    .map((l) => l.trim())
    .filter(Boolean);
  const s = entrada(c, 0, 190, 16);
  const digitadas = Math.max(0, ((frame - 8) * 26) / fps);
  const total = linhas.reduce((n, l) => n + l.length, 0);
  // Quantas letras vêm antes de cada linha (a digitação segue em ordem).
  const anteriores = linhas.map((_, i) =>
    linhas.slice(0, i).reduce((n, l) => n + l.length, 0),
  );
  const cursor = Math.floor(frame / (fps * 0.4)) % 2 === 0;
  const cartao = (
    <div
      style={{
        position: "relative",
        width: "88%",
        transform: `translateY(${(1 - s) * u * 10}px) rotate(-1.5deg)`,
        opacity: Math.min(1, s * 2),
        background: "linear-gradient(175deg, #EFE5CB 0%, #E2D5B4 100%)",
        padding: `${u * 2.6}px ${u * 3.2}px ${u * 2.8}px`,
        boxShadow: `0 ${u * 1.2}px ${u * 2.6}px rgba(0,0,0,0.5)`,
        color: TINTA,
      }}
    >
      <ClipeDePapel u={u} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: u * 2,
          borderBottom: `${u * 0.35}px dashed rgba(17,17,16,0.55)`,
          paddingBottom: u * 1,
          marginBottom: u * 1.4,
        }}
      >
        <div
          style={{
            fontFamily: FONTES.condensada,
            fontSize: u * 6.4,
            lineHeight: 1,
            textTransform: "uppercase",
          }}
        >
          {semAsteriscos(motion.detalhe?.trim() || "Arquivo")}
        </div>
        <div
          style={{
            fontFamily: FONTES.condensada,
            fontSize: u * 2.8,
            letterSpacing: u * 0.3,
            color: c.cor,
            border: `${u * 0.35}px solid ${c.cor}`,
            padding: `${u * 0.3}px ${u * 1}px`,
            transform: "rotate(-6deg)",
            maskImage: MASCARA_CARIMBO,
            WebkitMaskImage: MASCARA_CARIMBO,
            maskSize: `${u * 14}px`,
            WebkitMaskSize: `${u * 14}px`,
          }}
        >
          CONFIDENCIAL
        </div>
      </div>
      {linhas.map((linha, i) => {
        const antes = anteriores[i];
        const visiveis = Math.max(
          0,
          Math.min(linha.length, Math.floor(digitadas - antes)),
        );
        const digitando =
          digitadas >= antes && digitadas < antes + linha.length;
        const ultima = i === linhas.length - 1 && digitadas >= total;
        const parte = linha.slice(0, visiveis);
        const doisPontos = linha.indexOf(":");
        const rotulo = doisPontos >= 0 ? parte.slice(0, doisPontos + 1) : "";
        const valor = doisPontos >= 0 ? parte.slice(doisPontos + 1) : parte;
        return (
          <div
            key={i}
            style={{
              fontFamily: FONTES.mono,
              fontSize: u * 3.3,
              lineHeight: 1.45,
              minHeight: u * 3.3 * 1.45,
              whiteSpace: "pre-wrap",
            }}
          >
            <span style={{ fontWeight: 700 }}>{rotulo}</span>
            <span style={{ opacity: 0.85 }}>{valor}</span>
            {digitando || (ultima && cursor) ? (
              <span style={{ color: c.cor }}>▌</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
  // y = onde fica o topo da ficha (% da altura); sem y, usa a posição.
  if (motion.y !== undefined) {
    return (
      <AbsoluteFill style={{ opacity: c.saida, alignItems: "center" }}>
        <div
          style={{
            position: "absolute",
            top: (motion.y / 100) * altura,
            width: "100%",
            display: "flex",
            justifyContent: "center",
          }}
        >
          {cartao}
        </div>
      </AbsoluteFill>
    );
  }
  return (
    <Lugar posicao={motion.posicao} padrao="topo" estilo={{ opacity: c.saida }}>
      {cartao}
    </Lugar>
  );
};

const doisDigitos = (n: number) => String(Math.floor(n)).padStart(2, "0");

// Moldura de câmera de segurança: cantos, "● REC" piscando, nome da câmera
// (texto), local/data (detalhe) e o relógio correndo.
const Vigilancia: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, frame, fps, motion } = c;
  // Liga piscando, como monitor.
  const liga = [0, 1, 0.25, 1][Math.min(3, Math.floor(frame / 2))];
  const pisca = Math.floor(frame / (fps * 0.5)) % 2 === 0;
  const segundos = 21 * 3600 + 47 * 60 + 3 + frame / fps;
  const relogio = `${doisDigitos(segundos / 3600)}:${doisDigitos((segundos / 60) % 60)}:${doisDigitos(segundos % 60)}:${doisDigitos(frame % fps)}`;
  const margem = u * 5;
  const perna = u * 8;
  const traco = u * 0.6;
  const textoHud: React.CSSProperties = {
    position: "absolute",
    fontFamily: FONTES.mono,
    fontWeight: 700,
    fontSize: u * 3.2,
    letterSpacing: u * 0.2,
    color: BRANCO,
    textShadow: `0 0 ${u * 0.6}px rgba(0,0,0,0.9)`,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };
  const canto = (
    estilo: React.CSSProperties,
    bordas: Partial<Record<"top" | "bottom" | "left" | "right", boolean>>,
  ) => (
    <div
      style={{
        position: "absolute",
        width: perna,
        height: perna,
        borderTop: bordas.top ? `${traco}px solid ${BRANCO}` : undefined,
        borderBottom: bordas.bottom ? `${traco}px solid ${BRANCO}` : undefined,
        borderLeft: bordas.left ? `${traco}px solid ${BRANCO}` : undefined,
        borderRight: bordas.right ? `${traco}px solid ${BRANCO}` : undefined,
        filter: `drop-shadow(0 0 ${u * 0.4}px rgba(0,0,0,0.8))`,
        ...estilo,
      }}
    />
  );
  return (
    <AbsoluteFill style={{ opacity: c.saida * liga }}>
      {/* Linhas de varredura do monitor. */}
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) ${u * 0.25}px, transparent ${u * 0.25}px, transparent ${u * 0.6}px)`,
        }}
      />
      {canto({ left: margem, top: margem }, { top: true, left: true })}
      {canto({ right: margem, top: margem }, { top: true, right: true })}
      {canto({ left: margem, bottom: margem }, { bottom: true, left: true })}
      {canto({ right: margem, bottom: margem }, { bottom: true, right: true })}
      <div
        style={{
          ...textoHud,
          left: margem + perna * 0.4,
          top: margem + perna * 0.35,
          display: "flex",
          alignItems: "center",
          gap: u * 1.2,
        }}
      >
        <span
          style={{
            width: u * 2.6,
            height: u * 2.6,
            borderRadius: "50%",
            backgroundColor: VERMELHO,
            opacity: pisca ? 1 : 0.15,
          }}
        />
        REC
      </div>
      <div
        style={{
          ...textoHud,
          right: margem + perna * 0.4,
          top: margem + perna * 0.35,
        }}
      >
        {semAsteriscos(motion.texto.trim() || "CAM 01")}
      </div>
      {motion.detalhe?.trim() ? (
        <div
          style={{
            ...textoHud,
            left: margem + perna * 0.4,
            bottom: margem + perna * 0.35,
            fontSize: u * 2.7,
          }}
        >
          {semAsteriscos(motion.detalhe)}
        </div>
      ) : null}
      <div
        style={{
          ...textoHud,
          right: margem + perna * 0.4,
          bottom: margem + perna * 0.35,
          fontSize: u * 2.7,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {relogio}
      </div>
    </AbsoluteFill>
  );
};

// Plaquinha amarela de perícia (com número) "em pé" no ponto (x, y).
const Marcador: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, motion, largura, altura } = c;
  const s = entrada(c, 0, 240, 11);
  const alto = u * 13;
  const texto = semAsteriscos(motion.texto).trim() || "1";
  return (
    <AbsoluteFill style={{ opacity: c.saida }}>
      <div
        style={{
          position: "absolute",
          left: ((motion.x ?? 50) / 100) * largura - alto * 0.45,
          top: ((motion.y ?? 70) / 100) * altura - alto,
          width: alto * 0.9,
          height: alto,
          transformOrigin: "50% 100%",
          transform: `scaleY(${s}) scaleX(${0.6 + 0.4 * s})`,
        }}
      >
        <svg
          viewBox="0 0 90 100"
          width="100%"
          height="100%"
          style={{ position: "absolute", inset: 0, overflow: "visible" }}
        >
          <ellipse cx={50} cy={98} rx={48} ry={5} fill="rgba(0,0,0,0.4)" />
          {/* Lado (mais escuro) e frente da plaquinha. */}
          <polygon points="62,8 86,96 74,98 58,12" fill="#C9A300" />
          <polygon
            points="22,8 62,8 74,98 6,98"
            fill={AMARELO}
            stroke={TINTA}
            strokeWidth={3}
            strokeLinejoin="round"
          />
        </svg>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: alto * 0.14,
            top: alto * 0.22,
            textAlign: "center",
            fontFamily: FONTES.condensada,
            fontSize: alto * (texto.length > 2 ? 0.32 : 0.5),
            lineHeight: 1,
            color: TINTA,
          }}
        >
          {texto}
        </div>
      </div>
      {motion.detalhe?.trim() ? (
        <div
          style={{
            position: "absolute",
            left: ((motion.x ?? 50) / 100) * largura,
            top: ((motion.y ?? 70) / 100) * altura + u * 1.4,
            transform: `translateX(-50%) scale(${s})`,
            fontFamily: FONTES.mono,
            fontWeight: 700,
            fontSize: u * 2.8,
            color: BRANCO,
            backgroundColor: "rgba(17,17,16,0.8)",
            padding: `${u * 0.4}px ${u * 1.2}px`,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {semAsteriscos(motion.detalhe)}
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
  carimbo: Carimbo,
  fita: Fita,
  fio: Fio,
  nota: Nota,
  ficha: Ficha,
  vigilancia: Vigilancia,
  marcador: Marcador,
  ...MODELOS_NEON,
  ...MODELOS_TELAS,
  ...MODELOS_DESENHO,
};

// Um motion, com o tempo contado do começo dele.
export const MotionAnimado: React.FC<{
  motion: Motion;
  duracaoFrames: number;
}> = ({ motion, duracaoFrames }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const tema = useContext(TemaContexto);
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
        cor:
          motion.cor?.trim() ||
          (ehModeloNeon(motion.modelo) ? COR_NEON : VERMELHO),
        corEscolhida: !!motion.cor?.trim(),
        saida,
        paleta: tema.cores,
        claro: tema.fundoClaroEm(motion.inicio + 0.1),
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
            {/* data-item: o medidor da conferência acha cada motion. */}
            <div data-item={`motion:${i}`} style={{ position: "absolute", inset: 0 }}>
              <MotionAnimado motion={m} duracaoFrames={duracao} />
            </div>
          </Sequence>
        );
      })}
    </>
  );
};
