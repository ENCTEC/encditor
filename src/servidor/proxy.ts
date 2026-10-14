import {
  apagarArquivos,
  caminhoDoArquivo,
  infoArquivo,
  reservarArquivo,
} from "./armazenamento";
import { lerProxy, salvarProxy } from "./banco";
import { rodarFfmpeg } from "./ffmpeg";

// Proxy = cópia leve de um vídeo (H.264, lado maior com até 1280 px), usada
// SÓ no preview do navegador. Vídeos pesados (ex.: HEVC 10-bit do iPhone a
// 15 Mbps) travam o preview, principalmente nas transições, quando dois
// tocam juntos. A exportação continua usando o arquivo original.

const fila: { atual: Promise<unknown> } = { atual: Promise.resolve() };

const converter = async (original: string) => {
  const destino = await reservarArquivo(".mp4");
  try {
    await rodarFfmpeg([
      "-i",
      caminhoDoArquivo(original),
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      "-vf",
      "scale=w='if(gte(iw,ih),min(iw,1280),-2)':h='if(gte(iw,ih),-2,min(ih,1280))'",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "26",
      "-pix_fmt",
      "yuv420p",
      // Quadro-chave a cada 15 quadros: pular para qualquer ponto é rápido.
      "-g",
      "15",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      destino.caminho,
    ]);
  } catch (e) {
    await apagarArquivos([destino.nome]);
    throw e;
  }
  salvarProxy(original, destino.nome);
  return destino.nome;
};

// Devolve o nome do proxy (feito agora ou antes). Um por vez, para não
// disputar a CPU com a exportação e as análises.
export const gerarProxy = async (original: string): Promise<string> => {
  if (!(await infoArquivo(original))) {
    throw new Error("Arquivo não encontrado.");
  }
  const pronto = lerProxy(original);
  if (pronto && (await infoArquivo(pronto))) return pronto;
  const vez = fila.atual.then(() => converter(original));
  fila.atual = vez.catch(() => undefined);
  return vez;
};
