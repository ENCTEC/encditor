import React from "react";
import { AbsoluteFill, Easing, interpolate, random, spring } from "remotion";
import { ModeloMotion } from "../../timeline/schema";
import { FONTES } from "./fontes";
import {
  BRANCO,
  Ctx,
  entrada,
  LIMITE,
  Lugar,
  semAsteriscos,
} from "./motionBase";

// Kit "neon": motion design FALADO, como nos vídeos feitos só com
// animação — cada frase vira texto na tela no momento em que é dita e um
// grafismo "encena" o que está sendo falado (etiqueta da ação, toque na
// tela, cartão digitando o comando, barra de nível, curtida, comentário…).
// Visual: letra Montserrat Black, palavras fortes em degradê azul→roxo com
// brilho, cartões de vidro escuro. Combina com o fundo animado "neon".
// "fala" e "digitando" seguem o tempo de cada palavra (motion.palavras).

export const COR_NEON = "#8B5CF6";
const CIANO = "#2DD4FF";
const AZUL = "#4F7BFF";
const ROXO = "#A855F7";
const MAGENTA = "#FF3DCB";
const VIDRO = "rgba(14, 16, 32, 0.88)";
const LINHA_VIDRO = "rgba(255, 255, 255, 0.13)";
const CINZA = "rgba(255, 255, 255, 0.62)";

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
] as const satisfies readonly ModeloMotion[];
type ModeloNeon = (typeof MODELOS_DO_KIT_NEON)[number];

export const ehModeloNeon = (m: ModeloMotion): m is ModeloNeon =>
  (MODELOS_DO_KIT_NEON as readonly string[]).includes(m);

// "#rrggbb" → rgba com transparência (outra cor qualquer fica como está).
const comAlfa = (cor: string, alfa: number) => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(cor);
  return m
    ? `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alfa})`
    : cor;
};

// Mistura duas cores #rrggbb (t = 0 → a, 1 → b).
const misturar = (a: string, b: string, t: number) => {
  const ca = /^#(..)(..)(..)$/.exec(a)!.slice(1).map((x) => parseInt(x, 16));
  const cb = /^#(..)(..)(..)$/.exec(b)!.slice(1).map((x) => parseInt(x, 16));
  const [r, g, bl] = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `rgb(${r}, ${g}, ${bl})`;
};

// Degradê do kit (ou a cor escolhida, lisa) e a cor do brilho.
const degrade = (c: Ctx, angulo = 90) =>
  c.corEscolhida
    ? `linear-gradient(${angulo}deg, ${c.cor}, ${c.cor})`
    : `linear-gradient(${angulo}deg, ${CIANO} 0%, ${AZUL} 48%, ${ROXO} 100%)`;
const corDoBrilho = (c: Ctx) => (c.corEscolhida ? c.cor : COR_NEON);
const corNaPosicao = (c: Ctx, t: number) =>
  c.corEscolhida
    ? c.cor
    : t < 0.5
      ? misturar(CIANO, AZUL, t * 2)
      : misturar(AZUL, ROXO, (t - 0.5) * 2);

