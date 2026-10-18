"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ModalResultado } from "@/componentes/clientes/ModalResultado";
import { haQuanto, useConexaoMeta } from "@/componentes/conexoes/ConexaoMeta";
import { ModalVinculos } from "@/componentes/resultados/ModalVinculos";
import { lerVinculos, temVinculo, Vinculos } from "@/conexoes/vinculos";
import { useProjeto } from "@/projeto/ProjetoProvider";
import {
  dinheiro,
  lerResultado,
  REDES,
  Rede,
  Resultado,
  ROTULO_AVALIACAO,
  temOrganico,
  temPago,
} from "@/projeto/resultado";

// Aba "Resultados": os vídeos exportados (versões) com o resultado de
// cada um, separado em PAGO (Meta Ads) e ORGÂNICO (TikTok e Instagram).
// Por padrão mostra só o projeto aberto; dá para ver o cliente inteiro.
// Com a Meta conectada (/conectar), cada versão pode ser ligada ao post e
// aos anúncios dela: Pago e Orgânico · Instagram entram sozinhos.

// Leitura dos números (igual a src/conexoes/sincronizar.ts → VALIDADE_MS).
const VALIDADE_MS = 6 * 60 * 60 * 1000;

type MetricasDaVersao = {
  atualizadoEm: number;
  erro: string | null;
  avisos?: string[];
  automaticos?: { pago: string[]; instagram: string[] };
} | null;

type Exportacao = {
  id: string;
  projetoId: string;
  nome: string;
  arquivo: string;
  duracao: number;
  criadoEm: number;
  resultado: Resultado | null;
  vinculos: Vinculos;
  metricas: MetricasDaVersao;
};

const CORES: Record<Resultado["avaliacao"], string> = {
  bom: "bg-verde text-papel",
  ruim: "bg-spray text-papel",
  neutro: "bg-tinta text-papel",
};

const br = (n: number, casas = 0) =>
  n.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });

const Numero: React.FC<{ rotulo: string; valor: string | null }> = ({
  rotulo,
  valor,
}) => (
  <div className="border-2 border-tinta px-2 py-1.5">
    <p className="font-mono text-[10px] tracking-wider text-zinc-500 uppercase">
      {rotulo}
    </p>
    <p
      className={`font-display text-2xl leading-none ${valor === null ? "text-zinc-600" : ""}`}
    >
      {valor ?? "—"}
    </p>
  </div>
);

const Bloco: React.FC<{
  titulo: string;
  vazio: boolean;
  children: React.ReactNode;
}> = ({ titulo, vazio, children }) => (
  <div className="space-y-1.5">
    <p className="rotulo-zine">{titulo}</p>
    {vazio ? (
      <p className="text-xs text-zinc-500">Sem números ainda.</p>
    ) : (
      <div className="grid grid-cols-2 gap-1.5">{children}</div>
    )}
  </div>
);

const n = (v: number | null, casas = 0, antes = "", depois = "") =>
  v === null ? null : `${antes}${br(v, casas)}${depois}`;

