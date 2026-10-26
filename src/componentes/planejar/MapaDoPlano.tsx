"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { iniciarAnalise } from "@/componentes/AnaliseAutomatica";
import { FalaDoRoteiro, GravadorDeAudio } from "@/componentes/GravadorDeAudio";
import {
  ehGravacaoDoNavegador,
  enviarArquivo,
  extrairAudioDoVideo,
  formatoDoArquivo,
  gerarApelido,
  gravacaoParaMp3,
  lerDuracaoDaUrl,
  lerMetadados,
  podeAnalisar,
  proximoNome,
} from "@/projeto/midia-cliente";
import { novoId, useProjeto } from "@/projeto/ProjetoProvider";
import { Midia } from "@/projeto/tipos";
import { montarDoPlano } from "@/plano/montagem";
import {
  VERSAO_CONFERENCIA,
  verificarNarracao,
} from "@/plano/verificarNarracao";
import {
  ItemPlano,
  itensDoPlano,
  planoCompleto,
  StatusItem,
} from "@/plano/pendencias";
import { ConferenciaTake, VOLUMES_TAKE } from "@/plano/tipos";
import { UsoPlano } from "@/plano/usePlano";
import { ConferenciaNarracao } from "./ConferenciaNarracao";
import { GuiaDeGravacao } from "./GuiaDeGravacao";

// O plano gerado, como um mapa: cada take com o prompt do Higgsfield e o
// status (falta enviar / chegou), a narração e a música. Quando tudo
// chega, o encEditor monta a edição sozinho.

const STATUS: Record<StatusItem, { rotulo: string; cor: string }> = {
  pendente: { rotulo: "falta enviar", cor: "border-spray text-spray" },
  analisando: {
    rotulo: "transcrevendo…",
    cor: "border-zinc-500 text-zinc-400 animate-pulse",
  },
  pronto: { rotulo: "✓ pronto", cor: "border-verde text-verde" },
  pulado: { rotulo: "sem música", cor: "border-zinc-500 text-zinc-500" },
  "nao-achado": {
    rotulo: "não achei no banco",
    cor: "border-spray text-spray",
  },
};

const MODO_AUDIO = {
  narracao: "Narração em off + som dos takes por baixo",
  fala_nos_takes: "Fala nos próprios takes",
  so_musica: "Só música e sons",
} as const;

const Copiar: React.FC<{ texto: string }> = ({ texto }) => {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(texto).then(() => {
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        });
      }}
      className="shrink-0 border-2 border-tinta px-2 py-0.5 font-mono text-[10px] uppercase hover:bg-tinta hover:text-papel"
    >
      {ok ? "copiado!" : "copiar"}
    </button>
  );
};

