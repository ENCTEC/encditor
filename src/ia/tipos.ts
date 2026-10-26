import { Ferramenta } from "./ferramentas";

// O que os dois editores (GPT e Claude) recebem.
export type Conversa = {
  ferramentas: Ferramenta[];
  // Mensagens anteriores, só texto, começando pelo usuário.
  historico: { papel: "user" | "assistant"; texto: string }[];
  // Mensagem atual, já com o estado do projeto.
  pedido: string;
  // Quadros do vídeo junto com a mensagem (revisão: a IA "olha" a edição).
  imagens?: { legenda: string; base64: string }[];
  // Avisa quando a IA começa a pensar numa etapa (para a barra de
  // progresso do chat).
  aoPensar?: (etapa: number) => void;
  // Avisa enquanto a IA ESCREVE o pedido de uma ferramenta (o texto dos
  // argumentos chega aos pedaços): dá para mostrar "escrevendo as telas…".
  aoEscrever?: (ferramenta: string, argumentosAteAgora: string) => void;
};
