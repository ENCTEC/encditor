import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import OpenAI from "openai";
import { z } from "zod";
import { TRANSICOES, ESTILOS_LEGENDA } from "@/catalogo/estilos";
import { Analise, analiseSchema } from "@/projeto/analise";
import { Resultado, resultadoSchema } from "@/projeto/resultado";
import { Midia } from "@/projeto/tipos";
import { Elemento } from "@/plano/elementos";
import { normalizarApelido } from "@/projeto/midia-cliente";
import {
  FINALIDADES_EXEMPLO,
  lerPlanoSalvo,
  PlanoGerado,
  PlanoSalvo,
  respostaPlanejadorSchema,
  VOLUMES_TAKE,
} from "@/plano/tipos";
import { analisarArquivo } from "./analise";
import { caminhoDoArquivo, lerAnaliseSalva, nomeDaUrl } from "./armazenamento";
import {
  lerAprendizados,
  lerEdicoesDoCliente,
  lerMidiasDoCliente,
  lerPlano,
  lerProjeto,
  listarElementos,
  listarExportacoesDoCliente,
  salvarAprendizados,
  salvarPlano,
} from "./banco";
import { esquemaEstrito } from "./esquema-estrito";
import { extrairQuadros } from "./ffmpeg";
import { clienteOpenAI, comNovaTentativa, MODELOS } from "./openai";

// Planejador: conversa com o usuário e monta o PLANO do vídeo (copy,
// takes do Higgsfield com prompts, reaproveitamento do banco do cliente e
// a edição que o ENCeditor faz depois). Usa tudo o que o cliente já tem:
// resultados dos vídeos exportados (números pesam mais que opinião),
// aprendizados condensados, banco de mídia e elementos do Higgsfield.

const r1 = (n: number) => Math.round(n * 10) / 10;
const curto = (t: string | null | undefined, max: number) =>
  !t ? "" : t.length > max ? `${t.slice(0, max)}…` : t;

// ---------- Desempenho e aprendizados ----------

type Versao = {
  id: string;
  nome: string;
  projeto: string;
  duracao: number;
  resultado: Resultado | null;
  edicao: string;
  usou: string[]; // urls dos arquivos usados
};

// Nota única para ordenar (só para ordenar; a IA vê os números crus).
const pontuacao = (r: Resultado | null) => {
  if (!r) return -1;
  const base = { bom: 3, neutro: 2, ruim: 1 }[r.avaliacao];
  const roas = r.metricas.roas ?? 0;
  const ctr = r.metricas.ctr ?? 0;
  return base * 100 + roas * 10 + ctr;
};

const metricasEmTexto = (r: Resultado) =>
  [
    r.metricas.roas !== null ? `ROAS ${r.metricas.roas}` : "",
    r.metricas.cpa !== null ? `CPA R$${r.metricas.cpa}` : "",
    r.metricas.ctr !== null ? `CTR ${r.metricas.ctr}%` : "",
    r.metricas.investimento !== null
      ? `investimento R$${r.metricas.investimento}`
      : "",
  ]
    .filter(Boolean)
    .join(", ") || "sem métricas";

// Resumo da edição exportada: sequência de cenas (com o que mostram),
// inserts, estilo de legenda e transições.
const resumoDaEdicao = (bruta: unknown, porUrl: Map<string, Midia>) => {
  const e = bruta as {
    timeline?: {
      clipes?: {
        url: string;
        transicao?: string;
        inicio: number;
        fim: number;
      }[];
      inserts?: { url: string }[];
      estiloLegenda?: string;
      legendas?: unknown[];
    };
  };
  const t = e?.timeline;
  if (!t) return { texto: "", usou: [] as string[] };
  const descrever = (url: string) => {
    const m = porUrl.get(url);
    return m
      ? `@${m.apelido}${m.analise?.visual?.resumo ? ` (${curto(m.analise.visual.resumo, 90)})` : ""}`
      : "(arquivo apagado)";
  };
  const cenas = (t.clipes ?? []).map(
    (c, i) =>
      `${i + 1}. ${descrever(c.url)} ${r1(c.fim - c.inicio)}s${c.transicao && c.transicao !== "corte" ? ` [entra com ${c.transicao}]` : ""}`,
  );
  const inserts = (t.inserts ?? []).map((x) => descrever(x.url));
  return {
    texto: [
      `cenas: ${cenas.join("; ")}`,
      inserts.length ? `inserts: ${inserts.join(", ")}` : "",
      t.legendas?.length
        ? `legendas #${t.estiloLegenda ?? "classico"}`
        : "sem legendas",
    ]
      .filter(Boolean)
      .join(" | "),
    usou: [...(t.clipes ?? []), ...(t.inserts ?? [])].map((c) => c.url),
  };
};

