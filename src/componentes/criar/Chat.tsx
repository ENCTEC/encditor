"use client";

import { useEffect, useRef, useState } from "react";
import { iniciarAnalise } from "@/componentes/AnaliseAutomatica";
import {
  aguardarAnalises,
  enviarArquivo,
  formatoDoArquivo,
  lerMetadados,
  papelSugerido,
  podeAnalisar,
  proximoNome,
  transcreverGravacao,
} from "@/projeto/midia-cliente";
import { novoId, useProjeto } from "@/projeto/ProjetoProvider";
import { Midia, PapelMidia } from "@/projeto/tipos";
import type { RespostaIA } from "@/app/api/ia/route";

type Anexo = {
  id: string;
  arquivo: File;
  formato: Midia["formato"];
  papel: PapelMidia;
  progresso: number | null;
};

const EXEMPLOS = [
  "Bote o Insert 1 a partir dos 2 segundos",
  "Coloque um fade entre todas as cenas",
  "Adicione o Áudio 1 como música de fundo",
  "Corte 2 segundos do começo da cena 2",
  "Legende o vídeo",
  "Coloque o Insert 2 quando eu falo “promoção”",
];

// Papéis possíveis por formato: vídeo pode ser cena ou insert; imagem só
// insert; áudio só áudio.
const PAPEIS: Record<Midia["formato"], PapelMidia[]> = {
  video: ["cena", "insert"],
  imagem: ["insert"],
  audio: ["audio"],
};

const ROTULO_PAPEL: Record<PapelMidia, string> = {
  cena: "Cena",
  insert: "Insert",
  audio: "Áudio",
};

