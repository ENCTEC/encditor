"use client";

import { useCallback, useEffect, useState } from "react";
import { Elemento } from "./elementos";

// Elementos do Higgsfield do cliente (personagens, produtos, lugares).

export const useElementos = (clienteId: string | null) => {
  const [elementos, setElementos] = useState<Elemento[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    if (!clienteId) return;
    const r = await fetch(`/api/clientes/${clienteId}/elementos`, {
      cache: "no-store",
    });
    const d = (await r.json().catch(() => ({}))) as { elementos?: Elemento[] };
    setElementos(d.elementos ?? []);
  }, [clienteId]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const pedir = async (url: string, metodo: string, corpo?: unknown) => {
    setErro(null);
    const r = await fetch(url, {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const d = (await r.json().catch(() => ({}))) as {
      erro?: string;
      id?: string;
    };
    if (!r.ok) {
      setErro(d.erro ?? `Erro ${r.status}.`);
      return null;
    }
    await recarregar();
    return d;
  };

  return {
    elementos,
    erro,
    criar: (e: { nome: string; descricao: string; imagem: string | null }) =>
      pedir(`/api/clientes/${clienteId}/elementos`, "POST", e),
    editar: (
      id: string,
      e: Partial<{ nome: string; descricao: string; imagem: string | null }>,
    ) => pedir(`/api/elementos/${id}`, "PATCH", e),
    apagar: (id: string) => pedir(`/api/elementos/${id}`, "DELETE"),
  };
};
