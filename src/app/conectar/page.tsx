"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  FormularioChave,
  ResumoConexao,
  useConexaoMeta,
} from "@/componentes/conexoes/ConexaoMeta";
import { DemoAnimada } from "@/componentes/conexoes/DemoAnimada";
import { DEMOS_META } from "@/conexoes/demosMeta";
import {
  ANTES_DE_COMECAR,
  nomeDoApp,
  PASSOS_META,
  PassoTutorial,
  PROBLEMAS_COMUNS,
  SEGURANCA,
} from "@/conexoes/tutorialMeta";
import { useProjeto } from "@/projeto/ProjetoProvider";

// Passo a passo, do zero, para ligar o Instagram e os anúncios da Meta ao
// encEditor com um app do próprio cliente (sem análise da Meta). Vale para
// o cliente do projeto aberto, ou outro por ?cliente=<id>. Cada passo tem
// um desenho animado mostrando onde clicar (DemoAnimada). Os passos
// marcados e o ID do app ficam guardados neste navegador.

const chaveDoProgresso = (cliente: string) =>
  `encditor:tutorial-meta:${cliente}`;
const chaveDoApp = (cliente: string) => `encditor:tutorial-meta:${cliente}:app`;

const lerProgresso = (cliente: string): string[] => {
  try {
    const v = localStorage.getItem(chaveDoProgresso(cliente));
    return v ? (JSON.parse(v) as string[]) : [];
  } catch {
    return [];
  }
};

const lerIdDoApp = (cliente: string) => {
  try {
    return localStorage.getItem(chaveDoApp(cliente)) ?? "";
  } catch {
    return "";
  }
};

// ID do app completo o bastante para montar links.
const idValido = (id: string) => /^\d{6,25}$/.test(id);

// Endereços da Meta e "passo N" viram links no texto.
const PADRAO_LINKS =
  /((?:[a-z]+\.)*(?:facebook|instagram)\.com(?:\/[\w\-/]*)?)|\bpasso (\d{1,2})\b/g;

const ComLinks: React.FC<{
  texto: string;
  irParaPasso: (id: string) => void;
}> = ({ texto, irParaPasso }) => {
  const partes: React.ReactNode[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(PADRAO_LINKS)) {
    const i = m.index ?? 0;
    partes.push(texto.slice(ultimo, i));
    const passo = m[2] ? PASSOS_META[Number(m[2]) - 1] : null;
    partes.push(
      m[1] ? (
        <a
          key={i}
          href={`https://${m[1]}`}
          target="_blank"
          rel="noreferrer"
          className="text-spray underline"
        >
          {m[1]}
        </a>
      ) : passo ? (
        <button
          key={i}
          type="button"
          onClick={() => irParaPasso(passo.id)}
          className="text-spray underline"
        >
          {m[0]}
        </button>
      ) : (
        m[0]
      ),
    );
    ultimo = i + m[0].length;
  }
  partes.push(texto.slice(ultimo));
  return (
    <>
      {partes.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </>
  );
};

const BotaoCopiar: React.FC<{ rotulo: string; valor: string }> = ({
  rotulo,
  valor,
}) => {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(valor).then(() => {
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1500);
        });
      }}
      className="border-2 border-tinta bg-papel px-2 py-0.5 font-mono text-[11px] hover:bg-tinta hover:text-papel"
      title={`Copiar ${valor}`}
    >
      {rotulo === valor ? valor : `${rotulo}: ${valor}`}{" "}
      {copiado ? "✓ copiado" : "⧉"}
    </button>
  );
};

