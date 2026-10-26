import { Midia } from "@/projeto/tipos";
import { caixaDoCelular, caixaPadrao, ehTelaCheia } from "@/timeline/caixas";
import {
  calcularClipes,
  calcularDuracaoTotal,
  inicioDosClipes,
} from "@/timeline/calculos";
import { ehEfeitoSonoro } from "@/timeline/operacoes";
import { palavrasDoTexto } from "@/timeline/palavras";
import { Insert, Motion, Timeline } from "@/timeline/schema";
import { palavrasNoVideoFinal } from "./conteudo";

// Conferência da edição feita pela IA do chat, ANTES de entregar: regras
// que não custam nada (sobreposição, tempos, textos longos, tela vazia…).
// Só aponta problemas em itens novos ou mudados neste pedido — o que o
// usuário já tinha feito à mão não é "corrigido" sem ele pedir.

const r1 = (n: number) => Math.round(n * 10) / 10;

// Itens novos ou mudados (comparando o conteúdo com a timeline de antes).
const novosOuMudados = <T>(antes: T[], depois: T[]) => {
  const vistos = new Set(antes.map((x) => JSON.stringify(x)));
  return new Set(depois.filter((x) => !vistos.has(JSON.stringify(x))));
};

type Area = { x0: number; y0: number; x1: number; y1: number };

// Onde cada motion "ocupa" a tela (em % do vídeo, aproximado). Os que
// apontam ou enfeitam (seta, círculo, toque, brilho, fio…) ficam de fora:
// eles foram feitos para ficar por cima de outras coisas.
const areaDoMotion = (m: Motion, t: Timeline): Area | null => {
  const u = Math.min(t.largura, t.altura) / 100;
  const ux = (u / t.largura) * 100;
  const uy = (u / t.altura) * 100;
  const caixaEm = (cx: number, cy: number, meiaL: number, meiaA: number): Area => ({
    x0: cx - meiaL * ux,
    y0: cy - meiaA * uy,
    x1: cx + meiaL * ux,
    y1: cy + meiaA * uy,
  });
  const faixa = (y0: number, y1: number): Area => ({ x0: 6, y0, x1: 94, y1 });
  const lugar = (padrao: "topo" | "centro" | "base", alto: number) => {
    const p = m.posicao ?? padrao;
    const meia = (alto / 2) * uy;
    return p === "topo"
      ? faixa(8, 8 + alto * uy)
      : p === "base"
        ? faixa(76 - alto * uy, 76)
        : faixa(50 - meia, 50 + meia);
  };
  const palavras = palavrasDoTexto(m.texto).length;
  const linhas = Math.max(1, m.texto.split("|").length);
  switch (m.modelo) {
    case "fala":
      return lugar("centro", linhas * 15 + Math.min(10, palavras));
    case "etiqueta":
    case "confirmado":
      return m.x !== undefined || m.y !== undefined
        ? caixaEm(m.x ?? 50, m.y ?? 10, 26, 5)
        : lugar("topo", 9);
    case "anel":
      return caixaEm(m.x ?? 50, m.y ?? 50, 29, 29);
    case "microfone":
      return caixaEm(m.x ?? 50, m.y ?? 48, 26, 26);
    case "curtida":
      return caixaEm(m.x ?? 50, m.y ?? 56, 14, 16);
    case "barra":
      return lugar("centro", 34);
    case "digitando":
      return lugar("topo", 30);
    case "comentario":
      return lugar("centro", 60);
    case "rec":
      return lugar("centro", 42);
    case "edicao":
      return lugar("centro", 30);
    case "conversa": {
      const c = caixaDoCelular(t.largura / t.altura, null);
      return { x0: c.x, y0: c.y, x1: c.x + c.largura, y1: c.y + c.altura };
    }
    case "frase":
    case "preco":
    case "contador":
    case "titulo":
      return lugar("centro", 24);
    case "lista":
      return lugar("centro", 40);
    case "chamada":
      return lugar("base", 18);
    case "rodape":
      return lugar("base", 14);
    case "ficha":
      return lugar("topo", 40);
    default:
      return null;
  }
};

