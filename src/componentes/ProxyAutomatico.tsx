"use client";

import { useEffect } from "react";
import { gerarProxy, precisaDeProxy } from "@/projeto/midia-cliente";
import { useProjeto } from "@/projeto/ProjetoProvider";

// Sem interface: gera a cópia leve (proxy) de cada vídeo da biblioteca que
// ainda não tem, para o preview tocar liso. Também refaz quando o arquivo
// muda (ex.: efeitos de áudio trocam a URL do vídeo).
export const ProxyAutomatico: React.FC = () => {
  const { projeto, carregado, editarMidia } = useProjeto();

  useEffect(() => {
    if (!carregado) return;
    for (const midia of projeto.biblioteca) {
      if (!precisaDeProxy(midia)) continue;
      const de = midia.url;
      void gerarProxy(de).then((url) => {
        if (url) editarMidia(midia.id, { preview: { de, url } });
      });
    }
  }, [projeto.biblioteca, carregado, editarMidia]);

  return null;
};
