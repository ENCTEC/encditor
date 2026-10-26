import {
  EFEITOS_VISUAIS,
  FUNDOS,
  MOTIONS,
  somPorArquivo,
} from "@/catalogo/estilos";
import { Midia } from "@/projeto/tipos";
import { calcularClipes, inicioDosClipes } from "@/timeline/calculos";
import { ehEfeitoSonoro, Faixa } from "@/timeline/operacoes";
import { estiloDoFundo, Timeline } from "@/timeline/schema";

// Converte a timeline em "blocos" para desenhar: cada item com sua posição
// (em segundos) na timeline FINAL e um rótulo legível.

export type Bloco = {
  faixa: Faixa;
  indice: number;
  inicio: number;
  fim: number;
  rotulo: string;
};

export const FAIXAS_VISUAIS: { faixa: Faixa; rotulo: string; cor: string }[] = [
  { faixa: "clipes", rotulo: "Cenas", cor: "bg-violet-600 border-violet-400" },
  { faixa: "inserts", rotulo: "Inserts", cor: "bg-sky-700 border-sky-400" },
  {
    faixa: "audios",
    rotulo: "Áudio",
    cor: "bg-emerald-700 border-emerald-400",
  },
  { faixa: "zooms", rotulo: "Zoom", cor: "bg-amber-700 border-amber-400" },
  {
    faixa: "efeitos",
    rotulo: "Efeitos",
    cor: "bg-indigo-700 border-indigo-400",
  },
  {
    faixa: "motions",
    rotulo: "Motion",
    cor: "bg-yellow-600 border-yellow-300",
  },
  { faixa: "legendas", rotulo: "Legendas", cor: "bg-pink-700 border-pink-400" },
];

// Linhas desenhadas na Timeline: uma por faixa, mas os áudios ganham uma
// linha por ARQUIVO ("Áudio 1 — narração", "Áudio 2 — música"); os
// pedaços do mesmo arquivo ficam na mesma linha. Os efeitos sonoros do
// encEditor (whoosh, pop…) ficam todos juntos numa linha "Sons".
export type Linha = {
  chave: string;
  faixa: Faixa;
  rotulo: string;
  cor: string;
  blocos: Bloco[];
};

const CORES_AUDIO = [
  "bg-emerald-700 border-emerald-400",
  "bg-teal-700 border-teal-400",
  "bg-lime-800 border-lime-500",
  "bg-green-800 border-green-500",
];

export const linhasDaTimeline = (
  t: Timeline,
  blocos: Record<Faixa, Bloco[]>,
  biblioteca: Midia[],
): Linha[] =>
  FAIXAS_VISUAIS.flatMap(({ faixa, rotulo, cor }): Linha[] => {
    if (faixa !== "audios" || !t.audios.length) {
      return [{ chave: faixa, faixa, rotulo, cor, blocos: blocos[faixa] }];
    }
    const urls = [
      ...new Set(t.audios.map((a) => a.url).filter((u) => !ehEfeitoSonoro(u))),
    ];
    const sons = blocos.audios.filter((b) =>
      ehEfeitoSonoro(t.audios[b.indice].url),
    );
    const linhaDeSons: Linha[] = sons.length
      ? [
          {
            chave: "audio:sons",
            faixa,
            rotulo: "Sons (efeitos)",
            cor: "bg-stone-600 border-stone-400",
            blocos: sons,
          },
        ]
      : [];
    return [
      ...urls.map((url, n) => {
        const midia = biblioteca.find((m) => m.url === url);
        const nome = midia?.apelido ? `@${midia.apelido}` : (midia?.nome ?? "");
        return {
          chave: `audio:${url}`,
          faixa,
          rotulo: `Áudio ${n + 1}${nome ? ` — ${nome}` : ""}`,
          cor: CORES_AUDIO[n % CORES_AUDIO.length],
          blocos: blocos.audios.filter((b) => t.audios[b.indice].url === url),
        };
      }),
      ...linhaDeSons,
    ];
  });

export const calcularBlocos = (
  t: Timeline,
  biblioteca: Midia[],
): Record<Faixa, Bloco[]> => {
  const nomePorUrl = (url: string) =>
    biblioteca.find((m) => m.url === url)?.nome;

  const clipes = calcularClipes(t);
  const inicios = inicioDosClipes(clipes);

  return {
    clipes: clipes.map((c, i) => ({
      faixa: "clipes",
      indice: i,
      inicio: inicios[i] / t.fps,
      fim: (inicios[i] + c.duracaoFrames) / t.fps,
      rotulo:
        c.tipo === "fundo"
          ? `Fundo ${FUNDOS.find((f) => f.id === estiloDoFundo(c.url))?.nome ?? ""}`
          : (nomePorUrl(c.url) ?? `Clipe ${i + 1}`),
    })),
    inserts: t.inserts.map((x, i) => ({
      faixa: "inserts",
      indice: i,
      inicio: x.inicio,
      fim: x.fim,
      rotulo: nomePorUrl(x.url) ?? `Insert ${i + 1}`,
    })),
    audios: t.audios.map((x, i) => {
      const som = somPorArquivo(x.url);
      if (som) {
        return {
          faixa: "audios",
          indice: i,
          inicio: x.inicio,
          fim: x.fim,
          rotulo: som.nome,
        };
      }
      const apelido = biblioteca.find((m) => m.url === x.url)?.apelido;
      return {
        faixa: "audios",
        indice: i,
        inicio: x.inicio,
        fim: x.fim,
        // O mesmo arquivo pode estar em vários pedaços: mostra de que
        // segundo do arquivo cada um começa.
        rotulo: `${apelido ? `@${apelido}` : (nomePorUrl(x.url) ?? `Áudio ${i + 1}`)} · desde ${x.origemInicio.toFixed(1)}s`,
      };
    }),
    zooms: t.zooms.map((x, i) => ({
      faixa: "zooms",
      indice: i,
      inicio: x.inicio,
      fim: x.fim,
      rotulo: `Zoom ${x.escala}x`,
    })),
    legendas: t.legendas.map((x, i) => ({
      faixa: "legendas",
      indice: i,
      inicio: x.inicio,
      fim: x.fim,
      rotulo: x.texto,
    })),
    motions: (t.motions ?? []).map((x, i) => ({
      faixa: "motions",
      indice: i,
      inicio: x.inicio,
      fim: x.fim,
      rotulo: `${MOTIONS.find((m) => m.id === x.modelo)?.nome ?? x.modelo}: ${x.texto.replace(/\*/g, "")}`,
    })),
    efeitos: (t.efeitos ?? []).map((x, i) => ({
      faixa: "efeitos",
      indice: i,
      inicio: x.inicio,
      fim: x.fim,
      rotulo: EFEITOS_VISUAIS.find((e) => e.id === x.tipo)?.nome ?? x.tipo,
    })),
  };
};