// Texto em degradê com brilho. Sombra de texto não serve aqui (cobriria o
// degradê): o brilho e o "fantasma" colorido da entrada usam drop-shadow.
const TextoDegrade: React.FC<{
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
const TextoNeon: React.FC<{ c: Ctx; texto: string }> = ({ c, texto }) => (
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
type Pedaco = { texto: string; destaque: boolean; indice: number };
const pedacos = (texto: string): Pedaco[][] => {
  let indice = 0;
  let dentro = false;
  return texto.split("|").map((linha) =>
    linha
      .split(/\s+/)
      .filter(Boolean)
      .flatMap((bruto) => {
        const destaque = dentro || bruto.startsWith("*");
        if ((bruto.match(/\*/g)?.length ?? 0) % 2 === 1) dentro = !dentro;
        const limpo = bruto.replace(/\*/g, "");
        return limpo ? [{ texto: limpo, destaque, indice: indice++ }] : [];
      }),
  );
};

// Quadro (contado do início do motion) em que cada palavra aparece: o da
// fala, quando o motion sabe o tempo de cada palavra; senão um ritmo fixo.
const quadrosDasPalavras = (c: Ctx, n: number, primeiro = 2) => {
  const ditas = c.motion.palavras;
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
const NoPonto: React.FC<{
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

// ---------- modelos ----------

// Texto falado: as palavras entram uma a uma, no instante em que são
// ditas; as de *destaque* vêm enormes, em degradê, com um "fantasma"
// colorido na chegada. As linhas ("|") se empilham.
const PalavraFalada: React.FC<{
  c: Ctx;
  p: Pedaco;
  quadro: number;
  tamanho: number;
}> = ({ c, p, quadro, tamanho }) => {
  const f = c.frame - quadro;
  const s = spring({
    frame: f,
    fps: c.fps,
    config: { stiffness: 230, damping: p.destaque ? 12 : 17, mass: 0.6 },
  });
  const estilo: React.CSSProperties = {
    display: "inline-block",
    flexShrink: 0,
    fontFamily: FONTES.forte,
    fontWeight: 900,
    fontSize: tamanho,
    lineHeight: 1.04,
    textTransform: "uppercase",
    letterSpacing: -tamanho * 0.01,
    opacity: f < 0 ? 0 : Math.min(1, s * 1.8),
    transform: `translateY(${(1 - s) * tamanho * 0.32}px) scale(${p.destaque ? 0.5 + 0.5 * s : 0.86 + 0.14 * s})`,
  };
  const borrao = `blur(${Math.max(0, 1 - s) * c.u * 0.8}px)`;
  if (p.destaque) {
    const fantasma = interpolate(f, [0, 8], [1, 0], LIMITE) * c.u * 0.9;
    return (
      <TextoDegrade
        c={c}
        estilo={estilo}
        filtroExtra={`${borrao}${fantasma > 0.05 ? ` drop-shadow(${-fantasma}px 0 0 ${CIANO}) drop-shadow(${fantasma}px 0 0 ${MAGENTA})` : ""}`}
      >
        {p.texto}
      </TextoDegrade>
    );
  }
  return (
    <span
      style={{
        ...estilo,
        color: BRANCO,
        textShadow: `0 ${c.u * 0.3}px ${c.u * 1.4}px rgba(0,0,0,0.5)`,
        filter: borrao,
      }}
    >
      {p.texto}
    </span>
  );
};

const Fala: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, motion, largura } = c;
  const linhas = pedacos(motion.texto);
  const todas = linhas.flat();
  const quadros = quadrosDasPalavras(c, todas.length);
  const temDestaque = todas.some((p) => p.destaque);
  const grande = 16;
  const normal = temDestaque ? 8 : 10.5;
  const maximo = largura * 0.86;
  return (
    <Lugar
      posicao={motion.posicao}
      padrao="centro"
      estilo={{
        flexDirection: "column",
        gap: u * 0.4,
        opacity: c.saida,
        ...(motion.posicao === "topo" ? { paddingTop: "9%" } : {}),
      }}
    >
      {linhas.map((linha, l) => {
        // Largura aproximada do Montserrat Black em maiúsculas: a linha
        // diminui se não couber (até 62%); se ainda assim não couber, quebra
        // em duas (as palavras nunca se encavalam).
        const larguraDaLinha = linha.reduce(
          (soma, p) =>
            soma + (p.texto.length * 0.8 + 0.4) * (p.destaque ? grande : normal) * u,
          0,
        );
        const fator = Math.max(
          0.62,
          Math.min(1, maximo / Math.max(1, larguraDaLinha)),
        );
        // Espaço entre palavras do tamanho de um espaço da letra maior da
        // linha.
        const maiorLetra = linha.some((p) => p.destaque) ? grande : normal;
        return (
          <div
            key={l}
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              justifyContent: "center",
              columnGap: maiorLetra * 0.3 * u * fator,
              maxWidth: maximo,
              whiteSpace: "nowrap",
            }}
          >
            {linha.map((p) => (
              <PalavraFalada
                key={p.indice}
                c={c}
                p={p}
                quadro={quadros[p.indice]}
                tamanho={(p.destaque ? grande : normal) * u * fator}
              />
            ))}
          </div>
        );
      })}
    </Lugar>
  );
};

// Pílula em degradê que nomeia a ação ou o lugar ("LÁ EM CIMA", "CLICA NO
// CANAL"). Fica no topo, salvo outra posição ou x/y.
const Pilula: React.FC<{ c: Ctx; texto: string; escala?: number }> = ({
  c,
  texto,
  escala = 1,
}) => {
  const { u } = c;
  const n = texto.length;
  return (
    <div
      style={{
        display: "inline-block",
        padding: `${u * 1.3 * escala}px ${u * 3.4 * escala}px`,
        borderRadius: u * 10,
        backgroundImage: degrade(c),
        boxShadow: `0 0 ${u * 3}px ${comAlfa(corDoBrilho(c), 0.6)}, inset 0 0 0 ${u * 0.25}px rgba(255,255,255,0.35)`,
        fontFamily: FONTES.forte,
        fontWeight: 900,
        fontSize: u * (n <= 14 ? 5.8 : n <= 22 ? 4.8 : 3.9) * escala,
        lineHeight: 1.1,
        color: BRANCO,
        textTransform: "uppercase",
        letterSpacing: u * 0.04,
        whiteSpace: "nowrap",
        textShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }}
    >
      {texto}
    </div>
  );
};

