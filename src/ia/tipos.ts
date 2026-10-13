import { Ferramenta } from "./ferramentas";

// O que os dois editores (GPT e Claude) recebem.
export type Conversa = {
  ferramentas: Ferramenta[];
  // Mensagens anteriores, só texto, começando pelo usuário.
  historico: { papel: "user" | "assistant"; texto: string }[];
  // Mensagem atual, já com o estado do projeto.
  pedido: string;
};
