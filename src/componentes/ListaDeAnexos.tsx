"use client";

import { PapelMidia } from "@/projeto/tipos";
import { Anexo, useEnvio } from "@/projeto/useEnvio";

// Arquivos escolhidos e ainda não enviados. Para cada um: papel, @apelido
// e se a IA deve analisar (ler fala e imagem) ou não.

const PAPEIS: Record<Anexo["formato"], PapelMidia[]> = {
  // Vídeo como "Áudio" = só o som dele é guardado (ex.: narração gravada
  // em vídeo, para legendar).
  video: ["cena", "insert", "audio"],
  imagem: ["insert"],
  audio: ["audio"],
};

const ROTULO_PAPEL: Record<PapelMidia, string> = {
  cena: "Cena",
  insert: "Insert",
  audio: "Áudio",
};

export const ListaDeAnexos: React.FC<{
  envio: ReturnType<typeof useEnvio>;
  // "compacta" para o chat; "completa" (uma linha por arquivo) na aba Arquivos.
  variante: "compacta" | "completa";
}> = ({ envio, variante }) => {
  const { anexos, atualizarAnexo, removerAnexo, enviando } = envio;
  if (!anexos.length) return null;

  return (
    <div
      className={
        variante === "compacta" ? "flex flex-wrap gap-2" : "flex flex-col gap-2"
      }
    >
      {anexos.map((a) => (
        <div
          key={a.id}
          className="flex flex-wrap items-center gap-2 border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
        >
          <span
            className={`truncate ${variante === "compacta" ? "max-w-36" : "min-w-0 flex-1"}`}
            title={a.arquivo.name}
          >
            {a.arquivo.name}
          </span>

          {PAPEIS[a.formato].length > 1 ? (
            <select
              value={a.papel}
              disabled={enviando}
              onChange={(e) => {
                const papel = e.target.value as PapelMidia;
                // Cena e "só o áudio" de um vídeo precisam da fala transcrita.
                const precisaIA =
                  papel === "cena" ||
                  (a.formato === "video" && papel === "audio");
                atualizarAnexo(a.id, {
                  papel,
                  ...(precisaIA ? { usarIA: true } : {}),
                });
              }}
              className="bg-zinc-800 px-1 py-0.5"
            >
              {PAPEIS[a.formato].map((p) => (
                <option key={p} value={p}>
                  {a.formato === "video" && p === "audio"
                    ? "Só o áudio"
                    : ROTULO_PAPEL[p]}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-zinc-400">{ROTULO_PAPEL[a.papel]}</span>
          )}

          <label className="flex items-center bg-zinc-800 px-1">
            <span className="text-violet-300">@</span>
            <input
              value={a.apelido}
              disabled={enviando}
              onChange={(e) =>
                atualizarAnexo(a.id, { apelido: e.target.value })
              }
              className="w-24 bg-transparent py-0.5 outline-none"
              aria-label="Apelido para citar no chat"
              title="Apelido para citar no chat (ex.: @videolael)"
            />
          </label>

          <label
            className={`flex cursor-pointer items-center gap-1 px-1.5 py-0.5 ${
              a.usarIA
                ? "bg-violet-600/30 text-violet-200"
                : "bg-zinc-800 text-zinc-400"
            }`}
            title={
              a.usarIA
                ? "A IA vai ler a fala e o que aparece (custo pequeno)"
                : "Arquivo frio: a IA não lê o conteúdo (sem custo)"
            }
          >
            <input
              type="checkbox"
              checked={a.usarIA}
              disabled={enviando}
              onChange={(e) =>
                atualizarAnexo(a.id, { usarIA: e.target.checked })
              }
              className="accent-violet-500"
            />
            Analisar com IA
          </label>

          {a.progresso !== null ? (
            <span className="tabular-nums text-violet-300">
              {Math.round(a.progresso * 100)}%
            </span>
          ) : (
            <button
              disabled={enviando}
              onClick={() => removerAnexo(a.id)}
              className="text-zinc-500 hover:text-tinta"
              aria-label={`Remover ${a.arquivo.name}`}
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
