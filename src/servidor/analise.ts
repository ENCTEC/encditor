import { createReadStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  Analise,
  analiseSchema,
  VERSAO_ANALISE,
  Transcricao,
  Visual,
  visualSchema,
} from "@/projeto/analise";
import {
  caminhoDoArquivo,
  lerAnaliseSalva,
  salvarAnalise,
} from "./armazenamento";
import { extrairAudio, extrairQuadros } from "./ffmpeg";
import { clienteOpenAI, comNovaTentativa, MODELOS } from "./openai";

// Analisa um arquivo enviado: transcreve a fala (com o tempo de cada
// palavra) e descreve o que aparece na tela, com minutagem.

const LIMITE_QUADROS = 24;
const r2 = (n: number) => Math.round(n * 100) / 100;

// Escritas que não deveriam aparecer num áudio transcrito como idioma de
// alfabeto latino (chinês, japonês, coreano): sinal de texto inventado.
const ESCRITA_ASIATICA = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;

// Frases que o whisper costuma "inventar" em trechos de silêncio.
const FRASES_FANTASMA =
  /amara\.org|obrigad[oa] por assistir|legendas? (pela|por|de)|thanks? (you )?for watching|subtitles? by|inscreva-se no canal/i;

// Trecho inventado = o whisper acha provável que NÃO seja fala E há outro
// sinal ruim: confiança baixa, escrita asiática ou frase fantasma conhecida.
// (Só a probabilidade não basta: fala real às vezes vem com 0,6.)
const pareceInventado = (s: {
  no_speech_prob: number;
  avg_logprob: number;
  text: string;
}) =>
  s.no_speech_prob > 0.5 &&
  (s.avg_logprob < -1 ||
    ESCRITA_ASIATICA.test(s.text) ||
    FRASES_FANTASMA.test(s.text));

const soLetrasENumeros = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

type PalavraBruta = { start: number; end: number; word: string };

// O whisper devolve as palavras com tempo, mas sem pontuação e às vezes
// vazias ("50%" vira "50" + ""). O texto completo tem a forma certa.
// Aqui cada palavra com tempo é trocada pela palavra do texto ("50%",
// "pessoal,"), e o tempo das vazias vai para a palavra anterior.
export const alinharPalavras = (palavras: PalavraBruta[], texto: string) => {
  const tokens = texto.split(/\s+/).filter(Boolean);
  const resultado: Transcricao["palavras"] = [];
  let t = 0;
  for (const p of palavras) {
    const chave = soLetrasENumeros(p.word);
    if (!chave) {
      const anterior = resultado[resultado.length - 1];
      if (anterior) anterior.ate = r2(Math.max(anterior.ate, p.end));
      continue;
    }
    // Procura o token correspondente logo adiante no texto.
    let achado = -1;
    for (let k = t; k < Math.min(tokens.length, t + 4); k++) {
      if (soLetrasENumeros(tokens[k]).startsWith(chave)) {
        achado = k;
        break;
      }
    }
    if (achado >= 0) t = achado + 1;
    resultado.push({
      de: r2(p.start),
      ate: r2(p.end),
      palavra: achado >= 0 ? tokens[achado] : p.word.trim(),
    });
  }
  return resultado;
};

const transcrever = async (audio: string): Promise<Transcricao | null> => {
  const resposta = await comNovaTentativa(() =>
    clienteOpenAI().audio.transcriptions.create({
      file: createReadStream(audio),
      model: MODELOS.transcricaoComTempos,
      response_format: "verbose_json",
      timestamp_granularities: ["word", "segment"],
    }),
  );
  // Em trechos sem voz (só música/ruído) o whisper às vezes "inventa" frases
  // (ex.: texto em chinês num vídeo mudo): são descartados com suas palavras.
  const segmentos = (resposta.segments ?? []).filter(
    (s) => s.text.trim() && !pareceInventado(s),
  );
  const texto = segmentos.map((s) => s.text.trim()).join(" ");
  if (!texto) return null;
  const dentroDeUmSegmento = (p: PalavraBruta) =>
    segmentos.some((s) => p.start >= s.start - 0.2 && p.start <= s.end + 0.2);
  return {
    idioma: resposta.language ?? null,
    texto,
    segmentos: segmentos.map((s) => ({
      de: r2(s.start),
      ate: r2(s.end),
      texto: s.text.trim(),
    })),
    palavras: alinharPalavras(
      (resposta.words ?? []).filter(dentroDeUmSegmento),
      texto,
    ),
  };
};

