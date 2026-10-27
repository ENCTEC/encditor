import { z } from "zod";

// Convenção de tempos (sempre em segundos):
// - "inicio"/"fim" de clipes = trecho dentro do vídeo de ORIGEM.
// - "inicio"/"fim" de inserts, áudios, zooms e legendas = posição na
//   timeline FINAL (já editada).
// - "origemInicio" = a partir de que segundo do arquivo de origem tocar.

// Tipos de transição de entrada de um clipe (em relação ao clipe anterior):
// corte = corte seco; fade = dissolve; slide = a cena nova empurra a antiga;
// cortina = a cena nova é revelada passando por cima (wipe); virar = gira
// como uma carta (flip); relogio = revela em círculo como ponteiro;
// iris = revela por um círculo que abre do centro; impacto = corte com
// zoom rápido e flash (push-cut). As de baixo são próprias do encEditor
// (transicoesExtras.tsx): mergulho = zoom forte atravessando a cena;
// chicote = passa rápido para o lado, borrado (whip pan); clarao = flash
// branco; falha = glitch digital; borrao = desfoca uma e foca a outra;
// giro = gira e aproxima; degrade = uma faixa em degradê (azul→roxo) varre a
// tela e revela a cena nova.
export const tipoTransicaoSchema = z.enum([
  "corte",
  "fade",
  "slide",
  "cortina",
  "virar",
  "relogio",
  "iris",
  "impacto",
  "mergulho",
  "chicote",
  "clarao",
  "falha",
  "borrao",
  "giro",
  "degrade",
]);

// De onde a cena nova entra (vale para slide, cortina e virar).
export const direcaoSchema = z.enum(["esquerda", "direita", "cima", "baixo"]);

// Fundos animados do encEditor (desenhados pelo próprio vídeo, sem
// arquivo), todos nas cores da paleta do vídeo: neon = escuro com brilhos e
// anéis; formas = o neon com formas 3D flutuando; papel = papel claro com
// retícula (cara do encEditor); brilhos = luzes desfocadas passeando (bokeh);
// ondas = faixas de luz ondulando; grade = grade em perspectiva (tecnologia);
// gradiente = degradê de cor que se mexe; claro = fundo claro e limpo com
// manchas suaves de cor (beleza, saúde, lifestyle).
export const estiloFundoSchema = z.enum([
  "neon",
  "formas",
  "papel",
  "brilhos",
  "ondas",
  "grade",
  "gradiente",
  "claro",
]);

// Prefixo da "url" de uma cena de fundo animado: "fundo:neon".
export const PREFIXO_FUNDO = "fundo:";

// Volume da voz (0 a 1) "taxa" vezes por segundo, a partir de "de"
// segundos do início do item (onda da conversa, fundo pulsando com a voz).
export const ondaSchema = z.object({
  de: z.number(),
  taxa: z.number().positive(),
  valores: z.array(z.number().min(0).max(1)),
});

// Ajustes de uma cena de fundo animado. Sem valor = paleta da direção de
// arte do vídeo (ou a padrão do estilo).
export const ajustesDoFundoSchema = z.object({
  // Paleta #rrggbb: [principal, secundária, destaque].
  cores: z.array(z.string()).min(2).max(3).optional(),
  // 0 = calmo (se mexe devagar), 1 = agitado. Sem valor = 0,5.
  energia: z.number().min(0).max(1).optional(),
  // Pulsa com a voz: o volume da fala no tempo da cena.
  onda: ondaSchema.optional(),
});

// Trilha principal: as cenas, em sequência.
export const clipeSchema = z.object({
  url: z.string(),
  // Cenas podem ser vídeos, imagens paradas ou um fundo animado (sem valor
  // = vídeo). Numa imagem ou fundo, inicio/fim só definem quanto tempo fica
  // na tela. Fundo: url = "fundo:<estilo>" (ver estiloFundoSchema).
  tipo: z.enum(["video", "imagem", "fundo"]).optional(),
  inicio: z.number().min(0),
  fim: z.number().min(0),
  transicao: tipoTransicaoSchema,
  // Opcional; sem valor, cada tipo usa a sua direção padrão.
  direcao: direcaoSchema.optional(),
  // Opcional; sem valor, usa a duração padrão do projeto.
  duracaoTransicao: z.number().min(0).optional(),
  // 0 = mudo, 1 = volume original.
  volume: z.number().min(0),
  // Velocidade do vídeo (sem valor = 1). 0.8 = câmera lenta leve: o trecho
  // inicio–fim do arquivo ocupa (fim - inicio) / 0.8 no vídeo final.
  velocidade: z.number().min(0.25).max(4).optional(),
  // Só no fundo animado: cores, energia e pulsar com a voz.
  fundo: ajustesDoFundoSchema.optional(),
});

