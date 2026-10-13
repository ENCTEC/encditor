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
