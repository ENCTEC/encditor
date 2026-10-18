import { NextRequest, NextResponse } from "next/server";

// Porteiro das rotas /api: o encEditor ainda não tem login, então a API só
// atende pedidos feitos neste computador (endereço local) e recusa pedidos
// que tentem alterar dados vindos de outro site. Protege, por exemplo, as
// chaves de acesso dos clientes e os números dos anúncios de quem estiver na
// mesma rede (o servidor também escuta só no endereço local — porteiro.mjs
// e o script "dev"). Na VPS, defina ENCEDITOR_HOSTS com o domínio (e um
// login antes de abrir para outras pessoas).

const LOCAIS = [
  "localhost",
  "127.0.0.1",
  "[::1]",
  "::1",
  "enceditor.localhost",
];

const hostsPermitidos = () => [
  ...LOCAIS,
  ...(process.env.ENCEDITOR_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
];

const semPorta = (host: string) =>
  host.startsWith("[")
    ? host.slice(0, host.indexOf("]") + 1)
    : host.split(":")[0];

export function proxy(req: NextRequest) {
  const host = semPorta((req.headers.get("host") ?? "").toLowerCase());
  if (!hostsPermitidos().includes(host)) {
    return NextResponse.json(
      { erro: "O encEditor só atende pedidos deste computador." },
      { status: 403 },
    );
  }
  const muda = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  if (muda && req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json(
      { erro: "Pedido de outro site recusado." },
      { status: 403 },
    );
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
