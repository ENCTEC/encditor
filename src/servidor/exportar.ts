import { randomUUID } from "node:crypto";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { Midia } from "@/projeto/tipos";
import { calcularClipes, calcularDuracaoTotal } from "@/timeline/calculos";
import { Timeline } from "@/timeline/schema";
import { apagarArquivos, reservarArquivo } from "./armazenamento";
import {
  contarExportacoes,
  lerMidiasDoCliente,
  lerProjeto,
  registrarExportacao,
} from "./banco";

// Exportar = renderizar o MP4 final de um projeto com o Remotion (o mesmo
// motor do preview), no próprio servidor. Uma exportação por vez (fila),
// com progresso. Cada vídeo exportado vira uma "versão" do projeto.

export type Trabalho = {
  id: string;
  projetoId: string;
  nome: string;
  estado: "na-fila" | "preparando" | "renderizando" | "pronto" | "erro";
  progresso: number;
  erro: string | null;
  exportacaoId: string | null;
  arquivo: string | null;
};

const global = globalThis as unknown as {
  trabalhosExportar?: Map<string, Trabalho>;
  filaExportar?: Promise<void>;
  pacoteRemotion?: Promise<string>;
};
const trabalhos = (global.trabalhosExportar ??= new Map());

// Empacota a composição do Remotion uma vez por execução do servidor.
const pacote = () =>
  (global.pacoteRemotion ??= bundle({
    entryPoint: path.resolve("src/remotion/index.ts"),
    webpackOverride: (config) => config,
  }).catch((e) => {
    global.pacoteRemotion = undefined;
    throw e;
  }));

// As URLs da mídia no app são relativas ("/api/midia/x.mp4"); o
// renderizador precisa do endereço completo do servidor.
const comEnderecoCompleto = (t: Timeline, origem: string): Timeline => {
  const abs = (url: string) => (url.startsWith("/") ? origem + url : url);
  return {
    ...t,
    clipes: t.clipes.map((c) => ({ ...c, url: abs(c.url) })),
    inserts: t.inserts.map((i) => ({ ...i, url: abs(i.url) })),
    audios: t.audios.map((a) => ({ ...a, url: abs(a.url) })),
  };
};

export const lerTrabalho = (id: string) => trabalhos.get(id) ?? null;

export const exportarProjeto = (
  projetoId: string,
  origem: string,
  nomePedido?: string,
) => {
  const salvo = lerProjeto(projetoId);
  if (!salvo) throw new Error("Projeto não encontrado.");
  const timeline = (salvo.projeto as { timeline: Timeline }).timeline;
  if (!timeline.clipes.length) {
    throw new Error("O projeto ainda não tem cenas na trilha principal.");
  }

  const trabalho: Trabalho = {
    id: randomUUID(),
    projetoId,
    nome: nomePedido?.trim() || `Versão ${contarExportacoes(projetoId) + 1}`,
    estado: "na-fila",
    progresso: 0,
    erro: null,
    exportacaoId: null,
    arquivo: null,
  };
  trabalhos.set(trabalho.id, trabalho);

  const executar = async () => {
    try {
      trabalho.estado = "preparando";
      const serveUrl = await pacote();
      const inputProps = comEnderecoCompleto(timeline, origem);
      const composicao = await selectComposition({
        serveUrl,
        id: "EditorTimeline",
        inputProps,
      });
      const destino = await reservarArquivo(".mp4");
      trabalho.estado = "renderizando";
      await renderMedia({
        composition: composicao,
        serveUrl,
        codec: "h264",
        outputLocation: destino.caminho,
        inputProps,
        onProgress: ({ progress }) => {
          trabalho.progresso = Math.round(progress * 100) / 100;
        },
      });

      if (!lerProjeto(projetoId)) {
        await apagarArquivos([destino.nome]);
        throw new Error("O projeto foi apagado durante a exportação.");
      }

      // "Foto" da edição: a timeline exportada e os arquivos usados nela
      // (com apelido, transcrição resumida e análise) para a IA cruzar
      // com o resultado depois.
      const urls = new Set([
        ...timeline.clipes.map((c) => c.url),
        ...timeline.inserts.map((i) => i.url),
        ...timeline.audios.map((a) => a.url),
      ]);
      const usados = (lerMidiasDoCliente(salvo.cliente.id) as Midia[])
        .filter((m) => urls.has(m.url))
        .map((m) => ({
          id: m.id,
          apelido: m.apelido,
          nome: m.nome,
          url: m.url,
          papel: m.papel,
          formato: m.formato,
        }));
      trabalho.exportacaoId = registrarExportacao({
        projetoId,
        clienteId: salvo.cliente.id,
        nome: trabalho.nome,
        arquivo: destino.nome,
        duracao: calcularDuracaoTotal(calcularClipes(timeline)) / timeline.fps,
        edicao: { timeline, arquivosUsados: usados },
      });
      trabalho.arquivo = destino.nome;
      trabalho.progresso = 1;
      trabalho.estado = "pronto";
    } catch (e) {
      trabalho.estado = "erro";
      trabalho.erro = e instanceof Error ? e.message : String(e);
    }
  };

  // Fila: uma renderização por vez (é pesada para a CPU).
  global.filaExportar = (global.filaExportar ?? Promise.resolve()).then(
    executar,
  );
  return trabalho;
};
