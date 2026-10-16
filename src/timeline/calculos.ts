import { Clipe, Timeline } from "./schema";

export const segParaFrames = (segundos: number, fps: number) =>
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

const validarIntervalo = (
  item: string,
  { inicio, fim }: { inicio: number; fim: number },
) => {
  if (fim <= inicio) {
    throw new Error(
      `${item}: "fim" (${fim}) precisa ser maior que "inicio" (${inicio}).`,
    );
  }
};

// Confere todos os intervalos do JSON e mostra um erro claro no primeiro
// que estiver errado.
export const validarTimeline = (timeline: Timeline) => {
  timeline.clipes.forEach((c, i) => validarIntervalo(`Clipe ${i + 1}`, c));
  timeline.inserts.forEach((c, i) => validarIntervalo(`Insert ${i + 1}`, c));
  timeline.audios.forEach((c, i) => validarIntervalo(`Áudio ${i + 1}`, c));
  timeline.zooms.forEach((c, i) => validarIntervalo(`Zoom ${i + 1}`, c));
  timeline.legendas.forEach((c, i) => validarIntervalo(`Legenda ${i + 1}`, c));
};

// Converte segundos -> frames e garante que as transições não fiquem
// maiores que os clipes que elas sobrepõem.
export const calcularClipes = (timeline: Timeline): ClipeCalculado[] => {
  const { fps } = timeline;
  const transicaoPadrao = segParaFrames(timeline.duracaoTransicao, fps);

  const clipes = timeline.clipes.map((clipe) => ({
    ...clipe,
    // Com velocidade, o trecho do arquivo ocupa mais (lento) ou menos
    // (rápido) tempo no vídeo final.
    duracaoFrames: segParaFrames(
      (clipe.fim - clipe.inicio) / (clipe.velocidade ?? 1),
      fps,
    ),
    trimInicio: segParaFrames(clipe.inicio, fps),
    trimFim: segParaFrames(clipe.fim, fps),
    transicaoFrames: 0,
  }));

  return clipes.map((clipe, i) => {
    // O primeiro clipe não tem com quem fazer transição.
    if (i === 0 || clipe.transicao === "corte") {
      return clipe;
    }
    const anterior = clipes[i - 1];
    const limite = Math.min(anterior.duracaoFrames, clipe.duracaoFrames) - 1;
    // A cena pode ter duração de transição própria; senão vale a do projeto.
    const desejada =
      clipe.duracaoTransicao !== undefined
        ? segParaFrames(clipe.duracaoTransicao, fps)
        : transicaoPadrao;
    return {
      ...clipe,
      transicaoFrames: Math.max(0, Math.min(desejada, limite)),
    };
  });
};

// Duração total = soma dos clipes - sobreposição das transições.
export const calcularDuracaoTotal = (clipes: ClipeCalculado[]) =>
  clipes.reduce(
    (total, clipe) => total + clipe.duracaoFrames - clipe.transicaoFrames,
    0,
  );

// Em que frame da timeline FINAL cada clipe começa (já descontando as
// sobreposições das transições).
export const inicioDosClipes = (clipes: ClipeCalculado[]) => {
  const inicios: number[] = [];
  let cursor = 0;
  clipes.forEach((clipe) => {
    cursor -= clipe.transicaoFrames;
    inicios.push(cursor);
    cursor += clipe.duracaoFrames;
  });
  return inicios;
};