// Vídeo ou imagem por cima da trilha principal (B-roll, insert).
export const insertSchema = z.object({
  url: z.string(),
  tipo: z.enum(["video", "imagem"]),
  inicio: z.number().min(0),
  fim: z.number().min(0),
  // Só para vídeo: de que segundo do arquivo começar.
  origemInicio: z.number().min(0),
  // Tela cheia cobre o vídeo principal; janela fica no canto (picture-in-picture).
  // Usado só se não houver "caixa".
  posicao: z.enum(["tela-cheia", "janela"]),
  volume: z.number().min(0),
  // Posição e tamanho exatos, em % do vídeo (ver timeline/caixas.ts).
  caixa: z
    .object({
      x: z.number().min(0).max(100),
      y: z.number().min(0).max(100),
      largura: z.number().min(1).max(100),
      altura: z.number().min(1).max(100),
    })
    .optional(),
  // Acabamento da janela (quando não é tela cheia). polaroid = moldura de
  // foto instantânea (branca, faixa de baixo maior; ignora borda e cantos);
  // alfinete = preso por um alfinete vermelho no topo (quadro de cortiça);
  // celular = dentro de um celular (a imagem vira a tela; sobe de baixo ao
  // entrar e, se outro insert de celular vem logo depois no mesmo lugar, só
  // a tela troca).
  acabamento: z
    .object({
      borda: z.boolean(),
      cantos: z.boolean(),
      sombra: z.boolean(),
      polaroid: z.boolean().optional(),
      alfinete: z.boolean().optional(),
      celular: z.boolean().optional(),
    })
    .optional(),
  // Inclinação da janela em graus (positivo = sentido horário).
  rotacao: z.number().min(-45).max(45).optional(),
  // Texto escrito à mão na faixa de baixo da moldura polaroid.
  rotulo: z.string().optional(),
});

// Música, narração ou efeito sonoro.
export const audioSchema = z.object({
  url: z.string(),
  inicio: z.number().min(0),
  fim: z.number().min(0),
  origemInicio: z.number().min(0),
  volume: z.number().min(0),
  // Duração do fade de entrada/saída, em segundos (0 = sem fade).
  fadeEntrada: z.number().min(0),
  fadeSaida: z.number().min(0),
});

// Zoom na trilha principal durante um trecho.
export const zoomSchema = z.object({
  inicio: z.number().min(0),
  fim: z.number().min(0),
  // 1 = sem zoom, 1.5 = 50% mais perto.
  escala: z.number().min(1),
  // Ponto para onde o zoom aproxima, em % da tela (50/50 = centro).
  focoX: z.number().min(0).max(100),
  focoY: z.number().min(0).max(100),
  // Segundos para chegar na escala (e para voltar ao normal no fim).
  // Sem valor = 0,4s (zoom rápido). Valores maiores = zoom lento.
  rampa: z.number().min(0).optional(),
});

// Estilos de legenda (animações). Ver src/catalogo/estilos.ts.
export const estiloLegendaSchema = z.enum([
  "classico",
  "karaoke",
  "pop",
  "destaque",
  "gigante",
  "spray",
  "maquina",
  "neon",
]);

export const legendaSchema = z.object({
  texto: z.string(),
  inicio: z.number().min(0),
  fim: z.number().min(0),
  // Estilo só desta legenda (sem valor = o estilo padrão do projeto).
  estilo: estiloLegendaSchema.optional(),
  // Tempo de cada palavra, em segundos CONTADOS DO INÍCIO da legenda
  // (vem da transcrição; anima karaokê/pop/destaque). Sem valor, o tempo
  // é dividido igualmente entre as palavras.
  palavras: z
    .array(z.object({ texto: z.string(), de: z.number(), ate: z.number() }))
    .optional(),
});

