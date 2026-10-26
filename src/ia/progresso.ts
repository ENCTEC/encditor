// Barra de progresso do chat: o que a IA está fazendo, em português, e
// quanto falta (0 a 100). O pedido passa por fases (editar, conferir,
// gerar quadros, olhar os quadros); cada etapa da IA anda um pedaço da
// faixa da fase (30% do que falta), então a barra sempre se mexe e nunca
// volta.

const ROTULOS: Record<string, string> = {
  ver_projeto: "Lendo o projeto",
  colocar_insert: "Colocando o insert",
  posicionar_insert: "Ajustando a posição do insert",
  acabamento_do_insert: "Ajustando a moldura do insert",
  colocar_audio: "Colocando o áudio",
  definir_transicao: "Ajustando as transições",
  aparar_cena: "Aparando a cena",
  dividir_cena: "Dividindo a cena",
  velocidade_da_cena: "Ajustando a velocidade da cena",
  cortar_trecho: "Cortando o trecho",
  cortar_respiros: "Cortando os respiros",
  adicionar_cena: "Adicionando a cena",
  montar_sequencia: "Montando a sequência de cenas",
  mover_cena: "Mudando a ordem das cenas",
  adicionar_zoom: "Colocando o zoom",
  colocar_fundo: "Colocando o fundo animado",
  encenar_fala: "Encenando a fala no tempo da voz",
  adicionar_motion: "Colocando a animação",
  adicionar_efeito: "Colocando o efeito de imagem",
  adicionar_som: "Colocando o efeito sonoro",
  sons_automaticos: "Colocando os efeitos sonoros",
  adicionar_legenda: "Escrevendo a legenda",
  legendar_automaticamente: "Criando as legendas pela fala",
  estilo_das_legendas: "Mudando o estilo das legendas",
  aparencia_das_legendas: "Ajustando as legendas",
  corrigir_texto_das_legendas: "Corrigindo as legendas",
  editar_item: "Ajustando um item",
  dividir_item: "Dividindo um item",
  aparar_item: "Aparando um item",
  juntar_itens: "Juntando itens",
  duplicar_item: "Duplicando um item",
  remover_item: "Removendo um item",
  buscar_fala: "Procurando na fala",
  ver_conteudo: "Lendo o que é falado e mostrado",
  buscar_no_banco: "Procurando no banco de mídia",
  efeitos_de_audio: "Aplicando efeito no áudio",
  configurar_projeto: "Ajustando o projeto",
};

export const rotuloDaFerramenta = (nome: string, entrada: unknown) => {
  const base = ROTULOS[nome] ?? "Editando";
  const telas = (entrada as { telas?: unknown[] } | null)?.telas;
  return nome === "encenar_fala" && Array.isArray(telas)
    ? `${base} (${telas.length} telas)`
    : base;
};

export type Progresso = {
  // Começa uma fase: a barra vai de "de" até perto de "ate".
  fase: (de: number, ate: number, texto: string) => void;
  // Mais um passo dentro da fase.
  passo: (texto: string) => void;
  // Ponto exato (ex.: 3 de 8 quadros gerados).
  em: (pct: number, texto: string) => void;
  // Só troca o texto (a barra fica onde está).
  detalhe: (texto: string) => void;
};

// O que a IA está ESCREVENDO (antes da ferramenta rodar): a encenação conta
// os itens já escritos, as outras dizem o que estão preparando.
export const textoEscrevendo = (nome: string, argumentos: string) => {
  if (nome === "encenar_fala") {
    const itens = argumentos.match(/"quando"/g)?.length ?? 0;
    const telas = argumentos.match(/"itens"/g)?.length ?? 0;
    return itens
      ? `Escrevendo a encenação: ${telas} tela(s), ${itens} animação(ões)…`
      : "Planejando as telas da encenação…";
  }
  return `Preparando: ${(ROTULOS[nome] ?? "edição").toLowerCase()}…`;
};

export const criarProgresso = (
  enviar: (pct: number, texto: string) => void,
): Progresso => {
  let de = 0;
  let ate = 100;
  let passos = 0;
  let atual = 0;
  const emitir = (pct: number, texto: string) => {
    atual = Math.max(atual, Math.min(99, pct));
    enviar(Math.round(atual), texto);
  };
  return {
    fase: (inicio, fim, texto) => {
      de = inicio;
      ate = fim;
      passos = 0;
      emitir(inicio, texto);
    },
    passo: (texto) => {
      passos++;
      emitir(de + (ate - de) * (1 - 0.72 ** passos), texto);
    },
    em: emitir,
    detalhe: (texto) => emitir(atual, texto),
  };
};

// Sem barra (pedido sem streaming, ex.: testes).
export const semProgresso: Progresso = {
  fase: () => {},
  passo: () => {},
  em: () => {},
  detalhe: () => {},
};
