import { Midia } from "@/projeto/tipos";
import { calcularClipes, inicioDosClipes } from "@/timeline/calculos";
import { Legenda, Timeline } from "@/timeline/schema";

// Leva a análise de cada arquivo (tempos DENTRO do arquivo) para o vídeo
// FINAL, levando em conta cortes, ordem, transições e posição de inserts
// e áudios. É isso que permite "legende o vídeo" e "quando eu falo X".

export type PalavraFinal = {
  de: number;
  ate: number;
  palavra: string;
  fonte: string;
};

export type MomentoFinal = {
  de: number;
  ate: number;
  descricao: string;
  texto_na_tela: string;
  fonte: string;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

// Trechos do vídeo final que vêm de cada arquivo:
// [inicioFinal, fimFinal) mostra o arquivo a partir de "origem".
type Trecho = {
  midia: Midia;
  fonte: string;
  inicioFinal: number;
  fimFinal: number;
  origem: number;
  audivel: boolean;
  visivel: boolean;
};

const trechos = (t: Timeline, biblioteca: Midia[]): Trecho[] => {
  const porUrl = (url: string) => biblioteca.find((m) => m.url === url);
  const lista: Trecho[] = [];

  const clipes = calcularClipes(t);
  const inicios = inicioDosClipes(clipes);
  clipes.forEach((c, i) => {
    const midia = porUrl(c.url);
    if (!midia) return;
    lista.push({
      midia,
      fonte: `cena ${i + 1} (${midia.nome})`,
      inicioFinal: inicios[i] / t.fps,
      fimFinal: (inicios[i] + c.duracaoFrames) / t.fps,
      origem: c.inicio,
      audivel: c.volume > 0,
      visivel: true,
    });
  });
  t.inserts.forEach((x, i) => {
    const midia = porUrl(x.url);
    if (!midia) return;
    lista.push({
      midia,
      fonte: `insert ${i + 1} (${midia.nome})`,
      inicioFinal: x.inicio,
      fimFinal: x.fim,
      origem: x.tipo === "imagem" ? 0 : x.origemInicio,
      audivel: x.tipo === "video" && x.volume > 0,
      visivel: true,
    });
  });
  t.audios.forEach((x, i) => {
    const midia = porUrl(x.url);
    if (!midia) return;
    lista.push({
      midia,
      fonte: `áudio ${i + 1} (${midia.nome})`,
      inicioFinal: x.inicio,
      fimFinal: x.fim,
      origem: x.origemInicio,
      audivel: x.volume > 0,
      visivel: false,
    });
  });
  return lista;
};

// Palavras faladas num trecho, já no tempo do vídeo final.
const palavrasDoTrecho = (tr: Trecho): PalavraFinal[] =>
  (tr.midia.analise?.transcricao?.palavras ?? []).flatMap((p) => {
    const de = tr.inicioFinal + (p.de - tr.origem);
    if (p.de < tr.origem - 0.05 || de >= tr.fimFinal) return [];
    return [
      {
        de: r2(de),
        ate: r2(Math.min(tr.fimFinal, tr.inicioFinal + (p.ate - tr.origem))),
        palavra: p.palavra,
        fonte: tr.fonte,
      },
    ];
  });

export const palavrasNoVideoFinal = (
  t: Timeline,
  biblioteca: Midia[],
): PalavraFinal[] =>
  trechos(t, biblioteca)
    .filter((tr) => tr.audivel)
    .flatMap(palavrasDoTrecho)
    .sort((a, b) => a.de - b.de);

// Palavras de UM arquivo no vídeo final, mesmo que ele esteja mudo (ex.:
// narração usada só como base das legendas). Se o arquivo não está na
// timeline, as legendas começam no segundo "inicio" do vídeo.
export const palavrasDaMidia = (
  t: Timeline,
  biblioteca: Midia[],
  midia: Midia,
  inicio = 0,
): PalavraFinal[] => {
  const usos = trechos(t, biblioteca).filter((tr) => tr.midia.id === midia.id);
  if (!usos.length) {
    return (midia.analise?.transcricao?.palavras ?? []).map((p) => ({
      de: r2(inicio + p.de),
      ate: r2(inicio + p.ate),
      palavra: p.palavra,
      fonte: midia.nome,
    }));
  }
  return usos.flatMap(palavrasDoTrecho).sort((a, b) => a.de - b.de);
};

export const momentosNoVideoFinal = (
  t: Timeline,
  biblioteca: Midia[],
): MomentoFinal[] =>
  trechos(t, biblioteca)
    .filter((tr) => tr.visivel && tr.midia.analise?.visual)
    .flatMap((tr) => {
      const visual = tr.midia.analise!.visual!;
      if (tr.midia.formato === "imagem") {
        const m = visual.momentos[0];
        return [
          {
            de: r2(tr.inicioFinal),
            ate: r2(tr.fimFinal),
            descricao: m?.descricao ?? visual.resumo,
            texto_na_tela: m?.texto_na_tela ?? "",
            fonte: tr.fonte,
          },
        ];
      }
      return visual.momentos.flatMap((m) => {
        const de = Math.max(
          tr.inicioFinal,
          tr.inicioFinal + (m.de - tr.origem),
        );
        const ate = Math.min(tr.fimFinal, tr.inicioFinal + (m.ate - tr.origem));
        if (ate <= de) return [];
        return [{ ...m, de: r2(de), ate: r2(ate), fonte: tr.fonte }];
      });
    })
    .sort((a, b) => a.de - b.de);

const normalizar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

// Acha onde um trecho de fala aparece no vídeo final. Primeiro procura a
// frase exata; se não achar, as janelas com mais palavras em comum.
export const buscarFala = (palavras: PalavraFinal[], trecho: string) => {
  const alvo = normalizar(trecho);
  if (alvo.length === 0) return [];
  const tokens = palavras.map((p) => normalizar(p.palavra).join(" "));
  const resultado = (inicio: number, fim: number, semelhanca: number) => ({
    de: palavras[inicio].de,
    ate: palavras[fim].ate,
    fonte: palavras[inicio].fonte,
    semelhanca: r2(semelhanca),
    fala: palavras
      .slice(Math.max(0, inicio - 4), Math.min(palavras.length, fim + 5))
      .map((p) => p.palavra)
      .join(" "),
  });

  const exatos = [];
  for (let i = 0; i + alvo.length <= tokens.length; i++) {
    if (alvo.every((tk, j) => tokens[i + j] === tk)) {
      exatos.push(resultado(i, i + alvo.length - 1, 1));
    }
  }
  if (exatos.length) return exatos.slice(0, 5);

  const conjunto = new Set(alvo);
  const aproximados = [];
  for (let i = 0; i + alvo.length <= tokens.length; i++) {
    const janela = tokens.slice(i, i + alvo.length);
    const comuns = janela.filter((tk) => conjunto.has(tk)).length;
    const semelhanca = comuns / alvo.length;
    if (semelhanca >= 0.6)
      aproximados.push(resultado(i, i + alvo.length - 1, semelhanca));
  }
  return aproximados.sort((a, b) => b.semelhanca - a.semelhanca).slice(0, 5);
};

// Agrupa as palavras em legendas curtas: quebra ao atingir o máximo de
// palavras, numa pausa maior que 0,7s ou quando muda a origem do som.
export const gerarLegendas = (
  palavras: PalavraFinal[],
  maxPalavras: number,
): Legenda[] => {
  const legendas: Legenda[] = [];
  let grupo: PalavraFinal[] = [];

  const fechar = () => {
    if (!grupo.length) return;
    const de = grupo[0].de;
    const ate = Math.max(grupo[grupo.length - 1].ate, de + 0.6);
    const anterior = legendas[legendas.length - 1];
    if (anterior && anterior.fim > de)
      anterior.fim = r2(Math.max(anterior.inicio + 0.1, de));
    legendas.push({
      texto: grupo
        .map((p) => p.palavra)
        .join(" ")
        .replace(/\s+([,.!?;:])/g, "$1"),
      inicio: r2(de),
      fim: r2(ate),
      // Tempo de cada palavra (contado do início da legenda), para as
      // animações karaokê/pop/destaque seguirem a fala.
      palavras: grupo.map((p) => ({
        texto: p.palavra,
        de: r2(p.de - de),
        ate: r2(p.ate - de),
      })),
    });
    grupo = [];
  };

  for (const p of palavras) {
    const ultima = grupo[grupo.length - 1];
    if (
      ultima &&
      (grupo.length >= maxPalavras ||
        p.de - ultima.ate > 0.7 ||
        p.fonte !== ultima.fonte ||
        /[.!?]$/.test(ultima.palavra))
    ) {
      fechar();
    }
    grupo.push(p);
  }
  fechar();
  return legendas;
};
