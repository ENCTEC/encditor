"use client";

import { useState } from "react";
import { EfeitoAudio } from "@/catalogo/estilos";
import { trocarUrl } from "@/timeline/operacoes";
import { useProjeto } from "./ProjetoProvider";
import { Midia } from "./tipos";

// Aplica (ou remove) efeitos de áudio num arquivo da biblioteca: pede ao
// servidor a versão processada e troca o arquivo em todo o projeto. O
// original fica guardado em "urlOriginal" para poder voltar.
export const useEfeitosAudio = () => {
  const { editarMidia, aplicar } = useProjeto();
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const definirEfeitos = async (midia: Midia, efeitos: EfeitoAudio[]) => {
    setProcessando(midia.id);
    setErro(null);
    try {
      const original = midia.urlOriginal ?? midia.url;
      let nova = original;
      if (efeitos.length) {
        const resposta = await fetch("/api/efeitos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: original, efeitos }),
        });
        const dados = (await resposta.json()) as {
          url?: string;
          erro?: string;
        };
        if (!resposta.ok || !dados.url) {
          throw new Error(dados.erro ?? "Falha ao aplicar os efeitos.");
        }
        nova = dados.url;
      }
      editarMidia(midia.id, {
        url: nova,
        urlOriginal: efeitos.length ? original : undefined,
        efeitosAudio: efeitos.length ? efeitos : undefined,
      });
      aplicar((t) => trocarUrl(t, midia.url, nova));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setProcessando(null);
    }
  };

  // Liga/desliga um efeito, mantendo os outros.
  const alternarEfeito = (midia: Midia, efeito: EfeitoAudio) => {
    const atuais = (midia.efeitosAudio ?? []) as EfeitoAudio[];
    return definirEfeitos(
      midia,
      atuais.includes(efeito)
        ? atuais.filter((e) => e !== efeito)
        : [...atuais, efeito],
    );
  };

  return { definirEfeitos, alternarEfeito, processando, erro };
};