// Envio de um arquivo para um item do plano (vira arquivo da biblioteca
// com o apelido do plano e fica ligado ao item).
const useEnviarItem = (uso: UsoPlano) => {
  const { obterBiblioteca, adicionarMidia, atualizarAnalise } = useProjeto();
  const [progresso, setProgresso] = useState<Record<string, number>>({});
  const [erro, setErro] = useState<string | null>(null);

  const enviar = async (item: ItemPlano, arquivo: File) => {
    setErro(null);
    let formato = formatoDoArquivo(arquivo);
    if (!formato) return setErro(`Formato não suportado: ${arquivo.name}`);
    const somenteAudio = item.tipo === "narracao" || item.tipo === "musica";
    if (somenteAudio && formato === "imagem") {
      return setErro("Envie um áudio (ou vídeo, que eu tiro o som).");
    }
    if (!somenteAudio && formato === "audio") {
      return setErro("Este item precisa de vídeo ou imagem.");
    }
    try {
      let meta = await lerMetadados(arquivo, formato);
      setProgresso((p) => ({ ...p, [item.chave]: 0 }));
      let url = await enviarArquivo(arquivo, (f) =>
        setProgresso((p) => ({ ...p, [item.chave]: f })),
      );
      if (ehGravacaoDoNavegador(arquivo)) {
        // Gravado no app (webm/ogg): vira mp3, com a duração certa.
        const mp3 = await gravacaoParaMp3(url);
        url = mp3.url;
        meta = { duracao: mp3.duracao ?? meta.duracao, largura: null, altura: null };
      } else if (somenteAudio && formato === "video") {
        url = await extrairAudioDoVideo(url, true);
        formato = "audio";
        meta = {
          duracao: (await lerDuracaoDaUrl(url)) ?? meta.duracao,
          largura: null,
          altura: null,
        };
      }
      const biblioteca = obterBiblioteca();
      const midia: Midia = {
        id: novoId(),
        nome: proximoNome(biblioteca, item.papel),
        apelido: gerarApelido(item.apelido, biblioteca),
        usarIA: item.usarIA,
        papel: item.papel,
        formato,
        url,
        nomeArquivo: arquivo.name,
        ...meta,
      };
      adicionarMidia(midia);
      if (podeAnalisar(midia)) iniciarAnalise(midia, atualizarAnalise);
      await ligar(item, midia.id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setProgresso((p) => {
        const resto = { ...p };
        delete resto[item.chave];
        return resto;
      });
    }
  };

  const ligar = (item: ItemPlano, midiaId: string | null) => {
    const vinculos = { ...(uso.plano?.vinculos ?? {}) };
    if (midiaId) vinculos[item.chave] = midiaId;
    else delete vinculos[item.chave];
    return uso.mudar({ vinculos, montadoEm: null });
  };

  return { enviar, ligar, progresso, erro };
};

const AcoesDoItem: React.FC<{
  item: ItemPlano;
  biblioteca: Midia[];
  envio: ReturnType<typeof useEnviarItem>;
  // Só na narração: as falas do plano para ler enquanto grava no app.
  roteiro?: FalaDoRoteiro[];
  dica?: string;
}> = ({ item, biblioteca, envio, roteiro, dica }) => {
  const input = useRef<HTMLInputElement>(null);
  const [gravador, setGravador] = useState(false);
  const progresso = envio.progresso[item.chave];
  const compativeis = biblioteca.filter((m) =>
    item.tipo === "narracao" || item.tipo === "musica"
      ? m.formato === "audio"
      : m.formato !== "audio",
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      {item.midia ? (
        <span className="font-mono text-[11px] text-zinc-400">
          arquivo: <b className="text-tinta">@{item.midia.apelido}</b>
        </span>
      ) : null}
      <button
        onClick={() => input.current?.click()}
        disabled={progresso !== undefined}
        className={
          item.midia
            ? "border-2 border-tinta px-2 py-1 font-mono text-[10px] uppercase hover:bg-tinta hover:text-papel"
            : "botao-spray !px-3 !py-1 !text-sm"
        }
      >
        {progresso !== undefined
          ? `Enviando ${Math.round(progresso * 100)}%`
          : item.midia
            ? "trocar"
            : `Enviar ${item.tipo === "narracao" ? "narração" : item.tipo === "musica" ? "música" : "take"}`}
      </button>
      {item.tipo === "narracao" ? (
        <button
          onClick={() => setGravador(true)}
          disabled={progresso !== undefined}
          className={
            item.midia
              ? "border-2 border-tinta px-2 py-1 font-mono text-[10px] uppercase hover:bg-tinta hover:text-papel"
              : "botao-spray !px-3 !py-1 !text-sm"
          }
          title="Gravar a narração aqui, lendo o roteiro na tela"
        >
          🎙 {item.midia ? "regravar" : "Gravar aqui"}
        </button>
      ) : null}
      {gravador ? (
        <GravadorDeAudio
          titulo="Gravar a narração"
          roteiro={roteiro}
          dica={dica}
          aoSalvar={(arquivo) => envio.enviar(item, arquivo)}
          aoFechar={() => setGravador(false)}
        />
      ) : null}
      <select
        value=""
        onChange={(e) => {
          if (e.target.value) void envio.ligar(item, e.target.value);
        }}
        className="max-w-48 border-2 border-zinc-700 bg-zinc-950 px-1 py-1 text-[11px]"
        title="Usar um arquivo que já está na biblioteca do cliente"
      >
        <option value="">ou usar da biblioteca…</option>
        {compativeis.map((m) => (
          <option key={m.id} value={m.id}>
            @{m.apelido} ({m.nome})
          </option>
        ))}
      </select>
      <input
        ref={input}
        type="file"
        accept={item.aceita}
        className="hidden"
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          e.target.value = "";
          if (arquivo) void envio.enviar(item, arquivo);
        }}
      />
    </div>
  );
};

