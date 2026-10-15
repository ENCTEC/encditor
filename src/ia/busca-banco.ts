import { Midia } from "@/projeto/tipos";

// Busca no banco de mídia do cliente pelo CONTEÚDO (o que a IA descreveu
// de cada vídeo/imagem: resumo, momentos, texto na tela e fala). Usada
// pelo planejador (para mandar em detalhe só o que tem a ver com o
// roteiro) e pela ferramenta buscar_no_banco do chat de edição.

const PALAVRAS_VAZIAS = new Set(
  "a o e de da do das dos em no na nos nas um uma uns umas para pra por com sem que se ao aos as os ou mais muito ja já tem ter esse essa isso este esta isto aqui ali seu sua seus suas voce você gente olha so só bem vai vou foi ser ate até the and of with".split(
    " ",
  ),
);

export const termos = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((p) => p.length >= 3 && !PALAVRAS_VAZIAS.has(p))
    // Plural simples: "frascos" = "frasco", "lojas" = "loja".
    .map((p) => (p.length > 4 && p.endsWith("s") ? p.slice(0, -1) : p));

// Todo o texto que descreve o arquivo.
export const textoDaMidia = (m: Midia) => {
  const a = m.analise;
  return [
    m.apelido,
    m.nomeArquivo,
    a?.visual?.resumo,
    ...(a?.visual?.momentos ?? []).flatMap((x) => [
      x.descricao,
      x.texto_na_tela,
    ]),
    a?.transcricao?.texto,
  ]
    .filter(Boolean)
    .join(" ");
};

export type Achado = {
  midia: Midia;
  pontos: number;
  // Momentos que mais combinam (de/ate no ARQUIVO).
  momentos: { de: number; ate: number; descricao: string }[];
};

// Pontua cada arquivo pela quantidade de termos da consulta que aparecem
// na descrição dele (termo raro vale mais). Devolve do melhor ao pior.
export const buscarNoBanco = (midias: Midia[], consulta: string): Achado[] => {
  const alvo = [...new Set(termos(consulta))];
  if (!alvo.length) return [];
  const indices = midias.map((m) => new Set(termos(textoDaMidia(m))));
  // Peso de cada termo: quanto mais raro no banco, mais vale.
  const peso = new Map(
    alvo.map((t) => {
      const n = indices.filter((ix) => ix.has(t)).length;
      return [t, n ? Math.log(1 + midias.length / n) : 0];
    }),
  );
  return midias
    .map((midia, i) => {
      const pontos = alvo.reduce(
        (soma, t) => soma + (indices[i].has(t) ? (peso.get(t) ?? 0) : 0),
        0,
      );
      const momentos = (midia.analise?.visual?.momentos ?? [])
        .map((x) => ({
          de: x.de,
          ate: x.ate,
          descricao:
            x.descricao +
            (x.texto_na_tela ? ` [texto: ${x.texto_na_tela}]` : ""),
          pontos: termos(`${x.descricao} ${x.texto_na_tela}`).filter((t) =>
            alvo.includes(t),
          ).length,
        }))
        .filter((x) => x.pontos > 0)
        .sort((a, b) => b.pontos - a.pontos)
        .slice(0, 3)
        .map(({ de, ate, descricao }) => ({ de, ate, descricao }));
      return { midia, pontos, momentos };
    })
    .filter((a) => a.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos);
};
