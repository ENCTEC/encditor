"use client";

import { useCallback, useEffect, useState } from "react";
import type { InfoMeta } from "@/conexoes/meta";

// Situação da conexão do cliente com a Meta (Instagram + Anúncios) e o
// formulário de colar a chave. Usado em /conectar e na aba Resultados.

export type SituacaoMeta = {
  conectado: boolean;
  // A chave guardada não pôde ser aberta: é preciso colar de novo.
  ilegivel?: boolean;
  comAppSecretInstagram?: boolean;
  info: InfoMeta | null;
  mascara: string | null;
  doisApps: boolean;
  comAppSecret: boolean;
  versao: string;
};

export const useConexaoMeta = (clienteId: string | null) => {
  const [situacao, setSituacao] = useState<SituacaoMeta | null>(null);
  const recarregar = useCallback(async () => {
    if (!clienteId) return;
    const r = await fetch(`/api/conexoes/meta?cliente=${clienteId}`, {
      cache: "no-store",
    }).catch(() => null);
    if (r?.ok) setSituacao((await r.json()) as SituacaoMeta);
  }, [clienteId]);
  useEffect(() => {
    void recarregar();
  }, [recarregar]);
  return { situacao, setSituacao, recarregar };
};

export const haQuanto = (quando: number) => {
  const min = Math.round((Date.now() - quando) / 60_000);
  if (min < 1) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} dia${d === 1 ? "" : "s"}`;
};

const botao =
  "border-2 border-tinta px-3 py-1 font-mono text-[11px] tracking-wider uppercase hover:bg-tinta hover:text-papel disabled:opacity-40";

export const ResumoConexao: React.FC<{
  clienteId: string;
  situacao: SituacaoMeta;
  aoMudar: (s: SituacaoMeta) => void;
  // Leva ao passo do tutorial que resolve um aviso (só em /conectar).
  irParaPasso?: (id: string) => void;
  numeroDoPasso?: (id: string) => number;
}> = ({ clienteId, situacao, aoMudar, irParaPasso, numeroDoPasso }) => {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const info = situacao.info;

  const conferir = async () => {
    setOcupado("Conferindo na Meta…");
    setErro(null);
    const r = await fetch(`/api/conexoes/meta?cliente=${clienteId}`, {
      method: "POST",
    });
    const d = await r.json();
    setOcupado(null);
    if (!r.ok) setErro(d.erro ?? "Não deu para conferir.");
    else aoMudar(d as SituacaoMeta);
  };

  const desconectar = async () => {
    if (
      !window.confirm(
        "Desconectar apaga a chave do encEditor (os números já lidos ficam). Para cortar o acesso também na Meta, revogue a chave no usuário do sistema. Continuar?",
      )
    ) {
      return;
    }
    setOcupado("Desconectando…");
    const r = await fetch(`/api/conexoes/meta?cliente=${clienteId}`, {
      method: "DELETE",
    });
    setOcupado(null);
    if (r.ok) aoMudar((await r.json()) as SituacaoMeta);
  };

  if (!situacao.conectado || !info) return null;
  if (situacao.ilegivel) {
    return (
      <p className="border-2 border-spray bg-spray/10 p-2 text-sm">
        ⚠ {info.erro}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="font-display text-2xl leading-none uppercase">
          ✓ Meta conectada
        </p>
        <p className="font-mono text-[11px] tracking-wider text-zinc-500 uppercase">
          como {info.usuario.nome}
          {info.usuarioInstagram ? ` e ${info.usuarioInstagram.nome}` : ""} ·
          chave {situacao.mascara}
          {situacao.doisApps ? " · 2 apps" : ""}
          {situacao.comAppSecret || situacao.comAppSecretInstagram
            ? " · com chave secreta"
            : ""}
        </p>
      </div>
      <p className="text-xs text-zinc-500">
        Aparece acima o nome do usuário do sistema (ex.: encEditor). Se aparecer
        o SEU nome, a chave é pessoal e vai vencer: gere outra em Usuários do
        sistema (passo 14).
      </p>

      {info.erro ? (
        <p className="border-2 border-spray bg-spray/10 p-2 text-sm">
          ⚠ {info.erro}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="rotulo-zine mb-1">Instagram</p>
          {info.instagrams.length ? (
            <ul className="space-y-1 text-sm">
              {info.instagrams.map((ig) => (
                <li key={ig.id} className="flex items-center gap-2">
                  {ig.foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ig.foto}
                      alt=""
                      className="h-6 w-6 rounded-full border border-tinta object-cover"
                    />
                  ) : null}
                  <b>@{ig.usuario}</b>
                  <span className="text-xs text-zinc-500">
                    (Página {ig.paginaNome})
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">
              Nenhum Instagram encontrado.
            </p>
          )}
        </div>
        <div>
          <p className="rotulo-zine mb-1">Contas de anúncios</p>
          {info.contasAnuncio.length ? (
            <ul className="space-y-1 text-sm">
              {info.contasAnuncio.map((c) => (
                <li key={c.id}>
                  <b>{c.nome}</b>{" "}
                  <span className="text-xs text-zinc-500">
                    ({c.moeda}
                    {c.status !== 1 ? " · não está ativa" : ""})
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">Nenhuma conta encontrada.</p>
          )}
        </div>
      </div>

      {info.avisos.length ? (
        <ul className="space-y-1 border-l-4 border-spray pl-3 text-sm">
          {info.avisos.map((a, i) => (
            <li key={i}>
              ⚠ {a.texto}{" "}
              {irParaPasso ? (
                <button
                  onClick={() => irParaPasso(a.passo)}
                  className="text-spray underline"
                >
                  ver passo {numeroDoPasso?.(a.passo) ?? ""}
                </button>
              ) : (
                <a
                  href={`/conectar#passo-${a.passo}`}
                  className="text-spray underline"
                >
                  ver no passo a passo
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => void conferir()}
          disabled={!!ocupado}
          className={botao}
        >
          Conferir de novo
        </button>
        <button
          onClick={() => void desconectar()}
          disabled={!!ocupado}
          className={botao}
        >
          Desconectar
        </button>
        <span className="text-xs text-zinc-500">
          {ocupado ??
            (info.ultimaLeitura
              ? `Última leitura de números ${haQuanto(info.ultimaLeitura)}.`
              : `Conferida ${haQuanto(info.verificadoEm)}.`)}
        </span>
      </div>
      {erro ? <p className="text-sm text-spray">{erro}</p> : null}
    </div>
  );
};

