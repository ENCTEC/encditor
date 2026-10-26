import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Midia } from "@/projeto/tipos";
import { caminhoDoArquivo, nomeDaUrl } from "./armazenamento";
import { rodarFfmpeg } from "./ffmpeg";

// Estudo de um vídeo (ou imagem) de EXEMPLO para a IA copiar a cara dele
// nos detalhes: o ritmo dos cortes, as cores dominantes, se é claro ou
// escuro e os textos que aparecem na tela (da análise da IA, se houver).

const temporario = (extensao: string) =>
  path.join(os.tmpdir(), `exemplo-${randomUUID()}${extensao}`);

// Caminho para dentro de um filtro do ffmpeg: barras normais, o ":" do
// Windows escapado e tudo entre aspas.
const noFiltro = (caminho: string) =>
  `'${caminho.replace(/\\/g, "/").replace(/:/g, "\\:")}'`;

// Segundos em que a imagem muda de cena (corte).
const cortesDoVideo = async (caminho: string) => {
  const saida = temporario(".txt");
  try {
    await rodarFfmpeg([
      "-i",
      caminho,
      "-vf",
      `select='gt(scene,0.3)',metadata=print:file=${noFiltro(saida)}`,
      "-an",
      "-f",
      "null",
      "-",
    ]);
    const texto = await readFile(saida, "utf8").catch(() => "");
    return [...texto.matchAll(/pts_time:([0-9.]+)/g)].map((m) => Number(m[1]));
  } finally {
    await rm(saida, { force: true });
  }
};

const paraHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

// Cores dominantes de alguns quadros: as mais frequentes com cor de verdade
// (saturadas e não escuras demais), de matizes diferentes; e se a imagem é
// clara no geral.
const coresDe = async (caminho: string, duracao: number | null, imagem: boolean) => {
  const saida = temporario(".raw");
  try {
    await rodarFfmpeg([
      "-i",
      caminho,
      "-vf",
      imagem ? "scale=32:32" : `fps=${8 / Math.max(1, duracao ?? 8)},scale=32:32`,
      "-frames:v",
      imagem ? "1" : "8",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      saida,
    ]);
    const px = await readFile(saida);
    type Grupo = { n: number; r: number; g: number; b: number };
    const grupos = new Map<number, Grupo>();
    let luz = 0;
    for (let i = 0; i + 2 < px.length; i += 3) {
      const [r, g, b] = [px[i], px[i + 1], px[i + 2]];
      luz += (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const chave = Math.floor(r / 43) * 36 + Math.floor(g / 43) * 6 + Math.floor(b / 43);
      const grupo = grupos.get(chave) ?? { n: 0, r: 0, g: 0, b: 0 };
      grupo.n++;
      grupo.r += r;
      grupo.g += g;
      grupo.b += b;
      grupos.set(chave, grupo);
    }
    const total = px.length / 3;
    const medias = [...grupos.values()]
      .map((x) => ({ n: x.n, r: x.r / x.n, g: x.g / x.n, b: x.b / x.n }))
      .sort((a, b) => b.n - a.n);
    const matiz = (c: { r: number; g: number; b: number }) => {
      const max = Math.max(c.r, c.g, c.b);
      const min = Math.min(c.r, c.g, c.b);
      const sat = max ? (max - min) / max : 0;
      let h = 0;
      if (max !== min) {
        if (max === c.r) h = ((c.g - c.b) / (max - min)) % 6;
        else if (max === c.g) h = (c.b - c.r) / (max - min) + 2;
        else h = (c.r - c.g) / (max - min) + 4;
      }
      return { h: (h * 60 + 360) % 360, sat, v: max / 255 };
    };
    const vivas: typeof medias = [];
    for (const c of medias) {
      const { h, sat, v } = matiz(c);
      if (sat < 0.3 || v < 0.25 || c.n < total * 0.004) continue;
      if (vivas.some((x) => Math.min(Math.abs(matiz(x).h - h), 360 - Math.abs(matiz(x).h - h)) < 28)) continue;
      vivas.push(c);
      if (vivas.length === 3) break;
    }
    const fundo = medias[0];
    const cores = [...vivas, ...(vivas.length < 3 && fundo ? [fundo] : [])]
      .slice(0, 3)
      .map((c) => paraHex(c.r, c.g, c.b));
    return {
      cores,
      fundo: fundo ? paraHex(fundo.r, fundo.g, fundo.b) : null,
      claro: luz / total > 0.55,
    };
  } finally {
    await rm(saida, { force: true });
  }
};

export const estudarExemplo = async (midia: Pick<Midia, "url" | "formato" | "duracao" | "nome" | "analise">) => {
  const caminho = caminhoDoArquivo(nomeDaUrl(midia.url));
  const imagem = midia.formato === "imagem";
  const [cortes, cor] = await Promise.all([
    imagem ? Promise.resolve([] as number[]) : cortesDoVideo(caminho),
    coresDe(caminho, midia.duracao, imagem),
  ]);
  const duracao = midia.duracao;
  const visual = midia.analise?.visual;
  const textos = [
    ...new Set(
      (visual?.momentos ?? [])
        .map((m) => m.texto_na_tela?.trim())
        .filter((x): x is string => !!x),
    ),
  ];
  return {
    arquivo: midia.nome,
    duracao_s: duracao,
    ...(imagem
      ? {}
      : {
          cortes: cortes.length,
          segundos_por_cena: duracao
            ? Math.round((duracao / (cortes.length + 1)) * 10) / 10
            : null,
          momentos_dos_cortes: cortes.slice(0, 30).map((s) => Math.round(s * 10) / 10),
        }),
    cores_dominantes: cor.cores,
    cor_de_fundo: cor.fundo,
    imagem_clara: cor.claro,
    textos_na_tela: textos.slice(0, 12),
    resumo_visual: visual?.resumo ?? null,
    momentos: (visual?.momentos ?? []).slice(0, 12).map((m) => `${m.de}–${m.ate}s: ${m.descricao}`),
  };
};
