"use client";

import { useRef, useState } from "react";
import { formatarTempo } from "@/componentes/Biblioteca";
import { iniciarAnalise } from "@/componentes/AnaliseAutomatica";
import { ListaDeAnexos } from "@/componentes/ListaDeAnexos";
import { gerarLegendas, palavrasDaMidia } from "@/ia/conteudo";
import {
  extrairAudioDoVideo,
  gerarApelido,
  lerDuracaoDaUrl,
  normalizarApelido,
  podeAnalisar,
  proximoNome,
} from "@/projeto/midia-cliente";
import { novoId, useProjeto } from "@/projeto/ProjetoProvider";
import { Midia } from "@/projeto/tipos";
import { useEnvio } from "@/projeto/useEnvio";

const PAPEL: Record<Midia["papel"], string> = {
  cena: "Cena",
  insert: "Insert",
  audio: "Áudio",
};

// Campo do apelido: aplica ao sair do campo ou com Enter.
const CampoApelido: React.FC<{ midia: Midia }> = ({ midia }) => {
  const { editarMidia } = useProjeto();
  const [rascunho, setRascunho] = useState(midia.apelido);
  const confirmar = () => {
    const apelido = normalizarApelido(rascunho);
    if (apelido === midia.apelido) return setRascunho(apelido);
    if (!editarMidia(midia.id, { apelido })) setRascunho(midia.apelido);
    else setRascunho(apelido);
  };
  return (
    <label className="flex items-center border border-zinc-700 bg-zinc-900 px-1.5 focus-within:border-violet-500">
      <span className="text-violet-300">@</span>
      <input
        value={rascunho}
        onChange={(e) => setRascunho(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="w-32 bg-transparent py-1 outline-none"
        aria-label={`Apelido de ${midia.nome}`}
      />
    </label>
  );
};

// O que a IA sabe do arquivo (ou o botão para analisar).
const SituacaoIA: React.FC<{ midia: Midia }> = ({ midia }) => {
  const { editarMidia, atualizarAnalise } = useProjeto();
  const [aberto, setAberto] = useState(false);

  if (!midia.url.startsWith("/api/midia/")) {
    return <span className="text-zinc-500">exemplo (sem análise)</span>;
  }

  const analisar = () => {
    const atualizada = { ...midia, usarIA: true };
    editarMidia(midia.id, { usarIA: true });
    if (podeAnalisar(atualizada)) iniciarAnalise(atualizada, atualizarAnalise);
  };

  if (!midia.usarIA) {
    return (
      <button
        onClick={analisar}
        className="border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-violet-500 hover:text-tinta"
        title="Arquivo frio: a IA não sabe o que ele fala ou mostra"
      >
        ❄ frio — analisar com IA
      </button>
    );
  }

  const analise = midia.analise;
  if (!analise || analise.status === "analisando") {
    return <span className="animate-pulse text-violet-300">analisando…</span>;
  }
  if (analise.status === "erro") {
    return (
      <button
        onClick={analisar}
        title={analise.erro ?? ""}
        className="text-amber-400 hover:text-amber-200"
      >
        ⚠ erro — analisar de novo
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={() => setAberto(!aberto)}
        className="text-emerald-400 hover:text-emerald-200"
      >
        ✓{" "}
        {[analise.transcricao && "fala", analise.visual && "visual"]
          .filter(Boolean)
          .join(" + ") || "sem fala"}{" "}
        {aberto ? "▴" : "▾"}
      </button>
      {aberto ? (
        <div className="mt-2 max-w-xl space-y-2 text-zinc-300">
          {analise.visual ? (
            <div>
              <p className="text-zinc-400">{analise.visual.resumo}</p>
              <ul className="mt-1 space-y-0.5">
                {analise.visual.momentos.map((m, i) => (
                  <li key={i}>
                    <span className="tabular-nums text-zinc-500">
                      {m.de}s–{m.ate}s
                    </span>{" "}
                    {m.descricao}
                    {m.texto_na_tela ? (
                      <span className="text-amber-300">
                        {" "}
                        — texto: “{m.texto_na_tela}”
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {analise.transcricao ? (
            <p className="whitespace-pre-wrap border-l-2 border-zinc-700 pl-2 italic">
              “{analise.transcricao.texto}”
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

// Ações extras: tirar o áudio de um vídeo (vira um arquivo de áudio novo,
// já mandado para transcrição) e legendar o vídeo com a fala do arquivo.
const AcoesDoArquivo: React.FC<{ midia: Midia }> = ({ midia }) => {
  const { obterBiblioteca, adicionarMidia, atualizarAnalise, aplicar } =
    useProjeto();
  const [extraindo, setExtraindo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const extrair = async () => {
    setExtraindo(true);
    setAviso(null);
    try {
      const url = await extrairAudioDoVideo(midia.url, false);
      const biblioteca = obterBiblioteca();
      const audio: Midia = {
        id: novoId(),
        nome: proximoNome(biblioteca, "audio"),
        apelido: gerarApelido(
          `${midia.apelido.slice(0, 24)}-audio`,
          biblioteca,
        ),
        usarIA: true,
        papel: "audio",
        formato: "audio",
        url,
        nomeArquivo: `${midia.nomeArquivo} (áudio)`,
        duracao: (await lerDuracaoDaUrl(url)) ?? midia.duracao,
        largura: null,
        altura: null,
      };
      adicionarMidia(audio);
      iniciarAnalise(audio, atualizarAnalise);
      setAviso(`✓ virou ${audio.nome} (@${audio.apelido})`);
    } catch (e) {
      setAviso(`⚠ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExtraindo(false);
    }
  };

  const legendar = () => {
    let quantas = 0;
    const ok = aplicar((t) => {
      const legendas = gerarLegendas(
        palavrasDaMidia(t, obterBiblioteca(), midia),
        6,
      );
      quantas = legendas.length;
      return { ...t, legendas };
    });
    setAviso(
      ok && quantas
        ? `✓ ${quantas} legendas criadas (Ctrl+Z desfaz)`
        : "⚠ a fala deste arquivo não aparece no trecho usado na timeline",
    );
  };

  const podeExtrair =
    midia.formato === "video" && midia.url.startsWith("/api/midia/");
  const temFala = Boolean(midia.analise?.transcricao?.palavras.length);
  if (!podeExtrair && !temFala) return null;

  return (
    <div className="flex flex-col items-start gap-1">
      {podeExtrair ? (
        <button
          onClick={() => void extrair()}
          disabled={extraindo}
          className="border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-violet-500 hover:text-tinta disabled:opacity-50"
          title="Cria um arquivo de áudio com o som deste vídeo (o vídeo continua na biblioteca)"
        >
          {extraindo ? "extraindo…" : "♪ extrair áudio"}
        </button>
      ) : null}
      {temFala ? (
        <button
          onClick={legendar}
          className="border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-violet-500 hover:text-tinta"
          title="Troca as legendas do vídeo pela fala deste arquivo, sincronizada palavra por palavra (vale mesmo com o arquivo mudo ou fora da timeline)"
        >
          ✎ legendar com esta fala
        </button>
      ) : null}
      {aviso ? (
        <span
          className={aviso.startsWith("⚠") ? "text-spray" : "text-emerald-400"}
        >
          {aviso}
        </span>
      ) : null}
    </div>
  );
};

// Arquivos "frios" (sem descrição da IA) que já estão no banco: analisar
// todos de uma vez, para o planejador e o chat poderem reaproveitá-los.
// Custo medido: ~US$ 0,01 por vídeo curto, ~US$ 0,005 por imagem.
const AnalisarFrios: React.FC = () => {
  const { projeto, editarMidia, atualizarAnalise } = useProjeto();
  const frios = projeto.biblioteca.filter(
    (m) =>
      m.formato !== "audio" &&
      m.url.startsWith("/api/midia/") &&
      m.usarIA === false,
  );
  if (!frios.length) return null;
  const videos = frios.filter((m) => m.formato === "video").length;
  const custo = videos * 0.01 + (frios.length - videos) * 0.005;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 border-2 border-dashed border-tinta px-3 py-2 text-sm">
      <span>
        ❄ <b>{frios.length}</b> arquivo(s) do banco sem descrição da IA — o
        planejador e o chat não sabem o que eles mostram.
      </span>
      <button
        onClick={() => {
          for (const m of frios) {
            editarMidia(m.id, { usarIA: true });
            iniciarAnalise({ ...m, usarIA: true }, atualizarAnalise);
          }
        }}
        className="botao-spray !px-3 !py-1 !text-sm"
      >
        Analisar todos (≈ US$ {custo.toFixed(2).replace(".", ",")})
      </button>
    </div>
  );
};

// Aba "Arquivos": subir inserts/cenas/áudios escolhendo se a IA analisa
// cada um, e gerenciar os apelidos (@) usados para citar no chat.
export default function PaginaArquivos() {
  const { projeto, carregado, meta } = useProjeto();
  const envio = useEnvio();
  const [arrastando, setArrastando] = useState(false);
  const inputArquivo = useRef<HTMLInputElement>(null);

  if (!carregado) return null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-8 p-6">
        <section>
          <h1 className="relative inline-block font-display text-6xl leading-none tracking-tight uppercase">
            Arquivos
            <span className="absolute -top-5 -right-44 -rotate-12 font-marca text-3xl normal-case text-spray">
              suba tudo!
            </span>
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Suba cenas, inserts, imagens e áudios. Vídeos e imagens são
            descritos pela IA (fala + o que aparece, com minutagem) e ficam no
            banco do cliente para serem reaproveitados nos próximos vídeos;
            desmarque para deixar um arquivo <b>frio</b> (sem custo). Cite no
            chat com o @apelido. Para legendar com a fala de um vídeo, envie-o
            como <b>Só o áudio</b> (ou use “extrair áudio” na biblioteca).
          </p>
          {meta ? (
            <p className="mt-3 inline-block border-2 border-tinta px-3 py-1.5 font-mono text-xs">
              📁 Banco de mídia de <b>{meta.cliente.nome}</b> — compartilhado
              por todos os vídeos desse cliente.
            </p>
          ) : null}
          <AnalisarFrios />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastando(false);
              envio.anexar(e.dataTransfer.files);
            }}
            onClick={() => inputArquivo.current?.click()}
            className={`mt-6 flex cursor-pointer flex-col items-center justify-center border-[3px] border-dashed px-6 py-10 font-mono text-xs uppercase tracking-widest ${
              arrastando
                ? "border-spray bg-violet-950/40 text-tinta"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}
          >
            <span className="font-display text-4xl text-spray">↑</span>
            Arraste arquivos aqui ou clique para escolher
            <span className="mt-1 text-xs text-zinc-500">
              Vídeos, imagens e áudios
            </span>
          </div>
          <input
            ref={inputArquivo}
            type="file"
            multiple
            accept="video/*,image/*,audio/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) envio.anexar(e.target.files);
              e.target.value = "";
            }}
          />

          {envio.anexos.length ? (
            <div className="mt-4 space-y-3">
              <ListaDeAnexos envio={envio} variante="completa" />
              <div className="flex items-center gap-3">
                <button
                  onClick={() => void envio.enviarTodos()}
                  disabled={envio.enviando}
                  className="botao-spray"
                >
                  {envio.enviando
                    ? "Enviando…"
                    : `Enviar ${envio.anexos.length} arquivo(s)`}
                </button>
                <span className="text-xs text-zinc-500">
                  Tudo fica na biblioteca. Depois, diga no chat a ordem das
                  cenas — ou use “+ trilha” na Timeline.
                </span>
              </div>
            </div>
          ) : null}
          {envio.erro ? (
            <p className="mt-2 text-sm text-red-400">{envio.erro}</p>
          ) : null}
        </section>

        <section>
          <h2 className="rotulo-zine mb-3">
            Biblioteca ({projeto.biblioteca.length})
          </h2>
          {projeto.biblioteca.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhum arquivo ainda.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-zinc-500">
                <tr className="border-b border-zinc-800">
                  <th className="py-2 font-medium">Nome</th>
                  <th className="py-2 font-medium">Apelido</th>
                  <th className="py-2 font-medium">Tipo</th>
                  <th className="py-2 font-medium">Duração</th>
                  <th className="py-2 font-medium">IA</th>
                  <th className="py-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {projeto.biblioteca.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-zinc-800/60 align-top"
                  >
                    <td className="py-2 pr-3">
                      <div className="font-medium">{m.nome}</div>
                      <div
                        className="max-w-56 truncate text-xs text-zinc-500"
                        title={m.nomeArquivo}
                      >
                        {m.nomeArquivo}
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      <CampoApelido midia={m} />
                    </td>
                    <td className="py-2 pr-3 text-zinc-400">
                      {PAPEL[m.papel]}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-zinc-400">
                      {m.duracao !== null ? formatarTempo(m.duracao) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      <SituacaoIA midia={m} />
                    </td>
                    <td className="py-2 text-xs">
                      <AcoesDoArquivo midia={m} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
