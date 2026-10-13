import { createReadStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  Analise,
  analiseSchema,
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
import { clienteOpenAI, MODELOS } from "./openai";

// Analisa um arquivo enviado: transcreve a fala (com o tempo de cada
// palavra) e descreve o que aparece na tela, com minutagem.

const LIMITE_QUADROS = 24;
const r2 = (n: number) => Math.round(n * 100) / 100;

const transcrever = async (audio: string): Promise<Transcricao | null> => {
  const resposta = await clienteOpenAI().audio.transcriptions.create({
    file: createReadStream(audio),
    model: MODELOS.transcricaoComTempos,
    response_format: "verbose_json",
    timestamp_granularities: ["word", "segment"],
  });
  const texto = resposta.text.trim();
  if (!texto) return null;
  return {
    idioma: resposta.language ?? null,
    texto,
    segmentos: (resposta.segments ?? []).map((s) => ({
      de: r2(s.start),
      ate: r2(s.end),
      texto: s.text.trim(),
    })),
    palavras: (resposta.words ?? []).map((w) => ({
      de: r2(w.start),
      ate: r2(w.end),
      palavra: w.word.trim(),
    })),
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

  const resposta = await clienteOpenAI().responses.create({
    model: MODELOS.visao,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: instrucao },
          ...imagens.flatMap((img) => [
            { type: "input_text" as const, text: `Quadro em ${img.segundo}s:` },
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
  });

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
  if (salva.success && salva.data.status === "pronta") return salva.data;

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
    };
    await salvarAnalise(nome, analise);
    return analise;
  } finally {
    await rm(temporaria, { recursive: true, force: true });
  }
};
