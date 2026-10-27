// Roda uma vez quando o servidor do encEditor liga.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Leitura dos números da Meta a cada 6 h (src/conexoes/manutencao.ts).
  const { iniciarManutencaoMeta } = await import("./conexoes/manutencao");
  iniciarManutencaoMeta();
  // Takes que estavam sendo gerados no Higgsfield quando o encEditor
  // desligou: volta a acompanhar (src/servidor/geracoes.ts).
  const { acompanhar } = await import("./servidor/geracoes");
  acompanhar();
}
