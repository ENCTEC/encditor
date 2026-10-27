import { AsyncLocalStorage } from "node:async_hooks";
import { registrarCusto } from "./banco";

// Custo de cada chamada paga à IA, anotado no projeto de onde ela veio.
// As rotas abrem um "contexto" (comCusto: projeto, cliente, tipo do pedido)
// e o cliente da OpenAI (openai.ts) anota sozinho cada chamada feita
// dentro dele — chat, revisor, análise, transcrição, planejador, voz —
// sem precisar passar o projeto de função em função.

// US$ por 1 milhão de tokens (tabela da OpenAI, consultada em 2026-10-27).
const POR_MILHAO: Record<string, { entrada: number; cache: number; saida: number }> = {
  "gpt-6.1-sol": { entrada: 2, cache: 0.1, saida: 10 },
};
// US$ por minuto de áudio (transcrição e voz sintética).
const POR_MINUTO: Record<string, number> = {
  "whisper-1": 0.006,
  "gpt-transcribe": 0.0045,
  "gpt-4o-mini-tts": 0.015,
};

export type ContextoDeCusto = {
  projetoId: string | null;
  clienteId: string | null;
  // "chat", "planejar", "análise", "voz", "conferir take", "ditado"…
  tipo: string;
  descricao: string;
  // Junta as chamadas de um mesmo pedido; "total" = gasto até agora nele.
  pedido: string;
  total: number;
};

declare global {
  var custosEncditor: AsyncLocalStorage<ContextoDeCusto> | undefined;
}
// No globalThis: o mesmo para todas as rotas (e depois de recarregar).
const armazem = () => (globalThis.custosEncditor ??= new AsyncLocalStorage());

export const comCusto = <T>(
  contexto: Omit<ContextoDeCusto, "pedido" | "total">,
  trabalho: () => Promise<T>,
) =>
  armazem().run(
    { ...contexto, pedido: crypto.randomUUID(), total: 0 },
    trabalho,
  );

// O pedido em andamento (para a nota do chat: "este pedido custou…").
export const custoDoPedido = () => armazem().getStore()?.total ?? 0;

const anotar = (
  modelo: string,
  medidas: { entrada: number; cache: number; saida: number; segundos: number | null },
  valor: number,
) => {
  const c = armazem().getStore();
  if (c) c.total += valor;
  try {
    registrarCusto({
      quando: Date.now(),
      projetoId: c?.projetoId ?? null,
      clienteId: c?.clienteId ?? null,
      pedido: c?.pedido ?? null,
      tipo: c?.tipo ?? "outro",
      descricao: c?.descricao ?? "",
      modelo,
      ...medidas,
      valor,
    });
  } catch (e) {
    console.error("[custos] não consegui anotar:", e);
  }
};

type Uso = {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { cached_tokens?: number } | null;
};

export const anotarTokens = (modelo: string, uso: Uso | null | undefined) => {
  if (!uso) return;
  const preco = POR_MILHAO[modelo] ?? POR_MILHAO["gpt-6.1-sol"];
  const entrada = uso.input_tokens ?? 0;
  const cache = uso.input_tokens_details?.cached_tokens ?? 0;
  const saida = uso.output_tokens ?? 0;
  const valor =
    ((entrada - cache) * preco.entrada + cache * preco.cache + saida * preco.saida) / 1e6;
  anotar(modelo, { entrada, cache, saida, segundos: null }, valor);
};

export const anotarAudio = (modelo: string, segundos: number) => {
  if (!(segundos > 0)) return;
  const valor = ((POR_MINUTO[modelo] ?? 0.006) * segundos) / 60;
  anotar(modelo, { entrada: 0, cache: 0, saida: 0, segundos }, valor);
};
