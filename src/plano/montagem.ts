import {
  gerarLegendas,
  PalavraFinal,
  palavrasDaMidia,
  palavrasNoVideoFinal,
} from "@/ia/conteudo";
import { Midia } from "@/projeto/tipos";
import { calcularClipes, calcularDuracaoTotal } from "@/timeline/calculos";
import { caixaParaPosicao, ehTelaCheia } from "@/timeline/caixas";
import { formatoPorId, mudarFormato } from "@/timeline/formatos";
import { AudioFaixa, Clipe, Insert, Timeline, Zoom } from "@/timeline/schema";
import { chaveCena, chaveInsert, itensDoPlano } from "./pendencias";
import { momentoDaFrase, palavrasDaNarracao, temposDasCenas } from "./tempos";
import { CenaPlano, PlanoGerado, PlanoSalvo } from "./tipos";

// Monta a edição a partir do plano, sem IA (determinístico e previsível):
// - cada cena entra quando a sua frase é dita na narração;
// - a transição de entrada "come" o fim da cena anterior, então a cena
//   anterior ganha esse tempo a mais para a próxima continuar no lugar;
// - take curto demais: a próxima cena entra antes (e fica um aviso);
// - o som de cada take entra por baixo da narração no volume do plano;
// - música, inserts, zooms e legendas seguindo o plano.
// Depois o usuário ajusta pelo chat ou na Timeline, como sempre.

const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

// Câmera lenta máxima para esticar um take curto (0,75× ainda parece
// natural; mais lento que isso fica estranho).
const LENTO_MINIMO = 0.75;
const limitar = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

// Volume do som de cada take conforme o modo de áudio do vídeo.
const VOLUME: Record<
  PlanoGerado["modo_audio"],
  Record<CenaPlano["volume_do_take"], number>
> = {
  narracao: { mudo: 0, ambiente: 0.25, efeito: 0.7, fala: 1 },
  fala_nos_takes: { mudo: 0, ambiente: 0.5, efeito: 0.9, fala: 1 },
  so_musica: { mudo: 0, ambiente: 0.5, efeito: 0.9, fala: 1 },
};

// Corte no começo de cada take do Higgsfield: os primeiros quadros
// costumam sair "travados".
const APARAR_INICIO = 0.2;

export type ResultadoMontagem = { timeline: Timeline; avisos: string[] };

