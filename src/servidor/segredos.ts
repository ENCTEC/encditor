import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Criptografia dos segredos guardados no banco (chaves de acesso que cada
// cliente cola para o encEditor ler as métricas dele). A chave fica só no
// .env.local (ENCEDITOR_CHAVE_SEGREDOS, 32 bytes em base64): o arquivo do
// banco sozinho não revela os tokens. AES-256-GCM (detecta adulteração).

const chave = () => {
  const base64 = process.env.ENCEDITOR_CHAVE_SEGREDOS;
  if (!base64) {
    throw new Error(
      "Falta ENCEDITOR_CHAVE_SEGREDOS no .env.local (veja o .env.example).",
    );
  }
  const k = Buffer.from(base64, "base64");
  if (k.length !== 32) {
    throw new Error("ENCEDITOR_CHAVE_SEGREDOS precisa ter 32 bytes (base64).");
  }
  return k;
};

export const cifrar = (texto: string) => {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [
    "v1",
    iv.toString("base64"),
    c.getAuthTag().toString("base64"),
    dados.toString("base64"),
  ].join(".");
};

export const decifrar = (guardado: string) => {
  const [versao, iv, etiqueta, dados] = guardado.split(".");
  if (versao !== "v1" || !iv || !etiqueta || !dados) {
    throw new Error("Segredo guardado em formato desconhecido.");
  }
  const d = createDecipheriv("aes-256-gcm", chave(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(etiqueta, "base64"));
  return Buffer.concat([
    d.update(Buffer.from(dados, "base64")),
    d.final(),
  ]).toString("utf8");
};

// Para mostrar na tela sem revelar: "EAAGm0…9fZD".
export const mascarar = (segredo: string) =>
  segredo.length <= 12 ? "•••" : `${segredo.slice(0, 6)}…${segredo.slice(-4)}`;
