import { salvarArquivo } from "@/servidor/armazenamento";

// As miniaturas que a Meta devolve têm link assinado que expira em horas.
// Ao ligar uma versão ao post/anúncio, a imagem é baixada e guardada junto
// com a mídia do encEditor (o link passa a ser /api/midia/<arquivo>).

const LIMITE_BYTES = 3 * 1024 * 1024;
const DOMINIOS_META = ["fbcdn.net", "cdninstagram.com", "facebook.com"];

export const guardarMiniatura = async (
  url: string | null,
): Promise<string | null> => {
  if (!url) return null;
  if (url.startsWith("/api/midia/")) return url;
  // Só baixa das CDNs da Meta (o link vem do navegador: nada de endereço
  // qualquer, nem da rede interna).
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    host = u.hostname;
  } catch {
    return null;
  }
  if (!DOMINIOS_META.some((d) => host === d || host.endsWith(`.${d}`))) {
    return null;
  }
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const tipo = r.headers.get("content-type") ?? "";
    const tamanho = Number(r.headers.get("content-length") ?? 0);
    if (
      !r.ok ||
      !r.body ||
      !tipo.startsWith("image/") ||
      tamanho > LIMITE_BYTES
    ) {
      return null;
    }
    const extensao = tipo.includes("png")
      ? ".png"
      : tipo.includes("webp")
        ? ".webp"
        : ".jpg";
    return `/api/midia/${await salvarArquivo(r.body, extensao)}`;
  } catch {
    // Sem miniatura não impede a ligação.
    return null;
  }
};