const Etiqueta: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, motion } = c;
  const s = entrada(c, 0, 260, 14);
  const pilula = (
    <div
      style={{
        transform: `translateY(${(1 - s) * u * 3}px) scale(${0.3 + 0.7 * s})`,
        opacity: Math.min(1, s * 2) * c.saida,
      }}
    >
      <Pilula c={c} texto={semAsteriscos(motion.texto)} />
    </div>
  );
  if (motion.x !== undefined || motion.y !== undefined) {
    return (
      <AbsoluteFill>
        <NoPonto c={c} x={50} y={10}>
          {pilula}
        </NoPonto>
      </AbsoluteFill>
    );
  }
  const p = motion.posicao ?? "topo";
  return (
    <Lugar
      posicao={p}
      padrao="topo"
      estilo={p === "topo" ? { paddingTop: "7%" } : undefined}
    >
      {pilula}
    </Lugar>
  );
};

// Anel brilhante com o texto dentro ("OLHA ISSO."): o círculo se desenha e
// pulsa; um anel fino tracejado gira por dentro.
const Anel: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, motion, frame } = c;
  const raio = u * 23;
  const s = entrada(c, 0, 200, 13);
  const desenho = interpolate(frame, [0, 14], [0, 1], {
    ...LIMITE,
    easing: Easing.out(Easing.cubic),
  });
  const pulso = 1 + 0.025 * Math.sin(frame / 4.5);
  const linhas = motion.texto.split("|");
  const maior = Math.max(...linhas.map((l) => semAsteriscos(l).length), 1);
  const tamanho = Math.min(u * 10, (raio * 1.45) / (maior * 0.72));
  const lado = raio * 2.5;
  const circ = 2 * Math.PI * raio;
  return (
    <AbsoluteFill style={{ opacity: c.saida }}>
      <NoPonto c={c} x={50} y={50}>
        <div
          style={{
            position: "relative",
            width: lado,
            height: lado,
            transform: `scale(${(0.6 + 0.4 * s) * pulso})`,
          }}
        >
          <svg
            width={lado}
            height={lado}
            viewBox={`${-lado / 2} ${-lado / 2} ${lado} ${lado}`}
            style={{
              position: "absolute",
              inset: 0,
              overflow: "visible",
              filter: `drop-shadow(0 0 ${u * 1.6}px ${comAlfa(c.corEscolhida ? c.cor : CIANO, 0.8)})`,
            }}
          >
            <circle r={raio} fill="rgba(10, 14, 30, 0.55)" />
            <circle
              r={raio}
              fill="none"
              stroke={c.corEscolhida ? c.cor : CIANO}
              strokeWidth={u * 0.7}
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - desenho)}
              transform="rotate(-90)"
            />
            <circle
              r={raio * 0.86}
              fill="none"
              stroke={comAlfa(c.corEscolhida ? c.cor : CIANO, 0.45)}
              strokeWidth={u * 0.18}
              strokeDasharray={`${u * 0.6} ${u * 1.2}`}
              transform={`rotate(${frame * 1.5})`}
              opacity={desenho}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONTES.forte,
              fontWeight: 900,
              fontSize: tamanho,
              lineHeight: 1.02,
              color: BRANCO,
              textTransform: "uppercase",
              textAlign: "center",
              opacity: interpolate(frame, [3, 9], [0, 1], LIMITE),
            }}
          >
            {linhas.map((l, i) => (
              <div key={i}>
                <TextoNeon c={c} texto={l} />
              </div>
            ))}
          </div>
        </div>
      </NoPonto>
    </AbsoluteFill>
  );
};

