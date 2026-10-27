import { Midia } from "@/projeto/tipos";
import { caixaDoCelular, caixaPadrao, ehTelaCheia } from "@/timeline/caixas";
import {
  calcularClipes,
  calcularDuracaoTotal,
  inicioDosClipes,
} from "@/timeline/calculos";
import { ehEfeitoSonoro } from "@/timeline/operacoes";
import { palavrasDoTexto } from "@/timeline/palavras";
import type { CaixaMedida, ItemMedido } from "@/remotion/EditorTimeline/medidas";
import { Insert, Legenda, Motion, Timeline } from "@/timeline/schema";
import { palavrasNoVideoFinal } from "./conteudo";

// Conferência da edição feita pela IA do chat, ANTES de entregar: regras
// que não custam nada (tempos, textos longos, tela vazia, repetição…) e as
// posições MEDIDAS nos quadros de verdade (problemasMedidos: um em cima do
// outro, texto saindo da tela). Só aponta problemas em itens novos ou
// mudados neste pedido — o que o usuário já tinha feito à mão não é
// "corrigido" sem ele pedir (para conferir o vídeo todo, "antes" vazio).

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

export const nomeDoMotion = (m: Motion, i: number) =>
  `motion ${i + 1} (${m.modelo}${m.texto ? ` "${m.texto.replace(/\*/g, "").slice(0, 30)}"` : ""})`;

