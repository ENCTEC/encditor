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

// Qual projeto abrir: "principal", ou outro passado na URL (?projeto=x),
// usado em testes. Fica guardado na aba para valer ao trocar de página.
const idDoProjeto = () => {
  const daUrl = new URLSearchParams(location.search).get("projeto");
  if (daUrl && /^[a-z0-9-]{1,40}$/.test(daUrl)) {
    sessionStorage.setItem("encditor:projeto-id", daUrl);
  }
  return sessionStorage.getItem("encditor:projeto-id") ?? "principal";
};
const chaveLocal = (id: string) =>
  id === "principal" ? "encditor:projeto:v1" : `encditor:projeto:v1:${id}`;
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
  // Situação do salvamento no banco do servidor.
  salvamento: "salvo" | "salvando" | "erro";
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
  const [salvamento, setSalvamento] = useState<"salvo" | "salvando" | "erro">(
    "salvo",
  );

  // Sempre aponta para a timeline mais recente (usado dentro de callbacks).
  const timelineAtual = useRef(estado.projeto.timeline);
  timelineAtual.current = estado.projeto.timeline;
  const bibliotecaAtual = useRef(estado.projeto.biblioteca);
  bibliotecaAtual.current = estado.projeto.biblioteca;

  // Carrega o projeto: do banco do servidor; se não houver (1ª vez, ou
  // servidor fora do ar), da cópia guardada no navegador.
  useEffect(() => {
    const carregar = async () => {
      let projeto: Projeto | null = null;
      try {
        const resposta = await fetch(`/api/projeto?id=${idDoProjeto()}`, {
          cache: "no-store",
        });
        if (resposta.ok) {
          projeto = ((await resposta.json()) as { projeto: Projeto | null })
            .projeto;
        }
      } catch {
        // sem servidor: usa a cópia local abaixo
      }
      if (!projeto) {
        try {
          const local = localStorage.getItem(chaveLocal(idDoProjeto()));
          if (local) projeto = JSON.parse(local) as Projeto;
        } catch {
          // cópia local ilegível: começa vazio
        }
      }
      if (projeto) {
        try {
          const migrado = migrarProjeto(projeto);
          validarTimeline(migrado.timeline);
          dispatch({ tipo: "substituir", projeto: migrado });
        } catch {
          setErro("O projeto salvo estava corrompido e foi descartado.");
        }
      }
      setCarregado(true);
    };
    void carregar();
  }, []);

  // Salva no banco ~0,8s depois da última mudança (e uma cópia no
  // navegador). Ao fechar a página, envia o que estiver pendente.
  const pendente = useRef<string | null>(null);
  useEffect(() => {
    if (!carregado) return;
    const json = JSON.stringify(estado.projeto);
    try {
      localStorage.setItem(chaveLocal(idDoProjeto()), json);
    } catch {
      // cópia local é só reserva; o banco do servidor é o principal
    }
    pendente.current = json;
    setSalvamento("salvando");
    const timer = setTimeout(async () => {
      try {
        const resposta = await fetch(`/api/projeto?id=${idDoProjeto()}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: json,
        });
        if (!resposta.ok) throw new Error(String(resposta.status));
        if (pendente.current === json) {
          pendente.current = null;
          setSalvamento("salvo");
        }
      } catch {
        setSalvamento("erro");
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [estado.projeto, carregado]);

  useEffect(() => {
    const aoSair = () => {
      if (pendente.current) {
        navigator.sendBeacon(
          `/api/projeto?id=${idDoProjeto()}`,
          new Blob([pendente.current], { type: "application/json" }),
        );
      }
    };
    window.addEventListener("pagehide", aoSair);
    return () => window.removeEventListener("pagehide", aoSair);
  }, []);

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
      salvamento,
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
    [estado, carregado, salvamento, erro, aplicar, adicionarMidia],
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