// Ícone de microfone (desenho próprio), centrado em (0, 0), altura ~2.
const IconeMicrofone: React.FC<{ tamanho: number; cor?: string }> = ({
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

// Cartão de vidro que "digita" o texto junto com a voz (comando de voz,
// pesquisa, mensagem). detalhe = cabeçalho (padrão "COMANDO DE VOZ").
const Digitando: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, motion, largura, frame } = c;
  const s = entrada(c, 0, 210, 17);
  const linhas = pedacos(motion.texto);
  const todas = linhas.flat();
  const quadros = quadrosDasPalavras(c, todas.length, 6);
  const ultimo = quadros.length ? Math.max(...quadros) : 0;
  const falando = frame >= (quadros[0] ?? 0) - 2 && frame <= ultimo + 8;
  const larguraCartao = Math.min(largura * 0.9, u * 92);
  const visiveis = quadros.filter((q) => frame >= q).length;
  const p = motion.posicao ?? "topo";
  return (
    <Lugar
      posicao={p}
      padrao="topo"
      estilo={{
        opacity: c.saida,
        ...(p === "topo" ? { paddingTop: "6%" } : {}),
      }}
    >
      <div
        style={{
          width: larguraCartao,
          padding: `${u * 2.4}px ${u * 3}px ${u * 3}px`,
          borderRadius: u * 2.6,
          background: VIDRO,
          border: `${Math.max(1, u * 0.15)}px solid ${LINHA_VIDRO}`,
          boxShadow: `0 ${u * 2}px ${u * 6}px rgba(0,0,0,0.5)`,
          transform: `translateY(${(1 - s) * -u * 6}px) scale(${0.9 + 0.1 * s})`,
          opacity: Math.min(1, s * 2),
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: u * 1.2,
            marginBottom: u * 1.6,
          }}
        >
          <div
            style={{
              width: u * 4.6,
              height: u * 4.6,
              borderRadius: "50%",
              backgroundImage: degrade(c, 135),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconeMicrofone tamanho={u * 3} />
          </div>
          <span
            style={{
              flex: 1,
              fontFamily: FONTES.forte,
              fontWeight: 800,
              fontSize: u * 3,
              letterSpacing: u * 0.3,
              color: CINZA,
              textTransform: "uppercase",
            }}
          >
            {semAsteriscos(motion.detalhe?.trim() || "Comando de voz")}
          </span>
          {/* Ondinha do áudio: mexe enquanto as palavras chegam. */}
          <div style={{ display: "flex", alignItems: "center", gap: u * 0.35 }}>
            {Array.from({ length: 12 }, (_, i) => {
              const h = falando
                ? 0.5 + Math.abs(Math.sin(frame * 0.55 + i * 1.7)) * 2.4
                : 0.35;
              return (
                <div
                  key={i}
                  style={{
                    width: u * 0.35,
                    height: u * h,
                    borderRadius: u,
                    backgroundColor: corNaPosicao(c, i / 11),
                  }}
                />
              );
            })}
          </div>
        </div>
        {linhas.map((linha, l) => (
          <div
            key={l}
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              columnGap: u * 1.3,
            }}
          >
            {linha.map((pd) => {
              const f = frame - quadros[pd.indice];
              const a = interpolate(f, [0, 5], [0, 1], LIMITE);
              const estilo: React.CSSProperties = {
                fontFamily: FONTES.forte,
                fontWeight: pd.destaque ? 900 : 800,
                fontSize: u * (pd.destaque ? 9.2 : 6),
                lineHeight: 1.12,
                opacity: f < 0 ? 0 : a,
                transform: `translateY(${(1 - a) * u * 1.2}px)`,
              };
              return pd.destaque ? (
                <TextoDegrade key={pd.indice} c={c} estilo={estilo}>
                  {pd.texto}
                </TextoDegrade>
              ) : (
                <span
                  key={pd.indice}
                  style={{
                    ...estilo,
                    color: pd.indice === 0 ? CIANO : BRANCO,
                  }}
                >
                  {pd.texto}
                </span>
              );
            })}
            {/* Cursor piscando depois da última palavra que já chegou. */}
            {l === linhas.length - 1 ? (
              <span
                style={{
                  width: u * 0.5,
                  height: u * 6,
                  alignSelf: "center",
                  backgroundColor: CIANO,
                  opacity:
                    visiveis < todas.length || Math.floor(frame / 8) % 2 === 0
                      ? 1
                      : 0,
                }}
              />
            ) : null}
          </div>
        ))}
      </div>
    </Lugar>
  );
};

// Palavra grande + barra de segmentos que enche (o "nível"). detalhe =
// linha pequena em cima ("É ESSE O").
const Barra: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, motion, frame, fps, largura } = c;
  const s = entrada(c, 0, 220, 13);
  const enche = interpolate(frame, [5, 5 + fps * 0.9], [0, 1], {
    ...LIMITE,
    easing: Easing.out(Easing.cubic),
  });
  const segmentos = 16;
  const larguraBarra = Math.min(largura * 0.8, u * 80);
  const espaco = u * 0.75;
  const lado = (larguraBarra - espaco * (segmentos - 1)) / segmentos;
  const texto = motion.texto.trim();
  const maior = semAsteriscos(texto).length;
  return (
    <Lugar
      posicao={motion.posicao}
      padrao="centro"
      estilo={{ flexDirection: "column", gap: u * 1.4, opacity: c.saida }}
    >
      {motion.detalhe?.trim() ? (
        <div
          style={{
            fontFamily: FONTES.forte,
            fontWeight: 800,
            fontSize: u * 5.4,
            color: "rgba(255,255,255,0.78)",
            textTransform: "uppercase",
            opacity: Math.min(1, s * 2),
          }}
        >
          <TextoNeon c={c} texto={motion.detalhe} />
        </div>
      ) : null}
      {texto ? (
        <div
          style={{
            fontFamily: FONTES.forte,
            fontWeight: 900,
            fontSize: u * Math.min(19, 90 / Math.max(1, maior * 0.74)),
            lineHeight: 0.95,
            color: BRANCO,
            textTransform: "uppercase",
            transform: `scale(${0.7 + 0.3 * s})`,
            opacity: Math.min(1, s * 2),
          }}
        >
          <TextoNeon c={c} texto={texto} />
        </div>
      ) : null}
      <div style={{ display: "flex", gap: espaco }}>
        {Array.from({ length: segmentos }, (_, i) => {
          const aceso = interpolate(
            enche * segmentos - i,
            [0, 1],
            [0, 1],
            LIMITE,
          );
          const cor = corNaPosicao(c, i / (segmentos - 1));
          return (
            <div
              key={i}
              style={{
                width: lado,
                height: u * 2.8,
                borderRadius: u * 0.5,
                backgroundColor: aceso > 0 ? cor : "rgba(255,255,255,0.07)",
                opacity: aceso > 0 ? 0.35 + 0.65 * aceso : 1,
                boxShadow:
                  aceso > 0.6 ? `0 0 ${u * 1.2}px ${comAlfa(c.corEscolhida ? c.cor : COR_NEON, 0.5)}` : "none",
              }}
            />
          );
        })}
      </div>
    </Lugar>
  );
};

