// Pedidos ao chat em andamento, um por projeto, guardados NO SERVIDOR: a
// pessoa pode trocar de aba, abrir outro projeto ou recarregar a página
// enquanto a IA trabalha (5 a 10 min num vídeo inteiro). Ao voltar ao
// projeto, o chat retoma a barra daqui e, quando fica pronto, aplica o
// resultado e apaga o trabalho. Fica na memória (globalThis, sobrevive à
// recarga do código no dev); some se o servidor reiniciar.

export type TrabalhoIA = {
  id: string;
  projetoId: string;
  inicio: number;
  pct: number;
  texto: string;
  estado: "rodando" | "pronto" | "erro";
  resultado?: unknown;
  erro?: string;
  atualizado: number;
};

declare global {
  var trabalhosIA: Map<string, TrabalhoIA> | undefined;
}
const mapa = () => (globalThis.trabalhosIA ??= new Map());

// Resultado esquecido há mais de 1 dia não volta mais.
const VALIDADE_MS = 24 * 60 * 60 * 1000;

export const lerTrabalhoIA = (projetoId: string) => {
  const t = mapa().get(projetoId);
  if (t && t.estado !== "rodando" && Date.now() - t.atualizado > VALIDADE_MS) {
    mapa().delete(projetoId);
    return null;
  }
  return t ?? null;
};

export const iniciarTrabalhoIA = (projetoId: string): TrabalhoIA => {
  const agora = Date.now();
  const t: TrabalhoIA = {
    id: crypto.randomUUID(),
    projetoId,
    inicio: agora,
    pct: 1,
    texto: "Lendo o projeto…",
    estado: "rodando",
    atualizado: agora,
  };
  mapa().set(projetoId, t);
  return t;
};

export const atualizarTrabalhoIA = (
  t: TrabalhoIA,
  mudancas: Partial<Pick<TrabalhoIA, "pct" | "texto" | "estado" | "resultado" | "erro">>,
) => {
  Object.assign(t, mudancas, { atualizado: Date.now() });
};

// O chat aplicou o resultado: pode esquecer (só o mesmo trabalho).
export const apagarTrabalhoIA = (projetoId: string, id: string) => {
  if (mapa().get(projetoId)?.id === id) mapa().delete(projetoId);
};
