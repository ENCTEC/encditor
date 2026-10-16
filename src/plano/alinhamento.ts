// Alinha o ROTEIRO (o que era para falar) com a TRANSCRIÇÃO da narração
// gravada, palavra por palavra (programação dinâmica, como um "diff"
// tolerante). Serve para:
// - achar onde cada cena começa mesmo quando a pessoa improvisa, troca ou
//   pula palavras (as palavras a mais ficam na cena em que foram ditas);
// - corrigir nomes que a transcrição erra (marcas: "vela" → Wella, "trans"
//   → Truss, "em vigo" → Invigo, "Linda" → Linnda) usando a grafia do
//   roteiro — nas legendas e na conferência.

const UNIDADES = [
  "zero",
  "um",
  "dois",
  "tres",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
  "dez",
  "onze",
  "doze",
  "treze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
];
const DEZENAS = [
  "",
  "",
  "vinte",
  "trinta",
  "quarenta",
  "cinquenta",
  "sessenta",
  "setenta",
  "oitenta",
  "noventa",
];
const CENTENAS = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
];

// "125" → ["cento", "e", "vinte", "e", "cinco"] (até 999; maiores ficam).
const numeroPorExtenso = (n: number): string[] => {
  if (n < 20) return [UNIDADES[n]];
  if (n < 100) {
    const d = DEZENAS[Math.floor(n / 10)];
    return n % 10 ? [d, "e", UNIDADES[n % 10]] : [d];
  }
  if (n === 100) return ["cem"];
  if (n < 1000) {
    const resto = n % 100;
    const c = CENTENAS[Math.floor(n / 100)];
    return resto ? [c, "e", ...numeroPorExtenso(resto)] : [c];
  }
  return [String(n)];
};

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export type Ficha = {
  // Forma comparável (minúsculas, sem acento/pontuação; números por extenso).
  t: string;
  // Palavra de origem (índice na lista original de palavras).
  origem: number;
  // Nome próprio no roteiro (marca, lugar): a grafia do roteiro vale mais
  // que a transcrição.
  propria: boolean;
};

// Quebra palavras em fichas comparáveis.
// Formas faladas que valem como a mesma palavra.
const FALADO: Record<string, string> = {
  pra: "para",
  pro: "para",
  ta: "esta",
  tava: "estava",
  ce: "voce",
  ces: "voces",
  ne: "nao",
};