const Passo: React.FC<{
  numero: number;
  passo: PassoTutorial;
  feito: boolean;
  aberto: boolean;
  aoAlternar: () => void;
  aoMarcar: (feito: boolean) => void;
  children?: React.ReactNode;
  // Ajusta links internos (ex.: Resultados do cliente certo).
  link: (url: string) => string;
  irParaPasso: (id: string) => void;
  // Valores dos marcadores dos desenhos e dos textos de copiar.
  valores: Record<string, string>;
  idDoApp: string;
  aoMudarIdDoApp: (id: string) => void;
}> = ({
  numero,
  passo,
  feito,
  aberto,
  aoAlternar,
  aoMarcar,
  children,
  link,
  irParaPasso,
  valores,
  idDoApp,
  aoMudarIdDoApp,
}) => {
  const demo = DEMOS_META[passo.id];
  const [itemAtual, setItemAtual] = useState<number | null>(null);
  const [pedido, setPedido] = useState<{ item: number; vez: number } | null>(
    null,
  );
  const comDesenho = new Set(demo?.map((q) => q.item));
  const temId = idValido(idDoApp);
  const urlDe = (url: string) =>
    url.includes("{app}")
      ? temId
        ? url.replace("{app}", idDoApp)
        : "https://developers.facebook.com/apps/"
      : link(url);
  const precisaDoId = passo.links.some((l) => l.url.includes("{app}"));
  const copiaveis = (passo.copiar ?? [])
    .map((c) => ({
      rotulo: c.rotulo,
      valor:
        c.valor === "{appId}" && !temId
          ? ""
          : c.valor.replace(/\{(\w+)\}/g, (m, k: string) => valores[k] ?? m),
    }))
    .filter((c) => c.valor);

  return (
    <article
      id={`passo-${passo.id}`}
      className={`cartao-zine scroll-mt-4 ${feito ? "opacity-70" : ""}`}
    >
      <header className="flex items-start gap-3 p-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center border-2 border-tinta font-display text-xl ${
            feito ? "bg-verde text-papel" : "bg-papel"
          }`}
        >
          {feito ? "✓" : numero}
        </span>
        <button onClick={aoAlternar} className="min-w-0 flex-1 text-left">
          <h2 className="font-display text-2xl leading-none uppercase">
            {passo.titulo}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            ~{passo.minutos} min · {passo.porque}
            {demo ? " · ▶ com desenho de onde clicar" : ""}
          </p>
        </button>
        <label className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] uppercase">
          <input
            type="checkbox"
            checked={feito}
            onChange={(e) => aoMarcar(e.target.checked)}
          />
          feito
        </label>
      </header>
      {aberto ? (
        <div className="space-y-3 border-t-2 border-tinta p-4">
          {passo.pule ? (
            <p className="text-sm text-zinc-500">
              <b>Pule este passo se</b>{" "}
              <ComLinks texto={passo.pule} irParaPasso={irParaPasso} />
            </p>
          ) : null}
          {passo.links.length ? (
            <div className="space-y-1">
              <div className="flex flex-wrap gap-2">
                {passo.links.map((l, i) => (
                  <a
                    key={l.url}
                    href={urlDe(l.url)}
                    target={l.url.startsWith("/") ? undefined : "_blank"}
                    rel="noreferrer"
                    className={
                      i === 0
                        ? "botao-spray !px-3 !py-1.5 !text-sm"
                        : "border-2 border-tinta px-3 py-1.5 font-mono text-[11px] uppercase hover:bg-tinta hover:text-papel"
                    }
                  >
                    Abrir {l.rotulo} ↗
                  </a>
                ))}
              </div>
              {precisaDoId && !temId ? (
                <p className="text-xs text-zinc-500">
                  Dica: cole o ID do app no{" "}
                  <button
                    type="button"
                    onClick={() => irParaPasso("criar-app")}
                    className="text-spray underline"
                  >
                    passo 7
                  </button>{" "}
                  e este botão abre direto a tela do SEU app (sem ele, abre a
                  lista de apps).
                </p>
              ) : null}
            </div>
          ) : null}
          {demo ? (
            <div className="space-y-1">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="rotulo-zine">Veja onde clicar</span>
                <span className="text-[11px] text-zinc-500">
                  desenho simplificado — a tela da Meta pode estar um pouco
                  diferente
                </span>
              </p>
              <DemoAnimada
                quadros={demo}
                valores={valores}
                pedido={pedido}
                aoMudarItem={setItemAtual}
              />
            </div>
          ) : null}
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            {passo.fazer.map((f, i) => {
              const noDesenho = itemAtual === i;
              const verNoDesenho = comDesenho.has(i) ? (
                <button
                  type="button"
                  onClick={() => setPedido({ item: i, vez: Date.now() })}
                  className="ml-1.5 font-mono text-[10px] text-spray uppercase underline"
                  title="Mostrar esta ação no desenho"
                >
                  ▶ ver
                </button>
              ) : null;
              // Alerta (⚠) e explicação (ℹ) não são ações: sem número
              // ("block" tira o item da contagem da lista).
              return f.startsWith("⚠") || f.startsWith("ℹ") ? (
                <li
                  key={i}
                  className={`-ml-5 block list-none border-l-4 py-1 pr-2 pl-2 ${
                    f.startsWith("⚠")
                      ? "border-spray bg-spray/10"
                      : "border-zinc-500 bg-zinc-900/40"
                  } ${noDesenho ? "outline-2 outline-spray" : ""}`}
                >
                  <ComLinks texto={f} irParaPasso={irParaPasso} />
                  {verNoDesenho}
                </li>
              ) : (
                <li
                  key={i}
                  className={`-mx-1 px-1 transition-colors ${
                    noDesenho ? "bg-spray/15 outline-2 outline-spray" : ""
                  }`}
                >
                  <ComLinks texto={f} irParaPasso={irParaPasso} />
                  {verNoDesenho}
                </li>
              );
            })}
          </ol>
          {copiaveis.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rotulo-zine">Copiar</span>
              {copiaveis.map((c) => (
                <BotaoCopiar key={c.rotulo} rotulo={c.rotulo} valor={c.valor} />
              ))}
            </div>
          ) : null}
          {passo.pedirIdDoApp ? (
            <label className="block space-y-1 border-2 border-dashed border-tinta p-3 text-sm">
              <b>ID do app (App ID)</b> — fica no topo do painel do app. Cole
              aqui: os botões dos próximos passos passam a abrir direto as telas
              do SEU app.
              <span className="flex flex-wrap items-center gap-2">
                <input
                  value={idDoApp}
                  onChange={(e) =>
                    aoMudarIdDoApp(e.target.value.replace(/\D/g, ""))
                  }
                  inputMode="numeric"
                  placeholder="ex.: 1234567890123456"
                  className="w-64 border-2 border-tinta bg-papel px-2 py-1 font-mono text-sm"
                />
                {temId ? (
                  <span className="text-xs text-verde">✓ guardado</span>
                ) : null}
              </span>
            </label>
          ) : null}
          {children}
          <p className="border-l-4 border-verde pl-3 text-sm">
            <b>Deu certo se:</b>{" "}
            <ComLinks texto={passo.confira} irParaPasso={irParaPasso} />
          </p>
          {passo.problemas.length ? (
            <div className="space-y-1">
              <p className="rotulo-zine">Se der errado</p>
              <ul className="space-y-1 text-sm">
                {passo.problemas.map((p, i) => (
                  <li key={i}>
                    <b>{p.sintoma}</b>{" "}
                    <ComLinks texto={p.solucao} irParaPasso={irParaPasso} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
};

export default function PaginaConectar() {
  const { carregado, meta } = useProjeto();
  const [doEndereco, setDoEndereco] = useState<string | null>(null);
  const [nomeCliente, setNomeCliente] = useState<string | null>(null);
  const [feitos, setFeitos] = useState<string[]>([]);
  const [abertos, setAbertos] = useState<string[] | null>(null);
  const [trocando, setTrocando] = useState(false);
  const [idDoApp, setIdDoApp] = useState("");

  // ?cliente=<id> (vindo da página do cliente) ou o do projeto aberto.
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("cliente");
    if (id && /^[a-z0-9-]{1,60}$/.test(id)) setDoEndereco(id);
  }, []);
  const clienteId = doEndereco ?? meta?.cliente.id ?? null;

  useEffect(() => {
    if (!clienteId) return;
    if (!doEndereco) {
      setNomeCliente(meta?.cliente.nome ?? null);
      return;
    }
    void fetch(`/api/clientes/${clienteId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setNomeCliente(d?.cliente?.nome ?? clienteId));
  }, [clienteId, doEndereco, meta]);

  useEffect(() => {
    if (!clienteId) return;
    setFeitos(lerProgresso(clienteId));
    setIdDoApp(lerIdDoApp(clienteId));
  }, [clienteId]);

  const mudarIdDoApp = (id: string) => {
    setIdDoApp(id);
    if (!clienteId) return;
    try {
      localStorage.setItem(chaveDoApp(clienteId), id);
    } catch {
      // sem armazenamento local: o ID só não fica guardado
    }
  };

  // Marcadores dos desenhos: a marca do cliente (a pasta padrão não tem).
  const marca =
    clienteId === "geral" || !nomeCliente ? "Sua Marca" : nomeCliente;
  const valores = useMemo(
    () => ({
      marca,
      nomeApp: nomeDoApp(marca),
      appId: idValido(idDoApp) ? idDoApp : "1234567890",
    }),
    [marca, idDoApp],
  );

  const { situacao, setSituacao } = useConexaoMeta(clienteId);
  const conectado = !!situacao?.conectado && !situacao.ilegivel;
  // Resultados é do projeto aberto: com ?cliente=, abre os desse cliente.
  const link = (url: string) =>
    url === "/resultados" && doEndereco && doEndereco !== meta?.cliente.id
      ? `/resultados?cliente=${doEndereco}`
      : url;

  // Abre o primeiro passo que falta (ou o do endereço, ex.: #passo-dar-acesso).
  useEffect(() => {
    if (!clienteId || abertos !== null || !situacao) return;
    const doHash = location.hash.replace("#passo-", "");
    const primeiro = PASSOS_META.find(
      (p) =>
        !lerProgresso(clienteId).includes(p.id) && !(conectado && p.formulario),
    );
    // Chave guardada ilegível: direto para colar de novo.
    const abrir = situacao.ilegivel
      ? "colar"
      : PASSOS_META.some((p) => p.id === doHash)
        ? doHash
        : (primeiro?.id ?? null);
    setAbertos(abrir ? [abrir] : []);
    if (abrir && doHash === abrir) {
      setTimeout(
        () => document.getElementById(`passo-${abrir}`)?.scrollIntoView(),
        50,
      );
    }
  }, [clienteId, abertos, situacao, conectado]);

  const marcar = (id: string, feito: boolean) => {
    if (!clienteId) return;
    const novos = feito
      ? [...new Set([...feitos, id])]
      : feitos.filter((f) => f !== id);
    setFeitos(novos);
    try {
      localStorage.setItem(chaveDoProgresso(clienteId), JSON.stringify(novos));
    } catch {
      // sem armazenamento local: o progresso só não fica guardado
    }
    // Marcou como feito: fecha e abre o próximo que falta.
    if (feito) {
      const i = PASSOS_META.findIndex((p) => p.id === id);
      const proximo = PASSOS_META.slice(i + 1).find(
        (p) => !novos.includes(p.id),
      );
      setAbertos((a) => [
        ...(a ?? []).filter((x) => x !== id),
        ...(proximo ? [proximo.id] : []),
      ]);
      if (proximo) {
        setTimeout(
          () =>
            document
              .getElementById(`passo-${proximo.id}`)
              ?.scrollIntoView({ behavior: "smooth", block: "start" }),
          50,
        );
      }
    }
  };

  const alternar = (id: string) =>
    setAbertos((a) =>
      (a ?? []).includes(id)
        ? (a ?? []).filter((x) => x !== id)
        : [...(a ?? []), id],
    );

  const irParaPasso = (id: string) => {
    setAbertos((a) => [...new Set([...(a ?? []), id])]);
    setTimeout(
      () =>
        document
          .getElementById(`passo-${id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  };
  const numeroDoPasso = (id: string) =>
    PASSOS_META.findIndex((p) => p.id === id) + 1;

  const minutosQueFaltam = useMemo(
    () =>
      PASSOS_META.filter((p) => !feitos.includes(p.id)).reduce(
        (t, p) => t + p.minutos,
        0,
      ),
    [feitos],
  );

  if (!carregado || !clienteId) return null;

  const formulario = (
    <div className="border-2 border-dashed border-tinta p-3">
      {conectado && situacao && !trocando ? (
        <div className="space-y-2">
          <ResumoConexao
            clienteId={clienteId}
            situacao={situacao}
            aoMudar={setSituacao}
            irParaPasso={irParaPasso}
            numeroDoPasso={numeroDoPasso}
          />
          <button
            onClick={() => setTrocando(true)}
            className="text-sm text-spray underline"
          >
            Colar outra chave
          </button>
        </div>
      ) : (
        <FormularioChave
          clienteId={clienteId}
          atual={situacao}
          aoConectar={(s) => {
            setSituacao(s);
            setTrocando(false);
            marcar("colar", true);
          }}
        />
      )}
    </div>
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <header className="space-y-2">
          <p className="rotulo-zine">Resultados automáticos</p>
          <h1 className="font-display text-5xl leading-none tracking-tight uppercase">
            Conectar Instagram e anúncios
          </h1>
          <p className="text-sm text-zinc-400">
            Cliente: <b>{nomeCliente ?? clienteId}</b> · passo a passo do zero ·{" "}
            {feitos.length} de {PASSOS_META.length} feitos
            {minutosQueFaltam ? ` · faltam ~${minutosQueFaltam} min` : ""}
          </p>
          <div className="h-2 border-2 border-tinta">
            <div
              className="h-full bg-spray"
              style={{
                width: `${(feitos.length / PASSOS_META.length) * 100}%`,
              }}
            />
          </div>
        </header>

        {situacao?.conectado ? (
          <section className="cartao-zine p-4">
            <ResumoConexao
              clienteId={clienteId}
              situacao={situacao}
              aoMudar={setSituacao}
              irParaPasso={irParaPasso}
              numeroDoPasso={numeroDoPasso}
            />
            <p className="mt-3 text-sm">
              Próximo: na aba{" "}
              <a href={link("/resultados")} className="text-spray underline">
                Resultados
              </a>
              , ligue cada vídeo ao post e aos anúncios dele.
            </p>
          </section>
        ) : null}

        <section className="cartao-zine space-y-3 p-4 text-sm">
          <p className="rotulo-zine">Antes de começar</p>
          <p>{ANTES_DE_COMECAR.oQue}</p>
          <p>{ANTES_DE_COMECAR.porQueGratis}</p>
          <p>
            <b>Tempo:</b> {ANTES_DE_COMECAR.tempo}
          </p>
          <p className="border-l-4 border-spray pl-3">
            <b>Como usar esta página:</b> abra o passo, clique no botão vermelho
            “Abrir… ↗” (a tela da Meta abre em outra aba) e siga o desenho, que
            mostra onde clicar. Terminou? Marque “feito” e o próximo passo abre
            sozinho.
          </p>
          <div>
            <b>Separe:</b>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {ANTES_DE_COMECAR.separe.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <p className="border-l-4 border-spray pl-3">
            <ComLinks
              texto={ANTES_DE_COMECAR.agencia}
              irParaPasso={irParaPasso}
            />
          </p>
          <p className="text-zinc-500">{ANTES_DE_COMECAR.idioma}</p>
        </section>

        <div className="space-y-3">
          {PASSOS_META.map((p, i) => (
            <Passo
              key={p.id}
              numero={i + 1}
              passo={p}
              feito={feitos.includes(p.id)}
              aberto={(abertos ?? []).includes(p.id)}
              aoAlternar={() => alternar(p.id)}
              aoMarcar={(f) => marcar(p.id, f)}
              link={link}
              irParaPasso={irParaPasso}
              valores={valores}
              idDoApp={idDoApp}
              aoMudarIdDoApp={mudarIdDoApp}
            >
              {p.formulario ? formulario : null}
            </Passo>
          ))}
        </div>

        <section className="cartao-zine space-y-2 p-4">
          <p className="rotulo-zine">Problemas comuns</p>
          <ul className="space-y-2 text-sm">
            {PROBLEMAS_COMUNS.map((p) => (
              <li key={p.sintoma}>
                <b>{p.sintoma}</b>{" "}
                <ComLinks texto={p.solucao} irParaPasso={irParaPasso} />
              </li>
            ))}
          </ul>
        </section>

        <section className="cartao-zine space-y-2 p-4">
          <p className="rotulo-zine">Segurança</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {SEGURANCA.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
