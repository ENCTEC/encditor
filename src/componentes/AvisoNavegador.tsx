"use client";

import { useEffect, useState } from "react";

// O navegador embutido do VS Code (Electron) não tem os codecs pagos de
// áudio (AAC): vídeos MP4 aparecem, mas sem som. Avisa para abrir num
// navegador de verdade (Chrome/Edge).
export const AvisoNavegador: React.FC = () => {
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    const embutido = /Electron\//.test(navigator.userAgent);
    let dispensado = false;
    try {
      dispensado = sessionStorage.getItem("encditor:aviso-navegador") === "ok";
    } catch {
      // sem sessionStorage: mostra o aviso
    }
    setMostrar(embutido && !dispensado);
  }, []);

  if (!mostrar) return null;

  return (
    <div className="flex items-center gap-3 border-b-[3px] border-tinta bg-spray px-4 py-1.5 font-mono text-xs text-papel">
      <span>
        ⚠ Você está no navegador embutido do VS Code: aqui os vídeos tocam sem
        som. Abra <b>http://localhost:3000</b> no Chrome ou no Edge.
      </span>
      <button
        onClick={() => {
          setMostrar(false);
          try {
            sessionStorage.setItem("encditor:aviso-navegador", "ok");
          } catch {
            // ignora
          }
        }}
        className="ml-auto underline hover:no-underline"
      >
        Entendi
      </button>
    </div>
  );
};
