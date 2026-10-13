import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { INSTRUCOES } from "./instrucoes";
import { Conversa } from "./tipos";

// Editor com Claude (alternativa ao GPT; usado se só houver
// ANTHROPIC_API_KEY). O Tool Runner do SDK faz o laço de ferramentas.

const MODELO = "claude-opus-5-5";

export const editarComClaude = async ({
  ferramentas,
  historico,
  pedido,
}: Conversa) => {
  const final = await new Anthropic().beta.messages.toolRunner({
    model: MODELO,
    max_tokens: 16000,
    max_iterations: 20,
    output_config: { effort: "medium" },
    // Se o modelo recusar por engano, a API tenta outro modelo adequado.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    cache_control: { type: "ephemeral" },
    system: INSTRUCOES,
    tools: ferramentas.map((f) => betaZodTool(f)),
    messages: [
      ...historico.map(
        (m): Anthropic.Beta.BetaMessageParam => ({
          role: m.papel,
          content: m.texto,
        }),
      ),
      { role: "user", content: pedido },
    ],
  });

  if (final.stop_reason === "refusal") {
    return "Não consegui fazer esse pedido. Tente descrever de outro jeito.";
  }
  return final.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
};

// Mensagem amigável para os erros mais comuns da API.
export const mensagemDeErroClaude = (e: unknown) => {
  if (e instanceof Anthropic.AuthenticationError) {
    return {
      status: 401,
      erro: "A chave da Anthropic é inválida (ANTHROPIC_API_KEY).",
    };
  }
  if (e instanceof Anthropic.PermissionDeniedError) {
    return {
      status: 403,
      erro: "A chave da Anthropic não tem acesso a esse modelo.",
    };
  }
  if (e instanceof Anthropic.RateLimitError) {
    return {
      status: 429,
      erro: "Muitos pedidos seguidos à IA. Espere alguns segundos.",
    };
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return { status: 502, erro: "Sem conexão com a API da Anthropic." };
  }
  if (e instanceof Anthropic.APIError) {
    return {
      status: 502,
      erro: `Erro da Anthropic (${e.status}): ${e.message}`,
    };
  }
  return null;
};