const areaDoInsert = (x: Insert): Area | null => {
  const c = x.caixa ?? caixaPadrao(x.posicao);
  if (ehTelaCheia(c)) return null; // tela cheia é "fundo", não disputa lugar
  return { x0: c.x, y0: c.y, x1: c.x + c.largura, y1: c.y + c.altura };
};

// Quanto (0 a 1) da menor área fica embaixo da outra.
const cobertura = (a: Area, b: Area) => {
  const l = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const h = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const menor = Math.min(
    (a.x1 - a.x0) * (a.y1 - a.y0),
    (b.x1 - b.x0) * (b.y1 - b.y0),
  );
  return menor > 0 ? (l * h) / menor : 0;
};

const nomeDoMotion = (m: Motion, i: number) =>
  `motion ${i + 1} (${m.modelo}${m.texto ? ` "${m.texto.replace(/\*/g, "").slice(0, 30)}"` : ""})`;

export const conferirEdicao = (
  antes: Timeline,
  depois: Timeline,
  biblioteca: Midia[],
): string[] => {
  const problemas: string[] = [];
  const motionsNovos = novosOuMudados(antes.motions ?? [], depois.motions);
  const insertsNovos = novosOuMudados(antes.inserts, depois.inserts);
  const clipes = calcularClipes(depois);
  const duracao = calcularDuracaoTotal(clipes) / depois.fps;

  // 1) Um em cima do outro (ao mesmo tempo, no mesmo lugar).
  type Ocupante = { nome: string; de: number; ate: number; area: Area; novo: boolean };
  const ocupantes: Ocupante[] = [
    ...depois.motions.flatMap((m, i) => {
      const area = areaDoMotion(m, depois);
      return area
        ? [{ nome: nomeDoMotion(m, i), de: m.inicio, ate: m.fim, area, novo: motionsNovos.has(m) }]
        : [];
    }),
    ...depois.inserts.flatMap((x, i) => {
      // Celular com conversa por cima é de propósito.
      const area = areaDoInsert(x);
      return area
        ? [{ nome: `insert ${i + 1}`, de: x.inicio, ate: x.fim, area, novo: insertsNovos.has(x) }]
        : [];
    }),
  ];
  for (let i = 0; i < ocupantes.length; i++) {
    for (let j = i + 1; j < ocupantes.length; j++) {
      const a = ocupantes[i];
      const b = ocupantes[j];
      if (!a.novo && !b.novo) continue;
      const juntos = Math.min(a.ate, b.ate) - Math.max(a.de, b.de);
      if (juntos > 0.25 && cobertura(a.area, b.area) > 0.2) {
        problemas.push(
          `${a.nome} e ${b.nome} ficam um em cima do outro de ${r1(Math.max(a.de, b.de))}s a ${r1(Math.min(a.ate, b.ate))}s (mude a posição/posicao/x/y de um deles ou os tempos).`,
        );
      }
    }
  }

  // 2) Textos longos demais (ficam pequenos ou cortados).
  depois.motions.forEach((m, i) => {
    if (!motionsNovos.has(m)) return;
    const n = palavrasDoTexto(m.texto).length;
    const chars = m.texto.replace(/[*|]/g, "").length;
    // Texto falado: linhas curtas empilhadas leem bem; linha comprida ou
    // texto enorme fica pequeno.
    const maiorLinha = Math.max(
      ...m.texto.split("|").map((l) => palavrasDoTexto(l).length),
    );
    if (m.modelo === "fala" && (maiorLinha > 6 || n > 16)) {
      problemas.push(`${nomeDoMotion(m, i)} tem ${maiorLinha > 6 ? `uma linha com ${maiorLinha} palavras` : `${n} palavras`}: fica pequeno; quebre com | ou divida em duas telas.`);
    } else if ((m.modelo === "etiqueta" && chars > 26) || (m.modelo === "confirmado" && chars > 14) || (m.modelo === "anel" && chars > 20)) {
      problemas.push(`${nomeDoMotion(m, i)}: texto longo demais para esse modelo (use até ~3 palavras).`);
    } else if (!["lista", "ficha", "conversa", "fala", "digitando", "comentario"].includes(m.modelo) && chars > 60) {
      problemas.push(`${nomeDoMotion(m, i)}: texto longo demais (fica pequeno).`);
    }
    if (m.fim - m.inicio < 0.4) {
      problemas.push(`${nomeDoMotion(m, i)} fica só ${r1(m.fim - m.inicio)}s na tela: não dá para ler.`);
    }
    if (m.inicio >= duracao - 0.05) {
      problemas.push(`${nomeDoMotion(m, i)} começa em ${r1(m.inicio)}s, depois do fim do vídeo (${r1(duracao)}s).`);
    }
  });
  depois.inserts.forEach((x, i) => {
    if (insertsNovos.has(x) && x.inicio >= duracao - 0.05) {
      problemas.push(`insert ${i + 1} começa em ${r1(x.inicio)}s, depois do fim do vídeo (${r1(duracao)}s).`);
    }
  });

  // 3) Texto falado que não bate com o que é dito naquele momento, e
  //    legenda repetindo o texto falado.
  const ditas = palavrasNoVideoFinal(depois, biblioteca);
  depois.motions.forEach((m, i) => {
    if (!motionsNovos.has(m) || m.modelo !== "fala" || m.palavras) return;
    if (ditas.some((p) => p.de < m.fim && p.ate > m.inicio)) {
      problemas.push(`${nomeDoMotion(m, i)} não bate com o que é falado de ${r1(m.inicio)}s a ${r1(m.fim)}s (use as palavras exatas da fala).`);
    }
  });
  const falasNovas = depois.motions.filter((m) => motionsNovos.has(m) && m.modelo === "fala");
  const legendasJuntas = depois.legendas.filter((l) => falasNovas.some((m) => l.inicio < m.fim && l.fim > m.inicio));
  if (legendasJuntas.length) {
    problemas.push(`Há ${legendasJuntas.length} legenda(s) ao mesmo tempo que o texto falado (o mesmo texto aparece duas vezes): tire as legendas desse trecho ou não use texto falado.`);
  }

  // 4) A fala passa do fim do vídeo (o vídeo corta a pessoa falando).
  const ultima = ditas.at(-1);
  const duracaoAntes = calcularDuracaoTotal(calcularClipes(antes)) / antes.fps;
  if (ultima && ultima.de > duracao + 0.1 && duracao !== duracaoAntes) {
    problemas.push(`A fala vai até ${r1(ultima.ate)}s mas o vídeo acaba em ${r1(duracao)}s: estique a última cena/fundo.`);
  }

  // 5) Tela vazia num vídeo só de motion (fundo animado) enquanto fala.
  if (depois.clipes.some((c) => c.tipo === "fundo") && motionsNovos.size) {
    const visiveis = [...depois.motions, ...depois.inserts].map((x) => [x.inicio, x.fim] as const);
    const fimDaFala = Math.min(duracao, ultima?.ate ?? 0);
    let desde = ditas[0]?.de ?? 0;
    for (let s = desde; s <= fimDaFala; s += 0.1) {
      const ocupado = visiveis.some(([a, b]) => s >= a && s < b);
      if (ocupado) {
        desde = s + 0.1;
      } else if (s - desde >= 2.5) {
        problemas.push(`Tela vazia (só o fundo) a partir de ${r1(desde)}s enquanto a pessoa fala: encene esse trecho.`);
        break;
      }
    }
  }

  // 6) Motion atravessando uma transição com efeito (ele não acompanha).
  const inicios = inicioDosClipes(clipes);
  clipes.forEach((c, k) => {
    if (k === 0 || c.transicao === "corte" || !c.transicaoFrames) return;
    const meio = (inicios[k] + c.transicaoFrames / 2) / depois.fps;
    depois.motions.forEach((m, i) => {
      if (motionsNovos.has(m) && m.modelo !== "vigilancia" && m.inicio < meio - 0.3 && m.fim > meio + 0.3) {
        problemas.push(`${nomeDoMotion(m, i)} atravessa a transição da cena ${k + 1} (${r1(meio)}s) e não acompanha o efeito: termine antes ou comece depois.`);
      }
    });
  });

  // 7) Muitos efeitos sonoros juntos.
  const sons = depois.audios.filter((a) => ehEfeitoSonoro(a.url)).map((a) => a.inicio).sort((a, b) => a - b);
  const sonsNovos = novosOuMudados(antes.audios, depois.audios);
  for (let i = 0; i + 3 < sons.length; i++) {
    if (sons[i + 3] - sons[i] < 1 && depois.audios.some((a) => sonsNovos.has(a) && ehEfeitoSonoro(a.url) && a.inicio >= sons[i] && a.inicio <= sons[i + 3])) {
      problemas.push(`4 ou mais efeitos sonoros em menos de 1s perto de ${r1(sons[i])}s: fica poluído, deixe 1 ou 2.`);
      break;
    }
  }

  return [...new Set(problemas)].slice(0, 12);
};

