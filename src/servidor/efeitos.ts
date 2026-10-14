import { createHash } from "node:crypto";
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { EfeitoAudio } from "@/catalogo/estilos";
import {
  caminhoDoArquivo,
  infoArquivo,
  reservarArquivo,
} from "./armazenamento";
import { lerEfeitoProcessado, salvarEfeitoProcessado } from "./banco";
import { rodarFfmpeg } from "./ffmpeg";

// Efeitos de áudio aplicados com ffmpeg. O resultado é um arquivo NOVO
// (o original fica guardado para poder desfazer). Para vídeos, só o som é
// processado; a imagem é copiada sem perder qualidade.

// Filtros do ffmpeg de cada efeito. A ordem final segue ORDEM (limpeza →
// timbre → ambiência → volume), não a ordem pedida.
const FILTROS: Record<EfeitoAudio, string> = {
  "sem-ruido": "highpass=f=80,afftdn=nf=-25",
  "voz-clara":
    "highpass=f=90,equalizer=f=250:t=q:w=1:g=-3,equalizer=f=3000:t=q:w=1:g=4,acompressor=threshold=-18dB:ratio=3:attack=5:release=100",
  grave: "bass=g=8:f=110",
  radio:
    "highpass=f=400,lowpass=f=3500,acompressor=threshold=-20dB:ratio=6,volume=1.5",
  telefone: "highpass=f=600,lowpass=f=2600,volume=1.6",
  eco: "aecho=0.8:0.8:250:0.35",
  reverb: "aecho=0.8:0.85:40|80|120:0.35|0.25|0.18",
  normalizar: "loudnorm=I=-16:TP=-1.5:LRA=11",
};

const ORDEM: EfeitoAudio[] = [
  "sem-ruido",
  "voz-clara",
  "grave",
  "radio",
  "telefone",
  "eco",
  "reverb",
  "normalizar",
];

const cadeia = (efeitos: EfeitoAudio[]) =>
  ORDEM.filter((e) => efeitos.includes(e))
    .map((e) => FILTROS[e])
    .join(",");

const EXTENSOES_VIDEO = [".mp4", ".mov", ".webm", ".mkv"];

// Processa o arquivo "nome" (da pasta de mídia) e devolve o nome do novo.
export const aplicarEfeitos = async (nome: string, efeitos: EfeitoAudio[]) => {
  if (!(await infoArquivo(nome))) {
    throw new Error("Arquivo não encontrado.");
  }
  const filtros = cadeia(efeitos);
  if (!filtros) throw new Error("Nenhum efeito escolhido.");

  const chave = createHash("sha1").update(`${nome}|${filtros}`).digest("hex");
  const pronto = lerEfeitoProcessado(chave);
  if (pronto && (await infoArquivo(pronto))) return pronto;

  const ehVideo = EXTENSOES_VIDEO.includes(path.extname(nome).toLowerCase());
  const destino = await reservarArquivo(ehVideo ? ".mp4" : ".mp3");
  await rodarFfmpeg([
    "-i",
    caminhoDoArquivo(nome),
    ...(ehVideo
      ? [
          "-map",
          "0:v:0?",
          "-map",
          "0:a:0",
          "-c:v",
          "copy",
          "-af",
          filtros,
          "-c:a",
          "aac",
          "-b:a",
          "192k",
          "-movflags",
          "+faststart",
        ]
      : ["-vn", "-af", filtros, "-c:a", "libmp3lame", "-b:a", "192k"]),
    destino.caminho,
  ]);
  salvarEfeitoProcessado(chave, destino.nome);
  return destino.nome;
};

// Exemplo de cada efeito (aba Estilos), aplicado no áudio de exemplo: a
// gravação do usuário (voz-usuario.mp3, fora do git) se existir; senão, a
// voz sintética que vem com o app (voz-exemplo.mp3).
const PASTA_EXEMPLOS = path.resolve(
  path.dirname(process.env.BANCO_ARQUIVO ?? "dados/encditor.db"),
  "exemplos-audio",
);
const VOZ_USUARIO = path.resolve("public/exemplos/voz-usuario.mp3");
const VOZ_PADRAO = path.resolve("public/exemplos/voz-exemplo.mp3");

export const audioDeExemplo = () =>
  existsSync(VOZ_USUARIO) ? VOZ_USUARIO : VOZ_PADRAO;

export const exemploDoEfeito = async (efeito: EfeitoAudio) => {
  mkdirSync(PASTA_EXEMPLOS, { recursive: true });
  const origem = audioDeExemplo();
  // O nome do cache muda se o áudio de exemplo mudar (troca de gravação).
  const info = statSync(origem);
  const versao = createHash("sha1")
    .update(`${origem}|${info.size}|${info.mtimeMs}`)
    .digest("hex")
    .slice(0, 10);
  const saida = path.join(PASTA_EXEMPLOS, `${efeito}-${versao}.mp3`);
  if (!existsSync(saida)) {
    await rodarFfmpeg([
      "-i",
      origem,
      "-af",
      cadeia([efeito]),
      "-c:a",
      "libmp3lame",
      "-b:a",
      "128k",
      saida,
    ]);
  }
  return saida;
};
