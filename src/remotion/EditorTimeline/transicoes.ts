import type { TransitionPresentation } from "@remotion/transitions";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { fade } from "@remotion/transitions/fade";
import { flip } from "@remotion/transitions/flip";
import { iris } from "@remotion/transitions/iris";
import { pushCut } from "@remotion/transitions/push-cut";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { Direcao, TipoTransicao } from "../../timeline/schema";

// Traduz o tipo de transição do JSON para o efeito do Remotion.

type Lado = "from-left" | "from-right" | "from-top" | "from-bottom";

const LADO: Record<Direcao, Lado> = {
  esquerda: "from-left",
  direita: "from-right",
  cima: "from-top",
  baixo: "from-bottom",
};

type Apresentacao = TransitionPresentation<Record<string, unknown>>;

export const criarTransicao = (
  tipo: Exclude<TipoTransicao, "corte">,
  direcao: Direcao | undefined,
  largura: number,
  altura: number,
): Apresentacao => {
  const efeito = (() => {
    switch (tipo) {
      case "fade":
        return fade();
      case "slide":
        return slide({ direction: LADO[direcao ?? "direita"] });
      case "cortina":
        return wipe({ direction: LADO[direcao ?? "esquerda"] });
      case "virar":
        return flip({ direction: LADO[direcao ?? "direita"] });
      case "relogio":
        return clockWipe({ width: largura, height: altura });
      case "iris":
        return iris({ width: largura, height: altura });
      case "impacto":
        return pushCut();
    }
  })();
  return efeito as unknown as Apresentacao;
};
