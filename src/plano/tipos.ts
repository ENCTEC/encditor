import { z } from "zod";
import { LAYOUTS, POSICOES } from "@/timeline/caixas";
import { IDS_FORMATO } from "@/timeline/formatos";
import {
  estiloLegendaSchema,
  posicaoLegendaSchema,
  tipoTransicaoSchema,
} from "@/timeline/schema";

// Planejamento de um vídeo (aba Planejar): o que o usuário informa
// (briefing), a conversa com a IA planejadora e o plano que ela devolve
// (roteiro/copy, takes do Higgsfield, reaproveitamento do banco e edição).

// ---------- O que o usuário informa ----------

export const FINALIDADES_EXEMPLO = {
  edicao: "Edição (ritmo, cortes, legendas, efeitos)",
  angulo: "Ângulo / enquadramento de câmera",
  cena: "Cena específica (quero algo assim)",
  estilo: "Estilo visual (cor, luz, cenário, figurino)",
  outro: "Outro",
} as const;

export const exemploSchema = z.object({
  id: z.string(),
  url: z.string(),
  nomeArquivo: z.string(),
  formato: z.enum(["video", "imagem"]),
  duracao: z.number().nullable(),
  finalidade: z.enum(
    Object.keys(FINALIDADES_EXEMPLO) as [keyof typeof FINALIDADES_EXEMPLO],
  ),
  // O que copiar desse exemplo ("o zoom no rosto aos 3s", "esse ângulo de
  // cima"). A IA pergunta quando estiver vago.
  detalhe: z.string(),
});
export type Exemplo = z.infer<typeof exemploSchema>;

export const briefingSchema = z.object({
  // Ideia do vídeo (o principal: a IA cria o roteiro a partir dela).
  ideia: z.string(),
  // Texto pronto do usuário, opcional (vazio = a IA cria do zero).
  roteiro: z.string(),
  // Produto, oferta, público, objetivo do vídeo.
  objetivo: z.string(),
  formato: z.enum(IDS_FORMATO).nullable(),
  duracaoAlvo: z.number().nullable(),
  // Cenas que precisam estar no vídeo.
  obrigatorias: z.array(z.string()),
  exemplos: z.array(exemploSchema),
  // Ids dos elementos do Higgsfield (do cliente) para usar.
  elementos: z.array(z.string()),
  observacoes: z.string(),
});
export type Briefing = z.infer<typeof briefingSchema>;

export const briefingVazio = (): Briefing => ({
  ideia: "",
  roteiro: "",
  objetivo: "",
  formato: null,
  duracaoAlvo: null,
  obrigatorias: [],
  exemplos: [],
  elementos: [],
  observacoes: "",
});

// ---------- O plano que a IA devolve ----------
// Todos os campos são obrigatórios (formato estrito da OpenAI); "null"
// quando não se aplica. Números são conferidos/limitados depois.

const POSICOES_INSERT = [...LAYOUTS, ...POSICOES] as const;

export const VOLUMES_TAKE = {
  mudo: "Sem o som do take",
  ambiente: "Som ambiente baixo, por baixo da narração",
  efeito: "Efeito pontual mais alto (explosão, avião…)",
  fala: "Fala do próprio take em volume cheio",
} as const;

const transicaoPlano = z
  .object({ tipo: tipoTransicaoSchema, duracao_s: z.number() })
  .nullable();

export const cenaPlanoSchema = z.object({
  numero: z.number(),
  // Nome do take (vira o @apelido ao enviar), ex.: "take01-gancho".
  apelido: z.string(),
  origem: z.enum(["higgsfield", "banco"]),
  // Origem "banco": arquivo já enviado em outro projeto do cliente.
  apelido_banco: z.string().nullable(),
  trecho_banco_de: z.number().nullable(),
  trecho_banco_ate: z.number().nullable(),
  // Trecho da narração/fala que acontece durante esta cena.
  fala: z.string(),
  descricao: z.string(),
  duracao_s: z.number(),
  // Duração para gerar no Higgsfield (o mínimo que serve; ver
  // verificarNarracao.ts — o ENCeditor estica em câmera lenta leve).
  duracao_gerar_s: z.number().nullable(),
  // Prompt pronto para o Higgsfield, com os @elementos.
  prompt_higgsfield: z.string().nullable(),
  elementos: z.array(z.string()),
  // O que é feito na geração (movimentos de câmera, efeitos complexos) e
  // o que fica para o ENCeditor (cortes, zoom, transição, legenda).
  feito_no_higgsfield: z.string(),
  feito_no_enceditor: z.string(),
  // Som pedido no prompt (ex.: "barulho de avião passando") e como ele
  // entra por baixo da narração.
  som_do_take: z.string(),
  volume_do_take: z.enum(
    Object.keys(VOLUMES_TAKE) as [keyof typeof VOLUMES_TAKE],
  ),
  transicao_entrada: transicaoPlano,
  zoom: z
    .object({ frase: z.string(), escala: z.number(), rampa_s: z.number() })
    .nullable(),
  // Como GRAVAR a fala desta cena (guia para o usuário e para a voz de
  // exemplo): entonação, palavras com ênfase, ritmo e pausa depois.
  entonacao: z.string(),
  enfase: z.array(z.string()),
  ritmo: z.enum(["lento", "normal", "rapido"]),
  pausa_depois_s: z.number(),
  // Por que esta cena (dados, exemplos, aprendizados).
  motivo: z.string(),
});
export type CenaPlano = z.infer<typeof cenaPlanoSchema>;

