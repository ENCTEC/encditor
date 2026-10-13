import { AudioFaixa, Clipe, Insert, Legenda, Timeline, Zoom } from "./schema";

// Todas as mudanças na timeline passam por estas funções. Elas são puras:
// recebem a timeline e devolvem uma NOVA (sem alterar a original), o que
// permite desfazer/refazer. Na etapa da IA, cada uma vira uma ferramenta
// que o Claude pode chamar ("corte 2 segundos" -> atualizarItem em um clipe).

export type ItensPorFaixa = {
  clipes: Clipe;
  inserts: Insert;
  audios: AudioFaixa;
  zooms: Zoom;
  legendas: Legenda;
};

export type Faixa = keyof ItensPorFaixa;

export const FAIXAS: Faixa[] = [
  "clipes",
  "inserts",
  "audios",
  "zooms",
  "legendas",
];

export const timelineVazia = (): Timeline => ({
  fps: 30,
  largura: 1920,
  altura: 1080,
  duracaoTransicao: 0.5,
  clipes: [],
  inserts: [],
  audios: [],
  zooms: [],
  legendas: [],
});

const conferirIndice = (t: Timeline, faixa: Faixa, indice: number) => {
  if (indice < 0 || indice >= t[faixa].length) {
    throw new Error(`Item ${indice + 1} não existe em "${faixa}".`);
  }
};

export const adicionarItem = <F extends Faixa>(
  t: Timeline,
  faixa: F,
  item: ItensPorFaixa[F],
): Timeline => ({ ...t, [faixa]: [...t[faixa], item] });

export const atualizarItem = <F extends Faixa>(
  t: Timeline,
  faixa: F,
  indice: number,
  mudancas: Partial<ItensPorFaixa[F]>,
): Timeline => {
  conferirIndice(t, faixa, indice);
  const itens = [...t[faixa]] as ItensPorFaixa[F][];
  itens[indice] = { ...itens[indice], ...mudancas };
  return { ...t, [faixa]: itens };
};

export const removerItem = (
  t: Timeline,
  faixa: Faixa,
  indice: number,
): Timeline => {
  conferirIndice(t, faixa, indice);
  return {
    ...t,
    [faixa]: t[faixa].filter((_, i) => i !== indice),
  };
};

// Muda a ordem de um clipe na trilha principal.
export const moverClipe = (t: Timeline, de: number, para: number): Timeline => {
  conferirIndice(t, "clipes", de);
  if (para < 0 || para >= t.clipes.length || de === para) {
    return t;
  }
  const clipes = [...t.clipes];
  const [clipe] = clipes.splice(de, 1);
  clipes.splice(para, 0, clipe);
  return { ...t, clipes };
};

// Muda formato do vídeo final (ex.: 1920x1080 ou 1080x1920).
export const definirFormato = (
  t: Timeline,
  largura: number,
  altura: number,
): Timeline => ({ ...t, largura, altura });

// Coloca um clipe numa posição da trilha (0 = primeiro). Sem posição, vai
// para o fim. Permite também repetir uma cena já usada.
export const inserirClipe = (
  t: Timeline,
  clipe: Clipe,
  posicao?: number,
): Timeline => {
  const clipes = [...t.clipes];
  const indice =
    posicao === undefined
      ? clipes.length
      : Math.max(0, Math.min(posicao, clipes.length));
  clipes.splice(indice, 0, clipe);
  return { ...t, clipes };
};

// Divide um clipe em dois. "segundosNoClipe" é contado a partir do início
// do clipe (não do vídeo de origem). A 2ª parte entra com corte seco.
export const dividirClipe = (
  t: Timeline,
  indice: number,
  segundosNoClipe: number,
): Timeline => {
  conferirIndice(t, "clipes", indice);
  const clipe = t.clipes[indice];
  const ponto = Math.round((clipe.inicio + segundosNoClipe) * 100) / 100;
  if (ponto <= clipe.inicio + 0.05 || ponto >= clipe.fim - 0.05) {
    throw new Error(
      `Ponto de divisão fora da cena ${indice + 1} (ela dura ${(clipe.fim - clipe.inicio).toFixed(2)}s).`,
    );
  }
  const primeira: Clipe = { ...clipe, fim: ponto };
  const segunda: Clipe = {
    ...clipe,
    inicio: ponto,
    transicao: "corte",
    direcao: undefined,
    duracaoTransicao: undefined,
  };
  const clipes = [...t.clipes];
  clipes.splice(indice, 1, primeira, segunda);
  return { ...t, clipes };
};

// Põe um vídeo da biblioteca na trilha principal (no fim, ou na posição
// indicada). Se for a primeira cena, ela define o formato do vídeo final.
export const colocarCena = (
  t: Timeline,
  video: {
    url: string;
    duracao: number | null;
    largura: number | null;
    altura: number | null;
  },
  opcoes: { posicao?: number; de?: number; ate?: number } = {},
): Timeline => {
  const formato =
    t.clipes.length === 0 && video.largura && video.altura
      ? { largura: video.largura, altura: video.altura }
      : {};
  const de = opcoes.de ?? 0;
  const ate =
    opcoes.ate ??
    Math.max(de + 0.1, Math.floor((video.duracao ?? 5) * 100) / 100);
  return inserirClipe(
    { ...t, ...formato },
    { url: video.url, inicio: de, fim: ate, transicao: "corte", volume: 1 },
    opcoes.posicao,
  );
};
