import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { editarComClaude, mensagemDeErroClaude } from "@/ia/claude";
import { resumoDoProjeto } from "@/ia/estado";
import { criarFerramentas, SessaoEdicao } from "@/ia/ferramentas";
import { editarComOpenAI } from "@/ia/openai";
import { analiseSchema } from "@/projeto/analise";
import { mensagemDeErroOpenAI, openaiConfigurada } from "@/servidor/openai";
import { Midia } from "@/projeto/tipos";
import { timelineSchema } from "@/timeline/schema";
import { chaveCena, chaveInsert } from "@/plano/pendencias";
import { FINALIDADES_EXEMPLO, lerPlanoSalvo } from "@/plano/tipos";
import {
  lerDirecaoDoCliente,
  lerMidiasDoCliente,
  lerPlano,
  lerProjeto,
  totalDoProjeto,
} from "@/servidor/banco";
import { enderecoInterno } from "@/servidor/endereco";
import {
  Achado,
  conferirVideo,
  quadrosDosAchados,
} from "@/servidor/conferirVideo";
import {
  atualizarTrabalhoIA,
  iniciarTrabalhoIA,
  lerTrabalhoIA,
} from "@/servidor/trabalhosIA";
import { comCusto, custoDoPedido } from "@/servidor/custos";
import { reais } from "@/projeto/dinheiro";
import { cotacaoDoDia } from "@/servidor/cotacao";
import { listaDePadroes } from "@/ia/padroes";
import {
  ehEdicaoGrande,
  focoDaEdicao,
  momentosParaMedir,
} from "@/ia/conferencia";
import {
  criarProgresso,
  Progresso,
  rotuloDaFerramenta,
  semProgresso,
  textoEscrevendo,
} from "@/ia/progresso";

// Resumo do plano para o editor: copy e o que cada cena deveria ser.
const resumoDoPlano = (projetoId: string, biblioteca: Midia[]) => {
  const plano = lerPlanoSalvo(lerPlano(projetoId));
  const g = plano.gerado;
  if (!g) return null;
  // Apelido real do arquivo ligado a cada item (pode ter ganhado sufixo).
  const apelidoDe = (chave: string, planejado: string) =>
    `@${biblioteca.find((m) => m.id === plano.vinculos[chave])?.apelido ?? planejado}`;
  return JSON.stringify({
    titulo: g.titulo,
    modo_audio: g.modo_audio,
    copy: g.copy,
    cenas: g.cenas.map((c) => ({
      cena: c.numero,
      take:
        c.origem === "banco"
          ? `@${c.apelido_banco}`
          : apelidoDe(chaveCena(c), c.apelido),
      fala: c.fala,
      descricao: c.descricao,
      no_enceditor: c.feito_no_enceditor,
      som: c.som_do_take,
      volume_do_som: c.volume_do_take,
    })),
    inserts: g.inserts.map((x) => ({
      insert: x.apelido_banco
        ? `@${x.apelido_banco}`
        : apelidoDe(chaveInsert(x), x.apelido),
      frase: x.frase,
      posicao: x.posicao,
    })),
    legendas: g.legendas,
  });
};

// Recebe um pedido do chat, deixa a IA editar a timeline com as
// ferramentas e devolve a timeline nova + a resposta em texto.
// Usa a OpenAI (GPT) se houver OPENAI_API_KEY; senão, o Claude.

const LIMITE_HISTORICO = 12;

const corpoSchema = z.object({
  pedido: z.string(),
  // Nomes das mídias anexadas nesta mensagem ("esse insert").
  anexos: z.array(z.string()),
  historico: z.array(
    z.object({ autor: z.enum(["usuario", "ia"]), texto: z.string() }),
  ),
  timeline: timelineSchema,
  projetoId: z.string().optional(),
  biblioteca: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      papel: z.enum(["cena", "insert", "audio"]),
      formato: z.enum(["video", "imagem", "audio"]),
      url: z.string(),
      nomeArquivo: z.string(),
      apelido: z.string().default(""),
      usarIA: z.boolean().default(true),
      efeitosAudio: z.array(z.string()).optional(),
      urlOriginal: z.string().optional(),
      duracao: z.number().nullable(),
      largura: z.number().nullable(),
      altura: z.number().nullable(),
      analise: analiseSchema.optional(),
      // Baixado da web (buscar_na_web): para não baixar de novo.
      fonte: z
        .object({
          site: z.string(),
          pagina: z.string(),
          licenca: z.string(),
          autor: z.string().optional(),
          consulta: z.string(),
        })
        .optional(),
    }),
  ),
});

