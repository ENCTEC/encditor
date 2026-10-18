"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnuncioMeta, InfoMeta, MidiaInstagram } from "@/conexoes/meta";
import type { VinculoAnuncio, Vinculos } from "@/conexoes/vinculos";

// Liga uma versão exportada ao post do Instagram em que ela foi publicada e
// aos anúncios que usam o vídeo. Depois de salvar, o servidor já busca os
// números (as miniaturas são guardadas, porque os links da Meta expiram).

type Lista<T> = {
  itens: T[];
  proximo: string | null;
  carregando: boolean;
  erro: string | null;
};
const vazia = <T,>(): Lista<T> => ({
  itens: [],
  proximo: null,
  carregando: false,
  erro: null,
});

const data = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      })
    : "";

// Status do anúncio como a Meta manda → português.
const STATUS: Record<string, string> = {
  ACTIVE: "ativo",
  PAUSED: "pausado",
  CAMPAIGN_PAUSED: "campanha pausada",
  ADSET_PAUSED: "conjunto pausado",
  ARCHIVED: "arquivado",
  IN_PROCESS: "processando",
  WITH_ISSUES: "com problemas",
  PENDING_REVIEW: "em análise",
  DISAPPROVED: "reprovado",
  PREAPPROVED: "pré-aprovado",
  PENDING_BILLING_INFO: "aguardando pagamento",
  DELETED: "excluído",
};

const ROTULO_TIPO: Record<string, string> = {
  REELS: "reel",
  FEED: "post",
  STORY: "story",
  AD: "anúncio",
};

