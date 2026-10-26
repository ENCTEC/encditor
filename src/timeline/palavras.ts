// Palavras do texto de um motion, na ordem em que aparecem (sem os "*" de
// destaque e sem os "|" de quebra de linha). É a ordem do campo
// "palavras" do motion (o tempo em que cada uma é falada).
export const palavrasDoTexto = (texto: string) =>
  texto
    .replace(/[|*]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
