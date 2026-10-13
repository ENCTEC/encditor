import exemploTimeline from "@/timeline/exemplo-timeline.json";
import { Timeline } from "@/timeline/schema";
import { Midia, Projeto } from "./tipos";

// Projeto de demonstração: a timeline de exemplo + uma biblioteca com
// os mesmos arquivos, para testar as telas sem precisar subir nada.
export const projetoExemplo = (): Projeto => {
  const timeline = exemploTimeline as Timeline;

  const midia = (
    nome: string,
    papel: Midia["papel"],
    formato: Midia["formato"],
    url: string,
    duracao: number | null,
  ): Midia => ({
    id: `exemplo-${nome}`,
    nome,
    papel,
    formato,
    url,
    nomeArquivo: url.split("/").pop() ?? url,
    duracao,
    largura: null,
    altura: null,
  });

  return {
    timeline,
    biblioteca: [
      midia("Cena 1", "cena", "video", timeline.clipes[0].url, 10.2),
      midia("Cena 2", "cena", "video", timeline.clipes[1].url, 15.6),
      midia("Cena 3", "cena", "video", timeline.clipes[2].url, 10),
      midia("Insert 1", "insert", "imagem", timeline.inserts[0].url, null),
      midia("Insert 2", "insert", "video", timeline.inserts[1].url, 5.7),
      midia("Áudio 1", "audio", "audio", timeline.audios[0].url, null),
    ],
    mensagens: [],
  };
};
