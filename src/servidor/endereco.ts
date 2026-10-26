import { NextRequest } from "next/server";

// O renderizador (exportação e quadros da revisão do chat) busca os vídeos
// no próprio servidor: usa o endereço local com a mesma porta, seja qual
// for o nome usado no navegador (ex.: enceditor.localhost).
export const enderecoInterno = (req: NextRequest) => {
  const url = new URL(req.nextUrl.origin);
  // 127.0.0.1 (e não "localhost", que pode virar ::1): o app só escuta no
  // endereço local IPv4.
  url.hostname = "127.0.0.1";
  return url.origin;
};
