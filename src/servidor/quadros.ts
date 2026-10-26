import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { Timeline } from "@/timeline/schema";
import { comEnderecoCompleto, pacote } from "./exportar";

// Quadros soltos do vídeo (JPEG pequeno, em base64) para a IA do chat
// OLHAR a edição antes de entregar — o mesmo motor do preview e da
// exportação. Um navegador só para todos os quadros.
export const renderizarQuadros = async (
  timeline: Timeline,
  origem: string,
  segundos: number[],
  aoProgresso?: (feitos: number, total: number) => void,
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
    const quadros: { segundo: number; base64: string }[] = [];
    for (const [i, segundo] of segundos.entries()) {
      const { buffer } = await renderStill({
        composition: composicao,
        serveUrl,
        inputProps,
        frame: Math.min(
          composicao.durationInFrames - 1,
          Math.round(segundo * timeline.fps),
        ),
        imageFormat: "jpeg",
        jpegQuality: 80,
        scale: escala,
        puppeteerInstance: navegador,
      });
      if (buffer) quadros.push({ segundo, base64: buffer.toString("base64") });
      aoProgresso?.(i + 1, segundos.length);
    }
    return quadros;
  } finally {
    await navegador.close({ silent: true });
  }
};
