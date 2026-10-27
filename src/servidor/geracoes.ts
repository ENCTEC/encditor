import { CenaPlano, lerPlanoSalvo } from "@/plano/tipos";
import { gerarApelido, proximoNome } from "@/projeto/midia-cliente";
import { Midia } from "@/projeto/tipos";
import { caminhoDoArquivo, nomeDaUrl } from "./armazenamento";
import {
  geracoesDoProjeto,
  geracoesEmAndamento,
  LinhaGeracao,
  lerMidiasDoCliente,
  lerPlano,
  lerProjeto,
  listarElementos,
  registrarCusto,
  salvarGeracao,
  salvarMidiasDoCliente,
} from "./banco";
import {
  baixarVideo,
  cancelarVideo,
  custoEmDolar,
  dimensoes,
  pedirVideo,
  proporcaoDoFormato,
  Resolucao,
  situacaoDoVideo,
  subirArquivo,
} from "./higgsfield";

// Gera no Higgsfield os takes do plano (aba Planejar): monta o pedido a
// partir da cena (prompt, duração medida na narração, proporção do vídeo,
// som do take, fotos dos @elementos como referência), acompanha a geração
// e, pronto, baixa o vídeo, guarda no banco do cliente e anota o custo. O
// Mapa do Plano é quem LIGA o vídeo ao item (ele é quem salva o plano).

export type DadosDaGeracao = {
  rotulo: string;
  prompt: string;
  segundos: number;
  resolucao: Resolucao;
  proporcao: string;
  comSom: boolean;
  elementos: string[];
  // US$ pela fórmula oficial (tabela cheia).
  custo: number;
  requestId?: string;
  statusUrl?: string;
  cancelUrl?: string | null;
  midia?: Midia;
  erro?: string;
  ligadoEm?: number;
};
export type Geracao = Omit<LinhaGeracao, "dados"> & { dados: DadosDaGeracao };

const ATIVOS = new Set(["subindo", "na fila", "gerando", "baixando"]);
const comDados = (g: LinhaGeracao) => g as Geracao;

const simples = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/^@/, "");

