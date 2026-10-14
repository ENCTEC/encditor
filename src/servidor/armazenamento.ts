import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { lerAnaliseDoBanco, salvarAnaliseNoBanco } from "./banco";

// Único lugar do código que sabe ONDE a mídia fica guardada. Hoje é o
// disco (pasta "midia" no PC, ou na VPS). Para trocar por outro serviço
// (ex.: Cloudflare R2), só este arquivo muda.

const PASTA = path.resolve(process.env.MIDIA_DIR ?? "midia");

const TIPOS: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

// Nomes gerados por nós: uuid + extensão. Qualquer outra coisa é recusada
// (impede acessar arquivos fora da pasta, ex.: "../../.env").
const NOME_VALIDO = /^[0-9a-f-]{36}\.[a-z0-9]{2,4}$/;

export const extensaoPermitida = (nomeOriginal: string) => {
  const ext = path.extname(nomeOriginal).toLowerCase();
  return ext in TIPOS ? ext : null;
};

export const tipoDoArquivo = (nome: string) =>
  TIPOS[path.extname(nome).toLowerCase()] ?? "application/octet-stream";

const caminhoSeguro = (nome: string) => {
  if (!NOME_VALIDO.test(nome)) {
    throw new Error("Nome de arquivo inválido.");
  }
  return path.join(PASTA, nome);
};

export const salvarArquivo = async (
  conteudo: ReadableStream<Uint8Array>,
  extensao: string,
) => {
  await mkdir(PASTA, { recursive: true });
  const nome = `${randomUUID()}${extensao}`;
  const destino = caminhoSeguro(nome);
  try {
    await pipeline(
      Readable.fromWeb(conteudo as import("stream/web").ReadableStream),
      createWriteStream(destino),
    );
  } catch (erro) {
    await unlink(destino).catch(() => undefined);
    throw erro;
  }
  return nome;
};

export const infoArquivo = async (nome: string) => {
  try {
    const info = await stat(caminhoSeguro(nome));
    return info.isFile() ? { tamanho: info.size } : null;
  } catch {
    return null;
  }
};

export const lerArquivo = (
  nome: string,
  intervalo?: { inicio: number; fim: number },
) =>
  Readable.toWeb(
    createReadStream(
      caminhoSeguro(nome),
      intervalo && {
        start: intervalo.inicio,
        end: intervalo.fim,
      },
    ),
  ) as ReadableStream<Uint8Array>;

// Caminho em disco de um arquivo enviado (para ffmpeg e análise).
export const caminhoDoArquivo = (nome: string) => caminhoSeguro(nome);

// Nome do arquivo a partir da URL pública ("/api/midia/<nome>").
export const nomeDaUrl = (url: string) => {
  const nome = url.split("?")[0].split("/").pop() ?? "";
  caminhoSeguro(nome);
  return nome;
};

// A análise de cada arquivo fica no banco, para não pagar duas vezes pela
// mesma transcrição/descrição. Análises antigas (arquivo .analise.json ao
// lado da mídia) são migradas para o banco na primeira leitura.
export const lerAnaliseSalva = async (nome: string): Promise<unknown> => {
  caminhoSeguro(nome);
  const doBanco = lerAnaliseDoBanco(nome);
  if (doBanco) return doBanco;
  try {
    const antiga = JSON.parse(
      await readFile(`${caminhoSeguro(nome)}.analise.json`, "utf8"),
    );
    salvarAnaliseNoBanco(nome, antiga);
    return antiga;
  } catch {
    return null;
  }
};

export const salvarAnalise = async (nome: string, analise: unknown) => {
  caminhoSeguro(nome);
  salvarAnaliseNoBanco(nome, analise);
};

// Nome e caminho para um arquivo novo gerado no servidor (ex.: áudio com
// efeitos), no mesmo formato dos enviados.
export const reservarArquivo = async (extensao: string) => {
  await mkdir(PASTA, { recursive: true });
  const nome = `${randomUUID()}${extensao}`;
  return { nome, caminho: caminhoSeguro(nome) };
};

// Remove arquivos do armazenamento (ex.: ao apagar um cliente ou um vídeo
// exportado). Arquivo que já não existe é ignorado.
export const apagarArquivos = async (nomes: string[]) => {
  for (const nome of nomes) {
    if (!NOME_VALIDO.test(nome)) continue;
    const caminho = caminhoSeguro(nome);
    await unlink(caminho).catch(() => undefined);
    await unlink(`${caminho}.analise.json`).catch(() => undefined);
  }
};
