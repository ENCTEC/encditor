import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring } from "remotion";
import { Camada } from "../../timeline/schema";
import { FONTES } from "./fontes";
import { Ctx, entrada, LIMITE, Lugar } from "./motionBase";
import {
  comAlfa,
  corDe,
  corDoBrilho,
  corDoTexto,
  degrade,
  NoPonto,
  TextoNeon,
} from "./neonBase";

// Motions que a IA monta sem programar:
// - desenho: camadas simples (caixa, círculo, texto, emoji, imagem, traço)
//   com entrada, movimento e repetição — cenas novas como um celular com
//   um app de banco, um gráfico ou um contrato carimbado;
// - marca: a logo (uma imagem da biblioteca) entrando num cartão.
// Como nos outros motions, o desenho é o mesmo em todo quadro (só o
// estilo muda com o tempo).

// "paleta1/2/3", "degrade", "texto" ou #rrggbb.
const corDaCamada = (c: Ctx, cor: string | undefined, padrao: string) => {
  const v = cor?.trim() || padrao;
  if (v === "paleta1") return corDe(c, 0);
  if (v === "paleta2") return corDe(c, 1);
  if (v === "paleta3") return corDe(c, 2);
  if (v === "texto") return corDoTexto(c);
  return v;
};
const fundoDaCamada = (c: Ctx, cor: string | undefined, padrao: string) =>
  cor?.trim() === "degrade"
    ? { backgroundImage: degrade(c, 135) }
    : { backgroundColor: corDaCamada(c, cor, padrao) };

const FONTE_DA_CAMADA = {
  forte: () => FONTES.forte,
  interface: () => FONTES.interface,
  condensada: () => FONTES.condensada,
  mono: () => FONTES.mono,
  marcador: () => FONTES.spray,
} as const;

// Número no jeito brasileiro (1.234,5).
const numeroBr = (n: number, casas: number) =>
  n.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });

type Caixa = { largura: number; altura: number };

