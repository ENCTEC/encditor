import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
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
  dividirClipe,
  Faixa,
  inserirClipe,
  moverClipe,
  removerItem,
} from "@/timeline/operacoes";
import {
  direcaoSchema,
  Timeline,
  tipoTransicaoSchema,
} from "@/timeline/schema";
import { resumoDoProjeto } from "./estado";

// Ferramentas que o Claude usa para editar. Todas trabalham numa cópia da
// timeline ("sessao"); o app só recebe o resultado no final, e a edição
// inteira vira um único passo de desfazer.

export type SessaoEdicao = {
  timeline: Timeline;
  biblioteca: Midia[];
  // Frases curtas do que foi feito, para mostrar no chat.
  acoes: string[];
};

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
};

const FORMATOS: Record<string, [number, number]> = {
  "16:9": [1920, 1080],
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
  "4:5": [1080, 1350],
};

export const criarFerramentas = (sessao: SessaoEdicao) => {
  const duracaoTotal = () =>
    s(
      calcularDuracaoTotal(calcularClipes(sessao.timeline)) /
        sessao.timeline.fps,
    );

  const acharMidia = (nome: string) => {
    const alvo = normalizar(nome);
    const midia = sessao.biblioteca.find(
      (m) => normalizar(m.nome) === alvo || normalizar(m.nomeArquivo) === alvo,
    );
    if (!midia) {
      const nomes = sessao.biblioteca.map((m) => m.nome).join(", ") || "nenhum";
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

  // Aplica a operação, valida e registra. Se der erro, nada muda e o erro
  // volta para o Claude (o Tool Runner transforma em resultado de erro).
  const aplicar = (operacao: (t: Timeline) => Timeline, descricao: string) => {
    const nova = operacao(sessao.timeline);
    validarTimeline(nova);
    sessao.timeline = nova;
    sessao.acoes.push(descricao);
    return `OK: ${descricao}. Duração total agora: ${duracaoTotal()}s.`;
  };

  return [
    betaZodTool({
      name: "ver_projeto",
      description:
        "Mostra o estado atual do projeto: cenas (com onde começam e terminam no vídeo final), inserts, áudios, zooms, legendas e a biblioteca de arquivos. Use depois de mudanças que deslocam tempos (aparar, dividir, mover ou adicionar cenas) antes de posicionar algo por tempo.",
      inputSchema: z.object({}),
      run: () =>
        JSON.stringify(resumoDoProjeto(sessao.timeline, sessao.biblioteca)),
    }),

    betaZodTool({
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
        posicao: z
          .enum(["tela-cheia", "janela"])
          .nullable()
          .describe("tela-cheia (padrão) cobre a cena; janela fica no canto."),
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
        return aplicar(
          (t) =>
            adicionarItem(t, "inserts", {
              url: midia.url,
              tipo: midia.formato === "imagem" ? "imagem" : "video",
              inicio: s(e.inicio),
              fim: s(fim),
              origemInicio: origem,
              posicao: e.posicao ?? "tela-cheia",
              volume: e.volume ?? 0,
            }),
          `${midia.nome} de ${s(e.inicio)}s a ${s(fim)}s (${e.posicao ?? "tela-cheia"})`,
        );
      },
    }),

    betaZodTool({
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

    betaZodTool({
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

    betaZodTool({
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

    betaZodTool({
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

    betaZodTool({
      name: "adicionar_cena",
      description:
        "Põe um vídeo da biblioteca na trilha principal numa posição. Também serve para repetir uma cena.",
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
          .describe("Início no arquivo. Padrão 0."),
        ate: z
          .number()
          .min(0)
          .nullable()
          .describe("Fim no arquivo. Padrão: fim do arquivo."),
      }),
      run: (e) => {
        const midia = acharMidia(e.midia);
        if (midia.formato !== "video") {
          throw new Error(`"${midia.nome}" não é vídeo; use colocar_insert.`);
        }
        const de = e.de ?? 0;
        const ate = e.ate ?? Math.floor((midia.duracao ?? 5) * 100) / 100;
        const posicao = e.posicao === null ? undefined : e.posicao - 1;
        return aplicar(
          (t) =>
            inserirClipe(
              t,
              {
                url: midia.url,
                inicio: de,
                fim: ate,
                transicao: "corte",
                volume: 1,
              },
              posicao,
            ),
          `${midia.nome} (${de}s–${ate}s) adicionada como cena ${e.posicao ?? sessao.timeline.clipes.length + 1}`,
        );
      },
    }),

    betaZodTool({
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

    betaZodTool({
      name: "adicionar_zoom",
      description:
        "Dá zoom (aproxima) na cena durante um intervalo do vídeo final.",
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
            }),
          `zoom ${e.escala}x de ${s(e.de)}s a ${s(e.ate)}s`,
        ),
    }),

    betaZodTool({
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

    betaZodTool({
      name: "editar_item",
      description:
        "Altera um insert, áudio, zoom ou legenda existente (pelo número). Para cenas, só o volume; trechos e transições de cena têm ferramentas próprias. Campos null não mudam.",
      inputSchema: z.object({
        tipo: z.enum(["cena", "insert", "audio", "zoom", "legenda"]),
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
        };
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
        return aplicar(
          (t) => atualizarItem(t, faixa, indice, mudancas),
          `${e.tipo} ${e.numero} alterado (${Object.keys(mudancas).join(", ")})`,
        );
      },
    }),

    betaZodTool({
      name: "remover_item",
      description:
        "Remove uma cena, insert, áudio, zoom ou legenda pelo número.",
      inputSchema: z.object({
        tipo: z.enum(["cena", "insert", "audio", "zoom", "legenda"]),
        numero: z.number().int().min(1),
      }),
      run: (e) =>
        aplicar(
          (t) => removerItem(t, FAIXA_POR_TIPO[e.tipo], e.numero - 1),
          `${e.tipo} ${e.numero} removido`,
        ),
    }),

    betaZodTool({
      name: "configurar_projeto",
      description:
        "Muda o formato do vídeo final, o fps ou a duração padrão das transições. Campos null não mudam.",
      inputSchema: z.object({
        formato: z.enum(["16:9", "9:16", "1:1", "4:5"]).nullable(),
        fps: z
          .union([z.literal(24), z.literal(25), z.literal(30), z.literal(60)])
          .nullable(),
        duracao_padrao_transicao_s: z.number().min(0.1).max(3).nullable(),
      }),
      run: (e) =>
        aplicar(
          (t) => {
            let nova = t;
            if (e.formato) nova = definirFormato(nova, ...FORMATOS[e.formato]);
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
};
