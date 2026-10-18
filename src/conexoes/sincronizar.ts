import {
  atualizarExportacao,
  atualizarInfoDaConexao,
  lerConexao,
  lerExportacao,
  listarExportacoesDoCliente,
} from "@/servidor/banco";
import { decifrar } from "@/servidor/segredos";
import {
  ErroMeta,
  idDaConta,
  InfoMeta,
  manterAtivo,
  metricasAnuncio,
  metricasDosAnuncios,
  metricasInstagram,
  numerosDoAnuncio,
  SegredoMeta,
} from "./meta";
import {
  CamposAutomaticos,
  comNumerosAutomaticos,
  lerVinculos,
  NumerosAnuncio,
  pagoDosAnuncios,
  VinculoAnuncio,
  semAutomaticos,
  temVinculo,
} from "./vinculos";

// Lê da Meta os números de cada versão exportada ligada a um post/anúncio
// e escreve no resultado dela. Roda ao abrir a aba Resultados (versões com
// mais de 6 h), no botão "Atualizar números", logo depois de ligar uma
// versão e, com o encEditor ligado, a cada 6 h em segundo plano
// (manutencao.ts) — o que também mantém o app do cliente "ativo" (a Meta
// invalida as chaves de apps sem uso por 90 dias).
//
// Cuidados: uma leitura por vez por cliente (as outras entram na fila);
// cada versão é relida do banco antes de gravar (a pessoa pode ter salvo
// algo no meio); anúncios lidos em lote por conta (o acesso "Limited" tem
// limite baixo por conta); anúncios parados há 28 dias e posts com mais de
// 60 dias não são relidos o tempo todo.

export const VALIDADE_MS = 6 * 60 * 60 * 1000;
const UM_DIA_MS = 20 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;
const ANUNCIO_ESTAVEL_MS = 28 * DIA_MS;
const POST_ANTIGO_MS = 60 * DIA_MS;
const RELER_POST_ANTIGO_MS = 7 * DIA_MS;

export const CHAVE_ILEGIVEL =
  "Não consegui abrir a chave guardada deste cliente (a ENCEDITOR_CHAVE_SEGREDOS do servidor mudou?). Cole a chave de acesso de novo (passo 15).";

export type AnuncioGuardado = {
  numeros: NumerosAnuncio;
  lidoEm: number;
  // Última vez que gasto ou impressões mudaram (28 dias parado = estável).
  mudouEm: number;
};

export type MetricasGuardadas = {
  atualizadoEm: number;
  erro: string | null;
  erroInstagram?: string | null;
  erroAnuncios?: string | null;
  avisos?: string[];
  automaticos?: CamposAutomaticos;
  instagram?: { bruto: unknown; lidoEm: number } | null;
  anuncios?: Record<string, AnuncioGuardado>;
};

export type ResumoSincronia = {
  conectado: boolean;
  atualizadas: number;
  erros: { exportacaoId: string; mensagem: string }[];
  // Motivo de ter parado (chave inválida, pausa pedida pela Meta…).
  parou: string | null;
};

export const lerSegredoMeta = (
  clienteId: string,
):
  | { segredo: SegredoMeta; info: InfoMeta; cifrado: string; ilegivel: false }
  | { segredo: null; info: InfoMeta; cifrado: string; ilegivel: true }
  | null => {
  const c = lerConexao(clienteId, "meta");
  if (!c) return null;
  const info = c.info as InfoMeta;
  try {
    return {
      segredo: JSON.parse(decifrar(c.segredo)) as SegredoMeta,
      info,
      cifrado: c.segredo,
      ilegivel: false,
    };
  } catch {
    return {
      segredo: null,
      info: { ...info, erro: CHAVE_ILEGIVEL },
      cifrado: c.segredo,
      ilegivel: true,
    };
  }
};

// Fila por cliente (guardada no globalThis: em desenvolvimento o Next
// recarrega os módulos).
const global = globalThis as unknown as {
  filaMetricasMeta?: Map<string, Promise<ResumoSincronia>>;
};

export const sincronizarCliente = (
  clienteId: string,
  opcoes: { exportacaoId?: string; forcar?: boolean } = {},
): Promise<ResumoSincronia> => {
  const fila = (global.filaMetricasMeta ??= new Map());
  const anterior: Promise<unknown> =
    fila.get(clienteId) ?? Promise.resolve(null);
  const esta: Promise<ResumoSincronia> = anterior
    .catch(() => null)
    .then(() => ler(clienteId, opcoes))
    .catch((e: unknown) => ({
      conectado: true,
      atualizadas: 0,
      erros: [],
      parou: e instanceof Error ? e.message : String(e),
    }));
  fila.set(clienteId, esta);
  void esta.then(() => {
    if (fila.get(clienteId) === esta) fila.delete(clienteId);
  });
  return esta;
};

const hora = (quando: number) =>
  new Date(quando).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

