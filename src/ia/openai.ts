import OpenAI from "openai";
import { toResponseInputItems } from "openai/lib/responses/ResponseInputItems";
import { z } from "zod";
import { clienteOpenAI, MODELOS } from "@/servidor/openai";
import { Ferramenta } from "./ferramentas";
import { INSTRUCOES } from "./instrucoes";
import { Conversa } from "./tipos";

// Editor com GPT (Responses API + function calling). O laço: o modelo pede
// ferramentas, o app executa e devolve o resultado, até ele responder.

const LIMITE_ETAPAS = 20;

const paraOpenAI = (f: Ferramenta): OpenAI.Responses.FunctionTool => {
  const parametros = z.toJSONSchema(f.inputSchema, {
    io: "input",
  }) as Record<string, unknown>;
  // A OpenAI não precisa (e pode recusar) a chave "$schema".
  delete parametros.$schema;
  return {
    type: "function",
    name: f.name,
    description: f.description,
    parameters: parametros,
    // Validamos com zod antes de executar (mensagens de erro em português).
    strict: false,
  };
};

const executar = async (
  ferramentas: Ferramenta[],
  nome: string,
  argumentos: string,
) => {
  const f = ferramentas.find((x) => x.name === nome);
  if (!f) return `Erro: ferramenta "${nome}" não existe.`;
  let bruto: unknown;
  try {
    bruto = JSON.parse(argumentos || "{}");
  } catch {
    return "Erro: argumentos não são JSON válido.";
  }
  const entrada = f.inputSchema.safeParse(bruto);
  if (!entrada.success) {
    return `Erro: argumentos inválidos: ${z.prettifyError(entrada.error)}`;
  }
  try {
    return await f.run(entrada.data);
  } catch (e) {
    return `Erro: ${e instanceof Error ? e.message : String(e)}`;
  }
};

export const editarComOpenAI = async ({
  ferramentas,
  historico,
  pedido,
}: Conversa) => {
  const tools = ferramentas.map(paraOpenAI);
  const input: OpenAI.Responses.ResponseInput = [
    ...historico.map((m) => ({ role: m.papel, content: m.texto })),
    { role: "user", content: pedido },
  ];

  const uso = { entrada: 0, saida: 0, etapas: 0 };
  const registrarUso = () =>
    console.log(
      `[ia] editor ${MODELOS.editor}: ${uso.etapas} etapa(s), ${uso.entrada} tokens de entrada, ${uso.saida} de saída`,
    );

  for (let etapa = 0; etapa < LIMITE_ETAPAS; etapa++) {
    const resposta = await clienteOpenAI().responses.create({
      model: MODELOS.editor,
      instructions: INSTRUCOES,
      tools,
      input,
    });
    uso.etapas++;
    uso.entrada += resposta.usage?.input_tokens ?? 0;
    uso.saida += resposta.usage?.output_tokens ?? 0;

    input.push(...toResponseInputItems(resposta.output));
    const chamadas = resposta.output.filter(
      (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
        item.type === "function_call",
    );
    if (chamadas.length === 0) {
      registrarUso();
      return resposta.output_text.trim();
    }

    for (const chamada of chamadas) {
      input.push({
        type: "function_call_output",
        call_id: chamada.call_id,
        output: await executar(ferramentas, chamada.name, chamada.arguments),
      });
    }
  }
  registrarUso();
  return "Parei depois de muitas etapas; confira o resultado e peça o que faltar.";
};
