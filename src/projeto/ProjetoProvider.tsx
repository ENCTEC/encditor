"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { validarTimeline } from "@/timeline/calculos";
import { timelineVazia } from "@/timeline/operacoes";
import { Timeline } from "@/timeline/schema";
import { Analise } from "./analise";
import { gerarApelido } from "./midia-cliente";
import { Mensagem, Midia, Projeto } from "./tipos";

// Estado do projeto aberto, compartilhado pelas abas Criar e Timeline.
// Por enquanto fica salvo no navegador (localStorage); depois vai para o
// Supabase.

const CHAVE_STORAGE = "encditor:projeto:v1";
const LIMITE_HISTORICO = 100;

type Estado = {
  projeto: Projeto;
  passado: Timeline[];
  futuro: Timeline[];
};

type Acao =
  | { tipo: "timeline"; timeline: Timeline }
  | { tipo: "desfazer" }
  | { tipo: "refazer" }
  | { tipo: "midia"; midia: Midia }
  | { tipo: "analise"; id: string; analise: Analise }
  | { tipo: "editarMidia"; id: string; mudancas: Partial<Midia> }
  | { tipo: "mensagem"; mensagem: Mensagem }
  | { tipo: "limparMensagens" }
  | { tipo: "substituir"; projeto: Projeto };

const projetoVazio = (): Projeto => ({
  timeline: timelineVazia(),
  biblioteca: [],
  mensagens: [],
});

// Projetos salvos antes dos apelidos/IA opcional ganham valores padrão.
const migrarProjeto = (projeto: Projeto): Projeto => {
  const biblioteca: Midia[] = [];
  for (const m of projeto.biblioteca) {
    biblioteca.push({
      ...m,
      apelido: m.apelido ?? gerarApelido(m.nomeArquivo, biblioteca),
      usarIA: m.usarIA ?? true,
    });
  }
  return { ...projeto, biblioteca };
};

const reducer = (estado: Estado, acao: Acao): Estado => {
  const { projeto, passado, futuro } = estado;
  switch (acao.tipo) {
    case "timeline":
      return {
        projeto: { ...projeto, timeline: acao.timeline },
        passado: [...passado, projeto.timeline].slice(-LIMITE_HISTORICO),
        futuro: [],
      };
    case "desfazer":
      if (passado.length === 0) return estado;
      return {
        projeto: { ...projeto, timeline: passado[passado.length - 1] },
        passado: passado.slice(0, -1),
        futuro: [projeto.timeline, ...futuro],
      };
    case "refazer":
      if (futuro.length === 0) return estado;
      return {
        projeto: { ...projeto, timeline: futuro[0] },
        passado: [...passado, projeto.timeline],
        futuro: futuro.slice(1),
      };
    case "midia":
      return {
        ...estado,
        projeto: {
          ...projeto,
          biblioteca: [...projeto.biblioteca, acao.midia],
        },
      };
    case "editarMidia":
      return {
        ...estado,
        projeto: {
          ...projeto,
          biblioteca: projeto.biblioteca.map((m) =>
            m.id === acao.id ? { ...m, ...acao.mudancas } : m,
          ),
        },
      };
    case "analise":
      return {
        ...estado,
        projeto: {
          ...projeto,
          biblioteca: projeto.biblioteca.map((m) =>
            m.id === acao.id ? { ...m, analise: acao.analise } : m,
          ),
        },
      };
    case "mensagem":
      return {
        ...estado,
        projeto: {
          ...projeto,
          mensagens: [...projeto.mensagens, acao.mensagem],
        },
      };
    case "limparMensagens":
      return { ...estado, projeto: { ...projeto, mensagens: [] } };
    case "substituir":
      return { projeto: acao.projeto, passado: [], futuro: [] };
  }
};

type ContextoProjeto = {
  projeto: Projeto;
  carregado: boolean;
  podeDesfazer: boolean;
  podeRefazer: boolean;
  erro: string | null;
  limparErro: () => void;
  // Aplica uma operação (de timeline/operacoes.ts). Se a timeline ficar
  // inválida, nada muda e o erro aparece na tela.
  aplicar: (operacao: (t: Timeline) => Timeline) => boolean;
  // Timeline mais recente, inclusive mudanças feitas neste mesmo clique
  // (o "projeto" só atualiza na próxima renderização).
  obterTimeline: () => Timeline;
  // Biblioteca mais recente (mesma ideia do obterTimeline).
  obterBiblioteca: () => Midia[];
  atualizarAnalise: (id: string, analise: Analise) => void;
  // Muda apelido / escolha de IA. Retorna false se o apelido já existir.
  editarMidia: (id: string, mudancas: Partial<Midia>) => boolean;
  desfazer: () => void;
  refazer: () => void;
  // Coloca a mídia na biblioteca (não mexe na timeline).
  adicionarMidia: (midia: Midia) => void;
  adicionarMensagem: (mensagem: Omit<Mensagem, "id" | "criadaEm">) => void;
  substituirProjeto: (projeto: Projeto) => void;
  // Apaga a conversa (a edição e os arquivos continuam).
  limparChat: () => void;
  novoProjeto: () => void;
};

