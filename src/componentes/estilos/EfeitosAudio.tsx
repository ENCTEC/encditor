"use client";

import { useRef, useState } from "react";
import { EfeitoAudio, EFEITOS_AUDIO } from "@/catalogo/estilos";
import { citarNoChat } from "@/componentes/Mencoes";
import { useProjeto } from "@/projeto/ProjetoProvider";
import { useEfeitosAudio } from "@/projeto/useEfeitos";

// Seção "Efeitos de áudio" da aba Estilos: ouvir a voz de exemplo sem e
// com cada efeito, citar no chat ou aplicar num arquivo do projeto.

const botao =
  "border-2 border-tinta px-2.5 py-1 font-mono text-[11px] tracking-wider uppercase hover:bg-tinta hover:text-papel disabled:opacity-40";

// Um único player de áudio para a página (tocar um para os outros).
const useTocador = () => {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [tocando, setTocando] = useState<string | null>(null);
  const tocar = (chave: string, src: string) => {
    audio.current?.pause();
    if (tocando === chave) {
      setTocando(null);
      return;
    }
    const el = new Audio(src);
    el.onended = () => setTocando(null);
    audio.current = el;
    void el.play();
    setTocando(chave);
  };
  return { tocar, tocando };
};

export const EfeitosAudio: React.FC = () => {
  const { projeto } = useProjeto();
  const { alternarEfeito, processando, erro } = useEfeitosAudio();
  const { tocar, tocando } = useTocador();
  const [alvo, setAlvo] = useState<Record<string, string>>({});

  const comSom = projeto.biblioteca.filter(
    (m) => m.formato !== "imagem" && m.url.startsWith("/api/midia/"),
  );

  return (
    <section>
      <h2 className="rotulo-zine mb-1">Efeitos de áudio</h2>
      <p className="mb-3 text-sm text-zinc-500">
        Valem para áudios e para o som dos vídeos. O arquivo original fica
        guardado: dá para tirar o efeito quando quiser.
      </p>
      {erro ? <p className="mb-3 text-sm text-spray">{erro}</p> : null}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {EFEITOS_AUDIO.map((ef) => {
          const usando = projeto.biblioteca.filter((m) =>
            m.efeitosAudio?.includes(ef.id),
          );
          const escolhido =
            comSom.find((m) => m.id === alvo[ef.id]) ?? comSom[0];
          const jaTem = escolhido?.efeitosAudio?.includes(ef.id);
          return (
            <article key={ef.id} className="cartao-zine flex flex-col p-3">
              <div className="flex items-baseline gap-2">
                <h3 className="font-display text-2xl leading-none tracking-wide uppercase">
                  {ef.nome}
                </h3>
                <span className="font-mono text-xs text-spray">{ef.tag}</span>
              </div>
              <p className="mt-1.5 text-sm">{ef.descricao}</p>
              <p className="mt-1 text-xs text-zinc-500">
                <b className="font-mono tracking-wider uppercase">Use em:</b>{" "}
                {ef.quandoUsar}
              </p>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() =>
                    tocar(`original-${ef.id}`, "/exemplos/voz-exemplo.mp3")
                  }
                  className={`${botao} flex-1 ${tocando === `original-${ef.id}` ? "bg-tinta text-papel" : ""}`}
                >
                  {tocando === `original-${ef.id}` ? "■ parar" : "▶ original"}
                </button>
                <button
                  onClick={() =>
                    tocar(ef.id, `/api/efeitos/exemplo?efeito=${ef.id}`)
                  }
                  className={`flex-1 border-2 border-spray px-2.5 py-1 font-mono text-[11px] tracking-wider uppercase ${
                    tocando === ef.id
                      ? "bg-spray text-papel"
                      : "text-spray hover:bg-spray hover:text-papel"
                  }`}
                >
                  {tocando === ef.id ? "■ parar" : "▶ com efeito"}
                </button>
              </div>

              {usando.length ? (
                <p className="mt-2 font-mono text-[11px] text-zinc-500">
                  Em uso: {usando.map((m) => `@${m.apelido}`).join(", ")}
                </p>
              ) : null}

              <div className="mt-auto flex flex-col gap-2 pt-3">
                <button onClick={() => citarNoChat(ef.tag)} className={botao}>
                  Citar {ef.tag} no chat
                </button>
                {comSom.length ? (
                  <div className="flex gap-2">
                    <select
                      value={escolhido?.id}
                      onChange={(e) =>
                        setAlvo({ ...alvo, [ef.id]: e.target.value })
                      }
                      className="min-w-0 flex-1 border-2 border-tinta bg-zinc-950 px-1 text-xs"
                      aria-label="Arquivo para aplicar o efeito"
                    >
                      {comSom.map((m) => (
                        <option key={m.id} value={m.id}>
                          @{m.apelido} — {m.nome}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={!escolhido || processando !== null}
                      onClick={() =>
                        escolhido &&
                        void alternarEfeito(escolhido, ef.id as EfeitoAudio)
                      }
                      className="botao-spray !px-3 !py-1 !text-sm"
                    >
                      {processando === escolhido?.id
                        ? "aplicando…"
                        : jaTem
                          ? "tirar"
                          : "aplicar"}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">
                    Envie um áudio ou vídeo para aplicar.
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