export const ModalVinculos: React.FC<{
  clienteId: string;
  nome: string;
  atuais: Vinculos;
  info: InfoMeta;
  aoFechar: () => void;
  aoSalvar: (v: Vinculos) => Promise<void>;
}> = ({ clienteId, nome, atuais, info, aoFechar, aoSalvar }) => {
  const [contaIg, setContaIg] = useState(
    atuais.instagram?.contaId ?? info.instagrams[0]?.id ?? "",
  );
  const [contaAds, setContaAds] = useState(
    atuais.anuncios[0]?.contaId ?? info.contasAnuncio[0]?.id ?? "",
  );
  const [midias, setMidias] = useState<Lista<MidiaInstagram>>(vazia);
  const [anuncios, setAnuncios] = useState<Lista<AnuncioMeta>>(vazia);
  const [post, setPost] = useState(atuais.instagram);
  const [escolhidos, setEscolhidos] = useState<VinculoAnuncio[]>(
    atuais.anuncios,
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Anúncios já sugeridos (marcados sozinhos) para cada post: o que a
  // pessoa desmarcar depois não volta a ser marcado.
  const sugeridosJa = useRef(new Set<string>());

  const buscar = useCallback(
    async <T,>(
      tipo: "instagram" | "anuncios",
      conta: string,
      depois: string | null,
      definir: React.Dispatch<React.SetStateAction<Lista<T>>>,
    ) => {
      if (!conta) return;
      definir((l) => ({ ...l, carregando: true, erro: null }));
      const r = await fetch(
        `/api/conexoes/meta/listas?cliente=${clienteId}&tipo=${tipo}&conta=${conta}${depois ? `&depois=${encodeURIComponent(depois)}` : ""}`,
        { cache: "no-store" },
      ).catch(() => null);
      const d = r ? await r.json().catch(() => null) : null;
      if (!r?.ok || !d) {
        definir((l) => ({
          ...l,
          carregando: false,
          erro: d?.erro ?? "Não deu para buscar na Meta.",
        }));
        return;
      }
      definir((l) => ({
        itens: depois ? [...l.itens, ...(d.itens as T[])] : (d.itens as T[]),
        proximo: d.proximo,
        carregando: false,
        erro: null,
      }));
    },
    [clienteId],
  );

  useEffect(() => {
    void buscar<MidiaInstagram>("instagram", contaIg, null, setMidias);
  }, [buscar, contaIg]);
  useEffect(() => {
    void buscar<AnuncioMeta>("anuncios", contaAds, null, setAnuncios);
  }, [buscar, contaAds]);

  const usuarioIg =
    info.instagrams.find((i) => i.id === contaIg)?.usuario ?? null;
  const moedaDa = (conta: string) =>
    info.contasAnuncio.find((c) => c.id === conta)?.moeda ?? null;
  // Uma moeda só por versão (somar real com dólar não faz sentido).
  const moedaEscolhida = escolhidos.length
    ? moedaDa(escolhidos[0].contaId)
    : null;
  const moedaDaConta = moedaDa(contaAds);
  const outraMoeda =
    !!moedaEscolhida && !!moedaDaConta && moedaDaConta !== moedaEscolhida;
  const marcado = (id: string) => escolhidos.some((e) => e.anuncioId === id);
  const paraVinculo = useCallback(
    (a: AnuncioMeta): VinculoAnuncio => ({
      contaId: contaAds,
      anuncioId: a.id,
      nome: a.nome,
      miniatura: a.miniatura,
      tipo: a.tipo,
    }),
    [contaAds],
  );
  const alternarAnuncio = (a: AnuncioMeta) =>
    setEscolhidos((l) =>
      l.some((e) => e.anuncioId === a.id)
        ? l.filter((e) => e.anuncioId !== a.id)
        : [...l, paraVinculo(a)],
    );

  // Anúncios que usam o post escolhido entram marcados — também quando a
  // lista chega depois do clique ou quando a versão já tinha o post.
  const midiaDoPost = post?.midiaId ?? null;
  useEffect(() => {
    if (outraMoeda || !midiaDoPost) return;
    const novos = anuncios.itens.filter(
      (a) =>
        a.instagramMidiaId === midiaDoPost &&
        !sugeridosJa.current.has(`${midiaDoPost}:${a.id}`),
    );
    if (!novos.length) return;
    for (const a of novos) sugeridosJa.current.add(`${midiaDoPost}:${a.id}`);
    setEscolhidos((l) => [
      ...l,
      ...novos
        .filter((a) => !l.some((e) => e.anuncioId === a.id))
        .map(paraVinculo),
    ]);
  }, [midiaDoPost, anuncios.itens, outraMoeda, paraVinculo]);
  const sugeridos = midiaDoPost
    ? anuncios.itens.filter((a) => a.instagramMidiaId === midiaDoPost)
    : [];
  const sugeridosMarcados = sugeridos.filter((a) => marcado(a.id)).length;

  const escolherPost = (m: MidiaInstagram) => {
    if (post?.midiaId === m.id) {
      setPost(null);
      return;
    }
    setPost({
      contaId: contaIg,
      usuario: usuarioIg,
      midiaId: m.id,
      link: m.link,
      miniatura: m.miniatura,
      legenda: m.legenda,
      publicadoEm: m.publicadoEm,
      tipo: m.tipo,
    });
  };

  const salvar = async (v: Vinculos) => {
    setSalvando(true);
    setErro(null);
    try {
      await aoSalvar(v);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setSalvando(false);
    }
  };

  const seletor = "border-2 border-tinta bg-zinc-950 px-2 py-1 text-sm";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/60 p-4"
      onClick={(e) => e.target === e.currentTarget && !salvando && aoFechar()}
    >
      <div className="cartao-zine flex max-h-full w-full max-w-5xl flex-col bg-papel">
        <header className="border-b-2 border-tinta p-4">
          <p className="rotulo-zine">Ligar ao post e aos anúncios</p>
          <h2 className="font-display text-3xl leading-none uppercase">
            {nome}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Escolha onde este vídeo foi publicado. Os números entram sozinhos e
            se atualizam enquanto o encEditor estiver ligado.
          </p>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-2">
          <section className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="rotulo-zine">Instagram</p>
              {info.instagrams.length > 1 ? (
                <select
                  value={contaIg}
                  onChange={(e) => setContaIg(e.target.value)}
                  className={seletor}
                >
                  {info.instagrams.map((i) => (
                    <option key={i.id} value={i.id}>
                      @{i.usuario}
                    </option>
                  ))}
                </select>
              ) : usuarioIg ? (
                <span className="text-sm">@{usuarioIg}</span>
              ) : null}
            </div>
            {!info.instagrams.length ? (
              <p className="text-sm text-zinc-500">
                Nenhum Instagram conectado.
              </p>
            ) : (
              <>
                {midias.erro ? (
                  <p className="text-sm text-spray">⚠ {midias.erro}</p>
                ) : null}
                <div className="grid grid-cols-3 gap-2">
                  {midias.itens.map((m) => {
                    const sel = post?.midiaId === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => escolherPost(m)}
                        title={m.legenda ?? ""}
                        className={`relative aspect-[3/4] overflow-hidden border-2 text-left ${sel ? "border-spray shadow-[3px_3px_0_var(--color-spray)]" : "border-tinta"}`}
                      >
                        {m.miniatura ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.miniatura}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center p-1 text-[10px] text-zinc-500">
                            sem imagem
                          </span>
                        )}
                        <span className="absolute inset-x-0 bottom-0 bg-tinta/80 px-1 py-0.5 font-mono text-[10px] text-papel">
                          {sel ? "✓ " : ""}
                          {ROTULO_TIPO[m.tipo ?? ""] ?? "post"} ·{" "}
                          {data(m.publicadoEm)}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {midias.carregando ? (
                  <p className="text-xs text-zinc-500">Buscando posts…</p>
                ) : null}
                {midias.proximo && !midias.carregando ? (
                  <button
                    onClick={() =>
                      void buscar<MidiaInstagram>(
                        "instagram",
                        contaIg,
                        midias.proximo,
                        setMidias,
                      )
                    }
                    className="text-sm text-spray underline"
                  >
                    carregar mais posts
                  </button>
                ) : null}
              </>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="rotulo-zine">Anúncios</p>
              {info.contasAnuncio.length > 1 ? (
                <select
                  value={contaAds}
                  onChange={(e) => setContaAds(e.target.value)}
                  className={seletor}
                >
                  {info.contasAnuncio.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.moeda})
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            {escolhidos.length ? (
              <div className="space-y-1">
                <p className="text-xs text-zinc-500">
                  Ligados a esta versão ({escolhidos.length}):
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {escolhidos.map((e) => (
                    <li
                      key={e.anuncioId}
                      className="flex items-center gap-1 border border-spray px-1.5 py-0.5 text-xs"
                    >
                      {e.nome}
                      <button
                        onClick={() =>
                          setEscolhidos((l) =>
                            l.filter((x) => x.anuncioId !== e.anuncioId),
                          )
                        }
                        title="Tirar"
                        className="px-0.5 text-spray"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!info.contasAnuncio.length ? (
              <p className="text-sm text-zinc-500">
                Nenhuma conta de anúncios conectada.
              </p>
            ) : (
              <>
                {outraMoeda ? (
                  <p className="border-l-4 border-spray pl-2 text-xs">
                    Esta conta é em {moedaDaConta} e os anúncios ligados estão
                    em {moedaEscolhida}: não dá para somar moedas diferentes na
                    mesma versão.
                  </p>
                ) : null}
                {sugeridos.length ? (
                  <p className="border-l-4 border-verde pl-2 text-xs">
                    {sugeridos.length} anúncio(s) usam o post escolhido
                    {sugeridosMarcados === sugeridos.length
                      ? " — marcados."
                      : ` (${sugeridosMarcados} marcado(s)).`}
                  </p>
                ) : null}
                {anuncios.erro ? (
                  <p className="text-sm text-spray">⚠ {anuncios.erro}</p>
                ) : null}
                <ul className="space-y-1.5">
                  {anuncios.itens.map((a) => (
                    <li key={a.id}>
                      <label
                        className={`flex items-center gap-2 border-2 p-1.5 ${marcado(a.id) ? "border-spray" : "border-tinta"} ${outraMoeda ? "opacity-50" : "cursor-pointer"}`}
                      >
                        <input
                          type="checkbox"
                          checked={marcado(a.id)}
                          disabled={outraMoeda}
                          onChange={() => alternarAnuncio(a)}
                        />
                        {a.miniatura ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.miniatura}
                            alt=""
                            className="h-12 w-12 shrink-0 border border-tinta object-cover"
                          />
                        ) : null}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">
                            {a.nome}
                          </span>
                          <span className="block truncate font-mono text-[10px] text-zinc-500 uppercase">
                            {a.campanha ? `${a.campanha} · ` : ""}
                            {a.tipo ?? "outro objetivo"} ·{" "}
                            {a.status
                              ? (STATUS[a.status] ?? a.status.toLowerCase())
                              : ""}
                            {midiaDoPost && a.instagramMidiaId === midiaDoPost
                              ? " · usa este post"
                              : ""}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                {!anuncios.carregando &&
                !anuncios.erro &&
                !anuncios.itens.length ? (
                  <p className="text-xs text-zinc-500">
                    Nenhum anúncio nesta conta. Anúncios feitos por uma conta de
                    anúncios pessoal (por exemplo, “Impulsionar” direto pelo app
                    do Instagram) não aparecem aqui.
                  </p>
                ) : null}
                {anuncios.carregando ? (
                  <p className="text-xs text-zinc-500">Buscando anúncios…</p>
                ) : null}
                {anuncios.proximo && !anuncios.carregando ? (
                  <button
                    onClick={() =>
                      void buscar<AnuncioMeta>(
                        "anuncios",
                        contaAds,
                        anuncios.proximo,
                        setAnuncios,
                      )
                    }
                    className="text-sm text-spray underline"
                  >
                    carregar mais anúncios
                  </button>
                ) : null}
              </>
            )}
          </section>
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t-2 border-tinta p-4">
          {erro ? <p className="w-full text-sm text-spray">⚠ {erro}</p> : null}
          <button
            onClick={() =>
              void salvar({ instagram: post, anuncios: escolhidos })
            }
            disabled={salvando}
            className="botao-spray !px-4 !py-1.5 disabled:opacity-40"
          >
            {salvando
              ? "Salvando e buscando números…"
              : "Salvar e buscar números"}
          </button>
          <button
            onClick={() => void salvar({ instagram: null, anuncios: [] })}
            disabled={
              salvando || (!atuais.instagram && !atuais.anuncios.length)
            }
            className="border-2 border-tinta px-3 py-1 font-mono text-[11px] uppercase hover:bg-tinta hover:text-papel disabled:opacity-40"
          >
            Desligar tudo
          </button>
          <button
            onClick={aoFechar}
            disabled={salvando}
            className="ml-auto text-sm underline"
          >
            Cancelar
          </button>
        </footer>
      </div>
    </div>
  );
};
