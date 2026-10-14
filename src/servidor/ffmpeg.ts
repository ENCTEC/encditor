import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

// ffmpeg extrai o áudio (para transcrever) e quadros (para a IA "ver" o
// vídeo). Ordem de busca: FFMPEG_PATH, o ffmpeg do sistema (na VPS:
// apt install ffmpeg) e, por último, o que vem junto com o Remotion.

const ffmpegDoRemotion = () => {
  const pacote = {
    win32: "compositor-win32-x64-msvc",
    linux: "compositor-linux-x64-gnu",
    darwin: "compositor-darwin-arm64",
  }[process.platform as "win32" | "linux" | "darwin"];
  if (!pacote) return null;
  const exe = path.resolve(
    "node_modules/@remotion",
    pacote,
    process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
  );
  return existsSync(exe) ? exe : null;
};

const executar = (exe: string, args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const processo = spawn(exe, args, { windowsHide: true });
    let saidaErro = "";
    processo.stderr.on("data", (d) => {
      saidaErro = (saidaErro + d.toString()).slice(-2000);
    });
    processo.on("error", reject);
    processo.on("close", (codigo) =>
      codigo === 0
        ? resolve()
        : reject(new Error(`ffmpeg saiu com código ${codigo}: ${saidaErro}`)),
    );
  });

// Tenta cada ffmpeg disponível até um funcionar.
export const rodarFfmpeg = async (args: string[]) => {
  const candidatos = [
    process.env.FFMPEG_PATH,
    "ffmpeg",
    ffmpegDoRemotion(),
  ].filter((c): c is string => Boolean(c));
  let ultimoErro: unknown = null;
  for (const exe of candidatos) {
    try {
      await executar(exe, [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        ...args,
      ]);
      return;
    } catch (e) {
      ultimoErro = e;
      // Só tenta o próximo se este ffmpeg não existe; erro de conversão é real.
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
  throw new Error(`ffmpeg não encontrado (${String(ultimoErro)}).`);
};

// Áudio mono 16 kHz em mp3: pequeno o bastante para a transcrição (limite
// de 25 MB ≈ 70 minutos) e suficiente para fala.
// Retorna false se o arquivo não tiver faixa de áudio.
export const extrairAudio = async (entrada: string, saida: string) => {
  try {
    await rodarFfmpeg([
      "-i",
      entrada,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-b:a",
      "48k",
      saida,
    ]);
    return true;
  } catch (e) {
    if (/does not contain any stream|matches no streams/i.test(String(e))) {
      return false;
    }
    throw e;
  }
};

// Um quadro a cada "intervalo" segundos, com 512 px de largura.
// intervalo null = imagem parada (um único quadro).
// Retorna os arquivos com o segundo (aproximado) de cada quadro.
export const extrairQuadros = async (
  entrada: string,
  pastaSaida: string,
  intervalo: number | null,
) => {
  const filtro =
    intervalo === null
      ? ["-vf", "scale=512:-2", "-frames:v", "1"]
      : ["-vf", `fps=1/${intervalo},scale=512:-2`];
  await rodarFfmpeg([
    "-i",
    entrada,
    ...filtro,
    "-q:v",
    "5",
    path.join(pastaSaida, "quadro_%04d.jpg"),
  ]);
  const arquivos = (await readdir(pastaSaida))
    .filter((a) => a.startsWith("quadro_"))
    .sort();
  return arquivos.map((a, i) => ({
    caminho: path.join(pastaSaida, a),
    segundo: Math.round(i * (intervalo ?? 0) * 10) / 10,
  }));
};
