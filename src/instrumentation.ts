// Roda uma vez quando o servidor do Next sobe (desenvolvimento e
// produção): liga o endereço fácil http://enceditor.localhost.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { iniciarPorta80 } = await import("./servidor/porta80");
  iniciarPorta80(Number(process.env.PORT ?? 3000));
}
