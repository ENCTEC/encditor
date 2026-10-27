import { PADROES_INICIAIS } from "@/catalogo/padroesIniciais";
import { lerPadroes } from "@/servidor/banco";
import { Camada } from "@/timeline/schema";

// Padrões de animação que a IA pode usar: os que vêm com o encEditor e os
// salvos (do cliente e para todos); com o mesmo nome, o salvo vale mais.

export type Padrao = {
  nome: string;
  descricao: string;
  duracao: number;
  camadas: Camada[];
};

export const padroesDisponiveis = (clienteId?: string | null): Padrao[] => {
  const salvos = lerPadroes(clienteId ?? null) as Padrao[];
  return [
    ...PADROES_INICIAIS.filter((p) => !salvos.some((s) => s.nome === p.nome)),
    ...salvos,
  ];
};

// Para o contexto do chat: uma linha por padrão.
export const listaDePadroes = (clienteId?: string | null) =>
  padroesDisponiveis(clienteId)
    .map((p) => `- ${p.nome} (${p.duracao}s, ${p.camadas.length} camadas): ${p.descricao}`)
    .join("\n");
