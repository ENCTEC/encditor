import { NextRequest, NextResponse } from "next/server";
import {
  ErroMeta,
  listarAnuncios,
  listarMidiasInstagram,
} from "@/conexoes/meta";
import { lerSegredoMeta } from "@/conexoes/sincronizar";
import { lerCliente } from "@/servidor/banco";

// Listas para ligar uma versão exportada ao post/anúncio dela:
// GET ?cliente=<id>&tipo=instagram&conta=<IG User ID>[&depois=<cursor>]
// GET ?cliente=<id>&tipo=anuncios&conta=<act_…>[&depois=<cursor>]

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const cliente = p.get("cliente") ?? "";
  const tipo = p.get("tipo");
  const conta = p.get("conta") ?? "";
  const depois = p.get("depois");
  if (!/^[a-z0-9-]{1,60}$/.test(cliente) || !lerCliente(cliente)) {
    return NextResponse.json(
      { erro: "Cliente não encontrado." },
      { status: 404 },
    );
  }
  if (
    !/^(act_)?\d{1,30}$/.test(conta) ||
    (tipo !== "instagram" && tipo !== "anuncios")
  ) {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  const c = lerSegredoMeta(cliente);
  if (c && !c.segredo) {
    return NextResponse.json({ erro: c.info.erro }, { status: 400 });
  }
  if (!c?.segredo) {
    return NextResponse.json(
      { erro: "Este cliente ainda não conectou a Meta." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(
      tipo === "instagram"
        ? await listarMidiasInstagram(c.segredo, conta, depois)
        : await listarAnuncios(c.segredo, conta, depois),
    );
  } catch (e) {
    return NextResponse.json(
      {
        erro: e instanceof Error ? e.message : String(e),
        tipo: e instanceof ErroMeta ? e.tipo : "outro",
      },
      { status: e instanceof ErroMeta && e.tipo === "rede" ? 502 : 400 },
    );
  }
}
