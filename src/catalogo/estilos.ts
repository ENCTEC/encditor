import { EstiloLegenda, TipoTransicao } from "@/timeline/schema";

// Catálogo de transições e estilos de legenda: o mesmo texto aparece no
// menu "Estilos", nas sugestões do "#" no chat e nas instruções da IA.

export type ItemCatalogo<Id extends string> = {
  id: Id;
  // Como citar no chat: "#fade".
  tag: string;
  nome: string;
  descricao: string;
  quandoUsar: string;
};

export const TRANSICOES: ItemCatalogo<TipoTransicao>[] = [
  {
    id: "corte",
    tag: "#corte",
    nome: "Corte seco",
    descricao: "Troca direta, sem efeito.",
    quandoUsar: "Ritmo rápido, falas, cortes de reels.",
  },
  {
    id: "fade",
    tag: "#fade",
    nome: "Fade",
    descricao: "Uma cena se dissolve na outra.",
    quandoUsar: "Passagem de tempo, clima calmo ou emocional.",
  },
  {
    id: "slide",
    tag: "#slide",
    nome: "Slide",
    descricao: "A cena nova entra empurrando a antiga para fora.",
    quandoUsar: "Sequências, listas, 'próximo item'. Aceita direção.",
  },
  {
    id: "cortina",
    tag: "#cortina",
    nome: "Cortina",
    descricao: "A cena nova é revelada passando por cima da antiga.",
    quandoUsar: "Revelar um produto ou um antes/depois. Aceita direção.",
  },
  {
    id: "virar",
    tag: "#virar",
    nome: "Virar",
    descricao: "A tela gira como uma carta e mostra a cena nova.",
    quandoUsar: "Mudança de assunto, comparação, efeito lúdico.",
  },
  {
    id: "relogio",
    tag: "#relogio",
    nome: "Relógio",
    descricao: "A cena nova aparece em círculo, como um ponteiro.",
    quandoUsar: "Passagem de tempo, contagem, 'enquanto isso'.",
  },
  {
    id: "iris",
    tag: "#iris",
    nome: "Íris",
    descricao: "Um círculo abre do centro revelando a cena nova.",
    quandoUsar: "Abertura, foco num detalhe, estilo retrô.",
  },
  {
    id: "impacto",
    tag: "#impacto",
    nome: "Impacto",
    descricao: "Corte com zoom rápido e flash.",
    quandoUsar: "Momentos fortes, revelação, batida da música.",
  },
];

export const ESTILOS_LEGENDA: ItemCatalogo<EstiloLegenda>[] = [
  {
    id: "classico",
    tag: "#classico",
    nome: "Clássico",
    descricao: "Frase inteira em caixa escura, entra e sai suave.",
    quandoUsar: "Vídeos explicativos, entrevistas, acessibilidade.",
  },
  {
    id: "karaoke",
    tag: "#karaoke",
    nome: "Karaokê",
    descricao:
      "A frase aparece inteira e cada palavra acende em amarelo quando é falada.",
    quandoUsar: "Reels e TikTok com fala: prende a atenção.",
  },
  {
    id: "pop",
    tag: "#pop",
    nome: "Pop",
    descricao: "Cada palavra salta na tela no momento em que é falada.",
    quandoUsar: "Conteúdo energético, humor, cortes rápidos.",
  },
  {
    id: "destaque",
    tag: "#destaque",
    nome: "Destaque",
    descricao:
      "Palavras em caixa alta; a palavra falada ganha uma faixa vermelha atrás.",
    quandoUsar: "Vendas, chamadas fortes, estilo 'creator'.",
  },
  {
    id: "gigante",
    tag: "#gigante",
    nome: "Gigante",
    descricao:
      "Letras enormes e condensadas no meio da tela, com batida de entrada.",
    quandoUsar: "Frases de impacto, títulos, ganchos no começo.",
  },
  {
    id: "spray",
    tag: "#spray",
    nome: "Spray",
    descricao:
      "Texto pintado à mão em vermelho, que se desenha da esquerda para a direita.",
    quandoUsar: "Estética urbana/zine, combina com a cara do encEditor.",
  },
  {
    id: "maquina",
    tag: "#maquina",
    nome: "Máquina de escrever",
    descricao: "Letras surgem uma a uma, com cursor piscando.",
    quandoUsar: "Suspense, citações, bastidores, tom documental.",
  },
  {
    id: "neon",
    tag: "#neon",
    nome: "Neon",
    descricao: "Texto brilhante que acende piscando como letreiro.",
    quandoUsar: "Noite, festa, música, tecnologia.",
  },
];