const versoesDoCliente = (clienteId: string, midias: Midia[]): Versao[] => {
  const porUrl = new Map(midias.map((m) => [m.url, m]));
  const edicoes = lerEdicoesDoCliente(clienteId);
  return listarExportacoesDoCliente(clienteId)
    .map((x) => {
      const resultado = resultadoSchema.safeParse(x.resultado);
      const resumo = resumoDaEdicao(edicoes.get(x.id), porUrl);
      return {
        id: x.id,
        nome: x.nome,
        projeto: lerProjeto(x.projetoId)?.nome ?? "?",
        duracao: x.duracao,
        resultado: resultado.success ? resultado.data : null,
        edicao: resumo.texto,
        usou: resumo.usou,
      };
    })
    .sort((a, b) => pontuacao(b.resultado) - pontuacao(a.resultado));
};

const aprendizadosSchema = z.object({
  o_que_funciona: z.array(z.string()),
  o_que_nao_funciona: z.array(z.string()),
  problemas_visuais_a_evitar: z.array(z.string()),
  resumo: z.string(),
});
export type Aprendizados = z.infer<typeof aprendizadosSchema>;

// Condensa resultados + opiniões em regras curtas. Refaz só quando algum
// resultado muda.
export const obterAprendizados = async (
  clienteId: string,
): Promise<Aprendizados | null> => {
  const midias = lerMidiasDoCliente(clienteId) as Midia[];
  const comResultado = versoesDoCliente(clienteId, midias).filter(
    (v) => v.resultado,
  );
  if (!comResultado.length) return null;
  const fonte = createHash("sha1")
    .update(JSON.stringify(comResultado.map((v) => [v.id, v.resultado])))
    .digest("hex");
  const salvo = lerAprendizados(clienteId);
  if (salvo?.fonte === fonte) {
    const ok = aprendizadosSchema.safeParse(salvo.dados);
    if (ok.success) return ok.data;
  }

  const linhas = comResultado.map((v) => {
    const r = v.resultado!;
    return [
      `- Versão "${v.nome}" (projeto ${v.projeto}, ${r1(v.duracao)}s): ${r.avaliacao.toUpperCase()}; ${metricasEmTexto(r)}`,
      r.nota ? `  anotação: ${r.nota}` : "",
      r.opiniaoVisual ? `  opinião sobre o visual: ${r.opiniaoVisual}` : "",
      v.edicao ? `  edição: ${curto(v.edicao, 900)}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });
  const resposta = await comNovaTentativa(() =>
    clienteOpenAI().responses.create({
      model: MODELOS.editor,
      instructions:
        "Você analisa resultados de anúncios em vídeo (tráfego pago) de um cliente e condensa aprendizados curtos e acionáveis para os PRÓXIMOS roteiros e clipes. Números (ROAS, CPA, CTR, avaliação) pesam MUITO mais que opiniões; opiniões sobre o visual viram regras de 'problemas visuais a evitar' na geração dos clipes (ex.: 'mostrar mais a loja', 'evitar ângulo de baixo na modelo'). Junte opiniões repetidas numa regra só. Não invente números. Português do Brasil, frases curtas.",
      input: linhas.join("\n"),
      text: {
        format: {
          type: "json_schema",
          name: "aprendizados",
          strict: true,
          schema: esquemaEstrito(aprendizadosSchema),
        },
      },
    }),
  );
  const dados = aprendizadosSchema.parse(JSON.parse(resposta.output_text));
  salvarAprendizados(clienteId, fonte, dados);
  return dados;
};

// ---------- Instruções do planejador ----------

const INSTRUCOES = `Você é o diretor criativo e roteirista do ENCeditor, especialista em anúncios de vídeo para tráfego pago (Reels, TikTok, Stories). Você conversa com o usuário em português do Brasil e entrega o PLANO de um vídeo para o cliente dele.

COMO O VÍDEO É FEITO
1) Os clipes (takes) são gerados no Higgsfield com o modelo Seedance 2.0. Ele entende elementos salvos citados com @nome (personagens, produtos, lugares), movimentos e ângulos de câmera, mais de um plano numa geração, efeitos visuais complexos e GERA SOM (efeitos, ambiente e até falas). Clipes curtos (em geral 5 a 10 s; gere sempre com ~1 s de folga para aparar).
2) O ENCeditor edita: cortes e aparas, 8 transições (${TRANSICOES.map((t) => t.id).join(", ")}), zoom de câmera, inserts por cima (tela cheia, cantos, tela dividida), legendas animadas (${ESTILOS_LEGENDA.map((e) => e.id).join(", ")}), efeitos de áudio e mixagem (volume do som de cada take por baixo da narração, música de fundo).
O ENCeditor NÃO faz: mudar velocidade, câmera lenta, correção de cor, filtros, títulos animados além das legendas. O que for complexo (movimento de câmera, transformação, efeito visual, transição dentro do próprio take) vai para o PROMPT do Higgsfield (feito_no_higgsfield); o que for simples fica para o ENCeditor (feito_no_enceditor).

O QUE VOCÊ USA (nesta ordem de peso)
1) RESULTADOS EM NÚMEROS das versões já exportadas do cliente (ROAS, CPA, CTR, avaliação): copie o que deu certo (gancho, ritmo, tipo de cena, estilo de legenda, duração) e evite o que deu errado. Números não mentem.
2) APRENDIZADOS condensados e OPINIÕES SOBRE O VISUAL (pesam menos que números, mas toda regra de "problema visual a evitar" deve ser respeitada nos prompts dos takes — ex.: se reclamaram de iluminação, peça iluminação clara e uniforme).
3) O ROTEIRO do usuário (mantenha o sentido e a oferta; melhore gancho nos 2 primeiros segundos, clareza e chamada para ação; explique em melhorias_no_roteiro). Sem roteiro, crie do zero a partir do objetivo.
4) EXEMPLOS enviados, cada um com a sua finalidade (edição, ângulo, cena específica, estilo). Se a finalidade/detalhe de um exemplo estiver vago, PERGUNTE o que copiar dele.
5) CENAS OBRIGATÓRIAS: todas precisam estar no plano.
6) BANCO DO CLIENTE: clipes já enviados em outros projetos DESTE cliente. Reaproveite (origem "banco", apelido_banco exato, trecho_banco_de/ate com base na minutagem da análise) quando um clipe combinar com a fala SEM perder o sentido do vídeo — principalmente clipes usados em versões que deram resultado. Nunca use arquivos que não estão na lista.

