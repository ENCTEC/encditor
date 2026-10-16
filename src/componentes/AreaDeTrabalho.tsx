"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { EVENTO_CITAR } from "@/componentes/Mencoes";
import { Chat } from "@/componentes/criar/Chat";
import { useProjeto } from "@/projeto/ProjetoProvider";

// O chat fica montado o tempo todo (em qualquer aba), para a conversa, o
// texto digitado, os anexos e um pedido em andamento não se perderem ao
// trocar de aba. Fica numa coluna lateral que pode ser ocultada.
export const AreaDeTrabalho: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const caminho = usePathname();
  // Telas de clientes e de resultados não editam o vídeo; o Planejar tem a
  // sua própria conversa (com a IA planejadora).
  const semChat = ["/clientes", "/planejar", "/resultados"].some((p) =>
    caminho.startsWith(p),
  );
  const { carregado } = useProjeto();
  const [chatAberto, setChatAberto] = useState(true);

  // Citar algo no chat (menu Estilos) reabre o chat se estiver oculto.
  useEffect(() => {
    const abrir = () => setChatAberto(true);
    window.addEventListener(EVENTO_CITAR, abrir);
    return () => window.removeEventListener(EVENTO_CITAR, abrir);
  }, []);

  const classeChat = semChat
    ? "hidden"
    : chatAberto
      ? "order-2 w-[400px] shrink-0 border-l-[3px] border-tinta"
      : // Escondido com CSS (não desmonta): a conversa continua viva.
        "hidden";

  return (
    <div className="flex h-full">
      <section className={classeChat}>
        {carregado ? (
          <Chat compacto aoOcultar={() => setChatAberto(false)} />
        ) : null}
      </section>

      <div className="order-1 min-w-0 flex-1">{children}</div>

      {!semChat && !chatAberto ? (
        <button
          onClick={() => setChatAberto(true)}
          className="order-3 flex w-9 shrink-0 items-center justify-center border-l-[3px] border-tinta bg-spray font-display text-sm tracking-widest text-papel uppercase [writing-mode:vertical-rl] hover:bg-tinta"
          title="Mostrar o chat"
        >
          ‹ Chat
        </button>
      ) : null}
    </div>
  );
};