export default function PaginaResultados() {
  const { carregado, meta } = useProjeto();
  // ?cliente=<id> (vindo de /conectar ou da página do cliente) mostra os
  // vídeos desse cliente; sem ele, o do projeto aberto.
  const [doEndereco, setDoEndereco] = useState<string | null>(null);
  const [nomeCliente, setNomeCliente] = useState<string | null>(null);
  const [exportacoes, setExportacoes] = useState<Exportacao[] | null>(null);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [doCliente, setDoCliente] = useState(false);
  const [editando, setEditando] = useState<Exportacao | null>(null);
  const [assistindo, setAssistindo] = useState<string | null>(null);
  const [ligando, setLigando] = useState<Exportacao | null>(null);
  const [lendo, setLendo] = useState(false);
  const [avisoLeitura, setAvisoLeitura] = useState<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("cliente");
    if (id && /^[a-z0-9-]{1,60}$/.test(id)) setDoEndereco(id);
  }, []);
  const clienteId = doEndereco ?? meta?.cliente.id ?? null;
  const outroCliente = !!doEndereco && doEndereco !== meta?.cliente.id;
  const linkConectar = `/conectar${outroCliente ? `?cliente=${clienteId}` : ""}`;
  useEffect(() => {
    if (outroCliente) setDoCliente(true);
  }, [outroCliente]);

  const { situacao, recarregar: recarregarConexao } = useConexaoMeta(clienteId);
  const conectado = !!situacao?.conectado && !situacao.ilegivel;
  const leuSozinho = useRef(false);

  const carregar = useCallback(async () => {
    if (!clienteId) return;
    const r = await fetch(`/api/clientes/${clienteId}`, {
      cache: "no-store",
    });
    if (!r.ok) return;
    const d = (await r.json()) as {
      cliente: { nome: string };
      projetos: { id: string; nome: string }[];
      exportacoes: (Exportacao & {
        resultado: unknown;
        vinculos: unknown;
        metricas: unknown;
      })[];
    };
    setNomeCliente(d.cliente.nome);
    setNomes(Object.fromEntries(d.projetos.map((p) => [p.id, p.nome])));
    setExportacoes(
      d.exportacoes.map((e) => ({
        ...e,
        resultado: lerResultado(e.resultado),
        vinculos: lerVinculos(e.vinculos),
        metricas: (e.metricas as MetricasDaVersao) ?? null,
      })),
    );
  }, [clienteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Lê os números na Meta (as versões com leitura recente são puladas).
  const lerNumeros = useCallback(
    async (forcar: boolean) => {
      if (!clienteId) return;
      setLendo(true);
      setAvisoLeitura(null);
      try {
        const r = await fetch("/api/metricas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cliente: clienteId, forcar }),
        });
        const d = (await r.json().catch(() => ({}))) as {
          erro?: string;
          atualizadas?: number;
          parou?: string | null;
          erros?: { mensagem: string }[];
        };
        if (!r.ok)
          setAvisoLeitura(d.erro ?? "Não deu para ler os números agora.");
        else if (d.parou) setAvisoLeitura(d.parou);
        else if (d.erros?.length) setAvisoLeitura(d.erros[0].mensagem);
        else if (forcar) {
          setAvisoLeitura(
            d.atualizadas
              ? `${d.atualizadas} versão(ões) atualizada(s).`
              : "Nenhuma versão ligada a post/anúncio ainda.",
          );
        }
      } finally {
        setLendo(false);
        await carregar();
        await recarregarConexao();
      }
    },
    [clienteId, carregar, recarregarConexao],
  );

  // Ao abrir a aba: lê sozinho se alguma versão ligada está desatualizada
  // (ou se faz um dia sem falar com a Meta, para o app não ficar inativo).
  useEffect(() => {
    if (leuSozinho.current || !conectado || !exportacoes) return;
    const velha = exportacoes.some(
      (e) =>
        temVinculo(e.vinculos) &&
        (!e.metricas || Date.now() - e.metricas.atualizadoEm > VALIDADE_MS),
    );
    const semUsoHoje =
      !situacao?.info?.ultimaLeitura ||
      Date.now() - situacao.info.ultimaLeitura > 20 * 60 * 60 * 1000;
    if (!velha && !semUsoHoje) return;
    leuSozinho.current = true;
    void lerNumeros(false);
  }, [conectado, exportacoes, situacao, lerNumeros]);

  if (!carregado || !meta) return null;

  const lista = (exportacoes ?? []).filter(
    (e) => doCliente || e.projetoId === meta.id,
  );
  // Linha mais recente da versão aberta no modal (a lista é recarregada
  // depois de cada leitura).
  const editandoAtual = editando
    ? ((exportacoes ?? []).find((x) => x.id === editando.id) ?? editando)
    : null;

  const salvarVinculos = async (e: Exportacao, vinculos: Vinculos) => {
    const r = await fetch(`/api/exportacoes/${e.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vinculos }),
    });
    const d = (await r.json().catch(() => ({}))) as {
      erro?: string;
      leitura?: { parou?: string | null; erros?: { mensagem: string }[] };
    };
    if (!r.ok) throw new Error(d.erro ?? "Não deu para salvar.");
    setLigando(null);
    const problema = d.leitura?.parou ?? d.leitura?.erros?.[0]?.mensagem;
    setAvisoLeitura(problema ?? null);
    await carregar();
    await recarregarConexao();
  };

  const salvar = async (e: Exportacao, resultado: Resultado | null) => {
    await fetch(`/api/exportacoes/${e.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultado }),
    });
    setEditando(null);
    await carregar();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <header className="flex flex-wrap items-end gap-4">
          <div>
            <h1 className="font-display text-6xl leading-none tracking-tight uppercase">
              Resultados
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Como cada vídeo exportado foi no <b>pago</b> (Meta Ads) e no{" "}
              <b>orgânico</b> (TikTok e Instagram). O planejador usa esses
              números para os próximos roteiros.
            </p>
          </div>
          <div className="ml-auto flex border-2 border-tinta font-mono text-[11px] uppercase">
            {[
              [false, "Este vídeo"],
              [true, `Todo o cliente`],
            ].map(([valor, rotulo]) => (
              <button
                key={String(valor)}
                onClick={() => setDoCliente(valor as boolean)}
                className={`px-3 py-1.5 ${doCliente === valor ? "bg-tinta text-papel" : "hover:bg-zinc-900"}`}
              >
                {rotulo as string}
              </button>
            ))}
          </div>
        </header>

        {situacao ? (
          <div
            className={`flex flex-wrap items-center gap-3 border-2 p-3 text-sm ${
              conectado && !situacao.info?.erro
                ? "border-verde"
                : "border-spray"
            }`}
          >
            {conectado && situacao.info ? (
              <>
                <span>
                  <b>Meta conectada</b>
                  {nomeCliente ? ` (${nomeCliente})` : ""}
                  {situacao.info.instagrams.length
                    ? ` · ${situacao.info.instagrams.map((i) => `@${i.usuario}`).join(", ")}`
                    : ""}
                  {` · ${situacao.info.contasAnuncio.length} conta(s) de anúncios`}
                  {situacao.info.ultimaLeitura
                    ? ` · números lidos ${haQuanto(situacao.info.ultimaLeitura)}`
                    : ""}
                </span>
                <button
                  onClick={() => void lerNumeros(true)}
                  disabled={lendo}
                  className="border-2 border-tinta px-2 py-1 font-mono text-[11px] uppercase hover:bg-tinta hover:text-papel disabled:opacity-40"
                >
                  {lendo ? "Lendo na Meta…" : "Atualizar números"}
                </button>
                <a href={linkConectar} className="ml-auto text-spray underline">
                  conexão
                </a>
                {situacao.info.erro ? (
                  <p className="w-full">
                    ⚠ {situacao.info.erro}{" "}
                    <a
                      href={`${linkConectar}#passo-gerar-chave`}
                      className="text-spray underline"
                    >
                      gerar e colar uma chave nova
                    </a>
                  </p>
                ) : null}
              </>
            ) : situacao.ilegivel ? (
              <>
                <span>⚠ {situacao.info?.erro}</span>
                <a
                  href={`${linkConectar}#passo-colar`}
                  className="botao-spray !px-3 !py-1 !text-sm"
                >
                  Colar de novo
                </a>
              </>
            ) : (
              <>
                <span>
                  Os números podem entrar <b>sozinhos</b>: conecte o Instagram e
                  os anúncios da Meta{nomeCliente ? ` de ${nomeCliente}` : ""}{" "}
                  (passo a passo, sem aprovação da Meta).
                </span>
                <a
                  href={linkConectar}
                  className="botao-spray !px-3 !py-1 !text-sm"
                >
                  Conectar
                </a>
              </>
            )}
            {avisoLeitura ? (
              <p className="w-full text-zinc-400">↻ {avisoLeitura}</p>
            ) : null}
          </div>
        ) : null}

        {exportacoes === null ? (
          <p className="text-sm text-zinc-500">Carregando…</p>
        ) : !lista.length ? (
          <p className="border-2 border-dashed border-zinc-700 p-6 text-center text-sm text-zinc-500">
            {doCliente
              ? "Este cliente ainda não tem vídeos exportados."
              : "Este projeto ainda não tem vídeos exportados. Use o botão “Exportar” no topo; cada exportação vira uma versão aqui."}
          </p>
        ) : (
          lista.map((e) => {
            const r = e.resultado;
            return (
              <article key={e.id} className="cartao-zine space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-2xl leading-none uppercase">
                      {e.nome}
                    </h2>
                    <p className="font-mono text-[11px] tracking-wider text-zinc-500 uppercase">
                      {doCliente ? `${nomes[e.projetoId] ?? "?"} · ` : ""}
                      {new Date(e.criadoEm).toLocaleDateString("pt-BR")} ·{" "}
                      {br(e.duracao, 1)}s
                    </p>
                  </div>
                  {r ? (
                    <span
                      className={`border-2 border-tinta px-2 py-1 text-xs ${CORES[r.avaliacao]}`}
                    >
                      {ROTULO_AVALIACAO[r.avaliacao]}
                    </span>
                  ) : null}
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={() =>
                        setAssistindo(assistindo === e.id ? null : e.id)
                      }
                      className="border-2 border-tinta px-2 py-1 font-mono text-[11px] uppercase hover:bg-tinta hover:text-papel"
                    >
                      {assistindo === e.id ? "fechar" : "▶ assistir"}
                    </button>
                    <a
                      href={`/api/midia/${e.arquivo}?baixar=${encodeURIComponent(`${nomes[e.projetoId] ?? "video"} - ${e.nome}.mp4`)}`}
                      className="border-2 border-tinta px-2 py-1 font-mono text-[11px] uppercase hover:bg-tinta hover:text-papel"
                    >
                      baixar
                    </a>
                    {conectado ? (
                      <button
                        onClick={() => setLigando(e)}
                        className="border-2 border-tinta px-2 py-1 font-mono text-[11px] uppercase hover:bg-tinta hover:text-papel"
                      >
                        {temVinculo(e.vinculos)
                          ? "🔗 trocar post/anúncio"
                          : "🔗 ligar ao post/anúncio"}
                      </button>
                    ) : null}
                    <button
                      onClick={() => setEditando(e)}
                      className="botao-spray !px-3 !py-1 !text-sm"
                    >
                      {r ? "Editar resultado" : "Registrar resultado"}
                    </button>
                  </div>
                </div>

                {temVinculo(e.vinculos) ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                    {e.vinculos.instagram ? (
                      <a
                        href={e.vinculos.instagram.link ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 border border-tinta px-1.5 py-0.5 hover:bg-zinc-900"
                      >
                        {e.vinculos.instagram.miniatura ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={e.vinculos.instagram.miniatura}
                            alt=""
                            className="h-6 w-6 object-cover"
                          />
                        ) : null}
                        Instagram
                        {e.vinculos.instagram.usuario
                          ? ` @${e.vinculos.instagram.usuario}`
                          : ""}
                        {e.vinculos.instagram.publicadoEm
                          ? ` · ${new Date(e.vinculos.instagram.publicadoEm).toLocaleDateString("pt-BR")}`
                          : ""}
                      </a>
                    ) : null}
                    {e.vinculos.anuncios.length ? (
                      <span
                        className="border border-tinta px-1.5 py-0.5"
                        title={e.vinculos.anuncios
                          .map((a) => a.nome)
                          .join(", ")}
                      >
                        {e.vinculos.anuncios.length} anúncio
                        {e.vinculos.anuncios.length === 1 ? "" : "s"}
                      </span>
                    ) : null}
                    <span>
                      {e.metricas?.erro
                        ? `⚠ ${e.metricas.erro}`
                        : e.metricas?.atualizadoEm
                          ? `números da Meta ${haQuanto(e.metricas.atualizadoEm)}`
                          : "aguardando a primeira leitura"}
                    </span>
                    {e.metricas?.avisos?.map((a) => (
                      <span key={a} className="w-full">
                        ↻ {a}
                      </span>
                    ))}
                  </div>
                ) : null}

                {assistindo === e.id ? (
                  <video
                    src={`/api/midia/${e.arquivo}`}
                    controls
                    autoPlay
                    className="max-h-96 border-2 border-tinta bg-black"
                  />
                ) : null}

                {r ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-3">
                      <Bloco titulo="Pago · Meta Ads" vazio={!temPago(r.pago)}>
                        <Numero
                          rotulo={
                            r.pago.tipo === "conversas"
                              ? "Conversas"
                              : "Cliques"
                          }
                          valor={n(r.pago.resultados)}
                        />
                        <Numero
                          rotulo="CTR"
                          valor={n(r.pago.ctr, 2, "", "%")}
                        />
                        <Numero
                          rotulo={`Custo/${r.pago.tipo === "conversas" ? "conversa" : "clique"}`}
                          valor={
                            r.pago.custoPorResultado === null
                              ? null
                              : dinheiro(r.pago.custoPorResultado, r.pago.moeda)
                          }
                        />
                        <Numero rotulo="Vendas" valor={n(r.pago.vendas)} />
                      </Bloco>
                      {(Object.keys(REDES) as Rede[]).map((rede) => {
                        const o = r.organico[rede];
                        return (
                          <Bloco
                            key={rede}
                            titulo={`Orgânico · ${REDES[rede]}`}
                            vazio={!temOrganico(o)}
                          >
                            <Numero
                              rotulo="Visualizações"
                              valor={n(o.visualizacoes)}
                            />
                            <Numero rotulo="Curtidas" valor={n(o.curtidas)} />
                            <Numero
                              rotulo="Comentários"
                              valor={n(o.comentarios)}
                            />
                            <Numero
                              rotulo="Compartilh."
                              valor={n(o.compartilhamentos)}
                            />
                            <Numero
                              rotulo="Salvamentos"
                              valor={n(o.salvamentos)}
                            />
                            <Numero
                              rotulo="Seguidores"
                              valor={n(o.seguidores, 0, "+")}
                            />
                          </Bloco>
                        );
                      })}
                    </div>
                    {r.nota || r.opiniaoVisual ? (
                      <div className="space-y-1 border-l-4 border-spray pl-3 text-sm">
                        {r.nota ? <p className="italic">“{r.nota}”</p> : null}
                        {r.opiniaoVisual ? (
                          <p className="text-zinc-400">
                            👁 Visual: {r.opiniaoVisual}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-zinc-500">
                    Resultado ainda não registrado.
                  </p>
                )}
              </article>
            );
          })
        )}
      </div>

      {ligando && situacao?.info ? (
        <ModalVinculos
          clienteId={clienteId ?? meta.cliente.id}
          nome={`${nomes[ligando.projetoId] ?? ""} › ${ligando.nome}`}
          atuais={ligando.vinculos}
          info={situacao.info}
          aoFechar={() => setLigando(null)}
          aoSalvar={(v) => salvarVinculos(ligando, v)}
        />
      ) : null}

      {editando ? (
        <ModalResultado
          nomeProjeto={`${nomes[editando.projetoId] ?? ""} › ${editando.nome}`}
          atual={editandoAtual?.resultado ?? editando.resultado}
          automatico={
            editandoAtual?.metricas?.automaticos ?? { pago: [], instagram: [] }
          }
          aoSalvar={(r) => void salvar(editando, r)}
          aoFechar={() => setEditando(null)}
        />
      ) : null}
    </div>
  );
}
