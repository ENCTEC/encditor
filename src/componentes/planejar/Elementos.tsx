"use client";

import { useRef, useState } from "react";
import { enviarArquivo } from "@/projeto/midia-cliente";
import { Elemento } from "@/plano/elementos";
import { useElementos } from "@/plano/useElementos";
import { useProjeto } from "@/projeto/ProjetoProvider";
import { UsoPlano } from "@/plano/usePlano";
import { campoZine } from "./Briefing";

// Elementos do Higgsfield do cliente (os mesmos do @ de lá): imagem de
// referência, nome e descrição. Ficam salvos no cliente e valem para
// todos os vídeos dele; em cada vídeo, marque quais usar.

const enviarImagem = async (arquivo: File) => {
  if (!arquivo.type.startsWith("image/")) {
    throw new Error("A referência do elemento precisa ser uma imagem.");
  }
  return enviarArquivo(arquivo, () => undefined);
};

const FormElemento: React.FC<{
  inicial?: Elemento;
  aoSalvar: (e: {
    nome: string;
    descricao: string;
    imagem: string | null;
  }) => Promise<unknown>;
  aoCancelar: () => void;
}> = ({ inicial, aoSalvar, aoCancelar }) => {
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [imagem, setImagem] = useState<string | null>(
    inicial?.imagem ? `/api/midia/${inicial.imagem}` : null,
  );
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2 border-2 border-tinta p-2">
      <div className="flex gap-2">
        <button
          onClick={() => input.current?.click()}
          className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border-2 border-dashed border-zinc-700 text-xs text-zinc-500 hover:border-tinta"
          title="Imagem de referência do elemento"
        >
          {imagem ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagem} alt="" className="h-full w-full object-cover" />
          ) : (
            "+ foto"
          )}
        </button>
        <div className="min-w-0 flex-1 space-y-1.5">
          <label className="flex items-center border-2 border-tinta bg-zinc-950 px-2">
            <span className="text-spray">@</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value.replace(/\s/g, ""))}
              placeholder="nome-igual-ao-higgsfield"
              className="w-full bg-transparent py-1.5 text-sm outline-none"
            />
          </label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={2}
            placeholder="O que é: ex.: modelo ruiva, 30 anos, cabelo longo liso; ou: kit Trivitt hidratação (3 frascos amarelos)"
            className={`${campoZine} resize-none py-1 text-xs`}
          />
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const arquivo = e.target.files?.[0];
          e.target.value = "";
          if (!arquivo) return;
          setErro(null);
          setOcupado(true);
          try {
            setImagem(await enviarImagem(arquivo));
          } catch (x) {
            setErro(x instanceof Error ? x.message : String(x));
          } finally {
            setOcupado(false);
          }
        }}
      />
      {erro ? <p className="text-xs text-spray">{erro}</p> : null}
      <div className="flex justify-end gap-2">
        <button
          onClick={aoCancelar}
          className="border-2 border-tinta px-2 py-1 font-mono text-[11px] uppercase hover:bg-tinta hover:text-papel"
        >
          Cancelar
        </button>
        <button
          disabled={ocupado || !nome.trim()}
          onClick={async () => {
            setOcupado(true);
            const ok = await aoSalvar({
              nome: nome.trim(),
              descricao: descricao.trim(),
              imagem,
            });
            setOcupado(false);
            if (ok) aoCancelar();
          }}
          className="botao-spray !px-3 !py-1 !text-sm"
        >
          {ocupado ? "…" : "Salvar"}
        </button>
      </div>
    </div>
  );
};

export const Elementos: React.FC<{ uso: UsoPlano }> = ({ uso }) => {
  const { plano, clienteId, mudarBriefing } = uso;
  const { elementos, erro, criar, editar, apagar } = useElementos(clienteId);
  const { meta } = useProjeto();
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  if (!plano) return null;
  const marcados = new Set(plano.briefing.elementos);

  const alternar = (id: string) =>
    mudarBriefing((b) => ({
      ...b,
      elementos: b.elementos.includes(id)
        ? b.elementos.filter((e) => e !== id)
        : [...b.elementos, id],
    }));

  return (
    <section className="space-y-2">
      <h3 className="rotulo-zine">Elementos do Higgsfield</h3>
      <p className="text-xs text-zinc-500">
        Os mesmos que você cita com @ no Higgsfield (modelo, produto, loja).
        Ficam salvos no cliente{" "}
        <b>{meta?.cliente.nome ?? "deste projeto"}</b> e aparecem em todos os
        vídeos dele; marque os que este vídeo deve usar. Elemento de outra
        marca? Crie o vídeo dentro do cliente certo (Clientes).
      </p>
      <ul className="grid grid-cols-1 gap-2">
        {elementos.map((e) =>
          editando === e.id ? (
            <li key={e.id}>
              <FormElemento
                inicial={e}
                aoSalvar={(m) => editar(e.id, m)}
                aoCancelar={() => setEditando(null)}
              />
            </li>
          ) : (
            <li
              key={e.id}
              className={`flex gap-2 border-2 p-2 ${
                marcados.has(e.id)
                  ? "border-tinta bg-zinc-900"
                  : "border-zinc-700"
              }`}
            >
              {e.imagem ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/midia/${e.imagem}`}
                  alt=""
                  className="h-16 w-16 shrink-0 border border-tinta object-cover"
                />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center border border-dashed border-zinc-700 text-[10px] text-zinc-500">
                  sem foto
                </span>
              )}
              <div className="min-w-0 flex-1">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={marcados.has(e.id)}
                    onChange={() => alternar(e.id)}
                    className="accent-violet-500"
                  />
                  <span className="font-mono text-sm font-bold">@{e.nome}</span>
                  <span className="text-[11px] text-zinc-500">
                    {marcados.has(e.id) ? "usar neste vídeo" : ""}
                  </span>
                </label>
                <p className="mt-0.5 line-clamp-2 text-xs text-zinc-400">
                  {e.descricao || "(sem descrição)"}
                </p>
                <div className="mt-1 flex gap-3 font-mono text-[10px] uppercase">
                  <button
                    onClick={() => setEditando(e.id)}
                    className="text-zinc-500 hover:text-tinta"
                  >
                    editar
                  </button>
                  <button
                    onClick={() => {
                      if (
                        confirm(`Apagar o elemento @${e.nome} deste cliente?`)
                      ) {
                        mudarBriefing((b) => ({
                          ...b,
                          elementos: b.elementos.filter((x) => x !== e.id),
                        }));
                        void apagar(e.id);
                      }
                    }}
                    className="text-zinc-500 hover:text-spray"
                  >
                    apagar
                  </button>
                </div>
              </div>
            </li>
          ),
        )}
      </ul>
      {criando ? (
        <FormElemento
          aoSalvar={async (e) => {
            const d = await criar(e);
            if (d?.id) {
              const id = d.id;
              mudarBriefing((b) => ({ ...b, elementos: [...b.elementos, id] }));
            }
            return d;
          }}
          aoCancelar={() => setCriando(false)}
        />
      ) : (
        <button
          onClick={() => setCriando(true)}
          className="w-full border-2 border-dashed border-zinc-700 px-3 py-2 font-mono text-xs tracking-wider text-zinc-400 uppercase hover:border-tinta hover:text-tinta"
        >
          + Cadastrar elemento
        </button>
      )}
      {erro ? <p className="text-xs text-spray">{erro}</p> : null}
    </section>
  );
};
