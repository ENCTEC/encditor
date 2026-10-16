"use client";

import { useRef, useState } from "react";
import { novoId } from "@/projeto/ProjetoProvider";
import {
  enviarArquivo,
  formatoDoArquivo,
  lerMetadados,
} from "@/projeto/midia-cliente";
import { Exemplo, FINALIDADES_EXEMPLO } from "@/plano/tipos";
import { UsoPlano } from "@/plano/usePlano";
import { FORMATOS } from "@/timeline/formatos";

// O que o usuário informa para a IA planejar: roteiro (ou nada), objetivo,
// formato, duração, cenas obrigatórias e exemplos (com a finalidade).

export const campoZine =
  "w-full border-2 border-tinta bg-zinc-950 px-2.5 py-2 text-sm outline-none focus:shadow-[3px_3px_0_var(--color-spray)]";

const Secao: React.FC<{
  titulo: string;
  dica?: string;
  children: React.ReactNode;
}> = ({ titulo, dica, children }) => (
  <section className="space-y-2">
    <h3 className="rotulo-zine">{titulo}</h3>
    {dica ? <p className="text-xs text-zinc-500">{dica}</p> : null}
    {children}
  </section>
);

export const Briefing: React.FC<{ uso: UsoPlano }> = ({ uso }) => {
  const { plano, mudarBriefing } = uso;
  const [novaObrigatoria, setNovaObrigatoria] = useState("");
  const [enviando, setEnviando] = useState<number | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const inputExemplo = useRef<HTMLInputElement>(null);
  if (!plano) return null;
  const b = plano.briefing;

  const adicionarObrigatoria = () => {
    const texto = novaObrigatoria.trim();
    if (!texto) return;
    mudarBriefing((x) => ({ ...x, obrigatorias: [...x.obrigatorias, texto] }));
    setNovaObrigatoria("");
  };

  const enviarExemplos = async (arquivos: FileList) => {
    setErroEnvio(null);
    for (const arquivo of Array.from(arquivos)) {
      const formato = formatoDoArquivo(arquivo);
      if (formato !== "video" && formato !== "imagem") {
        setErroEnvio(`"${arquivo.name}": envie vídeo ou imagem.`);
        continue;
      }
      try {
        const meta = await lerMetadados(arquivo, formato);
        setEnviando(0);
        const url = await enviarArquivo(arquivo, setEnviando);
        const exemplo: Exemplo = {
          id: novoId(),
          url,
          nomeArquivo: arquivo.name,
          formato,
          duracao: meta.duracao,
          finalidade: "cena",
          detalhe: "",
        };
        mudarBriefing((x) => ({ ...x, exemplos: [...x.exemplos, exemplo] }));
        // Já deixa analisado (fala + o que aparece) para a IA planejar.
        void fetch("/api/analisar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, formato, duracao: meta.duracao }),
        });
      } catch (e) {
        setErroEnvio(e instanceof Error ? e.message : String(e));
      } finally {
        setEnviando(null);
      }
    }
  };

  const mudarExemplo = (id: string, m: Partial<Exemplo>) =>
    mudarBriefing((x) => ({
      ...x,
      exemplos: x.exemplos.map((e) => (e.id === id ? { ...e, ...m } : e)),
    }));

  return (
    <div className="space-y-6">
      <Secao
        titulo="Ideia do vídeo"
        dica="Conte a ideia com as suas palavras. A IA escreve o roteiro inteiro, já com o jeito de falar cada frase, para você gravar a narração."
      >
        <textarea
          value={b.ideia}
          onChange={(e) => {
            const ideia = e.target.value;
            mudarBriefing((x) => ({ ...x, ideia }));
          }}
          rows={4}
          placeholder="Ex.: promoção relâmpago do kit Trivitt, começar chamando quem faz química no cabelo, mostrar a loja e terminar chamando no WhatsApp"
          className={`${campoZine} resize-y`}
        />
      </Secao>

      <Secao titulo="Objetivo, produto e oferta">
        <textarea
          value={b.objetivo}
          onChange={(e) => {
            const objetivo = e.target.value;
            mudarBriefing((x) => ({ ...x, objetivo }));
          }}
          rows={3}
          placeholder="Ex.: vender o kit Trivitt hidratação por R$ 125,90 no Pix, público: mulheres 25-45 que fazem química no cabelo"
          className={`${campoZine} resize-y`}
        />
      </Secao>

      <div className="grid grid-cols-2 gap-3">
        <Secao titulo="Formato">
          <select
            value={b.formato ?? ""}
            onChange={(e) => {
              const formato = (e.target.value || null) as typeof b.formato;
              mudarBriefing((x) => ({ ...x, formato }));
            }}
            className={campoZine}
          >
            <option value="">A IA escolhe (9:16)</option>
            {FORMATOS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.id} — {f.nome}
              </option>
            ))}
          </select>
        </Secao>
        <Secao titulo="Duração (s)">
          <input
            type="number"
            min={5}
            max={180}
            value={b.duracaoAlvo ?? ""}
            onChange={(e) => {
              const n = Number(e.target.value);
              const duracaoAlvo = e.target.value && n > 0 ? n : null;
              mudarBriefing((x) => ({ ...x, duracaoAlvo }));
            }}
            placeholder="livre"
            className={campoZine}
          />
        </Secao>
      </div>

      <Secao
        titulo="Cenas obrigatórias"
        dica="O que precisa aparecer de qualquer jeito (a IA encaixa no roteiro)."
      >
        <ul className="space-y-1">
          {b.obrigatorias.map((o, i) => (
            <li
              key={i}
              className="flex items-start gap-2 border-2 border-tinta px-2 py-1.5 text-sm"
            >
              <span className="font-mono text-xs text-spray">{i + 1}.</span>
              <span className="flex-1">{o}</span>
              <button
                onClick={() =>
                  mudarBriefing((x) => ({
                    ...x,
                    obrigatorias: x.obrigatorias.filter((_, j) => j !== i),
                  }))
                }
                className="text-zinc-500 hover:text-spray"
                aria-label="Tirar cena obrigatória"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            value={novaObrigatoria}
            onChange={(e) => setNovaObrigatoria(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionarObrigatoria()}
            placeholder="Ex.: fachada da loja com o letreiro"
            className={campoZine}
          />
          <button
            onClick={adicionarObrigatoria}
            className="border-2 border-tinta px-3 font-mono text-xs uppercase hover:bg-tinta hover:text-papel"
          >
            +
          </button>
        </div>
      </Secao>

      <Secao
        titulo="Exemplos"
        dica="Vídeos ou imagens de referência. Diga para que serve cada um e o que copiar dele."
      >
        <ul className="space-y-2">
          {b.exemplos.map((x, i) => (
            <li key={x.id} className="border-2 border-tinta p-2">
              <div className="flex gap-2">
                {x.formato === "imagem" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={x.url}
                    alt=""
                    className="h-20 w-14 shrink-0 border border-tinta object-cover"
                  />
                ) : (
                  <video
                    src={`${x.url}#t=0.5`}
                    muted
                    preload="metadata"
                    className="h-20 w-14 shrink-0 border border-tinta bg-black object-cover"
                  />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-spray uppercase">
                      Exemplo {i + 1}
                    </span>
                    <span className="truncate text-xs text-zinc-500">
                      {x.nomeArquivo}
                    </span>
                    <button
                      onClick={() =>
                        mudarBriefing((y) => ({
                          ...y,
                          exemplos: y.exemplos.filter((e) => e.id !== x.id),
                        }))
                      }
                      className="ml-auto text-zinc-500 hover:text-spray"
                      aria-label="Tirar exemplo"
                    >
                      ✕
                    </button>
                  </div>
                  <select
                    value={x.finalidade}
                    onChange={(e) =>
                      mudarExemplo(x.id, {
                        finalidade: e.target.value as Exemplo["finalidade"],
                      })
                    }
                    className={`${campoZine} py-1 text-xs`}
                  >
                    {Object.entries(FINALIDADES_EXEMPLO).map(([id, nome]) => (
                      <option key={id} value={id}>
                        Para: {nome}
                      </option>
                    ))}
                  </select>
                  <input
                    value={x.detalhe}
                    onChange={(e) =>
                      mudarExemplo(x.id, { detalhe: e.target.value })
                    }
                    placeholder="O que copiar? ex.: o zoom rápido no rosto aos 3s"
                    className={`${campoZine} py-1 text-xs ${x.detalhe.trim() ? "" : "border-spray"}`}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
        <button
          onClick={() => inputExemplo.current?.click()}
          disabled={enviando !== null}
          className="w-full border-2 border-dashed border-zinc-700 px-3 py-3 font-mono text-xs tracking-wider text-zinc-400 uppercase hover:border-tinta hover:text-tinta disabled:opacity-50"
        >
          {enviando !== null
            ? `Enviando… ${Math.round(enviando * 100)}%`
            : "+ Enviar exemplo (vídeo ou imagem)"}
        </button>
        <input
          ref={inputExemplo}
          type="file"
          multiple
          accept="video/*,image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void enviarExemplos(e.target.files);
            e.target.value = "";
          }}
        />
        {erroEnvio ? <p className="text-xs text-spray">{erroEnvio}</p> : null}
      </Secao>

      <details open={b.roteiro.trim().length > 0} className="space-y-2">
        <summary className="cursor-pointer font-mono text-[11px] tracking-wider text-zinc-500 uppercase hover:text-tinta">
          Já tem um texto pronto? (opcional)
        </summary>
        <textarea
          value={b.roteiro}
          onChange={(e) => {
            const roteiro = e.target.value;
            mudarBriefing((x) => ({ ...x, roteiro }));
          }}
          rows={5}
          placeholder="Cole aqui só se já tiver o texto da narração; a IA mantém o sentido e melhora."
          className={`${campoZine} mt-2 resize-y`}
        />
      </details>

      <Secao titulo="Observações">
        <textarea
          value={b.observacoes}
          onChange={(e) => {
            const observacoes = e.target.value;
            mudarBriefing((x) => ({ ...x, observacoes }));
          }}
          rows={2}
          placeholder="Tom de voz, o que evitar, prazo…"
          className={`${campoZine} resize-y`}
        />
      </Secao>
    </div>
  );
};
