import { salvarArquivo } from "./armazenamento";
import { clienteOpenAI, MODELOS, openaiConfigurada } from "./openai";

// Busca imagens na web para a IA do chat completar um vídeo sozinha:
// - logo de uma marca: Wikidata (propriedade "logotipo") → Wikimedia
//   Commons (a miniatura em PNG, mesmo quando o original é SVG);
// - foto de uso livre: busca no Wikimedia Commons (licenças livres).
// Antes de guardar, a IA olha a imagem e confirma se é mesmo o que foi
// pedido (o Wikidata confunde nomes: "Banco Inter" → Banco Mundial).
// Só baixa dos servidores de imagem da Wikimedia.

const AGENTE =
  "encEditor/1.0 (https://github.com/ENCTEC/encditor; contato@enctec.com.br)";
const HOSTS_DE_IMAGEM = new Set(["upload.wikimedia.org", "thumb.wikimedia.org"]);
const TIPOS_DE_IMAGEM: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
const MAXIMO_BYTES = 15 * 1024 * 1024;

export type ImagemDaWeb = {
  arquivo: string;
  largura: number;
  altura: number;
  titulo: string;
  fonte: {
    site: string;
    pagina: string;
    licenca: string;
    autor?: string;
  };
};

const buscarJson = async (url: string) => {
  const r = await fetch(url, {
    headers: { "User-Agent": AGENTE },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`a busca respondeu ${r.status}`);
  return r.json();
};

const API_WIKIDATA = "https://www.wikidata.org/w/api.php";
const API_COMMONS = "https://commons.wikimedia.org/w/api.php";
const comParametros = (base: string, p: Record<string, string>) =>
  `${base}?${new URLSearchParams({ format: "json", ...p })}`;

// Texto simples para comparar (sem acento, minúsculo, palavras).
const palavras = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 1);
const VAZIAS = new Set(["de", "do", "da", "dos", "das", "e", "o", "a", "the", "of"]);

type ArquivoCommons = {
  titulo: string;
  miniatura: string;
  largura: number;
  altura: number;
  pagina: string;
  licenca: string;
  autor?: string;
};

// Informação de arquivos do Commons (miniatura com "largura" px).
const arquivosDoCommons = async (
  parametros: Record<string, string>,
  largura: number,
): Promise<ArquivoCommons[]> => {
  const j = await buscarJson(
    comParametros(API_COMMONS, {
      action: "query",
      prop: "imageinfo",
      iiprop: "url|size|mime|extmetadata",
      iiurlwidth: String(largura),
      ...parametros,
    }),
  );
  const paginas = Object.values(j.query?.pages ?? {}) as {
    title: string;
    index?: number;
    imageinfo?: {
      thumburl?: string;
      thumbwidth?: number;
      thumbheight?: number;
      descriptionurl?: string;
      mime?: string;
      extmetadata?: Record<string, { value?: string }>;
    }[];
  }[];
  return paginas
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .flatMap((p) => {
      const info = p.imageinfo?.[0];
      if (!info?.thumburl) return [];
      const meta = info.extmetadata ?? {};
      const semHtml = (s?: string) => s?.replace(/<[^>]+>/g, "").trim();
      return [
        {
          titulo: p.title.replace(/^File:/, ""),
          miniatura: info.thumburl,
          largura: info.thumbwidth ?? largura,
          altura: info.thumbheight ?? largura,
          pagina: info.descriptionurl ?? "",
          licenca: semHtml(meta.LicenseShortName?.value) ?? "?",
          autor: semHtml(meta.Artist?.value),
        },
      ];
    });
};

// Candidatos a logo: as entidades do Wikidata com "logotipo", da mais
// provável para a menos (nome parecido; descrição com o contexto).
const candidatosDeLogo = async (oQue: string, contexto: string) => {
  const busca = await buscarJson(
    comParametros(API_WIKIDATA, {
      action: "wbsearchentities",
      search: oQue,
      language: "pt",
      uselang: "pt",
      type: "item",
      limit: "8",
    }),
  );
  const achados = (busca.search ?? []) as {
    id: string;
    label?: string;
    description?: string;
  }[];
  if (!achados.length) return [];
  const entidades = await buscarJson(
    comParametros(API_WIKIDATA, {
      action: "wbgetentities",
      ids: achados.map((a) => a.id).join("|"),
      props: "claims",
    }),
  );
  const doNome = palavras(oQue).filter((p) => !VAZIAS.has(p));
  const doContexto = palavras(contexto).filter((p) => !VAZIAS.has(p));
  // Nome que bate vale mais; palavra sobrando no nome ("Banco
  // Internacional para Reconstrução…") e descrição sem o contexto, menos.
  const pontos = (a: (typeof achados)[number]) => {
    const rotulo = palavras(a.label ?? "").filter((p) => !VAZIAS.has(p));
    const descricao = palavras(a.description ?? "").join(" ");
    const batem = doNome.filter((p) => rotulo.includes(p)).length;
    return (
      batem * 2 -
      Math.max(0, rotulo.length - batem) * 0.6 +
      doContexto.filter((p) => descricao.includes(p.slice(0, 5))).length
    );
  };
  return achados
    .map((a, ordem) => ({
      ...a,
      ordem,
      pontos: pontos(a),
      logo: entidades.entities?.[a.id]?.claims?.P154?.[0]?.mainsnak?.datavalue
        ?.value as string | undefined,
    }))
    .filter((a) => a.logo)
    .sort((a, b) => b.pontos - a.pontos || a.ordem - b.ordem);
};

