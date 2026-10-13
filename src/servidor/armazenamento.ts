import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

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
