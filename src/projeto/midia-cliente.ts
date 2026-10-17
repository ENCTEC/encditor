import { Analise } from "./analise";
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

// Apelido a partir do nome do arquivo: sem acento, extensão nem espaços.
// "Vídeo Lael.mp4" -> "videolael". Se já existir, numera: "videolael2".
export const normalizarApelido = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "")
    .slice(0, 30);

export const gerarApelido = (nomeArquivo: string, biblioteca: Midia[]) => {
  const base =
    normalizarApelido(nomeArquivo.replace(/\.[^.]+$/, "")) || "arquivo";
  const usados = new Set(biblioteca.map((m) => m.apelido));
  if (!usados.has(base)) return base;
  let n = 2;
  while (usados.has(`${base}${n}`)) n++;
  return `${base}${n}`;
};

// "Cena 3", "Insert 1"... numerado por papel, para citar no chat.
export const proximoNome = (biblioteca: Midia[], papel: PapelMidia) =>
  `${PREFIXO[papel]} ${biblioteca.filter((m) => m.papel === papel).length + 1}`;

// Análise (fala + conteúdo visual) feita no servidor depois do envio.
// Guarda as que estão em andamento, para o chat esperar por elas antes de
// mandar um pedido à IA.
const analisesEmAndamento = new Map<string, Promise<Analise>>();
let filaDeAnalises: Promise<void> = Promise.resolve();

// Só arquivos enviados ao encEditor (não links externos) e não "frios".
export const podeAnalisar = (midia: Midia) =>
  midia.url.startsWith("/api/midia/") && midia.usarIA !== false;

export const analisarMidia = (midia: Midia): Promise<Analise> => {
  const existente = analisesEmAndamento.get(midia.id);
  if (existente) return existente;
  // Uma análise por vez: chamadas simultâneas à OpenAI falham com saldo
  // baixo e ainda disputam o ffmpeg do servidor.
  const promessa = filaDeAnalises
    .then(() =>
      fetch("/api/analisar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: midia.url,
          formato: midia.formato,
          duracao: midia.duracao,
        }),
      }),
    )
    .then(async (r) => (await r.json()) as Analise)
    .catch(
      (e): Analise => ({
        status: "erro",
        erro: e instanceof Error ? e.message : String(e),
        transcricao: null,
        visual: null,
      }),
    )
    .finally(() => analisesEmAndamento.delete(midia.id));
  analisesEmAndamento.set(midia.id, promessa);
  filaDeAnalises = promessa.then(() => undefined);
  return promessa;
};

export const analiseEmAndamento = (id: string) => analisesEmAndamento.has(id);

// Espera as análises em andamento e devolve o resultado de cada uma.
export const aguardarAnalises = async () =>
  new Map(
    await Promise.all(
      [...analisesEmAndamento.entries()].map(([id, p]) =>
        p.then((a) => [id, a] as const),
      ),
    ),
  );

// Extrai o áudio de um vídeo já enviado e devolve a URL do mp3 novo.
export const extrairAudioDoVideo = async (
  url: string,
  apagarOriginal: boolean,
) => {
  const resposta = await fetch("/api/extrair-audio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, apagarOriginal }),
  });
  const corpo = (await resposta.json().catch(() => ({}))) as {
    url?: string;
    erro?: string;
  };
  if (!resposta.ok || !corpo.url) {
    throw new Error(
      corpo.erro ?? `Falha ao extrair o áudio (${resposta.status}).`,
    );
  }
  return corpo.url;
};

// Proxies (cópias leves para o preview), um por vez. Os que falharam não
// são tentados de novo nesta aba (o preview usa o original).
const proxiesEmAndamento = new Set<string>();
const proxiesComErro = new Set<string>();
let filaDeProxies: Promise<unknown> = Promise.resolve();

export const precisaDeProxy = (midia: Midia) =>
  midia.formato === "video" &&
  midia.url.startsWith("/api/midia/") &&
  midia.preview?.de !== midia.url &&
  !proxiesEmAndamento.has(midia.url) &&
  !proxiesComErro.has(midia.url);

export const gerarProxy = (url: string): Promise<string | null> => {
  proxiesEmAndamento.add(url);
  const vez = filaDeProxies
    .then(() =>
      fetch("/api/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      }),
    )
    .then(async (r) => {
      const corpo = (await r.json().catch(() => ({}))) as { url?: string };
      if (!r.ok || !corpo.url) throw new Error();
      return corpo.url;
    })
    .catch(() => {
      proxiesComErro.add(url);
      return null;
    })
    .finally(() => proxiesEmAndamento.delete(url));
  filaDeProxies = vez;
  return vez;
};

// Duração (s) de um áudio já enviado, lida pelo navegador.
export const lerDuracaoDaUrl = (url: string): Promise<number | null> =>
  new Promise((resolve) => {
    const el = document.createElement("audio");
    el.preload = "metadata";
    el.onloadedmetadata = () =>
      resolve(Number.isFinite(el.duration) ? el.duration : null);
    el.onerror = () => resolve(null);
    el.src = url;
  });

// Ditado: envia a gravação do microfone e devolve o texto.
export const transcreverGravacao = async (audio: Blob) => {
  const dados = new FormData();
  dados.append("audio", audio, "gravacao.webm");
  const resposta = await fetch("/api/transcrever", {
    method: "POST",
    body: dados,
  });
  const corpo = (await resposta.json().catch(() => ({}))) as {
    texto?: string;
    erro?: string;
  };
  if (!resposta.ok || corpo.erro) {
    throw new Error(corpo.erro ?? `Falha no ditado (${resposta.status}).`);
  }
  return corpo.texto ?? "";
};
