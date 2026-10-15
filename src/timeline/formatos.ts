import {
  Caixa,
  caixaDoLayout,
  caixaPadrao,
  ehTelaCheia,
  LAYOUTS,
  limitarCaixa,
} from "./caixas";
import { Timeline } from "./schema";

// Proporções de vídeo disponíveis (editor, IA e exportação).
export const FORMATOS = [
  {
    id: "9:16",
    nome: "Vertical (Reels, TikTok, Stories)",
    largura: 1080,
    altura: 1920,
  },
  { id: "16:9", nome: "Horizontal (YouTube)", largura: 1920, altura: 1080 },
  { id: "1:1", nome: "Quadrado (feed)", largura: 1080, altura: 1080 },
  {
    id: "4:5",
    nome: "Retrato (feed do Instagram)",
    largura: 1080,
    altura: 1350,
  },
] as const;

export type IdFormato = (typeof FORMATOS)[number]["id"];
export const IDS_FORMATO = FORMATOS.map((f) => f.id) as [
  IdFormato,
  ...IdFormato[],
];

export const formatoPorId = (id: IdFormato) =>
  FORMATOS.find((f) => f.id === id)!;

// Formato atual da timeline (null se for um tamanho fora da lista).
export const formatoDaTimeline = (t: Timeline): IdFormato | null =>
  FORMATOS.find(
    (f) => Math.abs(f.largura / f.altura - t.largura / t.altura) < 0.01,
  )?.id ?? null;

const MARGEM_MAX = 92;

// Insert em janela (num canto, no centro...): mantém o FORMATO da caixa
// (proporção em pixels) e o centro dela. Sem isso, a mesma caixa em % viraria
// outro retângulo no vídeo novo e a imagem do insert seria cortada.
// Tela cheia e metades (tela dividida) acompanham o vídeo como estão.
const adaptarCaixa = (
  c: Caixa,
  de: { largura: number; altura: number },
  para: { largura: number; altura: number },
): Caixa => {
  const ehLayout = LAYOUTS.some((l) => {
    const d = caixaDoLayout(l);
    return (
      Math.abs(d.x - c.x) < 0.5 &&
      Math.abs(d.y - c.y) < 0.5 &&
      Math.abs(d.largura - c.largura) < 0.5 &&
      Math.abs(d.altura - c.altura) < 0.5
    );
  });
  if (ehLayout || ehTelaCheia(c)) return c;
  // Proporção da caixa em pixels no vídeo de origem e a fração da tela que
  // ela ocupa: as duas se mantêm no vídeo novo (um canto de 9% da tela
  // continua com 9%, seja vertical ou horizontal).
  const proporcao = (c.largura * de.largura) / (c.altura * de.altura);
  const area = c.largura * c.altura;
  let largura = Math.sqrt((area * proporcao * para.altura) / para.largura);
  let altura = area / largura;
  if (altura > MARGEM_MAX) {
    altura = MARGEM_MAX;
    largura = (altura * proporcao * para.altura) / para.largura;
  }
  if (largura > MARGEM_MAX) {
    largura = MARGEM_MAX;
    altura = (largura * para.largura) / (proporcao * para.altura);
  }
  const cx = c.x + c.largura / 2;
  const cy = c.y + c.altura / 2;
  return limitarCaixa({
    largura,
    altura,
    x: cx - largura / 2,
    y: cy - altura / 2,
  });
};

// Muda a proporção do vídeo ajustando as caixas dos inserts.
export const mudarFormato = (
  t: Timeline,
  largura: number,
  altura: number,
): Timeline => {
  const de = { largura: t.largura, altura: t.altura };
  const para = { largura, altura };
  return {
    ...t,
    largura,
    altura,
    inserts: t.inserts.map((i) => {
      // Inserts antigos, sem caixa, usam a janela padrão.
      const caixa =
        i.caixa ?? (i.posicao === "janela" ? caixaPadrao("janela") : null);
      return caixa ? { ...i, caixa: adaptarCaixa(caixa, de, para) } : i;
    }),
  };
};