// Aparência de TODAS as legendas (vale para qualquer estilo). Campos sem
// valor = o padrão de cada estilo.
export const posicaoLegendaSchema = z.enum(["topo", "centro", "base"]);
export const aparenciaLegendasSchema = z.object({
  // Multiplica o tamanho da letra do estilo (1 = padrão; 0.8 = 20% menor).
  tamanho: z.number().min(0.3).max(3).optional(),
  posicao: posicaoLegendaSchema.optional(),
  // Distância da borda (topo ou base), em % da altura do vídeo.
  margem: z.number().min(0).max(45).optional(),
  // Altura de cada linha em relação à letra (1 = linhas coladas; 1.3 =
  // mais espaço entre elas).
  entrelinhas: z.number().min(0.7).max(2.5).optional(),
});

// Motion graphics: textos e grafismos animados por cima do vídeo (acima
// das cenas e inserts, abaixo das legendas). Ver src/catalogo/estilos.ts.
// Depois vêm o kit "investigação" (quadro de cortiça, perícia) e o kit
// "neon" (motion design falado: cada frase vira texto e grafismo no momento
// em que é dita — ver MotionsNeon.tsx).
export const modeloMotionSchema = z.enum([
  "frase",
  "preco",
  "contador",
  "titulo",
  "rodape",
  "lista",
  "chamada",
  "selo",
  "seta",
  "circulo",
  "carimbo",
  "fita",
  "fio",
  "nota",
  "ficha",
  "vigilancia",
  "marcador",
  "fala",
  "etiqueta",
  "anel",
  "digitando",
  "barra",
  "comentario",
  "curtida",
  "toque",
  "brilho",
  "microfone",
  "confirmado",
  "conversa",
  "edicao",
  "rec",
  "marca",
  "desenho",
]);

// Ações de um motion "conversa" (chat estilo WhatsApp dentro de um
// celular), cada uma num momento: lista = a lista de conversas se monta;
// abrir = entra na conversa; toque = dedo tocando (texto = alvo: conversa,
// microfone, enviar, campo); gravar = começa a gravar um áudio (a onda vem
// de motion.onda); enviar_audio = manda o áudio gravado; digitando = o
// contato está digitando; recebe = chega uma mensagem do contato (texto);
// escreve = eu escrevo no campo (texto, palavra por palavra); envia = mando
// o que escrevi; joinha = chega um 👍; zoom = aproxima uma parte do
// celular (texto = topo, meio, mensagens, baixo ou normal).
export const acaoDaConversaSchema = z.enum([
  "lista",
  "abrir",
  "toque",
  "gravar",
  "enviar_audio",
  "digitando",
  "recebe",
  "escreve",
  "envia",
  "joinha",
  "zoom",
]);

// Animação DESENHADA pela IA (modelo "desenho"): camadas simples — caixa,
// círculo, texto, emoji, imagem, traço — cada uma com entrada, movimento e
// repetição. Assim a IA cria cenas novas (um celular com um app, um
// gráfico, um contrato) sem programar. Camada solta: x/y = centro em % da
// tela e l/a = tamanho em u (1% do lado menor). Camada "dentro" de outra
// (índice de uma camada ANTERIOR): x/y/l/a em % da caixa da camada mãe, e
// ela anda junto com a mãe. Letra (tamanho) sempre em u.
export const efeitoDaCamadaSchema = z.enum([
  "surge",
  "sobe",
  "desce",
  "esquerda",
  "direita",
  "zoom",
  "pula",
  "gira",
  "cresce",
  "desenha",
  "digita",
]);
export const camadaSchema = z.object({
  tipo: z.enum(["caixa", "circulo", "texto", "emoji", "imagem", "traco"]),
  dentro: z.number().int().min(0).optional(),
  x: z.number(),
  y: z.number(),
  l: z.number().min(0),
  a: z.number().min(0),
  // #rrggbb, "paleta1", "paleta2", "paleta3", "degrade" (da direção de
  // arte) ou "texto" (escuro no fundo claro, claro no escuro).
  cor: z.string().optional(),
  // Cor da borda (caixa/círculo); espessura = da borda ou do traço, em u.
  borda: z.string().optional(),
  espessura: z.number().min(0).optional(),
  cantos: z.number().min(0).optional(),
  // As camadas de dentro não passam da borda (tela de celular, cartão).
  recorta: z.boolean().optional(),
  sombra: z.boolean().optional(),
  brilho: z.boolean().optional(),
  opacidade: z.number().min(0).max(1).optional(),
  rotacao: z.number().optional(),
  // Texto (ou emoji). *palavra* = destaque em degradê; | quebra a linha.
  texto: z.string().optional(),
  tamanho: z.number().min(0).optional(),
  peso: z.number().optional(),
  fonte: z.enum(["forte", "interface", "condensada", "mono", "marcador"]).optional(),
  alinhar: z.enum(["esquerda", "centro", "direita"]).optional(),
  // Imagem: o endereço de um arquivo da biblioteca.
  imagem: z.string().optional(),
  ajuste: z.enum(["conter", "cobrir"]).optional(),
  // Traço: caminho SVG com coordenadas de 0 a 100 dentro da caixa.
  d: z.string().optional(),
  // Quando entra e sai (segundos contados do início do motion) e como.
  entra: z.number().min(0).optional(),
  efeito: efeitoDaCamadaSchema.optional(),
  sai: z.number().min(0).optional(),
  // Anda de um ponto a outro (mesmas medidas de x/y), cresce ou gira entre
  // "de" e "ate" segundos.
  move: z
    .object({
      de: z.number().min(0),
      ate: z.number().min(0),
      x: z.number().optional(),
      y: z.number().optional(),
      escala: z.number().optional(),
      rotacao: z.number().optional(),
    })
    .optional(),
  repete: z.enum(["pulsa", "flutua", "gira", "pisca", "balanca"]).optional(),
  // Número que conta de "de" até "ate" (no texto: antes + número + depois).
  conta: z
    .object({
      de: z.number(),
      ate: z.number(),
      casas: z.number().int().min(0).max(2).optional(),
      antes: z.string().optional(),
      depois: z.string().optional(),
      duracao: z.number().min(0).optional(),
    })
    .optional(),
});