REGRAS DO PLANO
- modo_audio: "narracao" (padrão para anúncios: voz em off do cliente enviada depois), "fala_nos_takes" (personagens falam no próprio take) ou "so_musica".
- copy: texto completo falado. Cada cena.fala é um TRECHO EXATO e contínuo da copy, na ordem (juntando as falas de todas as cenas = a copy inteira). Isso é usado para sincronizar as cenas com a narração.
- duracao_s de cada cena ≈ palavras da fala ÷ 2,6 (ritmo de narração de anúncio); cenas de 1,5 a 4 s em geral; duracao_gerar_s = duracao_s + ~1 s, arredondado para o que o Higgsfield gera (5 ou 10).
- prompt_higgsfield: em INGLÊS (o Seedance entende melhor), detalhado e pronto para colar: sujeito com os @elementos exatos, ação, cenário, ângulo e movimento de câmera, luz, estilo, proporção do vídeo. ÁUDIO no prompt: no modo narração, escreva "No dialogue, no music." e peça só o som pontual do take (som_do_take, ex.: "Sound: airplane passing overhead") ou "Silent" se não precisar; no modo fala_nos_takes, escreva a fala em português entre aspas.
- volume_do_take: ${Object.entries(VOLUMES_TAKE)
  .map(([k, v]) => `${k} = ${v}`)
  .join(
    "; ",
  )}. No modo narração use "mudo", "ambiente" ou "efeito" (nunca "fala").
