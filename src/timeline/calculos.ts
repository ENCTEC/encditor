import { Clipe, Timeline } from "./schema";

const segParaFrames = (segundos: number, fps: number) =>
  Math.round(segundos * fps);

export type ClipeCalculado = Clipe & {
  // Quantos frames o clipe ocupa.
  duracaoFrames: number;
  // Frame de início/fim do trecho dentro do vídeo de origem.
  trimInicio: number;
  trimFim: number;
  // Frames da transição de entrada (0 = corte seco ou primeiro clipe).
  transicaoFrames: number;
};

// Converte segundos -> frames e garante que as transições não fiquem
// maiores que os clipes que elas sobrepõem.
export const calcularClipes = (timeline: Timeline): ClipeCalculado[] => {
  const { fps } = timeline;
  const transicaoPadrao = segParaFrames(timeline.duracaoTransicao, fps);

  const clipes = timeline.clipes.map((clipe, i) => {
    if (clipe.fim <= clipe.inicio) {
      throw new Error(
        `Clipe ${i + 1}: "fim" (${clipe.fim}) precisa ser maior que "inicio" (${clipe.inicio}).`,
      );
    }
    return {
      ...clipe,
      duracaoFrames: segParaFrames(clipe.fim - clipe.inicio, fps),
      trimInicio: segParaFrames(clipe.inicio, fps),
      trimFim: segParaFrames(clipe.fim, fps),
      transicaoFrames: 0,
    };
  });

  return clipes.map((clipe, i) => {
    // O primeiro clipe não tem com quem fazer transição.
    if (i === 0 || clipe.transicao === "corte") {
      return clipe;
    }
    const anterior = clipes[i - 1];
    const limite = Math.min(anterior.duracaoFrames, clipe.duracaoFrames) - 1;
    return {
      ...clipe,
      transicaoFrames: Math.max(0, Math.min(transicaoPadrao, limite)),
    };
  });
};

// Duração total = soma dos clipes - sobreposição das transições.
export const calcularDuracaoTotal = (clipes: ClipeCalculado[]) =>
  clipes.reduce(
    (total, clipe) => total + clipe.duracaoFrames - clipe.transicaoFrames,
    0,
  );

export { segParaFrames };
