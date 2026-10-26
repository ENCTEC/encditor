// Linha especial do "texto falado": uma barra de nível que enche logo
// depois da palavra de antes dela.
export const LINHA_BARRA = "[barra]";

// Palavras do texto de um motion, na ordem em que aparecem (sem os "*" de
// destaque, sem os "|" de quebra de linha e sem a linha "[barra]"). É a
// ordem do campo "palavras" do motion (o tempo em que cada uma é falada).
export const palavrasDoTexto = (texto: string) =>
  texto
    .split("|")
    .filter((linha) => linha.trim().toLowerCase() !== LINHA_BARRA)
    .join(" ")
    .replace(/\*/g, " ")
    .split(/\s+/)
    .filter(Boolean);
