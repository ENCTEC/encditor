import { calcularClipes, inicioDosClipes } from "./calculos";
import { mudarFormato } from "./formatos";
import {
  AudioFaixa,
  Clipe,
  Efeito,
  Insert,
  Legenda,
  Motion,
  Timeline,
  Zoom,
} from "./schema";

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
  motions: Motion;
  efeitos: Efeito;
};

export type Faixa = keyof ItensPorFaixa;

export const FAIXAS: Faixa[] = [
  "clipes",
  "inserts",
  "audios",
  "zooms",
  "legendas",
  "motions",
  "efeitos",
];

// Efeitos sonoros da biblioteca do encEditor (public/sons): curtos e
// repetidos à vontade — não contam como "o mesmo áudio tocando duas vezes".
export const ehEfeitoSonoro = (url: string) => url.startsWith("/sons/");

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
  motions: [],
  efeitos: [],
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
  const encaixarTodos = <T extends { inicio: number; fim: number }>(
    itens: T[],
  ) =>
    itens.flatMap((x) => {
      const e = encaixar(x.inicio, x.fim, de, ate);
      return e && e.fim - e.inicio >= 0.1
        ? [{ ...x, inicio: r3(e.inicio), fim: r3(e.fim) }]
        : [];
    });
  const motions = encaixarTodos(t.motions ?? []);
  const efeitos = encaixarTodos(t.efeitos ?? []);

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

  return { ...t, clipes, audios, inserts, zooms, legendas, motions, efeitos };
};

