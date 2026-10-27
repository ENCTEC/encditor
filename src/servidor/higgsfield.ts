import { readFile } from "node:fs/promises";
import { salvarArquivo } from "./armazenamento";

// Cliente da API do Higgsfield (produto separado do plano do site: saldo
// pré-pago em dólar, chave em console.higgsfield.ai). Gera os takes do
// plano com o Seedance 2.0: texto → vídeo, ou com imagens de referência
// (as fotos dos @elementos, enviadas antes por uma URL temporária).
// Documentação: docs.higgsfield.ai (conferida em 27/10/2026).
// A chave (ID + segredo) fica só no .env.local: HIGGSFIELD_KEY_ID e
// HIGGSFIELD_KEY_SECRET. Nunca vai para o navegador.

const BASE = "https://api.higgsfield.ai";

export const higgsfieldConfigurado = () =>
  Boolean(process.env.HIGGSFIELD_KEY_ID && process.env.HIGGSFIELD_KEY_SECRET);

const autorizacao = () => ({
  Authorization: `Key ${process.env.HIGGSFIELD_KEY_ID}:${process.env.HIGGSFIELD_KEY_SECRET}`,
});

export const RESOLUCOES = ["480p", "720p", "1080p"] as const;
export type Resolucao = (typeof RESOLUCOES)[number];
// Proporções aceitas pelo Seedance 2.0 (o 4:5 do encEditor vira 3:4).
export const proporcaoDoFormato = (largura: number, altura: number) => {
  const r = largura / altura;
  const opcoes: [string, number][] = [
    ["9:16", 9 / 16],
    ["3:4", 3 / 4],
    ["1:1", 1],
    ["4:3", 4 / 3],
    ["16:9", 16 / 9],
    ["21:9", 21 / 9],
  ];
  return opcoes.reduce((a, b) => (Math.abs(b[1] - r) < Math.abs(a[1] - r) ? b : a))[0];
};

// Tamanho do vídeo gerado: o lado menor = a resolução.
export const dimensoes = (resolucao: Resolucao, proporcao: string) => {
  const [a, b] = proporcao.split(":").map(Number);
  const menor = parseInt(resolucao, 10);
  const maior = Math.round((menor * Math.max(a, b)) / Math.min(a, b) / 2) * 2;
  return a >= b ? { largura: maior, altura: menor } : { largura: menor, altura: maior };
};

// Preço pela fórmula oficial: ceil(segundos × largura × altura × 24 / 1024)
// tokens × US$ 0,014 por mil (até 1080p). Tabela cheia, sem desconto da
// conta (a página do modelo mostrava ~30% a menos em 27/10/2026).
export const custoEmDolar = (segundos: number, resolucao: Resolucao, proporcao: string) => {
  const { largura, altura } = dimensoes(resolucao, proporcao);
  const tokens = Math.ceil((segundos * largura * altura * 24) / 1024);
  return (tokens * 0.014) / 1000;
};

// Mensagem clara para os erros da API.
const erroDaApi = async (r: Response, oQue: string) => {
  const corpo = await r.text().catch(() => "");
  let detalhe = corpo.slice(0, 300);
  try {
    const j = JSON.parse(corpo) as { detail?: unknown; message?: string; error?: string };
    detalhe = String(j.message ?? j.error ?? (typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail)));
  } catch {
    // corpo não é JSON
  }
  if (r.status === 401 || r.status === 403) {
    return new Error("A chave da API do Higgsfield é inválida (HIGGSFIELD_KEY_ID / HIGGSFIELD_KEY_SECRET no .env.local).");
  }
  if (r.status === 402) {
    return new Error("A conta da API do Higgsfield está sem saldo. Adicione em console.higgsfield.ai.");
  }
  if (r.status === 429) return new Error("Muitos pedidos seguidos ao Higgsfield. Tente de novo em alguns minutos.");
  return new Error(`Higgsfield (${oQue}, ${r.status}): ${detalhe || "erro sem detalhe"}`);
};

const TIPOS: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".wav": "audio/wav",
};

