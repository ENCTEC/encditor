import {
  EstiloFundo,
  EstiloLegenda,
  ModeloMotion,
  TipoEfeito,
  TipoTransicao,
} from "@/timeline/schema";

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
  {
    id: "mergulho",
    tag: "#mergulho",
    nome: "Mergulho",
    descricao: "A câmera mergulha na cena com zoom forte e sai na próxima.",
    quandoUsar: "Reels dinâmicos, 'olha isso', entrar num detalhe.",
  },
  {
    id: "chicote",
    tag: "#chicote",
    nome: "Chicote",
    descricao: "A imagem passa rápida para o lado, borrada (whip pan).",
    quandoUsar:
      "Ritmo acelerado, troca de produto, 'e tem mais'. Aceita direção.",
  },
  {
    id: "clarao",
    tag: "#clarao",
    nome: "Clarão",
    descricao: "Um flash branco estoura e a cena nova aparece.",
    quandoUsar: "Revelação, antes/depois, batida forte da música.",
  },
  {
    id: "falha",
    tag: "#falha",
    nome: "Falha",
    descricao: "Glitch digital: a imagem treme, corta em faixas e troca.",
    quandoUsar: "Tecnologia, quebra de expectativa, estilo moderno.",
  },
  {
    id: "borrao",
    tag: "#borrao",
    nome: "Borrão",
    descricao: "Uma cena desfoca e a outra aparece entrando em foco.",
    quandoUsar: "Transição elegante, sonho, lembrança, beleza.",
  },
  {
    id: "giro",
    tag: "#giro",
    nome: "Giro",
    descricao: "A imagem gira e aproxima até virar a cena nova.",
    quandoUsar: "Diversão, energia, mudança brusca de assunto.",
  },
  {
    id: "degrade",
    tag: "#degrade",
    nome: "Degradê",
    descricao:
      "Uma faixa em degradê azul→roxo atravessa a tela e revela a cena nova.",
    quandoUsar:
      "Vídeos de motion (kit neon), virada para o final/chamada. Direção = de onde a faixa vem (padrão: de baixo).",
  },
];

// Fundos animados: cenas desenhadas pelo próprio vídeo (sem arquivo), para
// vídeos feitos só de motion — o texto falado e os grafismos vão por cima.
export const FUNDOS: ItemCatalogo<EstiloFundo>[] = [
  {
    id: "neon",
    tag: "#fundo-neon",
    nome: "Neon",
    descricao:
      "Escuro, com brilhos roxo e azul se mexendo devagar e anéis girando.",
    quandoUsar:
      "Motion design falado (kit neon), tecnologia, explicações, 'olha isso'.",
  },
  {
    id: "formas",
    tag: "#fundo-formas",
    nome: "Formas 3D",
    descricao:
      "O neon com cubos, anéis, esferas e cápsulas 3D flutuando nas bordas.",
    quandoUsar:
      "Mais movimento no meio do vídeo (celular na tela, passo a passo).",
  },
  {
    id: "papel",
    tag: "#fundo-papel",
    nome: "Papel",
    descricao: "Papel claro com retícula e uma mancha vermelha de spray.",
    quandoUsar:
      "Explicações com a cara do encEditor; combina com os motions do kit básico (frase, título, lista).",
  },
];