// Caixa de comentários: o texto é digitado, enviado e aparece publicado
// ("@você · agora"). detalhe = pílula acima ('COMENTE "EU QUERO"').
const Comentario: React.FC<{ c: Ctx }> = ({ c }) => {
  const { motion, frame, fps, largura } = c;
  // Tudo um pouco maior que a medida padrão: a caixa é o centro da tela.
  const u = c.u * 1.35;
  const s = entrada(c, 0, 210, 16);
  const texto = semAsteriscos(motion.texto).trim() || "EU QUERO";
  const comeca = 10;
  const porLetra = fps / 13;
  const terminou = comeca + texto.length * porLetra;
  const envia = Math.round(terminou + 7);
  const letras =
    frame < comeca
      ? 0
      : Math.min(texto.length, Math.floor((frame - comeca) / porLetra) + 1);
  const enviado = frame >= envia;
  const publicado = spring({
    frame: frame - envia,
    fps,
    config: { stiffness: 220, damping: 15, mass: 0.6 },
  });
  const aperto = interpolate(
    frame,
    [envia - 3, envia, envia + 5],
    [1, 0.82, 1],
    LIMITE,
  );
  const larguraCaixa = Math.min(largura * 0.9, c.u * 92);
  const avatar = (tamanho: number) => (
    <div
      style={{
        width: tamanho,
        height: tamanho,
        flexShrink: 0,
        borderRadius: "50%",
        backgroundImage: degrade(c, 135),
        boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.25)",
      }}
    />
  );
  return (
    <Lugar
      posicao={motion.posicao}
      padrao="centro"
      estilo={{ flexDirection: "column", gap: u * 3, opacity: c.saida }}
    >
      {motion.detalhe?.trim() ? (
        <div style={{ transform: `scale(${0.4 + 0.6 * s})`, opacity: s }}>
          <Pilula c={c} texto={semAsteriscos(motion.detalhe)} escala={0.9} />
        </div>
      ) : null}
      <div
        style={{
          width: larguraCaixa,
          padding: u * 2.4,
          borderRadius: u * 2.2,
          background: VIDRO,
          border: `${Math.max(1, u * 0.15)}px solid ${LINHA_VIDRO}`,
          boxShadow: `0 ${u * 2}px ${u * 6}px rgba(0,0,0,0.5)`,
          transform: `translateY(${(1 - s) * u * 5}px)`,
          opacity: Math.min(1, s * 2),
          fontFamily: FONTES.forte,
        }}
      >
        <div style={{ fontSize: u * 2.6, fontWeight: 800, color: BRANCO }}>
          Comentários{" "}
          <span style={{ color: CINZA, fontWeight: 700 }}>1,2 mil</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: u * 1.4,
            marginTop: u * 1.8,
          }}
        >
          {avatar(u * 4)}
          <div
            style={{
              flex: 1,
              height: u * 5,
              display: "flex",
              alignItems: "center",
              padding: `0 ${u * 1.8}px`,
              borderRadius: u * 3,
              background: "rgba(255,255,255,0.06)",
              border: `${Math.max(1, u * 0.2)}px solid ${
                letras > 0 && !enviado
                  ? comAlfa(corDoBrilho(c), 0.9)
                  : "rgba(255,255,255,0.1)"
              }`,
              fontSize: u * (letras > 0 && !enviado ? 3.2 : 2.5),
              fontWeight: letras > 0 && !enviado ? 900 : 600,
              color: letras > 0 && !enviado ? BRANCO : CINZA,
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            {letras > 0 && !enviado
              ? `${texto.slice(0, letras)}${Math.floor(frame / 6) % 2 ? "|" : ""}`
              : "Adicione um comentário…"}
          </div>
          <div
            style={{
              width: u * 4.6,
              height: u * 4.6,
              borderRadius: "50%",
              backgroundImage:
                letras > 0 ? degrade(c, 135) : "linear-gradient(#333, #333)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${aperto})`,
            }}
          >
            <svg width={u * 2.4} height={u * 2.4} viewBox="0 0 24 24">
              <path d="M3 20 L21 12 L3 4 L5 11 L14 12 L5 13 Z" fill={BRANCO} />
            </svg>
          </div>
        </div>
        {/* Comentário publicado (o espaço já fica reservado). */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: u * 1.4,
            marginTop: u * 2,
            opacity: enviado ? publicado : 0,
            transform: `translateY(${(1 - publicado) * u * 2}px)`,
          }}
        >
          {avatar(u * 4)}
          <div>
            <div style={{ fontSize: u * 2, color: CINZA, fontWeight: 700 }}>
              @você · agora
            </div>
            <TextoDegrade
              c={c}
              estilo={{
                display: "inline-block",
                fontSize: u * 5.2,
                fontWeight: 900,
                textTransform: "uppercase",
                lineHeight: 1.1,
              }}
            >
              {texto}
            </TextoDegrade>
          </div>
        </div>
      </div>
    </Lugar>
  );
};