export type RespostaIA = {
  resposta: string;
  // Arquivos alterados pela IA (ex.: efeitos de áudio aplicados).
  midiasAlteradas?: Midia[];
  // Arquivos criados pela IA (ex.: logo baixada da web).
  midiasNovas?: Midia[];
  // Inserts que o usuário deve posicionar no popup.
  insertsParaPosicionar?: number[];
  timeline: z.infer<typeof timelineSchema> | null;
  acoes: string[];
};

const erro = (mensagem: string, status: number) =>
  NextResponse.json({ erro: mensagem }, { status });

// Resposta "OK" da revisão = nada a corrigir.
const ehOk = (texto: string) => /^\s*ok[.!]?\s*$/i.test(texto);

const mensagemDaConferencia = (problemas: string[], estado: string) =>
  `CONFERÊNCIA da sua edição, antes de entregar ao usuário. Ela MEDIU a posição de cada texto e desenho nos quadros de verdade (não é estimativa), aplicou as regras e um revisor independente olhou as imagens. Os quadros dos momentos com problema vão junto. Pontos encontrados:
${problemas.map((p) => `- ${p}`).join("\n")}

Corrija com as ferramentas TODOS os pontos (o estado atual está abaixo; use os números dos itens). Sobreposição medida é erro de verdade: mude posição (topo/centro/base ou x/y), tamanho ou tempos até não encostar. Corrigir não é apagar: prefira mover, encolher ou encurtar; se tirar um grafismo, ponha outro no lugar. Faça as correções numa chamada só com varias_edicoes. Só deixe como está o que o usuário pediu explicitamente. Depois a conferência roda de novo e o usuário vê o que sobrou. Responda com o resumo FINAL e completo do que foi feito no pedido (incluindo as correções). Se não mudar nada, responda exatamente: OK.

Estado atual do projeto:
${estado}`;

// A nota do fim da resposta: o que foi conferido e, sem esconder, o que
// ainda ficou errado depois das correções.
const notaDaConferencia = ({
  medidos,
  olhados,
  achadosNoInicio,
  corrigiu,
  sobraram,
}: {
  medidos: number;
  olhados: number;
  achadosNoInicio: number;
  corrigiu: boolean;
  sobraram: Achado[];
}) => {
  const como = [
    medidos
      ? `medi a posição de cada texto em ${medidos} quadro(s)`
      : "conferi as regras",
    olhados ? `um revisor olhou ${olhados} quadro(s)` : "",
  ]
    .filter(Boolean)
    .join(" e ");
  if (!achadosNoInicio) return { ok: true, texto: `${como}: nenhum problema` };
  if (!sobraram.length) {
    return {
      ok: true,
      texto: `${como}: achei ${achadosNoInicio} ponto(s), corrigi e conferi de novo — resolvido`,
    };
  }
  const lista = sobraram.slice(0, 4).map((a) => a.curto).join("; ");
  const mais = sobraram.length > 4 ? ` (e mais ${sobraram.length - 4})` : "";
  return {
    ok: false,
    texto: `${como}: achei ${achadosNoInicio} ponto(s)${corrigiu ? " e corrigi parte" : ""}, mas AINDA FICOU: ${lista}${mais}`,
  };
};