// O que a IA achou do take enviado (informativo).
const OlhadaDoTake: React.FC<{
  conferencia: ConferenciaTake | null | undefined;
  olhando: boolean;
}> = ({ conferencia: c, olhando }) => {
  if (olhando) {
    return (
      <p className="animate-pulse text-xs text-zinc-500">
        👁 A IA está olhando o take…
      </p>
    );
  }
  if (!c) return null;
  return (
    <div
      className={`space-y-1 border-l-4 py-1 pl-2 text-xs ${
        c.confere ? "border-verde" : "border-amber-500"
      }`}
    >
      <p>
        <b className={c.confere ? "text-verde" : "text-amber-500"}>
          {c.confere ? "✓ Confere com a cena:" : "⚠ Atenção:"}
        </b>{" "}
        {c.resumo}
      </p>
      {c.observacoes.length ? (
        <ul className="list-disc pl-4 text-zinc-400">
          {c.observacoes.map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ul>
      ) : null}
      {c.prompt_sugerido ? (
        <div className="flex items-start gap-2 bg-zinc-900 p-2">
          <span className="shrink-0 text-zinc-500">
            Se quiser gerar de novo:
          </span>
          <code className="flex-1 font-mono text-[11px] whitespace-pre-wrap">
            {c.prompt_sugerido}
          </code>
          <Copiar texto={c.prompt_sugerido} />
        </div>
      ) : null}
    </div>
  );
};

const Chip: React.FC<{ status: StatusItem }> = ({ status }) => (
  <span
    className={`border-2 px-1.5 py-0.5 font-mono text-[10px] tracking-wider uppercase ${STATUS[status].cor}`}
  >
    {STATUS[status].rotulo}
  </span>
);

export const MapaDoPlano: React.FC<{ uso: UsoPlano }> = ({ uso }) => {
  const { plano, mudar } = uso;
  const {
    projeto,
    banco,
    aplicar,
    obterTimeline,
    obterBiblioteca,
    adicionarMensagem,
    atualizarAnalise,
  } = useProjeto();
  const envio = useEnviarItem(uso);
  const [montagem, setMontagem] = useState<{
    avisos: string[];
    erro: string | null;
  } | null>(null);
  const [verCopy, setVerCopy] = useState(false);
  const tentouAuto = useRef(false);

  // Banco inteiro: o plano pode reaproveitar clipes de outros vídeos.
  const biblioteca = banco;
  const itens = plano ? itensDoPlano(plano, biblioteca) : [];
  const completo = planoCompleto(itens);
  const g = plano?.gerado ?? null;
  const narracao = itens.find((i) => i.tipo === "narracao") ?? null;
  // A conferência vale para ESTA narração e ESTE plano.
  const verificada =
    !!plano?.narracaoVerificada &&
    !!narracao?.midia &&
    plano.narracaoVerificada.midiaId === narracao.midia.id &&
    plano.narracaoVerificada.doPlano === plano.geradoEm &&
    plano.narracaoVerificada.versao === VERSAO_CONFERENCIA;
  const conferida = useRef("");

  // Takes enviados e já analisados: a IA dá uma olhada (um por vez) para
  // dizer se batem com o que a cena pedia. Só informa; não trava nada.
  const olhados = useRef(new Set<string>());
  const proximoTake = itens.find(
    (i) =>
      i.tipo === "cena" &&
      !i.doBanco &&
      i.midia &&
      i.midia.analise?.status === "pronta" &&
      plano?.conferenciaTakes[i.chave]?.midiaId !== i.midia.id &&
      !olhados.current.has(`${i.chave}:${i.midia.id}`),
  );
  useEffect(() => {
    if (!proximoTake?.midia || uso.olhando) return;
    olhados.current.add(`${proximoTake.chave}:${proximoTake.midia.id}`);
    void uso.conferirTake(proximoTake.chave);
  }, [proximoTake, uso]);

  // Narração transcrita e ainda não conferida: confere e ajusta os tempos
  // das cenas (antes de gerar os takes).
  useEffect(() => {
    if (!plano?.gerado || narracao?.status !== "pronto" || !narracao.midia) {
      return;
    }
    if (verificada) return;
    const chave = `${narracao.midia.id}:${plano.geradoEm}`;
    if (conferida.current === chave) return;
    conferida.current = chave;
    try {
      const r = verificarNarracao(plano, narracao.midia);
      // A transcrição da narração passa a ter os nomes do roteiro
      // (Wella, Truss, Linnda…): as legendas saem certas.
      const t = narracao.midia.analise?.transcricao;
      if (t && narracao.midia.analise) {
        const palavras: typeof t.palavras = [];
        t.palavras.forEach((p, k) => {
          const certa = r.palavrasCorrigidas[k];
          if (certa === "" && palavras.length) {
            // Juntada à anterior ("em vigo" → "Invigo").
            palavras[palavras.length - 1].ate = p.ate;
          } else if (certa !== "") {
            palavras.push({ ...p, palavra: certa ?? p.palavra });
          }
        });
        const mudou = palavras.some(
          (p, k) => p.palavra !== t.palavras[k]?.palavra,
        );
        if (mudou || palavras.length !== t.palavras.length) {
          atualizarAnalise(narracao.midia.id, {
            ...narracao.midia.analise,
            transcricao: {
              ...t,
              palavras,
              texto: palavras.map((p) => p.palavra).join(" "),
            },
          });
        }
      }
      void mudar({
        gerado: r.gerado,
        narracaoVerificada: r.verificacao,
        montadoEm: null,
      });
    } catch {
      conferida.current = "";
    }
  }, [plano, narracao?.status, narracao?.midia, verificada, mudar]);

  const montar = () => {
    if (!plano || !g) return;
    try {
      const r = montarDoPlano(plano, obterBiblioteca(), obterTimeline());
      if (!aplicar(() => r.timeline)) return;
      void mudar({ montadoEm: Date.now() });
      setMontagem({ avisos: r.avisos, erro: null });
      adicionarMensagem({
        autor: "ia",
        texto: [
          `Montei a edição do plano “${g.titulo}”: ${r.timeline.clipes.length} cena(s), ${r.timeline.inserts.length} insert(s), ${r.timeline.legendas.length} legenda(s).`,
          ...r.avisos.map((a) => `⚠ ${a}`),
          "Confira no preview e peça os ajustes aqui no chat.",
        ].join("\n"),
        anexos: [],
      });
    } catch (e) {
      setMontagem({
        avisos: [],
        erro: e instanceof Error ? e.message : String(e),
      });
    }
  };

  // Tudo chegou e ainda não montou: monta sozinho (se a timeline estiver
  // vazia; senão, pergunta antes de substituir).
  useEffect(() => {
    if (!completo || !plano || plano.montadoEm || tentouAuto.current) return;
    if (obterTimeline().clipes.length > 0) return;
    tentouAuto.current = true;
    montar();
  }, [completo, plano?.montadoEm]);

  if (!plano || !g) {
    return (
      <div className="border-2 border-dashed border-zinc-700 p-6 text-center text-sm text-zinc-500">
        O plano aparece aqui: roteiro final, takes com o prompt do Higgsfield, o
        que vem do banco, narração e música. Preencha o briefing e converse com
        a IA ao lado.
      </div>
    );
  }

  const prontos = itens.filter(
    (i) => i.status === "pronto" || i.status === "pulado",
  ).length;
  const temEdicao = projeto.timeline.clipes.length > 0;

  return (
    <div className="space-y-5">
      <header className="cartao-zine space-y-2 p-4">
        <p className="rotulo-zine">Plano do vídeo</p>
        <h2 className="font-display text-3xl leading-none tracking-wide uppercase">
          {g.titulo}
        </h2>
        <p className="text-sm">{g.ideia}</p>
        <p className="font-mono text-[11px] tracking-wider text-zinc-500 uppercase">
          {g.formato} · ~{Math.round(g.duracao_total_s)}s · {g.cenas.length}{" "}
          cena(s) · {MODO_AUDIO[g.modo_audio]} · legendas{" "}
          {g.legendas.usar ? `#${g.legendas.estilo}` : "não"}
        </p>
        {g.aprendizados_aplicados.length ? (
          <details className="text-xs">
            <summary className="cursor-pointer text-zinc-400">
              Dados e aprendizados usados ({g.aprendizados_aplicados.length})
            </summary>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-zinc-400">
              {g.aprendizados_aplicados.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </details>
        ) : null}
        <div>
          <button
            onClick={() => setVerCopy(!verCopy)}
            className="font-mono text-[11px] uppercase text-spray hover:underline"
          >
            {verCopy ? "▴ esconder a copy" : "▾ ver a copy completa"}
          </button>
          {verCopy ? (
            <div className="mt-2 space-y-2">
              <div className="flex items-start gap-2 border-l-4 border-spray pl-3">
                <p className="flex-1 text-sm whitespace-pre-wrap">{g.copy}</p>
                <Copiar texto={g.copy} />
              </div>
              {g.melhorias_no_roteiro ? (
                <p className="text-xs text-zinc-400">
                  <b>O que mudei no roteiro:</b> {g.melhorias_no_roteiro}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <GuiaDeGravacao uso={uso} />

      {/* Passo 1: a narração vem ANTES dos takes (os tempos saem dela). */}
      <section className="space-y-3">
        <h3 className="rotulo-zine">
          {g.modo_audio === "narracao"
            ? "Passo 1 · Grave e envie a narração"
            : "Áudio"}
        </h3>
        {itens
          .filter((i) => i.tipo === "narracao" || i.tipo === "musica")
          .map((item) => (
            <article
              key={item.chave}
              className="space-y-2 border-2 border-tinta p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-bold">
                  {item.rotulo}
                </span>
                <span className="ml-auto">
                  <Chip status={item.status} />
                </span>
              </div>
              {item.tipo === "narracao" ? (
                <p className="text-xs text-zinc-400">
                  Grave a copy acima — aqui mesmo (🎙 Gravar aqui, com o
                  roteiro na tela) ou fora do app.{" "}
                  {g.narracao?.orientacoes
                    ? `Dica: ${g.narracao.orientacoes}`
                    : ""}{" "}
                  Pode mandar áudio ou vídeo (eu tiro o som). Os sons dos takes
                  entram por baixo da voz.
                </p>
              ) : (
                <p className="text-xs text-zinc-400">
                  {g.musica.descricao} · volume {g.musica.volume_percent}% por
                  baixo da narração.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <AcoesDoItem
                  item={item}
                  biblioteca={biblioteca}
                  envio={envio}
                  roteiro={
                    item.tipo === "narracao"
                      ? g.cenas
                          .filter((c) => c.fala.trim())
                          .map((c) => ({
                            fala: c.fala,
                            enfase: c.enfase,
                            pausa: c.pausa_depois_s,
                          }))
                      : undefined
                  }
                  dica={
                    item.tipo === "narracao" && g.narracao?.orientacoes
                      ? `Tom: ${g.narracao.orientacoes}`
                      : undefined
                  }
                />
                {item.tipo === "musica" && !item.midia ? (
                  <button
                    onClick={() =>
                      void mudar({
                        musicaPulada: !plano.musicaPulada,
                        montadoEm: null,
                      })
                    }
                    className="border-2 border-tinta px-2 py-1 font-mono text-[10px] uppercase hover:bg-tinta hover:text-papel"
                  >
                    {plano.musicaPulada ? "quero música" : "sem música"}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        {g.modo_audio === "narracao" ? (
          verificada ? (
            <ConferenciaNarracao
              verificacao={plano.narracaoVerificada!}
              cenas={g.cenas}
            />
          ) : narracao?.status === "analisando" ? (
            <p className="animate-pulse text-xs text-zinc-500">
              Transcrevendo a narração para conferir e ajustar os tempos das
              cenas…
            </p>
          ) : (
            <p className="text-xs text-zinc-500">
              Envie a narração antes de gerar os takes: eu confiro o que foi
              falado e ajusto a duração de cada cena (e o tempo no prompt do
              Higgsfield) à sua gravação — assim não sobra tela preta.
            </p>
          )
        ) : null}
      </section>

      {/* Situação: o que falta e montar. */}
      <div className="flex flex-wrap items-center gap-3 border-[3px] border-tinta p-3">
        <div className="min-w-40 flex-1">
          <p className="font-mono text-xs tracking-wider uppercase">
            {prontos} de {itens.length} prontos
          </p>
          <div className="mt-1 h-3 border-2 border-tinta">
            <div
              className="h-full bg-verde transition-[width]"
              style={{
                width: `${(prontos / Math.max(1, itens.length)) * 100}%`,
              }}
            />
          </div>
        </div>
        {plano.montadoEm ? (
          <span className="font-mono text-xs text-verde uppercase">
            ✓ edição montada
          </span>
        ) : null}
        <button
          onClick={() => {
            if (
              temEdicao &&
              !confirm(
                "Montar a edição a partir do plano substitui a edição atual da timeline (dá para desfazer com Ctrl+Z). Continuar?",
              )
            )
              return;
            montar();
          }}
          disabled={!completo}
          className="botao-spray"
          title={
            completo
              ? ""
              : "Envie tudo o que falta (a música pode ser dispensada)"
          }
        >
          {plano.montadoEm ? "Montar de novo" : "Montar edição"}
        </button>
      </div>
      {montagem ? (
        <div className="space-y-1 border-2 border-tinta p-3 text-sm">
          {montagem.erro ? (
            <p className="text-spray">Não consegui montar: {montagem.erro}</p>
          ) : (
            <>
              <p>
                ✓ Edição montada.{" "}
                <Link href="/timeline" className="text-spray underline">
                  Ver na Timeline
                </Link>{" "}
                e ajustar pelo chat ao lado.
              </p>
              {montagem.avisos.map((a, i) => (
                <p key={i} className="text-xs text-zinc-400">
                  ⚠ {a}
                </p>
              ))}
            </>
          )}
        </div>
      ) : null}
      {envio.erro ? <p className="text-sm text-spray">{envio.erro}</p> : null}

      {/* Cenas */}
      <section className="space-y-3">
        <h3 className="rotulo-zine">
          {g.modo_audio === "narracao"
            ? "Passo 2 · Gere os takes no Higgsfield e envie"
            : "Cenas e takes"}
        </h3>
        {itens
          .filter((i) => i.tipo === "cena")
          .map((item) => {
            const c = item.cena!;
            return (
              <article
                key={item.chave}
                className="space-y-2 border-[3px] border-tinta p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-xl leading-none">
                    CENA {c.numero}
                  </span>
                  <span className="font-mono text-xs text-zinc-400">
                    @{c.apelido}
                  </span>
                  <span className="font-mono text-[11px] text-zinc-500">
                    {c.duracao_s}s na edição
                    {c.duracao_gerar_s && c.origem !== "banco"
                      ? ` · gerar ${c.duracao_gerar_s}s`
                      : ""}
                    {g.modo_audio === "narracao"
                      ? verificada
                        ? " · ⏱ ajustado à narração"
                        : " · duração provisória (envie a narração)"
                      : ""}
                  </span>
                  {c.origem === "banco" ? (
                    <span className="border-2 border-tinta bg-tinta px-1.5 py-0.5 font-mono text-[10px] text-papel uppercase">
                      do banco: @{c.apelido_banco}
                      {c.trecho_banco_de !== null
                        ? ` ${c.trecho_banco_de}–${c.trecho_banco_ate ?? "fim"}s`
                        : ""}
                    </span>
                  ) : null}
                  <span className="ml-auto">
                    <Chip status={item.status} />
                  </span>
                </div>
                {c.fala ? (
                  <p className="border-l-4 border-spray pl-2 text-sm italic">
                    “{c.fala}”
                  </p>
                ) : null}
                <p className="text-sm">{c.descricao}</p>
                {c.prompt_higgsfield && c.origem !== "banco" ? (
                  <div className="flex items-start gap-2 bg-zinc-900 p-2">
                    <code className="flex-1 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                      {c.prompt_higgsfield}
                    </code>
                    <Copiar texto={c.prompt_higgsfield} />
                  </div>
                ) : null}
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                  {c.som_do_take ? (
                    <>
                      <dt className="text-zinc-500">Som do take</dt>
                      <dd>
                        {c.som_do_take} —{" "}
                        {VOLUMES_TAKE[c.volume_do_take].toLowerCase()}
                      </dd>
                    </>
                  ) : null}
                  {c.feito_no_higgsfield ? (
                    <>
                      <dt className="text-zinc-500">No Higgsfield</dt>
                      <dd>{c.feito_no_higgsfield}</dd>
                    </>
                  ) : null}
                  {c.feito_no_enceditor ? (
                    <>
                      <dt className="text-zinc-500">No encEditor</dt>
                      <dd>
                        {c.feito_no_enceditor}
                        {c.transicao_entrada
                          ? ` · entra com #${c.transicao_entrada.tipo}`
                          : ""}
                        {c.zoom ? ` · zoom em “${c.zoom.frase}”` : ""}
                      </dd>
                    </>
                  ) : null}
                  {c.motivo ? (
                    <>
                      <dt className="text-zinc-500">Por quê</dt>
                      <dd className="text-zinc-400">{c.motivo}</dd>
                    </>
                  ) : null}
                </dl>
                <OlhadaDoTake
                  conferencia={
                    item.midia &&
                    plano.conferenciaTakes[item.chave]?.midiaId ===
                      item.midia.id
                      ? plano.conferenciaTakes[item.chave]
                      : null
                  }
                  olhando={uso.olhando === item.chave}
                />
                <AcoesDoItem
                  item={item}
                  biblioteca={biblioteca}
                  envio={envio}
                />
              </article>
            );
          })}
      </section>

      {/* Inserts */}
      {g.inserts.length ? (
        <section className="space-y-3">
          <h3 className="rotulo-zine">Inserts</h3>
          {itens
            .filter((i) => i.tipo === "insert")
            .map((item) => {
              const x = item.insert!;
              return (
                <article
                  key={item.chave}
                  className="space-y-2 border-2 border-tinta p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold">
                      @{x.apelido}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {x.posicao} {x.tamanho} · {x.duracao_s}s em “{x.frase}”
                    </span>
                    <span className="ml-auto">
                      <Chip status={item.status} />
                    </span>
                  </div>
                  <p className="text-sm">{x.descricao}</p>
                  {x.prompt_higgsfield && x.origem === "higgsfield" ? (
                    <div className="flex items-start gap-2 bg-zinc-900 p-2">
                      <code className="flex-1 font-mono text-[11px] whitespace-pre-wrap">
                        {x.prompt_higgsfield}
                      </code>
                      <Copiar texto={x.prompt_higgsfield} />
                    </div>
                  ) : null}
                  <AcoesDoItem
                    item={item}
                    biblioteca={biblioteca}
                    envio={envio}
                  />
                </article>
              );
            })}
        </section>
      ) : null}
    </div>
  );
};
