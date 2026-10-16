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
// zoom rápido e flash (push-cut).
export const tipoTransicaoSchema = z.enum([
  "corte",
  "fade",
  "slide",
  "cortina",
  "virar",
  "relogio",
  "iris",
  "impacto",
]);

// De onde a cena nova entra (vale para slide, cortina e virar).
export const direcaoSchema = z.enum(["esquerda", "direita", "cima", "baixo"]);

// Trilha principal: as cenas, em sequência.
export const clipeSchema = z.object({
  url: z.string(),
  // Cenas podem ser vídeos ou imagens paradas (sem valor = vídeo).
  // Numa imagem, inicio/fim só definem quanto tempo ela fica na tela.
  tipo: z.enum(["video", "imagem"]).optional(),
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
  // Acabamento da janela (quando não é tela cheia).
  acabamento: z
    .object({ borda: z.boolean(), cantos: z.boolean(), sombra: z.boolean() })
    .optional(),
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
  // Estilo padrão das legendas (sem valor = clássico).
  estiloLegenda: estiloLegendaSchema.optional(),
  aparenciaLegendas: aparenciaLegendasSchema.optional(),
});

export type TipoTransicao = z.infer<typeof tipoTransicaoSchema>;
export type Direcao = z.infer<typeof direcaoSchema>;
export type Clipe = z.infer<typeof clipeSchema>;
export type Insert = z.infer<typeof insertSchema>;
export type AudioFaixa = z.infer<typeof audioSchema>;
export type Zoom = z.infer<typeof zoomSchema>;
export type Legenda = z.infer<typeof legendaSchema>;
export type EstiloLegenda = z.infer<typeof estiloLegendaSchema>;
export type PosicaoLegenda = z.infer<typeof posicaoLegendaSchema>;
export type AparenciaLegendas = z.infer<typeof aparenciaLegendasSchema>;
export type Timeline = z.infer<typeof timelineSchema>;
