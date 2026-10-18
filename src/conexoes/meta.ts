import { createHmac } from "node:crypto";
import type { ResultadoOrganico } from "@/projeto/resultado";
import type {
  NumerosAnuncio,
  VinculoAnuncio,
  VinculoInstagram,
} from "./vinculos";

// Leitura das métricas na Meta (Instagram e Anúncios) com a chave de acesso
// que o PRÓPRIO cliente gera no app dele (tutorial em /conectar, sem
// análise da Meta: o app fica no portfólio dono das contas e usa o acesso
// padrão). Só leitura. Pesquisa e regras: CLAUDE.MD, "Métricas da Meta".
//
// Versão da API: um app só chama a versão mais nova da data em que foi
// criado (e as seguintes). Se a Meta recusar a versão, o encEditor tenta as
// próximas sozinho e passa a usar a que funcionar.

export const VERSAO_GRAPH = process.env.META_GRAPH_VERSAO ?? "v26.0";
const base = () =>
  (process.env.META_GRAPH_BASE ?? "https://graph.facebook.com").replace(
    /\/$/,
    "",
  );

const global = globalThis as unknown as { versaoMetaAtual?: string };
export const versaoEmUso = () => global.versaoMetaAtual ?? VERSAO_GRAPH;
const proximaVersao = (v: string) => {
  const n = Number(/^v(\d+)/.exec(v)?.[1] ?? NaN);
  return Number.isFinite(n) ? `v${n + 1}.0` : null;
};

export type SegredoMeta = {
  token: string;
  // Só se a pessoa usou um segundo app para o Instagram.
  tokenInstagram: string | null;
  // Chave secreta do app (só se ele exige "Require App Secret").
  appSecret: string | null;
  // Chave secreta do 2º app (o do Instagram), se ele também exige.
  appSecretInstagram?: string | null;
};

// Qual chave fez a chamada: a principal ou a do app do Instagram.
export type QualChave = "principal" | "instagram";
type Credencial = { token: string; segredo: string | null; chave: QualChave };

const credPrincipal = (s: SegredoMeta): Credencial => ({
  token: s.token,
  segredo: s.appSecret,
  chave: "principal",
});
// O Instagram usa a 2ª chave quando ela existe (com a chave secreta DO
// app dela: o appsecret_proof é por app).
const credInstagram = (s: SegredoMeta): Credencial =>
  s.tokenInstagram
    ? {
        token: s.tokenInstagram,
        segredo: s.appSecretInstagram ?? null,
        chave: "instagram",
      }
    : credPrincipal(s);

export type TipoErroMeta =
  | "token"
  | "permissao"
  | "limite"
  | "versao"
  | "segredo"
  | "parametro"
  | "rede"
  | "outro";

export class ErroMeta extends Error {
  constructor(
    mensagem: string,
    readonly tipo: TipoErroMeta,
    readonly codigo: number | null,
    readonly subcodigo: number | null,
    // Texto original da Meta (para o registro e para quem dá suporte).
    readonly original: string,
    // Em erro de limite: quantos minutos a Meta pediu para esperar.
    readonly esperarMin: number | null = null,
    readonly chave: QualChave = "principal",
  ) {
    super(mensagem);
  }
}

// Códigos de "chamadas demais" (pausa): app, usuário, Páginas, conta de
// anúncios e os limites por caso de uso (BUC).
const DE_LIMITE = new Set([
  4, 17, 32, 613, 80000, 80001, 80002, 80003, 80004, 80014,
]);

// Minutos até liberar, lidos do cabeçalho X-Business-Use-Case-Usage.
const minutosParaLiberar = (cabecalhos: Headers | null) => {
  const bruto =
    cabecalhos?.get("x-business-use-case-usage") ??
    cabecalhos?.get("x-business-use-case");
  if (!bruto) return null;
  try {
    const dados = JSON.parse(bruto) as Record<
      string,
      { estimated_time_to_regain_access?: number }[]
    >;
    const minutos = Object.values(dados)
      .flat()
      .map((x) => Number(x.estimated_time_to_regain_access) || 0);
    const maior = Math.max(0, ...minutos);
    return maior > 0 ? maior : null;
  } catch {
    return null;
  }
};