// Envia um arquivo do PC para o Higgsfield e devolve a URL pública dele
// (as referências precisam estar na internet).
export const subirArquivo = async (caminho: string) => {
  const extensao = caminho.slice(caminho.lastIndexOf(".")).toLowerCase();
  const tipo = TIPOS[extensao];
  if (!tipo) throw new Error(`O Higgsfield não aceita arquivos ${extensao}.`);
  const r = await fetch(`${BASE}/files/generate-upload-url`, {
    method: "POST",
    headers: { ...autorizacao(), "Content-Type": "application/json" },
    body: JSON.stringify({ content_type: tipo }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw await erroDaApi(r, "envio de referência");
  const u = (await r.json()) as {
    public_url: string;
    upload_url: string;
    upload_headers?: Record<string, string>;
  };
  // A URL de envio é do armazenamento: sem a chave do Higgsfield.
  const envio = await fetch(u.upload_url, {
    method: "PUT",
    headers: u.upload_headers ?? { "Content-Type": tipo },
    body: new Uint8Array(await readFile(caminho)),
    signal: AbortSignal.timeout(120000),
  });
  if (!envio.ok) throw new Error(`O envio da referência falhou (${envio.status}).`);
  return u.public_url;
};

export type PedidoDeVideo = {
  prompt: string;
  segundos: number;
  resolucao: Resolucao;
  proporcao: string;
  comSom: boolean;
  // URLs públicas (subirArquivo) das imagens de referência, na ordem.
  referencias: string[];
};

// Pede o vídeo. Com referências, usa reference-to-video; senão
// text-to-video. O Idempotency-Key evita gerar (e pagar) duas vezes se a
// resposta se perder.
export const pedirVideo = async (p: PedidoDeVideo, idempotencia: string) => {
  const comReferencias = p.referencias.length > 0;
  const r = await fetch(
    `${BASE}/bytedance/seedance-2.0/${comReferencias ? "reference-to-video" : "text-to-video"}`,
    {
      method: "POST",
      headers: {
        ...autorizacao(),
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencia,
      },
      body: JSON.stringify({
        prompt: p.prompt,
        duration: Math.min(15, Math.max(4, Math.round(p.segundos))),
        resolution: p.resolucao,
        aspect_ratio: p.proporcao,
        generate_audio: p.comSom,
        ...(comReferencias ? { image_urls: p.referencias.slice(0, 9) } : {}),
      }),
      signal: AbortSignal.timeout(60000),
    },
  );
  if (!r.ok) throw await erroDaApi(r, "pedido do vídeo");
  const j = (await r.json()) as { request_id: string; status_url: string; cancel_url?: string };
  return { requestId: j.request_id, statusUrl: j.status_url, cancelUrl: j.cancel_url ?? null };
};

export type SituacaoDoVideo = {
  status: "queued" | "in_progress" | "completed" | "failed" | "nsfw" | "canceled" | string;
  videoUrl: string | null;
  erro: string | null;
};

export const situacaoDoVideo = async (statusUrl: string): Promise<SituacaoDoVideo> => {
  const r = await fetch(statusUrl, { headers: autorizacao(), signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw await erroDaApi(r, "situação do vídeo");
  const j = (await r.json()) as {
    status: string;
    video?: { url?: string };
    error?: unknown;
  };
  return {
    status: j.status,
    videoUrl: j.video?.url ?? null,
    erro: j.error ? (typeof j.error === "string" ? j.error : JSON.stringify(j.error)) : null,
  };
};

export const cancelarVideo = async (cancelUrl: string) => {
  const r = await fetch(cancelUrl, { method: "POST", headers: autorizacao(), signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw await erroDaApi(r, "cancelar");
};

// Baixa o vídeo pronto para a pasta de mídia (o link do Higgsfield vence
// em 7 dias).
export const baixarVideo = async (url: string) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(300000) });
  if (!r.ok || !r.body) throw new Error(`Não consegui baixar o vídeo (${r.status}).`);
  return salvarArquivo(r.body, ".mp4");
};
