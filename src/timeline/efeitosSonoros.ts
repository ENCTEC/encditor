import {
  arquivoDoSom,
  EFEITOS_VISUAIS,
  IdSom,
  MOTIONS,
  SONS,
} from "@/catalogo/estilos";
import { calcularClipes, inicioDosClipes } from "./calculos";
import { adicionarItem } from "./operacoes";
import { Efeito, Motion, Timeline, TipoTransicao } from "./schema";

// Onde entram os efeitos sonoros do encEditor (public/sons): no meio de
// cada transição, na chegada de cada motion e no começo de cada efeito de
// imagem. Usado pela IA (ferramentas), pela montagem do plano e pela
// Timeline.

const r3 = (n: number) => Math.round(n * 1000) / 1000;

// Som de cada transição (null = transição suave, sem som).
export const SOM_DA_TRANSICAO: Record<TipoTransicao, IdSom | null> = {
  corte: null,
  fade: null,
  borrao: null,
  relogio: null,
  iris: "swoosh",
  slide: "swoosh",
  cortina: "swoosh",
  virar: "swoosh",
  chicote: "swoosh",
  mergulho: "whoosh",
  giro: "whoosh",
  impacto: "boom",
  clarao: "obturador",
  falha: "falha",
  degrade: "whoosh",
};

// Sons "de passagem" chegam no auge no meio; os de batida começam no ponto.
const PASSAGEM: IdSom[] = ["whoosh", "swoosh", "subida"];

const dadosDoSom = (id: IdSom) => SONS.find((s) => s.id === id)!;

// Põe um efeito sonoro no vídeo final. "momento" = onde o som deve
// "acontecer" (o auge do whoosh, a batida do boom).
export const adicionarSom = (
  t: Timeline,
  id: IdSom,
  momento: number,
  volume?: number,
): Timeline => {
  const som = dadosDoSom(id);
  const inicio = Math.max(
    0,
    PASSAGEM.includes(id)
      ? momento - (id === "subida" ? som.duracao : som.duracao / 2)
      : momento,
  );
  return adicionarItem(t, "audios", {
    url: arquivoDoSom(id),
    inicio: r3(inicio),
    fim: r3(inicio + som.duracao),
    origemInicio: 0,
    volume: volume ?? som.volume,
    fadeEntrada: 0,
    fadeSaida: 0,
  });
};

// Já há um efeito sonoro perto deste momento?
export const temSomPerto = (t: Timeline, momento: number, folga = 0.25) =>
  t.audios.some(
    (a) =>
      a.url.startsWith("/sons/") &&
      momento >= a.inicio - folga &&
      momento <= a.fim + folga,
  );

// Quanto depois do início o motion "chega" na tela: o carimbo bate, o
// alfinete da nota espeta, a ficha começa a ser datilografada.
const CHEGADA: Partial<Record<Motion["modelo"], number>> = {
  contador: 1.2,
  carimbo: 0.1,
  nota: 0.17,
  ficha: 0.27,
  // Kit neon: a barra termina de encher (a subida acaba aí), o comentário
  // começa a ser digitado, o dedo aperta, o botão de curtir é tocado.
  barra: 1.05,
  comentario: 0.33,
  toque: 0.3,
  curtida: 0.23,
  anel: 0.2,
  digitando: 0.2,
};

// Momento em que o motion "chega" na tela (o preço novo salta um pouco
// depois do antigo; o contador termina de contar ~1,2s depois; o cartão
// digitando começa a escrever na 1ª palavra falada).
export const momentoDoSomDoMotion = (m: Motion) =>
  m.inicio +
  (m.modelo === "preco" && m.detalhe?.trim()
    ? 0.55
    : m.modelo === "digitando" && m.palavras?.length
      ? Math.max(0, m.palavras[0].de)
      : (CHEGADA[m.modelo] ?? 0.05));

export const somDoMotion = (m: Motion) =>
  MOTIONS.find((x) => x.id === m.modelo)?.som ?? null;

export const somDoEfeito = (e: Efeito) =>
  EFEITOS_VISUAIS.find((x) => x.id === e.tipo)?.som ?? null;

// Momento do meio de cada transição (no vídeo final), com o tipo dela.
export const transicoesDoVideo = (t: Timeline) => {
  const clipes = calcularClipes(t);
  const inicios = inicioDosClipes(clipes);
  return clipes.flatMap((c, i) =>
    i > 0 && c.transicao !== "corte" && c.transicaoFrames > 0
      ? [
          {
            cena: i + 1,
            tipo: c.transicao,
            meio: (inicios[i] + c.transicaoFrames / 2) / t.fps,
          },
        ]
      : [],
  );
};

// Coloca o som que combina em cada transição, motion e efeito que ainda não
// tem um efeito sonoro por perto. Devolve a timeline nova e quantos sons
// entraram.
export const sonsAutomaticos = (
  t: Timeline,
  oQue: { transicoes?: boolean; motions?: boolean; efeitos?: boolean } = {
    transicoes: true,
    motions: true,
    efeitos: true,
  },
) => {
  let nova = t;
  let colocados = 0;
  const por = (id: IdSom | null, momento: number) => {
    if (!id || temSomPerto(nova, momento)) return;
    nova = adicionarSom(nova, id, momento);
    colocados++;
  };
  if (oQue.transicoes) {
    for (const x of transicoesDoVideo(t)) por(SOM_DA_TRANSICAO[x.tipo], x.meio);
  }
  if (oQue.motions) {
    for (const m of t.motions ?? [])
      por(somDoMotion(m), momentoDoSomDoMotion(m));
  }
  if (oQue.efeitos) {
    for (const e of t.efeitos ?? []) por(somDoEfeito(e), e.inicio);
  }
  return { timeline: nova, colocados };
};
