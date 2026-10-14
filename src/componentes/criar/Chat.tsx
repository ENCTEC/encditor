"use client";

import { useEffect, useRef, useState } from "react";
import type { RespostaIA } from "@/app/api/ia/route";
import { ListaDeAnexos } from "@/componentes/ListaDeAnexos";
import {
  EVENTO_CITAR,
  inserirMencao,
  Prefixo,
  Sugestao,
  sugestoesDeMencao,
  SugestoesMencao,
  termoDeMencao,
  TextoComMencoes,
} from "@/componentes/Mencoes";
import { aguardarAnalises, transcreverGravacao } from "@/projeto/midia-cliente";
import { useProjeto } from "@/projeto/ProjetoProvider";
import { Midia } from "@/projeto/tipos";
import { useEnvio } from "@/projeto/useEnvio";
import { XSpray } from "@/componentes/Rabiscos";

const EXEMPLOS = [
  "Bote o Insert 1 a partir dos 2 segundos",
  "Coloque um fade entre todas as cenas",
  "Adicione o Áudio 1 como música de fundo",
  "Corte 2 segundos do começo da cena 2",
  "Legende o vídeo",
  "Coloque o @meuinsert quando eu falo “promoção”",
];

// "compacto" = coluna lateral nas abas Timeline e Arquivos.
export const Chat: React.FC<{ compacto?: boolean; aoOcultar?: () => void }> = ({
  compacto = false,
  aoOcultar,
}) => {
  const {
    projeto,
    adicionarMensagem,
    aplicar,
    obterTimeline,
    obterBiblioteca,
    limparChat,
    editarMidia,
  } = useProjeto();
  const envio = useEnvio();
  const [texto, setTexto] = useState("");
  // Texto do indicador enquanto a IA trabalha ("Editando…").
  const [pensando, setPensando] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  // Ditado: gravando (microfone aberto) ou transcrevendo a gravação.
  const [ditado, setDitado] = useState<"parado" | "gravando" | "transcrevendo">(
    "parado",
  );
  // Sugestões de @apelido enquanto digita.
  const [mencao, setMencao] = useState<{
    prefixo: Prefixo;
    termo: string;
    ativa: number;
  } | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const caixa = useRef<HTMLTextAreaElement>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const fimDaLista = useRef<HTMLDivElement>(null);

  const ocupado = envio.enviando || pensando !== null;
  const opcoesMencao = mencao
    ? sugestoesDeMencao(projeto.biblioteca, mencao.prefixo, mencao.termo)
    : [];

  // "Citar no chat" (menu Estilos): acrescenta a #tag na caixa de texto.
  useEffect(() => {
    const aoCitar = (e: Event) => {
      const tag = (e as CustomEvent<string>).detail;
      setTexto((t) => `${t.trim() ? `${t.trimEnd()} ` : ""}${tag} `);
      requestAnimationFrame(() => caixa.current?.focus());
    };
    window.addEventListener(EVENTO_CITAR, aoCitar);
    return () => window.removeEventListener(EVENTO_CITAR, aoCitar);
  }, []);

  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: "smooth" });
  }, [projeto.mensagens.length, pensando]);

  const enviar = async () => {
    const pedido = texto.trim();
    if (ocupado || (!pedido && envio.anexos.length === 0)) return;
    const { enviados, ok } = await envio.enviarTodos();
    if (!ok && !enviados.length) return;
    setTexto("");
    await registrarMensagens(enviados, ok ? pedido : "");
    if (!ok) setTexto(pedido);
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
    if (!pedido) {
      const nomes = enviados.map((m) => `${m.nome} (@${m.apelido})`);
      partes.push(
        `Guardei ${nomes.join(", ")} na biblioteca.`,
        cenas.length
          ? "Me diga a ordem das cenas (ex.: “monte na ordem @abertura, @produto”) ou peça “use a ordem em que enviei”."
          : "Me diga onde usar.",
      );
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
      for (const m of dados.midiasAlteradas ?? []) {
        editarMidia(m.id, m);
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
          if (falado) {
            setTexto((t) => (t.trim() ? `${t.trim()} ${falado}` : falado));
          }
        } catch (e) {
          envio.setErro(e instanceof Error ? e.message : String(e));
        } finally {
          setDitado("parado");
        }
      };
      gravador.current = rec;
      rec.start();
      setDitado("gravando");
      envio.setErro(null);
    } catch {
      envio.setErro(
        "Não consegui acessar o microfone (verifique a permissão do navegador).",
      );
    }
  };

  const atualizarMencao = (valor: string, cursor: number) => {
    const achado = termoDeMencao(valor, cursor);
    setMencao(achado ? { ...achado, ativa: 0 } : null);
  };

  const escolherMencao = (sugestao: Sugestao) => {
    const el = caixa.current;
    const cursor = el?.selectionStart ?? texto.length;
    const novo = inserirMencao(
      texto,
      cursor,
      mencao?.prefixo ?? "@",
      sugestao.valor,
    );
    setTexto(novo.texto);
    setMencao(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(novo.cursor, novo.cursor);
    });
  };

  const nomeDaMidia = (id: string) => {
    const m = projeto.biblioteca.find((x) => x.id === id);
    return m ? `${m.nome} · @${m.apelido}` : "arquivo";
  };

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
        envio.anexar(e.dataTransfer.files);
      }}
    >
      <div className="flex items-center gap-3 border-b-2 border-tinta px-4 py-1.5">
        <span className="rotulo-zine">Chat com a IA</span>
        <button
          onClick={() => {
            if (
              projeto.mensagens.length &&
              confirm("Apagar a conversa? A edição e os arquivos continuam.")
            ) {
              limparChat();
            }
          }}
          disabled={!projeto.mensagens.length || ocupado}
          className="ml-auto font-mono text-[11px] tracking-wider text-zinc-500 uppercase hover:text-spray disabled:opacity-30 disabled:hover:text-zinc-500"
        >
          Limpar chat
        </button>
        {aoOcultar ? (
          <button
            onClick={aoOcultar}
            className="font-mono text-[11px] tracking-wider text-zinc-500 uppercase hover:text-tinta"
            title="Ocultar o chat (a conversa continua)"
          >
            Ocultar ›
          </button>
        ) : null}
      </div>

      <div
        className={`min-h-0 flex-1 space-y-4 overflow-y-auto ${compacto ? "px-4 py-4" : "px-6 py-6"}`}
      >
        {projeto.mensagens.length === 0 ? (
          // Tela inicial em composição de pôster.
          <div
            className={`relative mx-auto max-w-2xl pl-10 ${compacto ? "mt-1" : "mt-4"}`}
          >
            <span className="rotulo-zine absolute top-1 left-0 rotate-180 [writing-mode:vertical-rl]">
              Nº 1 — edição com IA — cenas · inserts · áudio
            </span>
            <h1
              className={`relative font-display leading-[0.82] tracking-tight text-tinta uppercase ${compacto ? "text-5xl" : "text-7xl"}`}
            >
              O que
              <br />
              vamos
              <br />
              editar
              <span
                className={`absolute top-[58%] -rotate-12 font-marca normal-case text-spray ${compacto ? "left-[9.5rem] text-4xl" : "left-[13.5rem] text-6xl"}`}
              >
                hoje?!
              </span>
            </h1>
            <XSpray className="top-2 right-10 h-12 w-16 rotate-6" />
            <p className="mt-6 max-w-md font-mono text-xs leading-relaxed text-zinc-400">
              Anexe as cenas do Higgsfield (entram em ordem na trilha
              principal), inserts e áudios — ou suba tudo pela aba Arquivos.
              Cite um arquivo com @apelido, fale pelo 🎤 e peça a edição:
            </p>
            <ul className="mt-5 flex flex-wrap gap-2 text-sm">
              {EXEMPLOS.map((exemplo, i) => (
                <li key={exemplo}>
                  <button
                    onClick={() => setTexto(exemplo)}
                    className={`border-2 border-tinta bg-zinc-950 px-3 py-1 text-left hover:bg-tinta hover:text-papel ${
                      i % 2 ? "rotate-[0.6deg]" : "-rotate-[0.6deg]"
                    }`}
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
              className={`max-w-[80%] px-4 py-2.5 text-sm leading-relaxed ${
                m.autor === "usuario"
                  ? "balao-usuario -rotate-[0.5deg] border-2 border-tinta bg-spray text-papel shadow-[3px_3px_0_var(--color-tinta)]"
                  : "balao-ia cartao-zine text-tinta"
              }`}
            >
              {m.anexos.length ? (
                <div className="mb-1 flex flex-wrap gap-1">
                  {m.anexos.map((id) => (
                    <span
                      key={id}
                      className="bg-tinta/80 px-2 py-0.5 font-mono text-[11px] text-papel"
                    >
                      📎 {nomeDaMidia(id)}
                    </span>
                  ))}
                </div>
              ) : null}
              {m.texto ? (
                <p className="whitespace-pre-wrap">
                  <TextoComMencoes
                    texto={m.texto}
                    biblioteca={projeto.biblioteca}
                  />
                </p>
              ) : null}
            </div>
          </div>
        ))}
        {pensando ? (
          <div className="flex justify-start">
            <div className="cartao-zine px-4 py-2.5">
              <span className="animate-pulse font-marca text-spray">
                {pensando}
              </span>
            </div>
          </div>
        ) : null}
        <div ref={fimDaLista} />
      </div>

      <div className="border-t border-zinc-800 p-4">
        {envio.anexos.length ? (
          <div className="mb-3">
            <ListaDeAnexos envio={envio} variante="compacta" />
          </div>
        ) : null}

        {envio.erro ? (
          <p className="mb-2 text-sm text-red-400">{envio.erro}</p>
        ) : null}

        <div className="relative flex items-end gap-2 border-2 border-tinta bg-zinc-950 p-2 shadow-[4px_4px_0_var(--color-tinta)] focus-within:shadow-[4px_4px_0_var(--color-spray)]">
          {opcoesMencao.length ? (
            <SugestoesMencao
              opcoes={opcoesMencao}
              ativa={mencao?.ativa ?? 0}
              aoEscolher={escolherMencao}
            />
          ) : null}
          <button
            onClick={() => inputArquivo.current?.click()}
            disabled={ocupado}
            className="px-2 py-1.5 text-lg text-zinc-400 hover:bg-zinc-800 hover:text-tinta"
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
              if (e.target.files) envio.anexar(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => void alternarDitado()}
            disabled={ocupado || ditado === "transcrevendo"}
            className={`px-2 py-1.5 text-lg hover:bg-zinc-800 ${
              ditado === "gravando"
                ? "animate-pulse text-red-400"
                : "text-zinc-400 hover:text-tinta"
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
            ref={caixa}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              atualizarMencao(e.target.value, e.target.selectionStart);
            }}
            onClick={(e) =>
              atualizarMencao(texto, e.currentTarget.selectionStart)
            }
            onBlur={() => setMencao(null)}
            onKeyDown={(e) => {
              if (opcoesMencao.length && mencao) {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  const passo = e.key === "ArrowDown" ? 1 : -1;
                  setMencao({
                    ...mencao,
                    ativa:
                      (mencao.ativa + passo + opcoesMencao.length) %
                      opcoesMencao.length,
                  });
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  escolherMencao(opcoesMencao[mencao.ativa]);
                  return;
                }
                if (e.key === "Escape") {
                  setMencao(null);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void enviar();
              }
            }}
            rows={2}
            placeholder="Peça uma edição: @ cita arquivos, # cita transições e legendas…"
            className="min-h-0 flex-1 resize-none bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-zinc-500"
          />
          <button
            onClick={() => void enviar()}
            disabled={ocupado || (!texto.trim() && envio.anexos.length === 0)}
            className="botao-spray"
          >
            {envio.enviando ? "Enviando…" : pensando ? "Editando…" : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
};