export const insertPlanoSchema = z.object({
  apelido: z.string(),
  origem: z.enum(["higgsfield", "banco", "enviar"]),
  apelido_banco: z.string().nullable(),
  trecho_banco_de: z.number().nullable(),
  // Frase da narração em que o insert aparece.
  frase: z.string(),
  duracao_s: z.number(),
  posicao: z.enum(POSICOES_INSERT),
  tamanho: z.enum(["P", "M", "G"]),
  prompt_higgsfield: z.string().nullable(),
  descricao: z.string(),
  motivo: z.string(),
});
export type InsertPlano = z.infer<typeof insertPlanoSchema>;

export const planoGeradoSchema = z.object({
  titulo: z.string(),
  ideia: z.string(),
  // narracao = voz em off separada (o usuário envia o áudio);
  // fala_nos_takes = os próprios takes falam; so_musica = sem fala.
  modo_audio: z.enum(["narracao", "fala_nos_takes", "so_musica"]),
  // Texto completo da narração (ou das falas), já melhorado.
  copy: z.string(),
  melhorias_no_roteiro: z.string(),
  aprendizados_aplicados: z.array(z.string()),
  formato: z.enum(IDS_FORMATO),
  duracao_total_s: z.number(),
  narracao: z
    .object({ apelido: z.string(), orientacoes: z.string() })
    .nullable(),
  cenas: z.array(cenaPlanoSchema),
  inserts: z.array(insertPlanoSchema),
  legendas: z.object({
    usar: z.boolean(),
    estilo: estiloLegendaSchema,
    palavras_por_legenda: z.number(),
    tamanho_percent: z.number().nullable(),
    posicao: posicaoLegendaSchema.nullable(),
  }),
  musica: z.object({
    usar: z.boolean(),
    apelido: z.string(),
    descricao: z.string(),
    volume_percent: z.number(),
  }),
});
export type PlanoGerado = z.infer<typeof planoGeradoSchema>;

export const respostaPlanejadorSchema = z.object({
  // Texto para o usuário (perguntas, explicação do plano, mudanças).
  mensagem: z.string(),
  // Plano completo (atualizado) ou null se ainda faltam respostas.
  plano: planoGeradoSchema.nullable(),
});

// ---------- O que fica salvo ----------

export const mensagemPlanoSchema = z.object({
  autor: z.enum(["usuario", "ia"]),
  texto: z.string(),
  em: z.number(),
});
export type MensagemPlano = z.infer<typeof mensagemPlanoSchema>;

// Conferência da narração gravada: onde cada fala foi dita, quanto cada
// cena dura de verdade e quanto gerar no Higgsfield (antes dos takes).
export const verificacaoNarracaoSchema = z.object({
  // Arquivo da narração conferido (outro arquivo = conferir de novo).
  midiaId: z.string(),
  // Versão do jeito de conferir (versão antiga = conferir de novo).
  versao: z.number().optional(),
  // Respiros longos encurtados na edição (e os segundos que saíram).
  respiros: z.object({ quantos: z.number(), segundos: z.number() }).optional(),
  // geradoEm do plano conferido (plano novo = conferir de novo).
  doPlano: z.number().nullable(),
  duracao: z.number(),
  em: z.number(),
  cenas: z.array(
    z.object({
      numero: z.number(),
      inicio: z.number(),
      duracao: z.number(),
      gerar: z.number(),
      // O que foi dito no intervalo da cena e se bate com o roteiro.
      falou: z.string(),
      confere: z.boolean(),
    }),
  ),
  avisos: z.array(z.string()),
});
export type VerificacaoNarracao = z.infer<typeof verificacaoNarracaoSchema>;