const palavrasSchema = z.array(
  z.object({ texto: z.string(), de: z.number(), ate: z.number() }),
);

export const motionSchema = z.object({
  modelo: modeloMotionSchema,
  inicio: z.number().min(0),
  fim: z.number().min(0),
  // Texto principal. *palavra* entre asteriscos sai na cor de destaque.
  texto: z.string(),
  // Texto de apoio: preço antigo (preco), rótulo (contador, titulo,
  // rodape, chamada) ou os itens da lista separados por "|".
  detalhe: z.string().optional(),
  posicao: z.enum(["topo", "centro", "base"]).optional(),
  // Ponto (em % da tela) para onde a seta aponta, que o círculo marca ou
  // onde fica o carimbo, a nota, o marcador e o começo do fio.
  x: z.number().min(0).max(100).optional(),
  y: z.number().min(0).max(100).optional(),
  // Segundo ponto (% da tela): onde o fio termina.
  x2: z.number().min(0).max(100).optional(),
  y2: z.number().min(0).max(100).optional(),
  // Cor de destaque (#rrggbb). Sem valor = vermelho do encEditor (no kit
  // neon, o degradê azul→roxo).
  cor: z.string().optional(),
  // Tempo em que cada palavra do texto é FALADA, contado do início do
  // motion, na ordem das palavras do texto (sem os "|"). Faz "fala" e
  // "digitando" mostrarem cada palavra junto com a voz. Sem valor, as
  // palavras entram num ritmo fixo.
  palavras: palavrasSchema.optional(),
  // Roteiro de um motion "conversa": o que acontece e quando (segundos
  // contados do início do motion). "palavras" = tempo de cada palavra
  // falada de uma mensagem (recebe/escreve), contado do início do motion.
  eventos: z
    .array(
      z.object({
        de: z.number().min(0),
        acao: acaoDaConversaSchema,
        texto: z.string().optional(),
        palavras: palavrasSchema.optional(),
      }),
    )
    .optional(),
  // Volume da voz (0 a 1) "taxa" vezes por segundo, a partir de "de"
  // segundos do início do motion: desenha a onda do áudio gravado na
  // conversa com a voz de verdade.
  onda: ondaSchema.optional(),
  // Imagem do motion "marca" (a logo): o endereço de um arquivo.
  imagem: z.string().optional(),
  // Camadas do motion "desenho".
  camadas: z.array(camadaSchema).max(60).optional(),
});

// Efeitos de imagem num trecho (como o zoom, valem para cenas e inserts).
export const tipoEfeitoSchema = z.enum([
  "tremor",
  "flash",
  "glitch",
  "desfoque",
  "batida",
  "pb",
  "quente",
  "frio",
  "vibrante",
  "vinheta",
  "grao",
  "vhs",
]);