export const conferirEdicao = (
  antes: Timeline,
  depois: Timeline,
  biblioteca: Midia[],
  // Sem os quadros medidos, a sobreposição é estimada pelo modelo/posição.
  { estimarSobreposicao = true }: { estimarSobreposicao?: boolean } = {},
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
  for (let i = 0; estimarSobreposicao && i < ocupantes.length; i++) {
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
    // Texto falado: texto enorme numa tela só fica pequeno.
    // (Linha com mais de 6 palavras o desenho já quebra sozinho.)
    if (m.modelo === "fala" && n > 16) {
      problemas.push(`${nomeDoMotion(m, i)} tem ${n} palavras: é texto demais para uma tela; divida em duas telas.`);
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
  // Sem o tempo de cada palavra, compara o texto com o que é dito ali: um
  // nome corrigido (a transcrição ouviu "REC", o certo é "Rekk") não é erro.
  const simples = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9%]/g, "");
  depois.motions.forEach((m, i) => {
    if (!motionsNovos.has(m) || m.modelo !== "fala" || m.palavras) return;
    const ali = new Set(
      ditas.filter((p) => p.de < m.fim + 0.6 && p.ate > m.inicio - 0.6).map((p) => simples(p.palavra)),
    );
    if (!ali.size) return;
    const doTexto = palavrasDoTexto(m.texto).map(simples).filter(Boolean);
    const batem = doTexto.filter((p) => ali.has(p)).length;
    if (batem < doTexto.length * 0.6) {
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

  // 8) Grafismo só com emoji/ícone, sem texto: fica solto, sem sentido.
  const PEDEM_TEXTO = ["etiqueta", "confirmado", "selo", "anel", "barra", "chamada", "titulo", "frase"];
  depois.motions.forEach((m, i) => {
    if (motionsNovos.has(m) && PEDEM_TEXTO.includes(m.modelo) && !/[\p{L}\p{N}]/u.test(m.texto)) {
      problemas.push(`${nomeDoMotion(m, i)} só tem emoji/ícone, sem texto: fica solto e sem sentido na tela. Ponha um texto curto (ex.: o nome) ou tire.`);
    }
  });

  // 9) O mesmo grafismo (modelo + texto) repetido muitas vezes.
  const iguais = new Map<string, number[]>();
  depois.motions.forEach((m, i) => {
    if (m.modelo === "fala") return;
    const chave = `${m.modelo} "${m.texto.replace(/[*|]/g, " ").replace(/\s+/g, " ").trim()}"`;
    iguais.set(chave, [...(iguais.get(chave) ?? []), i]);
  });
  for (const [chave, indices] of iguais) {
    if (indices.length >= 3 && indices.some((i) => motionsNovos.has(depois.motions[i]))) {
      problemas.push(`O mesmo grafismo (${chave}) aparece ${indices.length} vezes (aos ${indices.map((i) => `${r1(depois.motions[i].inicio)}s`).join(", ")}): fica repetitivo e genérico. Varie ou tire os que sobram.`);
    }
  }

  // 10) A mesma informação duas vezes na tela: o grafismo repete o número
  //     que o texto falado já mostra ao mesmo tempo.
  const numeros = (texto: string) =>
    new Set((texto.replace(/[*|]/g, " ").match(/\d+(?:[.,]\d+)?\s?%?/g) ?? []).map((x) => x.replace(/\s/g, "")));
  depois.motions.forEach((m, i) => {
    if (m.modelo === "fala") return;
    const doGrafismo = numeros(`${m.texto} ${m.detalhe ?? ""}`);
    if (!doGrafismo.size) return;
    depois.motions.forEach((f, j) => {
      if (f.modelo !== "fala" || !(motionsNovos.has(m) || motionsNovos.has(f))) return;
      if (f.inicio >= m.fim - 0.2 || f.fim <= m.inicio + 0.2) return;
      const repetido = [...numeros(f.texto)].find((x) => doGrafismo.has(x));
      if (repetido) {
        problemas.push(`${nomeDoMotion(m, i)} repete "${repetido}", que o ${nomeDoMotion(f, j)} já mostra ao mesmo tempo: a mesma informação duas vezes na tela. Mostre outra coisa no grafismo ou tire.`);
      }
    });
  });

  // 11) Vídeo de animação: texto falado no topo com o resto da tela vazio
  //     (sem grafismo nem foto junto) fica desequilibrado.
  if (depois.clipes.some((c) => c.tipo === "fundo")) {
    depois.motions.forEach((m, i) => {
      if (!motionsNovos.has(m) || m.modelo !== "fala" || m.posicao !== "topo") return;
      const dura = m.fim - m.inicio;
      const junto = [
        ...depois.motions.filter((o) => o !== m && o.modelo !== "fala"),
        ...depois.inserts,
      ].some((o) => Math.min(o.fim, m.fim) - Math.max(o.inicio, m.inicio) > dura * 0.4);
      if (!junto && dura >= 1) {
        problemas.push(`${nomeDoMotion(m, i)} está no topo e o resto da tela fica vazio (nenhum grafismo junto): tire a posição (fica no centro) ou acrescente embaixo um grafismo que encene a frase.`);
      }
    });
  }

  // 12) Cartão REC (gravação) onde ninguém fala de gravar/vídeo: parece
  //     sobra de modelo.
  depois.motions.forEach((m, i) => {
    if (!motionsNovos.has(m) || m.modelo !== "rec") return;
    const perto = ditas
      .filter((p) => p.de < m.fim + 1.5 && p.ate > m.inicio - 3)
      .map((p) => p.palavra)
      .join(" ");
    if (!/grav|v[ií]deo|c[aâ]mera|ao vivo|live|\brec\b|filma/i.test(perto)) {
      problemas.push(`${nomeDoMotion(m, i)} é o cartão REC (de gravação), mas ninguém fala de gravar ou de vídeo nesse trecho: parece sobra de modelo. Use etiqueta, digitando, confirmado ou anel.`);
    }
  });

  return [...new Set(problemas)].slice(0, 16);
};

// ---------- Posições medidas nos quadros de verdade ----------

// O que entra na conferência: itens novos ou mudados neste pedido.
export type Foco = {
  motions: Set<Motion>;
  inserts: Set<Insert>;
  legendas: Set<Legenda>;
};
export const focoDaEdicao = (antes: Timeline, depois: Timeline): Foco => ({
  motions: novosOuMudados(antes.motions ?? [], depois.motions),
  inserts: novosOuMudados(antes.inserts, depois.inserts),
  legendas: novosOuMudados(antes.legendas, depois.legendas),
});
// Para conferir o vídeo todo: a timeline sem nenhum item ("tudo é novo").
export const semItens = (t: Timeline): Timeline => ({
  ...t,
  motions: [],
  inserts: [],
  legendas: [],
});

// Momentos para medir/olhar: perto do FIM de cada item em foco (quando o
// texto falado já apareceu inteiro e a barra já encheu), antes da saída.
export const momentosParaMedir = (t: Timeline, foco: Foco, maximo = 40) => {
  const duracao = calcularDuracaoTotal(calcularClipes(t)) / t.fps;
  const itens: { inicio: number; fim: number }[] = [
    ...t.motions.filter((m) => foco.motions.has(m)),
    ...t.inserts.filter((x) => foco.inserts.has(x)),
    ...t.legendas.filter((l) => foco.legendas.has(l)),
  ];
  const candidatos = itens
    .map(({ inicio, fim }) =>
      Math.min(fim - 0.25, Math.max(inicio + (fim - inicio) * 0.55, fim - 0.35)),
    )
    .filter((s) => s >= 0 && s < duracao - 0.05)
    .sort((a, b) => a - b);
  // Momentos muito próximos viram um só (o primeiro: o item que termina
  // depois ainda está inteiro nele).
  const unicos: number[] = [];
  for (const s of candidatos) {
    if (!unicos.length || s - unicos[unicos.length - 1] >= 0.3) {
      unicos.push(Math.round(s * 100) / 100);
    }
  }
  if (unicos.length <= maximo) return unicos;
  return Array.from({ length: maximo }, (_, i) => unicos[Math.round((i * (unicos.length - 1)) / (maximo - 1))]);
};

// Enfeites feitos para ficar por cima de outras coisas (apontam, marcam,
// cruzam a tela): não contam como sobreposição.
const ENFEITES = new Set(["seta", "circulo", "toque", "brilho", "fio", "fita", "vigilancia", "carimbo", "marcador"]);
// Podem ficar por cima de uma foto/vídeo de propósito: sempre (bilhete,
// conversa no celular) ou quando presos num ponto (x/y) da foto (rótulos
// pequenos). Texto falado, frases e números nunca.
const SOBRE_FOTO = new Set(["nota", "conversa"]);
const ROTULO_NA_FOTO = new Set(["etiqueta", "selo", "confirmado", "curtida", "toque", "microfone"]);

// Grade de 0,5% × 0,5% da tela: quanto dois itens se cobrem de verdade.
const GRADE = 200;
const pintar = (caixas: CaixaMedida[]) => {
  const grade = new Uint8Array(GRADE * GRADE);
  for (const [, x0, y0, x1, y1] of caixas) {
    const c0 = Math.max(0, Math.round(x0 * 2));
    const c1 = Math.min(GRADE, Math.round(x1 * 2));
    const l0 = Math.max(0, Math.round(y0 * 2));
    const l1 = Math.min(GRADE, Math.round(y1 * 2));
    for (let l = l0; l < l1; l++) grade.fill(1, l * GRADE + c0, l * GRADE + c1);
  }
  return grade;
};
const contar = (g: Uint8Array) => g.reduce((n, v) => n + v, 0);
const juntas = (a: Uint8Array, b: Uint8Array) => {
  let n = 0;
  for (let i = 0; i < a.length; i++) n += a[i] & b[i];
  return n;
};
const uniao = (caixas: CaixaMedida[]) =>
  caixas.reduce(
    (u, [, x0, y0, x1, y1]) => [Math.min(u[0], x0), Math.min(u[1], y0), Math.max(u[2], x1), Math.max(u[3], y1)],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
const ondeFica = (caixas: CaixaMedida[]) => {
  const [x0, y0, x1, y1] = uniao(caixas).map((v) => Math.round(v));
  return `x ${x0}–${x1}%, y ${y0}–${y1}%`;
};

// texto = para a IA corrigir (com o que foi medido); curto = para o usuário.
export type ProblemaMedido = { segundo: number; chave: string; texto: string; curto: string };

// Sobreposições e textos saindo da tela, medidos nos quadros.
export const problemasMedidos = (
  t: Timeline,
  quadros: { segundo: number; itens?: ItemMedido[] }[],
  foco: Foco,
): ProblemaMedido[] => {
  type Info = {
    nome: string;
    tipo: "motion" | "insert" | "legenda";
    motion?: Motion;
    emFoco: boolean;
  };
  const info = (chave: string): Info | null => {
    const [tipo, n] = chave.split(":");
    const i = Number(n);
    if (tipo === "motion" && t.motions[i]) {
      const m = t.motions[i];
      return { nome: nomeDoMotion(m, i), tipo, motion: m, emFoco: foco.motions.has(m) };
    }
    if (tipo === "insert" && t.inserts[i]) {
      return { nome: `insert ${i + 1}`, tipo, emFoco: foco.inserts.has(t.inserts[i]) };
    }
    if (tipo === "legenda" && t.legendas[i]) {
      const l = t.legendas[i];
      return { nome: `legenda ${i + 1} ("${l.texto.slice(0, 30)}")`, tipo, emFoco: foco.legendas.has(l) };
    }
    return null;
  };
  // Esse par pode estar um em cima do outro de propósito?
  const parConta = (a: Info, b: Info) => {
    if (a.motion && ENFEITES.has(a.motion.modelo)) return false;
    if (b.motion && ENFEITES.has(b.motion.modelo)) return false;
    if (a.tipo === "insert" && b.tipo === "insert") return false;
    if ((a.tipo === "legenda" && b.tipo === "insert") || (a.tipo === "insert" && b.tipo === "legenda")) return false;
    const m = a.motion ?? b.motion;
    const outro = a.motion ? b : a;
    // Bilhete, conversa no celular, rótulo preso num ponto da foto.
    const preso = m && ROTULO_NA_FOTO.has(m.modelo) && (m.x !== undefined || m.y !== undefined);
    if (m && outro.tipo === "insert" && (SOBRE_FOTO.has(m.modelo) || preso)) {
      return false;
    }
    return true;
  };

  const vistos = new Map<string, ProblemaMedido & { ate: number }>();
  const anotar = (chave: string, segundo: number, texto: string, curto: string) => {
    const ja = vistos.get(chave);
    if (ja) ja.ate = segundo;
    else vistos.set(chave, { chave, segundo, ate: segundo, texto, curto });
  };
  for (const q of quadros) {
    const itens = (q.itens ?? [])
      .map((x) => ({ ...x, info: info(x.item) }))
      .filter((x): x is typeof x & { info: Info } => !!x.info && x.caixas.length > 0);
    const grades = itens.map((x) => pintar(x.caixas));
    for (let i = 0; i < itens.length; i++) {
      const a = itens[i];
      // Texto saindo da tela.
      const textos = a.caixas.filter((c) => c[0] === "t");
      if (a.info.emFoco && textos.length && !(a.info.motion && ENFEITES.has(a.info.motion.modelo))) {
        const [x0, y0, x1, y1] = uniao(textos);
        const lados = [
          x0 < -0.5 && "à esquerda",
          x1 > 100.5 && "à direita",
          y0 < -0.5 && "em cima",
          y1 > 100.5 && "embaixo",
        ].filter(Boolean);
        if (lados.length) {
          anotar(`fora|${a.info.nome}`, q.segundo, `${a.info.nome}: o texto sai da tela ${lados.join(" e ")} (medido: ${ondeFica(textos)}). Encurte, quebre a linha ou mude a posição.`, `${a.info.nome}: o texto sai da tela`);
        }
      }
      for (let j = i + 1; j < itens.length; j++) {
        const b = itens[j];
        if (!a.info.emFoco && !b.info.emFoco) continue;
        if (!parConta(a.info, b.info)) continue;
        const comum = juntas(grades[i], grades[j]);
        const menor = Math.min(contar(grades[i]), contar(grades[j]));
        // Pelo menos 0,1% da tela e 4% do menor dos dois.
        if (comum >= 40 && comum >= menor * 0.04) {
          const [p, s] = [a.info.nome, b.info.nome].sort();
          anotar(`sobre|${p}|${s}`, q.segundo, `${a.info.nome} e ${b.info.nome} ficam um em cima do outro (medido no quadro: o 1º em ${ondeFica(a.caixas)}, o 2º em ${ondeFica(b.caixas)}). Mude a posição (topo/centro/base ou x/y), o tamanho ou os tempos de um deles.`, `${a.info.nome} e ${b.info.nome} ficam um em cima do outro`);
        }
      }
    }
  }
  return [...vistos.values()].map(({ chave, segundo, ate, texto, curto }) => {
    const quando = `${r1(segundo)}s${ate > segundo + 0.05 ? `–${r1(ate)}s` : ""}`;
    return { chave, segundo, texto: `${quando}: ${texto}`, curto: `${quando}: ${curto}` };
  });
};


// Pedido "grande" (vale revisar olhando quadros): muita coisa nova.
export const ehEdicaoGrande = (antes: Timeline, depois: Timeline) =>
  novosOuMudados(antes.motions ?? [], depois.motions).size +
    novosOuMudados(antes.inserts, depois.inserts).size +
    novosOuMudados(antes.clipes, depois.clipes).size >=
  4;

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
