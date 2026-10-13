"use client";

import { Player, PlayerRef } from "@remotion/player";
import { forwardRef, useMemo } from "react";
import { EditorTimeline } from "@/remotion/EditorTimeline/EditorTimeline";
import { calcularClipes, calcularDuracaoTotal } from "@/timeline/calculos";
import { Timeline } from "@/timeline/schema";

// Preview do vídeo editado: a mesma composição do Remotion Studio, rodando
// dentro do app. Se ajusta ao tamanho do contêiner mantendo a proporção.
export const PreviewPlayer = forwardRef<
  PlayerRef,
  { timeline: Timeline; className?: string }
>(({ timeline, className }, ref) => {
  const duracao = useMemo(
    () => Math.max(1, calcularDuracaoTotal(calcularClipes(timeline))),
    [timeline],
  );

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
        inputProps={timeline}
        durationInFrames={duracao}
        fps={timeline.fps}
        compositionWidth={timeline.largura}
        compositionHeight={timeline.altura}
        style={{ width: "100%", height: "100%" }}
        controls
        acknowledgeRemotionLicense
      />
    </div>
  );
});

PreviewPlayer.displayName = "PreviewPlayer";
