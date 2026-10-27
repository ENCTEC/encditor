import { Timeline } from "@/timeline/schema";
import { Analise } from "./analise";

// Para que o arquivo foi enviado. "cena" entra direto na trilha principal;
// inserts e áudios ficam na biblioteca esperando um pedido no chat.
export type PapelMidia = "cena" | "insert" | "audio";

export type Midia = {
  id: string;
  // Nome curto automático: "Cena 1", "Insert 2", "Áudio 1".
  nome: string;
  // Apelido para citar no chat com @ (ex.: "videolael" -> @videolael).
  apelido: string;
  // false = arquivo "frio": não é analisado pela IA (sem custo).
  usarIA: boolean;
  papel: PapelMidia;
  formato: "video" | "imagem" | "audio";
  url: string;
  nomeArquivo: string;
  // Em segundos (imagens não têm duração).
  duracao: number | null;
  largura: number | null;
  altura: number | null;
  // Transcrição e descrição visual (feitas pela IA depois do envio).
  analise?: Analise;
  // Efeitos de áudio aplicados (ex.: ["sem-ruido"]). Com efeitos, "url"
  // aponta para a versão processada e "urlOriginal" guarda a original.
  efeitosAudio?: string[];
  urlOriginal?: string;
  // Cópia leve do vídeo (proxy) usada só no preview. "de" = a URL a partir
  // da qual foi feita: se o arquivo mudar (ex.: efeitos), é refeita.
  preview?: { de: string; url: string };
  // Projeto em que o arquivo foi enviado. A biblioteca de um projeto mostra
  // os enviados nele + os do banco do cliente que ele usa (doProjeto.ts).
  projetoId?: string;
  // Baixado da web pela IA (buscar_na_web): de onde veio, a licença e a
  // busca que o trouxe (para não baixar de novo).
  fonte?: {
    site: string;
    pagina: string;
    licenca: string;
    autor?: string;
    consulta: string;
  };
};

export type Mensagem = {
  id: string;
  autor: "usuario" | "ia";
  texto: string;
  // Ids das mídias anexadas nesta mensagem.
  anexos: string[];
  criadaEm: number;
};

export type Projeto = {
  timeline: Timeline;
  biblioteca: Midia[];
  mensagens: Mensagem[];
};