export const FormularioChave: React.FC<{
  clienteId: string;
  // Já conectado: começa com as opções guardadas; campo em branco = manter.
  atual: SituacaoMeta | null;
  aoConectar: (s: SituacaoMeta) => void;
}> = ({ clienteId, atual, aoConectar }) => {
  const trocando = !!atual?.conectado && !atual.ilegivel;
  const [token, setToken] = useState("");
  const [doisApps, setDoisApps] = useState(trocando && !!atual?.doisApps);
  const [tokenInstagram, setTokenInstagram] = useState("");
  const [comSegredo, setComSegredo] = useState(
    trocando && !!(atual?.comAppSecret || atual?.comAppSecretInstagram),
  );
  const [appSecret, setAppSecret] = useState("");
  const [appSecretInstagram, setAppSecretInstagram] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Ligado e em branco ao trocar = manter o guardado (campo omitido);
  // desligado = tirar (null).
  const campoOpcional = (ligado: boolean, valor: string) =>
    !ligado ? null : valor.trim() ? valor : trocando ? undefined : null;

  const conectar = async () => {
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch("/api/conexoes/meta", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente: clienteId,
          token,
          tokenInstagram: campoOpcional(doisApps, tokenInstagram),
          appSecret: campoOpcional(comSegredo, appSecret),
          appSecretInstagram: campoOpcional(
            comSegredo && doisApps,
            appSecretInstagram,
          ),
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.erro ?? "Não deu para conectar.");
        return;
      }
      setToken("");
      setTokenInstagram("");
      setAppSecret("");
      setAppSecretInstagram("");
      aoConectar(d as SituacaoMeta);
    } catch {
      setErro(
        "O encEditor não respondeu. Confira se ele está ligado e tente de novo.",
      );
    } finally {
      setOcupado(false);
    }
  };

  const campo =
    "w-full border-2 border-tinta bg-zinc-950 px-2 py-1.5 font-mono text-xs outline-none focus:shadow-[3px_3px_0_var(--color-spray)]";
  const manter = trocando ? "em branco = manter a guardada" : undefined;

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm">
          {trocando ? "Nova chave de acesso" : "Chave de acesso (token)"}{" "}
          <span className="text-xs text-zinc-500">— começa com EAA</span>
        </span>
        <textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          rows={3}
          spellCheck={false}
          autoComplete="off"
          placeholder="EAA…"
          className={campo}
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={doisApps}
          onChange={(e) => setDoisApps(e.target.checked)}
        />
        Usei dois apps (um para os anúncios e outro para o Instagram)
      </label>
      {doisApps ? (
        <label className="block">
          <span className="mb-1 block text-sm">Chave do app do Instagram</span>
          <textarea
            value={tokenInstagram}
            onChange={(e) => setTokenInstagram(e.target.value)}
            rows={2}
            spellCheck={false}
            autoComplete="off"
            placeholder={manter ?? "EAA…"}
            className={campo}
          />
        </label>
      ) : null}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={comSegredo}
          onChange={(e) => setComSegredo(e.target.checked)}
        />
        O meu app exige a chave secreta (“Require App Secret” ligado)
      </label>
      {comSegredo ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm">
              Chave secreta do app{doisApps ? " dos anúncios" : ""} (App Secret)
            </span>
            <input
              type="password"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              autoComplete="off"
              placeholder={manter ?? "só se o app exige"}
              className={campo}
            />
          </label>
          {doisApps ? (
            <label className="block">
              <span className="mb-1 block text-sm">
                Chave secreta do app do Instagram
              </span>
              <input
                type="password"
                value={appSecretInstagram}
                onChange={(e) => setAppSecretInstagram(e.target.value)}
                autoComplete="off"
                placeholder={manter ?? "só se esse app exige"}
                className={campo}
              />
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          onClick={() => void conectar()}
          disabled={ocupado || token.trim().length < 20}
          className="botao-spray !px-4 !py-1.5 disabled:opacity-40"
        >
          {ocupado ? "Conferindo na Meta…" : "Conectar"}
        </button>
        <span className="text-xs text-zinc-500">
          A chave é conferida na Meta e guardada criptografada.
        </span>
      </div>
      {erro ? (
        <p className="border-2 border-spray bg-spray/10 p-2 text-sm">
          ⚠ {erro}
        </p>
      ) : null}
    </div>
  );
};