// Divide um áudio, insert, zoom, motion ou efeito num ponto do vídeo final
// (o cursor).
export const dividirItemNoTempo = (
  t: Timeline,
  faixa: "audios" | "inserts" | "zooms" | "motions" | "efeitos",
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

// ---------- Ferramentas padrão de edição (Timeline e chat) ----------

// Itens com "ponto do arquivo" (origemInicio): mexer no começo deles
// precisa andar no arquivo junto, senão o conteúdo escorrega.
const temOrigem = (faixa: Faixa, item: { tipo?: string }) =>
  faixa === "audios" || (faixa === "inserts" && item.tipo === "video");

// Apara uma ponta de um áudio, insert, zoom, legenda, motion ou efeito até
// um tempo do vídeo final, mantendo o conteúdo no lugar (áudio não
// "escorrega").
export const apararItem = (
  t: Timeline,
  faixa: Exclude<Faixa, "clipes">,
  indice: number,
  ponta: "inicio" | "fim",
  tempo: number,
): Timeline => {
  conferirIndice(t, faixa, indice);
  const item = t[faixa][indice] as { inicio: number; fim: number };
  const novo = r3(Math.max(0, tempo));
  if (
    ponta === "inicio" ? novo >= item.fim - 0.05 : novo <= item.inicio + 0.05
  ) {
    throw new Error("Esse corte deixaria o item sem duração.");
  }
  if (ponta === "fim") {
    const leg = faixa === "legendas" ? (item as Legenda) : null;
    if (leg?.palavras?.length) {
      const dur = novo - leg.inicio;
      const palavras = leg.palavras
        .filter((p) => p.de < dur - 0.05)
        .map((p) => ({ ...p, ate: Math.min(p.ate, r3(dur)) }));
      return atualizarItem(t, "legendas", indice, {
        fim: novo,
        palavras,
        texto: palavras.map((p) => p.texto).join(" ") || leg.texto,
      });
    }
    return atualizarItem(t, faixa, indice, { fim: novo } as never);
  }
  const andou = novo - item.inicio;
  const mudancas: Record<string, unknown> = { inicio: novo };
  if (temOrigem(faixa, item as { tipo?: string })) {
    const origem = (item as AudioFaixa).origemInicio + andou;
    if (origem < -0.001) {
      throw new Error("O arquivo não tem nada antes desse ponto.");
    }
    mudancas.origemInicio = r3(Math.max(0, origem));
  }
  if (faixa === "legendas" && (item as Legenda).palavras?.length) {
    // As palavras continuam no mesmo momento do vídeo.
    mudancas.palavras = (item as Legenda)
      .palavras!.map((p) => ({
        ...p,
        de: r3(p.de - andou),
        ate: r3(p.ate - andou),
      }))
      .filter((p) => p.ate > 0)
      .map((p) => ({ ...p, de: Math.max(0, p.de) }));
    // O texto perde as palavras que ficaram de fora.
    mudancas.texto = (mudancas.palavras as { texto: string }[])
      .map((p) => p.texto)
      .join(" ");
  }
  return atualizarItem(t, faixa, indice, mudancas as never);
};

// Junta o item com o próximo pedaço do MESMO arquivo, colado nele (o
// contrário de dividir). Cenas: a cena seguinte, se continua o mesmo
// trecho do arquivo. Áudios/inserts: o pedaço que começa onde este termina.
export const juntarItens = (
  t: Timeline,
  faixa: Faixa,
  indice: number,
): Timeline => {
  conferirIndice(t, faixa, indice);
  if (faixa === "clipes") {
    const a = t.clipes[indice];
    const b = t.clipes[indice + 1];
    if (
      !b ||
      b.url !== a.url ||
      Math.abs(b.inicio - a.fim) > 0.05 ||
      (b.velocidade ?? 1) !== (a.velocidade ?? 1)
    ) {
      throw new Error(
        "Só dá para juntar com a próxima cena se ela continua o mesmo trecho do mesmo arquivo (como depois de dividir).",
      );
    }
    const clipes = [...t.clipes];
    clipes.splice(indice, 2, { ...a, fim: b.fim });
    return { ...t, clipes };
  }
  if (
    faixa === "zooms" ||
    faixa === "legendas" ||
    faixa === "motions" ||
    faixa === "efeitos"
  ) {
    const lista = t[faixa] as (Zoom | Legenda | Motion | Efeito)[];
    const atual = lista[indice];
    const j = lista.findIndex(
      (x, k) => k !== indice && Math.abs(x.inicio - atual.fim) <= 0.05,
    );
    if (j < 0) throw new Error("Não há um item colado logo depois deste.");
    const prox = lista[j];
    let junto: Zoom | Legenda | Motion | Efeito = { ...atual, fim: prox.fim };
    if (faixa === "legendas") {
      const la = atual as Legenda;
      const lb = prox as Legenda;
      const desloc = lb.inicio - la.inicio;
      junto = {
        ...la,
        fim: lb.fim,
        texto: `${la.texto} ${lb.texto}`.trim(),
        palavras:
          la.palavras && lb.palavras
            ? [
                ...la.palavras,
                ...lb.palavras.map((p) => ({
                  ...p,
                  de: r3(p.de + desloc),
                  ate: r3(p.ate + desloc),
                })),
              ]
            : undefined,
      };
    }
    const itens = lista
      .filter((_, k) => k !== j)
      .map((x) => (x === atual ? junto : x));
    return { ...t, [faixa]: itens };
  }
  const lista = t[faixa] as (AudioFaixa | Insert)[];
  const atual = lista[indice];
  const j = lista.findIndex(
    (x, k) =>
      k !== indice &&
      x.url === atual.url &&
      Math.abs(x.inicio - atual.fim) <= 0.05 &&
      Math.abs(
        x.origemInicio - (atual.origemInicio + (atual.fim - atual.inicio)),
      ) <= 0.1,
  );
  if (j < 0) {
    throw new Error(
      "Não há um pedaço do mesmo arquivo colado logo depois e continuando do mesmo ponto (como depois de dividir).",
    );
  }
  const prox = lista[j];
  const junto =
    faixa === "audios"
      ? {
          ...(atual as AudioFaixa),
          fim: prox.fim,
          fadeSaida: (prox as AudioFaixa).fadeSaida,
        }
      : { ...atual, fim: prox.fim };
  const itens = lista
    .filter((_, k) => k !== j)
    .map((x) => (x === atual ? junto : x));
  return { ...t, [faixa]: itens };
};

// Duplica o item: cena logo depois dela; os outros, colados no fim dele.
export const duplicarItem = (
  t: Timeline,
  faixa: Faixa,
  indice: number,
): Timeline => {
  conferirIndice(t, faixa, indice);
  if (faixa === "clipes") {
    const c = t.clipes[indice];
    const clipes = [...t.clipes];
    clipes.splice(indice + 1, 0, {
      ...c,
      transicao: "corte",
      direcao: undefined,
      duracaoTransicao: undefined,
    });
    return { ...t, clipes };
  }
  const item = t[faixa][indice] as { inicio: number; fim: number };
  const d = item.fim - item.inicio;
  const copia = { ...item, inicio: r3(item.fim), fim: r3(item.fim + d) };
  const itens = [...t[faixa]];
  itens.splice(indice + 1, 0, copia as never);
  return { ...t, [faixa]: itens };
};

// Pedaços do MESMO arquivo de áudio tocando ao mesmo tempo quase sempre
// são erro de corte (a fala se repete por cima). Devolve a descrição do
// primeiro problema, ou null.
export const sobreposicaoDeAudio = (t: Timeline): string | null => {
  for (let i = 0; i < t.audios.length; i++) {
    for (let j = i + 1; j < t.audios.length; j++) {
      const a = t.audios[i];
      const b = t.audios[j];
      if (a.url !== b.url || ehEfeitoSonoro(a.url)) continue;
      const sobra = Math.min(a.fim, b.fim) - Math.max(a.inicio, b.inicio);
      if (sobra > 0.05) {
        return `os áudios ${i + 1} e ${j + 1} são do mesmo arquivo e tocam juntos por ${sobra.toFixed(2)}s (${Math.max(a.inicio, b.inicio).toFixed(2)}s–${Math.min(a.fim, b.fim).toFixed(2)}s)`;
      }
    }
  }
  return null;
};