const inicioDeFrase = (palavras: string[], i: number) =>
  i === 0 || /[.!?…]["”')]?$/.test(palavras[i - 1]);

export const fichas = (palavras: string[], detectarProprias = false) => {
  const lista: Ficha[] = [];
  // Nomes: palavras com maiúscula no meio de uma frase (em qualquer ponto
  // do texto valem também no começo de outra frase).
  const nomes = new Set(
    palavras
      .filter((p, i) => /[A-ZÀ-Ý]/.test(p) && !inicioDeFrase(palavras, i))
      .map((p) => sem(p).replace(/[^a-z0-9]+/g, "")),
  );
  palavras.forEach((bruta, origem) => {
    const propria =
      detectarProprias &&
      /[A-ZÀ-Ý]/.test(bruta) &&
      (!inicioDeFrase(palavras, origem) ||
        /[A-ZÀ-Ý].*[A-ZÀ-Ý]/.test(bruta) ||
        nomes.has(sem(bruta).replace(/[^a-z0-9]+/g, "")));
    const limpo = sem(bruta)
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    for (const parte of limpo.split(/\s+/).filter(Boolean)) {
      if (/^\d+$/.test(parte)) {
        for (const p of numeroPorExtenso(Number(parte))) {
          lista.push({ t: p, origem, propria: false });
        }
      } else {
        lista.push({ t: FALADO[parte] ?? parte, origem, propria });
      }
    }
  });
  return lista;
};

// Parecido (0 a 1) pela distância de edição.
export const parecido = (a: string, b: string) => {
  if (a === b) return 1;
  const m = a.length;
  const n = b.length;
  if (!m || !n) return 0;
  let antes = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const agora = [i];
    for (let j = 1; j <= n; j++) {
      agora[j] = Math.min(
        antes[j] + 1,
        agora[j - 1] + 1,
        antes[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    antes = agora;
  }
  return 1 - antes[n] / Math.max(m, n);
};

// Pontuação de juntar a ficha do roteiro com a(s) da fala.
const pontos = (roteiro: Ficha, fala: string) => {
  const s = parecido(roteiro.t, fala);
  if (s >= 0.8) return 2;
  if (roteiro.propria && s >= 0.5) return 1.5; // nome dito/transcrito torto
  return -0.6; // palavra trocada (vale juntar se o resto bate)
};
const PULO = -0.7;

export type Par = {
  // Índice da ficha do roteiro (null = palavra a mais, improvisada).
  roteiro: number | null;
  // Fichas da fala (1, ou 2 juntas como "em vigo" = "invigo").
  fala: number[];
  // Bateu (igual/quase igual ou nome próprio reconhecido)?
  bateu: boolean;
};

// Alinhamento ótimo (máxima pontuação). Devolve, em ordem, os pares.
export const alinhar = (roteiro: Ficha[], fala: Ficha[]): Par[] => {
  const R = roteiro.length;
  const F = fala.length;
  // melhor[i][j] = pontuação alinhando roteiro[0..i) com fala[0..j)
  const melhor = Array.from({ length: R + 1 }, () => new Float64Array(F + 1));
  const passo = Array.from({ length: R + 1 }, () => new Uint8Array(F + 1));
  for (let i = 1; i <= R; i++) {
    melhor[i][0] = i * PULO;
    passo[i][0] = 2;
  }
  for (let j = 1; j <= F; j++) {
    melhor[0][j] = j * PULO;
    passo[0][j] = 3;
  }
  for (let i = 1; i <= R; i++) {
    for (let j = 1; j <= F; j++) {
      // 1 = junta, 2 = pula roteiro, 3 = pula fala, 4 = junta 2 da fala
      let v = melhor[i - 1][j - 1] + pontos(roteiro[i - 1], fala[j - 1].t);
      let p = 1;
      const pr = melhor[i - 1][j] + PULO;
      if (pr > v) {
        v = pr;
        p = 2;
      }
      const pf = melhor[i][j - 1] + PULO;
      if (pf > v) {
        v = pf;
        p = 3;
      }
      if (j >= 2) {
        const junto = fala[j - 2].t + fala[j - 1].t;
        const s = parecido(roteiro[i - 1].t, junto);
        // Só junta se nenhuma das duas sozinha já bate ("cabelo" + "e"
        // não é "cabelo").
        const sozinha = Math.max(
          parecido(roteiro[i - 1].t, fala[j - 1].t),
          parecido(roteiro[i - 1].t, fala[j - 2].t),
        );
        if (s >= 0.75 && s > sozinha + 0.1 && sozinha < 0.8) {
          const pj = melhor[i - 1][j - 2] + 2.2;
          if (pj > v) {
            v = pj;
            p = 4;
          }
        }
      }
      melhor[i][j] = v;
      passo[i][j] = p;
    }
  }
  const pares: Par[] = [];
  let i = R;
  let j = F;
  while (i > 0 || j > 0) {
    const p = passo[i][j];
    if (p === 1) {
      pares.push({
        roteiro: i - 1,
        fala: [j - 1],
        bateu: pontos(roteiro[i - 1], fala[j - 1].t) > 0,
      });
      i--;
      j--;
    } else if (p === 4) {
      pares.push({ roteiro: i - 1, fala: [j - 2, j - 1], bateu: true });
      i--;
      j -= 2;
    } else if (p === 2) {
      i--; // palavra do roteiro não foi dita
    } else {
      pares.push({ roteiro: null, fala: [j - 1], bateu: false });
      j--;
    }
  }
  return pares.reverse();
};

// Corrige as palavras transcritas com os nomes próprios do roteiro
// (mantendo a pontuação da transcrição). Duas palavras transcritas que
// eram um nome só ("em vigo") viram uma (a segunda fica vazia).
export const corrigirComRoteiro = (
  palavrasRoteiro: string[],
  palavrasFala: string[],
): string[] => {
  const r = fichas(palavrasRoteiro, true);
  const f = fichas(palavrasFala);
  const corrigidas = [...palavrasFala];
  // "vela" reconhecida como Wella num lugar vale para o texto todo.
  const aprendidas = new Map<string, string>();
  const tocadas = new Set<number>();
  for (const par of alinhar(r, f)) {
    if (par.roteiro === null || !par.bateu) continue;
    const ficha = r[par.roteiro];
    if (!ficha.propria) continue;
    const certa = palavrasRoteiro[ficha.origem]
      .replace(/[^\p{L}\p{N}'’&-]+$/u, "")
      .replace(/^[^\p{L}\p{N}]+/u, "");
    const indices = [...new Set(par.fala.map((k) => f[k].origem))];
    const primeira = indices[0];
    const pontuacao = (palavrasFala[indices[indices.length - 1]].match(
      /[^\p{L}\p{N}]+$/u,
    ) ?? [""])[0];
    corrigidas[primeira] = certa + pontuacao;
    for (const k of indices.slice(1)) corrigidas[k] = "";
    indices.forEach((k) => tocadas.add(k));
    if (par.fala.length === 1 && f[par.fala[0]].t !== ficha.t) {
      aprendidas.set(f[par.fala[0]].t, certa);
    }
  }
  if (aprendidas.size) {
    palavrasFala.forEach((bruta, i) => {
      if (tocadas.has(i)) return;
      const forma = sem(bruta).replace(/[^a-z0-9]+/g, "");
      const certa = aprendidas.get(forma);
      if (certa) {
        corrigidas[i] = certa + (bruta.match(/[^\p{L}\p{N}]+$/u) ?? [""])[0];
      }
    });
  }
  return corrigidas;
};

// Cena (0, 1, 2…) de cada palavra GRAVADA. As que batem com o roteiro
// ficam na cena delas; as improvisadas entre duas cenas vão para a
// próxima se vierem depois de um ponto final (nova frase), senão ficam
// na anterior.
export const cenasDaFala = (
  falasDoRoteiro: string[],
  palavrasFala: string[],
): number[] => {
  const porCena = falasDoRoteiro.map((f) => f.split(/\s+/).filter(Boolean));
  const roteiro = porCena.flat();
  const cenaDaPalavra = porCena.flatMap((f, c) => f.map(() => c));
  const r = fichas(roteiro, true);
  const f = fichas(palavrasFala);
  const cena: (number | null)[] = palavrasFala.map(() => null);
  for (const par of alinhar(r, f)) {
    if (par.roteiro === null || !par.bateu) continue;
    const c = cenaDaPalavra[r[par.roteiro].origem];
    for (const k of par.fala) {
      const o = f[k].origem;
      cena[o] = Math.max(cena[o] ?? 0, c);
    }
  }
  // Mantém a ordem (nunca volta para uma cena anterior).
  let maior = 0;
  for (let i = 0; i < cena.length; i++) {
    if (cena[i] !== null) {
      cena[i] = Math.max(cena[i]!, maior);
      maior = cena[i]!;
    }
  }
  // Palavras sem par: decide pela frase.
  const final: number[] = [];
  for (let i = 0; i < palavrasFala.length; i++) {
    if (cena[i] !== null) {
      final.push(cena[i]!);
      continue;
    }
    const anterior = i > 0 ? final[i - 1] : 0;
    let j = i;
    while (j < palavrasFala.length && cena[j] === null) j++;
    const proxima = j < palavrasFala.length ? cena[j]! : anterior;
    // Onde começa a última frase dentro do trecho sem par.
    let corte = i;
    for (let k = i; k < j; k++) if (inicioDeFrase(palavrasFala, k)) corte = k;
    if (!inicioDeFrase(palavrasFala, corte)) corte = j;
    for (let k = i; k < j; k++) final.push(k >= corte ? proxima : anterior);
    i = j - 1;
  }
  return final;
};
