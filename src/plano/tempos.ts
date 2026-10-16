import { buscarFala, PalavraFinal } from "@/ia/conteudo";
import { Midia } from "@/projeto/tipos";
import { cenasDaFala } from "./alinhamento";
import { compactarFala } from "./respiros";
import { CenaPlano } from "./tipos";

// Tempos das cenas a partir da NARRAÇÃO gravada: cada cena começa quando a
// sua fala é dita. Usado para conferir a narração e ajustar as durações
// ANTES de gerar os takes (verificarNarracao) e na montagem.

// Respiro depois da última palavra, antes de o vídeo acabar.
export const SOBRA_NO_FIM = 0.5;

export const palavrasDaNarracao = (narracao: Midia | null): PalavraFinal[] =>
  (narracao?.analise?.transcricao?.palavras ?? []).map((p) => ({
    de: p.de,
    ate: p.ate,
    palavra: p.palavra,
    fonte: "narração",
  }));

// Narração SEM os respiros longos: os trechos de áudio que entram no vídeo
// e o tempo de cada palavra já no vídeo final.
export const narracaoSemRespiros = (narracao: Midia | null) => {
  const brutas = palavrasDaNarracao(narracao);
  const fala = compactarFala(brutas);
  return {
    fala,
    palavras: brutas.map((p) => ({
      ...p,
      de: Math.round(fala.mapear(p.de) * 100) / 100,
      ate: Math.round(fala.mapear(p.ate) * 100) / 100,
    })),
  };
};

// Momento em que uma frase é dita, a partir de "desde".
export const momentoDaFrase = (
  palavras: PalavraFinal[],
  frase: string,
  desde = 0,
): number | null => {
  if (!frase.trim() || !palavras.length) return null;
  const achados = buscarFala(
    palavras.filter((p) => p.de >= desde - 0.05),
    frase,
  );
  if (!achados.length) return null;
  const melhor = Math.max(...achados.map((a) => a.semelhanca));
  return Math.min(
    ...achados.filter((a) => a.semelhanca === melhor).map((a) => a.de),
  );
};

export type TemposDasCenas = {
  // Início de cada cena (s) e o fim do vídeo.
  inicios: number[];
  fimTotal: number;
  // Cenas cuja fala não foi achada na narração (tempo dividido pela
  // duração prevista).
  naoAchadas: number[];
};

export const temposDasCenas = (
  cenas: CenaPlano[],
  palavras: PalavraFinal[],
): TemposDasCenas => {
  const inicios: (number | null)[] = cenas.map(() => null);
  const naoAchadas: number[] = [];
  if (!palavras.length) {
    let acumulado = 0;
    const lista = cenas.map((c) => {
      const de = acumulado;
      acumulado += Math.max(0.5, c.duracao_s);
      return de;
    });
    return { inicios: lista, fimTotal: acumulado, naoAchadas };
  }

  // Alinha o roteiro com o que foi gravado, palavra a palavra: cada cena
  // começa na primeira palavra dita que pertence a ela (inclusive
  // improvisos, que entram na cena em que foram ditos).
  const cenaDe = cenasDaFala(
    cenas.map((c) => c.fala),
    palavras.map((p) => p.palavra),
  );
  cenaDe.forEach((c, i) => {
    if (inicios[c] === null) inicios[c] = palavras[i].de;
  });
  inicios[0] = 0;
  const fimTotal = Math.max(
    palavras[palavras.length - 1].ate + SOBRA_NO_FIM,
    1,
  );
  // Cenas sem frase achada: dividem o espaço entre as vizinhas conforme a
  // duração prevista no plano.
  for (let i = 0; i < cenas.length; i++) {
    if (inicios[i] !== null) continue;
    let j = i;
    while (j < cenas.length && inicios[j] === null) j++;
    const de = inicios[i - 1] ?? 0;
    const ate = j < cenas.length ? inicios[j]! : fimTotal;
    const pesos = cenas.slice(i - 1, j).map((c) => Math.max(0.5, c.duracao_s));
    const soma = pesos.reduce((a, b) => a + b, 0);
    let acumulado = de;
    for (let k = i; k < j; k++) {
      acumulado += ((ate - de) * pesos[k - i]) / soma;
      inicios[k] = acumulado;
      naoAchadas.push(cenas[k].numero);
    }
    i = j - 1;
  }
  return { inicios: inicios as number[], fimTotal, naoAchadas };
};