// Mão de "curtir" (desenho próprio) num quadrado 24×24.
const MAO =
  "M2 10.5h4.2V21H2z M7.6 21h9.6a2.1 2.1 0 0 0 2-1.6l1.6-6.6a2.1 2.1 0 0 0-2-2.6h-5.3l0.9-4.2a1.9 1.9 0 0 0-3.4-1.5L7.6 10.4z";

// Botão de curtir: aparece, é tocado, estoura em brilhinhos e uma mão maior
// sobe. Texto numérico = contador que sobe 1 no toque; outro texto = rótulo.
const Curtida: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, motion, frame } = c;
  const toque = 7;
  const s = entrada(c, 0, 240, 13);
  const aperto = interpolate(
    frame,
    [toque - 2, toque + 1, toque + 6],
    [1, 0.8, 1.12],
    LIMITE,
  );
  const volta = interpolate(frame, [toque + 6, toque + 12], [1.12, 1], LIMITE);
  const estouro = interpolate(frame, [toque, toque + 16], [0, 1], {
    ...LIMITE,
    easing: Easing.out(Easing.cubic),
  });
  const sobe = interpolate(frame, [toque, toque + 20], [0, 1], LIMITE);
  const raio = u * 9.5;
  const texto = semAsteriscos(motion.texto).trim();
  const numero = /^\d+$/.test(texto) ? Number(texto) : null;
  const rotulo =
    numero !== null ? String(frame < toque ? Math.max(0, numero - 1) : numero) : texto;
  const tocou = frame >= toque;
  return (
    <AbsoluteFill style={{ opacity: c.saida }}>
      <NoPonto c={c} x={50} y={56}>
        <div
          style={{
            position: "relative",
            width: raio * 2,
            height: raio * 2,
            transform: `scale(${s * (frame < toque + 6 ? aperto : volta)})`,
          }}
        >
          {/* Brilhinhos do estouro. */}
          {Array.from({ length: 10 }, (_, i) => {
            const ang = (i / 10) * Math.PI * 2 + random(`curtida-${i}`) * 0.5;
            const dist = raio * (1.1 + estouro * (1.1 + random(`d-${i}`) * 0.6));
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: raio + Math.cos(ang) * dist - u * 0.6,
                  top: raio + Math.sin(ang) * dist - u * 0.6,
                  width: u * 1.2,
                  height: u * 1.2,
                  borderRadius: "50%",
                  backgroundColor: corNaPosicao(c, i / 9),
                  opacity: tocou ? 1 - estouro : 0,
                }}
              />
            );
          })}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              backgroundImage: tocou
                ? degrade(c, 135)
                : "linear-gradient(#2A2D3E, #2A2D3E)",
              boxShadow: tocou
                ? `0 0 ${u * 4}px ${comAlfa(corDoBrilho(c), 0.7)}`
                : `inset 0 0 0 ${u * 0.3}px rgba(255,255,255,0.2)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width={raio * 1.1} height={raio * 1.1} viewBox="0 0 24 24">
              <path d={MAO} fill={BRANCO} />
            </svg>
          </div>
          {/* Mão maior que "pula" do botão. */}
          <svg
            width={raio * 1.6}
            height={raio * 1.6}
            viewBox="0 0 24 24"
            style={{
              position: "absolute",
              left: raio * 0.5,
              top: -raio * 1.2 - sobe * raio * 1.4,
              opacity: tocou ? interpolate(sobe, [0, 0.08, 0.75, 1], [0, 1, 1, 0]) : 0,
              transform: `scale(${0.6 + sobe * 0.7}) rotate(${-12 + sobe * 10}deg)`,
              filter: `drop-shadow(0 0 ${u * 1.5}px ${comAlfa(c.corEscolhida ? c.cor : CIANO, 0.9)})`,
            }}
          >
            <path d={MAO} fill={c.corEscolhida ? c.cor : CIANO} />
          </svg>
          {rotulo ? (
            <div
              style={{
                position: "absolute",
                top: raio * 2 + u * 1.2,
                left: "50%",
                transform: "translateX(-50%)",
                fontFamily: FONTES.forte,
                fontWeight: 900,
                fontSize: u * 4.6,
                color: BRANCO,
                whiteSpace: "nowrap",
                textTransform: "uppercase",
              }}
            >
              {rotulo}
            </div>
          ) : null}
        </div>
      </NoPonto>
    </AbsoluteFill>
  );
};

// Toque na tela: um "dedo" (círculo claro) chega, aperta e solta uma onda.
const Toque: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, frame } = c;
  const aperta = 9;
  const chega = interpolate(frame, [0, 6], [0, 1], {
    ...LIMITE,
    easing: Easing.out(Easing.cubic),
  });
  const aperto = interpolate(
    frame,
    [aperta, aperta + 3, aperta + 8],
    [1, 0.72, 1],
    LIMITE,
  );
  const onda = (atraso: number) =>
    interpolate(frame, [aperta + atraso, aperta + atraso + 14], [0, 1], {
      ...LIMITE,
      easing: Easing.out(Easing.cubic),
    });
  const raio = u * 3.4;
  const corOnda = c.corEscolhida ? c.cor : CIANO;
  return (
    <AbsoluteFill style={{ opacity: c.saida }}>
      <NoPonto c={c} x={50} y={50}>
        <div style={{ position: "relative", width: raio * 2, height: raio * 2 }}>
          {[0, 5].map((atraso) => {
            const o = onda(atraso);
            return (
              <div
                key={atraso}
                style={{
                  position: "absolute",
                  left: raio - raio * (1 + o * 2.4),
                  top: raio - raio * (1 + o * 2.4),
                  width: raio * 2 * (1 + o * 2.4),
                  height: raio * 2 * (1 + o * 2.4),
                  borderRadius: "50%",
                  border: `${u * 0.45}px solid ${corOnda}`,
                  opacity: frame >= aperta + atraso ? 0.9 * (1 - o) : 0,
                }}
              />
            );
          })}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.72)",
              border: `${u * 0.35}px solid rgba(255,255,255,0.95)`,
              boxShadow: `0 ${u * 0.4}px ${u * 1.6}px rgba(0,0,0,0.45)`,
              opacity: chega,
              transform: `scale(${(1.5 - 0.5 * chega) * aperto})`,
            }}
          />
        </div>
      </NoPonto>
    </AbsoluteFill>
  );
};

// Estrela de 4 pontas (raio 1), para o brilho.
const ESTRELA =
  "M0,-1 C0.1,-0.1 0.1,-0.1 1,0 C0.1,0.1 0.1,0.1 0,1 C-0.1,0.1 -0.1,0.1 -1,0 C-0.1,-0.1 -0.1,-0.1 0,-1 Z";

// Brilho ✦: uma estrela grande que gira e pisca, com duas pequenas.
const Brilho: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, frame, fps } = c;
  const estrela = (atraso: number, tamanho: number, dx: number, dy: number) => {
    const s = spring({
      frame: frame - atraso,
      fps,
      config: { stiffness: 260, damping: 10, mass: 0.5 },
    });
    const pisca = 1 + 0.18 * Math.sin((frame - atraso) / 3);
    return (
      <svg
        key={atraso}
        width={tamanho * 2}
        height={tamanho * 2}
        viewBox="-1 -1 2 2"
        style={{
          position: "absolute",
          left: dx - tamanho,
          top: dy - tamanho,
          overflow: "visible",
          transform: `scale(${s * pisca}) rotate(${(1 - s) * -90}deg)`,
          filter: `drop-shadow(0 0 ${u * 1.4}px ${comAlfa(c.corEscolhida ? c.cor : CIANO, 0.95)})`,
        }}
      >
        <path d={ESTRELA} fill={frame < atraso ? "transparent" : "#E9FBFF"} />
        <path
          d={ESTRELA}
          fill={c.corEscolhida ? c.cor : CIANO}
          transform="scale(0.55)"
        />
      </svg>
    );
  };
  return (
    <AbsoluteFill style={{ opacity: c.saida }}>
      <NoPonto c={c} x={72} y={30}>
        <div style={{ position: "relative", width: 0, height: 0 }}>
          {estrela(0, u * 5, 0, 0)}
          {estrela(4, u * 2, u * 5, -u * 4)}
          {estrela(7, u * 1.4, -u * 4, u * 4.5)}
        </div>
      </NoPonto>
    </AbsoluteFill>
  );
};

// Microfone ouvindo: círculo em degradê com o microfone e barrinhas em
// volta que mexem como uma voz; a cor vai do azul ao roxo.
const Microfone: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, frame } = c;
  const s = entrada(c, 0, 200, 12);
  const raio = u * 12;
  const lado = raio * 4.4;
  const barras = 56;
  const passo = c.duracao > 1 ? frame / c.duracao : 0;
  const corA = c.corEscolhida ? c.cor : misturar(CIANO, ROXO, passo);
  const corB = c.corEscolhida ? c.cor : misturar(AZUL, "#7C3AED", passo);
  return (
    <AbsoluteFill style={{ opacity: c.saida }}>
      {/* No vídeo deitado fica mais baixo, para caber o texto em cima. */}
      <NoPonto c={c} x={50} y={c.altura > c.largura ? 48 : 60}>
        <div
          style={{
            position: "relative",
            width: lado,
            height: lado,
            transform: `scale(${0.5 + 0.5 * s})`,
          }}
        >
          <svg
            width={lado}
            height={lado}
            viewBox={`${-lado / 2} ${-lado / 2} ${lado} ${lado}`}
            style={{ position: "absolute", inset: 0, overflow: "visible" }}
          >
            {Array.from({ length: barras }, (_, i) => {
              const ang = (i / barras) * 360;
              const voz =
                Math.abs(
                  Math.sin(frame * 0.33 + i * 0.9) * 0.6 +
                    Math.sin(frame * 0.12 + i * 2.3) * 0.4,
                ) * s;
              const comprimento = u * (0.8 + voz * 4.2);
              return (
                <rect
                  key={i}
                  x={-u * 0.3}
                  y={-(raio * 1.22 + comprimento)}
                  width={u * 0.6}
                  height={comprimento}
                  rx={u * 0.3}
                  fill={i % 2 ? corA : corB}
                  opacity={0.85}
                  transform={`rotate(${ang})`}
                />
              );
            })}
            <circle
              r={raio * 1.1}
              fill="none"
              stroke={comAlfa(c.corEscolhida ? c.cor : CIANO, 0.5)}
              strokeWidth={u * 0.25}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              left: lado / 2 - raio,
              top: lado / 2 - raio,
              width: raio * 2,
              height: raio * 2,
              borderRadius: "50%",
              backgroundImage: `linear-gradient(135deg, ${corA}, ${corB})`,
              boxShadow: `0 0 ${u * 5}px ${comAlfa(c.corEscolhida ? c.cor : COR_NEON, 0.6)}, inset 0 0 0 ${u * 0.3}px rgba(255,255,255,0.25)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconeMicrofone tamanho={raio * 1.1} />
          </div>
        </div>
      </NoPonto>
    </AbsoluteFill>
  );
};

