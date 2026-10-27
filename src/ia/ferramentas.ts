import { z } from "zod";
import { Midia } from "@/projeto/tipos";
import {
  calcularClipes,
  calcularDuracaoTotal,
  inicioDosClipes,
  validarTimeline,
} from "@/timeline/calculos";
import {
  adicionarItem,
  atualizarItem,
  definirFormato,
  colocarCena,
  colocarFundo,
  apararItem,
  cortarTrecho,
  dividirClipe,
  dividirItemNoTempo,
  duplicarItem,
  ehEfeitoSonoro,
  fimDosAudios,
  juntarItens,
  sobreposicaoDeAudio,
  Faixa,
  moverClipe,
  removerItem,
  substituirNasLegendas,
  trocarUrl,
  urlsDeMusica as musicasDaTimeline,
} from "@/timeline/operacoes";
import {
  EFEITOS_VISUAIS,
  EfeitoAudio,
  IDS_EFEITOS_AUDIO,
  IDS_SONS,
  MOTIONS,
  SONS,
} from "@/catalogo/estilos";
import {
  adicionarSom,
  momentoDoSomDoMotion,
  somDoEfeito,
  somDoMotion,
  sonsAutomaticos,
} from "@/timeline/efeitosSonoros";
import { nomeDaUrl } from "@/servidor/armazenamento";
import { aplicarEfeitos } from "@/servidor/efeitos";
import { envelopeDoArquivo } from "@/servidor/envelope";
import { estudarExemplo } from "@/servidor/estudarExemplo";
import { medirVoz } from "@/servidor/medirVoz";
import { buscarFoto, buscarLogo } from "@/servidor/buscarNaWeb";
import { salvarMidiasDoCliente, salvarPadrao } from "@/servidor/banco";
import { padroesDisponiveis } from "./padroes";
import { conferirVideo } from "@/servidor/conferirVideo";
import { semItens } from "./conferencia";
import { salvarDirecaoDoCliente } from "@/servidor/banco";
import { lerAnaliseSalva } from "@/servidor/armazenamento";
import { formatoPorId, IDS_FORMATO } from "@/timeline/formatos";
import {
  acaoDaConversaSchema,
  Camada,
  camadaSchema,
  direcaoSchema,
  DirecaoDeArte,
  Efeito,
  estiloFundoSchema,
  estiloLegendaSchema,
  modeloMotionSchema,
  Motion,
  posicaoLegendaSchema,
  Timeline,
  tipoEfeitoSchema,
  tipoTransicaoSchema,
  urlDoFundo,
} from "@/timeline/schema";
import {
  buscarFala,
  gerarLegendas,
  momentosNoVideoFinal,
  palavrasDaMidia,
  palavrasNoVideoFinal,
} from "./conteudo";
import { buscarNoBanco } from "./busca-banco";
import { encenar, tempoDasPalavras } from "./encenar";
import { palavrasDoTexto } from "@/timeline/palavras";
import { resumoDoProjeto } from "./estado";
import {
  caixaDoCelular,
  caixaPadrao,
  caixaParaPosicao,
  ehTelaCheia,
  LAYOUTS,
  POSICOES,
  Tamanho,
} from "@/timeline/caixas";

const posicaoSchema = z.enum([...LAYOUTS, ...POSICOES, "janela"]);
const tamanhoSchema = z.enum(["P", "M", "G"]);

// Ferramentas que a IA (GPT ou Claude) usa para editar. Todas trabalham
// numa cópia da timeline ("sessao"); o app só recebe o resultado no final,
// e a edição inteira vira um único passo de desfazer.

// Formato neutro: cada fornecedor de IA converte para o seu (veja
// openai.ts e claude.ts nesta pasta).
export type Ferramenta<S extends z.ZodType = z.ZodType> = {
  name: string;
  description: string;
  inputSchema: S;
  run: (entrada: z.infer<S>) => string | Promise<string>;
};

const ferramenta = <S extends z.ZodType>(f: Ferramenta<S>) =>
  f as unknown as Ferramenta;

export type SessaoEdicao = {
  timeline: Timeline;
  // Arquivos deste projeto.
  biblioteca: Midia[];
  // Banco inteiro do cliente (para buscar_no_banco e reaproveitar).
  banco?: Midia[];
  // Mídias que a IA alterou (ex.: efeitos de áudio), para o app atualizar.
  midiasAlteradas?: Midia[];
  // Mídias que a IA criou (ex.: logo baixada da web), para o app guardar.
  midiasNovas?: Midia[];
  // Projeto aberto (os arquivos novos ficam marcados nele).
  projetoId?: string;
  // Inserts colocados sem posição definida: o app abre o popup para o
  // usuário escolher onde ficam e o tamanho.
  insertsParaPosicionar?: number[];
  // Frases curtas do que foi feito, para mostrar no chat.
  acoes: string[];
  // Cliente do projeto (para guardar a direção de arte dele).
  clienteId?: string;
  // Exemplos enviados no Planejar (para estudar_exemplo).
  exemplosDoPlano?: {
    url: string;
    formato: "video" | "imagem";
    duracao: number | null;
    finalidade: string;
    detalhe: string;
  }[];
  // Para conferir_video gerar e olhar os quadros (vem da rota do chat):
  // o endereço do app, o que o usuário pediu e o aviso da barra.
  conferencia?: {
    origem: string;
    contexto: () => string;
    aviso?: (texto: string) => void;
    // Quantas vezes conferir_video rodou neste pedido e a timeline que ela
    // conferiu por último (a conferência final só olha o que mudou depois).
    vezes?: number;
    ultima?: Timeline;
  };
};

// Energia da direção de arte → quanto o fundo animado se mexe.
const ENERGIA = { calma: 0.25, media: 0.5, alta: 0.85 } as const;

// O ritmo que combina com cada energia (devolvido para a IA seguir).
const RITMO_DA_ENERGIA = {
  calma:
    "telas de 2,5 a 4s, um grafismo por tela, transições suaves, só 2 ou 3 efeitos sonoros.",
  media:
    "telas de 1,5 a 3s, grafismos variados, sons em 3 a 6 momentos-chave.",
  alta: "telas de 1 a 2s, mais etiquetas/toques e impactos, sons nos momentos fortes (sem poluir).",
} as const;

const s = (n: number) => Math.round(n * 100) / 100;

const normalizar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const FAIXA_POR_TIPO: Record<string, Faixa> = {
  cena: "clipes",
  insert: "inserts",
  audio: "audios",
  zoom: "zooms",
  legenda: "legendas",
  motion: "motions",
  efeito: "efeitos",
};

const TIPOS_DE_ITEM = [
  "cena",
  "insert",
  "audio",
  "zoom",
  "legenda",
  "motion",
  "efeito",
] as const;

// Quanto um motion fica na tela quando a IA não diz (itens = itens da
// lista ou palavras do texto).
const DURACAO_NEON: Partial<Record<Motion["modelo"], number>> = {
  etiqueta: 2,
  anel: 1.8,
  digitando: 3,
  barra: 2,
  comentario: 3.2,
  curtida: 1.8,
  toque: 1,
  brilho: 1.2,
  microfone: 2,
  confirmado: 1.6,
  conversa: 8,
  edicao: 3,
  rec: 2,
};
const duracaoPadraoDoMotion = (
  modelo: Motion["modelo"],
  itens: number,
  palavras: number,
) =>
  modelo === "lista"
    ? 1.2 + itens * 0.6 + 1
    : modelo === "fala"
      ? Math.max(1.5, palavras * 0.35 + 0.8)
      : (DURACAO_NEON[modelo] ??
        (modelo === "frase" || modelo === "selo"
          ? 1.8
          : modelo === "contador"
            ? 2.6
            : modelo === "ficha" || modelo === "vigilancia"
              ? 4
              : modelo === "fio" || modelo === "nota" || modelo === "fita"
                ? 3
                : 2.5));