export const montarDoPlano = (
  plano: PlanoSalvo,
  biblioteca: Midia[],
  base: Timeline,
): ResultadoMontagem => {
  const g = plano.gerado;
  if (!g) throw new Error("Ainda não há plano para montar.");
  const avisos: string[] = [];
  const itens = itensDoPlano(plano, biblioteca);
  const midiaDe = (chave: string) =>
    itens.find((i) => i.chave === chave)?.midia ?? null;

  const formato = formatoPorId(g.formato);
  let t: Timeline = mudarFormato(
    {
      ...base,
      clipes: [],
      inserts: [],
      audios: [],
      zooms: [],
      legendas: [],
    },
    formato.largura,
    formato.altura,
  );
  const fps = t.fps;

  // ---------- Narração (base do tempo) e início de cada cena ----------
  const narracao = g.modo_audio === "narracao" ? midiaDe("narracao") : null;
  // A narração entra inteira, do jeito que foi gravada (cortes de
  // respiros e trechos são pedidos depois pelo chat: cortar_trecho).
  const palavrasNarracao = palavrasDaNarracao(narracao);
  const cenas = g.cenas;
  const tempos = temposDasCenas(cenas, palavrasNarracao);
  const inicios = tempos.inicios;
  const fimTotal = tempos.fimTotal;
  if (tempos.naoAchadas.length) {
    avisos.push(
      `Não achei na narração a fala da${tempos.naoAchadas.length > 1 ? "s cenas" : " cena"} ${tempos.naoAchadas.join(", ")}: dividi o tempo pela duração prevista.`,
    );
  }

  // ---------- Trilha principal ----------
  const transicao = (c: CenaPlano | undefined, i: number) =>
    c && i > 0 && c.transicao_entrada && c.transicao_entrada.tipo !== "corte"
      ? limitar(c.transicao_entrada.duracao_s, 0.1, 1.5)
      : 0;
  const clipes: Clipe[] = [];
  // Índice do clipe de cada cena (-1 = cena que ficou de fora).
  const clipeDaCena: number[] = cenas.map(() => -1);
  // Tudo em quadros do vídeo final, mirando o momento ABSOLUTO em que a
  // próxima cena deve entrar (assim o arredondamento não se acumula).
  const quadros = (s: number) => Math.round(s * fps);
  let fimAnterior = 0; // quadro em que o clipe anterior termina
  cenas.forEach((c, i) => {
    const midia = midiaDe(chaveCena(c));
    if (!midia) {
      avisos.push(`Cena ${c.numero} sem arquivo: ficou de fora.`);
      return;
    }
    const entrada = clipes.length ? quadros(transicao(c, i)) : 0;
    const saida = quadros(transicao(cenas[i + 1], i + 1));
    const comeco = fimAnterior - entrada;
    // A próxima cena começa em (fim deste clipe - transição dela).
    const fimDesejado =
      quadros(i + 1 < cenas.length ? inicios[i + 1]! : fimTotal) + saida;
    const precisa = Math.max(quadros(0.5), fimDesejado - comeco) / fps;
    const ehImagem = midia.formato === "imagem";
    let inicio = 0;
    let disponivel = Infinity;
    if (!ehImagem) {
      const duracao = midia.duracao ?? precisa;
      if (c.origem === "banco") {
        inicio = limitar(c.trecho_banco_de ?? 0, 0, Math.max(0, duracao - 0.5));
        // O trecho indicado é o ideal; se a fala pedir mais tempo, o
        // clipe continua além dele (até o fim do arquivo) em vez de
        // adiantar a próxima cena. Se ainda faltar, recua o início.
        disponivel = duracao - inicio;
        if (disponivel < precisa && inicio > 0) {
          inicio = Math.max(0, duracao - precisa);
          disponivel = duracao - inicio;
        }
      } else {
        inicio = duracao - APARAR_INICIO >= precisa ? APARAR_INICIO : 0;
        disponivel = duracao - inicio;
      }
    }
    // Take um pouco curto: estica em câmera lenta (até LENTO_MINIMO) antes
    // de adiantar a próxima cena.
    const curto = !ehImagem && disponivel < precisa;
    const velocidade = curto
      ? Math.max(LENTO_MINIMO, Math.round((disponivel / precisa) * 1000) / 1000)
      : 1;
    const usa = Math.min(
      quadros(precisa),
      Math.floor((disponivel / velocidade) * fps),
    );
    // Até ~0,85× é o esperado (takes gerados sem folga, por economia).
    if (velocidade < 0.84) {
      avisos.push(
        `Cena ${c.numero}: o take tem ${r2(disponivel)}s para ${r2(precisa)}s de fala; estiquei em câmera lenta (${velocidade.toFixed(2).replace(".", ",")}×).`,
      );
    }
    const falta = r2(precisa - usa / fps);
    if (falta > 0.05) {
      avisos.push(
        i < cenas.length - 1
          ? `Cena ${c.numero}: o take tem ${r2(disponivel)}s e precisava de ${r2(precisa)}s; a próxima cena entra ${falta}s antes.`
          : `A última cena ficou ${falta}s mais curta que a narração: gere esse take com mais tempo (ou peça no chat para estender).`,
      );
    }
    fimAnterior = comeco + usa;
    clipes.push({
      url: midia.url,
      ...(ehImagem ? { tipo: "imagem" as const } : {}),
      inicio: r2(inicio),
      fim: r3(inicio + (usa / fps) * velocidade),
      ...(velocidade < 1 ? { velocidade } : {}),
      transicao:
        entrada > 0 && c.transicao_entrada ? c.transicao_entrada.tipo : "corte",
      ...(entrada > 0 ? { duracaoTransicao: entrada / fps } : {}),
      volume: ehImagem ? 0 : VOLUME[g.modo_audio][c.volume_do_take],
    });
    clipeDaCena[i] = clipes.length - 1;
  });
  t = { ...t, clipes };
  const duracaoVideo = calcularDuracaoTotal(calcularClipes(t)) / fps;

  // ---------- Áudio: narração e música ----------
  const audios: AudioFaixa[] = [];
  if (narracao) {
    audios.push({
      url: narracao.url,
      inicio: 0,
      fim: r2(Math.min(narracao.duracao ?? duracaoVideo, duracaoVideo)),
      origemInicio: 0,
      volume: 1,
      fadeEntrada: 0,
      fadeSaida: 0.1,
    });
  }
  const musica = g.musica.usar ? midiaDe("musica") : null;
  if (musica) {
    const padrao = g.modo_audio === "so_musica" ? 80 : 12;
    audios.push({
      url: musica.url,
      inicio: 0,
      fim: r2(Math.min(musica.duracao ?? duracaoVideo, duracaoVideo)),
      origemInicio: 0,
      volume: limitar(g.musica.volume_percent || padrao, 1, 100) / 100,
      fadeEntrada: 1,
      fadeSaida: 1.5,
    });
  }
  t = { ...t, audios };

  // Onde cada frase é dita no vídeo final.
  const palavrasDoVideo: PalavraFinal[] = narracao
    ? palavrasDaMidia(t, biblioteca, narracao)
    : g.modo_audio === "fala_nos_takes"
      ? palavrasNoVideoFinal(t, biblioteca)
      : [];

  // ---------- Inserts ----------
  const proporcaoVideo = t.largura / t.altura;
  const inserts: Insert[] = [];
  g.inserts.forEach((x, i) => {
    const midia = midiaDe(chaveInsert(x));
    if (!midia) {
      avisos.push(`Insert ${i + 1} (${x.apelido}) sem arquivo: ficou de fora.`);
      return;
    }
    const de = momentoDaFrase(palavrasDoVideo, x.frase);
    if (de === null) {
      avisos.push(
        `Insert ${i + 1} (${x.apelido}): não achei a frase “${x.frase}”; coloque pelo chat.`,
      );
      return;
    }
    const proporcaoMidia =
      midia.largura && midia.altura ? midia.largura / midia.altura : 16 / 9;
    const caixa = caixaParaPosicao(
      x.posicao,
      x.tamanho,
      proporcaoMidia,
      proporcaoVideo,
    );
    inserts.push({
      url: midia.url,
      tipo: midia.formato === "imagem" ? "imagem" : "video",
      inicio: r2(de),
      fim: r2(Math.min(duracaoVideo, de + limitar(x.duracao_s, 0.5, 15))),
      origemInicio:
        x.origem === "banco" ? Math.max(0, x.trecho_banco_de ?? 0) : 0,
      posicao: ehTelaCheia(caixa) ? "tela-cheia" : "janela",
      volume: 0,
      caixa,
    });
  });

  // ---------- Zooms ----------
  const zooms: Zoom[] = [];
  const inicioFinal = (() => {
    const lista: number[] = [];
    let cursor = 0;
    calcularClipes(t).forEach((c) => {
      cursor -= c.transicaoFrames;
      lista.push(cursor / fps);
      cursor += c.duracaoFrames;
    });
    return lista;
  })();
  cenas.forEach((c, i) => {
    if (!c.zoom) return;
    const comecoCena = inicioFinal[clipeDaCena[i]] ?? inicios[i] ?? 0;
    const de =
      momentoDaFrase(palavrasDoVideo, c.zoom.frase, comecoCena) ??
      comecoCena + 0.3;
    const rampa = limitar(c.zoom.rampa_s, 0.15, 3);
    zooms.push({
      inicio: r2(de),
      fim: r2(Math.min(duracaoVideo, de + Math.max(1.2, rampa * 2 + 0.4))),
      escala: limitar(c.zoom.escala, 1.05, 2.5),
      focoX: 50,
      focoY: 50,
      rampa,
    });
  });

  // ---------- Legendas ----------
  const legendas =
    g.legendas.usar && palavrasDoVideo.length
      ? gerarLegendas(
          palavrasDoVideo,
          limitar(Math.round(g.legendas.palavras_por_legenda), 1, 15),
        )
      : [];
  if (g.legendas.usar && !legendas.length) {
    avisos.push(
      "Sem fala transcrita para legendar: peça “legende o vídeo” no chat depois.",
    );
  }

  t = {
    ...t,
    inserts,
    zooms,
    legendas,
    estiloLegenda: g.legendas.estilo,
    aparenciaLegendas:
      g.legendas.tamanho_percent || g.legendas.posicao
        ? {
            ...(g.legendas.tamanho_percent
              ? { tamanho: limitar(g.legendas.tamanho_percent, 60, 200) / 100 }
              : {}),
            ...(g.legendas.posicao ? { posicao: g.legendas.posicao } : {}),
          }
        : undefined,
  };
  return { timeline: t, avisos };
};