const erroDaMeta = (
  status: number,
  e: { code?: number; error_subcode?: number; message?: string },
  cabecalhos: Headers | null,
  chave: QualChave,
) => {
  const codigo = typeof e.code === "number" ? e.code : null;
  const sub = typeof e.error_subcode === "number" ? e.error_subcode : null;
  const original = e.message ?? `HTTP ${status}`;
  const qual = chave === "instagram" ? "Chave do app do Instagram: " : "";
  const novo = (
    texto: string,
    tipo: TipoErroMeta,
    esperar: number | null = null,
  ) =>
    new ErroMeta(
      `${qual}${texto}`,
      tipo,
      codigo,
      sub,
      original,
      esperar,
      chave,
    );
  const comOriginal = (texto: string) => `${texto} (Meta: ${original})`;

  if (codigo === 190 || status === 401) {
    return novo(
      comOriginal(
        "a chave de acesso não vale mais: foi revogada, venceu, o usuário do sistema perdeu as contas ou o app ficou inativo (se o painel do app disser “inativo”, restaure-o primeiro). Depois gere uma chave nova (passo 14 do tutorial) e cole de novo.",
      ),
      "token",
    );
  }
  if (codigo !== null && DE_LIMITE.has(codigo)) {
    const esperar = minutosParaLiberar(cabecalhos) ?? 5;
    return novo(
      `a Meta pediu uma pausa (leituras demais em pouco tempo). O encEditor tenta de novo depois de ~${esperar} min, na próxima leitura.`,
      "limite",
      esperar,
    );
  }
  if (/appsecret/i.test(original)) {
    return novo(
      comOriginal(
        "o app exige a chave secreta (Require App Secret). Marque “O meu app exige a chave secreta” e cole a chave secreta (App Secret) deste app — passo 10 do tutorial. Se já colou, confira se é a chave secreta do app certo, e não outro código.",
      ),
      "segredo",
    );
  }
  if (
    codigo === 2635 ||
    /version.*(deprecated|no longer|not (available|supported))/i.test(original)
  ) {
    return novo(comOriginal("a Meta não aceitou a versão da API."), "versao");
  }
  if (
    codigo === 10 ||
    codigo === 3 ||
    (codigo !== null && codigo >= 200 && codigo < 300)
  ) {
    return novo(
      comOriginal(
        "falta permissão: confira se o usuário do sistema recebeu o app, a conta de anúncios e a Página (passo 13 do tutorial) e se a chave foi gerada com as permissões da lista (passo 14).",
      ),
      "permissao",
    );
  }
  if (codigo === 100) {
    return novo(comOriginal("a Meta recusou o pedido."), "parametro");
  }
  return novo(comOriginal("a Meta devolveu um erro."), "outro");
};

// A chave colada às vezes vem com espaço ou quebra de linha no meio.
export const limparToken = (token: string) => token.replace(/\s+/g, "");