// Motion graphics: textos e grafismos animados por cima do vídeo.
// Em qualquer texto, *palavra* entre asteriscos sai na cor de destaque.
export const MOTIONS: (ItemCatalogo<ModeloMotion> & {
  // O que vai em "texto" e em "detalhe".
  campos: string;
  // Exemplo usado na aba Estilos e na Timeline ("+ Motion").
  exemplo: {
    texto: string;
    detalhe?: string;
    x?: number;
    y?: number;
    x2?: number;
    y2?: number;
  };
  // Som que combina (adicionado junto pela IA e pela montagem); null = sem
  // som (aparece demais para ter som toda vez).
  som: IdSom | null;
  // Kit neon: o exemplo da aba Estilos roda sobre o fundo neon.
  neon?: boolean;
})[] = [
  {
    id: "frase",
    tag: "#frase",
    nome: "Frase de impacto",
    descricao: "Frase curta e enorme que bate na tela e treme ao chegar.",
    quandoUsar: "Gancho no começo, a ideia principal, 'ATENÇÃO'.",
    campos: "texto = a frase (curta).",
    exemplo: { texto: "ISSO MUDA *TUDO*" },
    som: "boom",
  },
  {
    id: "preco",
    tag: "#preco",
    nome: "Preço / oferta",
    descricao: "Preço antigo riscado e o preço novo saltando numa etiqueta.",
    quandoUsar: "Promoção, desconto, 'de… por…'.",
    campos: "texto = preço novo; detalhe = preço antigo (opcional).",
    exemplo: { texto: "R$ 59,90", detalhe: "R$ 89,90" },
    som: "caixa",
  },
  {
    id: "contador",
    tag: "#contador",
    nome: "Contador",
    descricao: "Número grande que conta até o valor, com um rótulo embaixo.",
    quandoUsar: "Dados e provas: '+5.000 clientes', '50% OFF', '3x sem juros'.",
    campos: "texto = número com o que vier junto; detalhe = rótulo.",
    exemplo: { texto: "+5.000", detalhe: "clientes atendidas" },
    som: "subida",
  },
  {
    id: "titulo",
    tag: "#titulo",
    nome: "Título com marca-texto",
    descricao:
      "Título com uma faixa colorida que passa por trás, como marca-texto.",
    quandoUsar: "Abrir um assunto, nome do produto, 'passo 1'.",
    campos: "texto = título; detalhe = linha pequena acima (opcional).",
    exemplo: { texto: "Hidratação *profunda*", detalhe: "NOVIDADE" },
    som: "swoosh",
  },
  {
    id: "rodape",
    tag: "#rodape",
    nome: "Rodapé (nome)",
    descricao: "Caixa que desliza no canto de baixo com nome e descrição.",
    quandoUsar: "Apresentar pessoa, loja, produto ou endereço.",
    campos: "texto = nome; detalhe = descrição (opcional).",
    exemplo: { texto: "Linnda Cosméticos", detalhe: "Eusébio · CE" },
    som: "swoosh",
  },
  {
    id: "lista",
    tag: "#lista",
    nome: "Lista de benefícios",
    descricao: "Itens com ✓ que entram um de cada vez.",
    quandoUsar: "Benefícios, o que vem no kit, passo a passo.",
    campos: "texto = título (opcional); detalhe = itens separados por |.",
    exemplo: {
      texto: "Por que usar",
      detalhe: "Brilho na hora|Sem frizz|Cheiro que dura",
    },
    som: "pop",
  },
  {
    id: "chamada",
    tag: "#chamada",
    nome: "Chamada (CTA)",
    descricao: "Botão pulsando com uma seta apontando para ele.",
    quandoUsar: "Final do vídeo: 'chame no WhatsApp', 'compre agora'.",
    campos: "texto = texto do botão; detalhe = linha pequena acima (opcional).",
    exemplo: { texto: "CHAME NO WHATSAPP", detalhe: "Link na bio" },
    som: "pop",
  },
  {
    id: "selo",
    tag: "#selo",
    nome: "Selo",
    descricao: "Selo redondo carimbado na tela, girando devagar.",
    quandoUsar: "'Frete grátis', '-30%', 'Novo', 'Mais vendido'.",
    campos: "texto = texto do selo (curto).",
    exemplo: { texto: "-30%" },
    som: "boom",
  },
  {
    id: "seta",
    tag: "#seta",
    nome: "Seta",
    descricao: "Seta desenhada apontando para um ponto, com um texto.",
    quandoUsar: "Mostrar um detalhe: 'olha a textura', 'aqui o preço'.",
    campos: "texto = rótulo; x/y = ponto apontado (% da tela).",
    exemplo: { texto: "olha a textura" },
    som: "swoosh",
  },
  {
    id: "circulo",
    tag: "#circulo",
    nome: "Círculo de destaque",
    descricao: "Círculo desenhado à mão em volta de um ponto.",
    quandoUsar: "Chamar atenção para algo na imagem.",
    campos: "texto = rótulo (opcional); x/y = centro (% da tela).",
    exemplo: { texto: "" },
    som: "clique",
  },
  // Kit "investigação": quadro de cortiça e perícia. Combina com inserts em
  // moldura polaroid com alfinete (acabamento_do_insert) e com uma imagem
  // de quadro de cortiça como cena de fundo.
  {
    id: "carimbo",
    tag: "#carimbo",
    nome: "Carimbo",
    descricao: "Carimbo torto que bate na tela, com a tinta falhada.",
    quandoUsar:
      "'CONFIDENCIAL', 'CASO ENCERRADO', 'APROVADO', 'ESGOTADO', veredito.",
    campos:
      "texto = o carimbo (curto); detalhe = linha pequena embaixo (opcional); x/y = centro.",
    exemplo: { texto: "Confidencial", detalhe: "Caso nº 150", x: 50, y: 50 },
    som: "carimbo",
  },
  {
    id: "fita",
    tag: "#fita",
    nome: "Fita de isolamento",
    descricao: "Duas fitas zebradas amarelas cruzando a tela com o texto.",
    quandoUsar: "Abertura de 'investigação', 'PARA TUDO', área proibida.",
    campos:
      "texto = o que vem escrito na fita (sem valor: NÃO ULTRAPASSE); posicao ou y = altura.",
    exemplo: { texto: "Não ultrapasse" },
    som: "swoosh",
  },
  {
    id: "fio",
    tag: "#fio",
    nome: "Fio vermelho",
    descricao:
      "Fio de quadro de investigação esticado entre dois alfinetes, com etiqueta no meio.",
    quandoUsar:
      "Ligar duas provas (fotos, notas) no quadro: 'problema → solução'.",
    campos:
      "x/y = primeiro alfinete; x2/y2 = segundo alfinete (% da tela); texto = etiqueta do meio (opcional).",
    exemplo: { texto: "ligação", x: 22, y: 28, x2: 76, y2: 66 },
    som: "clique",
  },
  {
    id: "nota",
    tag: "#nota",
    nome: "Nota presa",
    descricao: "Bilhete amarelo preso por alfinete, escrito à mão, balançando.",
    quandoUsar: "Pistas, lembretes, 'VÍTIMA: cabelo seco', observações.",
    campos:
      "texto = o bilhete (curto); detalhe = linha pequena de cima (opcional); x/y = alfinete.",
    exemplo: { texto: "olha o *preço*", detalhe: "Pista nº 2", x: 50, y: 34 },
    som: "clique",
  },
  {
    id: "ficha",
    tag: "#ficha",
    nome: "Ficha datilografada",
    descricao:
      "Ficha de arquivo com carimbo CONFIDENCIAL; as linhas vão sendo datilografadas.",
    quandoUsar: "Abrir um 'caso', ficha do produto, dados do suspeito.",
    campos:
      "detalhe = cabeçalho ('CASO Nº 150'); texto = linhas 'CAMPO: valor' separadas por |; posicao ou y = topo.",
    exemplo: {
      texto: "LOCAL: Linnda Cosméticos|SUSPEITO: kit Trivitt",
      detalhe: "Caso nº 150",
    },
    som: "maquina",
  },
  {
    id: "vigilancia",
    tag: "#vigilancia",
    nome: "Câmera de segurança",
    descricao:
      "Moldura de câmera de vigilância: cantos, ● REC piscando, nome da câmera e relógio.",
    quandoUsar:
      "Cena como 'flagrante', bastidores, depoimento; combina com #pb e #grao.",
    campos:
      "texto = nome da câmera ('CAM 02'); detalhe = local ou data (opcional). Dure a cena toda.",
    exemplo: { texto: "CAM 02", detalhe: "Loja · 25/10/2026" },
    som: "falha",
  },
  {
    id: "marcador",
    tag: "#marcador",
    nome: "Marcador de perícia",
    descricao: "Plaquinha amarela numerada de cena de crime, em pé no chão.",
    quandoUsar: "Marcar 'provas' na imagem: produto, detalhe, preço.",
    campos:
      "texto = número ou letra; detalhe = legenda embaixo (opcional); x/y = onde a plaquinha pisa.",
    exemplo: { texto: "1", detalhe: "prova", x: 50, y: 72 },
    som: "pop",
  },
  // Kit "neon": motion design FALADO (o que a pessoa diz acontece na tela).
  // Combina com o fundo animado neon/formas, a transição #degrade e a
  // ferramenta encenar_fala da IA.
  {
    id: "fala",
    tag: "#fala",
    nome: "Texto falado",
    descricao:
      "As palavras entram uma a uma no instante em que são ditas; as de destaque vêm enormes, em degradê azul→roxo.",
    quandoUsar:
      "O 'texto principal' de cada tela num vídeo de motion: substitui a legenda.",
    campos:
      "texto = as palavras EXATAS que são faladas (*palavra* = destaque grande; | quebra a linha); posicao = topo/centro/base.",
    exemplo: { texto: "Rapaziada,|é *bizarro*|o que dá pra *fazer*" },
    som: null,
    neon: true,
  },
  {
    id: "etiqueta",
    tag: "#etiqueta",
    nome: "Etiqueta de ação",
    descricao: "Pílula em degradê que nomeia a ação ou o lugar.",
    quandoUsar:
      "'LÁ EM CIMA', 'CLICA NO CANAL', 'PASSO 2', 'ANTES', 'O SEGREDO'.",
    campos:
      "texto = 1 a 4 palavras; posicao (padrão topo) ou x/y = centro da pílula.",
    exemplo: { texto: "Barra de pesquisa" },
    som: "pop",
    neon: true,
  },
  {
    id: "anel",
    tag: "#anel",
    nome: "Anel brilhante",
    descricao: "Círculo de luz que se desenha e pulsa, com o texto dentro.",
    quandoUsar: "'Olha isso', 'atenção', a palavra que vira o assunto.",
    campos: "texto = curto (| quebra a linha; *destaque*); x/y = centro.",
    exemplo: { texto: "Olha|*isso.*", x: 50, y: 50 },
    som: "swoosh",
    neon: true,
  },
  {
    id: "digitando",
    tag: "#digitando",
    nome: "Cartão digitando",
    descricao:
      "Cartão de vidro que escreve o texto junto com a voz, com ondinha de áudio.",
    quandoUsar:
      "Quando a pessoa dita um comando, uma pesquisa, uma mensagem ou um pedido.",
    campos:
      "texto = o que é dito (*destaque* = grande em degradê); detalhe = cabeçalho ('COMANDO DE VOZ', 'PESQUISA', 'MENSAGEM'); posicao (padrão topo).",
    exemplo: {
      texto: "Claude, faça uma *home do YouTube*",
      detalhe: "Comando de voz",
    },
    som: "teclado",
    neon: true,
  },
  {
    id: "barra",
    tag: "#barra",
    nome: "Barra de nível",
    descricao:
      "Palavra grande e uma barra de segmentos que enche em degradê.",
    quandoUsar: "'O nível', 'progresso', 'carregando', 'de 0 a 100'.",
    campos:
      "texto = a palavra grande ('NÍVEL'); detalhe = linha pequena em cima ('É ESSE O').",
    exemplo: { texto: "Nível", detalhe: "É esse o" },
    som: "subida",
    neon: true,
  },
  {
    id: "comentario",
    tag: "#comentario",
    nome: "Comentário",
    descricao:
      "Caixa de comentários: o texto é digitado, enviado e aparece publicado.",
    quandoUsar: "Chamada final 'comente EU QUERO', 'me conta nos comentários'.",
    campos:
      "texto = o comentário ('EU QUERO'); detalhe = pílula acima ('COMENTE \"EU QUERO\"').",
    exemplo: { texto: "Eu quero", detalhe: 'Comente "Eu quero"' },
    som: "teclado",
    neon: true,
  },
  {
    id: "curtida",
    tag: "#curtida",
    nome: "Curtida",
    descricao:
      "Botão de curtir que é tocado, estoura em brilhinhos e solta uma mão maior.",
    quandoUsar: "'Deixa o like', 'curte', 'aprovado pelo público'.",
    campos:
      "texto = número (o contador sobe 1 no toque) ou rótulo curto; x/y = onde fica o botão.",
    exemplo: { texto: "3", x: 50, y: 50 },
    som: "plim",
    neon: true,
  },
  {
    id: "toque",
    tag: "#toque",
    nome: "Toque na tela",
    descricao: "Um 'dedo' (círculo claro) chega, aperta e solta uma onda.",
    quandoUsar:
      "'Clica aqui', 'toca no botão' — por cima de um print no celular ou de um botão.",
    campos: "x/y = onde o dedo toca (% da tela). Sem texto.",
    exemplo: { texto: "", x: 50, y: 50 },
    som: "clique",
    neon: true,
  },
  {
    id: "brilho",
    tag: "#brilho",
    nome: "Brilho ✦",
    descricao: "Estrela de brilho que gira e pisca, com duas pequenas.",
    quandoUsar:
      "Enfeitar uma palavra-chave ou um produto: 'novo', 'mágico', o nome da marca.",
    campos: "x/y = onde brilha (perto da palavra). Sem texto.",
    exemplo: { texto: "", x: 50, y: 50 },
    som: "plim",
    neon: true,
  },
  {
    id: "microfone",
    tag: "#microfone",
    nome: "Microfone ouvindo",
    descricao:
      "Microfone num círculo em degradê com barrinhas de voz mexendo em volta.",
    quandoUsar: "'Só com a minha voz', 'é só falar', 'ouvindo', áudio, podcast.",
    campos: "x/y = centro (padrão no meio). Sem texto.",
    exemplo: { texto: "", x: 50, y: 50 },
    som: null,
    neon: true,
  },
  {
    id: "confirmado",
    tag: "#confirmado",
    nome: "Selo ✓",
    descricao: "Selo inclinado com ✓ que chega girando.",
    quandoUsar: "'Fechou?', 'pronto', 'aprovado', 'feito'.",
    campos: "texto = 1 ou 2 palavras; posicao (padrão topo) ou x/y.",
    exemplo: { texto: "Fechou?" },
    som: "pop",
    neon: true,
  },
];

