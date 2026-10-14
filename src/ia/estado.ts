import { Midia } from "@/projeto/tipos";
import {
  calcularClipes,
  calcularDuracaoTotal,
  inicioDosClipes,
} from "@/timeline/calculos";
import { Timeline } from "@/timeline/schema";

// Descreve o projeto para o Claude em termos humanos: números começando
// em 1, tempos em segundos na timeline FINAL e nomes da biblioteca
// ("Cena 2", "Insert 1") no lugar de URLs.

const s = (n: number) => Math.round(n * 100) / 100;

export const resumoDoProjeto = (t: Timeline, biblioteca: Midia[]) => {
  const nome = (url: string) =>
    biblioteca.find((m) => m.url === url)?.nome ?? "(arquivo sem nome)";
  const clipes = calcularClipes(t);
  const inicios = inicioDosClipes(clipes);

  return {
    formato: `${t.largura}x${t.altura}`,
    fps: t.fps,
    duracao_total_s: s(calcularDuracaoTotal(clipes) / t.fps),
    duracao_padrao_transicao_s: t.duracaoTransicao,
    estilo_das_legendas: t.estiloLegenda ?? "classico",
    aparencia_das_legendas: t.aparenciaLegendas ?? "padrão do estilo",
    cenas: clipes.map((c, i) => ({
      cena: i + 1,
      arquivo: nome(c.url),
      ...(c.tipo === "imagem" ? { tipo: "imagem" } : {}),
      no_video_final: {
        de: s(inicios[i] / t.fps),
        ate: s((inicios[i] + c.duracaoFrames) / t.fps),
      },
      trecho_do_arquivo: { de: c.inicio, ate: c.fim },
      transicao_de_entrada: c.transicao,
      ...(c.direcao ? { direcao: c.direcao } : {}),
      ...(c.duracaoTransicao !== undefined
        ? { duracao_transicao_s: c.duracaoTransicao }
        : {}),
      volume: c.volume,
    })),
    inserts: t.inserts.map((x, i) => ({
      numero: i + 1,
      arquivo: nome(x.url),
      tipo: x.tipo,
      de: x.inicio,
      ate: x.fim,
      posicao: x.posicao,
      ...(x.caixa ? { caixa_percent: x.caixa } : {}),
      comeca_no_segundo_do_arquivo: x.origemInicio,
      volume: x.volume,
    })),
    audios: t.audios.map((x, i) => ({
      numero: i + 1,
      arquivo: nome(x.url),
      de: x.inicio,
      ate: x.fim,
      comeca_no_segundo_do_arquivo: x.origemInicio,
      volume: x.volume,
      fade_entrada_s: x.fadeEntrada,
      fade_saida_s: x.fadeSaida,
    })),
    zooms: t.zooms.map((x, i) => ({
      numero: i + 1,
      de: x.inicio,
      ate: x.fim,
      escala: x.escala,
      foco_x: x.focoX,
      foco_y: x.focoY,
      ...(x.rampa !== undefined ? { rampa_s: x.rampa } : {}),
    })),
    legendas: t.legendas.map((x, i) => ({
      numero: i + 1,
      texto: x.texto,
      ...(x.estilo ? { estilo: x.estilo } : {}),
      de: x.inicio,
      ate: x.fim,
    })),
    biblioteca: biblioteca.map((m) => ({
      nome: m.nome,
      apelido: `@${m.apelido}`,
      papel: m.papel,
      formato: m.formato,
      duracao_s: m.duracao !== null ? s(m.duracao) : null,
      arquivo_original: m.nomeArquivo,
      ...(m.efeitosAudio?.length
        ? { efeitos_de_audio: m.efeitosAudio.map((x) => "#" + x) }
        : {}),
      analise:
        m.analise?.status === "pronta"
          ? {
              tem_fala: Boolean(m.analise.transcricao),
              ...(m.analise.visual
                ? { conteudo: m.analise.visual.resumo }
                : {}),
            }
          : m.usarIA === false
            ? "sem_analise (arquivo frio)"
            : (m.analise?.status ?? "nao_analisado"),
    })),
  };
};