// Selo inclinado com ✓ ("FECHOU?", "PRONTO", "APROVADO").
const Confirmado: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, motion } = c;
  const s = entrada(c, 0, 240, 11);
  const texto = semAsteriscos(motion.texto).trim() || "Fechou?";
  const selo = (
    <div
      style={{
        padding: u * 0.45,
        borderRadius: u * 2.4,
        backgroundImage: degrade(c, 135),
        boxShadow: `0 0 ${u * 3}px ${comAlfa(corDoBrilho(c), 0.6)}`,
        transform: `rotate(${-8 - (1 - s) * 18}deg) scale(${0.4 + 0.6 * s})`,
        opacity: Math.min(1, s * 2),
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: u * 1.4,
          padding: `${u * 1.2}px ${u * 2.6}px ${u * 1.2}px ${u * 1.4}px`,
          borderRadius: u * 2,
          background: "#12122A",
        }}
      >
        <div
          style={{
            width: u * 5,
            height: u * 5,
            borderRadius: "50%",
            backgroundImage: degrade(c, 135),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width={u * 3} height={u * 3} viewBox="0 0 24 24">
            <path
              d="M5 12.5 L10 17.5 L19 7"
              fill="none"
              stroke={BRANCO}
              strokeWidth={3.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <TextoDegrade
          c={c}
          estilo={{
            fontFamily: FONTES.forte,
            fontWeight: 900,
            fontSize: u * (texto.length <= 10 ? 7.6 : 5.6),
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {texto}
        </TextoDegrade>
      </div>
    </div>
  );
  if (motion.x !== undefined || motion.y !== undefined) {
    return (
      <AbsoluteFill style={{ opacity: c.saida }}>
        <NoPonto c={c} x={62} y={12}>
          {selo}
        </NoPonto>
      </AbsoluteFill>
    );
  }
  const p = motion.posicao ?? "topo";
  return (
    <Lugar
      posicao={p}
      padrao="topo"
      estilo={{ opacity: c.saida, ...(p === "topo" ? { paddingTop: "8%" } : {}) }}
    >
      {selo}
    </Lugar>
  );
};

export const MODELOS_NEON: Record<ModeloNeon, React.FC<{ c: Ctx }>> = {
  fala: Fala,
  etiqueta: Etiqueta,
  anel: Anel,
  digitando: Digitando,
  barra: Barra,
  comentario: Comentario,
  curtida: Curtida,
  toque: Toque,
  brilho: Brilho,
  microfone: Microfone,
  confirmado: Confirmado,
};
