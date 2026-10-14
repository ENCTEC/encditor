"use client";

import { useEffect, useState } from "react";
import { PopupPosicao } from "@/componentes/timeline/PopupPosicao";
import { useProjeto } from "@/projeto/ProjetoProvider";
import { caixaPadrao, ehTelaCheia } from "@/timeline/caixas";
import { atualizarItem, removerItem } from "@/timeline/operacoes";

// Popup de posição/tamanho de inserts que já estão na timeline, em
// qualquer aba: abre quando a IA coloca um insert sem posição definida e
// pelo botão "Posição e tamanho…" do inspetor. Vários pedidos viram fila.

const EVENTO = "encditor:posicionar-insert";

export const posicionarInserts = (indices: number[]) =>
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: indices }));

export const PosicionadorDeInserts: React.FC = () => {
  const { projeto, aplicar } = useProjeto();
  const [fila, setFila] = useState<number[]>([]);

  useEffect(() => {
    const aoPedir = (e: Event) => {
      const indices = (e as CustomEvent<number[]>).detail;
      setFila((atual) => [
        ...atual,
        ...indices.filter((i) => !atual.includes(i)),
      ]);
    };
    window.addEventListener(EVENTO, aoPedir);
    return () => window.removeEventListener(EVENTO, aoPedir);
  }, []);

  const indice = fila[0];
  const { timeline, biblioteca } = projeto;
  const insert = indice !== undefined ? timeline.inserts[indice] : undefined;

  // Índice que já não existe (insert removido): pula.
  useEffect(() => {
    if (indice !== undefined && !insert) setFila((f) => f.slice(1));
  }, [indice, insert]);

  if (indice === undefined || !insert) return null;

  const midia = biblioteca.find((m) => m.url === insert.url);
  const proximo = () => setFila((f) => f.slice(1));

  return (
    <PopupPosicao
      key={indice}
      titulo={`Onde fica ${midia ? `o @${midia.apelido}` : `o insert ${indice + 1}`}?`}
      midia={
        midia ?? {
          url: insert.url,
          formato: insert.tipo,
          largura: null,
          altura: null,
        }
      }
      fundo={removerItem(timeline, "inserts", indice)}
      segundo={insert.inicio + Math.min(0.5, (insert.fim - insert.inicio) / 2)}
      inicial={{
        caixa: insert.caixa ?? caixaPadrao(insert.posicao),
        acabamento: insert.acabamento ?? {
          borda: true,
          cantos: true,
          sombra: true,
        },
      }}
      aoConfirmar={(caixa, acabamento) => {
        aplicar((t) =>
          atualizarItem(t, "inserts", indice, {
            caixa,
            acabamento,
            posicao: ehTelaCheia(caixa) ? "tela-cheia" : "janela",
          }),
        );
        proximo();
      }}
      aoCancelar={proximo}
    />
  );
};
