import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ErroMeta,
  InfoMeta,
  limparToken,
  SegredoMeta,
  verificarConexao,
  versaoEmUso,
} from "@/conexoes/meta";
import { lerSegredoMeta } from "@/conexoes/sincronizar";
import {
  apagarConexao,
  atualizarInfoDaConexao,
  lerCliente,
  salvarConexao,
} from "@/servidor/banco";
import { cifrar, mascarar } from "@/servidor/segredos";

// Conexão do cliente com a Meta (Instagram + Anúncios), feita com a chave
// do app DELE (tutorial em /conectar). A chave fica criptografada no
// servidor e nunca volta para o navegador — só o começo e o fim.
//
// GET    ?cliente=<id>                → situação
// PUT    { cliente, token, ... }      → confere na Meta e guarda
// POST   ?cliente=<id>                → confere de novo a chave guardada
// DELETE ?cliente=<id>                → desconecta

const PLATAFORMA = "meta";

const resposta = (clienteId: string) => {
  const c = lerSegredoMeta(clienteId);
  return {
    conectado: !!c,
    // A chave guardada não pôde ser aberta: é preciso colar de novo.
    ilegivel: !!c?.ilegivel,
    info: c?.info ?? null,
    mascara: c?.segredo ? mascarar(c.segredo.token) : null,
    doisApps: !!c?.segredo?.tokenInstagram,
    comAppSecret: !!c?.segredo?.appSecret,
    comAppSecretInstagram: !!c?.segredo?.appSecretInstagram,
    versao: versaoEmUso(),
  };
};

const clienteValido = (id: string | null) =>
  !!id && /^[a-z0-9-]{1,60}$/.test(id) && !!lerCliente(id);

const falha = (e: unknown) => {
  if (e instanceof ErroMeta) {
    return NextResponse.json(
      { erro: e.message, tipo: e.tipo },
      { status: e.tipo === "rede" ? 502 : 400 },
    );
  }
  return NextResponse.json(
    { erro: e instanceof Error ? e.message : String(e) },
    { status: 500 },
  );
};

const naoEncontrado = () =>
  NextResponse.json({ erro: "Cliente não encontrado." }, { status: 404 });

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("cliente");
  if (!clienteValido(id)) return naoEncontrado();
  return NextResponse.json(resposta(id!));
}

// Campo omitido = manter o que está guardado; null ou "" = tirar.
const opcional = z.string().max(2000).nullable().optional();
const corpoSchema = z.object({
  cliente: z.string(),
  token: z.string().min(20).max(2000),
  tokenInstagram: opcional,
  appSecret: opcional,
  appSecretInstagram: opcional,
});

const valorNovo = (
  enviado: string | null | undefined,
  guardado: string | null | undefined,
  limpar: (s: string) => string,
) =>
  enviado === undefined
    ? (guardado ?? null)
    : enviado?.trim()
      ? limpar(enviado)
      : null;

export async function PUT(req: NextRequest) {
  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success || !clienteValido(corpo.data.cliente)) {
    return NextResponse.json(
      { erro: "Cole a chave de acesso completa (ela é bem longa)." },
      { status: 400 },
    );
  }
  const d = corpo.data;
  const guardado = lerSegredoMeta(d.cliente)?.segredo ?? null;
  const segredo: SegredoMeta = {
    token: limparToken(d.token),
    tokenInstagram: valorNovo(
      d.tokenInstagram,
      guardado?.tokenInstagram,
      limparToken,
    ),
    appSecret: valorNovo(d.appSecret, guardado?.appSecret, (s) => s.trim()),
    appSecretInstagram: valorNovo(
      d.appSecretInstagram,
      guardado?.appSecretInstagram,
      (s) => s.trim(),
    ),
  };
  try {
    const info = await verificarConexao(segredo);
    salvarConexao(d.cliente, PLATAFORMA, cifrar(JSON.stringify(segredo)), info);
    return NextResponse.json(resposta(d.cliente));
  } catch (e) {
    // Chave colada agora e recusada: quase sempre copiada pela metade ou
    // de outro lugar (não é a do usuário do sistema).
    if (e instanceof ErroMeta && e.tipo === "token") {
      const qual =
        e.chave === "instagram" ? "a chave do app do Instagram" : "essa chave";
      return NextResponse.json(
        {
          erro: `A Meta não aceitou ${qual}. Confira se copiou a chave inteira (começa com EAA e é bem longa) e se ela é a do usuário do sistema (passo 14). (Meta: ${e.original})`,
          tipo: e.tipo,
        },
        { status: 400 },
      );
    }
    return falha(e);
  }
}

export async function POST(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("cliente");
  if (!clienteValido(id)) return naoEncontrado();
  const c = lerSegredoMeta(id!);
  if (!c) {
    return NextResponse.json(
      { erro: "Este cliente ainda não conectou a Meta." },
      { status: 400 },
    );
  }
  if (!c.segredo) {
    return NextResponse.json({ erro: c.info.erro }, { status: 400 });
  }
  try {
    const nova = await verificarConexao(c.segredo);
    // Lista que não pôde ser lida agora (erro passageiro): fica a anterior.
    const info: InfoMeta = {
      ...nova,
      contasAnuncio:
        nova.listas?.anuncios === false
          ? c.info.contasAnuncio
          : nova.contasAnuncio,
      instagrams:
        nova.listas?.instagram === false ? c.info.instagrams : nova.instagrams,
      paginasSemInstagram:
        nova.listas?.instagram === false
          ? c.info.paginasSemInstagram
          : nova.paginasSemInstagram,
    };
    atualizarInfoDaConexao(id!, PLATAFORMA, info);
    return NextResponse.json(resposta(id!));
  } catch (e) {
    if (e instanceof ErroMeta && (e.tipo === "token" || e.tipo === "segredo")) {
      atualizarInfoDaConexao(id!, PLATAFORMA, { ...c.info, erro: e.message });
    }
    return falha(e);
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("cliente");
  if (!clienteValido(id)) return naoEncontrado();
  apagarConexao(id!, PLATAFORMA);
  return NextResponse.json(resposta(id!));
}
