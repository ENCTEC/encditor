import { alinhar, fichas } from "@/plano/alinhamento";
import {
  caixaDoCelular,
  caixaDoLayout,
  caixaParaPosicao,
  Caixa,
  LAYOUTS,
  POSICOES,
  Tamanho,
} from "@/timeline/caixas";
import {
  adicionarSom,
  momentoDoSomDoMotion,
  somDoMotion,
  temSomPerto,
} from "@/timeline/efeitosSonoros";
import { adicionarItem, ehEfeitoSonoro } from "@/timeline/operacoes";
import { palavrasDoTexto } from "@/timeline/palavras";
import { Insert, ModeloMotion, Motion, Timeline } from "@/timeline/schema";
import { PalavraFinal, tokensDaFala } from "./conteudo";

// "Encenar a fala": monta um vídeo de motion design FALADO a partir da
// narração transcrita. A fala é dividida em TELAS; cada item de uma tela
// (motion ou imagem/vídeo da biblioteca) entra no instante em que o seu
// trecho é dito e fica até a próxima tela começar. "fala" e "digitando"
// ganham o tempo de cada palavra (motion.palavras).

const r2 = (n: number) => Math.round(n * 100) / 100;

// A animação entra um tiquinho antes da palavra (o olho percebe antes do
// ouvido; assim parece "junto").
const ANTECIPA = 0.06;
// Espaço entre o fim de uma tela e o começo da próxima.
const RESPIRO = 0.04;

// Formas faladas que valem como a mesma palavra ("pra" = "para").
const FALADO: Record<string, string> = {
  pra: "para",
  pro: "para",
  ta: "esta",
  tava: "estava",
  ce: "voce",
  ne: "nao",
};
const tokens = (texto: string) =>
  tokensDaFala(texto).map((t) => FALADO[t] ?? t);

// Onde um trecho é dito, a partir do segundo "desde". Primeiro a frase
// exata; senão a janela com mais palavras em comum (≥ 60%).
export const acharFalaDepois = (
  faladas: PalavraFinal[],
  trecho: string,
  desde: number,
) => {
  const alvo = tokens(trecho);
  if (!alvo.length) return null;
  const ditos = faladas.map((p) => tokens(p.palavra).join(" "));
  const primeiro = faladas.findIndex((p) => p.de >= desde - 0.05);
  if (primeiro < 0) return null;
  const n = alvo.length;
  for (let i = primeiro; i + n <= ditos.length; i++) {
    if (alvo.every((tk, j) => ditos[i + j] === tk)) {
      return { de: faladas[i].de, ate: faladas[i + n - 1].ate, exato: true };
    }
  }
  const conjunto = new Set(alvo);
  let melhor: { i: number; nota: number } | null = null;
  for (let i = primeiro; i + n <= ditos.length; i++) {
    const comuns = ditos.slice(i, i + n).filter((d) => conjunto.has(d)).length;
    // Desempate: a janela que começa pela 1ª palavra do trecho.
    const nota = comuns / n + (ditos[i] === alvo[0] ? 0.01 : 0);
    if (nota >= 0.6 && (!melhor || nota > melhor.nota)) melhor = { i, nota };
  }
  return melhor
    ? {
        de: faladas[melhor.i].de,
        ate: faladas[melhor.i + n - 1].ate,
        exato: false,
      }
    : null;
};

