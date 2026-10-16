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
  cortarTrecho,
  dividirClipe,
  Faixa,
  moverClipe,
  removerItem,
  substituirNasLegendas,
  trocarUrl,
  urlsDeMusica as musicasDaTimeline,
} from "@/timeline/operacoes";
import { EfeitoAudio, IDS_EFEITOS_AUDIO } from "@/catalogo/estilos";
import { nomeDaUrl } from "@/servidor/armazenamento";
import { aplicarEfeitos } from "@/servidor/efeitos";
import { formatoPorId, IDS_FORMATO } from "@/timeline/formatos";
import {
  direcaoSchema,
  estiloLegendaSchema,
  posicaoLegendaSchema,
  Timeline,
  tipoTransicaoSchema,
} from "@/timeline/schema";
import {
  buscarFala,
  gerarLegendas,
  momentosNoVideoFinal,
  palavrasDaMidia,
  palavrasNoVideoFinal,
} from "./conteudo";
import { buscarNoBanco } from "./busca-banco";
import { resumoDoProjeto } from "./estado";
import {
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
  // Inserts colocados sem posição definida: o app abre o popup para o
  // usuário escolher onde ficam e o tamanho.
  insertsParaPosicionar?: number[];
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
        rampa_s: z
          .number()
          .min(0)
          .nullable()
          .describe("Só zoom: segundos para aproximar/voltar."),
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

    ferramenta({
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
};
