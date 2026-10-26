import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { caminhoDoArquivo, nomeDaUrl } from "./armazenamento";
import { rodarFfmpeg } from "./ffmpeg";

// Volume da voz (0 a 1) "taxa" vezes por segundo num trecho [de, ate) de
// um arquivo de áudio enviado (segundos DENTRO do arquivo). Desenha a onda
// do áudio que é "gravado" no motion conversa com a voz de verdade.
export const envelopeDoArquivo = async (
  url: string,
  de: number,
  ate: number,
  taxa = 30,
) => {
  const temporario = path.join(os.tmpdir(), `envelope-${randomUUID()}.raw`);
  try {
    await rodarFfmpeg([
      "-ss",
      String(Math.max(0, de)),
      "-t",
      String(Math.max(0.1, ate - de)),
      "-i",
      caminhoDoArquivo(nomeDaUrl(url)),
      "-ac",
      "1",
      "-ar",
      "8000",
      "-f",
      "s16le",
      temporario,
    ]);
    const bruto = await readFile(temporario);
    const amostras = new Int16Array(
      bruto.buffer,
      bruto.byteOffset,
      Math.floor(bruto.length / 2),
    );
    const porJanela = Math.round(8000 / taxa);
    const dbs: number[] = [];
    for (let i = 0; i < amostras.length; i += porJanela) {
      const fim = Math.min(amostras.length, i + porJanela);
      let soma = 0;
      for (let j = i; j < fim; j++) soma += amostras[j] * amostras[j];
      const rms = Math.sqrt(soma / Math.max(1, fim - i)) / 32768;
      dbs.push(rms > 0 ? 20 * Math.log10(rms) : -90);
    }
    // Escala pelo próprio trecho: a voz mais forte (95%) fica perto do topo
    // e 30 dB abaixo dela é silêncio — serve para áudio baixo ou alto.
    const ordenados = [...dbs].sort((a, b) => a - b);
    const forte = ordenados[Math.floor(ordenados.length * 0.95)] ?? -12;
    return dbs.map((db) => {
      const v = Math.max(0, Math.min(1, (db - (forte - 30)) / 30)) ** 1.4;
      return Math.round(v * 0.95 * 100) / 100;
    });
  } finally {
    await rm(temporario, { force: true });
  }
};