// Tempo em que cada palavra do texto de um motion é dita, contado do
// início do motion (na ordem de palavrasDoTexto). Alinha o texto com a fala
// a partir do início (tolera palavras trocadas, puladas ou a mais); as que
// não batem ficam entre as vizinhas. undefined = o texto não é a fala.
export const tempoDasPalavras = (
  texto: string,
  faladas: PalavraFinal[],
  inicio: number,
): Motion["palavras"] => {
  const doTexto = palavrasDoTexto(texto);
  const n = doTexto.length;
  const desde = faladas.findIndex((p) => p.de >= inicio - 0.35);
  if (!n || desde < 0) return undefined;
  const janela = faladas.slice(desde, desde + n * 2 + 4);
  const roteiro = fichas(doTexto);
  const fala = fichas(janela.map((p) => p.palavra));
  const de: (number | null)[] = doTexto.map(() => null);
  const ate: number[] = doTexto.map(() => 0);
  for (const par of alinhar(roteiro, fala)) {
    if (par.roteiro === null || !par.bateu) continue;
    const i = roteiro[par.roteiro].origem;
    const primeira = janela[fala[par.fala[0]].origem];
    const ultima = janela[fala[par.fala[par.fala.length - 1]].origem];
    if (de[i] === null) de[i] = primeira.de;
    ate[i] = Math.max(ate[i], ultima.ate);
  }
  if (de.filter((x) => x !== null).length < Math.max(1, Math.ceil(n / 2))) {
    return undefined;
  }
  const achado = de.map((x) => x !== null);
  for (let i = 0; i < n; i++) {
    if (achado[i]) continue;
    let a = i - 1;
    while (a >= 0 && !achado[a]) a--;
    let b = i + 1;
    while (b < n && !achado[b]) b++;
    de[i] =
      a >= 0 && b < n
        ? de[a]! + ((de[b]! - de[a]!) * (i - a)) / (b - a)
        : a >= 0
          ? de[a]! + (i - a) * 0.22
          : de[b]! - (b - i) * 0.22;
    ate[i] = de[i]! + 0.2;
  }
  for (let i = 1; i < n; i++) de[i] = Math.max(de[i]!, de[i - 1]!);
  return doTexto.map((t, i) => ({
    texto: t,
    de: r2(Math.max(0, de[i]! - inicio)),
    ate: r2(Math.max(0, ate[i] - inicio)),
  }));
};

export type MidiaDoItem = {
  url: string;
  nome: string;
  formato: "video" | "imagem";
  largura: number | null;
  altura: number | null;
  duracao: number | null;
};

export type ItemDaTela = {
  quando: string;
  modelo: ModeloMotion | null;
  texto: string | null;
  detalhe: string | null;
  posicao: "topo" | "centro" | "base" | null;
  x: number | null;
  y: number | null;
  x2: number | null;
  y2: number | null;
  cor: string | null;
  midia: MidiaDoItem | null;
  moldura: "celular" | "janela" | "polaroid" | "tela-cheia" | null;
  lugar: string | null;
  tamanho: Tamanho | null;
  ate_dizer: string | null;
  fica_ate_tela: number | null;
  com_som: boolean;
};

const caixaDoItem = (item: ItemDaTela, t: Timeline): Caixa => {
  const proporcaoVideo = t.largura / t.altura;
  if (item.moldura === "celular") return caixaDoCelular(proporcaoVideo, item.lugar);
  if (item.moldura === "tela-cheia") return caixaDoLayout("tela-cheia");
  const midia = item.midia!;
  const lugar =
    item.lugar &&
    ([...LAYOUTS, ...POSICOES] as readonly string[]).includes(item.lugar)
      ? (item.lugar as Parameters<typeof caixaParaPosicao>[0])
      : "centro";
  return caixaParaPosicao(
    lugar,
    item.tamanho ?? "G",
    midia.largura && midia.altura ? midia.largura / midia.altura : 16 / 9,
    proporcaoVideo,
  );
};

// Grafismos que ficam no meio da tela: com um deles na tela, o texto
// falado sobe para o topo (senão um fica em cima do outro).
const MEIO: ModeloMotion[] = [
  "barra",
  "comentario",
  "microfone",
  "anel",
  "curtida",
  "preco",
  "contador",
  "frase",
  "lista",
  "titulo",
];
const ocupaOMeio = (item: ItemDaTela) =>
  !!item.midia ||
  (item.modelo !== null &&
    MEIO.includes(item.modelo) &&
    (item.posicao === null || item.posicao === "centro") &&
    (item.y === null || (item.y > 28 && item.y < 78)));

// Motions que ficam no topo (sem x/y): etiqueta, selo ✓ e cartão digitando.
const ficaNoTopo = (m: Motion) =>
  m.x === undefined &&
  m.y === undefined &&
  (m.posicao ?? "topo") === "topo" &&
  (m.modelo === "etiqueta" ||
    m.modelo === "confirmado" ||
    m.modelo === "digitando");

