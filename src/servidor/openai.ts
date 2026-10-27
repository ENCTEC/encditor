import OpenAI from "openai";
import { anotarAudio, anotarTokens } from "./custos";

// Configuração da OpenAI (chave e modelos vêm do .env.local).

export const MODELOS = {
  // Editor do chat (chama as ferramentas de edição).
  editor: process.env.OPENAI_MODELO ?? "gpt-6.1-sol",
  // Descreve os quadros dos vídeos.
  visao: process.env.OPENAI_MODELO_VISAO ?? "gpt-6.1-sol",
  // Único modelo da OpenAI com o tempo de cada palavra (para legendas).
  transcricaoComTempos: "whisper-1",
  // Voz de exemplo do roteiro (segue instruções de entonação).
  voz: process.env.OPENAI_MODELO_VOZ ?? "gpt-4o-mini-tts",
  // Ditado do chat (só precisa do texto).
  ditado: process.env.OPENAI_MODELO_DITADO ?? "gpt-transcribe",
};

export const openaiConfigurada = () => Boolean(process.env.OPENAI_API_KEY);

// Toda chamada paga feita por este cliente vai para a conta do projeto
// aberto no pedido (custos.ts): respostas (inclusive em fluxo),
// transcrições e voz sintética.
type ComUso = { usage?: Parameters<typeof anotarTokens>[1] };
const comCustosAnotados = (c: OpenAI) => {
  type Chamada = (corpo: { model: string; input?: unknown }, ...resto: unknown[]) => unknown;
  const embrulhar = <T,>(
    original: T,
    depois: (corpo: { model: string; input?: unknown }, resposta: unknown) => void,
    emFluxo = false,
  ) =>
    ((corpo: { model: string; input?: unknown }, ...resto: unknown[]) => {
      const r = (original as Chamada)(corpo, ...resto);
      const fim = emFluxo
        ? (r as { finalResponse: () => Promise<unknown> }).finalResponse()
        : (r as Promise<unknown>);
      fim.then((x) => depois(corpo, x), () => undefined);
      return r;
    }) as T;
  const r = c.responses;
  r.create = embrulhar(r.create.bind(r), (corpo, x) =>
    anotarTokens(corpo.model, (x as ComUso).usage),
  );
  r.stream = embrulhar(
    r.stream.bind(r),
    (corpo, x) => anotarTokens(corpo.model, (x as ComUso).usage),
    true,
  );
  const t = c.audio.transcriptions;
  t.create = embrulhar(t.create.bind(t), (corpo, x) => {
    const resposta = x as { duration?: number | string; usage?: { seconds?: number } };
    anotarAudio(corpo.model, Number(resposta.duration ?? resposta.usage?.seconds ?? 0));
  });
  const f = c.audio.speech;
  // A voz não diz quanto durou: ~15 letras por segundo de fala.
  f.create = embrulhar(f.create.bind(f), (corpo) =>
    anotarAudio(corpo.model, String(corpo.input ?? "").length / 15),
  );
  return c;
};

let cliente: OpenAI | null = null;
export const clienteOpenAI = () => (cliente ??= comCustosAnotados(new OpenAI()));

// Mensagem amigável para os erros mais comuns da API.
export const mensagemDeErroOpenAI = (e: unknown) => {
  if (e instanceof OpenAI.AuthenticationError) {
    return {
      status: 401,
      erro: "A chave da OpenAI é inválida (OPENAI_API_KEY).",
    };
  }
  if (e instanceof OpenAI.PermissionDeniedError) {
    return {
      status: 403,
      erro: "A chave da OpenAI não tem acesso a esse modelo.",
    };
  }
  if (e instanceof OpenAI.RateLimitError) {
    // O mesmo código 429 serve para "sem créditos" e "pedidos demais".
    if (e.type === "insufficient_quota") {
      return {
        status: 402,
        erro: "A conta da OpenAI está sem créditos. Adicione em platform.openai.com/settings/organization/billing e tente de novo.",
      };
    }
    return {
      status: 429,
      erro: "Muitos pedidos seguidos à OpenAI. Espere alguns segundos.",
    };
  }
  if (e instanceof OpenAI.APIConnectionError) {
    return { status: 502, erro: "Sem conexão com a OpenAI." };
  }
  if (e instanceof OpenAI.APIError) {
    return { status: 502, erro: `Erro da OpenAI (${e.status}): ${e.message}` };
  }
  return null;
};

// Com saldo baixo, a OpenAI às vezes recusa chamadas simultâneas como "sem
// créditos" (insufficient_quota) e aceita a mesma chamada segundos depois.
// Tenta de novo até 2 vezes antes de desistir.
export const comNovaTentativa = async <T>(chamada: () => Promise<T>) => {
  for (let tentativa = 0; ; tentativa++) {
    try {
      return await chamada();
    } catch (e) {
      const semCredito =
        e instanceof OpenAI.RateLimitError && e.type === "insufficient_quota";
      if (!semCredito || tentativa >= 2) throw e;
      await new Promise((r) => setTimeout(r, 4000 * (tentativa + 1)));
    }
  }
};