const baixar = async (endereco: string) => {
  const url = new URL(endereco);
  if (url.protocol !== "https:" || !HOSTS_DE_IMAGEM.has(url.hostname)) {
    throw new Error("endereço de imagem fora da Wikimedia");
  }
  const r = await fetch(url, {
    headers: { "User-Agent": AGENTE },
    signal: AbortSignal.timeout(20000),
  });
  const final = new URL(r.url);
  if (!r.ok || !HOSTS_DE_IMAGEM.has(final.hostname)) {
    throw new Error(`a imagem não veio (${r.status})`);
  }
  const tipo = (r.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!TIPOS_DE_IMAGEM[tipo]) throw new Error(`tipo de arquivo inesperado: ${tipo}`);
  const bytes = Buffer.from(await r.arrayBuffer());
  if (bytes.length > MAXIMO_BYTES) throw new Error("imagem grande demais");
  return { bytes, tipo };
};

// A IA olha a imagem e diz se é o que foi pedido (sem a OpenAI, aceita).
const confere = async (bytes: Buffer, tipo: string, pergunta: string) => {
  if (!openaiConfigurada()) return true;
  const r = await clienteOpenAI().responses.create({
    model: MODELOS.visao,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: `${pergunta} Responda só SIM ou NÃO.` },
          {
            type: "input_image",
            image_url: `data:${tipo};base64,${bytes.toString("base64")}`,
            detail: "low",
          },
        ],
      },
    ],
  });
  return /^\s*sim/i.test(r.output_text);
};

const guardar = async (
  bytes: Buffer,
  tipo: string,
  dados: Omit<ImagemDaWeb, "arquivo">,
): Promise<ImagemDaWeb> => {
  const arquivo = await salvarArquivo(
    new Blob([new Uint8Array(bytes)]).stream(),
    TIPOS_DE_IMAGEM[tipo],
  );
  return { arquivo, ...dados };
};

// Logo de uma marca (empresa, banco, loja, produto).
export const buscarLogo = async (
  oQue: string,
  contexto: string,
): Promise<ImagemDaWeb | null> => {
  const candidatos = (await candidatosDeLogo(oQue, contexto)).slice(0, 4);
  for (const c of candidatos) {
    const [arquivo] = await arquivosDoCommons({ titles: `File:${c.logo}` }, 800);
    if (!arquivo) continue;
    const { bytes, tipo } = await baixar(arquivo.miniatura);
    const certo = await confere(
      bytes,
      tipo,
      `Esta imagem é a logo de "${oQue}"${contexto ? ` (${contexto})` : ""}?`,
    );
    if (!certo) continue;
    return guardar(bytes, tipo, {
      largura: arquivo.largura,
      altura: arquivo.altura,
      titulo: c.label ?? oQue,
      fonte: {
        site: "Wikimedia Commons (via Wikidata)",
        pagina: arquivo.pagina,
        licenca: arquivo.licenca,
        autor: arquivo.autor,
      },
    });
  }
  return null;
};

// Foto de uso livre (em inglês a busca acha muito mais).
export const buscarFoto = async (
  oQue: string,
  contexto: string,
): Promise<ImagemDaWeb | null> => {
  const arquivos = await arquivosDoCommons(
    {
      generator: "search",
      gsrsearch: `${oQue} filetype:bitmap`,
      gsrnamespace: "6",
      gsrlimit: "8",
    },
    1280,
  );
  const livres = arquivos.filter(
    (a) => !/fair use|non-free|copyrighted/i.test(a.licenca) && a.largura >= 600,
  );
  for (const a of livres.slice(0, 3)) {
    const { bytes, tipo } = await baixar(a.miniatura);
    const certo = await confere(
      bytes,
      tipo,
      `Esta foto mostra "${oQue}"${contexto ? ` (${contexto})` : ""} e serve bem num anúncio em vídeo (nítida, sem marca d'água)?`,
    );
    if (!certo) continue;
    return guardar(bytes, tipo, {
      largura: a.largura,
      altura: a.altura,
      titulo: a.titulo,
      fonte: {
        site: "Wikimedia Commons",
        pagina: a.pagina,
        licenca: a.licenca,
        autor: a.autor,
      },
    });
  }
  return null;
};