// Efeitos de imagem num trecho (como o zoom, valem para cenas e inserts).
export const EFEITOS_VISUAIS: (ItemCatalogo<TipoEfeito> & {
  // Duração típica, em segundos.
  duracao: number;
  som: IdSom | null;
})[] = [
  {
    id: "tremor",
    tag: "#tremor",
    nome: "Tremor",
    descricao: "A câmera treme, como num impacto.",
    quandoUsar: "Batida, susto, frase forte, explosão.",
    duracao: 0.5,
    som: "boom",
  },
  {
    id: "flash",
    tag: "#flash",
    nome: "Flash",
    descricao: "Clarão branco rápido, como flash de foto.",
    quandoUsar: "Foto, revelação, batida da música.",
    duracao: 0.4,
    som: "obturador",
  },
  {
    id: "glitch",
    tag: "#glitch",
    nome: "Glitch",
    descricao: "Falha digital: a imagem pula, troca de cor e corta em faixas.",
    quandoUsar: "Tecnologia, 'erro', virada inesperada.",
    duracao: 0.4,
    som: "falha",
  },
  {
    id: "desfoque",
    tag: "#desfoque",
    nome: "Desfoque",
    descricao: "A imagem perde o foco e volta.",
    quandoUsar: "Lembrança, tontura, fundo atrás de um texto.",
    duracao: 1,
    som: null,
  },
  {
    id: "batida",
    tag: "#batida",
    nome: "Batida",
    descricao: "Pulso rápido de zoom que vai e volta.",
    quandoUsar: "Ênfase numa palavra, batida da música.",
    duracao: 0.3,
    som: "boom",
  },
  {
    id: "pb",
    tag: "#pb",
    nome: "Preto e branco",
    descricao: "Tira a cor do trecho.",
    quandoUsar: "'Antes', passado, problema (e volta à cor na solução).",
    duracao: 2,
    som: null,
  },
  {
    id: "quente",
    tag: "#quente",
    nome: "Cor quente",
    descricao: "Puxa para o dourado e alaranjado.",
    quandoUsar: "Aconchego, pele bonita, fim de tarde.",
    duracao: 3,
    som: null,
  },
  {
    id: "frio",
    tag: "#frio",
    nome: "Cor fria",
    descricao: "Puxa para o azul.",
    quandoUsar: "Limpeza, frescor, tecnologia, noite.",
    duracao: 3,
    som: null,
  },
  {
    id: "vibrante",
    tag: "#vibrante",
    nome: "Vibrante",
    descricao: "Mais contraste e cor (imagem mais 'viva').",
    quandoUsar: "Produto, comida, cores do antes/depois.",
    duracao: 3,
    som: null,
  },
  {
    id: "vinheta",
    tag: "#vinheta",
    nome: "Vinheta",
    descricao: "Escurece as bordas e foca o centro.",
    quandoUsar: "Clima dramático, depoimento, destacar o centro.",
    duracao: 3,
    som: null,
  },
  {
    id: "grao",
    tag: "#grao",
    nome: "Grão de filme",
    descricao: "Granulado de filme antigo por cima.",
    quandoUsar: "Estética retrô, bastidores, documentário.",
    duracao: 3,
    som: null,
  },
  {
    id: "vhs",
    tag: "#vhs",
    nome: "VHS",
    descricao: "Fita antiga: linhas, cor lavada e imagem tremida.",
    quandoUsar: "Nostalgia, 'antigamente', humor.",
    duracao: 2,
    som: "falha",
  },
];