const ler = async (
  clienteId: string,
  opcoes: { exportacaoId?: string; forcar?: boolean },
): Promise<ResumoSincronia> => {
  const conexao = lerSegredoMeta(clienteId);
  const resumo: ResumoSincronia = {
    conectado: !!conexao,
    atualizadas: 0,
    erros: [],
    parou: null,
  };
  if (!conexao) return resumo;
  if (conexao.ilegivel) return { ...resumo, parou: CHAVE_ILEGIVEL };
  const { segredo, info, cifrado } = conexao;
  const agora = Date.now();
  if (info.pausaAte && info.pausaAte > agora) {
    return {
      ...resumo,
      parou: `A Meta pediu uma pausa nas leituras: o encEditor tenta de novo depois das ${hora(info.pausaAte)}.`,
    };
  }

  // Primeiro as nunca lidas e as com erro; depois as mais antigas.
  const lista = listarExportacoesDoCliente(clienteId)
    .filter((e) => !opcoes.exportacaoId || e.id === opcoes.exportacaoId)
    .filter((e) => temVinculo(lerVinculos(e.vinculos)))
    .sort((a, b) => {
      const ma = a.metricas as MetricasGuardadas | null;
      const mb = b.metricas as MetricasGuardadas | null;
      const pa = !ma?.atualizadoEm || ma.erro ? 0 : ma.atualizadoEm;
      const pb = !mb?.atualizadoEm || mb.erro ? 0 : mb.atualizadoEm;
      return pa - pb;
    });

  // Lido nesta rodada (o mesmo anúncio pode estar em várias versões).
  const lidos = new Map<string, NumerosAnuncio>();
  let paradoInstagram: string | null = null;
  let paradoPrincipal: string | null = null;
  let respondeu = false;
  let pausaAte: number | null = null;

  const registrar = (e: unknown) => {
    if (e instanceof ErroMeta && e.tipo !== "rede") respondeu = true;
    if (e instanceof ErroMeta && e.tipo === "limite") {
      pausaAte = Math.max(
        pausaAte ?? 0,
        Date.now() + (e.esperarMin ?? 5) * 60_000,
      );
    }
    if (
      e instanceof ErroMeta &&
      (e.tipo === "token" || e.tipo === "segredo" || e.tipo === "versao")
    ) {
      if (e.chave === "instagram") paradoInstagram = e.message;
      else {
        paradoPrincipal = e.message;
        // Sem 2ª chave, o Instagram usa a mesma.
        if (!segredo.tokenInstagram) paradoInstagram = e.message;
      }
    }
    return mensagem(e);
  };

  const aProcessar = lista.filter((e) => {
    const ant = e.metricas as MetricasGuardadas | null;
    return !(
      !opcoes.forcar &&
      ant?.atualizadoEm &&
      !ant.erro &&
      agora - ant.atualizadoEm < VALIDADE_MS
    );
  });

  // ----- Anúncios: TODOS os das versões desta leitura, uma chamada por
  // conta (em blocos de 50) — o acesso "Limited" tem limite por conta. -----
  const erroDaConta = new Map<string, string>();
  const porConta = new Map<string, Map<string, VinculoAnuncio>>();
  for (const e of aProcessar) {
    const ant = e.metricas as MetricasGuardadas | null;
    for (const a of lerVinculos(e.vinculos).anuncios) {
      const g = ant?.anuncios?.[a.anuncioId];
      if (g && Date.now() - g.mudouEm > ANUNCIO_ESTAVEL_MS) continue; // parado
      const conta = idDaConta(a.contaId);
      if (!porConta.has(conta)) porConta.set(conta, new Map());
      porConta.get(conta)!.set(a.anuncioId, a);
    }
  }
  for (const [conta, anuncios] of porConta) {
    if (paradoPrincipal) break;
    const ids = [...anuncios.keys()];
    try {
      for (let i = 0; i < ids.length; i += 50) {
        const bloco = ids.slice(i, i + 50);
        const linhas = await metricasDosAnuncios(segredo, conta, bloco);
        respondeu = true;
        for (const id of bloco) {
          const a = anuncios.get(id)!;
          const linha = linhas.get(id);
          // Fora do lote (arquivado, excluído ou sem entrega): pelo ID.
          lidos.set(
            id,
            linha
              ? numerosDoAnuncio(linha, a.tipo ?? null)
              : await metricasAnuncio(segredo, a),
          );
        }
      }
    } catch (err) {
      erroDaConta.set(conta, registrar(err));
    }
  }

  for (const e of aProcessar) {
    const v = lerVinculos(e.vinculos);
    const ant = e.metricas as MetricasGuardadas | null;
    if (paradoPrincipal && (paradoInstagram || !v.instagram)) break;

    const novos: Parameters<typeof comNumerosAutomaticos>[1] = {};
    const guardar: MetricasGuardadas = {
      atualizadoEm: Date.now(),
      erro: null,
      erroInstagram: null,
      erroAnuncios: null,
      avisos: [],
      automaticos: ant?.automaticos ?? semAutomaticos(),
      instagram: ant?.instagram ?? null,
      anuncios: { ...(ant?.anuncios ?? {}) },
    };

    // ----- Instagram -----
    if (v.instagram) {
      const publicado = v.instagram.publicadoEm
        ? Date.parse(v.instagram.publicadoEm)
        : NaN;
      const antigoEJaLido =
        Number.isFinite(publicado) &&
        Date.now() - publicado > POST_ANTIGO_MS &&
        !!ant?.instagram?.lidoEm &&
        Date.now() - ant.instagram.lidoEm < RELER_POST_ANTIGO_MS;
      if (paradoInstagram) {
        guardar.erroInstagram = paradoInstagram;
      } else if (!antigoEJaLido) {
        try {
          const r = await metricasInstagram(segredo, v.instagram);
          respondeu = true;
          novos.instagram = r.organico;
          guardar.instagram = { bruto: r.bruto, lidoEm: Date.now() };
        } catch (err) {
          guardar.erroInstagram =
            registrar(err) +
            (err instanceof ErroMeta && err.tipo === "permissao"
              ? " Se a chave não tem ads_management, gere de novo incluindo ads_management — só com usuário do sistema Funcionário e a conta de anúncios em “Ver desempenho” (passo 14)."
              : "");
        }
      }
    }

    // ----- Anúncios (em lote por conta) -----
    if (v.anuncios.length) {
      if (paradoPrincipal) {
        guardar.erroAnuncios = paradoPrincipal;
      } else {
        // Guarda cada anúncio lido (e quando mudou pela última vez).
        for (const a of v.anuncios) {
          const n = lidos.get(a.anuncioId);
          const erroConta = erroDaConta.get(idDaConta(a.contaId));
          if (!n && erroConta) guardar.erroAnuncios = erroConta;
          if (!n) continue;
          const g = guardar.anuncios?.[a.anuncioId];
          const mudou =
            !g ||
            g.numeros.gasto !== n.gasto ||
            g.numeros.impressoes !== n.impressoes;
          guardar.anuncios![a.anuncioId] = {
            numeros: n,
            lidoEm: Date.now(),
            mudouEm: mudou ? Date.now() : g.mudouEm,
          };
        }
        // Só soma com TODOS os anúncios da versão lidos (agora ou antes):
        // somar um conjunto parcial daria números errados.
        const numeros = v.anuncios.map(
          (a) => guardar.anuncios?.[a.anuncioId]?.numeros,
        );
        if (numeros.every((n): n is NumerosAnuncio => !!n)) {
          const { pago, avisos } = pagoDosAnuncios(numeros);
          novos.pago = pago;
          guardar.avisos = avisos;
        }
      }
    }

    // Só os anúncios ainda ligados ficam guardados.
    guardar.anuncios = Object.fromEntries(
      Object.entries(guardar.anuncios ?? {}).filter(([id]) =>
        v.anuncios.some((a) => a.anuncioId === id),
      ),
    );
    guardar.erro = guardar.erroInstagram ?? guardar.erroAnuncios ?? null;

    // Relê a versão (a pessoa pode ter salvo algo enquanto a Meta
    // respondia) e grava no mesmo instante — node:sqlite é síncrono.
    const atual = lerExportacao(e.id);
    if (
      !atual ||
      JSON.stringify(lerVinculos(atual.vinculos)) !== JSON.stringify(v)
    ) {
      continue; // ligação mudou: a leitura dela é outra
    }
    const { resultado, automaticos } = comNumerosAutomaticos(
      atual.resultado,
      novos,
      guardar.automaticos,
    );
    guardar.automaticos = automaticos;
    atualizarExportacao(e.id, { resultado, metricas: guardar });
    if (guardar.erro)
      resumo.erros.push({ exportacaoId: e.id, mensagem: guardar.erro });
    else resumo.atualizadas++;
  }

  // Ninguém leu nada hoje: chamadas leves mantêm os apps ativos.
  if (
    !respondeu &&
    !paradoPrincipal &&
    (!info.ultimaLeitura || agora - info.ultimaLeitura > UM_DIA_MS)
  ) {
    try {
      await manterAtivo(segredo);
      respondeu = true;
    } catch (err) {
      registrar(err);
    }
  }

  // Atualiza a conexão a partir do que está no banco AGORA (pode ter sido
  // conferida ou trocada no meio) — e só se ainda for a mesma chave.
  const c = lerConexao(clienteId, "meta");
  if (c && c.segredo === cifrado) {
    const infoAtual = c.info as InfoMeta;
    const erroDaChave = paradoPrincipal ?? paradoInstagram;
    atualizarInfoDaConexao(clienteId, "meta", {
      ...infoAtual,
      ultimaLeitura: respondeu ? Date.now() : infoAtual.ultimaLeitura,
      erro: erroDaChave ?? (respondeu ? null : infoAtual.erro),
      pausaAte,
    });
  }
  resumo.parou =
    paradoPrincipal ??
    paradoInstagram ??
    (pausaAte
      ? `A Meta pediu uma pausa nas leituras: o encEditor tenta de novo depois das ${hora(pausaAte)}.`
      : null);
  return resumo;
};
