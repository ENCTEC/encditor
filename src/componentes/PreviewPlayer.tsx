"use client";

import { Player, PlayerRef } from "@remotion/player";
import { forwardRef, useMemo } from "react";
import { useProjeto } from "@/projeto/ProjetoProvider";
import { EditorTimeline } from "@/remotion/EditorTimeline/EditorTimeline";
import { TAGS_DE_AUDIO_DO_PLAYER } from "@/remotion/EditorTimeline/premontar";
import { calcularClipes, calcularDuracaoTotal } from "@/timeline/calculos";
import { Timeline } from "@/timeline/schema";

// Preview do vídeo editado: a mesma composição do Remotion Studio, rodando
// dentro do app. Se ajusta ao tamanho do contêiner mantendo a proporção.
// Os vídeos tocam pela cópia leve (proxy) quando ela já existe; o MP4
// exportado usa sempre os originais.
export const PreviewPlayer = forwardRef<
  PlayerRef,
  { timeline: Timeline; className?: string }
>(({ timeline, className }, ref) => {
  const { projeto } = useProjeto();
  const duracao = useMemo(
    () => Math.max(1, calcularDuracaoTotal(calcularClipes(timeline))),
    [timeline],
  );
  const paraTocar = useMemo(() => {
    const leve = new Map(
      projeto.biblioteca
        .filter((m) => m.preview?.de === m.url)
        .map((m) => [m.url, m.preview!.url]),
    );
    if (!leve.size) return timeline;
    const trocar = (url: string) => leve.get(url) ?? url;
    return {
      ...timeline,
      clipes: timeline.clipes.map((c) => ({ ...c, url: trocar(c.url) })),
      inserts: timeline.inserts.map((i) => ({ ...i, url: trocar(i.url) })),
    };
  }, [timeline, projeto.biblioteca]);

  if (timeline.clipes.length === 0) {
    return (
      <div
        className={`flex items-center justify-center border-[3px] border-dashed border-tinta font-display text-2xl tracking-wide text-zinc-500 uppercase ${className ?? ""}`}
      >
        Suba a primeira cena para ver o preview
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden border-[3px] border-tinta bg-black shadow-[6px_6px_0_var(--color-spray)] ${className ?? ""}`}
    >
      <Player
        ref={ref}
        component={EditorTimeline}
        inputProps={paraTocar}
        durationInFrames={duracao}
        fps={timeline.fps}
        compositionWidth={timeline.largura}
        compositionHeight={timeline.altura}
        style={{ width: "100%", height: "100%" }}
        controls
        numberOfSharedAudioTags={TAGS_DE_AUDIO_DO_PLAYER}
        acknowledgeRemotionLicense
      />
    </div>
  );
});

PreviewPlayer.displayName = "PreviewPlayer";