export async function POST(req: NextRequest) {
  const usarOpenAI = openaiConfigurada();
  if (!usarOpenAI && !process.env.ANTHROPIC_API_KEY) {
    return erro(
      "A IA ainda não está configurada: falta a chave OPENAI_API_KEY no arquivo .env.local (veja o README).",
      503,
    );
  }

  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return erro("Pedido inválido.", 400);
  }
  const { pedido, anexos, historico, timeline, biblioteca, projetoId } =
    corpo.data;
  // Banco inteiro do cliente: a IA pode reaproveitar arquivos de outros
  // vídeos dele (o app manda só os deste projeto).
  const clienteId = projetoId ? lerProjeto(projetoId)?.cliente.id : null;
  const banco = clienteId
    ? (lerMidiasDoCliente(clienteId) as Midia[])
    : undefined;
  const plano = projetoId
    ? resumoDoPlano(projetoId, banco ?? (biblioteca as Midia[]))
    : null;

  // O que o usuário pediu de estilo no Planejar (ideia, observações,
  // exemplos e o que copiar de cada um) e a direção de arte salva do
  // cliente: a IA segue isso antes de decidir sozinha.
  const briefing = projetoId
    ? lerPlanoSalvo(lerPlano(projetoId)).briefing
    : null;
  const exemplosDoPlano = (briefing?.exemplos ?? []).map((x) => ({
    url: x.url,
    formato: x.formato,
    duracao: x.duracao,
    finalidade: FINALIDADES_EXEMPLO[x.finalidade],
    detalhe: x.detalhe,
  }));
  const pedidosDoPlano = briefing
    ? [
        briefing.ideia.trim() ? `Ideia: ${briefing.ideia.trim()}` : "",
        briefing.objetivo.trim() ? `Objetivo: ${briefing.objetivo.trim()}` : "",
        briefing.observacoes.trim()
          ? `Observações: ${briefing.observacoes.trim()}`
          : "",
        ...exemplosDoPlano.map(
          (x, i) =>
            `Exemplo ${i + 1} (${x.formato}; finalidade: ${x.finalidade}): copiar "${x.detalhe || "não disse"}" — use estudar_exemplo com exemplo_do_plano ${i + 1}.`,
        ),
      ].filter(Boolean)
    : [];
  const direcaoDoCliente = clienteId ? lerDirecaoDoCliente(clienteId) : null;

  const sessao: SessaoEdicao = {
    timeline,
    biblioteca,
    banco,
    acoes: [],
    clienteId: clienteId ?? undefined,
    exemplosDoPlano,
    projetoId,
  };

  // Histórico só em texto; a conversa precisa começar pelo usuário.
  const anteriores = historico
    .filter((m) => m.texto.trim())
    .slice(-LIMITE_HISTORICO);
  while (anteriores[0]?.autor === "ia") anteriores.shift();
  const historicoIA = anteriores.map((m) => ({
    papel: m.autor === "usuario" ? ("user" as const) : ("assistant" as const),
    texto: m.texto,
  }));

  const pedidoCompleto = [
    "Estado atual do projeto:",
    JSON.stringify(resumoDoProjeto(timeline, biblioteca)),
    plano
      ? `Plano do vídeo (feito na aba Planejar; siga o que foi imaginado quando o pedido for vago):
${plano}`
      : "",
    pedidosDoPlano.length
      ? `PEDIDOS DE ESTILO DO USUÁRIO NO PLANEJAR (siga à risca, nos detalhes):
${pedidosDoPlano.join("\n")}`
      : "",
    direcaoDoCliente
      ? `Direção de arte salva do cliente (a identidade dele; mantenha salvo pedido diferente): ${JSON.stringify(direcaoDoCliente)}`
      : "",
    `PADRÕES DE ANIMAÇÃO (usar_padrao; ver_padrao mostra as camadas):
${listaDePadroes(clienteId)}`,
    anexos.length ? `Anexados nesta mensagem: ${anexos.join(", ")}.` : "",
    `Pedido: ${pedido}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  // O pedido inteiro: editar → conferir (regras) → olhar quadros (pedidos
  // grandes) → corrigir. "progresso" alimenta a barra do chat.
  const executar = async (progresso: Progresso): Promise<RespostaIA> => {
    progresso.fase(1, 4, "Lendo o projeto…");
    const ferramentas = criarFerramentas(sessao).map((f) => ({
      ...f,
      run: (entrada: unknown) => {
        progresso.passo(`${rotuloDaFerramenta(f.name, entrada)}…`);
        return f.run(entrada);
      },
    }));
    // "pensando" = o texto da barra enquanto a IA pensa: [na 1ª etapa, nas
    // seguintes]. Enquanto ela escreve o pedido de uma ferramenta, a barra
    // diz o que está sendo escrito (só quando o texto muda).
    let ultimoEscrevendo = "";
    const rodar = (
      texto: string,
      historicoAtual: typeof historicoIA,
      pensando: [string, string],
      imagens?: { legenda: string; base64: string }[],
    ) =>
      (usarOpenAI ? editarComOpenAI : editarComClaude)({
        ferramentas,
        historico: historicoAtual,
        pedido: texto,
        imagens,
        aoPensar: (etapa) => progresso.passo(pensando[etapa === 0 ? 0 : 1]),
        aoEscrever: (nome, argumentos) => {
          const agora = textoEscrevendo(nome, argumentos);
          if (agora !== ultimoEscrevendo) progresso.detalhe(agora);
          ultimoEscrevendo = agora;
        },
      });
    const estado = () =>
      JSON.stringify(resumoDoProjeto(sessao.timeline, sessao.biblioteca));
    // O que o revisor independente precisa saber (sem o histórico da
    // edição): o formato, o que o usuário pediu e a direção do vídeo.
    const contextoDoRevisor = () =>
      [
        `Formato do vídeo: ${sessao.timeline.largura}×${sessao.timeline.altura} (${sessao.timeline.largura > sessao.timeline.altura ? "deitado" : "em pé"}).`,
        ...historicoIA
          .filter((m) => m.papel === "user")
          .slice(-3)
          .map((m) => `Pedido anterior do usuário: ${m.texto.slice(0, 500)}`),
        `Pedido atual do usuário: ${pedido}`,
        sessao.timeline.direcaoDeArte
          ? `Direção de arte: ${JSON.stringify(sessao.timeline.direcaoDeArte)}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
    sessao.conferencia = {
      origem: enderecoInterno(req),
      contexto: contextoDoRevisor,
      aviso: (texto) => progresso.detalhe(texto),
    };

    progresso.fase(4, 60, "Entendendo o pedido…");
    const primeira = await rodar(pedidoCompleto, historicoIA, [
      "Entendendo o pedido…",
      "Pensando no próximo passo…",
    ]);
    let resposta = primeira;
    const notas: string[] = [];
    let conferenciaOk = true;

    if (sessao.acoes.length) {
      const conversa = [
        ...historicoIA,
        { papel: "user" as const, texto: pedido },
        { papel: "assistant" as const, texto: primeira },
      ];

      // Conferência antes de entregar: regras + a posição MEDIDA de cada
      // texto nos quadros de verdade + (pedidos grandes) um revisor
      // independente olhando as imagens. O que ela achar, a IA corrige e a
      // conferência roda de novo (até 2 rodadas). A nota final diz a
      // verdade: o que foi conferido e o que ainda ficou.
      const grande = ehEdicaoGrande(timeline, sessao.timeline);
      const conferir = (olharSo?: number[]) =>
        conferirVideo({
          antes: timeline,
          depois: sessao.timeline,
          biblioteca: sessao.biblioteca,
          origem: enderecoInterno(req),
          olhar: grande,
          olharSo,
          contexto: contextoDoRevisor(),
          aviso: (texto) => progresso.detalhe(texto),
        });
      progresso.fase(60, 74, "Conferindo a edição quadro a quadro…");
      // Se a IA já rodou conferir_video (com o revisor) neste pedido, o
      // revisor da conferência final só olha o que mudou depois disso.
      const ultima = sessao.conferencia?.ultima;
      let conferencia = await conferir(
        ultima
          ? momentosParaMedir(sessao.timeline, focoDaEdicao(ultima, sessao.timeline))
          : undefined,
      );
      const achadosNoInicio = conferencia.achados.length;
      const { medidos, olhados } = conferencia;
      let corrigiu = false;
      for (let rodada = 0; rodada < 2 && conferencia.achados.length; rodada++) {
        const n = conferencia.achados.length;
        progresso.fase(
          74 + rodada * 12,
          80 + rodada * 12,
          `A conferência achou ${n} ponto(s) — corrigindo…`,
        );
        const acoesAntes = sessao.acoes.length;
        const r = await rodar(
          mensagemDaConferencia(
            conferencia.achados.map((a) => a.texto),
            estado(),
          ),
          conversa,
          [
            `Corrigindo o que a conferência achou (${n} ponto(s))…`,
            "Corrigindo…",
          ],
          quadrosDosAchados(conferencia, sessao.timeline, sessao.biblioteca),
        );
        conversa.push(
          { papel: "user", texto: "(conferência da edição)" },
          { papel: "assistant", texto: r },
        );
        // A IA não mudou nada (achou que é de propósito): fica como está.
        if (sessao.acoes.length === acoesAntes) break;
        corrigiu = true;
        if (!ehOk(r)) resposta = r;
        progresso.fase(
          80 + rodada * 12,
          86 + rodada * 12,
          "Conferindo de novo o que foi corrigido…",
        );
        // De novo: as posições de tudo o que mudou e, onde o revisor tinha
        // visto problema, ele olha outra vez.
        conferencia = await conferir(
          conferencia.achados
            .filter((a) => a.origem === "revisor" && a.segundo !== null)
            .map((a) => a.segundo as number),
        );
      }
      const nota = notaDaConferencia({
        medidos,
        olhados,
        achadosNoInicio,
        corrigiu,
        sobraram: conferencia.achados,
      });
      notas.push(nota.texto);
      conferenciaOk = nota.ok;
    }

    progresso.em(98, "Finalizando…");
    const texto =
      resposta ||
      (sessao.acoes.length
        ? "Pronto."
        : "Não entendi o que mudar. Pode detalhar?");
    // Quanto este pedido custou (todas as chamadas à IA dele) e o vídeo
    // inteiro até agora.
    const gasto = custoDoPedido();
    const cotacao = gasto ? await cotacaoDoDia() : null;
    const custo = gasto
      ? `💲 Este pedido: ${reais(gasto, cotacao)}${projetoId ? ` · o vídeo até agora: ${reais(totalDoProjeto(projetoId), cotacao)}` : ""}${cotacao ? " (dólar de hoje + IOF)" : ""}.`
      : "";
    return {
      resposta: [
        texto,
        notas.length
          ? `${conferenciaOk ? "✓" : "⚠"} Conferência: ${notas.join("; ")}.`
          : "",
        custo,
      ]
        .filter(Boolean)
        .join("\n\n"),
      timeline: sessao.acoes.length ? sessao.timeline : null,
      acoes: sessao.acoes,
      midiasAlteradas: sessao.midiasAlteradas,
      midiasNovas: sessao.midiasNovas,
      insertsParaPosicionar: sessao.insertsParaPosicionar,
    };
  };

  const mensagemDeErro = (e: unknown) =>
    usarOpenAI ? mensagemDeErroOpenAI(e) : mensagemDeErroClaude(e);

  // O custo de cada chamada à IA deste pedido fica no projeto.
  const contextoDeCusto = {
    projetoId: projetoId ?? null,
    clienteId: clienteId ?? null,
    tipo: "chat",
    descricao: pedido.slice(0, 120),
  };

  // Sem streaming (scripts de teste): espera tudo e devolve JSON.
  if (!req.headers.get("accept")?.includes("application/x-ndjson")) {
    try {
      return NextResponse.json<RespostaIA>(
        await comCusto(contextoDeCusto, () => executar(semProgresso)),
      );
    } catch (e) {
      const conhecido = mensagemDeErro(e);
      if (conhecido) return erro(conhecido.erro, conhecido.status);
      throw e;
    }
  }

  // Com streaming (o chat): uma linha JSON por evento — o trabalho, o
  // progresso enquanto a IA trabalha e, no fim, a resposta (ou o erro).
  // O pedido também fica guardado no servidor (trabalhosIA): se a pessoa
  // trocar de tela/projeto ou recarregar, o chat retoma e aplica depois.
  const emAndamento = projetoId ? lerTrabalhoIA(projetoId) : null;
  if (emAndamento?.estado === "rodando") {
    return erro(
      "A IA ainda está trabalhando no pedido anterior deste projeto. Espere terminar.",
      409,
    );
  }
  const trabalho = projetoId ? iniciarTrabalhoIA(projetoId) : null;
  const codificador = new TextEncoder();
  const fluxo = new ReadableStream({
    async start(controle) {
      let aberto = true;
      // Se a página fechou, o trabalho continua (só para de mandar).
      const enviar = (evento: object) => {
        if (!aberto) return;
        try {
          controle.enqueue(codificador.encode(`${JSON.stringify(evento)}\n`));
        } catch {
          aberto = false;
        }
      };
      if (trabalho) enviar({ tipo: "trabalho", id: trabalho.id });
      try {
        const resultado = await comCusto(contextoDeCusto, () => executar(
          criarProgresso((pct, texto) => {
            if (trabalho) atualizarTrabalhoIA(trabalho, { pct, texto });
            enviar({ tipo: "progresso", pct, texto });
          }),
        ));
        if (trabalho) {
          atualizarTrabalhoIA(trabalho, { estado: "pronto", pct: 100, resultado });
        }
        enviar({ tipo: "fim", ...resultado });
      } catch (e) {
        console.error("[ia] pedido falhou:", e);
        const mensagem =
          mensagemDeErro(e)?.erro ??
          (e instanceof Error ? e.message : String(e));
        if (trabalho) atualizarTrabalhoIA(trabalho, { estado: "erro", erro: mensagem });
        enviar({ tipo: "erro", erro: mensagem });
      } finally {
        if (aberto) {
          try {
            controle.close();
          } catch {
            // já fechado pelo navegador
          }
        }
      }
    },
  });
  return new Response(fluxo, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
