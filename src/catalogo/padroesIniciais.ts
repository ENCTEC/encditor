import { Camada } from "../timeline/schema";

// Padrões de animação que já vêm com o encEditor (motions "desenho"): a
// IA usa como estão (trocando textos e imagens) ou como exemplo para
// desenhar outros. Os salvos pela IA ficam na tabela "padroes"; com o
// mesmo nome, o salvo vale mais.

export type PadraoInicial = {
  nome: string;
  descricao: string;
  // Duração pensada (s); o motion pode durar mais.
  duracao: number;
  camadas: Camada[];
};

// Linha de um app (rótulo pequeno cinza) dentro da tela do celular.
const rotulo = (texto: string, y: number, entra: number): Camada => ({
  tipo: "texto",
  dentro: 1,
  x: 50,
  y,
  l: 86,
  a: 7,
  texto,
  fonte: "interface",
  peso: 600,
  tamanho: 2.2,
  cor: "#6B6B7B",
  alinhar: "esquerda",
  entra,
});

export const PADROES_INICIAIS: PadraoInicial[] = [
  {
    nome: "celular-simulacao",
    descricao:
      "Celular com o app do banco simulando um financiamento: valor do imóvel contando, barra do percentual financiado enchendo, parcela contando, dedo tocando em SIMULAR e o carimbo ✓ APROVADO. Troque os textos e números pelos da fala.",
    duracao: 4,
    camadas: [
      { tipo: "caixa", x: 50, y: 52, l: 38, a: 76, cor: "#15151F", borda: "#3A3A4C", espessura: 0.35, cantos: 5.5, sombra: true, efeito: "sobe" },
      { tipo: "caixa", dentro: 0, x: 50, y: 50, l: 92, a: 95, cor: "#FFFFFF", cantos: 4, recorta: true },
      { tipo: "caixa", dentro: 1, x: 50, y: 8, l: 100, a: 16, cor: "paleta2", cantos: 0 },
      { tipo: "texto", dentro: 2, x: 50, y: 55, l: 90, a: 70, texto: "Simulação", fonte: "interface", peso: 700, tamanho: 2.6, cor: "#FFFFFF" },
      rotulo("Valor do imóvel", 24, 0.3),
      { tipo: "texto", dentro: 1, x: 50, y: 31, l: 86, a: 8, conta: { de: 0, ate: 500000, antes: "R$ ", duracao: 1 }, fonte: "interface", peso: 700, tamanho: 3.2, cor: "#15151F", alinhar: "esquerda", entra: 0.4 },
      rotulo("Financiado", 42, 0.7),
      { tipo: "caixa", dentro: 1, x: 50, y: 49, l: 86, a: 3, cor: "#E6E6EE", cantos: 1, entra: 0.75 },
      { tipo: "caixa", dentro: 7, x: 45, y: 50, l: 90, a: 100, cor: "degrade", cantos: 1, efeito: "cresce", entra: 0.9 },
      { tipo: "texto", dentro: 1, x: 50, y: 56, l: 86, a: 7, texto: "90% do valor", fonte: "interface", peso: 700, tamanho: 2, cor: "paleta2", alinhar: "esquerda", entra: 1.1 },
      rotulo("Parcela estimada", 65, 1.2),
      { tipo: "texto", dentro: 1, x: 50, y: 72, l: 86, a: 8, conta: { de: 0, ate: 4380, antes: "R$ ", depois: "/mês", duracao: 0.9 }, fonte: "interface", peso: 700, tamanho: 3, cor: "#15151F", alinhar: "esquerda", entra: 1.3 },
      { tipo: "caixa", dentro: 1, x: 50, y: 87, l: 80, a: 9, cor: "degrade", cantos: 2.5, efeito: "zoom", entra: 1.4 },
      { tipo: "texto", dentro: 12, x: 50, y: 50, l: 90, a: 80, texto: "SIMULAR", fonte: "interface", peso: 700, tamanho: 2.3, cor: "#FFFFFF" },
      { tipo: "emoji", dentro: 1, x: 66, y: 97, l: 16, a: 12, texto: "👆", efeito: "sobe", entra: 1.8, move: { de: 2, ate: 2.2, y: 90 } },
      { tipo: "caixa", dentro: 1, x: 50, y: 47, l: 86, a: 20, cor: "#FFFFFF", borda: "paleta1", espessura: 0.7, cantos: 3, rotacao: -8, sombra: true, efeito: "pula", entra: 2.4 },
      { tipo: "texto", dentro: 15, x: 50, y: 52, l: 95, a: 80, texto: "✓ APROVADO", tamanho: 3.4, cor: "paleta1" },
    ],
  },
  {
    nome: "comparativo-bancos",
    descricao:
      "Cartão com o título e 4 linhas (banco + barra enchendo + número), o vencedor com brilho e 🏆. Troque os nomes dos bancos, os números (texto e largura da barra, 0 a 100) e o título.",
    duracao: 3.5,
    camadas: [
      { tipo: "caixa", x: 50, y: 56, l: 84, a: 56, cantos: 3, sombra: true, efeito: "sobe" },
      { tipo: "texto", dentro: 0, x: 50, y: 13, l: 90, a: 14, texto: "Quem financia *mais*?", tamanho: 3.4 },
      ...[
        { banco: "ITAÚ", valor: "45%", largura: 45, y: 33 },
        { banco: "BRADESCO", valor: "70%", largura: 70, y: 50 },
        { banco: "INTER", valor: "80%", largura: 80, y: 67 },
        { banco: "SANTANDER", valor: "90%", largura: 92, y: 84 },
      ].flatMap(({ banco, valor, largura, y }, i): Camada[] => [
        { tipo: "texto", dentro: 0, x: 19, y, l: 24, a: 12, texto: banco, fonte: "interface", peso: 700, tamanho: 2.1, alinhar: "esquerda", entra: 0.3 + i * 0.25 },
        { tipo: "caixa", dentro: 0, x: 58, y, l: 52, a: 8, cor: "texto", opacidade: 0.12, cantos: 1.6, entra: 0.3 + i * 0.25 },
        { tipo: "caixa", dentro: 0, x: 32 + (52 * largura) / 200, y, l: (52 * largura) / 100, a: 8, cor: "degrade", cantos: 1.6, efeito: "cresce", entra: 0.45 + i * 0.25, ...(i === 3 ? { brilho: true } : {}) },
        { tipo: "texto", dentro: 0, x: 92, y, l: 14, a: 12, texto: valor, tamanho: 2.6, entra: 0.8 + i * 0.25, efeito: "zoom" },
      ]),
      { tipo: "emoji", dentro: 0, x: 3.5, y: 84, l: 5.5, a: 5.5, texto: "🏆", efeito: "pula", entra: 1.9, repete: "balanca" },
    ],
  },
  {
    nome: "contrato-aprovado",
    descricao:
      "Contrato de papel: as linhas se escrevem, a assinatura se desenha e o carimbo APROVADO bate no canto. Troque o título e o carimbo.",
    duracao: 3,
    camadas: [
      { tipo: "caixa", x: 50, y: 55, l: 46, a: 62, cor: "#FFFFFF", cantos: 1.5, sombra: true, rotacao: -3, efeito: "sobe" },
      { tipo: "texto", dentro: 0, x: 50, y: 11, l: 86, a: 10, texto: "CONTRATO", tamanho: 3, cor: "#15151F" },
      ...[24, 32, 40, 48, 56].map(
        (y, i): Camada => ({ tipo: "caixa", dentro: 0, x: i === 4 ? 37 : 50, y, l: i === 4 ? 54 : 80, a: 2.2, cor: "#D9D9E3", cantos: 1, efeito: "desenha", entra: 0.3 + i * 0.12 }),
      ),
      { tipo: "traco", dentro: 0, x: 36, y: 76, l: 50, a: 14, d: "M5 70 C 20 10, 30 90, 45 40 S 70 20, 95 55", cor: "paleta2", espessura: 0.5, efeito: "desenha", entra: 1.1 },
      { tipo: "caixa", dentro: 0, x: 70, y: 74, l: 50, a: 16, cor: "rgba(255, 255, 255, 0)", borda: "paleta1", espessura: 0.8, cantos: 2, rotacao: -14, efeito: "pula", entra: 1.8 },
      { tipo: "texto", dentro: 8, x: 50, y: 52, l: 95, a: 80, texto: "APROVADO", tamanho: 3.4, cor: "paleta1" },
    ],
  },
  {
    nome: "casa-chave",
    descricao:
      "Uma casa se desenhando em traço, a chave 🔑 pulando ao lado e o texto embaixo. Para imóvel, compra, 'sua casa própria'. Troque o texto.",
    duracao: 3,
    camadas: [
      { tipo: "circulo", x: 50, y: 44, l: 52, a: 52, cor: "paleta1", opacidade: 0.14, efeito: "zoom" },
      { tipo: "traco", x: 50, y: 44, l: 40, a: 40, d: "M8 52 L50 12 L92 52 M18 44 L18 92 L82 92 L82 44 M41 92 L41 66 L59 66 L59 92", cor: "paleta1", espessura: 1, efeito: "desenha", entra: 0.1 },
      { tipo: "emoji", x: 68, y: 56, l: 13, a: 13, texto: "🔑", efeito: "pula", entra: 1, repete: "balanca" },
      { tipo: "texto", x: 50, y: 66, l: 80, a: 12, texto: "Sua *casa própria*", tamanho: 6.5, efeito: "sobe", entra: 0.7 },
    ],
  },
];