const CamadaDesenhada: React.FC<{
  c: Ctx;
  camadas: Camada[];
  indice: number;
  mae: Caixa | null;
}> = ({ c, camadas, indice, mae }) => {
  const { u, frame, fps } = c;
  const k = camadas[indice];
  const t = frame / fps;

  // Caixa: solta = centro em % da tela e tamanho em u; dentro de outra =
  // tudo em % da caixa da mãe.
  const largura = mae ? (k.l / 100) * mae.largura : k.l * u;
  const altura = mae ? (k.a / 100) * mae.altura : k.a * u;
  const base = mae ?? { largura: c.largura, altura: c.altura };
  const cx = (k.x / 100) * base.largura;
  const cy = (k.y / 100) * base.altura;

  // Entrada.
  const entra = k.entra ?? 0;
  const efeito = k.efeito ?? "surge";
  const p = spring({
    frame: frame - entra * fps,
    fps,
    config:
      efeito === "pula"
        ? { stiffness: 220, damping: 9, mass: 0.6 }
        : { stiffness: 170, damping: 15, mass: 0.7 },
  });
  const apareceu = frame >= entra * fps;
  const desloca = 8 * u * (1 - p);
  const translado = {
    sobe: `translateY(${desloca}px)`,
    desce: `translateY(${-desloca}px)`,
    esquerda: `translateX(${-desloca * 1.4}px)`,
    direita: `translateX(${desloca * 1.4}px)`,
  }[efeito as "sobe"] ?? "";
  const escalaEntrada =
    efeito === "zoom" || efeito === "pula" || efeito === "gira" ? 0.35 + 0.65 * p : 1;
  const giroEntrada = efeito === "gira" ? (1 - p) * -120 : 0;
  const opacEntrada = !apareceu
    ? 0
    : ["cresce", "desenha", "digita"].includes(efeito)
      ? 1
      : Math.min(1, p * 1.6);

  // Saída (0,25 s) — sem "sai", fica até o fim do motion.
  const opacSaida =
    k.sai !== undefined
      ? interpolate(t, [k.sai, k.sai + 0.25], [1, 0], LIMITE)
      : 1;

  // Movimento.
  const m = k.move
    ? interpolate(t, [k.move.de, Math.max(k.move.de + 0.05, k.move.ate)], [0, 1], {
        ...LIMITE,
        easing: Easing.inOut(Easing.cubic),
      })
    : 0;
  const paraX =
    k.move?.x !== undefined ? (((k.move.x - k.x) / 100) * base.largura) * m : 0;
  const paraY =
    k.move?.y !== undefined ? (((k.move.y - k.y) / 100) * base.altura) * m : 0;
  const escalaMove = 1 + ((k.move?.escala ?? 1) - 1) * m;
  const giroMove = (k.move?.rotacao ?? 0) * m;

  // Repetição.
  const r = t - entra;
  const repete = k.repete;
  const escalaRepete = repete === "pulsa" ? 1 + 0.045 * Math.sin(r * 5) : 1;
  const yRepete = repete === "flutua" ? Math.sin(r * 2.2) * u * 0.8 : 0;
  const giroRepete =
    repete === "gira" ? r * 90 : repete === "balanca" ? Math.sin(r * 4) * 6 : 0;
  const opacRepete = repete === "pisca" ? (Math.sin(r * 7) > -0.3 ? 1 : 0.35) : 1;

  // "cresce" = estica da esquerda (barras); "desenha" (fora o traço) =
  // revela da esquerda para a direita.
  const escalaX = efeito === "cresce" ? Math.max(0.001, p) : 1;
  const revela =
    efeito === "desenha" && k.tipo !== "traco"
      ? `inset(0 ${(1 - Math.min(1, p)) * 100}% 0 0)`
      : undefined;

  const transform = [
    "translate(-50%, -50%)",
    translado,
    `translate(${paraX}px, ${paraY + yRepete}px)`,
    `rotate(${(k.rotacao ?? 0) + giroEntrada + giroMove + giroRepete}deg)`,
    `scale(${escalaEntrada * escalaMove * escalaRepete})`,
    efeito === "cresce" ? `scaleX(${escalaX})` : "",
  ].join(" ");

  const sombra = [
    k.sombra ? `0 ${u * 0.8}px ${u * 2.6}px rgba(0, 0, 0, ${c.claro ? 0.18 : 0.45})` : "",
    k.brilho ? `0 0 ${u * 3}px ${comAlfa(corDoBrilho(c), 0.7)}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  const borda =
    k.borda && (k.tipo === "caixa" || k.tipo === "circulo" || k.tipo === "imagem")
      ? `${(k.espessura ?? 0.45) * u}px solid ${corDaCamada(c, k.borda, "paleta1")}`
      : undefined;

  // O conteúdo de cada tipo.
  let conteudo: React.ReactNode = null;
  let fundo: React.CSSProperties = {};
  if (k.tipo === "caixa" || k.tipo === "circulo") {
    fundo = fundoDaCamada(c, k.cor, c.claro ? "#FFFFFF" : "rgba(20, 20, 36, 0.92)");
  } else if (k.tipo === "texto") {
    let texto = k.texto ?? "";
    if (k.conta) {
      const dura = k.conta.duracao ?? 1.2;
      const q = interpolate(t, [entra, entra + dura], [0, 1], {
        ...LIMITE,
        easing: Easing.out(Easing.cubic),
      });
      const valor = k.conta.de + (k.conta.ate - k.conta.de) * q;
      texto = `${k.conta.antes ?? ""}${numeroBr(valor, k.conta.casas ?? 0)}${k.conta.depois ?? ""}`;
    }
    if (efeito === "digita") {
      const letras = Math.max(0, Math.floor((t - entra) / 0.045));
      texto = texto.slice(0, letras);
    }
    conteudo = (
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems:
            k.alinhar === "esquerda"
              ? "flex-start"
              : k.alinhar === "direita"
                ? "flex-end"
                : "center",
          textAlign: k.alinhar === "esquerda" ? "left" : k.alinhar === "direita" ? "right" : "center",
          fontFamily: FONTE_DA_CAMADA[k.fonte ?? "forte"](),
          fontWeight: k.peso ?? (k.fonte === "interface" ? 700 : 900),
          fontSize: (k.tamanho ?? 5) * u,
          lineHeight: 1.08,
          color: corDaCamada(c, k.cor === "degrade" ? undefined : k.cor, "texto"),
          textTransform: k.fonte === "interface" ? "none" : "uppercase",
        }}
      >
        {texto.split("|").map((linha, i) => (
          <div key={i}>
            {k.cor === "degrade" ? <TextoNeon c={c} texto={`*${linha.replace(/\*/g, "")}*`} /> : <TextoNeon c={c} texto={linha} />}
          </div>
        ))}
      </div>
    );
  } else if (k.tipo === "emoji") {
    conteudo = (
      <div
        style={{
          fontSize: Math.min(largura, altura) * 0.82,
          lineHeight: 1,
        }}
      >
        {k.texto ?? "⭐"}
      </div>
    );
  } else if (k.tipo === "imagem" && k.imagem) {
    conteudo = (
      <Img
        src={k.imagem}
        style={{
          width: "100%",
          height: "100%",
          objectFit: k.ajuste === "cobrir" ? "cover" : "contain",
          borderRadius: (k.cantos ?? 0) * u,
        }}
      />
    );
  } else if (k.tipo === "traco" && k.d) {
    const desenho = efeito === "desenha" ? Math.min(1, p) : 1;
    conteudo = (
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ overflow: "visible" }}
      >
        <path
          d={k.d}
          pathLength={1}
          fill="none"
          stroke={corDaCamada(c, k.cor, "paleta1")}
          strokeWidth={(k.espessura ?? 0.8) * u}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          strokeDasharray={1}
          strokeDashoffset={1 - desenho}
        />
      </svg>
    );
  }

  const filhas = camadas
    .map((x, j) => ({ x, j }))
    .filter(({ x, j }) => x.dentro === indice && j > indice);

  return (
    <div
      style={{
        position: "absolute",
        left: cx,
        top: cy,
        width: largura,
        height: altura,
        transform,
        transformOrigin: efeito === "cresce" ? "left center" : "center",
        opacity: (k.opacidade ?? 1) * opacEntrada * opacSaida * opacRepete,
        borderRadius:
          k.tipo === "circulo" ? "50%" : (k.cantos ?? (k.tipo === "caixa" ? 2 : 0)) * u,
        boxShadow: sombra || undefined,
        border: borda,
        clipPath: revela,
        overflow: k.recorta ? "hidden" : undefined,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        ...fundo,
      }}
    >
      {conteudo}
      {filhas.map(({ j }) => (
        <CamadaDesenhada
          key={j}
          c={c}
          camadas={camadas}
          indice={j}
          mae={{ largura, altura }}
        />
      ))}
    </div>
  );
};

const Desenho: React.FC<{ c: Ctx }> = ({ c }) => {
  const camadas = c.motion.camadas ?? [];
  // Soltas = sem mãe válida (a mãe tem de vir antes).
  const soltas = camadas
    .map((x, j) => ({ x, j }))
    .filter(({ x, j }) => x.dentro === undefined || x.dentro >= j);
  return (
    <AbsoluteFill style={{ opacity: c.saida }}>
      {soltas.map(({ j }) => (
        <CamadaDesenhada key={j} c={c} camadas={camadas} indice={j} mae={null} />
      ))}
    </AbsoluteFill>
  );
};

// A logo num cartão branco (logos são feitas para fundo branco) com o
// brilho da direção de arte; texto = legenda curta embaixo (opcional).
const Marca: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, motion, frame } = c;
  const s = entrada(c, 0, 200, 12);
  const flutua = Math.sin(frame / 14) * u * 0.5;
  const cartao = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: u * 2,
        transform: `translateY(${flutua}px) rotate(${(1 - s) * -8}deg) scale(${0.55 + 0.45 * s})`,
        opacity: Math.min(1, s * 2),
      }}
    >
      <div
        style={{
          width: u * 34,
          height: u * 20,
          padding: u * 2.2,
          boxSizing: "border-box",
          borderRadius: u * 3,
          background: "#FFFFFF",
          boxShadow: `0 ${u}px ${u * 3}px rgba(0, 0, 0, 0.22), 0 0 ${u * 3.2}px ${comAlfa(corDoBrilho(c), 0.55)}`,
          border: `${u * 0.45}px solid ${comAlfa(corDe(c, 0), 0.9)}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {motion.imagem ? (
          <Img
            src={motion.imagem}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
        ) : null}
      </div>
      {motion.texto.trim() ? (
        <div
          style={{
            fontFamily: FONTES.forte,
            fontWeight: 900,
            fontSize: u * 4.4,
            textTransform: "uppercase",
            color: corDoTexto(c),
            textAlign: "center",
          }}
        >
          <TextoNeon c={c} texto={motion.texto} />
        </div>
      ) : null}
    </div>
  );
  if (motion.x !== undefined || motion.y !== undefined) {
    return (
      <AbsoluteFill style={{ opacity: c.saida }}>
        <NoPonto c={c} x={50} y={60}>
          {cartao}
        </NoPonto>
      </AbsoluteFill>
    );
  }
  return (
    <Lugar posicao={motion.posicao} padrao="centro" estilo={{ opacity: c.saida }}>
      {cartao}
    </Lugar>
  );
};

export const MODELOS_DESENHO = {
  desenho: Desenho,
  marca: Marca,
};
