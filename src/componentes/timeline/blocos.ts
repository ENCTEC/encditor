import { Midia } from "@/projeto/tipos";
import { calcularClipes, inicioDosClipes } from "@/timeline/calculos";
import { Faixa } from "@/timeline/operacoes";
import { Timeline } from "@/timeline/schema";

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
  { faixa: "legendas", rotulo: "Legendas", cor: "bg-pink-700 border-pink-400" },
];

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
      rotulo: nomePorUrl(c.url) ?? `Clipe ${i + 1}`,
    })),
    inserts: t.inserts.map((x, i) => ({
      faixa: "inserts",
      indice: i,
      inicio: x.inicio,
      fim: x.fim,
      rotulo: nomePorUrl(x.url) ?? `Insert ${i + 1}`,
    })),
    audios: t.audios.map((x, i) => ({
      faixa: "audios",
      indice: i,
      inicio: x.inicio,
      fim: x.fim,
      rotulo: nomePorUrl(x.url) ?? `Áudio ${i + 1}`,
    })),
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
  };
};