- apelidos: minúsculos, sem acento e sem espaço, únicos: takes "take01-gancho", "take02-produto"…; inserts "insert01-…"; narração "narracao"; música "musica".
- transicao_entrada: null na cena 1; nas outras, escolha pelo ritmo (corte seco é o padrão de reels; use outras com propósito, duração 0.2 a 0.6).
- zoom (opcional): frase = trecho exato da fala daquela cena onde o zoom acontece.
- inserts (opcional): frase = trecho exato da copy; origem "higgsfield" (gerar, com prompt), "banco" (já existe) ou "enviar" (o usuário tem o arquivo, ex.: logo, print).
- legendas: escolha estilo e palavras_por_legenda (3 a 5 para reels) com base nos dados e exemplos. tamanho_percent é o tamanho da letra em % do PADRÃO do estilo (100 = normal): use null (padrão) ou 80 a 120; nunca menos de 60. posicao: null (padrão do estilo), "base", "centro" ou "topo".
- musica: usar true na maioria dos anúncios; descreva o estilo; volume_percent 8 a 15 por baixo da narração.
- formato: o pedido pelo usuário ou 9:16.
- motivo de cada cena e aprendizados_aplicados: cite os dados que justificam (ex.: "versão X teve ROAS 4 com gancho de pergunta"). Não invente números.

