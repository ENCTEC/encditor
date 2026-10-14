// Posição e tamanho de um insert na tela ("caixa"), em % do vídeo final:
// x/y = canto superior esquerdo; largura/altura = tamanho. Em % para o
// mesmo layout funcionar em 16:9, 9:16 ou 1:1.

export type Caixa = { x: number; y: number; largura: number; altura: number };

export type AcabamentoCaixa = {
  borda: boolean;
  cantos: boolean;
  sombra: boolean;
};

export const POSICOES = [
  "canto-sup-esq",
  "topo",
  "canto-sup-dir",
  "esquerda",
  "centro",
  "direita",
  "canto-inf-esq",
  "base",
  "canto-inf-dir",
] as const;
export type PosicaoGrade = (typeof POSICOES)[number];

export const LAYOUTS = [
  "tela-cheia",
  "metade-esquerda",
  "metade-direita",
  "metade-cima",
  "metade-baixo",
] as const;
export type Layout = (typeof LAYOUTS)[number];

// Largura (em % do vídeo) de cada tamanho pronto.
export const TAMANHOS = { P: 25, M: 40, G: 60 } as const;
export type Tamanho = keyof typeof TAMANHOS;

const MARGEM = 4;
const r1 = (n: number) => Math.round(n * 10) / 10;

export const limitarCaixa = (c: Caixa): Caixa => {
  const largura = Math.min(100, Math.max(5, c.largura));
  const altura = Math.min(100, Math.max(5, c.altura));
  return {
    largura: r1(largura),
    altura: r1(altura),
    x: r1(Math.min(100 - largura, Math.max(0, c.x))),
    y: r1(Math.min(100 - altura, Math.max(0, c.y))),
  };
};

// Altura em % que mantém a proporção da mídia para uma largura em %.
// proporcaoMidia e proporcaoVideo = largura / altura.
export const alturaProporcional = (
  largura: number,
  proporcaoMidia: number,
  proporcaoVideo: number,
) => (largura * proporcaoVideo) / proporcaoMidia;

// Encaixa uma caixa de certa largura numa posição da grade 3×3.
export const caixaNaGrade = (
  posicao: PosicaoGrade,
  largura: number,
  proporcaoMidia: number,
  proporcaoVideo: number,
): Caixa => {
  let l = largura;
  let a = alturaProporcional(l, proporcaoMidia, proporcaoVideo);
  // Mídia muito "alta" (ex.: vertical em vídeo deitado): limita pela altura.
  if (a > 100 - 2 * MARGEM) {
    a = 100 - 2 * MARGEM;
    l = (a * proporcaoMidia) / proporcaoVideo;
  }
  const i = POSICOES.indexOf(posicao);
  const coluna = i % 3;
  const linha = Math.floor(i / 3);
  const x = [MARGEM, (100 - l) / 2, 100 - l - MARGEM][coluna];
  const y = [MARGEM, (100 - a) / 2, 100 - a - MARGEM][linha];
  return limitarCaixa({ x, y, largura: l, altura: a });
};

export const caixaDoLayout = (layout: Layout): Caixa =>
  ({
    "tela-cheia": { x: 0, y: 0, largura: 100, altura: 100 },
    "metade-esquerda": { x: 0, y: 0, largura: 50, altura: 100 },
    "metade-direita": { x: 50, y: 0, largura: 50, altura: 100 },
    "metade-cima": { x: 0, y: 0, largura: 100, altura: 50 },
    "metade-baixo": { x: 0, y: 50, largura: 100, altura: 50 },
  })[layout];

// Redimensiona mantendo o centro (scroll do mouse no popup).
export const redimensionar = (c: Caixa, fator: number): Caixa => {
  const largura = c.largura * fator;
  const altura = c.altura * fator;
  return limitarCaixa({
    largura,
    altura,
    x: c.x + (c.largura - largura) / 2,
    y: c.y + (c.altura - altura) / 2,
  });
};

// Caixa equivalente às posições antigas ("tela-cheia" / "janela").
export const caixaPadrao = (posicao: "tela-cheia" | "janela"): Caixa =>
  posicao === "tela-cheia"
    ? caixaDoLayout("tela-cheia")
    : { x: 62, y: 5, largura: 34, altura: 34 };

export const ehTelaCheia = (c: Caixa) =>
  c.x <= 0.5 && c.y <= 0.5 && c.largura >= 99.5 && c.altura >= 99.5;
