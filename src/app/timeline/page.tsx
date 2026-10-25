"use client";

import { CallbackListener, PlayerRef } from "@remotion/player";
import { useEffect, useRef, useState } from "react";
import { Biblioteca } from "@/componentes/Biblioteca";
import { PreviewPlayer } from "@/componentes/PreviewPlayer";
import { Inspetor } from "@/componentes/timeline/Inspetor";
import { Selecao, Trilhas } from "@/componentes/timeline/Trilhas";
import { useProjeto } from "@/projeto/ProjetoProvider";
import { Midia } from "@/projeto/tipos";
import { PopupPosicao } from "@/componentes/timeline/PopupPosicao";
import { posicionarInserts } from "@/componentes/PosicionadorDeInserts";
import {
  AcabamentoCaixa,
  Caixa,
  caixaNaGrade,
  ehTelaCheia,
  TAMANHOS,
} from "@/timeline/caixas";
import { IdSom, MOTIONS, SONS } from "@/catalogo/estilos";
import { adicionarSom } from "@/timeline/efeitosSonoros";
import { adicionarItem, colocarCena, removerItem } from "@/timeline/operacoes";

const arredondar = (n: number) => Math.round(n * 100) / 100;

// Aba "Timeline": ajustes finais à mão. Preview em cima, inspetor à
// direita e as faixas embaixo.
export default function PaginaTimeline() {
  const { projeto, carregado, aplicar } = useProjeto();
  const { timeline } = projeto;
  const player = useRef<PlayerRef>(null);
  const [frame, setFrame] = useState(0);
  const [selecao, setSelecao] = useState<Selecao>(null);
  // Popup de posição/tamanho de um insert NOVO (da biblioteca). Inserts
  // que já estão na timeline usam o popup global (PosicionadorDeInserts).
  const [popup, setPopup] = useState<{ midia: Midia; inicio: number } | null>(
    null,
  );

  const segundoAtual = frame / timeline.fps;
  const temClipes = timeline.clipes.length > 0;

  // Acompanha o frame do player para mover o cursor da timeline.
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const aoMudar: CallbackListener<"frameupdate"> = (e) =>
      setFrame(e.detail.frame);
    p.addEventListener("frameupdate", aoMudar);
    return () => p.removeEventListener("frameupdate", aoMudar);
  }, [carregado, temClipes]);

  // Delete/Backspace remove o item selecionado (fora de campos de texto).
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo.closest("input, textarea, select")) return;
      // Espaço toca/pausa (o player já trata quando ele mesmo tem o foco).
      if (e.key === " " && !alvo.closest(".__remotion-player")) {
        e.preventDefault();
        player.current?.toggle();
        return;
      }
      // Shift+Delete é "remover trecho e fechar o buraco" (nas Trilhas).
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !e.shiftKey &&
        selecao
      ) {
        e.preventDefault();
        if (aplicar((t) => removerItem(t, selecao.faixa, selecao.indice))) {
          setSelecao(null);
        }
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [selecao, aplicar]);

  if (!carregado) return null;

  const buscar = (segundo: number) => {
    const f = Math.round(segundo * timeline.fps);
    setFrame(f);
    player.current?.seekTo(f);
  };

  const inicio = arredondar(segundoAtual);

  const adicionar = (faixa: "legendas" | "zooms" | "motions" | "efeitos") => {
    const novoIndice = timeline[faixa].length;
    const exemplo = MOTIONS[0].exemplo;
    const ok = aplicar((t) => {
      switch (faixa) {
        case "legendas":
          return adicionarItem(t, "legendas", {
            texto: "Nova legenda",
            inicio,
            fim: inicio + 2,
          });
        case "zooms":
          return adicionarItem(t, "zooms", {
            inicio,
            fim: inicio + 2,
            escala: 1.3,
            focoX: 50,
            focoY: 50,
          });
        // Começa com a frase de impacto; o modelo muda no inspetor.
        case "motions":
          return adicionarItem(t, "motions", {
            modelo: MOTIONS[0].id,
            inicio,
            fim: arredondar(inicio + 2),
            texto: exemplo.texto,
          });
        case "efeitos":
          return adicionarItem(t, "efeitos", {
            tipo: "tremor",
            inicio,
            fim: arredondar(inicio + 0.5),
          });
      }
    });
    if (ok) setSelecao({ faixa, indice: novoIndice });
  };

  const adicionarEfeitoSonoro = (id: IdSom) => {
    const novoIndice = timeline.audios.length;
    if (aplicar((t) => adicionarSom(t, id, inicio))) {
      setSelecao({ faixa: "audios", indice: novoIndice });
    }
  };

  const colocarDaBiblioteca = (midia: Midia) => {
    if (midia.papel === "cena" && midia.formato === "video") {
      const novoIndice = timeline.clipes.length;
      if (aplicar((t) => colocarCena(t, midia))) {
        setSelecao({ faixa: "clipes", indice: novoIndice });
      }
      return;
    }
    const duracao = midia.duracao ?? 3;
    if (midia.papel === "audio") {
      const novoIndice = timeline.audios.length;
      const ok = aplicar((t) =>
        adicionarItem(t, "audios", {
          url: midia.url,
          inicio,
          fim: arredondar(inicio + duracao),
          origemInicio: 0,
          volume: 1,
          fadeEntrada: 0,
          fadeSaida: 0,
        }),
      );
      if (ok) setSelecao({ faixa: "audios", indice: novoIndice });
      return;
    }
    // Insert: primeiro escolhe onde fica e o tamanho (popup).
    setPopup({ midia, inicio });
  };

  const confirmarPopup = (caixa: Caixa, acabamento: AcabamentoCaixa) => {
    if (!popup) return;
    const posicao = ehTelaCheia(caixa) ? "tela-cheia" : "janela";
    const { midia, inicio: de } = popup;
    const novoIndice = timeline.inserts.length;
    const ok = aplicar((t) =>
      adicionarItem(t, "inserts", {
        url: midia.url,
        tipo: midia.formato === "imagem" ? "imagem" : "video",
        inicio: de,
        fim: arredondar(de + Math.min(3, midia.duracao ?? 3)),
        origemInicio: 0,
        posicao,
        volume: 0,
        caixa,
        acabamento,
      }),
    );
    if (ok) setSelecao({ faixa: "inserts", indice: novoIndice });
    setPopup(null);
  };

  // Dados do popup do insert novo: mídia, quadro de fundo e valores iniciais.
  const dadosPopup = popup
    ? {
        titulo: `Posicionar ${popup.midia.nome}`,
        midia: popup.midia,
        fundo: timeline,
        segundo: popup.inicio,
        inicial: {
          caixa: caixaNaGrade(
            "canto-sup-dir",
            TAMANHOS.M,
            popup.midia.largura && popup.midia.altura
              ? popup.midia.largura / popup.midia.altura
              : 16 / 9,
            timeline.largura / timeline.altura,
          ),
          acabamento: { borda: true, cantos: true, sombra: true },
        },
      }
    : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          <PreviewPlayer
            ref={player}
            timeline={timeline}
            className="min-h-0 flex-1"
          />
          <div className="flex items-center gap-2">
            <span className="tabular-nums text-sm text-zinc-400">
              {segundoAtual.toFixed(2)}s
            </span>
            <button
              onClick={() => adicionar("legendas")}
              className="border-2 border-tinta px-3 py-1 font-mono text-xs tracking-wider uppercase hover:bg-tinta hover:text-papel"
            >
              + Legenda aqui
            </button>
            <button
              onClick={() => adicionar("zooms")}
              className="border-2 border-tinta px-3 py-1 font-mono text-xs tracking-wider uppercase hover:bg-tinta hover:text-papel"
            >
              + Zoom aqui
            </button>
            <button
              onClick={() => adicionar("motions")}
              className="border-2 border-tinta px-3 py-1 font-mono text-xs tracking-wider uppercase hover:bg-tinta hover:text-papel"
              title="Texto ou grafismo animado (troque o modelo no painel ao lado)"
            >
              + Motion aqui
            </button>
            <button
              onClick={() => adicionar("efeitos")}
              className="border-2 border-tinta px-3 py-1 font-mono text-xs tracking-wider uppercase hover:bg-tinta hover:text-papel"
              title="Tremor, flash, glitch, cor… (troque o efeito no painel ao lado)"
            >
              + Efeito aqui
            </button>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  adicionarEfeitoSonoro(e.target.value as IdSom);
                }
              }}
              className="border-2 border-tinta bg-papel px-2 py-1 font-mono text-xs tracking-wider uppercase"
              title="Efeito sonoro no cursor"
            >
              <option value="">+ Som aqui…</option>
              {SONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>
        </section>
        <aside className="flex w-80 shrink-0 flex-col gap-6 overflow-y-auto border-l border-zinc-800 p-4">
          <Inspetor
            selecao={selecao}
            aoSelecionar={setSelecao}
            aoPosicionarInsert={(indice) => posicionarInserts([indice])}
          />
          <div>
            <h2 className="rotulo-zine mb-2">Biblioteca</h2>
            <Biblioteca
              biblioteca={projeto.biblioteca}
              acao={{
                // Cenas vão para o fim da trilha; o resto, para o cursor.
                rotulo: (m) =>
                  m.papel === "cena"
                    ? "+ trilha"
                    : `+ em ${inicio.toFixed(1)}s`,
                executar: colocarDaBiblioteca,
              }}
            />
          </div>
        </aside>
      </div>
      <section className="h-72 shrink-0 border-t border-zinc-800 bg-zinc-950">
        <Trilhas
          segundoAtual={segundoAtual}
          aoBuscar={buscar}
          selecao={selecao}
          aoSelecionar={setSelecao}
        />
      </section>
      {dadosPopup ? (
        <PopupPosicao
          {...dadosPopup}
          aoConfirmar={confirmarPopup}
          aoCancelar={() => setPopup(null)}
        />
      ) : null}
    </div>
  );
}