const ESQUEMA_VISUAL = {
  type: "object",
  additionalProperties: false,
  required: ["resumo", "momentos"],
  properties: {
    resumo: {
      type: "string",
      description: "1 ou 2 frases sobre o conteúdo do arquivo.",
    },
    momentos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["de", "ate", "descricao", "texto_na_tela"],
        properties: {
          de: { type: "number" },
          ate: { type: "number" },
          descricao: { type: "string" },
          texto_na_tela: { type: "string" },
        },
      },
    },
  },
} as const;

const descreverQuadros = async (
  quadros: { caminho: string; segundo: number }[],
  duracao: number | null,
  fala: string | null,
): Promise<Visual> => {
  const imagens = await Promise.all(
    quadros.map(async (q) => ({
      segundo: q.segundo,
      base64: (await readFile(q.caminho)).toString("base64"),
    })),
  );

  const instrucao = [
    "Você analisa quadros de um vídeo para um editor de vídeo.",
    duracao !== null
      ? `O vídeo tem ${r2(duracao)}s; cada quadro vem com o segundo em que aparece.`
      : "É uma imagem parada (use de=0 e ate=0).",
    'Agrupe quadros parecidos em momentos (de/ate em segundos). Para cada momento, descreva em português o que aparece (pessoas, ações, objetos, lugar, enquadramento) e copie fielmente qualquer texto escrito visível na tela em texto_na_tela ("" se não houver).',
    fala ? `Fala do vídeo, para contexto: ${fala.slice(0, 2000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const resposta = await comNovaTentativa(() =>
    clienteOpenAI().responses.create({
      model: MODELOS.visao,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: instrucao },
            ...imagens.flatMap((img) => [
              {
                type: "input_text" as const,
                text: `Quadro em ${img.segundo}s:`,
              },
              {
                type: "input_image" as const,
                image_url: `data:image/jpeg;base64,${img.base64}`,
                detail: "low" as const,
              },
            ]),
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "analise_visual",
          strict: true,
          schema: ESQUEMA_VISUAL,
        },
      },
    }),
  );

  console.log(
    `[ia] visão ${MODELOS.visao}: ${imagens.length} quadro(s), ${resposta.usage?.input_tokens ?? 0} tokens de entrada, ${resposta.usage?.output_tokens ?? 0} de saída`,
  );
  const visual = visualSchema.parse(JSON.parse(resposta.output_text));
  const limite = duracao ?? 0;
  return {
    resumo: visual.resumo,
    momentos: visual.momentos.map((m) => ({
      ...m,
      de: r2(Math.min(Math.max(0, m.de), limite)),
      ate: r2(Math.min(Math.max(m.de, m.ate), limite)),
    })),
  };
};

export const analisarArquivo = async (
  nome: string,
  formato: "video" | "imagem" | "audio",
  duracao: number | null,
): Promise<Analise> => {
  const salva = analiseSchema.safeParse(await lerAnaliseSalva(nome));
  if (
    salva.success &&
    salva.data.status === "pronta" &&
    salva.data.versao === VERSAO_ANALISE
  ) {
    return salva.data;
  }

  const arquivo = caminhoDoArquivo(nome);
  const temporaria = await mkdtemp(path.join(os.tmpdir(), "encditor-"));
  try {
    let transcricao: Transcricao | null = null;
    if (formato !== "imagem") {
      const audio = path.join(temporaria, "audio.mp3");
      if (await extrairAudio(arquivo, audio)) {
        transcricao = await transcrever(audio);
      }
    }

    let visual: Visual | null = null;
    if (formato !== "audio") {
      const intervalo =
        formato === "imagem"
          ? null
          : Math.max(1, Math.ceil(((duracao ?? 10) / LIMITE_QUADROS) * 2) / 2);
      const quadros = (
        await extrairQuadros(arquivo, temporaria, intervalo)
      ).slice(0, LIMITE_QUADROS);
      if (quadros.length) {
        visual = await descreverQuadros(
          quadros,
          formato === "imagem" ? null : duracao,
          transcricao?.texto ?? null,
        );
      }
    }

    const analise: Analise = {
      status: "pronta",
      erro: null,
      transcricao,
      visual,
      versao: VERSAO_ANALISE,
    };
    await salvarAnalise(nome, analise);
    return analise;
  } finally {
    await rm(temporaria, { recursive: true, force: true });
  }
};
