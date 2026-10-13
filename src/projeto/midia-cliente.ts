import { Midia, PapelMidia } from "./tipos";

// Funções que rodam no navegador para enviar arquivos e ler suas
// informações (duração, resolução) antes de colocá-los no projeto.

export const formatoDoArquivo = (arquivo: File): Midia["formato"] | null => {
  if (arquivo.type.startsWith("video/")) return "video";
  if (arquivo.type.startsWith("image/")) return "imagem";
  if (arquivo.type.startsWith("audio/")) return "audio";
  return null;
};

// Sugestão de papel ao anexar: vídeo = cena, imagem = insert, áudio = áudio.
export const papelSugerido = (formato: Midia["formato"]): PapelMidia =>
  formato === "video" ? "cena" : formato === "imagem" ? "insert" : "audio";

type Metadados = Pick<Midia, "duracao" | "largura" | "altura">;

export const lerMetadados = (
  arquivo: File,
  formato: Midia["formato"],
): Promise<Metadados> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const terminar = (dados: Metadados | null, erro?: string) => {
      URL.revokeObjectURL(url);
      if (dados) resolve(dados);
      else reject(new Error(erro));
    };

    if (formato === "imagem") {
      const img = new Image();
      img.onload = () =>
        terminar({
          duracao: null,
          largura: img.naturalWidth,
          altura: img.naturalHeight,
        });
      img.onerror = () => terminar(null, `Não consegui ler "${arquivo.name}".`);
      img.src = url;
      return;
    }

    const el = document.createElement(formato === "video" ? "video" : "audio");
    el.preload = "metadata";
    el.onloadedmetadata = () =>
      terminar({
        duracao: Number.isFinite(el.duration) ? el.duration : null,
        largura: el instanceof HTMLVideoElement ? el.videoWidth : null,
        altura: el instanceof HTMLVideoElement ? el.videoHeight : null,
      });
    el.onerror = () =>
      terminar(
        null,
        `Não consegui ler "${arquivo.name}" (formato suportado?).`,
      );
    el.src = url;
  });

// Envia com XMLHttpRequest (e não fetch) para poder mostrar o progresso.
export const enviarArquivo = (
  arquivo: File,
  aoProgredir: (fracao: number) => void,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/api/midia?nome=${encodeURIComponent(arquivo.name)}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) aoProgredir(e.loaded / e.total);
    };
    xhr.onload = () => {
      let resposta: { url?: string; erro?: string } = {};
      try {
        resposta = JSON.parse(xhr.responseText);
      } catch {
        // resposta não-JSON: cai no erro genérico abaixo
      }
      if (xhr.status >= 200 && xhr.status < 300 && resposta.url) {
        resolve(resposta.url);
      } else {
        reject(new Error(resposta.erro ?? `Falha no envio (${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new Error("Falha de conexão no envio."));
    xhr.send(arquivo);
  });

const PREFIXO: Record<PapelMidia, string> = {
  cena: "Cena",
  insert: "Insert",
  audio: "Áudio",
};

// "Cena 3", "Insert 1"... numerado por papel, para citar no chat.
export const proximoNome = (biblioteca: Midia[], papel: PapelMidia) =>
  `${PREFIXO[papel]} ${biblioteca.filter((m) => m.papel === papel).length + 1}`;
