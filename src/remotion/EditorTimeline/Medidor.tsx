import { useLayoutEffect } from "react";
import { continueRender, delayRender, useCurrentFrame } from "remotion";
import {
  CaixaMedida,
  ItemMedido,
  MedidaDoQuadro,
  PREFIXO_CAIXAS,
} from "./medidas";

// Medição para a conferência do chat: em cada quadro gerado para conferir
// a edição (renderStill com envVariables ENCEDITOR_MEDIR = "1"), mede onde
// cada texto e cada desenho de cada item (motion, insert, legenda) ficou de
// verdade na tela e manda pelo console ("__CAIXAS__{...}"). O servidor lê
// isso (onBrowserLog) e acha sobreposições e textos saindo da tela sem
// estimar. No preview e na exportação não faz nada.

export const MEDIR_CAIXAS =
  typeof process !== "undefined" && process.env.ENCEDITOR_MEDIR === "1";


// Opacidade de verdade de um elemento (multiplica a dos pais até a raiz).
const opacidade = (el: Element | null, raiz: Element) => {
  let o = 1;
  for (let e = el; e && e !== raiz.parentElement; e = e.parentElement) {
    const s = getComputedStyle(e);
    if (s.visibility === "hidden" || s.display === "none") return 0;
    o *= Number(s.opacity);
  }
  return o;
};

const corVisivel = (cor: string) => {
  const m = cor.match(/rgba?\(([^)]+)\)/);
  if (!m) return cor !== "transparent" && cor !== "none" && cor !== "";
  const partes = m[1].split(/[ ,/]+/).filter(Boolean);
  return partes.length < 4 || Number(partes[3]) > 0.1;
};

const FORMAS_SVG = "circle, ellipse, rect, path, polygon, polyline, line, image, text";

const medir = (): ItemMedido[] => {
  const raiz = document.querySelector("[data-raiz-video]");
  if (!raiz) return [];
  const tela = raiz.getBoundingClientRect();
  const emPorcento = (r: DOMRect): [number, number, number, number] => [
    ((r.left - tela.left) / tela.width) * 100,
    ((r.top - tela.top) / tela.height) * 100,
    ((r.right - tela.left) / tela.width) * 100,
    ((r.bottom - tela.top) / tela.height) * 100,
  ];
  // Caixa que cobre mais da metade da tela é fundo/película, não conta.
  const grandeDemais = (r: DOMRect) =>
    r.width * r.height > tela.width * tela.height * 0.5;
  const pequena = (r: DOMRect) => r.width < 2 || r.height < 2;

  return [...document.querySelectorAll("[data-item]")].map((item) => {
    const caixas: CaixaMedida[] = [];
    // Textos: a caixa de cada linha de cada pedaço de texto visível.
    const andador = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
    for (let n = andador.nextNode(); n; n = andador.nextNode()) {
      if (!n.textContent?.trim() || !n.parentElement) continue;
      if (opacidade(n.parentElement, item) < 0.2) continue;
      const faixa = document.createRange();
      faixa.selectNodeContents(n);
      for (const r of faixa.getClientRects()) {
        if (!pequena(r) && !grandeDemais(r)) caixas.push(["t", ...emPorcento(r)]);
      }
    }
    // Formas: imagens/vídeos, desenhos do SVG e caixas com fundo ou borda.
    for (const el of item.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (pequena(r) || grandeDemais(r)) continue;
      const s = getComputedStyle(el);
      let forma = false;
      if (el instanceof HTMLImageElement || el instanceof HTMLVideoElement || el instanceof HTMLCanvasElement) {
        forma = true;
      } else if (el instanceof SVGElement) {
        forma =
          el.matches(FORMAS_SVG) &&
          ((s.fill !== "none" && corVisivel(s.fill)) ||
            (s.stroke !== "none" && corVisivel(s.stroke)));
      } else {
        forma =
          corVisivel(s.backgroundColor) ||
          (s.backgroundImage !== "none" && s.backgroundImage !== "") ||
          (Number.parseFloat(s.borderTopWidth) > 0 && corVisivel(s.borderTopColor));
      }
      if (forma && opacidade(el, item) >= 0.2) caixas.push(["f", ...emPorcento(r)]);
    }
    const arred = (v: number) => Math.round(v * 10) / 10;
    return {
      item: item.getAttribute("data-item") ?? "",
      caixas: caixas.map(
        ([t, a, b, c, d]) => [t, arred(a), arred(b), arred(c), arred(d)] as CaixaMedida,
      ),
    };
  });
};

export const Medidor: React.FC = () => {
  const frame = useCurrentFrame();
  useLayoutEffect(() => {
    if (!MEDIR_CAIXAS) return;
    // Segura o quadro até medir. O Remotion monta o vídeo fora da página
    // (sem tamanho) e só depois o coloca no lugar: espera isso e as fontes.
    const espera = delayRender(`medir quadro ${frame}`);
    let vivo = true;
    const tentar = (vezes: number) => {
      if (!vivo) return continueRender(espera);
      const r = document.querySelector("[data-raiz-video]")?.getBoundingClientRect();
      if (vezes < 300 && (!r || r.width < 1 || r.top < -10000)) {
        requestAnimationFrame(() => tentar(vezes + 1));
        return;
      }
      document.fonts.ready.then(() =>
        requestAnimationFrame(() => {
          if (vivo) {
            const medida: MedidaDoQuadro = { frame, itens: medir() };
            console.log(PREFIXO_CAIXAS + JSON.stringify(medida));
          }
          continueRender(espera);
        }),
      );
    };
    requestAnimationFrame(() => tentar(0));
    return () => {
      vivo = false;
    };
  }, [frame]);
  return null;
};