// Efeitos sonoros do encEditor, gerados por síntese (scripts/gerar-sons.mjs,
// sem direito autoral). Entram como áudios da timeline.
export const SONS = [
  {
    id: "whoosh",
    tag: "#som-whoosh",
    nome: "Whoosh",
    descricao: "Passagem de ar, como algo voando pela tela.",
    quandoUsar: "Transições, texto entrando, troca de cena.",
    duracao: 0.7,
    volume: 0.45,
  },
  {
    id: "swoosh",
    tag: "#som-swoosh",
    nome: "Swoosh curto",
    descricao: "Passagem rápida e aguda.",
    quandoUsar: "Títulos e rodapés entrando, cortes rápidos.",
    duracao: 0.35,
    volume: 0.4,
  },
  {
    id: "pop",
    tag: "#som-pop",
    nome: "Pop",
    descricao: "Estalo curto de bolha.",
    quandoUsar: "Itens de lista, emojis, botões aparecendo.",
    duracao: 0.18,
    volume: 0.5,
  },
  {
    id: "clique",
    tag: "#som-clique",
    nome: "Clique",
    descricao: "Clique seco de botão.",
    quandoUsar: "Círculo/seta de destaque, interface, toque na tela.",
    duracao: 0.05,
    volume: 0.5,
  },
  {
    id: "boom",
    tag: "#som-boom",
    nome: "Boom",
    descricao: "Impacto grave.",
    quandoUsar: "Frase de impacto, tremor, revelação.",
    duracao: 1.4,
    volume: 0.5,
  },
  {
    id: "ding",
    tag: "#som-ding",
    nome: "Ding",
    descricao: "Sino agudo de notificação.",
    quandoUsar: "Ideia, resposta certa, 'olha que bom'.",
    duracao: 1.3,
    volume: 0.4,
  },
  {
    id: "caixa",
    tag: "#som-caixa",
    nome: "Caixa registradora",
    descricao: "Dois sinos de venda ('tchan-tchan').",
    quandoUsar: "Preço, promoção, venda feita.",
    duracao: 1,
    volume: 0.45,
  },
  {
    id: "subida",
    tag: "#som-subida",
    nome: "Subida (riser)",
    descricao: "Som que vai subindo e cria expectativa.",
    quandoUsar: "Antes de uma revelação, contador, chegada do clímax.",
    duracao: 1.6,
    volume: 0.35,
  },
  {
    id: "falha",
    tag: "#som-falha",
    nome: "Falha digital",
    descricao: "Chiado picotado de glitch.",
    quandoUsar: "Glitch, VHS, erro, tecnologia.",
    duracao: 0.45,
    volume: 0.35,
  },
  {
    id: "obturador",
    tag: "#som-obturador",
    nome: "Obturador",
    descricao: "Clique de câmera fotográfica.",
    quandoUsar: "Flash, 'foto', antes/depois.",
    duracao: 0.25,
    volume: 0.5,
  },
  {
    id: "carimbo",
    tag: "#som-carimbo",
    nome: "Carimbo",
    descricao: "Batida seca de carimbo na mesa.",
    quandoUsar: "Carimbo, veredito, 'aprovado', 'caso encerrado'.",
    duracao: 0.35,
    volume: 0.55,
  },
  {
    id: "maquina",
    tag: "#som-maquina",
    nome: "Máquina de escrever",
    descricao: "Teclas de máquina de escrever batendo.",
    quandoUsar: "Texto sendo digitado, ficha, relatório, legenda #maquina.",
    duracao: 1.6,
    volume: 0.35,
  },
  {
    id: "sirene",
    tag: "#som-sirene",
    nome: "Sirene",
    descricao: "Sirene de polícia subindo e descendo.",
    quandoUsar: "Abertura de 'investigação', 'PARA TUDO', alerta.",
    duracao: 2.6,
    volume: 0.22,
  },
  {
    id: "tique-taque",
    tag: "#som-tique-taque",
    nome: "Tique-taque",
    descricao: "Relógio marcando os segundos.",
    quandoUsar: "'Por tempo limitado', contagem, suspense.",
    duracao: 2,
    volume: 0.45,
  },
  {
    id: "plim",
    tag: "#som-plim",
    nome: "Plim (brilho)",
    descricao: "Duas notas agudas de brilho, com um leve eco.",
    quandoUsar: "Brilho ✦, curtida, a palavra mágica — só em 2 a 4 momentos.",
    duracao: 0.9,
    volume: 0.35,
  },
  {
    id: "teclado",
    tag: "#som-teclado",
    nome: "Teclado",
    descricao: "Teclas de computador/celular sendo digitadas, baixinho.",
    quandoUsar: "Cartão digitando, comentário, pesquisa sendo escrita.",
    duracao: 1.4,
    volume: 0.3,
  },
] as const satisfies readonly (ItemCatalogo<string> & {
  duracao: number;
  volume: number;
})[];

