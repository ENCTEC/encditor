import {
  conferirEdicao,
  descreverMomento,
  focoDaEdicao,
  momentosParaMedir,
  ProblemaMedido,
  problemasMedidos,
} from "@/ia/conferencia";
import { revisarQuadros } from "@/ia/revisor";
import { Midia } from "@/projeto/tipos";
import { Timeline } from "@/timeline/schema";
import {
  montarPranchas,
  POSICOES_NA_PRANCHA,
  QuadroRenderizado,
  renderizarQuadros,
} from "./quadros";

// Conferência de uma edição (ou do vídeo todo) em três camadas:
// 1) regras sem custo (tempos, textos longos, repetição, tela vazia…);
// 2) quadros de verdade com a posição MEDIDA de cada texto e desenho
//    (um em cima do outro, saindo da tela) — perto do fim de cada item;
// 3) se "olhar": um revisor independente olha esses quadros (contraste,
//    emoji sem cor, elemento solto, algo contra o pedido…).
// Usada depois de cada edição do chat e pela ferramenta conferir_video.

export type Achado = {
  origem: "regra" | "medida" | "revisor";
  segundo: number | null;
  // Para a IA corrigir.
  texto: string;
  // Para o usuário (nota final do chat).
  curto: string;
};

export type Conferencia = {
  achados: Achado[];
  quadros: QuadroRenderizado[];
  // Quantos quadros foram medidos e quantos o revisor olhou.
  medidos: number;
  olhados: number;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

export const conferirVideo = async ({
  antes,
  depois,
  biblioteca,
  origem,
  olhar,
  olharSo,
  contexto,
  aviso,
}: {
  // Timeline de antes do pedido (só o que mudou é conferido; para o vídeo
  // todo, use semItens(timeline)).
  antes: Timeline;
  depois: Timeline;
  biblioteca: Midia[];
  // Endereço do app (os quadros buscam os arquivos nele).
  origem: string;
  // Pedir o revisor com imagens?
  olhar: boolean;
  // Revisor só nestes segundos (conferir de novo o que ele apontou).
  olharSo?: number[];
  // O que o usuário pediu, para o revisor.
  contexto: string;
  aviso?: (texto: string) => void;
}): Promise<Conferencia> => {
  const foco = focoDaEdicao(antes, depois);
  const momentos = [...momentosParaMedir(depois, foco), ...(olharSo ?? [])]
    .sort((a, b) => a - b)
    .filter((s, i, todos) => i === 0 || s - todos[i - 1] > 0.1);

  let quadros: QuadroRenderizado[] = [];
  let medidas: ProblemaMedido[] = [];
  let mediu = false;
  if (momentos.length) {
    try {
      aviso?.(`Gerando ${momentos.length} quadro(s) do vídeo para conferir…`);
      quadros = await renderizarQuadros(
        depois,
        origem,
        momentos,
        (feitos, total) =>
          aviso?.(`Medindo onde ficou cada texto (quadro ${feitos} de ${total})…`),
        { medir: true },
      );
      medidas = problemasMedidos(depois, quadros, foco);
      mediu = true;
    } catch (e) {
      // Sem os quadros, a sobreposição volta a ser estimada pelas regras.
      console.error("[ia] quadros da conferência falharam:", e);
    }
  }
  const regras = conferirEdicao(antes, depois, biblioteca, {
    estimarSobreposicao: !mediu,
  });

  // Revisor independente olhando as imagens.
  const paraOlhar = !olhar
    ? []
    : olharSo
      ? quadros.filter((q) => olharSo.some((s) => Math.abs(s - q.segundo) < 0.15))
      : quadros;
  let vistos: Awaited<ReturnType<typeof revisarQuadros>> = [];
  if (paraOlhar.length) {
    aviso?.(`Um revisor está olhando ${paraOlhar.length} quadro(s) do vídeo…`);
    const pranchas = await montarPranchas(paraOlhar);
    vistos = await revisarQuadros({
      contexto,
      pranchas: pranchas.map((p, k) => ({
        base64: p.base64,
        legenda: `Prancha ${k + 1}:\n${p.quadros
          .map((q, i) => `- ${POSICOES_NA_PRANCHA[i]}: ${descreverMomento(depois, biblioteca, q.segundo)}`)
          .join("\n")}`,
      })),
    });
  }

  return {
    // As medidas (certeza) primeiro; depois as regras e o revisor.
    achados: [
      ...medidas.map((m): Achado => ({
        origem: "medida",
        segundo: m.segundo,
        texto: m.texto,
        curto: m.curto,
      })),
      ...regras.map((texto): Achado => ({
        origem: "regra",
        segundo: null,
        texto,
        curto: texto,
      })),
      ...vistos.map((v): Achado => ({
        origem: "revisor",
        segundo: v.segundo,
        texto: `${r1(v.segundo)}s: ${v.problema} (como corrigir: ${v.como_corrigir})`,
        curto: `${r1(v.segundo)}s: ${v.problema}`,
      })),
    ],
    quadros,
    medidos: mediu ? quadros.length : 0,
    olhados: paraOlhar.length,
  };
};

// Os quadros dos momentos com problema (para a IA ver o que vai corrigir).
export const quadrosDosAchados = (
  c: Conferencia,
  depois: Timeline,
  biblioteca: Midia[],
  maximo = 6,
) => {
  const segundos = c.achados
    .map((a) => a.segundo)
    .filter((s): s is number => s !== null);
  return c.quadros
    .filter((q) => segundos.some((s) => Math.abs(s - q.segundo) < 0.4))
    .slice(0, maximo)
    .map((q) => ({
      base64: q.base64,
      legenda: descreverMomento(depois, biblioteca, q.segundo),
    }));
};
