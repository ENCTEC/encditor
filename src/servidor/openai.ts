import OpenAI from "openai";

// Configuração da OpenAI (chave e modelos vêm do .env.local).

export const MODELOS = {
  // Editor do chat (chama as ferramentas de edição).
  editor: process.env.OPENAI_MODELO ?? "gpt-6.1-sol",
  // Descreve os quadros dos vídeos.
  visao: process.env.OPENAI_MODELO_VISAO ?? "gpt-6.1-sol",
  // Único modelo da OpenAI com o tempo de cada palavra (para legendas).
  transcricaoComTempos: "whisper-1",
  // Ditado do chat (só precisa do texto).
  ditado: process.env.OPENAI_MODELO_DITADO ?? "gpt-transcribe",
};

export const openaiConfigurada = () => Boolean(process.env.OPENAI_API_KEY);

let cliente: OpenAI | null = null;
export const clienteOpenAI = () => (cliente ??= new OpenAI());

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
    return {
      status: 429,
      erro: "Limite da OpenAI atingido (pedidos demais ou créditos acabaram).",
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