export const efeitoSchema = z.object({
  tipo: tipoEfeitoSchema,
  inicio: z.number().min(0),
  fim: z.number().min(0),
  // 0.1 = sutil, 1 = forte. Sem valor = 0.6.
  intensidade: z.number().min(0.1).max(1).optional(),
});

// Direção de arte do vídeo: o que a IA entendeu do áudio (ou do que o
// usuário pediu / do exemplo) e a cara escolhida. As cores valem para os
// fundos animados e para o kit neon.
export const direcaoDeArteSchema = z.object({
  // automatica = a IA decidiu pelo áudio; pedido = o usuário disse no chat
  // ou no plano; exemplo = copiada de um vídeo de exemplo.
  origem: z.enum(["automatica", "pedido", "exemplo"]),
  tema: z.string(),
  nicho: z.string(),
  publico: z.string(),
  tom: z.string(),
  energia: z.enum(["calma", "media", "alta"]),
  // Paleta #rrggbb: [principal, secundária, destaque].
  cores: z.array(z.string()).min(2).max(3),
  fundo: estiloFundoSchema,
  // O que seguir à risca (pedido do usuário / o que copiar do exemplo).
  observacoes: z.string().optional(),
});

export const timelineSchema = z.object({
  fps: z.number().int().positive(),
  largura: z.number().int().positive(),
  altura: z.number().int().positive(),
  // Duração das transições fade/slide, em segundos.
  duracaoTransicao: z.number().min(0),
  clipes: z.array(clipeSchema),
  inserts: z.array(insertSchema),
  audios: z.array(audioSchema),
  zooms: z.array(zoomSchema),
  legendas: z.array(legendaSchema),
  // Projetos de antes destas faixas chegam sem elas (ver normalizarTimeline).
  motions: z.array(motionSchema).default([]),
  efeitos: z.array(efeitoSchema).default([]),
  // Estilo padrão das legendas (sem valor = clássico).
  estiloLegenda: estiloLegendaSchema.optional(),
  aparenciaLegendas: aparenciaLegendasSchema.optional(),
  direcaoDeArte: direcaoDeArteSchema.optional(),
});

export type TipoTransicao = z.infer<typeof tipoTransicaoSchema>;
export type Direcao = z.infer<typeof direcaoSchema>;
export type EstiloFundo = z.infer<typeof estiloFundoSchema>;
export type AjustesDoFundo = z.infer<typeof ajustesDoFundoSchema>;
export type Onda = z.infer<typeof ondaSchema>;
export type DirecaoDeArte = z.infer<typeof direcaoDeArteSchema>;
export type Clipe = z.infer<typeof clipeSchema>;
export type Insert = z.infer<typeof insertSchema>;
export type AudioFaixa = z.infer<typeof audioSchema>;
export type Zoom = z.infer<typeof zoomSchema>;
export type Legenda = z.infer<typeof legendaSchema>;
export type ModeloMotion = z.infer<typeof modeloMotionSchema>;
export type Motion = z.infer<typeof motionSchema>;
export type Camada = z.infer<typeof camadaSchema>;
export type AcaoDaConversa = z.infer<typeof acaoDaConversaSchema>;
export type EventoDaConversa = NonNullable<Motion["eventos"]>[number];
export type TipoEfeito = z.infer<typeof tipoEfeitoSchema>;
export type Efeito = z.infer<typeof efeitoSchema>;
export type EstiloLegenda = z.infer<typeof estiloLegendaSchema>;
export type PosicaoLegenda = z.infer<typeof posicaoLegendaSchema>;
export type AparenciaLegendas = z.infer<typeof aparenciaLegendasSchema>;
export type Timeline = z.infer<typeof timelineSchema>;

// Cena de fundo animado: url "fundo:<estilo>" (estilo desconhecido = neon).
export const urlDoFundo = (estilo: EstiloFundo) => `${PREFIXO_FUNDO}${estilo}`;
export const estiloDoFundo = (url: string): EstiloFundo => {
  const e = estiloFundoSchema.safeParse(url.slice(PREFIXO_FUNDO.length));
  return e.success ? e.data : "neon";
};

// Timeline salva antes das faixas Motion e Efeitos: ganha as duas vazias.
export const normalizarTimeline = (
  t: Omit<Timeline, "motions" | "efeitos"> &
    Partial<Pick<Timeline, "motions" | "efeitos">>,
): Timeline => ({ ...t, motions: t.motions ?? [], efeitos: t.efeitos ?? [] });
