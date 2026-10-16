// Corta os respiros longos de uma fala gravada: silêncios maiores que
// "pausaMaxima" entre frases viram uma pausa curta ("pausaNova") e o
// silêncio do começo sai. Nunca corta dentro das palavras: o áudio é
// dividido em trechos (de/ate no ARQUIVO) que são colados em sequência
// (inicio no VÍDEO). "mapear" leva um tempo do arquivo para o vídeo.

export type TrechoDeFala = { de: number; ate: number; inicio: number };

export type FalaCompactada = {
  trechos: TrechoDeFala[];
  mapear: (t: number) => number;
  // Quantos respiros foram encurtados e quantos segundos saíram.
  respiros: number;
  economizado: number;
};

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export const compactarFala = (
  palavras: { de: number; ate: number }[],
  {
    pausaMaxima = 0.7,
    pausaNova = 0.35,
    // Margens em volta das palavras (não cortar o ataque nem o final).
    antes = 0.08,
    depois = 0.15,
  } = {},
): FalaCompactada => {
  if (!palavras.length) {
    return { trechos: [], mapear: (t) => t, respiros: 0, economizado: 0 };
  }
  // Grupos de palavras sem respiro longo entre elas.
  const grupos: { de: number; ate: number }[] = [];
  for (const p of palavras) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && p.de - ultimo.ate <= pausaMaxima) {
      ultimo.ate = Math.max(ultimo.ate, p.ate);
    } else {
      grupos.push({ de: p.de, ate: p.ate });
    }
  }
  // Silêncio entre trechos, já descontadas as margens.
  const intervalo = Math.max(0, pausaNova - antes - depois);
  const trechos: TrechoDeFala[] = [];
  let cursor = 0;
  grupos.forEach((g, i) => {
    const anterior = trechos[i - 1];
    const de = Math.max(0, g.de - antes, anterior ? anterior.ate : 0);
    const proximo = grupos[i + 1];
    const ate = proximo
      ? Math.min(g.ate + depois, proximo.de - antes)
      : g.ate + depois;
    if (i > 0) cursor += intervalo;
    trechos.push({ de: r3(de), ate: r3(ate), inicio: r3(cursor) });
    cursor += ate - de;
  });

  const mapear = (t: number) => {
    for (let i = 0; i < trechos.length; i++) {
      const tr = trechos[i];
      if (t < tr.de) {
        // No silêncio cortado antes deste trecho: cola no começo dele.
        return tr.inicio;
      }
      if (t <= tr.ate) return tr.inicio + (t - tr.de);
    }
    const ultimo = trechos[trechos.length - 1];
    return ultimo.inicio + (ultimo.ate - ultimo.de) + (t - ultimo.ate);
  };

  const original = palavras[palavras.length - 1].ate;
  const novo = mapear(original);
  return {
    trechos,
    mapear,
    respiros: grupos.length - 1 + (grupos[0].de - antes > 0.05 ? 1 : 0),
    economizado: Math.max(0, r3(original - novo)),
  };
};