// Olhada da IA em cada take enviado (só informativa, não trava nada):
// confere com o que a cena pedia?
export const conferenciaTakeSchema = z.object({
  // Arquivo olhado (outro arquivo = olhar de novo).
  midiaId: z.string(),
  em: z.number(),
  confere: z.boolean(),
  resumo: z.string(),
  observacoes: z.array(z.string()),
  // Prompt ajustado para gerar de novo (só quando não confere).
  prompt_sugerido: z.string().nullable(),
});
export type ConferenciaTake = z.infer<typeof conferenciaTakeSchema>;

export const planoSalvoSchema = z.object({
  briefing: briefingSchema,
  conversa: z.array(mensagemPlanoSchema),
  gerado: planoGeradoSchema.nullable(),
  geradoEm: z.number().nullable(),
  // Item do plano (ex.: "cena:take01-gancho", "narracao", "musica") →
  // id do arquivo da biblioteca que o atende.
  vinculos: z.record(z.string(), z.string()),
  musicaPulada: z.boolean(),
  montadoEm: z.number().nullable(),
  narracaoVerificada: verificacaoNarracaoSchema.nullable(),
  // Chave do item ("cena:<apelido>") → olhada da IA no take enviado.
  conferenciaTakes: z.record(z.string(), conferenciaTakeSchema),
  // Narração de exemplo (voz sintética) para o usuário copiar a entonação.
  vozTeste: z
    .object({
      voz: z.string(),
      // Impressão digital do texto + indicações: muda = precisa refazer.
      chave: z.string(),
      // geradoEm do plano lido (outro plano = a voz ficou desatualizada).
      doPlano: z.number().nullable(),
      arquivo: z.string(),
      trechos: z.array(z.object({ cena: z.number(), arquivo: z.string() })),
    })
    .nullable(),
});
export type PlanoSalvo = z.infer<typeof planoSalvoSchema>;

export const planoVazio = (): PlanoSalvo => ({
  briefing: briefingVazio(),
  conversa: [],
  gerado: null,
  geradoEm: null,
  vinculos: {},
  musicaPulada: false,
  montadoEm: null,
  narracaoVerificada: null,
  conferenciaTakes: {},
  vozTeste: null,
});

// Lê um plano salvo tolerando versões antigas (campos que faltam = padrão).
export const lerPlanoSalvo = (bruto: unknown): PlanoSalvo => {
  const base = planoVazio();
  if (!bruto || typeof bruto !== "object") return base;
  const b = bruto as Partial<PlanoSalvo>;
  const briefing = briefingSchema.safeParse({
    ...base.briefing,
    ...(b.briefing ?? {}),
  });
  // Planos antigos (sem as indicações de gravação) ganham os padrões.
  const brutoGerado = b.gerado as
    | (Record<string, unknown> & { cenas?: Record<string, unknown>[] })
    | null
    | undefined;
  const gerado = planoGeradoSchema.nullable().safeParse(
    brutoGerado
      ? {
          ...brutoGerado,
          cenas: (brutoGerado.cenas ?? []).map((c) => ({
            entonacao: "",
            enfase: [],
            ritmo: "normal",
            pausa_depois_s: 0,
            ...c,
          })),
        }
      : null,
  );
  return {
    briefing: briefing.success ? briefing.data : base.briefing,
    conversa: z
      .array(mensagemPlanoSchema)
      .catch([])
      .parse(b.conversa ?? []),
    gerado: gerado.success ? gerado.data : null,
    geradoEm: typeof b.geradoEm === "number" ? b.geradoEm : null,
    vinculos: z
      .record(z.string(), z.string())
      .catch({})
      .parse(b.vinculos ?? {}),
    musicaPulada: b.musicaPulada === true,
    montadoEm: typeof b.montadoEm === "number" ? b.montadoEm : null,
    conferenciaTakes: z
      .record(z.string(), conferenciaTakeSchema)
      .catch({})
      .parse(b.conferenciaTakes ?? {}),
    narracaoVerificada: verificacaoNarracaoSchema
      .nullable()
      .catch(null)
      .parse(b.narracaoVerificada ?? null),
    vozTeste: planoSalvoSchema.shape.vozTeste
      .catch(null)
      .parse(b.vozTeste ?? null),
  };
};