const Contexto = createContext<ContextoProjeto | null>(null);

export const novoId = () => crypto.randomUUID();

export const ProjetoProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [estado, dispatch] = useReducer(reducer, undefined, () => ({
    projeto: projetoVazio(),
    passado: [],
    futuro: [],
  }));
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Sempre aponta para a timeline mais recente (usado dentro de callbacks).
  const timelineAtual = useRef(estado.projeto.timeline);
  timelineAtual.current = estado.projeto.timeline;
  const bibliotecaAtual = useRef(estado.projeto.biblioteca);
  bibliotecaAtual.current = estado.projeto.biblioteca;

  // Carrega o projeto salvo (só no navegador, depois da 1ª renderização).
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_STORAGE);
      if (salvo) {
        const projeto = migrarProjeto(JSON.parse(salvo) as Projeto);
        validarTimeline(projeto.timeline);
        dispatch({ tipo: "substituir", projeto });
      }
    } catch {
      setErro("O projeto salvo estava corrompido e foi descartado.");
    }
    setCarregado(true);
  }, []);

  useEffect(() => {
    if (!carregado) return;
    try {
      localStorage.setItem(CHAVE_STORAGE, JSON.stringify(estado.projeto));
    } catch {
      setErro("Não foi possível salvar o projeto no navegador.");
    }
  }, [estado.projeto, carregado]);

  const aplicar = useCallback((operacao: (t: Timeline) => Timeline) => {
    try {
      const nova = operacao(timelineAtual.current);
      validarTimeline(nova);
      timelineAtual.current = nova;
      dispatch({ tipo: "timeline", timeline: nova });
      return true;
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      return false;
    }
  }, []);

  // Só guarda na biblioteca: a ordem das cenas na trilha é o usuário quem
  // decide (pelo chat ou pela Timeline).
  const adicionarMidia = useCallback((midia: Midia) => {
    dispatch({ tipo: "midia", midia });
  }, []);

  const valor = useMemo<ContextoProjeto>(
    () => ({
      projeto: estado.projeto,
      carregado,
      podeDesfazer: estado.passado.length > 0,
      podeRefazer: estado.futuro.length > 0,
      erro,
      limparErro: () => setErro(null),
      aplicar,
      obterTimeline: () => timelineAtual.current,
      obterBiblioteca: () => bibliotecaAtual.current,
      editarMidia: (id, mudancas) => {
        if (
          mudancas.apelido !== undefined &&
          (!mudancas.apelido ||
            bibliotecaAtual.current.some(
              (m) => m.id !== id && m.apelido === mudancas.apelido,
            ))
        ) {
          setErro(`O apelido "@${mudancas.apelido}" já existe ou está vazio.`);
          return false;
        }
        dispatch({ tipo: "editarMidia", id, mudancas });
        return true;
      },
      atualizarAnalise: (id, analise) =>
        dispatch({ tipo: "analise", id, analise }),
      desfazer: () => dispatch({ tipo: "desfazer" }),
      refazer: () => dispatch({ tipo: "refazer" }),
      adicionarMidia,
      adicionarMensagem: (m) =>
        dispatch({
          tipo: "mensagem",
          mensagem: { ...m, id: novoId(), criadaEm: Date.now() },
        }),
      substituirProjeto: (projeto) => dispatch({ tipo: "substituir", projeto }),
      limparChat: () => dispatch({ tipo: "limparMensagens" }),
      novoProjeto: () =>
        dispatch({ tipo: "substituir", projeto: projetoVazio() }),
    }),
    [estado, carregado, erro, aplicar, adicionarMidia],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
};

export const useProjeto = () => {
  const ctx = useContext(Contexto);
  if (!ctx) {
    throw new Error("useProjeto precisa estar dentro de <ProjetoProvider>.");
  }
  return ctx;
};