export const Chat: React.FC = () => {
  const {
    projeto,
    adicionarMidia,
    adicionarMensagem,
    aplicar,
    obterTimeline,
    obterBiblioteca,
    atualizarAnalise,
  } = useProjeto();
  // Texto do indicador enquanto a IA trabalha ("Editando…").
  const [pensando, setPensando] = useState<string | null>(null);
  // Ditado: gravando (microfone aberto) ou transcrevendo a gravação.
  const [ditado, setDitado] = useState<"parado" | "gravando" | "transcrevendo">(
    "parado",
  );
  const gravador = useRef<MediaRecorder | null>(null);
  const [texto, setTexto] = useState("");
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const fimDaLista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: "smooth" });
  }, [projeto.mensagens.length, pensando]);

  const anexar = (arquivos: FileList | File[]) => {
    const novos: Anexo[] = [];
    const recusados: string[] = [];
    for (const arquivo of Array.from(arquivos)) {
      const formato = formatoDoArquivo(arquivo);
      if (!formato) {
        recusados.push(arquivo.name);
        continue;
      }
      novos.push({
        id: novoId(),
        arquivo,
        formato,
        papel: papelSugerido(formato),
        progresso: null,
      });
    }
    setAnexos((atuais) => [...atuais, ...novos]);
    setErro(
      recusados.length
        ? `Formato não suportado: ${recusados.join(", ")}`
        : null,
    );
  };

  const atualizarAnexo = (id: string, mudancas: Partial<Anexo>) =>
    setAnexos((atuais) =>
      atuais.map((a) => (a.id === id ? { ...a, ...mudancas } : a)),
    );

  const enviar = async () => {
    if (enviando || (!texto.trim() && anexos.length === 0)) return;
    setEnviando(true);
    setErro(null);

    // Biblioteca local para numerar certo vários arquivos do mesmo envio.
    const biblioteca = [...projeto.biblioteca];
    const enviados: Midia[] = [];
    const anexosEnviados = new Set<string>();

    for (const anexo of anexos) {
      try {
        const meta = await lerMetadados(anexo.arquivo, anexo.formato);
        atualizarAnexo(anexo.id, { progresso: 0 });
        const url = await enviarArquivo(anexo.arquivo, (p) =>
          atualizarAnexo(anexo.id, { progresso: p }),
        );
        const midia: Midia = {
          id: novoId(),
          nome: proximoNome(biblioteca, anexo.papel),
          papel: anexo.papel,
          formato: anexo.formato,
          url,
          nomeArquivo: anexo.arquivo.name,
          ...meta,
        };
        biblioteca.push(midia);
        enviados.push(midia);
        anexosEnviados.add(anexo.id);
        adicionarMidia(midia);
        if (podeAnalisar(midia)) iniciarAnalise(midia, atualizarAnalise);
      } catch (e) {
        // Para no primeiro erro; os anexos que faltam continuam na caixa.
        setErro(e instanceof Error ? e.message : String(e));
        setAnexos((atuais) =>
          atuais
            .filter((a) => !anexosEnviados.has(a.id))
            .map((a) => ({ ...a, progresso: null })),
        );
        if (enviados.length) await registrarMensagens(enviados, "");
        setEnviando(false);
        return;
      }
    }

    setTexto("");
    setAnexos([]);
    await registrarMensagens(enviados, texto.trim());
    setEnviando(false);
  };

  const registrarMensagens = async (enviados: Midia[], pedido: string) => {
    // Histórico antes desta mensagem (só texto), para a IA ter contexto.
    const historico = projeto.mensagens.map((m) => ({
      autor: m.autor,
      texto: m.texto,
    }));

    adicionarMensagem({
      autor: "usuario",
      texto: pedido,
      anexos: enviados.map((m) => m.id),
    });

    const partes: string[] = [];
    const cenas = enviados.filter((m) => m.papel === "cena");
    const outros = enviados.filter((m) => m.papel !== "cena");
    if (cenas.length) {
      partes.push(
        `Coloquei ${cenas.map((m) => m.nome).join(", ")} no fim da trilha principal.`,
      );
    }
    if (!pedido) {
      if (outros.length) {
        partes.push(
          `Guardei ${outros.map((m) => m.nome).join(", ")} na biblioteca — me diga onde usar.`,
        );
      }
      adicionarMensagem({ autor: "ia", texto: partes.join(" "), anexos: [] });
      return;
    }

    // Pedido em texto: a IA edita a timeline no servidor. Antes, espera a
    // análise dos arquivos (fala/visual) que ainda estiver em andamento.
    setPensando("Analisando os arquivos…");
    try {
      const analises = await aguardarAnalises();
      setPensando("Editando…");
      const atual = obterBiblioteca();
      const biblioteca = [
        ...atual,
        ...enviados.filter((e) => !atual.some((m) => m.id === e.id)),
      ].map((m) =>
        analises.has(m.id) ? { ...m, analise: analises.get(m.id) } : m,
      );
      const resposta = await fetch("/api/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedido,
          anexos: enviados.map((m) => m.nome),
          historico,
          timeline: obterTimeline(),
          biblioteca,
        }),
      });
      const dados = (await resposta.json().catch(() => ({}))) as Partial<
        RespostaIA & { erro: string }
      >;
      if (!resposta.ok || dados.erro) {
        throw new Error(dados.erro ?? `Falha na IA (${resposta.status}).`);
      }
      if (dados.timeline) {
        const nova = dados.timeline;
        if (!aplicar(() => nova)) {
          throw new Error("A edição da IA veio inválida e não foi aplicada.");
        }
      }
      partes.push(dados.resposta ?? "Pronto.");
    } catch (e) {
      partes.push(`⚠️ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPensando(null);
    }
    adicionarMensagem({ autor: "ia", texto: partes.join(" "), anexos: [] });
  };

  // Microfone: 1º clique grava, 2º clique para e transcreve para a caixa.
  const alternarDitado = async () => {
    if (ditado === "gravando") {
      gravador.current?.stop();
      return;
    }
    if (ditado !== "parado") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const pedacos: Blob[] = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => pedacos.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setDitado("transcrevendo");
        try {
          const falado = await transcreverGravacao(
            new Blob(pedacos, { type: rec.mimeType }),
          );
          if (falado)
            setTexto((t) => (t.trim() ? `${t.trim()} ${falado}` : falado));
        } catch (e) {
          setErro(e instanceof Error ? e.message : String(e));
        } finally {
          setDitado("parado");
        }
      };
      gravador.current = rec;
      rec.start();
      setDitado("gravando");
      setErro(null);
    } catch {
      setErro(
        "Não consegui acessar o microfone (verifique a permissão do navegador).",
      );
    }
  };

  const nomeDaMidia = (id: string) =>
    projeto.biblioteca.find((m) => m.id === id)?.nome ?? "arquivo";

  return (
    <div
      className={`flex h-full flex-col ${arrastando ? "bg-violet-950/30" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastando(false);
        anexar(e.dataTransfer.files);
      }}
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {projeto.mensagens.length === 0 ? (
          <div className="mx-auto mt-10 max-w-lg text-center">
            <h1 className="text-xl font-semibold">O que vamos editar hoje?</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Anexe as cenas geradas no Higgsfield (entram em ordem na trilha
              principal), inserts e áudios. Depois peça a edição em texto, como:
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {EXEMPLOS.map((exemplo) => (
                <li key={exemplo}>
                  <button
                    onClick={() => setTexto(exemplo)}
                    className="rounded-full border border-zinc-700 px-3 py-1 text-zinc-300 hover:border-violet-500 hover:text-white"
                  >
                    “{exemplo}”
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {projeto.mensagens.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.autor === "usuario" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.autor === "usuario"
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-800 text-zinc-100"
              }`}
            >
              {m.anexos.length ? (
                <div className="mb-1 flex flex-wrap gap-1">
                  {m.anexos.map((id) => (
                    <span
                      key={id}
                      className="rounded bg-black/25 px-2 py-0.5 text-xs"
                    >
                      📎 {nomeDaMidia(id)}
                    </span>
                  ))}
                </div>
              ) : null}
              {m.texto ? (
                <p className="whitespace-pre-wrap">{m.texto}</p>
              ) : null}
            </div>
          </div>
        ))}
        {pensando ? (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-zinc-800 px-4 py-2.5 text-sm text-zinc-400">
              <span className="animate-pulse">{pensando}</span>
            </div>
          </div>
        ) : null}
        <div ref={fimDaLista} />
      </div>

      <div className="border-t border-zinc-800 p-4">
        {anexos.length ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {anexos.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
              >
                <span className="max-w-40 truncate" title={a.arquivo.name}>
                  {a.arquivo.name}
                </span>
                {PAPEIS[a.formato].length > 1 ? (
                  <select
                    value={a.papel}
                    disabled={enviando}
                    onChange={(e) =>
                      atualizarAnexo(a.id, {
                        papel: e.target.value as PapelMidia,
                      })
                    }
                    className="rounded bg-zinc-800 px-1 py-0.5"
                  >
                    {PAPEIS[a.formato].map((p) => (
                      <option key={p} value={p}>
                        {ROTULO_PAPEL[p]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-zinc-400">{ROTULO_PAPEL[a.papel]}</span>
                )}
                {a.progresso !== null ? (
                  <span className="tabular-nums text-violet-300">
                    {Math.round(a.progresso * 100)}%
                  </span>
                ) : (
                  <button
                    disabled={enviando}
                    onClick={() =>
                      setAnexos((atuais) => atuais.filter((x) => x.id !== a.id))
                    }
                    className="text-zinc-500 hover:text-white"
                    aria-label={`Remover ${a.arquivo.name}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : null}

        {erro ? <p className="mb-2 text-sm text-red-400">{erro}</p> : null}

        <div className="flex items-end gap-2 rounded-xl border border-zinc-700 bg-zinc-900 p-2 focus-within:border-violet-500">
          <button
            onClick={() => inputArquivo.current?.click()}
            disabled={enviando}
            className="rounded-lg px-2 py-1.5 text-lg text-zinc-400 hover:bg-zinc-800 hover:text-white"
            title="Anexar arquivos"
          >
            📎
          </button>
          <input
            ref={inputArquivo}
            type="file"
            multiple
            accept="video/*,image/*,audio/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) anexar(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => void alternarDitado()}
            disabled={enviando || ditado === "transcrevendo"}
            className={`rounded-lg px-2 py-1.5 text-lg hover:bg-zinc-800 ${
              ditado === "gravando"
                ? "animate-pulse text-red-400"
                : "text-zinc-400 hover:text-white"
            }`}
            title={
              ditado === "gravando"
                ? "Parar e transcrever"
                : ditado === "transcrevendo"
                  ? "Transcrevendo…"
                  : "Falar (ditado)"
            }
          >
            {ditado === "transcrevendo"
              ? "…"
              : ditado === "gravando"
                ? "⏹"
                : "🎤"}
          </button>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void enviar();
              }
            }}
            rows={2}
            placeholder="Peça uma edição ou arraste arquivos para cá…"
            className="min-h-0 flex-1 resize-none bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-zinc-500"
          />
          <button
            onClick={() => void enviar()}
            disabled={enviando || (!texto.trim() && anexos.length === 0)}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
          >
            {enviando ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
};