export const criarFerramentas = (sessao: SessaoEdicao) => {
  const duracaoTotal = () =>
    s(
      calcularDuracaoTotal(calcularClipes(sessao.timeline)) /
        sessao.timeline.fps,
    );

  const urlsDeMusica = (t: Timeline) => musicasDaTimeline(t, sessao.biblioteca);

  // Aceita o nome ("Insert 2"), o apelido ("@videolael" ou "videolael")
  // ou o nome original do arquivo.
  // Caixa (posição/tamanho em %) a partir de um atalho de posição.
  const caixaPara = (
    posicao: z.infer<typeof posicaoSchema>,
    tamanho: Tamanho | null,
    midia?: Pick<Midia, "largura" | "altura">,
    largura?: number | null,
  ) => {
    const proporcaoMidia =
      midia?.largura && midia.altura ? midia.largura / midia.altura : 16 / 9;
    return caixaParaPosicao(
      posicao,
      tamanho,
      proporcaoMidia,
      sessao.timeline.largura / sessao.timeline.altura,
      largura,
    );
  };

  // Camadas de um desenho: imagem por @apelido vira o endereço do arquivo.
  const camadasComImagens = (camadas: Camada[]) =>
    camadas.map((k) => {
      if (!k.imagem || k.imagem.startsWith("/") || /^https?:/.test(k.imagem)) return k;
      const m = acharMidia(k.imagem);
      if (m.formato !== "imagem") throw new Error(`"${k.imagem}" não é uma imagem.`);
      return { ...k, imagem: m.url };
    });

  // As camadas de um padrão com textos trocados e campos ajustados.
  const camadasDoPadrao = (
    nome: string,
    trocas: { de: string; para: string }[],
    ajustes: (Partial<Camada> & { camada: number })[],
  ) => {
    const p = padroesDisponiveis(sessao.clienteId).find((x) => x.nome === nome);
    if (!p) throw new Error(`Não há o padrão "${nome}".`);
    const trocar = (texto?: string) =>
      texto === undefined
        ? undefined
        : trocas.reduce((t, x) => t.split(x.de).join(x.para), texto);
    const camadas = p.camadas.map((k) => ({
      ...k,
      ...(k.texto !== undefined ? { texto: trocar(k.texto) } : {}),
      ...(k.conta
        ? { conta: { ...k.conta, antes: trocar(k.conta.antes), depois: trocar(k.conta.depois) } }
        : {}),
    }));
    for (const { camada, ...campos } of ajustes) {
      if (!camadas[camada]) throw new Error(`O padrão "${nome}" não tem a camada ${camada}.`);
      camadas[camada] = { ...camadas[camada], ...campos } as Camada;
    }
    return camadasComImagens(camadas);
  };

  const acharMidia = (nome: string) => {
    const alvo = normalizar(nome.replace(/^@/, ""));
    const combina = (m: Midia) =>
      normalizar(m.apelido ?? "") === alvo ||
      normalizar(m.nome) === alvo ||
      normalizar(m.nomeArquivo) === alvo;
    let midia = sessao.biblioteca.find(combina);
    if (!midia) {
      // Reaproveitado do banco do cliente (achado com buscar_no_banco):
      // pelo apelido, que é único no banco.
      midia = sessao.banco?.find((m) => normalizar(m.apelido ?? "") === alvo);
      if (midia) sessao.biblioteca = [...sessao.biblioteca, midia];
    }
    if (!midia) {
      const nomes =
        sessao.biblioteca.map((m) => `${m.nome} (@${m.apelido})`).join(", ") ||
        "nenhum";
      throw new Error(
        `Não existe "${nome}" na biblioteca. Disponíveis: ${nomes}.`,
      );
    }
    return midia;
  };

  const conferirCena = (cena: number) => {
    const total = sessao.timeline.clipes.length;
    if (!Number.isInteger(cena) || cena < 1 || cena > total) {
      throw new Error(
        `Cena ${cena} não existe (o vídeo tem ${total} cena(s)).`,
      );
    }
    return cena - 1;
  };

  // Volume da narração num trecho do vídeo final (para o fundo pulsar).
  const ondaDoTrecho = async (t: Timeline, de: number, ate: number) => {
    const audio = t.audios.find(
      (a) =>
        !ehEfeitoSonoro(a.url) &&
        a.inicio < ate &&
        a.fim > de &&
        sessao.biblioteca.some(
          (x) => x.url === a.url && x.analise?.transcricao,
        ),
    );
    if (!audio) return undefined;
    const comeco = Math.max(de, audio.inicio);
    const desde = audio.origemInicio + (comeco - audio.inicio);
    try {
      const valores = await envelopeDoArquivo(
        audio.url,
        desde,
        desde + (Math.min(ate, audio.fim) - comeco),
        15,
      );
      return { de: s(comeco - de), taxa: 15, valores };
    } catch {
      return undefined;
    }
  };

  // Ajustes (cores, energia, pulsar com a voz) nas cenas de fundo animado:
  // "indices" = só essas cenas; null = todas.
  const ajustarFundos = async (
    t: Timeline,
    indices: number[] | null,
    ajustes: { cores?: string[]; energia?: number; pulsar?: boolean },
  ): Promise<Timeline> => {
    const clipes = calcularClipes(t);
    const inicios = inicioDosClipes(clipes);
    const novos = await Promise.all(
      t.clipes.map(async (c, i) => {
        if (c.tipo !== "fundo" || (indices && !indices.includes(i))) return c;
        const de = inicios[i] / t.fps;
        const ate = de + clipes[i].duracaoFrames / t.fps;
        const fundo = {
          ...c.fundo,
          ...(ajustes.cores ? { cores: ajustes.cores } : {}),
          ...(ajustes.energia !== undefined ? { energia: ajustes.energia } : {}),
        };
        if (ajustes.pulsar) {
          const onda = await ondaDoTrecho(t, de, ate);
          if (onda) fundo.onda = onda;
        } else if (ajustes.pulsar === false) {
          delete fundo.onda;
        }
        return { ...c, fundo };
      }),
    );
    return { ...t, clipes: novos };
  };

  // Onda do áudio "gravado" numa conversa: o volume da narração entre os
  // eventos gravar e enviar_audio (se não der, fica a onda inventada).
  const ondaDaConversa = async (t: Timeline, m: Motion): Promise<Motion> => {
    const gravar = m.eventos?.find((e) => e.acao === "gravar");
    const enviar = m.eventos?.find(
      (e) => e.acao === "enviar_audio" && !!gravar && e.de > gravar.de,
    );
    if (m.modelo !== "conversa" || m.onda || !gravar || !enviar) return m;
    const de = m.inicio + gravar.de;
    const audio = t.audios.find(
      (a) =>
        !ehEfeitoSonoro(a.url) &&
        a.inicio <= de &&
        a.fim > de &&
        sessao.biblioteca.some(
          (x) => x.url === a.url && x.analise?.transcricao,
        ),
    );
    if (!audio) return m;
    try {
      const desde = audio.origemInicio + (de - audio.inicio);
      const valores = await envelopeDoArquivo(
        audio.url,
        desde,
        desde + (enviar.de - gravar.de) + 0.2,
      );
      return { ...m, onda: { de: gravar.de, taxa: 30, valores } };
    } catch {
      return m;
    }
  };

  // Aplica a operação, valida e registra. Se der erro, nada muda e o erro
  // volta para o Claude (o Tool Runner transforma em resultado de erro).
  const aplicar = (operacao: (t: Timeline) => Timeline, descricao: string) => {
    const nova = operacao(sessao.timeline);
    validarTimeline(nova);
    // Trava contra o erro mais comum de corte: pedaços do mesmo áudio
    // tocando por cima um do outro (a fala se repete).
    const sobreposto = sobreposicaoDeAudio(nova);
    if (sobreposto && !sobreposicaoDeAudio(sessao.timeline)) {
      throw new Error(
        `Não apliquei: ${sobreposto}. Para tirar um pedaço da fala use cortar_trecho (fecha o buraco) ou aparar_item; para dividir, dividir_item.`,
      );
    }
    sessao.timeline = nova;
    sessao.acoes.push(descricao);
    return `OK: ${descricao}. Duração total agora: ${duracaoTotal()}s.`;
  };

  const lista = [
    ferramenta({
      name: "ver_projeto",
      description:
        "Mostra o estado atual do projeto: cenas (com onde começam e terminam no vídeo final), inserts, áudios, zooms, legendas e a biblioteca de arquivos. Use depois de mudanças que deslocam tempos (aparar, dividir, mover ou adicionar cenas) antes de posicionar algo por tempo.",
      inputSchema: z.object({}),
      run: () =>
        JSON.stringify(resumoDoProjeto(sessao.timeline, sessao.biblioteca)),
    }),

    ferramenta({
      name: "colocar_insert",
      description:
        "Coloca um vídeo ou imagem da biblioteca POR CIMA da trilha principal, num intervalo do vídeo final (B-roll / insert). Ex.: 'bote o Insert 2 a partir dos 2 segundos'.",
      inputSchema: z.object({
        midia: z.string().describe('Nome na biblioteca, ex.: "Insert 2".'),
        inicio: z
          .number()
          .min(0)
          .describe("Segundo do vídeo final em que aparece."),
        fim: z
          .number()
          .nullable()
          .describe(
            "Segundo do vídeo final em que some. null = imagem dura 3s; vídeo dura o resto do arquivo.",
          ),
        posicao: posicaoSchema
          .nullable()
          .describe(
            "Onde fica: tela-cheia, metades (tela dividida), ou um ponto da grade 3×3 (canto-sup-esq, topo, canto-sup-dir, esquerda, centro, direita, canto-inf-esq, base, canto-inf-dir). 'janela' = canto superior direito. null = o usuário não disse onde. Depois de colocar, o app SEMPRE abre um popup para o usuário confirmar/ajustar a posição e o tamanho, já preenchido com o que você escolheu.",
          ),
        tamanho: tamanhoSchema
          .nullable()
          .describe(
            "Para pontos da grade: P (25%), M (40%, padrão) ou G (60%).",
          ),
        comeca_no_segundo_do_arquivo: z
          .number()
          .min(0)
          .nullable()
          .describe(
            "Só para vídeo: de que segundo do arquivo começar. Padrão 0.",
          ),
        volume: z
          .number()
          .min(0)
          .nullable()
          .describe("Som do insert (0 = mudo, padrão). 1 = volume original."),
      }),
      run: (e) => {
        const midia = acharMidia(e.midia);
        if (midia.formato === "audio") {
          throw new Error(`"${midia.nome}" é áudio; use colocar_audio.`);
        }
        const origem = e.comeca_no_segundo_do_arquivo ?? 0;
        const fim =
          e.fim ??
          (midia.formato === "imagem"
            ? e.inicio + 3
            : e.inicio + Math.max(0.5, (midia.duracao ?? 3) - origem));
        const caixa = caixaPara(e.posicao ?? "tela-cheia", e.tamanho, midia);
        // O app sempre abre o popup de posição/tamanho para o usuário
        // confirmar ou ajustar (já preenchido com o que foi entendido).
        sessao.insertsParaPosicionar = [
          ...(sessao.insertsParaPosicionar ?? []),
          sessao.timeline.inserts.length,
        ];
        return aplicar(
          (t) =>
            adicionarItem(t, "inserts", {
              url: midia.url,
              tipo: midia.formato === "imagem" ? "imagem" : "video",
              inicio: s(e.inicio),
              fim: s(fim),
              origemInicio: origem,
              posicao: ehTelaCheia(caixa) ? "tela-cheia" : "janela",
              volume: e.volume ?? 0,
              caixa,
            }),
          `${midia.nome} de ${s(e.inicio)}s a ${s(fim)}s (${e.posicao ?? "tela-cheia"}${e.tamanho ? ` ${e.tamanho}` : ""})`,
        );
      },
    }),

    ferramenta({
      name: "posicionar_insert",
      description:
        "Muda onde um insert existente fica na tela e o tamanho dele (canto, centro, tela dividida, tela cheia; tamanho P/M/G ou largura exata).",
      inputSchema: z.object({
        numero: z.number().int().min(1),
        posicao: posicaoSchema,
        tamanho: tamanhoSchema.nullable(),
        largura_percent: z
          .number()
          .min(5)
          .max(100)
          .nullable()
          .describe("Largura exata em % da tela (sobrepõe o tamanho)."),
      }),
      run: (e) => {
        const indice = e.numero - 1;
        const insert = sessao.timeline.inserts[indice];
        if (!insert) {
          throw new Error(`Insert ${e.numero} não existe.`);
        }
        const midia = sessao.biblioteca.find((m) => m.url === insert.url);
        const caixa = caixaPara(e.posicao, e.tamanho, midia, e.largura_percent);
        return aplicar(
          (t) =>
            atualizarItem(t, "inserts", indice, {
              caixa,
              posicao: ehTelaCheia(caixa) ? "tela-cheia" : "janela",
            }),
          `insert ${e.numero} em ${e.posicao}${e.tamanho ? ` (${e.tamanho})` : ""}: ${caixa.largura}% × ${caixa.altura}% da tela`,
        );
      },
    }),

    ferramenta({
      name: "acabamento_do_insert",
      description:
        "Muda o acabamento de um insert: dentro de um CELULAR (a imagem vira a tela; ele sobe de baixo — bom para prints de app, site, perfil), moldura de foto polaroid (com um texto escrito à mão embaixo), alfinete vermelho no topo (foto presa num quadro de cortiça — entra 'assentando' no quadro), inclinação, ou o visual comum (borda branca, cantos arredondados, sombra). Para um 'quadro de investigação': imagem de cortiça como cena de fundo, inserts polaroid com alfinete e motions fio/nota/carimbo/ficha. Campos null não mudam.",
      inputSchema: z.object({
        numero: z.number().int().min(1),
        moldura: z
          .enum(["celular", "polaroid", "janela", "sem-moldura"])
          .nullable()
          .describe(
            "celular = dentro de um celular (muda o tamanho para o de um celular, no mesmo centro; de tela cheia vai para o meio); polaroid = foto instantânea; janela = borda branca, cantos arredondados e sombra; sem-moldura = só a imagem.",
          ),
        alfinete: z.boolean().nullable(),
        inclinacao_graus: z
          .number()
          .min(-45)
          .max(45)
          .nullable()
          .describe("Positivo = sentido horário. Fotos num quadro: -8 a 8."),
        rotulo: z
          .string()
          .nullable()
          .describe(
            "Texto à mão na faixa de baixo da polaroid (curto). \"\" = sem texto.",
          ),
      }),
      run: (e) => {
        const indice = e.numero - 1;
        const insert = sessao.timeline.inserts[indice];
        if (!insert) {
          throw new Error(`Insert ${e.numero} não existe.`);
        }
        const atual = insert.acabamento ?? {
          borda: true,
          cantos: true,
          sombra: true,
        };
        const acabamento = {
          ...atual,
          ...(e.moldura === "celular"
            ? {
                celular: true,
                polaroid: false,
                borda: false,
                cantos: false,
                sombra: false,
              }
            : e.moldura === "polaroid"
              ? { polaroid: true, celular: false }
              : e.moldura === "janela"
                ? {
                    polaroid: false,
                    celular: false,
                    borda: true,
                    cantos: true,
                    sombra: true,
                  }
                : e.moldura === "sem-moldura"
                  ? {
                      polaroid: false,
                      celular: false,
                      borda: false,
                      cantos: false,
                      sombra: false,
                    }
                  : {}),
          ...(e.alfinete !== null ? { alfinete: e.alfinete } : {}),
        };
        let caixa = insert.caixa ?? caixaPadrao(insert.posicao);
        // Celular: caixa alta e estreita (proporção de celular), no mesmo
        // centro; de tela cheia, no lugar padrão do celular.
        if (e.moldura === "celular") {
          const padrao = caixaDoCelular(
            sessao.timeline.largura / sessao.timeline.altura,
            null,
          );
          caixa = ehTelaCheia(caixa)
            ? padrao
            : {
                ...padrao,
                x: Math.min(
                  100 - padrao.largura,
                  Math.max(0, caixa.x + caixa.largura / 2 - padrao.largura / 2),
                ),
              };
        }
        if (ehTelaCheia(caixa)) {
          throw new Error(
            `Insert ${e.numero} está em tela cheia: acabamento só vale para janela. Use posicionar_insert antes.`,
          );
        }
        return aplicar(
          (t) =>
            atualizarItem(t, "inserts", indice, {
              acabamento,
              caixa,
              posicao: "janela",
              ...(e.inclinacao_graus !== null
                ? { rotacao: e.inclinacao_graus || undefined }
                : {}),
              ...(e.rotulo !== null
                ? { rotulo: e.rotulo.trim() || undefined }
                : {}),
            }),
          `insert ${e.numero}: ${[
            acabamento.celular ? "dentro de um celular" : null,
            acabamento.polaroid ? "polaroid" : null,
            acabamento.alfinete ? "com alfinete" : null,
            e.inclinacao_graus !== null ? `${e.inclinacao_graus}°` : null,
            e.rotulo ? `"${e.rotulo}"` : null,
          ]
            .filter(Boolean)
            .join(", ") || "acabamento alterado"}`,
        );
      },
    }),

    ferramenta({
      name: "colocar_audio",
      description:
        "Coloca um áudio da biblioteca (música, narração, efeito) a partir de um segundo do vídeo final.",
      inputSchema: z.object({
        midia: z.string().describe('Nome na biblioteca, ex.: "Áudio 1".'),
        inicio: z
          .number()
          .min(0)
          .describe("Segundo do vídeo final em que começa."),
        fim: z
          .number()
          .nullable()
          .describe(
            "Segundo em que para. null = até acabar o áudio ou o vídeo.",
          ),
        volume: z
          .number()
          .min(0)
          .nullable()
          .describe(
            "1 = original (padrão). Música de fundo sob fala: 0.2 a 0.4.",
          ),
        fade_entrada: z
          .number()
          .min(0)
          .nullable()
          .describe("Segundos. Padrão 0."),
        fade_saida: z
          .number()
          .min(0)
          .nullable()
          .describe("Segundos. Padrão 0."),
        comeca_no_segundo_do_arquivo: z
          .number()
          .min(0)
          .nullable()
          .describe("De que segundo do arquivo começar. Padrão 0."),
      }),
      run: (e) => {
        const midia = acharMidia(e.midia);
        if (midia.formato !== "audio" && midia.formato !== "video") {
          throw new Error(`"${midia.nome}" não tem som.`);
        }
        const origem = e.comeca_no_segundo_do_arquivo ?? 0;
        const fimDoArquivo =
          midia.duracao !== null ? e.inicio + midia.duracao - origem : Infinity;
        const fim =
          e.fim ??
          Math.min(fimDoArquivo, Math.max(duracaoTotal(), e.inicio + 1));
        return aplicar(
          (t) =>
            adicionarItem(t, "audios", {
              url: midia.url,
              inicio: s(e.inicio),
              fim: s(fim),
              origemInicio: origem,
              volume: e.volume ?? 1,
              fadeEntrada: e.fade_entrada ?? 0,
              fadeSaida: e.fade_saida ?? 0,
            }),
          `${midia.nome} de ${s(e.inicio)}s a ${s(fim)}s (volume ${e.volume ?? 1})`,
        );
      },
    }),

    ferramenta({
      name: "definir_transicao",
      description:
        "Define a transição de ENTRADA de uma cena (entre ela e a anterior). Tipos: corte (seco), fade (dissolve), slide (empurra), cortina (revela passando por cima), virar (gira como carta), relogio (revela em círculo como ponteiro), iris (círculo abrindo do centro), impacto (zoom rápido com flash). A cena 1 não tem transição de entrada.",
      inputSchema: z.object({
        cena: z
          .number()
          .int()
          .nullable()
          .describe(
            "Número da cena (2 em diante). null = aplicar em todas as cenas a partir da 2.",
          ),
        tipo: tipoTransicaoSchema,
        direcao: direcaoSchema
          .nullable()
          .describe(
            "De onde a cena nova entra (slide, cortina, virar). null = padrão.",
          ),
        duracao_s: z
          .number()
          .min(0.1)
          .max(3)
          .nullable()
          .describe("Duração desta transição. null = padrão do projeto."),
      }),
      run: (e) => {
        const total = sessao.timeline.clipes.length;
        if (e.cena === 1) {
          throw new Error(
            "A cena 1 é a primeira e não tem transição de entrada.",
          );
        }
        const indices =
          e.cena === null
            ? Array.from({ length: Math.max(0, total - 1) }, (_, i) => i + 1)
            : [conferirCena(e.cena)];
        if (indices.length === 0) {
          throw new Error(
            "É preciso ter pelo menos 2 cenas para usar transição.",
          );
        }
        const mudancas = {
          transicao: e.tipo,
          direcao: e.direcao ?? undefined,
          duracaoTransicao: e.duracao_s ?? undefined,
        };
        return aplicar(
          (t) =>
            indices.reduce(
              (acc, i) => atualizarItem(acc, "clipes", i, mudancas),
              t,
            ),
          `transição "${e.tipo}"${e.direcao ? ` (${e.direcao})` : ""}${e.duracao_s ? ` de ${e.duracao_s}s` : ""} na entrada da${indices.length > 1 ? "s cenas" : " cena"} ${indices.map((i) => i + 1).join(", ")}`,
        );
      },
    }),

    ferramenta({
      name: "aparar_cena",
      description:
        "Corta o começo e/ou o final de uma cena. Use cortar_do_comeco_s / cortar_do_final_s para pedidos como 'corte 2 segundos do começo', ou de/ate para escolher o trecho exato do ARQUIVO.",
      inputSchema: z.object({
        cena: z.number().int(),
        cortar_do_comeco_s: z.number().min(0).nullable(),
        cortar_do_final_s: z.number().min(0).nullable(),
        de: z
          .number()
          .min(0)
          .nullable()
          .describe("Novo início no arquivo (segundos)."),
        ate: z
          .number()
          .min(0)
          .nullable()
          .describe("Novo fim no arquivo (segundos)."),
      }),
      run: (e) => {
        const i = conferirCena(e.cena);
        const clipe = sessao.timeline.clipes[i];
        const midia = sessao.biblioteca.find((m) => m.url === clipe.url);
        let inicio = e.de ?? clipe.inicio;
        let fim = e.ate ?? clipe.fim;
        inicio += e.cortar_do_comeco_s ?? 0;
        fim -= e.cortar_do_final_s ?? 0;
        if (midia?.duracao && fim > midia.duracao) {
          throw new Error(
            `O arquivo da cena ${e.cena} só tem ${s(midia.duracao)}s.`,
          );
        }
        return aplicar(
          (t) =>
            atualizarItem(t, "clipes", i, { inicio: s(inicio), fim: s(fim) }),
          `cena ${e.cena} agora usa ${s(inicio)}s–${s(fim)}s do arquivo`,
        );
      },
    }),

    ferramenta({
      name: "dividir_cena",
      description:
        "Corta (divide) o vídeo em dois num ponto do vídeo final, criando duas cenas. Útil para depois remover um pedaço ou colocar algo entre as partes.",
      inputSchema: z.object({
        no_segundo: z
          .number()
          .min(0)
          .describe("Segundo do vídeo final onde dividir."),
      }),
      run: (e) => {
        const t = sessao.timeline;
        const clipes = calcularClipes(t);
        const inicios = inicioDosClipes(clipes);
        const frame = Math.round(e.no_segundo * t.fps);
        // Procura de trás para frente: em sobreposições de transição, vale a cena que está entrando.
        let i = -1;
        for (let k = clipes.length - 1; k >= 0; k--) {
          if (
            frame > inicios[k] &&
            frame < inicios[k] + clipes[k].duracaoFrames
          ) {
            i = k;
            break;
          }
        }
        if (i < 0) {
          throw new Error(
            `Nenhuma cena no segundo ${e.no_segundo} (o vídeo tem ${duracaoTotal()}s).`,
          );
        }
        const dentro = (frame - inicios[i]) / t.fps;
        return aplicar(
          (tl) => dividirClipe(tl, i, dentro),
          `cena ${i + 1} dividida em ${s(e.no_segundo)}s (agora são as cenas ${i + 1} e ${i + 2})`,
        );
      },
    }),

    ferramenta({
      name: "velocidade_da_cena",
      description:
        "Câmera lenta ou rápida numa cena (0.8 = lenta leve; 1 = normal; 1.25 = rápida). O trecho do arquivo continua o mesmo: a cena fica mais longa (lenta) ou mais curta (rápida) no vídeo. Use para esticar um take um pouco curto e cobrir a fala sem buraco, ou para dar ênfase. Abaixo de 0.75 já parece artificial.",
      inputSchema: z.object({
        cena: z
          .number()
          .int()
          .min(1)
          .nullable()
          .describe("Número da cena; null = todas."),
        velocidade: z.number().min(0.5).max(2),
      }),
      run: (e) => {
        if (e.cena !== null) conferirCena(e.cena);
        const normal = Math.abs(e.velocidade - 1) < 0.001;
        return aplicar(
          (t) => ({
            ...t,
            clipes: t.clipes.map((c, i) =>
              e.cena === null || i === e.cena - 1
                ? { ...c, velocidade: normal ? undefined : e.velocidade }
                : c,
            ),
          }),
          `${e.cena === null ? "todas as cenas" : `cena ${e.cena}`} em ${normal ? "velocidade normal" : `${e.velocidade}×`}`,
        );
      },
    }),

    ferramenta({
      name: "cortar_trecho",
      description:
        "Tira um trecho do vídeo final e FECHA O BURACO (ripple): cenas, narração, efeitos, inserts, zooms e legendas do trecho saem e tudo o que vem depois anda para trás. A música de fundo não é picotada: continua tocando e só termina mais cedo. Use para cortar respiros, gaguejadas, frases repetidas ou qualquer pedaço que o usuário pedir. Para vários cortes, chame do ÚLTIMO para o primeiro (assim os tempos dos outros não mudam) ou confira com ver_projeto entre um e outro.",
      inputSchema: z.object({
        de: z
          .number()
          .min(0)
          .describe("Segundo do vídeo final onde o corte começa."),
        ate: z
          .number()
          .min(0)
          .describe("Segundo do vídeo final onde o corte termina."),
      }),
      run: (e) => {
        if (e.ate - e.de < 0.02) {
          throw new Error("O fim do corte precisa ser depois do começo.");
        }
        const total = duracaoTotal();
        if (e.de >= total) {
          throw new Error(`O vídeo tem só ${total}s.`);
        }
        return aplicar(
          (t) => cortarTrecho(t, e.de, Math.min(e.ate, total), urlsDeMusica(t)),
          `trecho ${s(e.de)}s–${s(Math.min(e.ate, total))}s cortado (o resto foi puxado para trás)`,
        );
      },
    }),

    ferramenta({
      name: "cortar_respiros",
      description:
        "Encurta os silêncios longos (respiros) de uma narração da timeline sem cortar palavras. Cada pausa maior que pausa_maxima_s vira pausa_nova_s com cortar_trecho (fecha o buraco em todas as faixas: cenas, legendas e efeitos andam junto; a música só termina mais cedo). Só use quando o usuário pedir.",
      inputSchema: z.object({
        audio: z.number().int().min(1).describe("Número do áudio na timeline."),
        pausa_maxima_s: z
          .number()
          .min(0.3)
          .max(3)
          .nullable()
          .describe("Silêncio a partir do qual corta. null = 0.7."),
        pausa_nova_s: z
          .number()
          .min(0.1)
          .max(1.5)
          .nullable()
          .describe("Pausa que fica no lugar. null = 0.35."),
      }),
      run: (e) => {
        const a = sessao.timeline.audios[e.audio - 1];
        if (!a) throw new Error(`Áudio ${e.audio} não existe.`);
        const midia = sessao.biblioteca.find((m) => m.url === a.url);
        const palavras = midia?.analise?.transcricao?.palavras ?? [];
        if (!palavras.length) {
          throw new Error(
            "Esse áudio não tem fala transcrita (analise o arquivo antes).",
          );
        }
        const pausaMaxima = e.pausa_maxima_s ?? 0.7;
        const pausaNova = Math.min(e.pausa_nova_s ?? 0.35, pausaMaxima);
        // Palavras deste trecho do áudio, no tempo do vídeo final.
        const noVideo = palavras
          .map((p) => ({
            de: a.inicio + (p.de - a.origemInicio),
            ate: a.inicio + (p.ate - a.origemInicio),
          }))
          .filter((p) => p.de >= a.inicio - 0.05 && p.ate <= a.fim + 0.05);
        const cortes: { de: number; ate: number }[] = [];
        for (let i = 1; i < noVideo.length; i++) {
          const pausa = noVideo[i].de - noVideo[i - 1].ate;
          if (pausa > pausaMaxima) {
            const meio = pausaNova / 2;
            cortes.push({
              de: noVideo[i - 1].ate + meio,
              ate: noVideo[i].de - meio,
            });
          }
        }
        if (!cortes.length) {
          return "OK: não há respiros longos para cortar nesse áudio.";
        }
        const economizado = cortes.reduce((n, c) => n + c.ate - c.de, 0);
        // Do último para o primeiro: os tempos dos cortes que faltam não mudam.
        return aplicar(
          (t) =>
            [...cortes]
              .reverse()
              .reduce(
                (tl, c) => cortarTrecho(tl, c.de, c.ate, urlsDeMusica(tl)),
                t,
              ),
          `áudio ${e.audio}: ${cortes.length} respiro(s) cortado(s), ${s(economizado)}s a menos (o resto do vídeo foi puxado junto)`,
        );
      },
    }),

    ferramenta({
      name: "adicionar_cena",
      description:
        "Põe um vídeo OU UMA IMAGEM da biblioteca na trilha principal, como cena. Use para imagens quando quiser transição com efeito entre um vídeo e a imagem (transições só existem entre cenas). Também serve para repetir uma cena.",
      inputSchema: z.object({
        midia: z.string(),
        posicao: z
          .number()
          .int()
          .min(1)
          .nullable()
          .describe("Vira a cena número X. null = no fim."),
        de: z
          .number()
          .min(0)
          .nullable()
          .describe("Vídeo: início no arquivo (padrão 0). Imagem: ignore."),
        ate: z
          .number()
          .min(0)
          .nullable()
          .describe(
            "Vídeo: fim no arquivo (padrão: fim do arquivo). Imagem: quantos segundos fica na tela (padrão 3).",
          ),
      }),
      run: (e) => {
        const midia = acharMidia(e.midia);
        if (midia.formato === "audio") {
          throw new Error(`"${midia.nome}" é áudio; use colocar_audio.`);
        }
        const posicao = e.posicao === null ? undefined : e.posicao - 1;
        return aplicar(
          (t) =>
            colocarCena(t, midia, {
              posicao,
              de: e.de ?? undefined,
              ate: e.ate ?? undefined,
            }),
          `${midia.nome} adicionada como cena ${e.posicao ?? sessao.timeline.clipes.length + 1}`,
        );
      },
    }),

    ferramenta({
      name: "montar_sequencia",
      description:
        "Monta a trilha principal com vários vídeos e/ou imagens da biblioteca, na ordem dada (vídeos inteiros; imagens 3s). Use quando o usuário disser a ordem das cenas, ou pedir para usar a ordem em que enviou.",
      inputSchema: z.object({
        midias: z
          .array(z.string())
          .min(1)
          .describe(
            'Na ordem: nomes ou @apelidos, ex.: ["@abertura", "Cena 2"].',
          ),
        substituir: z
          .boolean()
          .describe(
            "true = apaga as cenas atuais da trilha antes; false = coloca no fim.",
          ),
      }),
      run: (e) => {
        const videos = e.midias.map((nome) => {
          const midia = acharMidia(nome);
          if (midia.formato === "audio") {
            throw new Error(`"${midia.nome}" é áudio; use colocar_audio.`);
          }
          return midia;
        });
        return aplicar(
          (t) =>
            videos.reduce(
              (acc, v) => colocarCena(acc, v),
              e.substituir ? { ...t, clipes: [] } : t,
            ),
          `trilha ${e.substituir ? "montada" : "ampliada"}: ${videos.map((v) => v.nome).join(" → ")}`,
        );
      },
    }),

    ferramenta({
      name: "mover_cena",
      description: "Muda a ordem: a cena X passa a ser a cena Y.",
      inputSchema: z.object({
        cena: z.number().int(),
        para_posicao: z.number().int(),
      }),
      run: (e) => {
        const de = conferirCena(e.cena);
        const para = conferirCena(e.para_posicao);
        return aplicar(
          (t) => moverClipe(t, de, para),
          `cena ${e.cena} movida para a posição ${e.para_posicao}`,
        );
      },
    }),

    ferramenta({
      name: "adicionar_zoom",
      description:
        "Zoom de câmera: aproxima TODA a imagem do vídeo (cenas e inserts, inclusive imagens) num intervalo do vídeo final. O zoom começa em 'de', leva 'rampa_s' segundos para chegar na escala, fica parado e volta ao normal TERMINANDO em 'ate'. Ex.: 'zoom in aos 39s e zoom out aos 42s' = de 39, ate 42 + rampa_s. Zoom lento/contínuo (efeito Ken Burns) = rampa_s grande, perto da metade do intervalo.",
      inputSchema: z.object({
        de: z.number().min(0),
        ate: z.number().min(0),
        escala: z
          .number()
          .min(1.05)
          .max(3)
          .describe("1.2 sutil, 1.4 médio, 1.8 forte."),
        foco_x: z
          .number()
          .min(0)
          .max(100)
          .nullable()
          .describe("% horizontal (50 = centro)."),
        foco_y: z
          .number()
          .min(0)
          .max(100)
          .nullable()
          .describe("% vertical (50 = centro)."),
        rampa_s: z
          .number()
          .min(0.1)
          .max(10)
          .nullable()
          .describe(
            "Segundos para aproximar e para voltar. null = 0.4 (rápido).",
          ),
      }),
      run: (e) =>
        aplicar(
          (t) =>
            adicionarItem(t, "zooms", {
              inicio: s(e.de),
              fim: s(e.ate),
              escala: e.escala,
              focoX: e.foco_x ?? 50,
              focoY: e.foco_y ?? 50,
              ...(e.rampa_s !== null ? { rampa: e.rampa_s } : {}),
            }),
          `zoom ${e.escala}x de ${s(e.de)}s a ${s(e.ate)}s${e.rampa_s !== null ? ` (rampa ${e.rampa_s}s)` : ""}`,
        ),
    }),

    ferramenta({
      name: "adicionar_motion",
      description:
        "Coloca um MOTION (texto ou grafismo animado por cima do vídeo, acima das cenas e abaixo das legendas) num trecho do vídeo final. Modelos: frase (frase de impacto enorme), preco (preço novo saltando numa etiqueta; detalhe = preço antigo riscado), contador (número que conta até o valor; detalhe = rótulo), titulo (título com marca-texto; detalhe = chapéu pequeno acima), rodape (nome/produto no canto de baixo; detalhe = descrição), lista (itens com ✓ entrando um a um; texto = título, detalhe = itens separados por |), chamada (botão de CTA pulsando com seta; detalhe = linha acima), selo (selo redondo carimbado; texto curto; x/y = onde), seta (seta desenhada apontando para x/y, com o texto), circulo (círculo à mão em volta de x/y). Kit investigação: carimbo (carimbo torto em x/y; detalhe = linha pequena), fita (fitas zebradas cruzando a tela; texto = o escrito; y = altura), fio (fio vermelho entre alfinetes em x/y e x2/y2; texto = etiqueta do meio), nota (bilhete amarelo preso em x/y; detalhe = linha de cima), ficha (ficha datilografada; detalhe = cabeçalho, texto = linhas 'CAMPO: valor' com |; y = topo), vigilancia (moldura de câmera de segurança com REC e relógio; texto = câmera, detalhe = local; dure a cena toda), marcador (plaquinha numerada de perícia em pé em x/y). Kit neon (motion design falado; para um vídeo inteiro prefira encenar_fala): fala (as palavras faladas entram uma a uma junto com a voz; *destaque* enorme em degradê; | quebra linha), etiqueta (pílula da ação no topo), anel (círculo de luz com texto em x/y), digitando (cartão que escreve o que é dito; detalhe = cabeçalho), barra (palavra grande + barra que enche; detalhe = linha de cima), comentario (caixa: texto digitado e publicado; detalhe = pílula acima), curtida (botão de like tocado em x/y; texto = número que sobe 1), toque (dedo tocando em x/y), brilho (✦ em x/y), microfone (microfone com ondas em x/y), confirmado (selo ✓ inclinado), rec (cartão de gravação com REC e relógio; texto no meio), edicao (timeline de edição se montando; detalhe = cabeçalho), conversa (chat estilo WhatsApp no celular — o roteiro só dá para montar com encenar_fala), marca (a LOGO de uma marca num cartão; imagem = @apelido; texto = legenda curta ou vazio). Para cenas novas desenhadas, use criar_animacao ou usar_padrao. *palavra* entre asteriscos sai na cor de destaque. Com com_som true já coloca o efeito sonoro que combina.",
      inputSchema: z.object({
        modelo: modeloMotionSchema,
        de: z
          .number()
          .min(0)
          .describe("Segundo do vídeo final em que aparece."),
        ate: z
          .number()
          .min(0)
          .nullable()
          .describe(
            "Segundo em que some. null = duração padrão do modelo (~2,5s).",
          ),
        texto: z.string().describe("Texto principal, CURTO (veja o modelo)."),
        detalhe: z.string().nullable(),
        posicao: z
          .enum(["topo", "centro", "base"])
          .nullable()
          .describe(
            "null = padrão do modelo (a base fica acima das legendas).",
          ),
        x: z
          .number()
          .min(0)
          .max(100)
          .nullable()
          .describe(
            "seta/circulo/selo/carimbo/nota/marcador/fio e anel/curtida/toque/brilho/microfone (e etiqueta/confirmado, opcional): ponto em % da largura.",
          ),
        y: z
          .number()
          .min(0)
          .max(100)
          .nullable()
          .describe(
            "Os mesmos do x: ponto em % da altura; fita/ficha: altura.",
          ),
        x2: z
          .number()
          .min(0)
          .max(100)
          .nullable()
          .describe("Só fio: ponta final em % da largura."),
        y2: z
          .number()
          .min(0)
          .max(100)
          .nullable()
          .describe("Só fio: ponta final em % da altura."),
        cor: z
          .string()
          .nullable()
          .describe(
            "Cor de destaque #rrggbb. null = vermelho do encEditor (kit neon: degradê azul→roxo).",
          ),
        com_som: z
          .boolean()
          .describe(
            "true = coloca junto o efeito sonoro que combina (padrão).",
          ),
        imagem: z
          .string()
          .nullable()
          .describe("Só marca: @apelido da logo (da biblioteca ou de buscar_na_web)."),
      }),
      run: (e) => {
        if (e.modelo === "marca" && !e.imagem) {
          throw new Error("O motion marca precisa da imagem da logo (@apelido); sem logo, use buscar_na_web.");
        }
        if (e.modelo === "desenho") {
          throw new Error("Para desenhar, use criar_animacao (ou usar_padrao).");
        }
        const imagem = e.imagem ? acharMidia(e.imagem).url : undefined;
        if (e.cor && !/^#[0-9a-f]{6}$/i.test(e.cor)) {
          throw new Error("Cor inválida: use #rrggbb (ex.: #FFD60A).");
        }
        const itens = (e.detalhe ?? e.texto).split("|").filter(Boolean).length;
        // Texto falado e cartão digitando: cada palavra no tempo da fala.
        const palavras =
          e.modelo === "fala" || e.modelo === "digitando"
            ? tempoDasPalavras(
                e.texto,
                palavrasNoVideoFinal(sessao.timeline, sessao.biblioteca),
                e.de,
              )
            : undefined;
        const motion: Motion = {
          modelo: e.modelo,
          inicio: s(e.de),
          fim: s(
            e.ate ??
              e.de +
                duracaoPadraoDoMotion(
                  e.modelo,
                  itens,
                  palavrasDoTexto(e.texto).length,
                ),
          ),
          texto: e.texto,
          ...(e.detalhe ? { detalhe: e.detalhe } : {}),
          ...(e.posicao ? { posicao: e.posicao } : {}),
          ...(e.x !== null ? { x: e.x } : {}),
          ...(e.y !== null ? { y: e.y } : {}),
          ...(e.x2 !== null ? { x2: e.x2 } : {}),
          ...(e.y2 !== null ? { y2: e.y2 } : {}),
          ...(e.cor ? { cor: e.cor } : {}),
          ...(palavras ? { palavras } : {}),
          ...(imagem ? { imagem } : {}),
        };
        const som = e.com_som ? somDoMotion(motion) : null;
        const nome = MOTIONS.find((m) => m.id === e.modelo)?.nome ?? e.modelo;
        return aplicar(
          (t) => {
            const com = adicionarItem(t, "motions", motion);
            return som
              ? adicionarSom(com, som, momentoDoSomDoMotion(motion))
              : com;
          },
          `motion "${nome}" ("${e.texto}") de ${motion.inicio}s a ${motion.fim}s${som ? ` com o som ${som}` : ""}`,
        );
      },
    }),

    ferramenta({
      name: "buscar_na_web",
      description:
        "Busca na internet uma imagem que falta e guarda nos arquivos do cliente. tipo 'logo' = logo oficial de uma marca (banco, loja, empresa, produto), pelo Wikidata/Wikimedia; tipo 'foto' = foto de uso livre do Wikimedia Commons (o_que em INGLÊS, ex.: 'house keys in hand'). A imagem é conferida por visão antes de guardar (não confunde marcas). Use SEM PERGUNTAR sempre que a fala citar uma marca que não tem logo na biblioteca, ou faltar uma foto para encenar. Devolve o @apelido para usar (adicionar_motion modelo marca, camada imagem de criar_animacao ou colocar_insert). Demora de 3 a 30 s.",
      inputSchema: z.object({
        tipo: z.enum(["logo", "foto"]),
        o_que: z
          .string()
          .describe("A marca (ex.: 'Banco Inter') ou o que a foto mostra, em inglês."),
        contexto: z
          .string()
          .describe("O que é, para não confundir (ex.: 'banco digital brasileiro')."),
      }),
      run: async (e) => {
        const consulta = `${e.tipo}:${normalizar(e.o_que)}`;
        const todas = [...sessao.biblioteca, ...(sessao.banco ?? [])];
        const ja = todas.find((m) => m.fonte?.consulta === consulta);
        if (ja) {
          if (!sessao.biblioteca.some((m) => m.id === ja.id)) {
            sessao.biblioteca = [...sessao.biblioteca, ja];
          }
          return `OK: já está nos arquivos como @${ja.apelido}.`;
        }
        const achada =
          e.tipo === "logo"
            ? await buscarLogo(e.o_que, e.contexto)
            : await buscarFoto(e.o_que, e.contexto);
        if (!achada) {
          return `Não achei ${e.tipo === "logo" ? "a logo" : "uma foto"} de "${e.o_que}" numa fonte confiável. Siga sem ela (não ponha um ícone genérico no lugar de uma logo) e diga ao usuário que ele pode enviar o arquivo.`;
        }
        const unico = (base: string, usados: string[]) => {
          let nome = base;
          for (let n = 2; usados.includes(normalizar(nome)); n++) nome = `${base}${n}`;
          return nome;
        };
        const apelido = unico(
          normalizar(`${e.tipo === "logo" ? "logo" : "foto"} ${e.o_que}`).replace(/[^a-z0-9]/g, "").slice(0, 28),
          todas.map((m) => normalizar(m.apelido ?? "")),
        );
        const nome = unico(
          e.tipo === "logo" ? `Logo ${achada.titulo}` : `Foto ${e.o_que}`.slice(0, 40),
          todas.map((m) => normalizar(m.nome)),
        );
        const midia: Midia = {
          id: crypto.randomUUID(),
          nome,
          apelido,
          usarIA: false,
          papel: "insert",
          formato: "imagem",
          url: `/api/midia/${achada.arquivo}`,
          nomeArquivo: achada.titulo,
          duracao: null,
          largura: achada.largura,
          altura: achada.altura,
          ...(sessao.projetoId ? { projetoId: sessao.projetoId } : {}),
          fonte: { ...achada.fonte, consulta },
        };
        // Já fica no banco do cliente (mesmo se a página fechar).
        if (sessao.clienteId) salvarMidiasDoCliente(sessao.clienteId, [midia]);
        sessao.biblioteca = [...sessao.biblioteca, midia];
        sessao.midiasNovas = [...(sessao.midiasNovas ?? []), midia];
        return `OK: ${e.tipo === "logo" ? `logo de ${achada.titulo}` : `foto "${achada.titulo}"`} guardada como @${apelido} (${achada.largura}×${achada.altura}; ${achada.fonte.site}, licença ${achada.fonte.licenca}). Use com adicionar_motion modelo marca (imagem @${apelido}), numa camada imagem de criar_animacao ou com colocar_insert.`;
      },
    }),

    ferramenta({
      name: "criar_animacao",
      description: `Desenha uma animação NOVA (motion "desenho") em camadas, quando nenhum modelo pronto encena bem a fala: um celular com um app, um gráfico, um contrato, uma casa, um produto com preço, um passo a passo… Comece de um padrão parecido (ver_padrao) e adapte. COMO DESENHAR: camada solta: x/y = CENTRO em % da tela; l/a = largura/altura em u (1% do lado menor; um celular grande ≈ l 38 a 76; um cartão ≈ l 80 a 50). Camada com "dentro" = índice (0, 1, 2…) de uma camada ANTERIOR: x/y/l/a em % da caixa da mãe e ela anda junto (tela dentro do celular, texto dentro do botão). tamanho = letra em u (título 5–8, texto 3–4, rótulo de app 2–2,5). tipo: caixa (cor, cantos, borda, sombra, brilho, recorta = esconde o que passa da borda), circulo, texto (*palavra* = destaque em degradê; | quebra linha; fonte forte/interface/condensada/mono/marcador; conta = número contando), emoji (um emoji grande), imagem (@apelido; ajuste conter/cobrir), traco (d = caminho SVG de 0 a 100 dentro da caixa; efeito desenha = se desenha). cor: #rrggbb, paleta1/2/3 ou degrade (cores da direção de arte), texto (escuro no fundo claro, claro no escuro). Tempo (s desde o começo do motion): entra + efeito (surge, sobe, desce, esquerda, direita, zoom, pula, gira, cresce = barra enchendo da esquerda, desenha, digita), sai, move {de, ate, x, y, escala, rotacao} (ex.: dedo indo tocar um botão), repete (pulsa, flutua, gira, pisca, balanca). Entradas em sequência (0,2–0,4 s entre elas) contam a história; tudo dentro da tela; poucas palavras. Ficou boa e serve para outros vídeos? salvar_como_padrao.`,
      inputSchema: z.object({
        de: z.number().min(0).describe("Segundo do vídeo final em que aparece."),
        ate: z.number().min(0).describe("Segundo em que some."),
        camadas: z.array(camadaSchema).min(1).max(60),
        salvar_como_padrao: z
          .object({
            nome: z.string().describe("Curto, com hífen (ex.: 'celular-pix')."),
            descricao: z.string().describe("O que mostra e o que trocar para reusar."),
            para_todos_os_clientes: z.boolean(),
          })
          .nullable(),
      }),
      run: (e) => {
        const camadas = camadasComImagens(e.camadas);
        const motion: Motion = {
          modelo: "desenho",
          inicio: s(e.de),
          fim: s(Math.max(e.ate, e.de + 0.5)),
          texto: "",
          camadas,
        };
        if (e.salvar_como_padrao) {
          salvarPadrao(e.salvar_como_padrao.para_todos_os_clientes ? null : (sessao.clienteId ?? null), {
            nome: e.salvar_como_padrao.nome,
            descricao: e.salvar_como_padrao.descricao,
            duracao: motion.fim - motion.inicio,
            camadas,
          });
        }
        return aplicar(
          (t) => adicionarItem(t, "motions", motion),
          `animação desenhada (${camadas.length} camadas) de ${motion.inicio}s a ${motion.fim}s${e.salvar_como_padrao ? `, salva como o padrão "${e.salvar_como_padrao.nome}"` : ""}`,
        );
      },
    }),

    ferramenta({
      name: "ver_padrao",
      description:
        "Mostra as camadas de um padrão de animação (os da lista PADRÕES DE ANIMAÇÃO), com o índice de cada uma, para usar com usar_padrao (ajustes) ou como ponto de partida de criar_animacao.",
      inputSchema: z.object({ nome: z.string() }),
      run: (e) => {
        const p = padroesDisponiveis(sessao.clienteId).find((x) => x.nome === e.nome);
        if (!p) throw new Error(`Não há o padrão "${e.nome}".`);
        return JSON.stringify({
          nome: p.nome,
          descricao: p.descricao,
          duracao: p.duracao,
          camadas: p.camadas.map((k, i) => ({ indice: i, ...k })),
        });
      },
    }),

    ferramenta({
      name: "usar_padrao",
      description:
        "Coloca um padrão de animação pronto (lista PADRÕES DE ANIMAÇÃO) num trecho, adaptado à fala: trocar_textos troca textos exatos (também os de antes/depois de um número que conta); ajustes muda campos de camadas pelo índice (veja com ver_padrao): conta {de, ate…} para os números, l/x de uma barra, imagem (@apelido) de uma logo, cor… Mais rápido e bonito que desenhar do zero.",
      inputSchema: z.object({
        nome: z.string(),
        de: z.number().min(0),
        ate: z.number().min(0),
        trocar_textos: z
          .array(z.object({ de: z.string(), para: z.string() }))
          .nullable(),
        ajustes: z
          .array(camadaSchema.partial().extend({ camada: z.number().int().min(0) }))
          .nullable(),
      }),
      run: (e) => {
        const camadas = camadasDoPadrao(e.nome, e.trocar_textos ?? [], e.ajustes ?? []);
        const motion: Motion = {
          modelo: "desenho",
          inicio: s(e.de),
          fim: s(Math.max(e.ate, e.de + 0.5)),
          texto: "",
          camadas,
        };
        return aplicar(
          (t) => adicionarItem(t, "motions", motion),
          `padrão "${e.nome}" de ${motion.inicio}s a ${motion.fim}s`,
        );
      },
    }),

    ferramenta({
      name: "salvar_padrao",
      description:
        "Guarda uma animação desenhada (motion 'desenho' já na timeline) como padrão para reusar em outros vídeos do cliente (ou de todos). Use quando uma cena ficou boa e se repete no nicho (ex.: simulação no celular, comparativo).",
      inputSchema: z.object({
        motion: z.number().int().min(1),
        nome: z.string(),
        descricao: z.string(),
        para_todos_os_clientes: z.boolean(),
      }),
      run: (e) => {
        const m = sessao.timeline.motions[e.motion - 1];
        if (!m || m.modelo !== "desenho" || !m.camadas?.length) {
          throw new Error(`O motion ${e.motion} não é uma animação desenhada.`);
        }
        salvarPadrao(e.para_todos_os_clientes ? null : (sessao.clienteId ?? null), {
          nome: e.nome,
          descricao: e.descricao,
          duracao: m.fim - m.inicio,
          camadas: m.camadas,
        });
        return `OK: padrão "${e.nome}" salvo${e.para_todos_os_clientes ? " para todos os clientes" : " para este cliente"}.`;
      },
    }),

    ferramenta({
      name: "conferir_video",
      description:
        "Confere o vídeo INTEIRO como um editor exigente: gera um quadro perto do fim de cada tela, MEDE onde ficou cada texto e desenho (um em cima do outro, saindo da tela), aplica as regras (texto longo, grafismo repetido, só emoji, a mesma informação duas vezes, tela vazia…) e um revisor independente olha as imagens (contraste, emoji sem cor, elemento solto, algo contra o pedido do usuário). Use SEMPRE que o usuário pedir para conferir, revisar ou achar erros no vídeo ('confere', 'tem algo errado?', 'revisa tudo') e corrija com as ferramentas TUDO o que ela apontar. Nunca diga que o vídeo está certo sem rodar esta ferramenta. Demora de 30 a 90 s.",
      inputSchema: z.object({}),
      run: async () => {
        const c = sessao.conferencia;
        if (!c) throw new Error("A conferência não está disponível aqui.");
        if ((c.vezes ?? 0) >= 1) {
          return "Já conferi o vídeo inteiro neste pedido. Termine as correções; a conferência final roda sozinha quando você terminar e mostra ao usuário o que sobrou.";
        }
        c.vezes = (c.vezes ?? 0) + 1;
        c.ultima = sessao.timeline;
        const r = await conferirVideo({
          antes: semItens(sessao.timeline),
          depois: sessao.timeline,
          biblioteca: sessao.biblioteca,
          origem: c.origem,
          olhar: true,
          contexto: c.contexto(),
          aviso: c.aviso,
        });
        const como = `Conferi ${r.medidos} quadro(s) medindo a posição de cada texto e um revisor olhou ${r.olhados}.`;
        if (!r.achados.length) return `OK: ${como} Nenhum problema.`;
        return `${como} Problemas (corrija TODOS com as ferramentas; os números são os itens da timeline):\n${r.achados.map((a) => `- ${a.texto}`).join("\n")}`;
      },
    }),

    ferramenta({
      name: "ler_voz",
      description:
        "Mede COMO a pessoa fala na narração: palavras por segundo, pausas, quanto o volume varia e a energia (calma, media, alta). Use antes de definir_direcao na direção automática: fala calma pede telas mais longas e poucos sons; fala animada pede ritmo rápido e mais impacto.",
      inputSchema: z.object({}),
      run: async () => {
        const medidas = await medirVoz(sessao.timeline, sessao.biblioteca);
        if (!medidas) {
          throw new Error(
            "Não há fala transcrita na timeline para medir (coloque a narração com colocar_audio).",
          );
        }
        return JSON.stringify(medidas);
      },
    }),

    ferramenta({
      name: "estudar_exemplo",
      description:
        "Estuda um vídeo ou imagem de EXEMPLO que o usuário quer copiar (da biblioteca/banco, ou um exemplo enviado no Planejar): quantos cortes e de quantos em quantos segundos, as cores dominantes, se é claro ou escuro, os textos que aparecem na tela e o que acontece em cada momento. Use quando o usuário mandar um exemplo/inspiração, e siga os detalhes com definir_direcao (origem 'exemplo') e na montagem.",
      inputSchema: z.object({
        midia: z
          .string()
          .nullable()
          .describe("@apelido ou nome de um vídeo/imagem da biblioteca ou do banco."),
        exemplo_do_plano: z
          .number()
          .int()
          .min(1)
          .nullable()
          .describe("Número do exemplo enviado no Planejar (1, 2…)."),
      }),
      run: async (e) => {
        if (e.exemplo_do_plano !== null) {
          const x = sessao.exemplosDoPlano?.[e.exemplo_do_plano - 1];
          if (!x) {
            throw new Error(
              `O plano não tem o exemplo ${e.exemplo_do_plano} (tem ${sessao.exemplosDoPlano?.length ?? 0}).`,
            );
          }
          const analise = (await lerAnaliseSalva(nomeDaUrl(x.url)).catch(
            () => null,
          )) as Midia["analise"] | null;
          const estudo = await estudarExemplo({
            url: x.url,
            formato: x.formato,
            duracao: x.duracao,
            nome: `exemplo ${e.exemplo_do_plano} do plano`,
            analise: analise ?? undefined,
          });
          return JSON.stringify({
            ...estudo,
            finalidade: x.finalidade,
            o_que_copiar: x.detalhe || "(o usuário não disse)",
          });
        }
        if (!e.midia) {
          throw new Error("Diga a midia (@apelido) ou o exemplo_do_plano.");
        }
        const m = acharMidia(e.midia);
        if (m.formato === "audio") {
          throw new Error(`"${m.nome}" é áudio; o exemplo precisa ser vídeo ou imagem.`);
        }
        return JSON.stringify(await estudarExemplo(m));
      },
    }),

    ferramenta({
      name: "definir_direcao",
      description:
        "Define a DIREÇÃO DE ARTE do vídeo: o que você entendeu (tema, nicho, público, tom, energia) e a cara escolhida (paleta de 2 a 3 cores e o tipo de fundo animado). As cores passam a valer nos fundos animados e em todo o kit neon (texto falado, etiquetas, barras, cartões). origem: 'pedido' = o usuário disse o estilo (no chat ou no plano); 'exemplo' = copiado de um vídeo/imagem (use estudar_exemplo antes); 'automatica' = ninguém disse nada e você decidiu pelo áudio (use ler_voz antes).",
      inputSchema: z.object({
        origem: z.enum(["automatica", "pedido", "exemplo"]),
        tema: z.string().describe("Do que o vídeo fala."),
        nicho: z.string().describe("Ramo do negócio (ex.: salão de beleza, loja de eletrônicos)."),
        publico: z.string().describe("Para quem é (ex.: mulheres 25–45 que fazem química no cabelo)."),
        tom: z
          .string()
          .describe("Como o vídeo deve parecer (ex.: 'animado e direto', 'sofisticado e calmo')."),
        energia: z.enum(["calma", "media", "alta"]),
        cores: z
          .array(z.string())
          .min(2)
          .max(3)
          .describe(
            "Paleta #rrggbb das cores de DESTAQUE (textos em degradê, grafismos, luzes do fundo): [principal, secundária, destaque]. Combine com o nicho/marca (beleza = rosa + dourado; tecnologia = azul + roxo; luxo = dourados claros; saúde = verde + azul claro; comida = vermelho + amarelo). Nada de preto/quase preto na paleta: o escuro vem do fundo (neon, brilhos, grade…). Em fundo escuro use cores vivas e claras; no fundo claro/papel, cores mais fortes.",
          ),
        fundo: estiloFundoSchema.describe(
          "neon, formas, brilhos (bokeh suave, beleza/sofisticado), ondas (som, música, voz), grade (tecnologia), gradiente (vivo, jovem), claro (limpo: beleza, saúde, lifestyle), papel (zine).",
        ),
        observacoes: z
          .string()
          .nullable()
          .describe("O que seguir à risca: o pedido do usuário ou o que copiar do exemplo."),
        aplicar_nos_fundos: z
          .boolean()
          .describe(
            "true = as cenas de fundo animado que já existem ganham o tipo de fundo e a energia (e passam a pulsar com a voz, se pedido).",
          ),
        pulsar_com_a_voz: z
          .boolean()
          .describe("true = o fundo pulsa com o volume da fala (ótimo em vídeo só de motion)."),
        salvar_no_cliente: z
          .boolean()
          .describe(
            "true = vira a identidade do cliente para os próximos vídeos (direção automática, ou quando o usuário disser que é a cara da marca). false = só neste vídeo.",
          ),
      }),
      run: async (e) => {
        const cores = e.cores.map((c) => c.trim());
        if (cores.some((c) => !/^#[0-9a-f]{6}$/i.test(c))) {
          throw new Error("Cores inválidas: use #rrggbb (ex.: #F472B6).");
        }
        const direcao: DirecaoDeArte = {
          origem: e.origem,
          tema: e.tema,
          nicho: e.nicho,
          publico: e.publico,
          tom: e.tom,
          energia: e.energia,
          cores,
          fundo: e.fundo,
          ...(e.observacoes?.trim() ? { observacoes: e.observacoes.trim() } : {}),
        };
        let nova: Timeline = { ...sessao.timeline, direcaoDeArte: direcao };
        if (e.aplicar_nos_fundos) {
          nova = {
            ...nova,
            clipes: nova.clipes.map((c) =>
              c.tipo === "fundo" ? { ...c, url: urlDoFundo(e.fundo) } : c,
            ),
          };
          nova = await ajustarFundos(nova, null, {
            energia: ENERGIA[e.energia],
            pulsar: e.pulsar_com_a_voz,
          });
        }
        if (e.salvar_no_cliente && sessao.clienteId) {
          salvarDirecaoDoCliente(sessao.clienteId, direcao);
        }
        const ok = aplicar(
          () => nova,
          `direção de arte (${e.origem}): ${e.nicho}, tom ${e.tom}, energia ${e.energia}, cores ${cores.join(" ")}, fundo ${e.fundo}${e.salvar_no_cliente ? " — salva como identidade do cliente" : ""}`,
        );
        return `${ok} Ritmo para esta energia: ${RITMO_DA_ENERGIA[e.energia]}`;
      },
    }),

    ferramenta({
      name: "colocar_fundo",
      description:
        "Põe um FUNDO ANIMADO do encEditor como cena da trilha principal (desenhado pelo próprio vídeo, sem arquivo), nas cores da direção de arte do vídeo: neon, formas (3D flutuando), brilhos (bokeh), ondas (de luz, parecem som), grade (tecnologia), gradiente (vivo), claro (limpo) ou papel. Serve para vídeos só de motion, sem filmagem: o texto falado e os grafismos ficam por cima. Sem duração, cobre até o fim dos áudios (a narração inteira).",
      inputSchema: z.object({
        estilo: estiloFundoSchema
          .nullable()
          .describe("null = o fundo da direção de arte do vídeo (ou neon)."),
        duracao_s: z
          .number()
          .min(0.5)
          .nullable()
          .describe(
            "Quanto tempo fica. null = até o fim dos áudios (5s se não houver áudio).",
          ),
        posicao: z
          .number()
          .int()
          .min(1)
          .nullable()
          .describe("Vira a cena número X. null = no fim da trilha."),
        substituir_cenas: z
          .boolean()
          .describe(
            "true = o fundo vira a trilha inteira (apaga as cenas atuais).",
          ),
        virada_no_segundo: z
          .number()
          .min(0)
          .nullable()
          .describe(
            "Segundo do vídeo final em que o fundo 'vira' com a transição #degrade (ex.: a passagem para a chamada final). Divide o fundo em dois, sem mudar a duração total. null = sem virada.",
          ),
        estilo_depois: estiloFundoSchema
          .nullable()
          .describe("Fundo depois da virada. null = o mesmo."),
        cores: z
          .array(z.string())
          .min(2)
          .max(3)
          .nullable()
          .describe("Paleta só deste fundo (#rrggbb). null = a da direção de arte."),
        energia: z
          .enum(["calma", "media", "alta"])
          .nullable()
          .describe("Quanto o fundo se mexe. null = a da direção de arte (ou média)."),
        pulsar_com_a_voz: z
          .boolean()
          .describe("true = o fundo pulsa com o volume da fala."),
      }),
      run: async (e) => {
        if (e.cores?.some((c) => !/^#[0-9a-f]{6}$/i.test(c.trim()))) {
          throw new Error("Cores inválidas: use #rrggbb.");
        }
        const direcao = sessao.timeline.direcaoDeArte;
        const estilo = e.estilo ?? direcao?.fundo ?? "neon";
        const base = e.substituir_cenas
          ? { ...sessao.timeline, clipes: [] }
          : sessao.timeline;
        const ocupado =
          calcularDuracaoTotal(calcularClipes(base)) / base.fps;
        const fimAudio = fimDosAudios(base);
        const duracao =
          e.duracao_s ??
          (fimAudio > ocupado + 0.5 ? fimAudio - ocupado + 0.3 : 5);
        const posicao = e.posicao === null ? undefined : e.posicao - 1;
        const indice = posicao ?? base.clipes.length;
        const ajustes = {
          ...(e.cores ? { cores: e.cores.map((c) => c.trim()) } : {}),
          energia: ENERGIA[e.energia ?? direcao?.energia ?? "media"],
          pulsar: e.pulsar_com_a_voz,
        };
        if (e.virada_no_segundo === null) {
          const nova = await ajustarFundos(
            colocarFundo(base, estilo, duracao, posicao),
            [indice],
            ajustes,
          );
          return aplicar(
            () => nova,
            `fundo animado ${estilo} com ${s(duracao)}s${e.pulsar_com_a_voz ? ", pulsando com a voz" : ""}${e.substituir_cenas ? " (no lugar das cenas)" : ""}`,
          );
        }
        // Dois fundos com a transição no meio exatamente na virada: a
        // transição sobrepõe os dois, então cada um ganha metade dela.
        const transicao = 0.7;
        const inicioDoFundo =
          posicao === undefined
            ? ocupado
            : inicioDosClipes(calcularClipes(base))[posicao] / base.fps || 0;
        const virada = e.virada_no_segundo - inicioDoFundo;
        if (virada < 1 || virada > duracao - 1) {
          throw new Error(
            `A virada precisa ficar entre ${s(inicioDoFundo + 1)}s e ${s(inicioDoFundo + duracao - 1)}s.`,
          );
        }
        const um = colocarFundo(base, estilo, virada + transicao / 2, posicao);
        const dois = colocarFundo(
          um,
          e.estilo_depois ?? estilo,
          duracao - virada + transicao / 2,
          indice + 1,
        );
        const nova = await ajustarFundos(
          atualizarItem(dois, "clipes", indice + 1, {
            transicao: "degrade",
            duracaoTransicao: transicao,
          }),
          [indice, indice + 1],
          ajustes,
        );
        return aplicar(
          () => nova,
          `fundo animado ${estilo} com ${s(duracao)}s, virando com #degrade em ${s(e.virada_no_segundo)}s${e.estilo_depois && e.estilo_depois !== estilo ? ` para o ${e.estilo_depois}` : ""}${e.pulsar_com_a_voz ? ", pulsando com a voz" : ""}`,
        );
      },
    }),

    ferramenta({
      name: "encenar_fala",
      description:
        "Monta de uma vez um vídeo de MOTION DESIGN FALADO: o que a pessoa diz vai ACONTECENDO na tela, sincronizado com a narração transcrita (ela precisa estar na timeline). Divida a fala em TELAS curtas, na ordem em que são ditas (uma ideia cada, ~1 a 3s). Cada tela começa quando o seu primeiro item é dito e acaba quando a próxima começa. Em cada tela: um motion 'fala' com as palavras ditas (menos quando um celular/cartão ocupa a tela) + 1 ou 2 itens que ENCENAM o que é dito (etiqueta, toque, digitando, barra, curtida, comentario, microfone, anel, brilho, confirmado, ou um print/foto/vídeo da biblioteca no celular). Marca citada → item marca com a logo (imagem @apelido; busque antes com buscar_na_web se faltar). A cada ~6 a 10 s uma CENA GRANDE: item desenho com padrao (celular-simulacao, comparativo-bancos, contrato-aprovado, casa-chave ou outro da lista), trocando textos e números pelos da fala. Faça o vídeo inteiro numa chamada só: os tempos saem da fala sozinhos e 'fala'/'digitando' acompanham cada palavra.",
      inputSchema: z.object({
        telas: z
          .array(
            z.object({
              itens: z
                .array(
                  z.object({
                    quando: z
                      .string()
                      .min(1)
                      .describe(
                        "Palavras EXATAS ditas no instante em que o item aparece (2 a 5 palavras copiadas da fala).",
                      ),
                    modelo: modeloMotionSchema
                      .nullable()
                      .describe("Modelo do motion. null = o item é uma mídia."),
                    texto: z
                      .string()
                      .nullable()
                      .describe(
                        "Texto do motion (veja o modelo). Em 'fala': as palavras EXATAS ditas na tela, *destaque* nas fortes, | quebra a linha (até ~8 palavras).",
                      ),
                    detalhe: z.string().nullable(),
                    posicao: z.enum(["topo", "centro", "base"]).nullable(),
                    x: z.number().min(0).max(100).nullable(),
                    y: z.number().min(0).max(100).nullable(),
                    x2: z.number().min(0).max(100).nullable(),
                    y2: z.number().min(0).max(100).nullable(),
                    cor: z.string().nullable(),
                    midia: z
                      .string()
                      .nullable()
                      .describe(
                        "Imagem ou vídeo da biblioteca (@apelido): print de app/site/perfil, foto do produto. null = o item é um motion.",
                      ),
                    moldura: z
                      .enum(["celular", "janela", "polaroid", "tela-cheia"])
                      .nullable()
                      .describe(
                        "Só com midia. celular = dentro de um celular (padrão); janela = caixa com borda; polaroid; tela-cheia.",
                      ),
                    lugar: z
                      .string()
                      .nullable()
                      .describe(
                        "Só com midia. celular: esquerda/centro/direita; janela/polaroid: topo, centro, base, canto-sup-esq… null = centro.",
                      ),
                    tamanho: tamanhoSchema.nullable(),
                    ate_dizer: z
                      .string()
                      .nullable()
                      .describe(
                        "Some quando estas palavras terminam de ser ditas. null = até a tela acabar.",
                      ),
                    fica_ate_tela: z
                      .number()
                      .int()
                      .min(1)
                      .nullable()
                      .describe(
                        "Continua até o fim da tela N (ex.: o celular que fica enquanto as etiquetas mudam). null = só nesta tela.",
                      ),
                    com_som: z
                      .boolean()
                      .describe(
                        "true = efeito sonoro que combina. Só nos momentos-chave.",
                      ),
                    eventos: z
                      .array(
                        z.object({
                          quando: z
                            .string()
                            .min(1)
                            .describe("Palavras ditas quando a ação acontece."),
                          acao: acaoDaConversaSchema,
                          texto: z
                            .string()
                            .nullable()
                            .describe(
                              "recebe/escreve: a mensagem; toque: conversa, microfone, enviar ou campo; zoom: mensagens, baixo, topo ou normal; lista: null.",
                            ),
                        }),
                      )
                      .nullable()
                      .describe(
                        "Só no modelo conversa (chat estilo WhatsApp no celular; detalhe = nome do contato): o roteiro, na ordem da fala. Ex.: lista → toque conversa → abrir → toque microfone → gravar → zoom baixo → toque enviar → enviar_audio → zoom normal → digitando → zoom mensagens → recebe → toque campo → escreve → envia → joinha. null nos outros modelos.",
                      ),
                    imagem: z
                      .string()
                      .nullable()
                      .describe("Só no modelo marca: @apelido da logo (da biblioteca ou de buscar_na_web)."),
                    padrao: z
                      .object({
                        nome: z.string(),
                        trocar_textos: z
                          .array(z.object({ de: z.string(), para: z.string() }))
                          .nullable(),
                      })
                      .nullable()
                      .describe("Só no modelo desenho: uma cena pronta da lista PADRÕES DE ANIMAÇÃO, com os textos e números trocados pelos da fala."),
                  }),
                )
                .min(1),
            }),
          )
          .min(1),
        substituir_tudo: z
          .boolean()
          .describe(
            "true = apaga antes os motions, inserts e efeitos sonoros atuais (para refazer a encenação).",
          ),
      }),
      run: async (e) => {
        const faladas = palavrasNoVideoFinal(
          sessao.timeline,
          sessao.biblioteca,
        );
        if (!faladas.length) {
          throw new Error(
            "Não há fala transcrita na timeline: coloque a narração (colocar_audio) e confira se ela já foi transcrita.",
          );
        }
        const telas = e.telas.map((tela) => ({
          itens: tela.itens.map((bruto) => {
            // Logo (marca) e cena pronta (desenho com padrão).
            if (bruto.modelo === "marca" && !bruto.imagem) {
              throw new Error("O item marca precisa da imagem da logo (@apelido); sem logo, use buscar_na_web antes.");
            }
            if (bruto.modelo === "desenho" && !bruto.padrao) {
              throw new Error("No encenar_fala, o item desenho usa um padrão (padrao.nome); para desenhar do zero, use criar_animacao depois.");
            }
            const item = {
              ...bruto,
              imagem: bruto.imagem ? acharMidia(bruto.imagem).url : null,
              camadas: bruto.padrao
                ? camadasDoPadrao(bruto.padrao.nome, bruto.padrao.trocar_textos ?? [], [])
                : null,
            };
            if (!item.midia) return { ...item, midia: null, moldura: null };
            const m = acharMidia(item.midia);
            if (m.formato === "audio") {
              throw new Error(`"${m.nome}" é áudio; use colocar_audio.`);
            }
            return {
              ...item,
              midia: {
                url: m.url,
                nome: m.nome,
                formato: m.formato,
                largura: m.largura,
                altura: m.altura,
                duracao: m.duracao,
              },
              moldura: item.moldura ?? ("celular" as const),
            };
          }),
        }));
        const total = duracaoTotal();
        const ultima = faladas[faladas.length - 1].ate;
        const r = encenar(sessao.timeline, telas, faladas, {
          substituir: e.substituir_tudo,
          fimDoVideo: total > ultima ? total : ultima + 0.8,
        });
        // Conversa com áudio gravado: a onda vem da voz de verdade (o
        // trecho da narração entre "gravar" e "enviar_audio").
        const motions = await Promise.all(
          r.timeline.motions.map((m) => ondaDaConversa(r.timeline, m)),
        );
        const ok = aplicar(
          () => ({ ...r.timeline, motions }),
          `fala encenada em ${r.telas.length} telas: ${r.motions} motion(s), ${r.inserts} imagem(ns)/vídeo(s) e ${r.sons} efeito(s) sonoro(s)`,
        );
        return `${ok} Telas: ${r.telas.map((x) => `${x.tela}) ${x.de}–${x.ate}s`).join(", ")}.${r.aproximados.length ? ` Achados por aproximação (confira): ${r.aproximados.join(", ")}.` : ""}${r.avisos.length ? ` Avisos: ${r.avisos.join("; ")}.` : ""}${total < ultima ? ` ATENÇÃO: a fala vai até ${s(ultima)}s e o vídeo só tem ${total}s — estique a cena/fundo (colocar_fundo ou aparar_cena).` : ""}`;
      },
    }),

    ferramenta({
      name: "adicionar_efeito",
      description:
        "Coloca um EFEITO DE IMAGEM num trecho do vídeo final (vale para cenas e inserts; motions e legendas ficam por cima, sem efeito). Impactos curtos (0,2–0,6s): tremor, flash, glitch, batida (pulso de zoom). Clima (1–4s ou mais): desfoque, pb (preto e branco), quente, frio, vibrante, vinheta, grao, vhs. Com com_som true já coloca o efeito sonoro que combina (tremor/batida = boom, flash = obturador, glitch/vhs = falha).",
      inputSchema: z.object({
        tipo: tipoEfeitoSchema,
        de: z.number().min(0),
        ate: z
          .number()
          .min(0)
          .nullable()
          .describe("null = duração típica do efeito."),
        intensidade: z
          .number()
          .min(0.1)
          .max(1)
          .nullable()
          .describe("0,3 sutil, 0,6 médio (padrão), 1 forte."),
        com_som: z.boolean(),
      }),
      run: (e) => {
        const tipico =
          EFEITOS_VISUAIS.find((x) => x.id === e.tipo)?.duracao ?? 1;
        const efeito: Efeito = {
          tipo: e.tipo,
          inicio: s(e.de),
          fim: s(e.ate ?? e.de + tipico),
          ...(e.intensidade !== null ? { intensidade: e.intensidade } : {}),
        };
        const som = e.com_som ? somDoEfeito(efeito) : null;
        return aplicar(
          (t) => {
            const com = adicionarItem(t, "efeitos", efeito);
            return som ? adicionarSom(com, som, efeito.inicio) : com;
          },
          `efeito ${e.tipo} de ${efeito.inicio}s a ${efeito.fim}s${som ? ` com o som ${som}` : ""}`,
        );
      },
    }),

    ferramenta({
      name: "adicionar_som",
      description:
        "Coloca um EFEITO SONORO do encEditor (whoosh, swoosh, pop, clique, boom, ding, caixa, subida, falha, obturador, carimbo, maquina, sirene, tique-taque) no vídeo final. 'no_segundo' é o momento em que o som ACONTECE: o auge do whoosh/swoosh, a batida do boom, o fim da subida (riser). Entra como áudio (na linha 'Sons' da Timeline).",
      inputSchema: z.object({
        som: z.enum(IDS_SONS),
        no_segundo: z.number().min(0),
        volume: z
          .number()
          .min(0)
          .max(1.5)
          .nullable()
          .describe("null = volume padrão do som (por baixo da narração)."),
      }),
      run: (e) =>
        aplicar(
          (t) => adicionarSom(t, e.som, e.no_segundo, e.volume ?? undefined),
          `efeito sonoro ${SONS.find((x) => x.id === e.som)?.nome ?? e.som} em ${s(e.no_segundo)}s`,
        ),
    }),

    ferramenta({
      name: "sons_automaticos",
      description:
        "Coloca de uma vez o efeito sonoro que combina em cada transição com efeito (slide/chicote = swoosh, mergulho/giro = whoosh, impacto = boom, clarao = obturador, falha = falha; fade e borrao ficam sem som), em cada motion e em cada efeito de imagem que ainda não têm som por perto. Use depois de montar transições/motions/efeitos, ou quando o usuário pedir 'coloque efeitos sonoros'.",
      inputSchema: z.object({
        transicoes: z.boolean(),
        motions: z.boolean(),
        efeitos: z.boolean(),
      }),
      run: (e) => {
        const { colocados } = sonsAutomaticos(sessao.timeline, e);
        if (!colocados) {
          return "OK: nenhum som novo — tudo o que combina com som já tem um efeito sonoro por perto (ou não há transições com efeito, motions nem efeitos).";
        }
        return aplicar(
          (t) => sonsAutomaticos(t, e).timeline,
          `${colocados} efeito(s) sonoro(s) colocados automaticamente`,
        );
      },
    }),

    ferramenta({
      name: "adicionar_legenda",
      description:
        "Adiciona uma legenda com texto escrito pelo usuário (ou combinado com ele) num intervalo do vídeo final.",
      inputSchema: z.object({
        texto: z.string().min(1),
        de: z.number().min(0),
        ate: z.number().min(0),
      }),
      run: (e) =>
        aplicar(
          (t) =>
            adicionarItem(t, "legendas", {
              texto: e.texto,
              inicio: s(e.de),
              fim: s(e.ate),
            }),
          `legenda "${e.texto}" de ${s(e.de)}s a ${s(e.ate)}s`,
        ),
    }),

    ferramenta({
      name: "editar_item",
      description:
        "Altera um insert, áudio, zoom, legenda, motion ou efeito existente (pelo número). Para cenas, só o volume; trechos e transições de cena têm ferramentas próprias. Campos null não mudam. Para trocar o modelo de um motion ou o tipo de um efeito, remova e adicione de novo.",
      inputSchema: z.object({
        tipo: z.enum(TIPOS_DE_ITEM),
        numero: z.number().int().min(1),
        de: z.number().min(0).nullable(),
        ate: z.number().min(0).nullable(),
        volume: z.number().min(0).nullable(),
        posicao: z.enum(["tela-cheia", "janela"]).nullable(),
        escala: z.number().min(1).max(3).nullable(),
        foco_x: z.number().min(0).max(100).nullable(),
        foco_y: z.number().min(0).max(100).nullable(),
        texto: z.string().nullable(),
        fade_entrada: z.number().min(0).nullable(),
        fade_saida: z.number().min(0).nullable(),
        comeca_no_segundo_do_arquivo: z.number().min(0).nullable(),
        rampa_s: z
          .number()
          .min(0)
          .nullable()
          .describe("Só zoom: segundos para aproximar/voltar."),
        detalhe: z
          .string()
          .nullable()
          .describe(
            "Só motion: texto de apoio (preço antigo, rótulo, itens com |).",
          ),
        posicao_do_motion: z.enum(["topo", "centro", "base"]).nullable(),
        x: z.number().min(0).max(100).nullable().describe("Só motion."),
        y: z.number().min(0).max(100).nullable().describe("Só motion."),
        x2: z.number().min(0).max(100).nullable().describe("Só motion fio."),
        y2: z.number().min(0).max(100).nullable().describe("Só motion fio."),
        cor: z
          .string()
          .nullable()
          .describe("Só motion: cor de destaque #rrggbb."),
        intensidade: z
          .number()
          .min(0.1)
          .max(1)
          .nullable()
          .describe("Só efeito."),
      }),
      run: (e) => {
        const faixa = FAIXA_POR_TIPO[e.tipo];
        const indice = e.numero - 1;
        const campos: Record<string, unknown> = {
          inicio: e.de,
          fim: e.ate,
          volume: e.volume,
          posicao: e.posicao,
          escala: e.escala,
          focoX: e.foco_x,
          focoY: e.foco_y,
          texto: e.texto,
          fadeEntrada: e.fade_entrada,
          fadeSaida: e.fade_saida,
          origemInicio: e.comeca_no_segundo_do_arquivo,
          rampa: e.rampa_s,
          detalhe: e.detalhe,
          x: e.x,
          y: e.y,
          x2: e.x2,
          y2: e.y2,
          cor: e.cor,
          intensidade: e.intensidade,
        };
        if (faixa === "motions") campos.posicao = e.posicao_do_motion;
        if (e.cor && !/^#[0-9a-f]{6}$/i.test(e.cor)) {
          throw new Error("Cor inválida: use #rrggbb (ex.: #FFD60A).");
        }
        if (faixa === "clipes") {
          // Em cenas, inicio/fim são do arquivo: só o volume é editável aqui.
          Object.keys(campos).forEach(
            (k) => k !== "volume" && delete campos[k],
          );
        }
        const mudancas = Object.fromEntries(
          Object.entries(campos).filter(
            ([, v]) => v !== null && v !== undefined,
          ),
        );
        if (Object.keys(mudancas).length === 0) {
          throw new Error("Nenhum campo para alterar.");
        }
        // Só o começo de um áudio (ou insert de vídeo) mudou: é aparar —
        // o ponto do arquivo anda junto e a fala não escorrega.
        const item = sessao.timeline[faixa][indice] as { tipo?: string };
        if (
          e.de !== null &&
          e.ate === null &&
          e.comeca_no_segundo_do_arquivo === null &&
          (faixa === "audios" ||
            (faixa === "inserts" && item?.tipo === "video"))
        ) {
          const de = e.de;
          const resto = { ...mudancas };
          delete resto.inicio;
          return aplicar(
            (t) => {
              const aparada = apararItem(t, faixa, indice, "inicio", de);
              return Object.keys(resto).length
                ? atualizarItem(aparada, faixa, indice, resto)
                : aparada;
            },
            `${e.tipo} ${e.numero}: começo aparado em ${s(de)}s (o som continua no mesmo lugar)`,
          );
        }
        return aplicar(
          (t) => atualizarItem(t, faixa, indice, mudancas),
          `${e.tipo} ${e.numero} alterado (${Object.keys(mudancas).join(", ")})`,
        );
      },
    }),

    ferramenta({
      name: "dividir_item",
      description:
        "Divide (corta em dois) um áudio, insert, zoom, motion ou efeito num segundo do vídeo final, como a lâmina dos editores. O segundo pedaço continua do ponto certo do arquivo. Para cenas use dividir_cena.",
      inputSchema: z.object({
        tipo: z.enum(["audio", "insert", "zoom", "motion", "efeito"]),
        numero: z.number().int().min(1),
        no_segundo: z.number().min(0).describe("Segundo do vídeo final."),
      }),
      run: (e) => {
        const faixa = FAIXA_POR_TIPO[e.tipo] as
          | "audios"
          | "inserts"
          | "zooms"
          | "motions"
          | "efeitos";
        return aplicar(
          (t) => dividirItemNoTempo(t, faixa, e.numero - 1, e.no_segundo),
          `${e.tipo} ${e.numero} dividido em ${s(e.no_segundo)}s (agora são o ${e.tipo} ${e.numero} e o ${e.numero + 1})`,
        );
      },
    }),

    ferramenta({
      name: "aparar_item",
      description:
        "Apara o começo ou o fim de um áudio, insert, zoom ou legenda até um segundo do vídeo final, SEM tirar tempo do vídeo (fica silêncio/espaço). O conteúdo fica no lugar: aparar o começo de uma narração não faz a fala escorregar. Para tirar o tempo do vídeo inteiro use cortar_trecho; para cenas, aparar_cena.",
      inputSchema: z.object({
        tipo: z.enum([
          "audio",
          "insert",
          "zoom",
          "legenda",
          "motion",
          "efeito",
        ]),
        numero: z.number().int().min(1),
        ponta: z.enum(["inicio", "fim"]),
        no_segundo: z.number().min(0),
      }),
      run: (e) => {
        const faixa = FAIXA_POR_TIPO[e.tipo] as Exclude<
          (typeof FAIXA_POR_TIPO)[string],
          "clipes"
        >;
        return aplicar(
          (t) => apararItem(t, faixa, e.numero - 1, e.ponta, e.no_segundo),
          `${e.tipo} ${e.numero}: ${e.ponta === "inicio" ? "começo" : "fim"} aparado em ${s(e.no_segundo)}s`,
        );
      },
    }),

    ferramenta({
      name: "juntar_itens",
      description:
        "Junta um item com o pedaço seguinte do mesmo arquivo, colado nele (desfaz um dividir). Vale para cena (com a próxima cena), áudio, insert, zoom, legenda, motion e efeito.",
      inputSchema: z.object({
        tipo: z.enum(TIPOS_DE_ITEM),
        numero: z
          .number()
          .int()
          .min(1)
          .describe("O PRIMEIRO dos dois pedaços."),
      }),
      run: (e) =>
        aplicar(
          (t) => juntarItens(t, FAIXA_POR_TIPO[e.tipo], e.numero - 1),
          `${e.tipo} ${e.numero} juntado com o pedaço seguinte`,
        ),
    }),

    ferramenta({
      name: "duplicar_item",
      description:
        "Duplica uma cena (a cópia entra logo depois dela), insert, áudio, zoom, legenda, motion ou efeito (a cópia fica colada no fim do original).",
      inputSchema: z.object({
        tipo: z.enum(TIPOS_DE_ITEM),
        numero: z.number().int().min(1),
      }),
      run: (e) =>
        aplicar(
          (t) => duplicarItem(t, FAIXA_POR_TIPO[e.tipo], e.numero - 1),
          `${e.tipo} ${e.numero} duplicado (a cópia é o número ${e.numero + 1})`,
        ),
    }),

    ferramenta({
      name: "remover_item",
      description:
        "Remove uma cena, insert, áudio, zoom, legenda, motion ou efeito pelo número. Efeitos sonoros são áudios.",
      inputSchema: z.object({
        tipo: z.enum(TIPOS_DE_ITEM),
        numero: z.number().int().min(1),
      }),
      run: (e) =>
        aplicar(
          (t) => removerItem(t, FAIXA_POR_TIPO[e.tipo], e.numero - 1),
          `${e.tipo} ${e.numero} removido`,
        ),
    }),

    ferramenta({
      name: "buscar_fala",
      description:
        'Procura um trecho FALADO no vídeo final (pela transcrição) e devolve em que segundo ele é dito. Use quando o usuário citar uma frase: "coloque o insert quando eu falo X".',
      inputSchema: z.object({
        trecho: z.string().min(1).describe("Palavras faladas a procurar."),
      }),
      run: (e) => {
        const palavras = palavrasNoVideoFinal(
          sessao.timeline,
          sessao.biblioteca,
        );
        if (!palavras.length) {
          throw new Error(
            "Não há fala transcrita no vídeo (os arquivos ainda não foram analisados ou não têm fala).",
          );
        }
        const achados = buscarFala(palavras, e.trecho);
        return achados.length
          ? JSON.stringify(achados)
          : `Não encontrei "${e.trecho}" na fala do vídeo.`;
      },
    }),

    ferramenta({
      name: "ver_conteudo",
      description:
        'Mostra o que é FALADO e o que APARECE na tela (inclusive textos escritos) em cada momento do vídeo final, com os segundos. Use para achar momentos pelo conteúdo ("quando aparece o carro", "onde está escrito promoção").',
      inputSchema: z.object({
        cena: z
          .number()
          .int()
          .min(1)
          .nullable()
          .describe("Só esta cena; null = vídeo todo."),
      }),
      run: (e) => {
        let de = 0;
        let ate = Infinity;
        if (e.cena !== null) {
          const i = conferirCena(e.cena);
          const clipes = calcularClipes(sessao.timeline);
          const inicio = inicioDosClipes(clipes)[i];
          de = inicio / sessao.timeline.fps;
          ate = (inicio + clipes[i].duracaoFrames) / sessao.timeline.fps;
        }
        const dentro = (x: { de: number; ate: number }) =>
          x.ate > de && x.de < ate;
        const palavras = palavrasNoVideoFinal(
          sessao.timeline,
          sessao.biblioteca,
        ).filter(dentro);
        // Junta palavras em frases de até 12 palavras, para ficar legível.
        const falas = gerarLegendas(palavras, 12).map((l) => ({
          de: l.inicio,
          ate: l.fim,
          fala: l.texto,
        }));
        const visual = momentosNoVideoFinal(
          sessao.timeline,
          sessao.biblioteca,
        ).filter(dentro);
        const pendentes = sessao.biblioteca
          .filter((m) => m.analise?.status !== "pronta")
          .map((m) => m.nome);
        return JSON.stringify({
          falas,
          visual,
          ...(pendentes.length ? { sem_analise: pendentes } : {}),
        });
      },
    }),

    ferramenta({
      name: "buscar_no_banco",
      description:
        'Procura no BANCO DE MÍDIA do cliente (todos os vídeos e imagens já enviados, inclusive de outros projetos dele) pelo CONTEÚDO descrito pela IA: o que aparece, texto na tela e fala. Use quando o usuário pedir algo do banco ("troque a cena 4 por algo que mostre a fachada", "tem algum clipe do kit na mão?") ou quando faltar um clipe para uma fala. Devolve os melhores arquivos com o @apelido e os momentos (segundos DENTRO do arquivo) que combinam; depois use adicionar_cena, colocar_insert e aparar_cena com eles.',
      inputSchema: z.object({
        o_que: z
          .string()
          .min(2)
          .describe(
            "O que procurar, em palavras (ex.: 'fachada da loja com letreiro').",
          ),
        tipo: z
          .enum(["video", "imagem", "qualquer"])
          .nullable()
          .describe("Só vídeos, só imagens ou qualquer um. null = qualquer."),
      }),
      run: (e) => {
        const naTimeline = new Set([
          ...sessao.timeline.clipes.map((c) => c.url),
          ...sessao.timeline.inserts.map((x) => x.url),
        ]);
        const candidatos = (sessao.banco ?? sessao.biblioteca).filter(
          (m) =>
            m.formato !== "audio" &&
            (!e.tipo || e.tipo === "qualquer" || m.formato === e.tipo),
        );
        const achados = buscarNoBanco(candidatos, e.o_que).slice(0, 8);
        const frios = candidatos.filter(
          (m) => m.analise?.status !== "pronta",
        ).length;
        if (!achados.length) {
          return `Nada no banco combina com "${e.o_que}".${frios ? ` (${frios} arquivo(s) ainda sem descrição da IA não entram na busca.)` : ""}`;
        }
        return JSON.stringify({
          achados: achados.map((a) => ({
            arquivo: `@${a.midia.apelido}`,
            nome: a.midia.nome,
            papel: a.midia.papel,
            formato: a.midia.formato,
            duracao_s: a.midia.duracao,
            ja_esta_no_video: naTimeline.has(a.midia.url),
            resumo: a.midia.analise?.visual?.resumo ?? "",
            momentos_que_combinam: a.momentos,
          })),
          ...(frios ? { sem_descricao: frios } : {}),
        });
      },
    }),

    ferramenta({
      name: "legendar_automaticamente",
      description:
        'Cria as legendas do vídeo inteiro a partir da fala transcrita, sincronizadas palavra por palavra. Com "midia", usa só a fala daquele arquivo (ex.: narração extraída de um vídeo), mesmo que esteja mudo ou fora da timeline.',
      inputSchema: z.object({
        midia: z
          .string()
          .nullable()
          .describe(
            "Arquivo cuja fala vira legenda (@apelido ou nome). null = toda a fala audível do vídeo.",
          ),
        inicio: z
          .number()
          .min(0)
          .nullable()
          .describe(
            "Só com midia FORA da timeline: segundo do vídeo em que a fala começa. null = 0.",
          ),
        palavras_por_legenda: z
          .number()
          .int()
          .min(1)
          .max(15)
          .nullable()
          .describe(
            "Máximo de palavras por legenda. null = 6 (bom para redes sociais).",
          ),
        substituir_existentes: z
          .boolean()
          .describe("true = apaga as legendas atuais antes."),
        estilo: estiloLegendaSchema
          .nullable()
          .describe(
            "Estilo de animação (#karaoke, #pop...). null = mantém o atual.",
          ),
      }),
      run: (e) => {
        const fonte = e.midia ? acharMidia(e.midia) : null;
        if (fonte && !fonte.analise?.transcricao) {
          throw new Error(
            `"${fonte.nome}" não tem fala transcrita (arquivo frio, análise pendente ou sem fala).`,
          );
        }
        const palavras = fonte
          ? palavrasDaMidia(
              sessao.timeline,
              sessao.biblioteca,
              fonte,
              e.inicio ?? 0,
            )
          : palavrasNoVideoFinal(sessao.timeline, sessao.biblioteca);
        if (!palavras.length) {
          throw new Error(
            fonte
              ? `A fala de "${fonte.nome}" não aparece no trecho usado na timeline.`
              : "Não há fala transcrita no vídeo (os arquivos ainda não foram analisados ou não têm fala).",
          );
        }
        const novas = gerarLegendas(palavras, e.palavras_por_legenda ?? 6);
        return aplicar(
          (t) => ({
            ...t,
            ...(e.estilo ? { estiloLegenda: e.estilo } : {}),
            legendas: [
              ...(e.substituir_existentes ? [] : t.legendas),
              ...novas,
            ],
          }),
          `${novas.length} legendas automáticas criadas${e.estilo ? ` no estilo #${e.estilo}` : ""}`,
        );
      },
    }),

    ferramenta({
      name: "estilo_das_legendas",
      description:
        "Muda o estilo de animação das legendas (#classico, #karaoke, #pop, #destaque, #gigante, #spray, #maquina, #neon): de todas (padrão do projeto) ou de uma legenda específica.",
      inputSchema: z.object({
        estilo: estiloLegendaSchema,
        legenda: z
          .number()
          .int()
          .min(1)
          .nullable()
          .describe(
            "Número da legenda; null = todas (vira o padrão do projeto).",
          ),
      }),
      run: (e) => {
        if (e.legenda === null) {
          return aplicar(
            (t) => ({
              ...t,
              estiloLegenda: e.estilo,
              // Tira estilos próprios para todas seguirem o padrão.
              legendas: t.legendas.map((l) => ({ ...l, estilo: undefined })),
            }),
            `todas as legendas agora no estilo #${e.estilo}`,
          );
        }
        const indice = e.legenda - 1;
        return aplicar(
          (t) => atualizarItem(t, "legendas", indice, { estilo: e.estilo }),
          `legenda ${e.legenda} agora no estilo #${e.estilo}`,
        );
      },
    }),

    ferramenta({
      name: "corrigir_texto_das_legendas",
      description:
        'Troca uma palavra ou expressão em TODAS as legendas de uma vez (ex.: "linda" -> "Linnda", "trivit" -> "Trivitt"), mantendo o tempo de cada palavra. Só troca palavras inteiras e não diferencia maiúsculas. Use sempre que o usuário pedir para corrigir um nome/palavra "em todas", em vez de editar legenda por legenda.',
      inputSchema: z.object({
        procurar: z.string().min(1).describe("Como está escrito hoje."),
        trocar_por: z.string().describe("Como deve ficar."),
      }),
      run: (e) => {
        const { trocas } = substituirNasLegendas(
          sessao.timeline,
          e.procurar,
          e.trocar_por,
        );
        if (!trocas) {
          throw new Error(
            `Não achei "${e.procurar}" em nenhuma legenda (já pode estar corrigido).`,
          );
        }
        return aplicar(
          (t) => substituirNasLegendas(t, e.procurar, e.trocar_por).timeline,
          `"${e.procurar}" trocado por "${e.trocar_por}" em ${trocas} lugar(es) das legendas`,
        );
      },
    }),

    ferramenta({
      name: "aparencia_das_legendas",
      description:
        "Muda tamanho, posição na tela (topo/centro/base), distância da borda e espaço entre as linhas de TODAS as legendas, em qualquer estilo. Campos null não mudam.",
      inputSchema: z.object({
        tamanho_percent: z
          .number()
          .min(30)
          .max(300)
          .nullable()
          .describe(
            "Tamanho da letra em % do padrão do estilo (100 = padrão; 'um pouco menor' ≈ 80; 'bem menor' ≈ 60; 'maior' ≈ 125).",
          ),
        posicao: posicaoLegendaSchema
          .nullable()
          .describe(
            "topo, centro ou base (sempre centralizada na horizontal).",
          ),
        distancia_da_borda_percent: z
          .number()
          .min(0)
          .max(45)
          .nullable()
          .describe(
            "Só topo/base: distância da borda em % da altura (padrão 9; 'mais para baixo' ≈ 5; 'mais para cima' ≈ 15).",
          ),
        espaco_entre_linhas: z
          .number()
          .min(0.7)
          .max(2.5)
          .nullable()
          .describe(
            "Altura de cada linha em relação à letra. #gigante usa 0.95 (linhas coladas), os outros ~1.15–1.2. 'Menos juntas' ≈ 1.25–1.35.",
          ),
        voltar_ao_padrao: z
          .boolean()
          .describe("true = descarta os ajustes e volta ao padrão do estilo."),
      }),
      run: (e) => {
        const mudancas = {
          ...(e.tamanho_percent !== null
            ? { tamanho: Math.round(e.tamanho_percent) / 100 }
            : {}),
          ...(e.posicao !== null ? { posicao: e.posicao } : {}),
          ...(e.distancia_da_borda_percent !== null
            ? { margem: e.distancia_da_borda_percent }
            : {}),
          ...(e.espaco_entre_linhas !== null
            ? { entrelinhas: e.espaco_entre_linhas }
            : {}),
        };
        if (!e.voltar_ao_padrao && !Object.keys(mudancas).length) {
          throw new Error("Nenhum ajuste pedido.");
        }
        return aplicar(
          (t) => ({
            ...t,
            aparenciaLegendas: e.voltar_ao_padrao
              ? undefined
              : { ...t.aparenciaLegendas, ...mudancas },
          }),
          e.voltar_ao_padrao
            ? "legendas voltaram ao tamanho/posição padrão do estilo"
            : `legendas: ${Object.entries(mudancas)
                .map(([k, v]) => `${k} ${v}`)
                .join(", ")}`,
        );
      },
    }),

    ferramenta({
      name: "efeitos_de_audio",
      description:
        "Aplica efeitos de áudio num arquivo (áudio ou som de um vídeo): #normalizar, #sem-ruido, #voz-clara, #radio, #telefone, #eco, #reverb, #grave. Vale para todos os usos do arquivo no projeto. Lista vazia = volta ao som original.",
      inputSchema: z.object({
        midia: z.string(),
        efeitos: z.array(z.enum(IDS_EFEITOS_AUDIO)),
        substituir: z
          .boolean()
          .describe(
            "true = só os efeitos da lista; false = soma aos efeitos que o arquivo já tem.",
          ),
      }),
      run: async (e) => {
        const midia = acharMidia(e.midia);
        if (midia.formato === "imagem") {
          throw new Error(`"${midia.nome}" é imagem; não tem som.`);
        }
        const atuais = (midia.efeitosAudio ?? []) as EfeitoAudio[];
        const efeitos = [
          ...new Set(e.substituir ? e.efeitos : [...atuais, ...e.efeitos]),
        ];
        const original = midia.urlOriginal ?? midia.url;
        const nova = efeitos.length
          ? `/api/midia/${await aplicarEfeitos(nomeDaUrl(original), efeitos)}`
          : original;
        const atualizada: Midia = {
          ...midia,
          url: nova,
          urlOriginal: efeitos.length ? original : undefined,
          efeitosAudio: efeitos.length ? efeitos : undefined,
        };
        sessao.biblioteca = sessao.biblioteca.map((m) =>
          m.id === midia.id ? atualizada : m,
        );
        sessao.midiasAlteradas = [
          ...(sessao.midiasAlteradas ?? []).filter((m) => m.id !== midia.id),
          atualizada,
        ];
        return aplicar(
          (t) => trocarUrl(t, midia.url, nova),
          efeitos.length
            ? `${midia.nome} agora com ${efeitos.map((x) => "#" + x).join(" ")}`
            : `${midia.nome} voltou ao som original`,
        );
      },
    }),

    ferramenta({
      name: "configurar_projeto",
      description:
        "Muda o formato do vídeo final, o fps ou a duração padrão das transições. Campos null não mudam.",
      inputSchema: z.object({
        formato: z.enum(IDS_FORMATO).nullable(),
        fps: z
          .union([z.literal(24), z.literal(25), z.literal(30), z.literal(60)])
          .nullable(),
        duracao_padrao_transicao_s: z.number().min(0.1).max(3).nullable(),
      }),
      run: (e) =>
        aplicar(
          (t) => {
            let nova = t;
            if (e.formato) {
              const f = formatoPorId(e.formato);
              nova = definirFormato(nova, f.largura, f.altura);
            }
            if (e.fps) nova = { ...nova, fps: e.fps };
            if (e.duracao_padrao_transicao_s !== null) {
              nova = {
                ...nova,
                duracaoTransicao: e.duracao_padrao_transicao_s,
              };
            }
            return nova;
          },
          `projeto: ${[
            e.formato && `formato ${e.formato}`,
            e.fps && `${e.fps} fps`,
            e.duracao_padrao_transicao_s !== null &&
              `transições de ${e.duracao_padrao_transicao_s}s`,
          ]
            .filter(Boolean)
            .join(", ")}`,
        ),
    }),
  ];

  // Várias chamadas numa só: corrigir 40 itens um por vez leva 20 etapas
  // da IA (cada uma reenviando o projeto inteiro); em lote, uma ou duas.
  const NO_LOTE = new Set([
    "editar_item",
    "remover_item",
    "adicionar_motion",
    "posicionar_insert",
    "acabamento_do_insert",
    "aparar_item",
    "duplicar_item",
    "adicionar_som",
    "adicionar_efeito",
    "criar_animacao",
    "usar_padrao",
  ]);
  const varias = ferramenta({
    name: "varias_edicoes",
    description: `Faz VÁRIAS edições numa chamada só, na ordem dada — bem mais rápido que uma chamada por item. Use sempre que for mexer em 3 ou mais itens (ex.: corrigir o que conferir_video apontou). Cada passo = o nome de uma destas ferramentas (${[...NO_LOTE].join(", ")}) e os argumentos exatamente como ela pede. Remover muda os números dos itens seguintes: deixe as remoções por ÚLTIMO, do maior número para o menor.`,
    inputSchema: z.object({
      passos: z
        .array(
          z.object({
            ferramenta: z.string(),
            argumentos: z.record(z.string(), z.unknown()),
          }),
        )
        .min(1),
    }),
    run: async ({ passos }) => {
      const resultados: string[] = [];
      for (const [i, passo] of passos.entries()) {
        const f = lista.find((x) => x.name === passo.ferramenta);
        if (!f || !NO_LOTE.has(f.name)) {
          resultados.push(`${i + 1}. Erro: "${passo.ferramenta}" não pode ser usada aqui.`);
          continue;
        }
        const entrada = f.inputSchema.safeParse(passo.argumentos);
        if (!entrada.success) {
          resultados.push(`${i + 1}. ${f.name}: Erro: argumentos inválidos: ${z.prettifyError(entrada.error)}`);
          continue;
        }
        try {
          resultados.push(`${i + 1}. ${f.name}: ${await f.run(entrada.data)}`);
        } catch (e) {
          resultados.push(`${i + 1}. ${f.name}: Erro: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      return resultados.join("\n");
    },
  });
  return [...lista, varias];
};
