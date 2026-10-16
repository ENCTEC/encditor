import { corrigirComRoteiro, fichas, parecido } from "./alinhamento";
import { Midia } from "@/projeto/tipos";
import { narracaoSemRespiros, temposDasCenas } from "./tempos";
import { PlanoGerado, PlanoSalvo, VerificacaoNarracao } from "./tipos";

// Confere a narração gravada ANTES de gerar os takes: acha onde cada fala
// foi dita, mede quanto cada cena dura de verdade e ajusta o plano — a
// duração de cada cena, quanto gerar no Higgsfield (com folga para aparar
// e para a transição) e os segundos escritos no prompt. Assim os takes
// saem do tamanho certo e o vídeo não fica com tela preta.

const r1 = (n: number) => Math.round(n * 10) / 10;

// Sobe quando o jeito de conferir melhora: conferências antigas são
// refeitas sozinhas. 2 = alinhamento palavra a palavra + nomes corrigidos.
export const VERSAO_CONFERENCIA = 2;

// Folga em cada take: aparar o começo (quadros "travados") e uma sobra.
const FOLGA_GERAR = 1;
const MINIMO_GERAR = 3;

const palavrasDe = (texto: string) => texto.split(/\s+/).filter(Boolean);

// O que foi dito confere com a fala do roteiro? (palavra a palavra,
// tolerante a nomes transcritos tortos e a pequenas trocas)
const confere = (fala: string, falou: string) => {
  const esperado = fichas(palavrasDe(fala), true);
  if (!esperado.length) return true;
  const dito = fichas(palavrasDe(falou));
  const presentes = esperado.filter((e) =>
    dito.some((d) => {
      const s = parecido(e.t, d.t);
      return s >= 0.8 || (e.propria && s >= 0.5);
    }),
  ).length;
  return presentes / esperado.length >= 0.6;
};

// "…, 5 seconds." no prompt passa a ser a duração nova.
const comSegundos = (prompt: string | null, segundos: number) =>
  prompt
    ? /\b\d+(?:[.,]\d+)?\s*(?:-\s*)?seconds?\b/i.test(prompt)
      ? prompt.replace(
          /\b\d+(?:[.,]\d+)?\s*(?:-\s*)?seconds?\b/gi,
          `${segundos} seconds`,
        )
      : `${prompt.trim()} Duration: ${segundos} seconds.`
    : prompt;

export const verificarNarracao = (
  plano: PlanoSalvo,
  narracao: Midia,
): {
  gerado: PlanoGerado;
  verificacao: VerificacaoNarracao;
  // Palavras da transcrição com os nomes do roteiro corrigidos (mesma
  // ordem da transcrição; "" = juntada à anterior, como "em vigo").
  palavrasCorrigidas: string[];
} => {
  const g = plano.gerado;
  if (!g) throw new Error("Ainda não há plano.");
  const { palavras, fala } = narracaoSemRespiros(narracao);
  if (!palavras.length) {
    throw new Error("A narração ainda não foi transcrita (ou não tem fala).");
  }
  const { inicios, fimTotal, naoAchadas } = temposDasCenas(g.cenas, palavras);
  const palavrasCorrigidas = corrigirComRoteiro(
    g.cenas.flatMap((c) => palavrasDe(c.fala)),
    palavras.map((p) => p.palavra),
  );
  const avisos: string[] = [];

  const cenas = g.cenas.map((c, i) => {
    const inicio = inicios[i];
    const fim = i + 1 < g.cenas.length ? inicios[i + 1] : fimTotal;
    const duracao = Math.max(0.5, fim - inicio);
    // A transição de entrada da PRÓXIMA cena come o fim desta.
    const proxima = g.cenas[i + 1]?.transicao_entrada;
    const transicao =
      proxima && proxima.tipo !== "corte" ? proxima.duracao_s : 0;
    const gerar = Math.max(
      MINIMO_GERAR,
      Math.ceil(duracao + transicao + FOLGA_GERAR),
    );
    // O que foi dito na cena, já com os nomes corrigidos.
    const falou = palavras
      .map((p, k) => ({ de: p.de, palavra: palavrasCorrigidas[k] }))
      .filter((p) => p.palavra && p.de >= inicio - 0.05 && p.de < fim - 0.05)
      .map((p) => p.palavra)
      .join(" ");
    return {
      numero: c.numero,
      inicio: r1(inicio),
      duracao: r1(duracao),
      gerar,
      falou,
      confere: !naoAchadas.includes(c.numero) && confere(c.fala, falou),
    };
  });

  const diferentes = cenas.filter((c) => !c.confere).map((c) => c.numero);
  if (diferentes.length) {
    avisos.push(
      `Você falou a${diferentes.length > 1 ? "s cenas" : " cena"} ${diferentes.join(", ")} de um jeito diferente do roteiro — tudo bem: os tempos e as legendas seguem a sua gravação.`,
    );
  }
  const total = r1(fimTotal);
  const previsto = g.duracao_total_s;
  if (Math.abs(total - previsto) > Math.max(2, previsto * 0.15)) {
    avisos.push(
      `A narração ficou com ${total}s (o plano previa ~${Math.round(previsto)}s): os tempos das cenas foram ajustados para ela.`,
    );
  }

  const gerado: PlanoGerado = {
    ...g,
    duracao_total_s: total,
    cenas: g.cenas.map((c, i) => ({
      ...c,
      duracao_s: cenas[i].duracao,
      // Cena do banco: o arquivo já existe; só a duração na edição muda.
      duracao_gerar_s:
        c.origem === "banco" ? c.duracao_gerar_s : cenas[i].gerar,
      prompt_higgsfield:
        c.origem === "banco"
          ? c.prompt_higgsfield
          : comSegundos(c.prompt_higgsfield, cenas[i].gerar),
    })),
  };
  return {
    gerado,
    palavrasCorrigidas,
    verificacao: {
      versao: VERSAO_CONFERENCIA,
      respiros: { quantos: fala.respiros, segundos: fala.economizado },
      midiaId: narracao.id,
      doPlano: plano.geradoEm,
      duracao: total,
      em: Date.now(),
      cenas,
      avisos,
    },
  };
};
