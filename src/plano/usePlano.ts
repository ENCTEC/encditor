"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useProjeto } from "@/projeto/ProjetoProvider";
import { Briefing, lerPlanoSalvo, PlanoSalvo } from "./tipos";

// Plano do projeto aberto (aba Planejar): carrega do servidor, salva o
// briefing ~0,8s depois de cada mudança e conversa com a IA planejadora.

type Mudancas = Partial<
  Pick<
    PlanoSalvo,
    | "briefing"
    | "vinculos"
    | "musicaPulada"
    | "montadoEm"
    | "gerado"
    | "narracaoVerificada"
  >
> & { recomecar?: boolean };

export const usePlano = () => {
  const { meta } = useProjeto();
  const projetoId = meta?.id ?? null;
  const [plano, setPlano] = useState<PlanoSalvo | null>(null);
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const briefingPendente = useRef<Briefing | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const atual = useRef<PlanoSalvo | null>(null);
  atual.current = plano;

  useEffect(() => {
    if (!projetoId) return;
    let cancelado = false;
    void fetch(`/api/plano?projeto=${projetoId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { plano?: unknown }) => {
        if (!cancelado) setPlano(lerPlanoSalvo(d.plano));
      })
      .catch(() => !cancelado && setErro("Não consegui carregar o plano."));
    return () => {
      cancelado = true;
    };
  }, [projetoId]);

  const enviar = useCallback(
    async (mudancas: Mudancas) => {
      if (!projetoId) return null;
      setSalvando(true);
      try {
        const r = await fetch(`/api/plano?projeto=${projetoId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mudancas),
        });
        const d = (await r.json()) as { plano?: unknown; erro?: string };
        if (!r.ok) throw new Error(d.erro ?? "Falha ao salvar o plano.");
        return lerPlanoSalvo(d.plano);
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setSalvando(false);
      }
    },
    [projetoId],
  );

  // Salva o briefing que estiver esperando (antes de conversar com a IA).
  const salvarBriefingAgora = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const briefing = briefingPendente.current;
    briefingPendente.current = null;
    if (briefing) await enviar({ briefing });
  }, [enviar]);

  const mudarBriefing = useCallback(
    (mudar: (b: Briefing) => Briefing) => {
      const base = atual.current;
      if (!base) return;
      const briefing = mudar(base.briefing);
      setPlano({ ...base, briefing });
      briefingPendente.current = briefing;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void salvarBriefingAgora(), 800);
    },
    [salvarBriefingAgora],
  );

  // Muda e salva já (ligar arquivo a um item, pular música, montado…).
  const mudar = useCallback(
    async (mudancas: Mudancas) => {
      const base = atual.current;
      if (!base) return;
      setPlano({ ...base, ...mudancas } as PlanoSalvo);
      const salvo = await enviar(mudancas);
      if (salvo)
        setPlano((p) => (p ? { ...salvo, briefing: p.briefing } : salvo));
    },
    [enviar],
  );

  const conversar = useCallback(
    async (mensagem: string) => {
      if (!projetoId || !atual.current) return false;
      setErro(null);
      setPensando(true);
      await salvarBriefingAgora();
      // Mostra a mensagem do usuário enquanto a IA pensa.
      setPlano((p) =>
        p
          ? {
              ...p,
              conversa: [
                ...p.conversa,
                { autor: "usuario", texto: mensagem, em: Date.now() },
              ],
            }
          : p,
      );
      try {
        const r = await fetch(`/api/plano?projeto=${projetoId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mensagem }),
        });
        const d = (await r.json().catch(() => ({}))) as {
          plano?: unknown;
          erro?: string;
        };
        if (!r.ok || !d.plano) throw new Error(d.erro ?? `Erro ${r.status}.`);
        setPlano(lerPlanoSalvo(d.plano));
        return true;
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
        // Tira a mensagem otimista (ela não foi registrada).
        setPlano((p) => (p ? { ...p, conversa: p.conversa.slice(0, -1) } : p));
        return false;
      } finally {
        setPensando(false);
      }
    },
    [projetoId, salvarBriefingAgora],
  );

  // Narração de exemplo (voz sintética) do roteiro.
  const [gerandoVoz, setGerandoVoz] = useState(false);
  const gerarVoz = useCallback(
    async (voz: string) => {
      if (!projetoId) return;
      setErro(null);
      setGerandoVoz(true);
      try {
        const r = await fetch(`/api/plano/voz?projeto=${projetoId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voz }),
        });
        const d = (await r.json().catch(() => ({}))) as {
          plano?: unknown;
          erro?: string;
        };
        if (!r.ok || !d.plano) throw new Error(d.erro ?? `Erro ${r.status}.`);
        const salvo = lerPlanoSalvo(d.plano);
        setPlano((p) => (p ? { ...salvo, briefing: p.briefing } : salvo));
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
      } finally {
        setGerandoVoz(false);
      }
    },
    [projetoId],
  );

  // Olhada da IA num take enviado (um por vez; só informativa).
  const [olhando, setOlhando] = useState<string | null>(null);
  const conferirTake = useCallback(
    async (chave: string) => {
      if (!projetoId) return;
      setOlhando(chave);
      try {
        const r = await fetch(`/api/plano/conferir-take?projeto=${projetoId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chave }),
        });
        const d = (await r.json().catch(() => ({}))) as { plano?: unknown };
        if (r.ok && d.plano) {
          const salvo = lerPlanoSalvo(d.plano);
          setPlano((p) => (p ? { ...salvo, briefing: p.briefing } : salvo));
        }
      } finally {
        setOlhando(null);
      }
    },
    [projetoId],
  );

  // Salva o que faltar ao sair da página.
  useEffect(
    () => () => {
      if (timer.current) void salvarBriefingAgora();
    },
    [salvarBriefingAgora],
  );

  return {
    plano,
    projetoId,
    clienteId: meta?.cliente.id ?? null,
    mudarBriefing,
    mudar,
    conversar,
    pensando,
    salvando,
    gerarVoz,
    gerandoVoz,
    conferirTake,
    olhando,
    erro,
    limparErro: () => setErro(null),
  };
};

export type UsoPlano = ReturnType<typeof usePlano>;