CONVERSA
- Se faltar informação essencial (o que vender/oferta e objetivo) e não houver roteiro, faça até 3 perguntas curtas e devolva plano null.
- Caso contrário, devolva o PLANO COMPLETO e, na mensagem, explique em poucas linhas as decisões principais e faça no máximo 2 perguntas de refinamento (opcionais).
- Quando o usuário pedir mudanças, devolva o plano completo atualizado.
- mensagem: texto simples, curto, sem markdown pesado.`;

// ---------- Contexto ----------

type ImagemEntrada = { titulo: string; dataUrl: string };

// Imagem de referência reduzida (jpg 512 px) para a IA ver.
const imagemParaIA = async (url: string): Promise<string | null> => {
  const temporaria = await mkdtemp(path.join(os.tmpdir(), "encditor-ref-"));
  try {
    const [quadro] = await extrairQuadros(
      caminhoDoArquivo(nomeDaUrl(url)),
      temporaria,
      null,
    );
    if (!quadro) return null;
    return `data:image/jpeg;base64,${(await readFile(quadro.caminho)).toString("base64")}`;
  } catch {
    return null;
  } finally {
    await rm(temporaria, { recursive: true, force: true });
  }
};

const analiseDe = async (
  url: string,
  formato: "video" | "imagem",
  duracao: number | null,
): Promise<Analise | null> => {
  try {
    const nome = nomeDaUrl(url);
    const salva = analiseSchema.safeParse(await lerAnaliseSalva(nome));
    if (salva.success && salva.data.status === "pronta") return salva.data;
    return await analisarArquivo(nome, formato, duracao);
  } catch {
    return null;
  }
};

const descreverAnalise = (a: Analise | null) => {
  if (!a) return "(sem análise)";
  const visual = a.visual
    ? `${a.visual.resumo} Momentos: ${a.visual.momentos
        .map(
          (m) =>
            `${m.de}-${m.ate}s ${m.descricao}${m.texto_na_tela ? ` [texto: ${m.texto_na_tela}]` : ""}`,
        )
        .join("; ")}`
    : "";
  const fala = a.transcricao?.texto
    ? `Fala: “${curto(a.transcricao.texto, 400)}”`
    : "";
  return (
    [visual, fala].filter(Boolean).join(" | ") || "(sem conteúdo analisado)"
  );
};

const montarContexto = async (projetoId: string, plano: PlanoSalvo) => {
  const projeto = lerProjeto(projetoId);
  if (!projeto) throw new Error("Projeto não encontrado.");
  const clienteId = projeto.cliente.id;
  const midias = (lerMidiasDoCliente(clienteId) as Midia[]).filter((m) =>
    m.url.startsWith("/api/midia/"),
  );
  const versoes = versoesDoCliente(clienteId, midias);
  const aprendizados = await obterAprendizados(clienteId).catch(() => null);
  const elementos = listarElementos(clienteId);
  const b = plano.briefing;
  const usados = elementos.filter((e) => b.elementos.includes(e.id));
  const imagens: ImagemEntrada[] = [];

  // Elementos escolhidos (com imagem de referência).
  for (const e of usados) {
    if (!e.imagem) continue;
    const dataUrl = await imagemParaIA(`/api/midia/${e.imagem}`);
    if (dataUrl) imagens.push({ titulo: `Elemento @${e.nome}`, dataUrl });
  }

  // Exemplos (analisados; imagens também vão para a IA ver).
  const exemplos: string[] = [];
  for (const [i, x] of b.exemplos.entries()) {
    const analise = await analiseDe(x.url, x.formato, x.duracao);
    exemplos.push(
      `Exemplo ${i + 1} (${x.formato}${x.duracao ? `, ${r1(x.duracao)}s` : ""}) — finalidade: ${FINALIDADES_EXEMPLO[x.finalidade]}. O usuário quer copiar: ${x.detalhe.trim() || "(NÃO DISSE — pergunte)"}. Conteúdo: ${descreverAnalise(analise)}`,
    );
    if (x.formato === "imagem") {
      const dataUrl = await imagemParaIA(x.url);
      if (dataUrl) imagens.push({ titulo: `Exemplo ${i + 1}`, dataUrl });
    }
  }

  // Uso de cada arquivo do banco nas versões (e como elas foram).
  const usoPorUrl = new Map<string, string[]>();
  for (const v of versoes) {
    for (const url of new Set(v.usou)) {
      const lista = usoPorUrl.get(url) ?? [];
      lista.push(
        v.resultado
          ? `"${v.nome}" ${v.resultado.avaliacao}${v.resultado.metricas.roas !== null ? ` ROAS ${v.resultado.metricas.roas}` : ""}`
          : `"${v.nome}" sem resultado`,
      );
      usoPorUrl.set(url, lista);
    }
  }
  const banco = midias
    .filter((m) => m.formato !== "audio")
    .map((m) => {
      const uso = usoPorUrl.get(m.url);
      return `- @${m.apelido} (${m.papel}, ${m.formato}${m.duracao ? `, ${r1(m.duracao)}s` : ""}): ${descreverAnalise(m.analise ?? null)}${uso ? ` | usado em: ${uso.join(", ")}` : ""}`;
    });

  const secoes = [
    `CLIENTE: ${projeto.cliente.nome}. PROJETO: ${projeto.nome}.`,
    "== BRIEFING ==",
    `Roteiro do usuário: ${b.roteiro.trim() || "(nenhum — criar do zero)"}`,
    `Objetivo/produto/oferta: ${b.objetivo.trim() || "(não informado)"}`,
    `Formato: ${b.formato ?? "(não definido; padrão 9:16)"}. Duração desejada: ${b.duracaoAlvo ? `${b.duracaoAlvo}s` : "(livre; anúncios costumam ter 15 a 35 s)"}.`,
    `Cenas obrigatórias: ${b.obrigatorias.length ? b.obrigatorias.map((o, i) => `${i + 1}) ${o}`).join(" ") : "(nenhuma)"}`,
    b.observacoes.trim() ? `Observações: ${b.observacoes}` : "",
    "== ELEMENTOS DO HIGGSFIELD PARA USAR (cite exatamente com @nome) ==",
    usados.length
      ? usados.map((e) => `- @${e.nome}: ${e.descricao}`).join("\n")
      : "(nenhum escolhido)",
    elementos.length > usados.length
      ? `Outros elementos salvos (só use se o usuário pedir): ${elementos
          .filter((e) => !usados.includes(e))
          .map((e) => `@${e.nome}`)
          .join(", ")}`
      : "",
    "== EXEMPLOS ==",
    exemplos.length ? exemplos.join("\n") : "(nenhum)",
    "== APRENDIZADOS DO CLIENTE ==",
    aprendizados
      ? [
          `Resumo: ${aprendizados.resumo}`,
          `Funciona: ${aprendizados.o_que_funciona.join("; ") || "-"}`,
          `Não funciona: ${aprendizados.o_que_nao_funciona.join("; ") || "-"}`,
          `Problemas visuais a evitar: ${aprendizados.problemas_visuais_a_evitar.join("; ") || "-"}`,
        ].join("\n")
      : "(ainda não há resultados registrados)",
    "== VERSÕES EXPORTADAS (melhores primeiro) ==",
    versoes.length
      ? versoes
          .slice(0, 25)
          .map(
            (v) =>
              `- "${v.nome}" (projeto ${v.projeto}, ${r1(v.duracao)}s): ${
                v.resultado
                  ? `${v.resultado.avaliacao.toUpperCase()}; ${metricasEmTexto(v.resultado)}${v.resultado.nota ? `; anotação: ${v.resultado.nota}` : ""}${v.resultado.opiniaoVisual ? `; visual: ${v.resultado.opiniaoVisual}` : ""}`
                  : "sem resultado registrado"
              } | ${curto(v.edicao, 700)}`,
          )
          .join("\n")
      : "(nenhuma ainda)",
    "== BANCO DE MÍDIA DO CLIENTE (pode reaproveitar) ==",
    banco.length ? banco.slice(0, 150).join("\n") : "(vazio)",
  ];
  return {
    texto: secoes.filter(Boolean).join("\n"),
    imagens,
    elementos,
    midias,
  };
};

// ---------- Ajustes no plano devolvido ----------

const limitar = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));

const ajustarPlano = (
  g: PlanoGerado,
  elementos: Elemento[],
  midias: Midia[],
): PlanoGerado => {
  const usados = new Set<string>();
  const apelido = (bruto: string, padrao: string) => {
    let base = normalizarApelido(bruto) || padrao;
    if (base === "") base = padrao;
    let nome = base;
    let n = 2;
    while (usados.has(nome)) nome = `${base}${n++}`;
    usados.add(nome);
    return nome;
  };
  const existeNoBanco = (a: string | null) =>
    !!a &&
    midias.some((m) => normalizarApelido(m.apelido) === normalizarApelido(a));
  return {
    ...g,
    duracao_total_s: limitar(g.duracao_total_s, 1, 600),
    cenas: g.cenas.map((c, i) => {
      const doBanco = c.origem === "banco" && existeNoBanco(c.apelido_banco);
      return {
        ...c,
        numero: i + 1,
        apelido: apelido(c.apelido, `take${String(i + 1).padStart(2, "0")}`),
        origem: doBanco ? "banco" : "higgsfield",
        apelido_banco: doBanco ? c.apelido_banco!.replace(/^@/, "") : null,
        duracao_s: limitar(c.duracao_s, 0.5, 30),
        duracao_gerar_s:
          c.duracao_gerar_s === null ? null : limitar(c.duracao_gerar_s, 1, 30),
        elementos: c.elementos.map((e) => e.replace(/^@/, "")),
        transicao_entrada:
          i === 0 || !c.transicao_entrada
            ? null
            : {
                ...c.transicao_entrada,
                duracao_s: limitar(c.transicao_entrada.duracao_s, 0.1, 1.5),
              },
        zoom: c.zoom
          ? {
              ...c.zoom,
              escala: limitar(c.zoom.escala, 1.05, 2.5),
              rampa_s: limitar(c.zoom.rampa_s, 0.15, 3),
            }
          : null,
      };
    }),
    inserts: g.inserts.map((x, i) => {
      const doBanco = x.origem === "banco" && existeNoBanco(x.apelido_banco);
      return {
        ...x,
        apelido: apelido(x.apelido, `insert${String(i + 1).padStart(2, "0")}`),
        origem: doBanco
          ? "banco"
          : x.origem === "banco"
            ? "higgsfield"
            : x.origem,
        apelido_banco: doBanco ? x.apelido_banco!.replace(/^@/, "") : null,
        duracao_s: limitar(x.duracao_s, 0.5, 15),
      };
    }),
    narracao: g.narracao
      ? { ...g.narracao, apelido: apelido(g.narracao.apelido, "narracao") }
      : g.modo_audio === "narracao"
        ? { apelido: apelido("narracao", "narracao"), orientacoes: "" }
        : null,
    legendas: {
      ...g.legendas,
      palavras_por_legenda: limitar(
        Math.round(g.legendas.palavras_por_legenda),
        1,
        15,
      ),
      tamanho_percent:
        g.legendas.tamanho_percent === null
          ? null
          : limitar(g.legendas.tamanho_percent, 60, 200),
    },
    musica: {
      ...g.musica,
      apelido: apelido(g.musica.apelido || "musica", "musica"),
      volume_percent: limitar(g.musica.volume_percent, 1, 100),
    },
  };
};

// ---------- Conversa ----------

const LIMITE_CONVERSA = 16;

export const conversarComPlanejador = async (
  projetoId: string,
  mensagem: string,
) => {
  const plano = lerPlanoSalvo(lerPlano(projetoId));
  const contexto = await montarContexto(projetoId, plano);

  const conteudo: OpenAI.Responses.ResponseInputContent[] = [
    { type: "input_text", text: contexto.texto },
    ...contexto.imagens.flatMap((img) => [
      { type: "input_text" as const, text: `${img.titulo}:` },
      {
        type: "input_image" as const,
        image_url: img.dataUrl,
        detail: "low" as const,
      },
    ]),
  ];
  if (plano.gerado) {
    conteudo.push({
      type: "input_text",
      text: `PLANO ATUAL (atualize a partir dele):\n${JSON.stringify(plano.gerado)}`,
    });
  }

  const historico: OpenAI.Responses.ResponseInput = plano.conversa
    .slice(-LIMITE_CONVERSA)
    .map((m) => ({
      role: m.autor === "usuario" ? ("user" as const) : ("assistant" as const),
      content: m.texto,
    }));
  while (
    historico[0] &&
    "role" in historico[0] &&
    historico[0].role === "assistant"
  ) {
    historico.shift();
  }

  const resposta = await comNovaTentativa(() =>
    clienteOpenAI().responses.create({
      model: MODELOS.editor,
      instructions: INSTRUCOES,
      input: [
        { role: "user", content: conteudo },
        {
          role: "assistant",
          content:
            "Entendido. Tenho o briefing, os dados e o banco do cliente.",
        },
        ...historico,
        { role: "user", content: mensagem },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "plano_do_video",
          strict: true,
          schema: esquemaEstrito(respostaPlanejadorSchema),
        },
      },
    }),
  );
  console.log(
    `[ia] planejador ${MODELOS.editor}: ${resposta.usage?.input_tokens ?? 0} tokens de entrada, ${resposta.usage?.output_tokens ?? 0} de saída`,
  );
  const dados = respostaPlanejadorSchema.parse(
    JSON.parse(resposta.output_text),
  );

  const agora = Date.now();
  const novo: PlanoSalvo = {
    ...plano,
    conversa: [
      ...plano.conversa,
      { autor: "usuario", texto: mensagem, em: agora },
      { autor: "ia", texto: dados.mensagem, em: agora },
    ],
    ...(dados.plano
      ? {
          gerado: ajustarPlano(
            dados.plano,
            contexto.elementos,
            contexto.midias,
          ),
          geradoEm: agora,
          // Plano novo: precisa montar de novo (os arquivos já ligados ficam).
          montadoEm: null,
        }
      : {}),
  };
  salvarPlano(projetoId, novo);
  return novo;
};
