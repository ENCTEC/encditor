import { Timeline } from "@/timeline/schema";
import { Midia } from "./tipos";

// Arquivos que aparecem num PROJETO: os enviados nele e os do banco do
// cliente que ele usa na timeline (ex.: um clipe reaproveitado de outro
// vídeo). O banco inteiro do cliente aparece na página do cliente.
// Arquivos antigos (sem projetoId) só aparecem onde são usados.
export const arquivosDoProjeto = (
  banco: Midia[],
  timeline: Timeline,
  projetoId: string,
): Midia[] => {
  const usadas = new Set(
    [...timeline.clipes, ...timeline.inserts, ...timeline.audios].map(
      (x) => x.url,
    ),
  );
  return banco.filter(
    (m) =>
      m.projetoId === projetoId ||
      usadas.has(m.url) ||
      (!!m.urlOriginal && usadas.has(m.urlOriginal)),
  );
};