// Pedido "grande" (vale revisar olhando quadros): muita coisa nova.
export const ehEdicaoGrande = (antes: Timeline, depois: Timeline) =>
  novosOuMudados(antes.motions ?? [], depois.motions).size +
    novosOuMudados(antes.inserts, depois.inserts).size +
    novosOuMudados(antes.clipes, depois.clipes).size >=
  4;

// Momentos para olhar: a chegada de cada coisa nova (até "maximo"),
// espalhados pelo vídeo.
export const momentosParaRevisar = (antes: Timeline, depois: Timeline, maximo = 8) => {
  const duracao = calcularDuracaoTotal(calcularClipes(depois)) / depois.fps;
  const novos = [
    ...novosOuMudados(antes.motions ?? [], depois.motions),
    ...novosOuMudados(antes.inserts, depois.inserts),
  ] as { inicio: number; fim: number }[];
  const candidatos = novos
    .map((x) => x.inicio + Math.min(0.9, (x.fim - x.inicio) * 0.6))
    .filter((s) => s < duracao - 0.05)
    .sort((a, b) => a - b);
  // Junta momentos muito próximos.
  const unicos: number[] = [];
  for (const s of candidatos) {
    if (!unicos.length || s - unicos[unicos.length - 1] > 1.2) unicos.push(r1(s));
  }
  if (unicos.length <= maximo) return unicos;
  return Array.from({ length: maximo }, (_, i) => unicos[Math.round((i * (unicos.length - 1)) / (maximo - 1))]);
};

// O que se ouve e o que deveria estar na tela num momento (para a IA
// comparar com o quadro).
export const descreverMomento = (t: Timeline, biblioteca: Midia[], s: number) => {
  const fala = palavrasNoVideoFinal(t, biblioteca)
    .filter((p) => p.de >= s - 2 && p.de <= s + 0.3)
    .map((p) => p.palavra)
    .join(" ");
  const ativos = t.motions
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.inicio <= s && m.fim > s)
    .map(({ m, i }) => nomeDoMotion(m, i));
  const inserts = t.inserts
    .map((x, i) => ({ x, i }))
    .filter(({ x }) => x.inicio <= s && x.fim > s)
    .map(({ i }) => `insert ${i + 1}`);
  return `${r1(s)}s — falando: "${fala || "(nada)"}"; na tela deveria ter: ${[...ativos, ...inserts].join(", ") || "só a cena"}.`;
};
