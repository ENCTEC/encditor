import { Midia, PapelMidia } from "@/projeto/tipos";
import { CenaPlano, InsertPlano, PlanoSalvo } from "./tipos";

// O "mapa" do plano: cada take, insert, narração e música, com o que já
// chegou e o que ainda falta. Quando tudo está pronto, dá para montar.

export type StatusItem =
  | "pendente" // falta enviar
  | "analisando" // chegou, esperando a transcrição
  | "pronto"
  | "pulado" // música opcional dispensada
  | "nao-achado"; // arquivo do banco citado pela IA não existe mais

export type ItemPlano = {
  chave: string;
  tipo: "cena" | "insert" | "narracao" | "musica";
  rotulo: string;
  // Apelido sugerido ao enviar o arquivo.
  apelido: string;
  papel: PapelMidia;
  // Tipos de arquivo aceitos no envio.
  aceita: string;
  obrigatorio: boolean;
  // Ao enviar: analisar com IA? (a narração precisa da transcrição).
  usarIA: boolean;
  doBanco: boolean;
  midia: Midia | null;
  status: StatusItem;
  cena?: CenaPlano;
  insert?: InsertPlano;
};

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9]+/g, "");

export const acharPorApelido = (biblioteca: Midia[], apelido: string | null) =>
  apelido
    ? (biblioteca.find((m) => normalizar(m.apelido) === normalizar(apelido)) ??
      null)
    : null;

const temTranscricao = (m: Midia) => m.analise?.status === "pronta";

// Pelo apelido (estável quando a IA refaz o plano), não pelo número.
export const chaveCena = (c: CenaPlano) => `cena:${c.apelido}`;
export const chaveInsert = (x: InsertPlano) => `insert:${x.apelido}`;

export const itensDoPlano = (
  plano: PlanoSalvo,
  biblioteca: Midia[],
): ItemPlano[] => {
  const g = plano.gerado;
  if (!g) return [];
  const vinculado = (chave: string) =>
    biblioteca.find((m) => m.id === plano.vinculos[chave]) ?? null;
  const itens: ItemPlano[] = [];
  const falaNosTakes = g.modo_audio === "fala_nos_takes";

  g.cenas.forEach((c) => {
    const chave = chaveCena(c);
    const doBanco = c.origem === "banco";
    const midia =
      vinculado(chave) ??
      (doBanco ? acharPorApelido(biblioteca, c.apelido_banco) : null);
    itens.push({
      chave,
      tipo: "cena",
      rotulo: `Cena ${c.numero}`,
      apelido: c.apelido,
      papel: "cena",
      aceita: "video/*,image/*",
      obrigatorio: true,
      // Com fala nos takes, as legendas vêm da transcrição de cada take.
      usarIA: true,
      doBanco,
      midia,
      status: !midia
        ? doBanco
          ? "nao-achado"
          : "pendente"
        : falaNosTakes && !temTranscricao(midia)
          ? "analisando"
          : "pronto",
      cena: c,
    });
  });

  g.inserts.forEach((x, i) => {
    const chave = chaveInsert(x);
    const doBanco = x.origem === "banco";
    const midia =
      vinculado(chave) ??
      (doBanco ? acharPorApelido(biblioteca, x.apelido_banco) : null);
    itens.push({
      chave,
      tipo: "insert",
      rotulo: `Insert ${i + 1}`,
      apelido: x.apelido,
      papel: "insert",
      aceita: "video/*,image/*",
      obrigatorio: true,
      usarIA: false,
      doBanco,
      midia,
      status: midia ? "pronto" : doBanco ? "nao-achado" : "pendente",
      insert: x,
    });
  });

  if (g.modo_audio === "narracao") {
    const midia = vinculado("narracao");
    itens.push({
      chave: "narracao",
      tipo: "narracao",
      rotulo: "Narração (voz em off)",
      apelido: g.narracao?.apelido || "narracao",
      papel: "audio",
      aceita: "audio/*,video/*",
      obrigatorio: true,
      usarIA: true,
      doBanco: false,
      midia,
      status: !midia
        ? "pendente"
        : temTranscricao(midia)
          ? "pronto"
          : "analisando",
    });
  }

  if (g.musica.usar) {
    const midia = vinculado("musica");
    itens.push({
      chave: "musica",
      tipo: "musica",
      rotulo: "Música de fundo (opcional)",
      apelido: g.musica.apelido || "musica",
      papel: "audio",
      aceita: "audio/*",
      obrigatorio: false,
      usarIA: false,
      doBanco: false,
      midia,
      status: midia ? "pronto" : plano.musicaPulada ? "pulado" : "pendente",
    });
  }
  return itens;
};

// Tudo resolvido: obrigatórios prontos e a música enviada ou dispensada.
export const planoCompleto = (itens: ItemPlano[]) =>
  itens.length > 0 &&
  itens.every((i) => i.status === "pronto" || i.status === "pulado");