// O texto falado no topo não pode ficar por cima de uma etiqueta, selo ou
// cartão que está no topo ao mesmo tempo (ex.: a etiqueta que continua de
// uma tela para a outra): ele desce para a base. Só mexe nos "novos".
export const desencontrarDoTopo = (todos: Motion[], novos: Set<Motion>) =>
  todos.map((m) =>
    novos.has(m) &&
    m.modelo === "fala" &&
    m.posicao === "topo" &&
    todos.some(
      (o) => o !== m && ficaNoTopo(o) && o.inicio < m.fim && o.fim > m.inicio,
    )
      ? { ...m, posicao: "base" as const }
      : m,
  );

const acabamentoDoItem = (item: ItemDaTela): Insert["acabamento"] =>
  item.moldura === "celular"
    ? { borda: false, cantos: false, sombra: false, celular: true }
    : item.moldura === "polaroid"
      ? { borda: false, cantos: false, sombra: true, polaroid: true }
      : { borda: true, cantos: true, sombra: true };

export const encenar = (
  t: Timeline,
  telas: { itens: ItemDaTela[] }[],
  faladas: PalavraFinal[],
  opcoes: { substituir: boolean; fimDoVideo: number },
) => {
  if (!telas.length || telas.some((x) => !x.itens.length)) {
    throw new Error("Toda tela precisa de pelo menos um item.");
  }
  // 1) Quando cada item entra (e onde cada tela começa).
  const problemas: string[] = [];
  const aproximados: string[] = [];
  const inicios: number[][] = [];
  const inicioDaTela: number[] = [];
  telas.forEach((tela, k) => {
    const desde = k === 0 ? 0 : inicioDaTela[k - 1] + 0.01;
    inicios.push(
      tela.itens.map((item) => {
        const achado = acharFalaDepois(faladas, item.quando, desde);
        if (!achado) {
          problemas.push(`tela ${k + 1}: não achei "${item.quando}" na fala${k ? " depois da tela anterior" : ""}`);
          return desde;
        }
        if (!achado.exato) aproximados.push(`"${item.quando}"`);
        return Math.max(0, achado.de - ANTECIPA);
      }),
    );
    inicioDaTela.push(Math.min(...inicios[k]));
  });
  if (problemas.length) {
    throw new Error(
      `${problemas.join("; ")}. Copie as palavras exatamente como foram ditas (ver_conteudo mostra a fala com os tempos) e mantenha as telas na ordem da fala.`,
    );
  }
  const fimDaTela = inicioDaTela.map((_, k) =>
    k < telas.length - 1
      ? inicioDaTela[k + 1] - RESPIRO
      : Math.max(opcoes.fimDoVideo, inicioDaTela[k] + 0.8),
  );

  // 2) Os itens.
  let nova: Timeline = opcoes.substituir
    ? {
        ...t,
        motions: [],
        inserts: [],
        audios: t.audios.filter((a) => !ehEfeitoSonoro(a.url)),
      }
    : t;
  const comSom: { motion?: Motion; insert?: Insert }[] = [];
  const avisos: string[] = [];
  const novos = new Set<Motion>();
  let motions = 0;
  let inserts = 0;
  telas.forEach((tela, k) => {
    tela.itens.forEach((item, j) => {
      const inicio = r2(inicios[k][j]);
      let fim = fimDaTela[k];
      if (item.ate_dizer?.trim()) {
        const ate = acharFalaDepois(faladas, item.ate_dizer, inicio);
        if (!ate) {
          throw new Error(
            `tela ${k + 1}: não achei "${item.ate_dizer}" (ate_dizer) na fala depois de "${item.quando}".`,
          );
        }
        fim = ate.ate + 0.15;
      } else if (item.fica_ate_tela !== null) {
        const n = item.fica_ate_tela;
        if (!Number.isInteger(n) || n < k + 1 || n > telas.length) {
          throw new Error(
            `tela ${k + 1}: fica_ate_tela ${n} precisa ser uma tela de ${k + 1} a ${telas.length}.`,
          );
        }
        fim = fimDaTela[n - 1];
      }
      fim = r2(Math.max(fim, inicio + 0.4));

      if (item.midia) {
        const m = item.midia;
        const caixa = caixaDoItem(item, t);
        if (m.formato === "video" && m.duracao && m.duracao < fim - inicio) {
          avisos.push(
            `"${m.nome}" tem só ${r2(m.duracao)}s: some em ${r2(inicio + m.duracao)}s, antes do fim pedido (${fim}s)`,
          );
        }
        const insert: Insert = {
          url: m.url,
          tipo: m.formato,
          inicio,
          // Vídeo: não passa do fim do arquivo.
          fim:
            m.formato === "video" && m.duracao
              ? r2(Math.min(fim, inicio + m.duracao))
              : fim,
          origemInicio: 0,
          posicao: item.moldura === "tela-cheia" ? "tela-cheia" : "janela",
          volume: 0,
          caixa,
          ...(item.moldura === "tela-cheia"
            ? {}
            : { acabamento: acabamentoDoItem(item) }),
        };
        nova = adicionarItem(nova, "inserts", insert);
        inserts++;
        if (item.com_som) comSom.push({ insert });
        return;
      }
      if (!item.modelo) {
        throw new Error(
          `tela ${k + 1}, item ${j + 1}: diga o modelo do motion ou a midia.`,
        );
      }
      if (item.cor && !/^#[0-9a-f]{6}$/i.test(item.cor)) {
        throw new Error("Cor inválida: use #rrggbb (ex.: #FFD60A).");
      }
      const texto = item.texto ?? "";
      const posicao =
        item.modelo === "fala" &&
        item.posicao === null &&
        tela.itens.some((outro) => outro !== item && ocupaOMeio(outro))
          ? "topo"
          : item.posicao;
      const sincroniza = item.modelo === "fala" || item.modelo === "digitando";
      const palavras = sincroniza
        ? tempoDasPalavras(texto, faladas, inicio)
        : undefined;
      const motion: Motion = {
        modelo: item.modelo,
        inicio,
        fim,
        texto,
        ...(item.detalhe ? { detalhe: item.detalhe } : {}),
        ...(posicao ? { posicao } : {}),
        ...(item.x !== null ? { x: item.x } : {}),
        ...(item.y !== null ? { y: item.y } : {}),
        ...(item.x2 !== null ? { x2: item.x2 } : {}),
        ...(item.y2 !== null ? { y2: item.y2 } : {}),
        ...(item.cor ? { cor: item.cor } : {}),
        ...(palavras ? { palavras } : {}),
      };
      nova = adicionarItem(nova, "motions", motion);
      novos.add(motion);
      motions++;
      if (item.com_som) comSom.push({ motion });
    });
  });
  nova = { ...nova, motions: desencontrarDoTopo(nova.motions, novos) };

  // 3) Sons: o de cada motion e o "whoosh" de um celular que chega (não o
  // que só troca de tela), sem repetir som em cima de som.
  let sons = 0;
  for (const { motion, insert } of comSom) {
    if (motion) {
      const som = somDoMotion(motion);
      const momento = momentoDoSomDoMotion(motion);
      if (som && !temSomPerto(nova, momento)) {
        nova = adicionarSom(nova, som, momento);
        sons++;
      }
    } else if (insert) {
      const continua = nova.inserts.some(
        (x) =>
          x !== insert &&
          x.acabamento?.celular &&
          insert.acabamento?.celular &&
          Math.abs(x.fim - insert.inicio) <= 0.1,
      );
      const momento = insert.inicio + 0.25;
      if (!continua && !temSomPerto(nova, momento)) {
        nova = adicionarSom(nova, "whoosh", momento);
        sons++;
      }
    }
  }
  return {
    timeline: nova,
    motions,
    inserts,
    sons,
    telas: inicioDaTela.map((de, k) => ({
      tela: k + 1,
      de: r2(de),
      ate: r2(fimDaTela[k]),
    })),
    aproximados,
    avisos,
  };
};