const chamarNaVersao = async <T>(
  versao: string,
  caminho: string,
  parametros: Record<string, string>,
  cred: Credencial,
): Promise<T> => {
  const url = new URL(`${base()}/${versao}/${caminho.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(parametros)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", cred.token);
  if (cred.segredo) {
    url.searchParams.set(
      "appsecret_proof",
      createHmac("sha256", cred.segredo).update(cred.token).digest("hex"),
    );
  }
  let resposta: Response;
  try {
    resposta = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    throw new ErroMeta(
      "Não consegui falar com a Meta (sem internet ou a Meta fora do ar). Tente de novo daqui a pouco.",
      "rede",
      null,
      null,
      String(e),
      null,
      cred.chave,
    );
  }
  const corpo = (await resposta.json().catch(() => null)) as
    | (T & {
        error?: { code?: number; error_subcode?: number; message?: string };
      })
    | null;
  if (!resposta.ok || !corpo || corpo.error) {
    throw erroDaMeta(
      resposta.status,
      corpo?.error ?? {},
      resposta.headers,
      cred.chave,
    );
  }
  return corpo;
};

// Chama a Graph API. Se a Meta recusar a versão, tenta as 3 seguintes e
// passa a usar a que funcionar (em todas as conexões).
const chamar = async <T>(
  caminho: string,
  parametros: Record<string, string>,
  cred: Credencial,
): Promise<T> => {
  const versao = versaoEmUso();
  try {
    return await chamarNaVersao<T>(versao, caminho, parametros, cred);
  } catch (e) {
    if (!(e instanceof ErroMeta) || e.tipo !== "versao") throw e;
    let tentar = proximaVersao(versao);
    for (let i = 0; i < 3 && tentar; i++, tentar = proximaVersao(tentar)) {
      try {
        const r = await chamarNaVersao<T>(tentar, caminho, parametros, cred);
        global.versaoMetaAtual = tentar;
        console.log(`[meta] passando a usar a versão ${tentar} da API`);
        return r;
      } catch (e2) {
        if (!(e2 instanceof ErroMeta) || e2.tipo !== "versao") throw e2;
      }
    }
    throw new ErroMeta(
      `O encEditor precisa ser atualizado para a versão nova da API da Meta (a ${versao} não é aceita por este app). Avise quem cuida do encEditor. (Meta: ${e.original})`,
      "versao",
      e.codigo,
      e.subcodigo,
      e.original,
      null,
      e.chave,
    );
  }
};

// ---------- Conferir a chave e achar as contas ----------

export type ContaAnuncio = {
  id: string; // "act_123"
  nome: string;
  moeda: string;
  status: number; // 1 = ativa
};

export type ContaInstagram = {
  id: string; // IG User ID (usado nas outras chamadas)
  usuario: string;
  foto: string | null;
  paginaId: string;
  paginaNome: string;
};

export type InfoMeta = {
  usuario: { id: string; nome: string };
  // Nome de quem é dono da 2ª chave (app do Instagram), se houver.
  usuarioInstagram?: { id: string; nome: string } | null;
  // null = a Meta não deixou ler a lista (não impede de funcionar).
  permissoes: string[] | null;
  contasAnuncio: ContaAnuncio[];
  instagrams: ContaInstagram[];
  paginasSemInstagram: { id: string; nome: string }[];
  // false = a lista não pôde ser lida agora (erro passageiro): quem guarda
  // a conexão mantém a lista anterior.
  listas?: { anuncios: boolean; instagram: boolean };
  // Problemas encontrados, cada um apontando o passo do tutorial.
  avisos: { texto: string; passo: string }[];
  verificadoEm: number;
  // Última vez que o encEditor falou com a Meta e o erro dela (ex.: chave
  // revogada).
  ultimaLeitura: number | null;
  erro: string | null;
  // A Meta pediu pausa até este momento (limite de leituras).
  pausaAte?: number | null;
};

type Pagina<T> = {
  data?: T[];
  paging?: { cursors?: { after?: string }; next?: string };
};

// Permissões que cada chave precisa ter.
const DA_PRINCIPAL = [{ permissao: "ads_read", para: "ler os anúncios" }];
const DO_INSTAGRAM = [
  { permissao: "pages_show_list", para: "achar a Página" },
  {
    permissao: "pages_read_engagement",
    para: "achar o Instagram ligado à Página",
  },
  { permissao: "instagram_basic", para: "listar os posts do Instagram" },
  { permissao: "instagram_manage_insights", para: "ler as métricas dos posts" },
  // A Página chega pelo portfólio: a Meta pede também ads_read na chave
  // que lê o Instagram.
  {
    permissao: "ads_read",
    para: "ler as métricas do Instagram de Página do portfólio",
  },
];

const permissoesDe = async (cred: Credencial) => {
  const p = await chamar<Pagina<{ permission: string; status: string }>>(
    "me/permissions",
    {},
    cred,
  );
  return (p.data ?? [])
    .filter((x) => x.status === "granted")
    .map((x) => x.permission);
};

// Erro que significa "não tem acesso" (lista vazia de verdade) ou só "não
// deu agora" (lista não lida).
const ehFaltaDeAcesso = (e: ErroMeta) =>
  e.tipo === "permissao" || (e.tipo === "parametro" && e.subcodigo === 33);
const fatal = (e: unknown) =>
  e instanceof ErroMeta &&
  ["token", "rede", "segredo", "versao"].includes(e.tipo);

export const verificarConexao = async (s: SegredoMeta): Promise<InfoMeta> => {
  const principal = credPrincipal(s);
  const insta = credInstagram(s);
  const eu = await chamar<{ id: string; name?: string }>(
    "me",
    { fields: "id,name" },
    principal,
  );
  const euInstagram =
    insta.chave === "instagram"
      ? await chamar<{ id: string; name?: string }>(
          "me",
          { fields: "id,name" },
          insta,
        )
      : null;
  const avisos: InfoMeta["avisos"] = [];
  const listas = { anuncios: true, instagram: true };

  // Permissões de cada chave, separadas.
  let permissoes: string[] | null = null;
  try {
    const daPrincipal = await permissoesDe(principal);
    const doInstagram =
      insta.chave === "instagram" ? await permissoesDe(insta) : daPrincipal;
    permissoes = [...new Set([...daPrincipal, ...doInstagram])];
    const nomeDa = (c: QualChave) =>
      c === "instagram" ? "A chave do app do Instagram" : "A chave";
    for (const f of DA_PRINCIPAL.filter(
      (n) => !daPrincipal.includes(n.permissao),
    )) {
      avisos.push({
        texto: `${nomeDa("principal")} não tem a permissão ${f.permissao} (para ${f.para}). Gere a chave de novo marcando as permissões da lista.`,
        passo: "gerar-chave",
      });
    }
    for (const f of DO_INSTAGRAM.filter(
      (n) =>
        !doInstagram.includes(n.permissao) &&
        !(
          insta.chave === "principal" &&
          DA_PRINCIPAL.some((d) => d.permissao === n.permissao)
        ),
    )) {
      avisos.push({
        texto: `${nomeDa(insta.chave)} não tem a permissão ${f.permissao} (para ${f.para}). Gere a chave de novo marcando as permissões da lista.`,
        passo: "gerar-chave",
      });
    }
    if (
      !doInstagram.includes("business_management") &&
      !doInstagram.includes("ads_management")
    ) {
      avisos.push({
        texto: `${nomeDa(insta.chave)} não tem business_management: a Meta pode recusar a lista de posts do Instagram. Gere a chave de novo incluindo business_management.`,
        passo: "gerar-chave",
      });
    }
  } catch (e) {
    if (fatal(e)) throw e;
    permissoes = null;
  }

  let contasAnuncio: ContaAnuncio[] = [];
  try {
    const r = await chamar<
      Pagina<{
        id: string;
        name?: string;
        currency?: string;
        account_status?: number;
      }>
    >(
      "me/adaccounts",
      { fields: "id,name,currency,account_status", limit: "100" },
      principal,
    );
    contasAnuncio = (r.data ?? []).map((c) => ({
      id: c.id,
      nome: c.name || c.id,
      moeda: c.currency ?? "BRL",
      status: c.account_status ?? 1,
    }));
  } catch (e) {
    if (fatal(e)) throw e;
    if (!(e instanceof ErroMeta) || !ehFaltaDeAcesso(e)) {
      listas.anuncios = false;
      avisos.push({
        texto: `Não deu para conferir as contas de anúncios agora (${e instanceof Error ? e.message : String(e)}). Tente “Conferir de novo” em alguns minutos.`,
        passo: "colar",
      });
    }
  }
  if (listas.anuncios && !contasAnuncio.length) {
    avisos.push({
      texto:
        "Nenhuma conta de anúncios apareceu. Dê ao usuário do sistema a conta de anúncios (com “Ver desempenho”) e gere a chave de novo.",
      passo: "dar-acesso",
    });
  }

  const instagrams: ContaInstagram[] = [];
  const paginasSemInstagram: InfoMeta["paginasSemInstagram"] = [];
  let paginas = 0;
  try {
    const r = await chamar<
      Pagina<{
        id: string;
        name?: string;
        instagram_business_account?: {
          id: string;
          username?: string;
          profile_picture_url?: string;
        };
      }>
    >(
      "me/accounts",
      {
        fields:
          "id,name,instagram_business_account{id,username,profile_picture_url}",
        limit: "100",
      },
      insta,
    );
    for (const p of r.data ?? []) {
      paginas++;
      const ig = p.instagram_business_account;
      if (ig) {
        instagrams.push({
          id: ig.id,
          usuario: ig.username ?? ig.id,
          foto: ig.profile_picture_url ?? null,
          paginaId: p.id,
          paginaNome: p.name ?? p.id,
        });
      } else {
        paginasSemInstagram.push({ id: p.id, nome: p.name ?? p.id });
      }
    }
  } catch (e) {
    if (fatal(e)) throw e;
    if (!(e instanceof ErroMeta) || !ehFaltaDeAcesso(e)) {
      listas.instagram = false;
      avisos.push({
        texto: `Não deu para conferir o Instagram agora (${e instanceof Error ? e.message : String(e)}). Tente “Conferir de novo” em alguns minutos.`,
        passo: "colar",
      });
    }
  }
  if (listas.instagram && !paginas) {
    avisos.push({
      texto:
        "Nenhuma Página do Facebook apareceu. Dê ao usuário do sistema a Página com “Controle total” e gere a chave de novo.",
      passo: "dar-acesso",
    });
  } else if (listas.instagram && !instagrams.length) {
    avisos.push({
      texto: `A Página ${paginasSemInstagram.map((p) => `“${p.nome}”`).join(", ")} não tem Instagram profissional ligado a ela.`,
      passo: "pagina-instagram",
    });
  }

  return {
    usuario: { id: eu.id, nome: eu.name ?? eu.id },
    usuarioInstagram: euInstagram
      ? { id: euInstagram.id, nome: euInstagram.name ?? euInstagram.id }
      : null,
    permissoes,
    contasAnuncio,
    instagrams,
    paginasSemInstagram,
    listas,
    avisos,
    verificadoEm: Date.now(),
    ultimaLeitura: Date.now(),
    erro: null,
    pausaAte: null,
  };
};

// Chamadas leves, uma por chave: mantêm os apps "ativos" mesmo sem versões
// ligadas (a Meta invalida as chaves de apps sem uso por 90 dias) e usam as
// permissões principais.
export const manterAtivo = async (s: SegredoMeta) => {
  await chamar("me/adaccounts", { fields: "id", limit: "1" }, credPrincipal(s));
  await chamar("me/accounts", { fields: "id", limit: "1" }, credInstagram(s));
};

// ---------- Listas para ligar cada versão ao post / anúncio ----------

export type MidiaInstagram = {
  id: string;
  legenda: string | null;
  tipo: string | null; // REELS, FEED…
  formato: string | null; // VIDEO, IMAGE, CAROUSEL_ALBUM
  link: string | null;
  miniatura: string | null;
  publicadoEm: string | null;
};

export const listarMidiasInstagram = async (
  s: SegredoMeta,
  instagramId: string,
  depois?: string | null,
): Promise<{ itens: MidiaInstagram[]; proximo: string | null }> => {
  const r = await chamar<
    Pagina<{
      id: string;
      caption?: string;
      media_type?: string;
      media_product_type?: string;
      permalink?: string;
      thumbnail_url?: string;
      media_url?: string;
      timestamp?: string;
    }>
  >(
    `${instagramId}/media`,
    {
      fields:
        "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp",
      limit: "30",
      ...(depois ? { after: depois } : {}),
    },
    credInstagram(s),
  );
  return {
    itens: (r.data ?? []).map((m) => ({
      id: m.id,
      legenda: m.caption ? m.caption.slice(0, 160) : null,
      tipo: m.media_product_type ?? null,
      formato: m.media_type ?? null,
      link: m.permalink ?? null,
      miniatura:
        m.thumbnail_url ??
        (m.media_type === "VIDEO" ? null : (m.media_url ?? null)),
      publicadoEm: m.timestamp ?? null,
    })),
    proximo: r.paging?.next ? (r.paging.cursors?.after ?? null) : null,
  };
};

export type AnuncioMeta = {
  id: string;
  nome: string;
  status: string | null;
  criadoEm: string | null;
  campanha: string | null;
  tipo: "conversas" | "cliques" | null;
  miniatura: string | null;
  // Post do Instagram usado no anúncio (para sugerir a ligação).
  instagramMidiaId: string | null;
};

// O que o conjunto de anúncios otimiza: conversas (WhatsApp, Direct,
// Messenger) ou cliques. null = outro objetivo (vendas, alcance…).
export const tipoDoConjunto = (adset?: {
  optimization_goal?: string;
  destination_type?: string;
}): "conversas" | "cliques" | null => {
  const meta = adset?.optimization_goal ?? "";
  const destino = adset?.destination_type ?? "";
  if (
    meta === "CONVERSATIONS" ||
    meta.startsWith("MESSAGING_") ||
    ["WHATSAPP", "MESSENGER", "INSTAGRAM_DIRECT"].includes(destino) ||
    destino.startsWith("MESSAGING_")
  ) {
    return "conversas";
  }
  if (meta === "LINK_CLICKS" || meta === "LANDING_PAGE_VIEWS") return "cliques";
  return null;
};

type AnuncioBruto = {
  id: string;
  name?: string;
  effective_status?: string;
  created_time?: string;
  adset?: { optimization_goal?: string; destination_type?: string };
  campaign?: { name?: string };
  creative?: {
    thumbnail_url?: string;
    image_url?: string;
    effective_instagram_media_id?: string;
    source_instagram_media_id?: string;
  };
};

// Todos os status que a Meta aceita no filtro (DELETED dá erro; anúncios
// excluídos já ligados continuam sendo lidos pelo ID).
const STATUS_LISTADOS = [
  "ACTIVE",
  "PAUSED",
  "CAMPAIGN_PAUSED",
  "ADSET_PAUSED",
  "ARCHIVED",
  "IN_PROCESS",
  "WITH_ISSUES",
  "PENDING_REVIEW",
  "DISAPPROVED",
  "PREAPPROVED",
  "PENDING_BILLING_INFO",
];

export const idDaConta = (contaId: string) =>
  contaId.startsWith("act_") ? contaId : `act_${contaId}`;

export const listarAnuncios = async (
  s: SegredoMeta,
  contaId: string,
  depois?: string | null,
): Promise<{ itens: AnuncioMeta[]; proximo: string | null }> => {
  const pedir = (criativo: string) =>
    chamar<Pagina<AnuncioBruto>>(
      `${idDaConta(contaId)}/ads`,
      {
        fields: `id,name,effective_status,created_time,adset{optimization_goal,destination_type},campaign{name},creative{${criativo}}`,
        effective_status: JSON.stringify(STATUS_LISTADOS),
        limit: "30",
        ...(depois ? { after: depois } : {}),
      },
      credPrincipal(s),
    );
  let r: Pagina<AnuncioBruto>;
  try {
    r = await pedir(
      "thumbnail_url,image_url,effective_instagram_media_id,source_instagram_media_id",
    );
  } catch (e) {
    // Campo do criativo recusado: tenta só com a miniatura.
    if (!(e instanceof ErroMeta) || e.tipo !== "parametro") throw e;
    r = await pedir("thumbnail_url");
  }
  return {
    itens: (r.data ?? []).map((a) => ({
      id: a.id,
      nome: a.name ?? a.id,
      status: a.effective_status ?? null,
      criadoEm: a.created_time ?? null,
      campanha: a.campaign?.name ?? null,
      tipo: tipoDoConjunto(a.adset),
      miniatura: a.creative?.thumbnail_url ?? a.creative?.image_url ?? null,
      instagramMidiaId:
        a.creative?.source_instagram_media_id ??
        a.creative?.effective_instagram_media_id ??
        null,
    })),
    proximo: r.paging?.next ? (r.paging.cursors?.after ?? null) : null,
  };
};

// ---------- Métricas ----------

// Métricas válidas por tipo de post (pedir uma que não existe para o tipo
// derruba a chamada inteira). follows só existe em post de feed; reels não
// têm. impressions, plays e video_views foram descontinuadas: views.
const METRICAS_BASE = [
  "views",
  "reach",
  "likes",
  "comments",
  "shares",
  "saved",
];
const metricasDoTipo = (tipo: string | null) =>
  tipo === "REELS"
    ? [...METRICAS_BASE, "total_interactions"]
    : tipo === "FEED"
      ? [...METRICAS_BASE, "total_interactions", "follows"]
      : METRICAS_BASE;

type Insight = {
  name: string;
  values?: { value?: unknown }[];
  total_value?: { value?: unknown };
};

const valorDe = (dados: Insight[], nome: string): number | null => {
  const item = dados.find((d) => d.name === nome);
  const bruto = item?.values?.[0]?.value ?? item?.total_value?.value;
  const n = typeof bruto === "number" ? bruto : Number(bruto);
  return bruto === undefined || bruto === null || Number.isNaN(n) ? null : n;
};

// Métricas que a Meta não dá para o tipo de post (null), em vez de "0".
export const organicoDoInstagram = (dados: Insight[]): ResultadoOrganico => ({
  visualizacoes: valorDe(dados, "views"),
  curtidas: valorDe(dados, "likes"),
  comentarios: valorDe(dados, "comments"),
  compartilhamentos: valorDe(dados, "shares"),
  salvamentos: valorDe(dados, "saved"),
  seguidores: valorDe(dados, "follows"),
});

export const metricasInstagram = async (
  s: SegredoMeta,
  v: Pick<VinculoInstagram, "midiaId" | "tipo">,
): Promise<{ organico: ResultadoOrganico; bruto: unknown }> => {
  const cred = credInstagram(s);
  const pedir = (metricas: string[]) =>
    chamar<{ data?: Insight[] }>(
      `${v.midiaId}/insights`,
      { metric: metricas.join(",") },
      cred,
    );
  let metricas = metricasDoTipo(v.tipo);
  let r: { data?: Insight[] } | null = null;
  // Até 2 tentativas tirando as métricas que a Meta disse não aceitar.
  for (let i = 0; i < 3 && !r; i++) {
    try {
      r = await pedir(metricas);
    } catch (e) {
      if (!(e instanceof ErroMeta) || e.tipo !== "parametro") throw e;
      const recusadas = metricas.filter((m) =>
        new RegExp(`\\b${m}\\b`).test(e.original),
      );
      const sobra =
        recusadas.length && recusadas.length < metricas.length
          ? metricas.filter((m) => !recusadas.includes(m))
          : i === 0 && metricas !== METRICAS_BASE
            ? METRICAS_BASE
            : null;
      if (!sobra) break;
      metricas = sobra;
    }
  }
  if (!r) {
    // Último recurso: os contadores do próprio post.
    const n = await chamar<{ like_count?: number; comments_count?: number }>(
      v.midiaId,
      { fields: "like_count,comments_count" },
      cred,
    );
    r = {
      data: [
        { name: "likes", values: [{ value: n.like_count }] },
        { name: "comments", values: [{ value: n.comments_count }] },
      ],
    };
  }
  return { organico: organicoDoInstagram(r.data ?? []), bruto: r.data ?? [] };
};

type AcaoMeta = { action_type?: string; value?: string | number };

export type LinhaInsightAnuncio = {
  ad_id?: string;
  spend?: string;
  impressions?: string;
  inline_link_clicks?: string;
  actions?: AcaoMeta[];
  account_currency?: string;
};

const somaDaAcao = (acoes: AcaoMeta[] | undefined, tipo: string) => {
  const a = (acoes ?? []).find((x) => x.action_type === tipo);
  return a ? Number(a.value) || 0 : null;
};

// Uma compra aparece em vários action_type sobrepostos: pegar UM (somar
// multiplica as vendas). Sem nenhum: null (não rastreado ≠ zero).
const TIPOS_DE_COMPRA = [
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
  "purchase",
];
const CONVERSAS = "onsite_conversion.messaging_conversation_started_7d";

export const numerosDoAnuncio = (
  linha: LinhaInsightAnuncio | undefined,
  tipo: NumerosAnuncio["tipo"],
): NumerosAnuncio => {
  let compras: number | null = null;
  for (const t of TIPOS_DE_COMPRA) {
    const n = somaDaAcao(linha?.actions, t);
    if (n !== null) {
      compras = n;
      break;
    }
  }
  return {
    gasto: Number(linha?.spend) || 0,
    impressoes: Number(linha?.impressions) || 0,
    cliquesNoLink: Number(linha?.inline_link_clicks) || 0,
    conversas: somaDaAcao(linha?.actions, CONVERSAS) ?? 0,
    compras,
    tipo,
    moeda: linha?.account_currency ?? null,
  };
};

const CAMPOS_ANUNCIO =
  "ad_id,spend,impressions,inline_link_clicks,actions,account_currency";

// Um anúncio pelo ID (vale também para arquivados e excluídos).
export const metricasAnuncio = async (
  s: SegredoMeta,
  v: Pick<VinculoAnuncio, "anuncioId" | "tipo">,
): Promise<NumerosAnuncio> => {
  const r = await chamar<{ data?: LinhaInsightAnuncio[] }>(
    `${v.anuncioId}/insights`,
    // Desde o começo do anúncio (até 37 meses).
    { fields: CAMPOS_ANUNCIO, date_preset: "maximum" },
    credPrincipal(s),
  );
  // Sem entrega no período: zeros.
  return numerosDoAnuncio(r.data?.[0], v.tipo ?? null);
};

// Vários anúncios da mesma conta numa chamada só (cada chamada gasta pontos
// do limite da conta). Os que não vierem (arquivados, excluídos ou sem
// entrega) são lidos pelo ID por quem chama.
export const metricasDosAnuncios = async (
  s: SegredoMeta,
  contaId: string,
  ids: string[],
): Promise<Map<string, LinhaInsightAnuncio>> => {
  const r = await chamar<Pagina<LinhaInsightAnuncio>>(
    `${idDaConta(contaId)}/insights`,
    {
      level: "ad",
      fields: CAMPOS_ANUNCIO,
      date_preset: "maximum",
      filtering: JSON.stringify([
        { field: "ad.id", operator: "IN", value: ids },
      ]),
      limit: "500",
    },
    credPrincipal(s),
  );
  return new Map(
    (r.data ?? [])
      .filter((l): l is LinhaInsightAnuncio & { ad_id: string } => !!l.ad_id)
      .map((l) => [l.ad_id, l]),
  );
};
