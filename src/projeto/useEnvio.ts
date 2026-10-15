"use client";

import { useState } from "react";
import { iniciarAnalise } from "@/componentes/AnaliseAutomatica";
import {
  enviarArquivo,
  extrairAudioDoVideo,
  formatoDoArquivo,
  gerarApelido,
  lerDuracaoDaUrl,
  lerMetadados,
  normalizarApelido,
  papelSugerido,
  podeAnalisar,
  proximoNome,
} from "./midia-cliente";
import { novoId, useProjeto } from "./ProjetoProvider";
import { Midia, PapelMidia } from "./tipos";

// Envio de arquivos, usado no chat (aba Criar) e na aba Arquivos: o
// usuário escolhe para cada arquivo o papel, o @apelido e se a IA deve
// analisá-lo (arquivo "frio" = sem análise e sem custo).

export type Anexo = {
  id: string;
  arquivo: File;
  formato: Midia["formato"];
  papel: PapelMidia;
  apelido: string;
  usarIA: boolean;
  progresso: number | null;
};

// Vídeos e imagens são descritos pela IA por padrão: o banco do cliente
// vai acumulando a descrição de tudo para ser reaproveitado nos próximos
// vídeos. Áudios (música) ficam "frios": descrever não ajuda a escolher.
const iaPadrao = (formato: Midia["formato"]) => formato !== "audio";

export const useEnvio = () => {
  const { obterBiblioteca, adicionarMidia, atualizarAnalise } = useProjeto();
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const anexar = (arquivos: FileList | File[]) => {
    const recusados: string[] = [];
    // Apelidos únicos considerando a biblioteca e os já anexados.
    const ocupados = [
      ...obterBiblioteca(),
      ...anexos.map((a) => ({ apelido: a.apelido }) as Midia),
    ];
    const novos: Anexo[] = [];
    for (const arquivo of Array.from(arquivos)) {
      const formato = formatoDoArquivo(arquivo);
      if (!formato) {
        recusados.push(arquivo.name);
        continue;
      }
      const papel = papelSugerido(formato);
      const apelido = gerarApelido(arquivo.name, ocupados);
      ocupados.push({ apelido } as Midia);
      novos.push({
        id: novoId(),
        arquivo,
        formato,
        papel,
        apelido,
        usarIA: iaPadrao(formato),
        progresso: null,
      });
    }
    setAnexos((atuais) => [...atuais, ...novos]);
    setErro(
      recusados.length
        ? `Formato não suportado: ${recusados.join(", ")}`
        : null,
    );
  };

  const atualizarAnexo = (id: string, mudancas: Partial<Anexo>) =>
    setAnexos((atuais) =>
      atuais.map((a) => {
        if (a.id !== id) return a;
        const novo = { ...a, ...mudancas };
        if (mudancas.apelido !== undefined) {
          novo.apelido = normalizarApelido(mudancas.apelido);
        }
        return novo;
      }),
    );

  const removerAnexo = (id: string) =>
    setAnexos((atuais) => atuais.filter((a) => a.id !== id));

  // Envia todos os anexos. Para no primeiro erro (os que faltam continuam
  // na lista) e devolve os que foram enviados.
  const enviarTodos = async (): Promise<{ enviados: Midia[]; ok: boolean }> => {
    setEnviando(true);
    setErro(null);
    const biblioteca = [...obterBiblioteca()];
    const enviados: Midia[] = [];
    const feitos = new Set<string>();

    for (const anexo of anexos) {
      try {
        let meta = await lerMetadados(anexo.arquivo, anexo.formato);
        atualizarAnexo(anexo.id, { progresso: 0 });
        let url = await enviarArquivo(anexo.arquivo, (p) =>
          atualizarAnexo(anexo.id, { progresso: p }),
        );
        // Vídeo enviado como "Só o áudio": guarda só o som, em mp3.
        const soAudio = anexo.formato === "video" && anexo.papel === "audio";
        if (soAudio) {
          url = await extrairAudioDoVideo(url, true);
          meta = {
            duracao: (await lerDuracaoDaUrl(url)) ?? meta.duracao,
            largura: null,
            altura: null,
          };
        }
        const apelidoLivre =
          anexo.apelido && !biblioteca.some((m) => m.apelido === anexo.apelido);
        const midia: Midia = {
          id: novoId(),
          nome: proximoNome(biblioteca, anexo.papel),
          apelido: apelidoLivre
            ? anexo.apelido
            : gerarApelido(anexo.arquivo.name, biblioteca),
          usarIA: anexo.usarIA,
          papel: anexo.papel,
          formato: soAudio ? "audio" : anexo.formato,
          url,
          nomeArquivo: anexo.arquivo.name,
          ...meta,
        };
        biblioteca.push(midia);
        enviados.push(midia);
        feitos.add(anexo.id);
        adicionarMidia(midia);
        if (podeAnalisar(midia)) iniciarAnalise(midia, atualizarAnalise);
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
        setAnexos((atuais) =>
          atuais
            .filter((a) => !feitos.has(a.id))
            .map((a) => ({ ...a, progresso: null })),
        );
        setEnviando(false);
        return { enviados, ok: false };
      }
    }

    setAnexos([]);
    setEnviando(false);
    return { enviados, ok: true };
  };

  return {
    anexos,
    anexar,
    atualizarAnexo,
    removerAnexo,
    enviarTodos,
    enviando,
    erro,
    setErro,
  };
};
