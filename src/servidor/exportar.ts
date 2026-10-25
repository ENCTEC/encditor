import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { Midia } from "@/projeto/tipos";
import { calcularClipes, calcularDuracaoTotal } from "@/timeline/calculos";
import {
  formatoDaTimeline,
  formatoPorId,
  IdFormato,
  mudarFormato,
} from "@/timeline/formatos";
import { normalizarTimeline, Timeline } from "@/timeline/schema";
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
  pacoteRemotion?: { impressao: number; caminho: Promise<string> };
};
const trabalhos = (global.trabalhosExportar ??= new Map());

// Pastas de onde vem o código da composição. Se algum arquivo mudou (no
// desenvolvimento), o pacote antigo não serve: o vídeo sairia sem as
// novidades até reiniciar o servidor.
const PASTAS_DA_COMPOSICAO = ["src/remotion", "src/timeline", "src/catalogo"];
const impressaoDoCodigo = () =>
  Math.max(
    ...PASTAS_DA_COMPOSICAO.flatMap((pasta) =>
      fs
        .readdirSync(path.resolve(pasta), {
          recursive: true,
          withFileTypes: true,
        })
        .filter((f) => f.isFile())
        .map((f) => fs.statSync(path.join(f.parentPath, f.name)).mtimeMs),
    ),
  );

// Empacota a composição do Remotion uma vez (e de novo se o código dela
// mudou).
const pacote = () => {
  const impressao = impressaoDoCodigo();
  const atual = global.pacoteRemotion;
  if (atual?.impressao === impressao && atual.caminho) return atual.caminho;
  const caminho = bundle({
    entryPoint: path.resolve("src/remotion/index.ts"),
    webpackOverride: (config) => config,
  }).catch((e) => {
    global.pacoteRemotion = undefined;
    throw e;
  });
  global.pacoteRemotion = { impressao, caminho };
  return caminho;
};

// As URLs da mídia no app são relativas ("/api/midia/x.mp4"); o
// renderizador precisa do endereço completo do servidor.
const comEnderecoCompleto = (t: Timeline, origem: string): Timeline => {
  const abs = (url: string) => (url.startsWith("/") ? origem + url : url);
  return {
    // Projetos salvos antes das faixas Motion e Efeitos.
    ...normalizarTimeline(t),
    clipes: t.clipes.map((c) => ({ ...c, url: abs(c.url) })),
    inserts: t.inserts.map((i) => ({ ...i, url: abs(i.url) })),
    audios: t.audios.map((a) => ({ ...a, url: abs(a.url) })),
  };
};

export const lerTrabalho = (id: string) => trabalhos.get(id) ?? null;

// Começa a exportação em uma ou mais proporções (uma versão para cada,
// todas com o mesmo nome base: "Versão 3 (9:16)", "Versão 3 (1:1)").
export const exportarProjeto = (
  projetoId: string,
  origem: string,
  nomePedido: string | undefined,
  formatos: IdFormato[],
) => {
  const salvo = lerProjeto(projetoId);
  if (!salvo) throw new Error("Projeto não encontrado.");
  const timeline = (salvo.projeto as { timeline: Timeline }).timeline;
  if (!timeline.clipes.length) {
    throw new Error("O projeto ainda não tem cenas na trilha principal.");
  }
  const atual = formatoDaTimeline(timeline);
  const pedidos = formatos.length ? [...new Set(formatos)] : [atual];
  const base =
    nomePedido?.trim() || `Versão ${contarExportacoes(projetoId) + 1}`;
  return pedidos.map((formato) => {
    const marcar = formato && (pedidos.length > 1 || formato !== atual);
    const f = formato && formato !== atual ? formatoPorId(formato) : null;
    return exportarUmFormato(
      projetoId,
      salvo.cliente.id,
      origem,
      marcar ? `${base} (${formato})` : base,
      f ? mudarFormato(timeline, f.largura, f.altura) : timeline,
    );
  });
};

const exportarUmFormato = (
  projetoId: string,
  clienteId: string,
  origem: string,
  nome: string,
  timeline: Timeline,
) => {
  const trabalho: Trabalho = {
    id: randomUUID(),
    projetoId,
    nome,
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
      const usados = (lerMidiasDoCliente(clienteId) as Midia[])
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
        clienteId,
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
