import { calcularClipes, inicioDosClipes } from "./calculos";
import { mudarFormato } from "./formatos";
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
  const novo = { ...itens[indice], ...mudancas };
  // Legenda com texto novo: mantém o tempo de cada palavra.
  itens[indice] = (
    faixa === "legendas" && "texto" in mudancas
      ? comTextoNovo(novo as unknown as Legenda, (novo as Legenda).texto)
      : novo
  ) as ItensPorFaixa[F];
  return { ...t, [faixa]: itens };
};

// Troca o texto de uma legenda que veio da fala. Se o número de palavras
// não mudou, cada palavra nova herda o tempo da antiga (karaokê, pop e
// destaque continuam no ritmo da fala). Se mudou, os tempos saem e a
// animação divide a duração igualmente.
export const comTextoNovo = (legenda: Legenda, texto: string): Legenda => {
  const novas = texto.split(/\s+/).filter(Boolean);
  const antigas = legenda.palavras;
  return {
    ...legenda,
    texto,
    palavras:
      antigas && antigas.length === novas.length
        ? antigas.map((p, i) => ({ ...p, texto: novas[i] }))
        : undefined,
  };
};

const escaparRegex = (texto: string) =>
  texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Troca uma palavra/expressão em TODAS as legendas (ex.: "linda" ->
// "Linnda"). Só palavras inteiras, sem diferenciar maiúsculas. Devolve
// também quantas trocas foram feitas.
export const substituirNasLegendas = (
  t: Timeline,
  procurar: string,
  trocarPor: string,
) => {
  const alvo = procurar.trim();
  if (!alvo) throw new Error("Diga o que procurar.");
  const regex = new RegExp(
    `(?<![\\p{L}\\p{N}])${escaparRegex(alvo)}(?![\\p{L}\\p{N}])`,
    "giu",
  );
  let trocas = 0;
  const legendas = t.legendas.map((l) => {
    const noTexto = l.texto.match(regex)?.length ?? 0;
    // Também conta as palavras animadas: o texto pode já ter sido
    // corrigido à mão e elas ainda estarem com a grafia antiga.
    const nasPalavras = (l.palavras ?? []).filter((p) =>
      p.texto.match(regex),
    ).length;
    if (!noTexto && !nasPalavras) return l;
    trocas += Math.max(noTexto, nasPalavras);
    return comTextoNovo(l, l.texto.replace(regex, trocarPor));
  });
  return { timeline: { ...t, legendas }, trocas };
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
// Muda a proporção do vídeo (os inserts em janela mantêm o formato).
export const definirFormato = (
  t: Timeline,
  largura: number,
  altura: number,
): Timeline => mudarFormato(t, largura, altura);

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
  // segundosNoClipe é tempo do vídeo final; no arquivo, conta a velocidade.
  const ponto =
    Math.round(
      (clipe.inicio + segundosNoClipe * (clipe.velocidade ?? 1)) * 100,
    ) / 100;
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

// Põe um vídeo ou imagem da biblioteca na trilha principal (no fim, ou na
// posição indicada). Se for a primeira cena, ela define o formato do vídeo.
export const colocarCena = (
  t: Timeline,
  video: {
    url: string;
    formato?: "video" | "imagem" | "audio";
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
  // Imagem parada: fica 3s na tela, salvo outra duração pedida.
  if (video.formato === "imagem") {
    return inserirClipe(
      { ...t, ...formato },
      {
        url: video.url,
        tipo: "imagem",
        inicio: 0,
        fim: Math.max(0.1, (opcoes.ate ?? 3) - (opcoes.de ?? 0)),
        transicao: "corte",
        volume: 0,
      },
      opcoes.posicao,
    );
  }
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

// Troca um arquivo por outro em toda a timeline (ex.: versão com efeitos
// de áudio no lugar da original).
export const trocarUrl = (t: Timeline, de: string, para: string): Timeline => {
  const troca = <T extends { url: string }>(itens: T[]) =>
    itens.map((i) => (i.url === de ? { ...i, url: para } : i));
  return {
    ...t,
    clipes: troca(t.clipes),
    inserts: troca(t.inserts),
    audios: troca(t.audios),
  };
};

// ---------- Cortar um trecho do vídeo (puxando o resto) ----------
// Tira o intervalo [de, ate) do vídeo final em TODAS as faixas e puxa tudo
// o que vem depois para trás, fechando o buraco — como o "ripple delete"
// dos editores. Faixas de áudio contínuas (música de fundo) não são
// cortadas no meio: só ficam mais curtas no fim, sem pulo no som.

const r3 = (n: number) => Math.round(n * 1000) / 1000;

// Encaixa um intervalo [inicio, fim) depois do corte. null = some.
const encaixar = (inicio: number, fim: number, de: number, ate: number) => {
  const d = ate - de;
  if (fim <= de) return { inicio, fim, cortadoNoComeco: 0 };
  if (inicio >= ate) {
    return { inicio: inicio - d, fim: fim - d, cortadoNoComeco: 0 };
  }
  if (inicio >= de && fim <= ate) return null;
  return {
    inicio: inicio < de ? inicio : de,
    fim: fim > ate ? fim - d : de,
    // Quanto do começo do item caiu dentro do corte.
    cortadoNoComeco: inicio >= de ? ate - inicio : 0,
  };
};

export const cortarTrecho = (
  t: Timeline,
  de: number,
  ate: number,
  // Arquivos de áudio contínuos (música): só encurtam no fim.
  urlsContinuas: string[] = [],
): Timeline => {
  if (ate - de < 0.02) throw new Error("Trecho curto demais para cortar.");
  const d = ate - de;
  const fps = t.fps;

  // Cenas: cada cena "é dona" do seu tempo, menos a transição de entrada
  // (que pertence à cena anterior). O corte tira o pedaço de cada dona.
  const calculados = calcularClipes(t);
  const inicios = inicioDosClipes(calculados).map((f) => f / fps);
  const clipes: Clipe[] = [];
  t.clipes.forEach((c, i) => {
    const vel = c.velocidade ?? 1;
    const ini = inicios[i];
    const fim = ini + calculados[i].duracaoFrames / fps;
    const dono = i === 0 ? ini : ini + calculados[i].transicaoFrames / fps;
    const a = Math.max(de, dono);
    const b = Math.min(ate, fim);
    if (b <= a + 0.001) {
      clipes.push(c);
      return;
    }
    if (a <= dono + 0.001 && b >= fim - 0.001) return; // cena inteira some
    if (a <= dono + 0.001) {
      // corte no começo da cena (depois da transição de entrada)
      clipes.push({ ...c, inicio: r3(c.inicio + (b - dono) * vel) });
      return;
    }
    if (b >= fim - 0.001) {
      // corte no fim da cena
      clipes.push({ ...c, fim: r3(c.fim - (b - a) * vel) });
      return;
    }
    // corte no meio: a cena vira duas, coladas com corte seco
    clipes.push({ ...c, fim: r3(c.inicio + (a - ini) * vel) });
    clipes.push({
      ...c,
      inicio: r3(c.inicio + (b - ini) * vel),
      transicao: "corte",
      direcao: undefined,
      duracaoTransicao: undefined,
    });
  });

  const audios: AudioFaixa[] = [];
  t.audios.forEach((x) => {
    if (urlsContinuas.includes(x.url) && x.fim > de && x.inicio < ate) {
      // Música: continua igual, sem pulo no som, só termina mais cedo.
      const inicio = Math.min(x.inicio, de);
      const fim = x.fim > ate ? x.fim - d : de;
      if (fim - inicio > 0.05) {
        audios.push({ ...x, inicio: r3(inicio), fim: r3(fim) });
      }
      return;
    }
    if (x.fim <= de) {
      audios.push(x);
      return;
    }
    if (x.inicio >= ate) {
      audios.push({ ...x, inicio: r3(x.inicio - d), fim: r3(x.fim - d) });
      return;
    }
    // O áudio atravessa o corte: a parte de antes fica, a de depois é
    // puxada para o ponto do corte (pulando o trecho cortado do arquivo).
    if (x.inicio < de) {
      audios.push({
        ...x,
        fim: r3(de),
        fadeSaida: Math.min(x.fadeSaida, 0.03),
      });
    }
    if (x.fim > ate) {
      audios.push({
        ...x,
        inicio: r3(de),
        fim: r3(x.fim - d),
        // pula o que já tocou antes do corte e o trecho cortado
        origemInicio: r3(x.origemInicio + (ate - x.inicio)),
        fadeEntrada: x.inicio < de ? 0.02 : x.fadeEntrada,
      });
    }
  });

  const inserts: Insert[] = [];
  for (const x of t.inserts) {
    const e = encaixar(x.inicio, x.fim, de, ate);
    if (!e || e.fim - e.inicio < 0.05) continue;
    inserts.push({
      ...x,
      inicio: r3(e.inicio),
      fim: r3(e.fim),
      origemInicio:
        x.tipo === "video"
          ? r3(x.origemInicio + e.cortadoNoComeco)
          : x.origemInicio,
    });
  }

  const zooms: Zoom[] = [];
  for (const z of t.zooms) {
    const e = encaixar(z.inicio, z.fim, de, ate);
    if (e && e.fim - e.inicio >= 0.1) {
      zooms.push({ ...z, inicio: r3(e.inicio), fim: r3(e.fim) });
    }
  }

  // Legendas: as palavras ditas dentro do corte saem; as de depois andam
  // junto com a fala.
  const legendas: Legenda[] = [];
  for (const l of t.legendas) {
    const e = encaixar(l.inicio, l.fim, de, ate);
    if (!e) continue;
    const atravessa = l.inicio < ate && l.fim > de;
    if (!l.palavras?.length || !atravessa) {
      if (e.fim - e.inicio >= 0.1) {
        legendas.push({ ...l, inicio: r3(e.inicio), fim: r3(e.fim) });
      }
      continue;
    }
    const palavras = l.palavras
      .map((p) => ({
        texto: p.texto,
        de: l.inicio + p.de,
        ate: l.inicio + p.ate,
      }))
      .filter((p) => p.de < de || p.de >= ate)
      .map((p) => (p.de >= ate ? { ...p, de: p.de - d, ate: p.ate - d } : p));
    if (!palavras.length) continue;
    const inicio = Math.min(e.inicio, palavras[0].de);
    legendas.push({
      ...l,
      texto: palavras.map((p) => p.texto).join(" "),
      inicio: r3(inicio),
      fim: r3(Math.max(e.fim, palavras[palavras.length - 1].ate)),
      palavras: palavras.map((p) => ({
        texto: p.texto,
        de: r3(p.de - inicio),
        ate: r3(p.ate - inicio),
      })),
    });
  }

  return { ...t, clipes, audios, inserts, zooms, legendas };
};

// Divide um áudio, insert ou zoom num ponto do vídeo final (o cursor).
export const dividirItemNoTempo = (
  t: Timeline,
  faixa: "audios" | "inserts" | "zooms",
  indice: number,
  tempo: number,
): Timeline => {
  conferirIndice(t, faixa, indice);
  const item = t[faixa][indice];
  if (tempo <= item.inicio + 0.05 || tempo >= item.fim - 0.05) {
    throw new Error("Ponha o cursor dentro do item para dividir.");
  }
  const andou = tempo - item.inicio;
  let primeira: typeof item = { ...item, fim: r3(tempo) };
  let segunda: typeof item = { ...item, inicio: r3(tempo) };
  if (faixa === "audios") {
    const a = item as AudioFaixa;
    primeira = { ...a, fim: r3(tempo), fadeSaida: 0 };
    segunda = {
      ...a,
      inicio: r3(tempo),
      origemInicio: r3(a.origemInicio + andou),
      fadeEntrada: 0,
    };
  } else if (faixa === "inserts" && (item as Insert).tipo === "video") {
    const x = item as Insert;
    segunda = {
      ...x,
      inicio: r3(tempo),
      origemInicio: r3(x.origemInicio + andou),
    };
  }
  const itens = [...t[faixa]] as (typeof item)[];
  itens.splice(indice, 1, primeira, segunda);
  return { ...t, [faixa]: itens };
};

// Música de fundo (sem fala transcrita e longa): num corte não é
// picotada, só termina mais cedo.
export const urlsDeMusica = (
  t: Timeline,
  biblioteca: {
    url: string;
    analise?: { transcricao?: { palavras?: unknown[] } | null } | null;
  }[],
) =>
  t.audios
    .filter((a) => {
      const m = biblioteca.find((x) => x.url === a.url);
      return !m?.analise?.transcricao?.palavras?.length && a.fim - a.inicio > 8;
    })
    .map((a) => a.url);