export type IdSom = (typeof SONS)[number]["id"];
export const IDS_SONS = SONS.map((s) => s.id) as [IdSom, ...IdSom[]];
export const arquivoDoSom = (id: IdSom) => `/sons/${id}.mp3`;
export const somPorArquivo = (url: string) =>
  SONS.find((s) => arquivoDoSom(s.id) === url) ?? null;

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
    "Motions — textos e grafismos animados (cite com #; use adicionar_motion):",
    ...MOTIONS.map(
      (m) =>
        `- ${m.tag} = ${m.nome}: ${m.descricao} Uso: ${m.quandoUsar} Campos: ${m.campos}`,
    ),
    "Efeitos de imagem num trecho (cite com #; use adicionar_efeito):",
    ...EFEITOS_VISUAIS.map(
      (e) =>
        `- ${e.tag} = ${e.nome}: ${e.descricao} Uso: ${e.quandoUsar} (duração típica ${e.duracao}s)`,
    ),
    "Fundos animados — cena sem arquivo, para vídeo só de motion (cite com #; use colocar_fundo):",
    ...FUNDOS.map(
      (f) => `- ${f.tag} = ${f.nome}: ${f.descricao} Uso: ${f.quandoUsar}`,
    ),
    "Efeitos sonoros (cite com #; use adicionar_som):",
    ...SONS.map(
      (s) => `- ${s.tag} = ${s.nome}: ${s.descricao} Uso: ${s.quandoUsar}`,
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