// Texto do catálogo para as instruções da IA.
export const catalogoParaIA = () =>
  [
    "Transições (cite com #):",
    ...TRANSICOES.map(
      (t) => `- ${t.tag} = ${t.nome}: ${t.descricao} Uso: ${t.quandoUsar}`,
    ),
    "Estilos de legenda (cite com #):",
    ...ESTILOS_LEGENDA.map(
      (e) => `- ${e.tag} = ${e.nome}: ${e.descricao} Uso: ${e.quandoUsar}`,
    ),
    "Efeitos de áudio (cite com #; use a ferramenta efeitos_de_audio):",
    ...EFEITOS_AUDIO.map(
      (e) => `- ${e.tag} = ${e.nome}: ${e.descricao} Uso: ${e.quandoUsar}`,
    ),
  ].join("\n");

// Efeitos de áudio (processados no servidor com ffmpeg; ver
// src/servidor/efeitos.ts). Valem para áudios e para o som de vídeos.
export const EFEITOS_AUDIO = [
  {
    id: "normalizar",
    tag: "#normalizar",
    nome: "Normalizar volume",
    descricao:
      "Deixa o volume no nível padrão das redes, sem partes baixas demais.",
    quandoUsar: "Sempre que juntar arquivos gravados em volumes diferentes.",
  },
  {
    id: "sem-ruido",
    tag: "#sem-ruido",
    nome: "Sem ruído",
    descricao: "Reduz chiado, vento e barulho de fundo constante.",
    quandoUsar:
      "Gravações de celular, ambientes com ventilador ou ar-condicionado.",
  },
  {
    id: "voz-clara",
    tag: "#voz-clara",
    nome: "Voz clara",
    descricao: "Realça a voz, tira o 'embolado' e equilibra o volume da fala.",
    quandoUsar: "Narração, falas para câmera, podcasts.",
  },
  {
    id: "radio",
    tag: "#radio",
    nome: "Rádio",
    descricao: "Som de rádio antigo: médio, comprimido e sem graves.",
    quandoUsar: "Efeito retrô, flashback, narração estilizada.",
  },
  {
    id: "telefone",
    tag: "#telefone",
    nome: "Telefone",
    descricao: "Voz fina, como numa ligação.",
    quandoUsar: "Simular ligação, mensagem de voz, voz 'de fora'.",
  },
  {
    id: "eco",
    tag: "#eco",
    nome: "Eco",
    descricao: "Repetição da voz, como num vale.",
    quandoUsar: "Momentos dramáticos, sonho, ênfase numa frase.",
  },
  {
    id: "reverb",
    tag: "#reverb",
    nome: "Reverb",
    descricao: "Ambiência de sala grande ou igreja.",
    quandoUsar: "Dar profundidade, clima épico ou intimista.",
  },
  {
    id: "grave",
    tag: "#grave",
    nome: "Mais grave",
    descricao: "Reforça os graves (voz mais encorpada, batida mais forte).",
    quandoUsar: "Voz de locutor, músicas com batida, trailer.",
  },
] as const satisfies readonly ItemCatalogo<string>[];

export type EfeitoAudio = (typeof EFEITOS_AUDIO)[number]["id"];
export const IDS_EFEITOS_AUDIO = EFEITOS_AUDIO.map((e) => e.id) as [
  EfeitoAudio,
  ...EfeitoAudio[],
];