// O que gerar para um take do plano (sem pedir nada ainda).
export const prepararTake = (projetoId: string, chave: string, resolucao: Resolucao) => {
  const projeto = lerProjeto(projetoId);
  if (!projeto) throw new Error("Projeto não encontrado.");
  const plano = lerPlanoSalvo(lerPlano(projetoId));
  const cena = plano.gerado?.cenas.find(
    (c: CenaPlano) => `cena:${c.apelido}` === chave && c.origem === "higgsfield",
  );
  if (!cena) throw new Error(`O plano não tem o take ${chave} para gerar no Higgsfield.`);
  const medida = plano.narracaoVerificada?.cenas.find((x) => x.numero === cena.numero)?.gerar;
  const pedido = medida ?? cena.duracao_gerar_s ?? Math.ceil(cena.duracao_s);
  const segundos = Math.min(15, Math.max(4, Math.round(pedido)));
  const timeline = (projeto.projeto as { timeline?: { largura?: number; altura?: number } }).timeline;
  const proporcao = proporcaoDoFormato(timeline?.largura ?? 1080, timeline?.altura ?? 1920);
  // Os @elementos da cena com foto viram imagens de referência; no prompt,
  // "@nome" vira "@ImageN" (a ordem das imagens).
  const doCliente = listarElementos(projeto.cliente.id);
  const elementos = cena.elementos
    .map((n) => doCliente.find((e) => simples(e.nome) === simples(n)))
    .filter((e): e is NonNullable<typeof e> => !!e?.imagem)
    .slice(0, 9);
  let prompt = cena.prompt_higgsfield?.trim() || cena.descricao;
  elementos.forEach((e, i) => {
    prompt = prompt.replace(new RegExp(`@${e.nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), `@Image${i + 1}`);
  });
  return {
    cena,
    projeto,
    referencias: elementos.map((e) => caminhoDoArquivo(nomeDaUrl(e.imagem as string))),
    dados: {
      rotulo: `Take ${cena.numero} (@${cena.apelido})`,
      prompt,
      segundos,
      resolucao,
      proporcao,
      comSom: cena.volume_do_take !== "mudo",
      elementos: elementos.map((e) => e.nome),
      custo: custoEmDolar(segundos, resolucao, proporcao),
      ...(pedido > 15 ? { erro: `A cena pede ${Math.round(pedido)} s, mas o Higgsfield gera até 15 s pela API: gerei 15 s.` } : {}),
    } satisfies DadosDaGeracao,
  };
};

// Pede os vídeos (um por take). Não espera a geração: ela é acompanhada
// em segundo plano.
export const iniciarGeracoes = (projetoId: string, chaves: string[], resolucao: Resolucao) => {
  const ativas = new Set(
    geracoesDoProjeto(projetoId).filter((g) => ATIVOS.has(g.estado)).map((g) => g.chave),
  );
  const novas: Geracao[] = [];
  for (const chave of chaves) {
    if (ativas.has(chave)) continue;
    const { projeto, referencias, dados } = prepararTake(projetoId, chave, resolucao);
    const agora = Date.now();
    const g: Geracao = {
      id: crypto.randomUUID(),
      projetoId,
      clienteId: projeto.cliente.id,
      chave,
      estado: "subindo",
      dados,
      criadoEm: agora,
      atualizadoEm: agora,
    };
    salvarGeracao(g);
    novas.push(g);
    void enviar(g, referencias);
  }
  return novas;
};

const mudar = (g: Geracao, estado: string, dados: Partial<DadosDaGeracao> = {}) => {
  g.estado = estado;
  g.dados = { ...g.dados, ...dados };
  g.atualizadoEm = Date.now();
  salvarGeracao(g);
};

const enviar = async (g: Geracao, referencias: string[]) => {
  try {
    const urls: string[] = [];
    for (const caminho of referencias) urls.push(await subirArquivo(caminho));
    const r = await pedirVideo({ ...g.dados, referencias: urls }, g.id);
    mudar(g, "na fila", { requestId: r.requestId, statusUrl: r.statusUrl, cancelUrl: r.cancelUrl });
    acompanhar();
  } catch (e) {
    mudar(g, "erro", { erro: e instanceof Error ? e.message : String(e) });
  }
};

// Termina uma geração pronta: baixa, guarda no banco do cliente, anota o custo.
const concluir = async (g: Geracao, videoUrl: string) => {
  mudar(g, "baixando");
  const arquivo = await baixarVideo(videoUrl);
  const banco = (g.clienteId ? lerMidiasDoCliente(g.clienteId) : []) as Midia[];
  const apelidoDoTake = g.chave.replace(/^cena:/, "");
  const { largura, altura } = dimensoes(g.dados.resolucao, g.dados.proporcao);
  const midia: Midia = {
    id: crypto.randomUUID(),
    nome: proximoNome(banco, "cena"),
    apelido: gerarApelido(apelidoDoTake, banco),
    usarIA: true,
    papel: "cena",
    formato: "video",
    url: `/api/midia/${arquivo}`,
    nomeArquivo: `${apelidoDoTake}.mp4`,
    duracao: g.dados.segundos,
    largura,
    altura,
    projetoId: g.projetoId,
  };
  if (g.clienteId) salvarMidiasDoCliente(g.clienteId, [midia]);
  registrarCusto({
    quando: Date.now(),
    projetoId: g.projetoId,
    clienteId: g.clienteId,
    pedido: g.id,
    tipo: "vídeo no Higgsfield",
    descricao: `${g.dados.rotulo}: ${g.dados.segundos}s em ${g.dados.resolucao}`,
    modelo: "seedance-2.0",
    entrada: 0,
    cache: 0,
    saida: 0,
    segundos: g.dados.segundos,
    valor: g.dados.custo,
  });
  mudar(g, "pronto", { midia });
};

// Acompanha as gerações em andamento (a cada 8 s, enquanto houver).
declare global {
  var geracoesHiggsfield: { timer: ReturnType<typeof setInterval> | null; ocupadas: Set<string> } | undefined;
}
const estado = () => (globalThis.geracoesHiggsfield ??= { timer: null, ocupadas: new Set() });

const passo = async () => {
  const s = estado();
  const ativas = geracoesEmAndamento().map(comDados);
  if (!ativas.length && s.timer) {
    clearInterval(s.timer);
    s.timer = null;
    return;
  }
  for (const g of ativas) {
    if (s.ocupadas.has(g.id)) continue;
    // Envio interrompido (o encEditor reiniciou no meio): sem como saber.
    if (!g.dados.statusUrl) {
      if (Date.now() - g.atualizadoEm > 5 * 60 * 1000) {
        mudar(g, "erro", { erro: "O envio foi interrompido (o encEditor reiniciou). Gere de novo." });
      }
      continue;
    }
    s.ocupadas.add(g.id);
    try {
      if (g.estado === "baixando") {
        // Reiniciou no meio do download: busca a situação de novo.
        g.estado = "gerando";
      }
      const r = await situacaoDoVideo(g.dados.statusUrl);
      if (r.status === "queued" && g.estado !== "na fila") mudar(g, "na fila");
      else if (r.status === "in_progress" && g.estado !== "gerando") mudar(g, "gerando");
      else if (r.status === "completed" && r.videoUrl) await concluir(g, r.videoUrl);
      else if (r.status === "failed") mudar(g, "erro", { erro: r.erro ?? "A geração falhou no Higgsfield (não é cobrada)." });
      else if (r.status === "nsfw") mudar(g, "bloqueado", { erro: "O Higgsfield bloqueou por conteúdo (moderação). Ajuste o prompt." });
      else if (r.status === "canceled") mudar(g, "cancelado");
    } catch (e) {
      console.error("[higgsfield] acompanhando:", e);
    } finally {
      s.ocupadas.delete(g.id);
    }
  }
};

export const acompanhar = () => {
  const s = estado();
  if (!s.timer) s.timer = setInterval(() => void passo(), 8000);
  void passo();
};

export const geracoesParaTela = (projetoId: string) => geracoesDoProjeto(projetoId).map(comDados);

export const cancelarGeracao = async (g: Geracao) => {
  if (g.estado !== "na fila" || !g.dados.cancelUrl) {
    throw new Error("Só dá para cancelar enquanto o take está na fila.");
  }
  await cancelarVideo(g.dados.cancelUrl);
  mudar(g, "cancelado");
};

// O Mapa do Plano ligou o vídeo ao take.
export const marcarLigada = (g: Geracao) => mudar(g, "ligado", { ligadoEm: Date.now() });
