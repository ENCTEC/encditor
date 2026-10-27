import { randomUUID } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import {
  ItemMedido,
  MedidaDoQuadro,
  PREFIXO_CAIXAS,
} from "@/remotion/EditorTimeline/medidas";
import { Timeline } from "@/timeline/schema";
import { comEnderecoCompleto, pacote } from "./exportar";
import { rodarFfmpeg } from "./ffmpeg";

// Quadros soltos do vídeo (JPEG pequeno, em base64) para a IA do chat
// OLHAR a edição antes de entregar — o mesmo motor do preview e da
// exportação. Um navegador só para todos os quadros. Com "medir", cada
// quadro volta também com a posição real de cada texto e desenho de cada
// item (Medidor.tsx), para achar sobreposições sem estimar.

export type QuadroRenderizado = {
  segundo: number;
  base64: string;
  itens?: ItemMedido[];
};

export const renderizarQuadros = async (
  timeline: Timeline,
  origem: string,
  segundos: number[],
  aoProgresso?: (feitos: number, total: number) => void,
  opcoes: { medir?: boolean } = {},
) => {
  const serveUrl = await pacote();
  const inputProps = comEnderecoCompleto(timeline, origem);
  const navegador = await openBrowser("chrome");
  try {
    const composicao = await selectComposition({
      serveUrl,
      id: "EditorTimeline",
      inputProps,
      puppeteerInstance: navegador,
    });
    // O lado menor com ~430 px: dá para ler os textos e sai barato.
    const escala = 430 / Math.min(timeline.largura, timeline.altura);
    const quadros: QuadroRenderizado[] = [];
    for (const [i, segundo] of segundos.entries()) {
      const frame = Math.min(
        composicao.durationInFrames - 1,
        Math.round(segundo * timeline.fps),
      );
      const medidas: MedidaDoQuadro[] = [];
      const { buffer } = await renderStill({
        composition: composicao,
        serveUrl,
        inputProps,
        frame,
        imageFormat: "jpeg",
        jpegQuality: 80,
        scale: escala,
        puppeteerInstance: navegador,
        ...(opcoes.medir
          ? {
              envVariables: { ENCEDITOR_MEDIR: "1" },
              onBrowserLog: ({ text }) => {
                if (text.startsWith(PREFIXO_CAIXAS)) {
                  medidas.push(JSON.parse(text.slice(PREFIXO_CAIXAS.length)));
                }
              },
            }
          : {}),
      });
      if (buffer) {
        quadros.push({
          segundo,
          base64: buffer.toString("base64"),
          itens: opcoes.medir
            ? medidas.filter((m) => m.frame === frame).at(-1)?.itens ?? []
            : undefined,
        });
      }
      aoProgresso?.(i + 1, segundos.length);
    }
    return quadros;
  } finally {
    await navegador.close({ silent: true });
  }
};

// Junta até 4 quadros numa "prancha" 2×2 (com uma borda branca entre
// eles): a IA vê o vídeo todo gastando bem menos que com um por um.
export const POSICOES_NA_PRANCHA = [
  "em cima à esquerda",
  "em cima à direita",
  "embaixo à esquerda",
  "embaixo à direita",
];

export const montarPranchas = async (quadros: QuadroRenderizado[]) => {
  const pranchas: { base64: string; quadros: QuadroRenderizado[] }[] = [];
  for (let p = 0; p < quadros.length; p += 4) {
    const grupo = quadros.slice(p, p + 4);
    if (grupo.length === 1) {
      pranchas.push({ base64: grupo[0].base64, quadros: grupo });
      continue;
    }
    const pasta = path.join(os.tmpdir(), `prancha-${randomUUID()}`);
    const arquivos = grupo.map((_, i) => `${pasta}-${i}.jpg`);
    const saida = `${pasta}.jpg`;
    try {
      await Promise.all(
        grupo.map((q, i) => writeFile(arquivos[i], Buffer.from(q.base64, "base64"))),
      );
      const bordas = grupo
        .map((_, i) => `[${i}:v]pad=iw+8:ih+8:4:4:white[q${i}]`)
        .join(";");
      const entradas = grupo.map((_, i) => `[q${i}]`).join("");
      // Com menos de 4 quadros, só as posições que existem (resto preto).
      const lugares = ["0_0", "w0_0", "0_h0", "w0_h0"].slice(0, grupo.length);
      await rodarFfmpeg([
        ...arquivos.flatMap((a) => ["-i", a]),
        "-filter_complex",
        `${bordas};${entradas}xstack=inputs=${grupo.length}:layout=${lugares.join("|")}:fill=black`,
        "-q:v",
        "4",
        saida,
      ]);
      pranchas.push({
        base64: (await readFile(saida)).toString("base64"),
        quadros: grupo,
      });
    } finally {
      await Promise.all(
        [...arquivos, saida].map((a) => rm(a, { force: true })),
      );
    }
  }
  return pranchas;
};
