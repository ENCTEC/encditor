import { palavrasNoVideoFinal } from "@/ia/conteudo";
import { Midia } from "@/projeto/tipos";
import { ehEfeitoSonoro } from "@/timeline/operacoes";
import { Timeline } from "@/timeline/schema";
import { envelopeDoArquivo } from "./envelope";

// Como a pessoa fala (para a direção automática escolher o ritmo do
// vídeo): velocidade, pausas e quanto o volume varia (fala expressiva ×
// monótona) → energia calma, média ou alta.

const r2 = (n: number) => Math.round(n * 100) / 100;

export const medirVoz = async (t: Timeline, biblioteca: Midia[]) => {
  const p = palavrasNoVideoFinal(t, biblioteca);
  if (p.length < 5) return null;
  const inicio = p[0].de;
  const fim = p[p.length - 1].ate;
  const duracao = Math.max(1, fim - inicio);
  const ppS = p.length / duracao;
  const pausas = p
    .slice(1)
    .map((x, i) => x.de - p[i].ate)
    .filter((g) => g > 0.25);
  const pausaMedia = pausas.length
    ? pausas.reduce((a, b) => a + b, 0) / pausas.length
    : 0;

  // Variação do volume na fala (desvio padrão do volume nos trechos com voz).
  let variacao: number | null = null;
  const audio = t.audios.find(
    (a) =>
      !ehEfeitoSonoro(a.url) &&
      a.inicio <= inicio + 0.5 &&
      biblioteca.some((m) => m.url === a.url && m.analise?.transcricao),
  );
  if (audio) {
    try {
      const desde = audio.origemInicio + Math.max(0, inicio - audio.inicio);
      const valores = (
        await envelopeDoArquivo(audio.url, desde, desde + Math.min(duracao, 90), 10)
      ).filter((v) => v > 0.08);
      if (valores.length > 5) {
        const media = valores.reduce((a, b) => a + b, 0) / valores.length;
        variacao = Math.sqrt(
          valores.reduce((a, v) => a + (v - media) ** 2, 0) / valores.length,
        );
      }
    } catch {
      variacao = null;
    }
  }

  let pontos = 0;
  if (ppS >= 3) pontos++;
  if (ppS >= 3.5) pontos++;
  if (ppS < 2.3) pontos--;
  if (pausaMedia > 0.6) pontos--;
  if (variacao !== null && variacao > 0.24) pontos++;
  if (variacao !== null && variacao < 0.12) pontos--;
  return {
    duracao_da_fala_s: r2(duracao),
    palavras_por_segundo: r2(ppS),
    pausa_media_s: r2(pausaMedia),
    pausas_longas: pausas.filter((g) => g > 0.7).length,
    variacao_do_volume: variacao === null ? null : r2(variacao),
    energia: pontos >= 1 ? "alta" : pontos <= -1 ? "calma" : "media",
  } as const;
};
