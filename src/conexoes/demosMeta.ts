// Animações "onde clicar" do tutorial da Meta (/conectar). Para cada passo,
// uma sequência de quadros: um desenho SIMPLIFICADO da tela (sem marca nem
// cores da Meta) e o alvo do cursor. Os nomes dos botões seguem o texto do
// passo (tutorialMeta.ts) e `item` é o índice da ação em `passo.fazer` que o
// quadro mostra (a lista destaca essa ação enquanto o desenho toca).
// Marcadores trocados na hora: {marca}, {nomeApp} e {appId}.

export type Elemento = {
  tipo:
    | "titulo"
    | "texto"
    | "aviso"
    | "botao"
    | "principal"
    | "campo"
    | "opcao"
    | "check"
    | "linha"
    | "fila"
    | "grade"
    | "chave"
    | "fotos";
  // Alvo do cursor (único na tela).
  id?: string;
  texto?: string;
  // Nome em inglês, menor, ao lado.
  en?: string;
  // campo: o que está escrito; linha: texto à direita; opcao/check: detalhe.
  valor?: string;
  // linha: botão à direita (o alvo fica nele).
  botao?: string;
  // opcao/check: marcado; botao: aba selecionada.
  marcado?: boolean;
  // fila/grade
  itens?: Elemento[];
  // fila: espalha os itens (título à esquerda, botão à direita).
  espaco?: boolean;
};

export type ItemLateral = {
  id?: string;
  texto: string;
  en?: string;
  // Cabeçalho de grupo (não clicável).
  grupo?: boolean;
};

export type Tela = {
  tipo: "navegador" | "celular";
  endereco?: string;
  // Barra do site (no celular, o título da tela). Alvo "topo".
  topo?: string;
  topoBotoes?: Elemento[];
  lateral?: ItemLateral[];
  // Item da lateral selecionado.
  ativo?: string;
  corpo: Elemento[];
  // Janela por cima da tela.
  janela?: { titulo: string; corpo: Elemento[] };
};

// clicar/marcar: clica no alvo; digitar: escreve `digitar` no campo;
// escolher: clica e o campo passa a mostrar `digitar`; ver: só aponta;
// conferir: aponta em verde ("deu certo"); evitar: aponta em vermelho
// ("não clique").
export type Acao =
  | "clicar"
  | "marcar"
  | "digitar"
  | "escolher"
  | "ver"
  | "conferir"
  | "evitar";

export type Quadro = {
  tela: Tela;
  alvo?: string;
  acao?: Acao;
  digitar?: string;
  legenda: string;
  item?: number;
  // Quadro curto (ex.: marcar várias permissões seguidas).
  rapido?: boolean;
};

// ---------- peças ----------

const titulo = (texto: string): Elemento => ({ tipo: "titulo", texto });
const texto = (t: string): Elemento => ({ tipo: "texto", texto: t });
const aviso = (t: string, id?: string): Elemento => ({
  tipo: "aviso",
  texto: t,
  id,
});
const botao = (
  id: string | undefined,
  t: string,
  en?: string,
  marcado = false,
): Elemento => ({ tipo: "botao", id, texto: t, en, marcado });
const principal = (id: string, t: string, en?: string): Elemento => ({
  tipo: "principal",
  id,
  texto: t,
  en,
});
const campo = (
  id: string | undefined,
  rotulo: string,
  valor = "",
): Elemento => ({
  tipo: "campo",
  id,
  texto: rotulo,
  valor,
});
const opcao = (
  id: string | undefined,
  t: string,
  en?: string,
  marcado = false,
  detalhe?: string,
): Elemento => ({ tipo: "opcao", id, texto: t, en, marcado, valor: detalhe });
const check = (
  id: string | undefined,
  t: string,
  en?: string,
  marcado = false,
  detalhe?: string,
): Elemento => ({ tipo: "check", id, texto: t, en, marcado, valor: detalhe });
const linha = (
  id: string | undefined,
  t: string,
  extra: { en?: string; valor?: string; botao?: string } = {},
): Elemento => ({ tipo: "linha", id, texto: t, ...extra });
const fila = (...itens: Elemento[]): Elemento => ({ tipo: "fila", itens });
const cabecalho = (t: string, ...botoes: Elemento[]): Elemento => ({
  tipo: "fila",
  espaco: true,
  itens: [titulo(t), ...botoes],
});
const grade = (...itens: Elemento[]): Elemento => ({ tipo: "grade", itens });

// Lista com o botão Adicionar (Páginas, Apps, Usuários do sistema…).
const lista = (
  nome: string,
  itens: { texto: string; valor?: string }[],
): Elemento[] => [
  cabecalho(nome, principal("adicionar", "+ Adicionar", "Add")),
  ...(itens.length
    ? itens.map((i, n) => linha(`item-${n}`, i.texto, { valor: i.valor }))
    : [texto("Nenhum item ainda.")]),
];

// ---------- telas ----------

const central = (
  ativo: string | undefined,
  corpo: Elemento[],
  janela?: Tela["janela"],
): Tela => ({
  tipo: "navegador",
  endereco: "accountscenter.facebook.com",
  topo: "Central de Contas",
  lateral: [
    { id: "perfis", texto: "Perfis", en: "Profiles" },
    { id: "dados", texto: "Dados pessoais", en: "Personal details" },
    {
      id: "seguranca",
      texto: "Senha e segurança",
      en: "Password and security",
    },
    { id: "anuncios", texto: "Preferências de anúncios", en: "Ad preferences" },
  ],
  ativo,
  corpo,
  janela,
});

const negocio = (
  ativo: string | undefined,
  corpo: Elemento[],
  janela?: Tela["janela"],
): Tela => ({
  tipo: "navegador",
  endereco: "business.facebook.com/settings",
  topo: "Configurações do negócio · portfólio {marca}",
  lateral: [
    { texto: "Usuários", en: "Users", grupo: true },
    { id: "pessoas", texto: "Pessoas", en: "People" },
    {
      id: "usuarios-sistema",
      texto: "Usuários do sistema",
      en: "System users",
    },
    { texto: "Contas", en: "Accounts", grupo: true },
    { id: "paginas", texto: "Páginas", en: "Pages" },
    { id: "contas-anuncio", texto: "Contas de anúncios", en: "Ad accounts" },
    {
      id: "contas-instagram",
      texto: "Contas do Instagram",
      en: "Instagram accounts",
    },
    { id: "apps", texto: "Apps" },
  ],
  ativo,
  corpo,
  janela,
});

const PRODUTO_MKT: ItemLateral = { id: "p-mkt", texto: "API de Marketing" };
const PRODUTO_INSTA: ItemLateral = { id: "p-insta", texto: "Instagram" };

const devApp = (
  ativo: string | undefined,
  corpo: Elemento[],
  extra: {
    produtos?: ItemLateral[];
    janela?: Tela["janela"];
    topoBotoes?: Elemento[];
  } = {},
): Tela => ({
  tipo: "navegador",
  endereco: "developers.facebook.com/apps/{appId}",
  topo: "{nomeApp} · ID do app: {appId}",
  topoBotoes: extra.topoBotoes,
  lateral: [
    { id: "painel", texto: "Painel", en: "Dashboard" },
    { texto: "Configurações do app", en: "App settings", grupo: true },
    { id: "basico", texto: "Básico", en: "Basic" },
    { id: "avancado", texto: "Avançado", en: "Advanced" },
    { texto: "Análise do app", en: "App Review", grupo: true },
    {
      id: "permissoes",
      texto: "Permissões e recursos",
      en: "Permissions and features",
    },
    { texto: "Produtos", en: "Products", grupo: true },
    ...(extra.produtos ?? []),
    { id: "add-produto", texto: "+ Adicionar produto", en: "Add product" },
  ],
  ativo,
  corpo,
  janela: extra.janela,
});

const devSite = (
  endereco: string,
  corpo: Elemento[],
  extra: { janela?: Tela["janela"]; topoBotoes?: Elemento[] } = {},
): Tela => ({
  tipo: "navegador",
  endereco,
  topo: "Meta for Developers",
  topoBotoes: extra.topoBotoes,
  corpo,
  janela: extra.janela,
});

const celular = (
  topo: string,
  corpo: Elemento[],
  topoBotoes?: Elemento[],
): Tela => ({ tipo: "celular", topo, corpo, topoBotoes });

const perfil = (extra: Elemento[] = []): Tela =>
  celular(
    "@sua.marca",
    [
      titulo("{marca}"),
      texto("120 publicações · 2.300 seguidores · 180 seguindo"),
      ...extra,
      fila(
        botao("editar", "Editar perfil", "Edit profile"),
        botao(undefined, "Compartilhar"),
      ),
      { tipo: "fotos" },
    ],
    [botao("menu", "☰")],
  );

// ---------- trechos repetidos ----------

const SEGURANCA = (ativada = false): Elemento[] => [
  titulo("Senha e segurança"),
  texto("Login e recuperação"),
  linha(undefined, "Alterar senha", { en: "Change password", valor: "›" }),
  linha("2fa", "Autenticação de dois fatores", {
    en: "Two-factor authentication",
    valor: ativada ? "Ativada ✓" : "›",
  }),
  linha(undefined, "Alertas de login", { valor: "›" }),
];

const METODOS = (marcado: boolean): Tela["janela"] => ({
  titulo: "Escolha o método de segurança",
  corpo: [
    opcao(
      "metodo-app",
      "App de autenticação",
      "Authentication app",
      marcado,
      "o mais seguro",
    ),
    opcao(undefined, "Mensagem de texto (SMS)", "Text message"),
    opcao(undefined, "WhatsApp"),
    principal("continuar", "Continuar", "Continue"),
  ],
});

const EDITAR_PERFIL = (ligada: boolean): Elemento[] => [
  campo(undefined, "Nome", "{marca}"),
  campo(undefined, "Nome de usuário", "sua.marca"),
  campo(undefined, "Bio", "Cosméticos e cuidados…"),
  texto("Informações do perfil público"),
  linha("pagina", "Página", {
    en: "Page",
    valor: ligada ? "{marca} ✓" : "Conectar ou criar ›",
  }),
];

const PORTFOLIO_NOVO = (preenchidos: number): Tela["janela"] => ({
  titulo: "Crie um portfólio empresarial",
  corpo: [
    campo(
      "nome-portfolio",
      "Nome do portfólio empresarial",
      preenchidos > 0 ? "{marca}" : "",
    ),
    campo("seu-nome", "Seu nome", preenchidos > 1 ? "Seu nome" : ""),
    campo(
      "email",
      "E-mail comercial",
      preenchidos > 2 ? "contato@suamarca.com.br" : "",
    ),
    principal("enviar", "Enviar", "Submit"),
  ],
});

const suite = (seletor: string, janela?: Tela["janela"]): Tela => ({
  tipo: "navegador",
  endereco: "business.facebook.com",
  topo: "Meta Business Suite",
  lateral: [
    { id: "seletor", texto: `${seletor} ▾` },
    { id: "inicio", texto: "Início", en: "Home" },
    { texto: "Ferramentas", grupo: true },
    { id: "anuncios", texto: "Anúncios", en: "Ads" },
    { id: "insights", texto: "Insights" },
    { id: "config", texto: "Configurações", en: "Settings" },
  ],
  ativo: "inicio",
  corpo: [titulo("Início"), texto("Resumo das suas Páginas e contas.")],
  janela,
});

const APPS_VAZIO = devSite("developers.facebook.com/apps", [
  cabecalho("Meus apps", principal("criar", "Criar app", "Create app")),
  texto("Você ainda não tem apps."),
]);

const assistente = (passo: string, corpo: Elemento[]): Tela => ({
  tipo: "navegador",
  endereco: "developers.facebook.com/apps/creation",
  topo: "Criar um app",
  lateral: [
    { id: "w-detalhes", texto: "Detalhes do app", en: "App details" },
    { id: "w-casos", texto: "Casos de uso", en: "Use cases" },
    { id: "w-tipo", texto: "Tipo do app", en: "App type" },
    { id: "w-portfolio", texto: "Detalhes e portfólio" },
  ],
  ativo: passo,
  corpo,
});

const CASOS = (outro: boolean): Elemento[] => [
  titulo("Adicionar casos de uso"),
  texto("Role até o fim da lista."),
  opcao(undefined, "Criar e gerenciar anúncios com a API de Marketing"),
  opcao(undefined, "Gerenciar mensagens e conteúdo no Instagram"),
  opcao(undefined, "Autenticar com o Login do Facebook"),
  opcao("outro", "Outro", "Other", outro, "leva à escolha do tipo do app"),
  principal("avancar", "Avançar", "Next"),
];

const TIPOS = (empresa: boolean): Elemento[] => [
  titulo("Selecione um tipo de app"),
  opcao(
    "empresa",
    "Empresa",
    "Business",
    empresa,
    "Páginas, anúncios e Instagram de empresas",
  ),
  opcao("consumidor", "Consumidor", "Consumer", false, "não gera a chave"),
  opcao(undefined, "Jogos", "Gaming"),
  principal("avancar", "Avançar", "Next"),
];

const DETALHES_FINAIS: Elemento[] = [
  titulo("Adicione os detalhes"),
  campo(undefined, "Nome do app", "{nomeApp}"),
  campo(undefined, "E-mail de contato", "voce@email.com"),
  campo("portfolio", "Portfólio empresarial", "Nenhum portfólio ▾"),
  principal("criar-app", "Criar app", "Create app"),
];

const PRODUTOS: Elemento[] = [
  titulo("Adicione produtos ao seu app"),
  linha(undefined, "Login do Facebook", { botao: "Configurar" }),
  linha("mkt", "API de Marketing", {
    en: "Marketing API",
    botao: "Configurar",
  }),
  linha("insta", "Instagram", { botao: "Configurar" }),
  linha(undefined, "Webhooks", { botao: "Configurar" }),
];

const PERMISSOES_INSTA = (insightsOk: boolean): Elemento[] => [
  titulo("Permissões e recursos"),
  linha(undefined, "instagram_basic", { valor: "Acesso padrão" }),
  linha(
    "insights",
    "instagram_manage_insights",
    insightsOk ? { valor: "Acesso padrão" } : { botao: "Adicionar" },
  ),
  linha(undefined, "pages_show_list", { valor: "Acesso padrão" }),
  linha(undefined, "pages_read_engagement", { valor: "Acesso padrão" }),
  linha(undefined, "business_management", { valor: "Acesso padrão" }),
  linha(undefined, "ads_read", { valor: "Acesso padrão" }),
];

const ATRIBUIDOS: [string, string][] = [
  ["{nomeApp}", "Gerenciar app"],
  ["Conta {marca}", "Ver desempenho"],
  ["{marca} (Página)", "Controle total"],
];

const usuarioDoSistema = (
  atribuidos: [string, string][],
  janela?: Tela["janela"],
  comAviso = false,
): Tela =>
  negocio(
    "usuarios-sistema",
    [
      ...(comAviso
        ? [
            aviso(
              "System Users can only generate access tokens for permissions their app has been granted through App Review.",
              "aviso",
            ),
          ]
        : []),
      cabecalho(
        "encEditor · Funcionário",
        botao("atribuir", "Atribuir ativos", "Assign assets"),
        botao("gerar", "Gerar token", "Generate token"),
      ),
      texto("Ativos atribuídos"),
      ...(atribuidos.length
        ? atribuidos.map(([a, p], n) => linha(`ativo-${n}`, a, { valor: p }))
        : [texto("Nenhum ativo ainda.")]),
    ],
    janela,
  );

type TipoDeAtivo = "apps" | "anuncios" | "paginas" | null;
const atribuir = (
  tipo: TipoDeAtivo,
  ativo = false,
  permissao = false,
): Tela["janela"] => {
  const abas = fila(
    botao("tipo-apps", "Apps", undefined, tipo === "apps"),
    botao(
      "tipo-anuncios",
      "Contas de anúncios",
      "Ad accounts",
      tipo === "anuncios",
    ),
    botao("tipo-paginas", "Páginas", "Pages", tipo === "paginas"),
  );
  const conteudo: Elemento[] =
    tipo === "apps"
      ? [
          check("ativo", "{nomeApp}", undefined, ativo),
          texto("Permissões"),
          check(
            "permissao",
            "Gerenciar app (controle total)",
            "Manage app",
            permissao,
          ),
        ]
      : tipo === "anuncios"
        ? [
            check("ativo", "Conta {marca}", undefined, ativo),
            texto("Permissões"),
            check(
              "permissao",
              "Ver desempenho",
              "View performance",
              permissao,
              "só leitura",
            ),
            check("campanhas", "Gerenciar campanhas", "Manage campaigns"),
            check(undefined, "Controle total", "Full control"),
          ]
        : tipo === "paginas"
          ? [
              check(
                "ativo",
                "{marca}",
                undefined,
                ativo,
                "a Página ligada ao Instagram",
              ),
              texto("Permissões"),
              check("permissao", "Controle total", "Full control", permissao),
            ]
          : [texto("Escolha o tipo de ativo.")];
  return {
    titulo: "Atribuir ativos",
    corpo: [
      abas,
      ...conteudo,
      principal("confirmar", "Atribuir ativos", "Assign assets"),
    ],
  };
};

// Permissões na janela de gerar a chave: na ordem da tela e na ordem em que
// o tutorial pede para marcar.
const PERMISSOES_NA_TELA = [
  "ads_management",
  "ads_read",
  "business_management",
  "instagram_basic",
  "instagram_manage_insights",
  "pages_manage_posts",
  "pages_read_engagement",
  "pages_show_list",
];
export const PERMISSOES_DA_CHAVE = [
  "ads_read",
  "business_management",
  "pages_show_list",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_manage_insights",
];

const gerarToken = (
  app: boolean,
  nunca: boolean,
  marcadas: number,
): Tela["janela"] => {
  const feitas = PERMISSOES_DA_CHAVE.slice(0, marcadas);
  return {
    titulo: "Gerar token",
    corpo: [
      campo("app", "App", app ? "{nomeApp} ▾" : "Selecione um app ▾"),
      fila(
        texto("Validade do token:"),
        opcao(undefined, "60 dias"),
        opcao("nunca", "Nunca", "Never", nunca),
      ),
      texto("Permissões"),
      grade(
        ...PERMISSOES_NA_TELA.map((p) =>
          check(`perm-${p}`, p, undefined, feitas.includes(p)),
        ),
      ),
      principal("gerar-token", "Gerar token", "Generate token"),
    ],
  };
};

const resultados = (janela?: Tela["janela"], comNumeros = false): Tela => ({
  tipo: "navegador",
  endereco: "enceditor.localhost/resultados",
  topo: "encEditor · Resultados",
  corpo: [
    titulo("Versões exportadas"),
    linha("versao", "Versão 1 (9:16)", { botao: "🔗 ligar ao post/anúncio" }),
    ...(comNumeros
      ? [
          linha("pago", "Pago (Meta Ads)", {
            valor: "43 conversas · R$ 3,00 cada",
          }),
          linha(undefined, "Orgânico · Instagram", {
            valor: "1.500 visualizações · 25 salvamentos",
          }),
        ]
      : []),
    linha(undefined, "Versão 2 (1:1)", { botao: "🔗 ligar ao post/anúncio" }),
  ],
  janela,
});

const ligar = (post: boolean): Tela["janela"] => ({
  titulo: "Ligar ao post e aos anúncios",
  corpo: [
    texto("Post do Instagram"),
    fila(
      botao("post", "Reel da promoção", undefined, post),
      botao(undefined, "Foto do produto"),
    ),
    texto("Anúncios"),
    check(
      "anuncio",
      "Anúncio WhatsApp",
      undefined,
      post,
      post ? "usa este post" : undefined,
    ),
    check(undefined, "Anúncio site"),
    principal("salvar", "Salvar e buscar números"),
  ],
});

// ---------- os desenhos de cada passo ----------

export const DEMOS_META: Record<string, Quadro[]> = {
  "dois-fatores": [
    {
      tela: central(undefined, [
        titulo("Central de Contas"),
        texto("Gerencie as configurações das suas contas da Meta."),
      ]),
      alvo: "seguranca",
      acao: "clicar",
      item: 1,
      legenda:
        "Na Central de Contas, clique em Senha e segurança (Password and security).",
    },
    {
      tela: central("seguranca", SEGURANCA()),
      alvo: "2fa",
      acao: "clicar",
      item: 1,
      legenda:
        "Clique em Autenticação de dois fatores (Two-factor authentication).",
    },
    {
      tela: central("seguranca", SEGURANCA(), {
        titulo: "Selecione uma conta",
        corpo: [linha("perfil", "Seu nome", { en: "Facebook", valor: "›" })],
      }),
      alvo: "perfil",
      acao: "clicar",
      item: 2,
      legenda: "Escolha o seu perfil pessoal.",
    },
    {
      tela: central("seguranca", SEGURANCA(), METODOS(false)),
      alvo: "metodo-app",
      acao: "marcar",
      item: 2,
      legenda:
        "Escolha um método. O app autenticador é o mais seguro; SMS e WhatsApp também servem.",
    },
    {
      tela: central("seguranca", SEGURANCA(), METODOS(true)),
      alvo: "continuar",
      acao: "clicar",
      item: 2,
      legenda: "Clique em Continuar e siga as instruções até o fim.",
    },
    {
      tela: central("seguranca", SEGURANCA(true)),
      alvo: "2fa",
      acao: "conferir",
      legenda:
        "Deu certo: a autenticação de dois fatores aparece como ativada.",
    },
  ],

  "instagram-profissional": [
    {
      tela: perfil(),
      alvo: "menu",
      acao: "clicar",
      item: 0,
      legenda:
        "No app do Instagram, abra o seu perfil e toque no menu ☰ (no canto de cima, à direita).",
    },
    {
      tela: celular("Configurações", [
        texto("Sua conta"),
        linha(undefined, "Central de Contas", { valor: "›" }),
        texto("Para profissionais"),
        linha("tipo", "Tipo de conta e ferramentas", {
          en: "Account type and tools",
          valor: "›",
        }),
        texto("Como você usa o Instagram"),
        linha(undefined, "Salvos", { valor: "›" }),
        linha(undefined, "Notificações", { valor: "›" }),
      ]),
      alvo: "tipo",
      acao: "clicar",
      item: 1,
      legenda:
        "Role até “Para profissionais” e toque em Tipo de conta e ferramentas. Não achou? Procure “Tipo de conta” na busca das configurações.",
    },
    {
      tela: celular("Tipo de conta e ferramentas", [
        linha("mudar", "Mudar para conta profissional", {
          en: "Switch to professional account",
          valor: "›",
        }),
        linha(undefined, "Adicionar nova conta profissional", { valor: "›" }),
      ]),
      alvo: "mudar",
      acao: "clicar",
      item: 1,
      legenda: "Toque em Mudar para conta profissional.",
    },
    {
      tela: celular("Categoria", [
        titulo("O que melhor descreve você?"),
        opcao("categoria", "Saúde/beleza"),
        opcao(undefined, "Loja de roupas"),
        opcao(undefined, "Produto/serviço"),
        principal("concluir", "Concluir", "Done"),
      ]),
      alvo: "categoria",
      acao: "marcar",
      item: 2,
      legenda: "Escolha a categoria que mais combina com a marca.",
    },
    {
      tela: celular("Categoria", [
        titulo("O que melhor descreve você?"),
        opcao("categoria", "Saúde/beleza", undefined, true),
        opcao(undefined, "Loja de roupas"),
        opcao(undefined, "Produto/serviço"),
        principal("concluir", "Concluir", "Done"),
      ]),
      alvo: "concluir",
      acao: "clicar",
      item: 2,
      legenda: "Toque em Concluir.",
    },
    {
      tela: celular("Tipo de conta", [
        titulo("Você é uma empresa?"),
        opcao(
          "empresa",
          "Empresa",
          "Business",
          false,
          "marcas, lojas, serviços",
        ),
        opcao(undefined, "Criador de conteúdo", "Creator"),
        principal("avancar", "Avançar", "Next"),
      ]),
      alvo: "empresa",
      acao: "marcar",
      item: 2,
      legenda:
        "Escolha Empresa (Business) — ou Criador de conteúdo. Os dois funcionam.",
    },
    {
      tela: celular("Tipo de conta", [
        titulo("Você é uma empresa?"),
        opcao(
          "empresa",
          "Empresa",
          "Business",
          true,
          "marcas, lojas, serviços",
        ),
        opcao(undefined, "Criador de conteúdo", "Creator"),
        principal("avancar", "Avançar", "Next"),
      ]),
      alvo: "avancar",
      acao: "clicar",
      item: 2,
      legenda: "Toque em Avançar e siga até o fim.",
    },
    {
      tela: celular("Privacidade da conta", [
        linha("privada", "Conta privada", {
          en: "Private account",
          valor: "desligado ◯",
        }),
        texto("Com a conta pública, qualquer pessoa vê o perfil."),
      ]),
      alvo: "privada",
      acao: "ver",
      item: 3,
      legenda:
        "Deixe a conta pública: em Configurações → Privacidade da conta, “Conta privada” fica DESLIGADA.",
    },
    {
      tela: perfil([
        linha("painel", "Painel profissional", {
          en: "Professional dashboard",
          valor: "›",
        }),
      ]),
      alvo: "painel",
      acao: "conferir",
      legenda: "Deu certo: o perfil mostra o Painel profissional.",
    },
  ],

  "pagina-instagram": [
    {
      tela: perfil(),
      alvo: "editar",
      acao: "clicar",
      item: 1,
      legenda:
        "No Instagram, no seu perfil, toque em Editar perfil (Edit profile).",
    },
    {
      tela: celular("Editar perfil", EDITAR_PERFIL(false)),
      alvo: "pagina",
      acao: "clicar",
      item: 1,
      legenda: "Toque em Página (Page).",
    },
    {
      tela: celular("Página", [
        titulo("Conecte uma Página do Facebook"),
        texto("Entre com o seu Facebook para escolher a Página da marca."),
        principal("conectar", "Conectar ou criar", "Connect or create"),
      ]),
      alvo: "conectar",
      acao: "clicar",
      item: 1,
      legenda: "Toque em Conectar ou criar e entre com o seu Facebook.",
    },
    {
      tela: celular("Escolha uma Página", [
        opcao(
          "pagina-marca",
          "{marca}",
          undefined,
          false,
          "Página do Facebook",
        ),
        opcao(undefined, "Outra Página"),
        principal("concluido", "Concluído", "Done"),
      ]),
      alvo: "pagina-marca",
      acao: "marcar",
      item: 1,
      legenda: "Escolha a Página da marca.",
    },
    {
      tela: celular("Escolha uma Página", [
        opcao("pagina-marca", "{marca}", undefined, true, "Página do Facebook"),
        opcao(undefined, "Outra Página"),
        principal("concluido", "Concluído", "Done"),
      ]),
      alvo: "concluido",
      acao: "clicar",
      item: 1,
      legenda: "Toque em Concluído.",
    },
    {
      tela: celular("Editar perfil", EDITAR_PERFIL(true)),
      alvo: "pagina",
      acao: "conferir",
      legenda:
        "Deu certo: em Editar perfil → Página aparece o nome da Página. (Pela Central de Contas não vale.)",
    },
  ],

  portfolio: [
    {
      tela: suite("Sem portfólio", PORTFOLIO_NOVO(0)),
      alvo: "nome-portfolio",
      acao: "digitar",
      digitar: "{marca}",
      item: 1,
      legenda:
        "Ainda não tem portfólio? Ao abrir business.facebook.com a própria página pede os dados. Escreva o nome da marca.",
    },
    {
      tela: suite("Sem portfólio", PORTFOLIO_NOVO(1)),
      alvo: "seu-nome",
      acao: "digitar",
      digitar: "Seu nome",
      item: 1,
      legenda: "Escreva o seu nome.",
    },
    {
      tela: suite("Sem portfólio", PORTFOLIO_NOVO(2)),
      alvo: "email",
      acao: "digitar",
      digitar: "contato@suamarca.com.br",
      item: 1,
      legenda:
        "Use um e-mail comercial que você lê: a Meta manda uma confirmação.",
    },
    {
      tela: suite("Sem portfólio", PORTFOLIO_NOVO(3)),
      alvo: "enviar",
      acao: "clicar",
      item: 1,
      legenda:
        "Clique em Enviar (Submit) e confirme pelo e-mail que a Meta mandar.",
    },
    {
      tela: suite("Portfólio da agência"),
      alvo: "seletor",
      acao: "clicar",
      item: 2,
      legenda:
        "Já administra outro portfólio (ex.: o da agência)? Clique no nome dele, no canto de cima à esquerda.",
    },
    {
      tela: suite("Portfólio da agência", {
        titulo: "Portfólios empresariais",
        corpo: [
          linha(undefined, "Portfólio da agência", { valor: "✓" }),
          linha("criar", "+ Criar um portfólio empresarial", {
            en: "Create a business portfolio",
          }),
        ],
      }),
      alvo: "criar",
      acao: "clicar",
      item: 2,
      legenda:
        "Clique em Criar um portfólio empresarial e crie o DA MARCA. Se a marca JÁ tem portfólio, não crie outro: peça Controle total a quem administra.",
    },
    {
      tela: negocio("pessoas", [
        cabecalho("Pessoas", principal("adicionar", "+ Adicionar", "Add")),
        linha("voce", "Seu nome", { valor: "Controle total" }),
      ]),
      alvo: "voce",
      acao: "conferir",
      legenda:
        "Deu certo: em Configurações do negócio aparece o portfólio DA MARCA no topo, e você em Pessoas com Controle total.",
    },
  ],

  "contas-no-portfolio": [
    {
      tela: negocio(undefined, [
        titulo("Configurações do negócio"),
        texto("Escolha um item no menu à esquerda."),
      ]),
      alvo: "topo",
      acao: "ver",
      item: 0,
      legenda:
        "Confira no topo se o portfólio é o DA MARCA ({marca}). Se não for, troque pelo seletor.",
    },
    {
      tela: negocio(undefined, [
        titulo("Configurações do negócio"),
        texto("Escolha um item no menu à esquerda."),
      ]),
      alvo: "paginas",
      acao: "clicar",
      item: 2,
      legenda: "Em Contas (Accounts), clique em Páginas (Pages).",
    },
    {
      tela: negocio("paginas", lista("Páginas", [])),
      alvo: "adicionar",
      acao: "clicar",
      item: 2,
      legenda: "Clique em Adicionar (Add).",
    },
    {
      tela: negocio("paginas", lista("Páginas", []), {
        titulo: "Adicionar Página",
        corpo: [
          linha("add-pagina", "Adicionar uma Página", {
            en: "Add a Page",
            valor: "›",
          }),
          linha(undefined, "Solicitar acesso a uma Página", { valor: "›" }),
          linha(undefined, "Criar uma nova Página", { valor: "›" }),
        ],
      }),
      alvo: "add-pagina",
      acao: "clicar",
      item: 2,
      legenda: "Escolha Adicionar uma Página e selecione a Página da marca.",
    },
    {
      tela: negocio("paginas", lista("Páginas", [{ texto: "{marca}" }])),
      alvo: "contas-instagram",
      acao: "clicar",
      item: 3,
      legenda: "A Página entrou. Agora clique em Contas do Instagram.",
    },
    {
      tela: negocio("contas-instagram", lista("Contas do Instagram", [])),
      alvo: "adicionar",
      acao: "clicar",
      item: 3,
      legenda: "Clique em Adicionar e entre com o Instagram da marca.",
    },
    {
      tela: negocio(
        "contas-instagram",
        lista("Contas do Instagram", [{ texto: "@sua.marca" }]),
      ),
      alvo: "contas-anuncio",
      acao: "clicar",
      item: 4,
      legenda:
        "O Instagram entrou. Agora clique em Contas de anúncios (Ad accounts).",
    },
    {
      tela: negocio("contas-anuncio", lista("Contas de anúncios", [])),
      alvo: "adicionar",
      acao: "clicar",
      item: 4,
      legenda: "Clique em Adicionar.",
    },
    {
      tela: negocio("contas-anuncio", lista("Contas de anúncios", []), {
        titulo: "Adicionar conta de anúncios",
        corpo: [
          linha("add-conta", "Adicionar uma conta de anúncios", {
            en: "Add an ad account",
            valor: "já tenho",
          }),
          linha(undefined, "Solicitar acesso a uma conta de anúncios", {
            valor: "›",
          }),
          linha(undefined, "Criar uma nova conta de anúncios", {
            en: "Create a new ad account",
            valor: "não tenho",
          }),
        ],
      }),
      alvo: "add-conta",
      acao: "clicar",
      item: 4,
      legenda:
        "Já tem conta de anúncios? “Adicionar uma conta de anúncios” e informe o ID. Não tem? “Criar uma nova conta de anúncios”.",
    },
    {
      tela: negocio(
        "contas-anuncio",
        lista("Contas de anúncios", [{ texto: "Conta {marca}" }]),
      ),
      alvo: "item-0",
      acao: "conferir",
      legenda:
        "Deu certo: cada uma aparece na sua lista (Páginas, Contas do Instagram, Contas de anúncios).",
    },
  ],

  desenvolvedor: [
    {
      tela: devSite(
        "developers.facebook.com",
        [titulo("Crie com a Meta"), texto("Documentação, ferramentas e apps.")],
        {
          topoBotoes: [
            botao(undefined, "Documentos"),
            principal("comecar", "Começar", "Get Started"),
          ],
        },
      ),
      alvo: "comecar",
      acao: "clicar",
      item: 0,
      legenda:
        "Em developers.facebook.com, logado com o seu perfil, clique em Começar (Get Started).",
    },
    {
      tela: devSite("developers.facebook.com/async/registration", [], {
        janela: {
          titulo: "Registro de desenvolvedor",
          corpo: [
            texto(
              "Ao continuar, você aceita os Termos da Plataforma e as Políticas para Desenvolvedores.",
            ),
            principal("avancar", "Avançar", "Next"),
          ],
        },
      }),
      alvo: "avancar",
      acao: "clicar",
      item: 1,
      legenda: "Clique em Avançar (Next) para aceitar os termos.",
    },
    {
      tela: devSite("developers.facebook.com/async/registration", [], {
        janela: {
          titulo: "Verifique sua conta",
          corpo: [
            campo("codigo", "Código enviado por SMS"),
            principal("confirmar", "Confirmar", "Confirm"),
          ],
        },
      }),
      alvo: "codigo",
      acao: "digitar",
      digitar: "482913",
      item: 2,
      legenda:
        "Escreva o código que a Meta mandou por SMS (e depois o do e-mail).",
    },
    {
      tela: devSite("developers.facebook.com/async/registration", [], {
        janela: {
          titulo: "Verifique sua conta",
          corpo: [
            campo("codigo", "Código enviado por SMS", "482913"),
            principal("confirmar", "Confirmar", "Confirm"),
          ],
        },
      }),
      alvo: "confirmar",
      acao: "clicar",
      item: 2,
      legenda: "Clique em Confirmar.",
    },
    {
      tela: devSite("developers.facebook.com/async/registration", [], {
        janela: {
          titulo: "Sobre você",
          corpo: [
            texto("O que melhor descreve você?"),
            opcao("ocupacao", "Dono de empresa"),
            opcao(undefined, "Profissional de marketing"),
            opcao(undefined, "Desenvolvedor"),
            principal("concluir", "Concluir cadastro", "Complete registration"),
          ],
        },
      }),
      alvo: "ocupacao",
      acao: "marcar",
      item: 3,
      legenda: "Escolha a ocupação mais próxima (qualquer uma serve).",
    },
    {
      tela: devSite("developers.facebook.com/async/registration", [], {
        janela: {
          titulo: "Sobre você",
          corpo: [
            texto("O que melhor descreve você?"),
            opcao("ocupacao", "Dono de empresa", undefined, true),
            opcao(undefined, "Profissional de marketing"),
            opcao(undefined, "Desenvolvedor"),
            principal("concluir", "Concluir cadastro", "Complete registration"),
          ],
        },
      }),
      alvo: "concluir",
      acao: "clicar",
      item: 3,
      legenda: "Clique em Concluir cadastro.",
    },
    {
      tela: APPS_VAZIO,
      alvo: "criar",
      acao: "conferir",
      legenda: "Deu certo: abre Meus apps (My Apps) com o botão Criar app.",
    },
  ],

  "criar-app": [
    {
      tela: APPS_VAZIO,
      alvo: "criar",
      acao: "clicar",
      item: 0,
      legenda: "Em Meus apps, clique em Criar app (Create app).",
    },
    {
      tela: assistente("w-detalhes", [
        titulo("Detalhes do app"),
        campo("nome", "Nome do app"),
        campo(undefined, "E-mail de contato", "voce@email.com"),
        principal("avancar", "Avançar", "Next"),
      ]),
      alvo: "nome",
      acao: "digitar",
      digitar: "{nomeApp}",
      item: 1,
      legenda:
        "Dê um nome neutro, como “{nomeApp}” (sem Face, Book, Insta ou Gram — a Meta recusa).",
    },
    {
      tela: assistente("w-detalhes", [
        titulo("Detalhes do app"),
        campo("nome", "Nome do app", "{nomeApp}"),
        campo(undefined, "E-mail de contato", "voce@email.com"),
        principal("avancar", "Avançar", "Next"),
      ]),
      alvo: "avancar",
      acao: "clicar",
      item: 1,
      legenda: "Confira o e-mail e clique em Avançar.",
    },
    {
      tela: assistente("w-casos", CASOS(false)),
      alvo: "outro",
      acao: "marcar",
      item: 2,
      legenda: "Em Casos de uso, role até o fim e marque Outro (Other).",
    },
    {
      tela: assistente("w-casos", CASOS(true)),
      alvo: "avancar",
      acao: "clicar",
      item: 2,
      legenda: "Clique em Avançar.",
    },
    {
      tela: assistente("w-tipo", TIPOS(false)),
      alvo: "consumidor",
      acao: "evitar",
      item: 5,
      legenda:
        "NÃO escolha Consumidor (Consumer): esse tipo não gera a chave, e o tipo não muda depois.",
    },
    {
      tela: assistente("w-tipo", TIPOS(false)),
      alvo: "empresa",
      acao: "marcar",
      item: 3,
      legenda: "Escolha Empresa (Business).",
    },
    {
      tela: assistente("w-tipo", TIPOS(true)),
      alvo: "avancar",
      acao: "clicar",
      item: 3,
      legenda: "Clique em Avançar.",
    },
    {
      tela: assistente("w-portfolio", DETALHES_FINAIS),
      alvo: "portfolio",
      acao: "escolher",
      digitar: "{marca} ▾",
      item: 4,
      legenda:
        "Em Portfólio empresarial, escolha o DA MARCA ({marca}) — não deixe “nenhum”.",
    },
    {
      tela: assistente(
        "w-portfolio",
        DETALHES_FINAIS.map((e) =>
          e.id === "portfolio" ? { ...e, valor: "{marca} ▾" } : e,
        ),
      ),
      alvo: "criar-app",
      acao: "clicar",
      item: 4,
      legenda: "Clique em Criar app. A Meta pode pedir a sua senha.",
    },
    {
      tela: devApp("painel", PRODUTOS),
      alvo: "topo",
      acao: "conferir",
      legenda:
        "Deu certo: abre o painel do app. O ID do app (App ID) fica no topo — copie e cole no campo “ID do app” aqui embaixo.",
    },
  ],

  "api-marketing": [
    {
      tela: devApp("painel", PRODUTOS),
      alvo: "add-produto",
      acao: "clicar",
      item: 0,
      legenda: "No painel do app, clique em Adicionar produto (Add product).",
    },
    {
      tela: devApp("add-produto", PRODUTOS),
      alvo: "mkt",
      acao: "clicar",
      item: 0,
      legenda:
        "Em API de Marketing (Marketing API), clique em Configurar (Set up).",
    },
    {
      tela: devApp(
        "p-mkt",
        [
          titulo("API de Marketing"),
          texto("Nível de acesso: Limited access"),
          fila(
            botao("upgrade", "+ Upgrade"),
            botao(
              undefined,
              "Solicitar acesso avançado",
              "Request advanced access",
            ),
          ),
        ],
        { produtos: [PRODUTO_MKT] },
      ),
      alvo: "upgrade",
      acao: "evitar",
      item: 2,
      legenda:
        "NÃO clique em +Upgrade, Solicitar acesso avançado nem Solicitar limite maior. O acesso “Limited” basta.",
    },
    {
      tela: devApp(
        "p-mkt",
        [titulo("API de Marketing"), texto("Nível de acesso: Limited access")],
        { produtos: [PRODUTO_MKT] },
      ),
      alvo: "permissoes",
      acao: "clicar",
      legenda:
        "Para conferir, abra Análise do app → Permissões e recursos (App Review → Permissions and features).",
    },
    {
      tela: devApp(
        "permissoes",
        [
          titulo("Permissões e recursos"),
          linha("tier", "Marketing API Access Tier", {
            valor: "Limited access",
          }),
          linha(undefined, "ads_read", { valor: "Acesso padrão" }),
          linha(undefined, "business_management", { valor: "Acesso padrão" }),
        ],
        { produtos: [PRODUTO_MKT] },
      ),
      alvo: "tier",
      acao: "conferir",
      legenda:
        "Deu certo: “Marketing API Access Tier: Limited access” e ads_read com Acesso padrão.",
    },
  ],

  "produto-instagram": [
    {
      tela: devApp("painel", PRODUTOS, { produtos: [PRODUTO_MKT] }),
      alvo: "add-produto",
      acao: "clicar",
      item: 0,
      legenda: "No painel do app, clique em Adicionar produto.",
    },
    {
      tela: devApp("add-produto", PRODUTOS, { produtos: [PRODUTO_MKT] }),
      alvo: "insta",
      acao: "clicar",
      item: 0,
      legenda: "Em Instagram, clique em Configurar (Set up).",
    },
    {
      tela: devApp(
        "p-insta",
        [
          titulo("Instagram"),
          texto("Escolha como configurar a API:"),
          opcao(
            "login-insta",
            "Configuração da API com login do Instagram",
            "API setup with Instagram login",
            false,
            "a chave vence em 60 dias",
          ),
          opcao(
            "login-fb",
            "Configuração da API com login do Facebook",
            "API setup with Facebook login",
          ),
        ],
        { produtos: [PRODUTO_MKT, PRODUTO_INSTA] },
      ),
      alvo: "login-insta",
      acao: "evitar",
      item: 2,
      legenda:
        "NÃO use “API setup with Instagram login”: é outro tipo de chave, que vence em 60 dias.",
    },
    {
      tela: devApp(
        "p-insta",
        [
          titulo("Instagram"),
          texto("Escolha como configurar a API:"),
          opcao(
            "login-insta",
            "Configuração da API com login do Instagram",
            "API setup with Instagram login",
            false,
            "a chave vence em 60 dias",
          ),
          opcao(
            "login-fb",
            "Configuração da API com login do Facebook",
            "API setup with Facebook login",
          ),
        ],
        { produtos: [PRODUTO_MKT, PRODUTO_INSTA] },
      ),
      alvo: "login-fb",
      acao: "marcar",
      item: 0,
      legenda:
        "Escolha Configuração da API com login do Facebook (API setup with Facebook login).",
    },
    {
      tela: devApp(
        "p-insta",
        [
          titulo("API setup with Facebook login"),
          texto("1. Adicione as permissões necessárias"),
          principal(
            "todas",
            "Adicionar todas as permissões necessárias",
            "Add all required permissions",
          ),
        ],
        { produtos: [PRODUTO_MKT, PRODUTO_INSTA] },
      ),
      alvo: "todas",
      acao: "clicar",
      item: 1,
      legenda:
        "Clique em Adicionar todas as permissões necessárias (Add all required permissions).",
    },
    {
      tela: devApp(
        "p-insta",
        [
          titulo("API setup with Facebook login"),
          texto("Permissões adicionadas ✓"),
        ],
        { produtos: [PRODUTO_MKT, PRODUTO_INSTA] },
      ),
      alvo: "permissoes",
      acao: "clicar",
      item: 1,
      legenda: "Depois abra Permissões e recursos (Permissions and features).",
    },
    {
      tela: devApp("permissoes", PERMISSOES_INSTA(false), {
        produtos: [PRODUTO_MKT, PRODUTO_INSTA],
      }),
      alvo: "insights",
      acao: "clicar",
      item: 1,
      legenda:
        "Ao lado de instagram_manage_insights, clique em Adicionar (se ainda não estiver).",
    },
    {
      tela: devApp("permissoes", PERMISSOES_INSTA(true), {
        produtos: [PRODUTO_MKT, PRODUTO_INSTA],
      }),
      alvo: "insights",
      acao: "conferir",
      legenda:
        "Deu certo: as 6 permissões aparecem com “Acesso padrão” (Standard access).",
    },
  ],

  "nao-publicar": [
    {
      tela: devApp(
        "painel",
        [titulo("Painel"), texto("O app está em desenvolvimento.")],
        {
          produtos: [PRODUTO_MKT, PRODUTO_INSTA],
          topoBotoes: [
            botao(undefined, "Enviar para análise", "Submit for review"),
            botao("publicar", "Publicar", "Publish"),
          ],
        },
      ),
      alvo: "publicar",
      acao: "evitar",
      item: 0,
      legenda:
        "NÃO clique em Publicar / Ficar ao vivo nem em Enviar para análise. Não precisa preencher política de privacidade, ícone nem categoria.",
    },
    {
      tela: devApp(
        "painel",
        [titulo("Painel"), texto("O app está em desenvolvimento.")],
        { produtos: [PRODUTO_MKT, PRODUTO_INSTA] },
      ),
      alvo: "avancado",
      acao: "clicar",
      item: 2,
      legenda: "Abra Configurações do app → Avançado (Advanced).",
    },
    {
      tela: devApp(
        "avancado",
        [
          titulo("Avançado"),
          texto("Segurança"),
          linha("exigir", "Exigir chave secreta do app", {
            en: "Require App Secret",
            valor: "Não",
          }),
          linha(undefined, "Lista de IPs permitidos", { valor: "—" }),
        ],
        { produtos: [PRODUTO_MKT, PRODUTO_INSTA] },
      ),
      alvo: "exigir",
      acao: "ver",
      item: 2,
      legenda:
        "Em Segurança, veja “Exigir chave secreta do app”. Está “Não”? Pronto, pode ir para o próximo passo.",
    },
    {
      tela: devApp(
        "avancado",
        [
          titulo("Avançado"),
          texto("Segurança"),
          linha("exigir", "Exigir chave secreta do app", {
            en: "Require App Secret",
            valor: "Sim",
          }),
        ],
        { produtos: [PRODUTO_MKT, PRODUTO_INSTA] },
      ),
      alvo: "basico",
      acao: "clicar",
      item: 2,
      legenda:
        "Só se estiver “Sim”: abra Configurações do app → Básico (Basic).",
    },
    {
      tela: devApp(
        "basico",
        [
          titulo("Básico"),
          campo(undefined, "ID do app", "{appId}"),
          linha("secreta", "Chave secreta do app", {
            en: "App secret",
            valor: "••••••••",
            botao: "Mostrar",
          }),
        ],
        { produtos: [PRODUTO_MKT, PRODUTO_INSTA] },
      ),
      alvo: "secreta",
      acao: "clicar",
      item: 2,
      legenda:
        "Em Chave secreta do app, clique em Mostrar (a Meta pede a senha) e guarde: ela é colada no passo 15, junto com a chave.",
    },
  ],

  "app-no-portfolio": [
    {
      tela: negocio(undefined, [
        titulo("Configurações do negócio"),
        texto("Escolha um item no menu à esquerda."),
      ]),
      alvo: "topo",
      acao: "ver",
      item: 0,
      legenda: "Confira no topo se o portfólio é o DA MARCA ({marca}).",
    },
    {
      tela: negocio(undefined, [
        titulo("Configurações do negócio"),
        texto("Escolha um item no menu à esquerda."),
      ]),
      alvo: "apps",
      acao: "clicar",
      item: 1,
      legenda: "Em Contas (Accounts), clique em Apps.",
    },
    {
      tela: negocio(
        "apps",
        lista("Apps", [{ texto: "{nomeApp}", valor: "ID {appId}" }]),
      ),
      alvo: "item-0",
      acao: "conferir",
      item: 2,
      legenda: "O seu app tem que estar na lista. Está? Este passo acabou.",
    },
    {
      tela: negocio("apps", lista("Apps", [])),
      alvo: "adicionar",
      acao: "clicar",
      item: 3,
      legenda: "Não está? Clique em Adicionar (Add).",
    },
    {
      tela: negocio("apps", lista("Apps", []), {
        titulo: "Adicionar app",
        corpo: [
          linha("conectar", "Conectar um ID do app", {
            en: "Connect an app ID",
          }),
          linha("solicitar", "Solicitar acesso a um ID do app", {
            en: "Request access",
          }),
          linha(undefined, "Criar um novo ID do app"),
        ],
      }),
      alvo: "solicitar",
      acao: "evitar",
      item: 4,
      legenda:
        "NÃO use Solicitar acesso nem Criar um novo ID do app: o app tem que ser DO portfólio.",
    },
    {
      tela: negocio("apps", lista("Apps", []), {
        titulo: "Adicionar app",
        corpo: [
          linha("conectar", "Conectar um ID do app", {
            en: "Connect an app ID",
          }),
          linha("solicitar", "Solicitar acesso a um ID do app", {
            en: "Request access",
          }),
          linha(undefined, "Criar um novo ID do app"),
        ],
      }),
      alvo: "conectar",
      acao: "clicar",
      item: 3,
      legenda: "Clique em Conectar um ID do app (Connect an app ID).",
    },
    {
      tela: negocio("apps", lista("Apps", []), {
        titulo: "Conectar um ID do app",
        corpo: [
          campo("id", "ID do app"),
          principal("add", "Adicionar app", "Add app"),
        ],
      }),
      alvo: "id",
      acao: "digitar",
      digitar: "{appId}",
      item: 3,
      legenda: "Cole o ID do app (fica no topo do painel do app).",
    },
    {
      tela: negocio("apps", lista("Apps", []), {
        titulo: "Conectar um ID do app",
        corpo: [
          campo("id", "ID do app", "{appId}"),
          principal("add", "Adicionar app", "Add app"),
        ],
      }),
      alvo: "add",
      acao: "clicar",
      item: 3,
      legenda: "Clique em Adicionar app.",
    },
  ],

  "usuario-do-sistema": [
    {
      tela: negocio(undefined, [
        titulo("Configurações do negócio"),
        texto("Escolha um item no menu à esquerda."),
      ]),
      alvo: "usuarios-sistema",
      acao: "clicar",
      item: 1,
      legenda:
        "Em Usuários (Users), clique em Usuários do sistema (System users).",
    },
    {
      tela: negocio("usuarios-sistema", lista("Usuários do sistema", [])),
      alvo: "adicionar",
      acao: "clicar",
      item: 1,
      legenda: "Clique em Adicionar (+ Add).",
    },
    ...[0, 1, 2].map(
      (etapa): Quadro => ({
        tela: negocio("usuarios-sistema", lista("Usuários do sistema", []), {
          titulo: "Criar usuário do sistema",
          corpo: [
            campo(
              "nome",
              "Nome do usuário do sistema",
              etapa > 0 ? "encEditor" : "",
            ),
            texto("Função do usuário do sistema"),
            opcao(
              "funcionario",
              "Funcionário",
              "Employee",
              etapa > 1,
              "só vê o que você der a ele",
            ),
            opcao(
              "admin",
              "Administrador",
              "Admin",
              false,
              "vê todas as contas",
            ),
            principal(
              "criar",
              "Criar usuário do sistema",
              "Create system user",
            ),
          ],
        }),
        alvo: ["nome", "funcionario", "criar"][etapa],
        acao: (["digitar", "marcar", "clicar"] as const)[etapa],
        digitar: etapa === 0 ? "encEditor" : undefined,
        item: 2,
        legenda: [
          "Nome: encEditor.",
          "Função: Funcionário (Employee) — ele só enxerga o que você der no próximo passo.",
          "Clique em Criar usuário do sistema.",
        ][etapa],
      }),
    ),
    {
      tela: negocio(
        "usuarios-sistema",
        lista("Usuários do sistema", [
          { texto: "encEditor", valor: "Funcionário" },
        ]),
      ),
      alvo: "item-0",
      acao: "conferir",
      legenda: "Deu certo: encEditor aparece na lista, como Funcionário.",
    },
  ],

  "dar-acesso": [
    {
      tela: negocio(
        "usuarios-sistema",
        lista("Usuários do sistema", [
          { texto: "encEditor", valor: "Funcionário" },
        ]),
      ),
      alvo: "item-0",
      acao: "clicar",
      item: 0,
      legenda: "Em Usuários do sistema, clique em encEditor.",
    },
    {
      tela: usuarioDoSistema([]),
      alvo: "atribuir",
      acao: "clicar",
      item: 0,
      legenda: "Clique em Atribuir ativos (Assign assets).",
    },
    {
      tela: usuarioDoSistema([], atribuir(null)),
      alvo: "tipo-apps",
      acao: "clicar",
      item: 1,
      legenda: "Escolha Apps.",
    },
    {
      tela: usuarioDoSistema([], atribuir("apps")),
      alvo: "ativo",
      acao: "marcar",
      item: 1,
      legenda: "Marque o seu app ({nomeApp}).",
    },
    {
      tela: usuarioDoSistema([], atribuir("apps", true)),
      alvo: "permissao",
      acao: "marcar",
      item: 1,
      legenda: "Ligue Gerenciar app (Manage app) — o controle total do app.",
    },
    {
      tela: usuarioDoSistema([], atribuir("apps", true, true)),
      alvo: "tipo-anuncios",
      acao: "clicar",
      item: 2,
      legenda: "Agora escolha Contas de anúncios (Ad accounts).",
    },
    {
      tela: usuarioDoSistema([], atribuir("anuncios")),
      alvo: "ativo",
      acao: "marcar",
      item: 2,
      legenda: "Marque a conta de anúncios da marca.",
    },
    {
      tela: usuarioDoSistema([], atribuir("anuncios", true)),
      alvo: "permissao",
      acao: "marcar",
      item: 2,
      legenda:
        "Marque SÓ Ver desempenho (View performance): assim a chave não mexe em campanhas.",
    },
    {
      tela: usuarioDoSistema([], atribuir("anuncios", true, true)),
      alvo: "campanhas",
      acao: "evitar",
      item: 2,
      legenda: "Deixe Gerenciar campanhas e Controle total DESMARCADOS.",
    },
    {
      tela: usuarioDoSistema([], atribuir("anuncios", true, true)),
      alvo: "tipo-paginas",
      acao: "clicar",
      item: 4,
      legenda: "Agora escolha Páginas (Pages).",
    },
    {
      tela: usuarioDoSistema([], atribuir("paginas")),
      alvo: "ativo",
      acao: "marcar",
      item: 4,
      legenda: "Marque a Página ligada ao Instagram.",
    },
    {
      tela: usuarioDoSistema([], atribuir("paginas", true)),
      alvo: "permissao",
      acao: "marcar",
      item: 4,
      legenda:
        "Ligue Controle total (Full control). A chave não tem permissão de publicar, então não posta nada.",
    },
    {
      tela: usuarioDoSistema([], atribuir("paginas", true, true)),
      alvo: "confirmar",
      acao: "clicar",
      item: 6,
      legenda:
        "Clique em Atribuir ativos, espere alguns minutos e recarregue a página.",
    },
    {
      tela: usuarioDoSistema(ATRIBUIDOS),
      alvo: "ativo-0",
      acao: "conferir",
      legenda:
        "Deu certo: aparecem o app (Gerenciar app), a conta de anúncios (Ver desempenho) e a Página (Controle total).",
    },
  ],

  "gerar-chave": [
    {
      tela: usuarioDoSistema(ATRIBUIDOS, undefined, true),
      alvo: "aviso",
      acao: "ver",
      item: 0,
      legenda:
        "Esse aviso em inglês aparece para todo mundo: ignore e NÃO envie o app para análise.",
    },
    {
      tela: usuarioDoSistema(ATRIBUIDOS, undefined, true),
      alvo: "gerar",
      acao: "clicar",
      item: 2,
      legenda:
        "Clique em Gerar token (Generate token) — só este botão serve (os do painel do app dão chaves que vencem).",
    },
    {
      tela: usuarioDoSistema(ATRIBUIDOS, gerarToken(false, false, 0), true),
      alvo: "app",
      acao: "escolher",
      digitar: "{nomeApp} ▾",
      item: 3,
      legenda: "Escolha o seu app.",
    },
    {
      tela: usuarioDoSistema(ATRIBUIDOS, gerarToken(true, false, 0), true),
      alvo: "nunca",
      acao: "marcar",
      item: 4,
      legenda:
        "Em Validade do token (Token expiration), escolha Nunca (Never).",
    },
    ...PERMISSOES_DA_CHAVE.map(
      (p, n): Quadro => ({
        tela: usuarioDoSistema(ATRIBUIDOS, gerarToken(true, true, n), true),
        alvo: `perm-${p}`,
        acao: "marcar",
        item: 5,
        rapido: true,
        legenda: `Marque as 6 permissões (${n + 1} de 6): ${p}.`,
      }),
    ),
    {
      tela: usuarioDoSistema(ATRIBUIDOS, gerarToken(true, true, 6), true),
      alvo: "perm-ads_management",
      acao: "evitar",
      item: 7,
      legenda:
        "Deixe ads_management DESMARCADA (só se o encEditor pedir depois — veja a observação abaixo).",
    },
    {
      tela: usuarioDoSistema(ATRIBUIDOS, gerarToken(true, true, 6), true),
      alvo: "gerar-token",
      acao: "clicar",
      item: 6,
      legenda: "Clique em Gerar token.",
    },
    {
      tela: usuarioDoSistema(
        ATRIBUIDOS,
        {
          titulo: "Token gerado",
          corpo: [
            { tipo: "chave", texto: "EAAGm0PX4ZCpsBAO…k2ZC9yZBdQZDZD" },
            texto("Copie agora: depois ele não aparece de novo."),
            principal("copiar", "Copiar", "Copy"),
          ],
        },
        true,
      ),
      alvo: "copiar",
      acao: "clicar",
      item: 6,
      legenda:
        "Copie a chave inteira (começa com EAA) e cole no passo 15, aqui no encEditor.",
    },
  ],

  "ligar-versoes": [
    {
      tela: resultados(),
      alvo: "versao",
      acao: "clicar",
      item: 0,
      legenda:
        "Na aba Resultados, na versão exportada, clique em “ligar ao post/anúncio”.",
    },
    {
      tela: resultados(ligar(false)),
      alvo: "post",
      acao: "clicar",
      item: 1,
      legenda: "Escolha o post do Instagram em que o vídeo foi publicado.",
    },
    {
      tela: resultados(ligar(true)),
      alvo: "anuncio",
      acao: "conferir",
      item: 1,
      legenda:
        "O encEditor já marca os anúncios que usam esse post. Marque outros, se tiver.",
    },
    {
      tela: resultados(ligar(true)),
      alvo: "salvar",
      acao: "clicar",
      item: 2,
      legenda: "Clique em Salvar e buscar números.",
    },
    {
      tela: resultados(undefined, true),
      alvo: "pago",
      acao: "conferir",
      legenda:
        "Pronto: os números entram na hora e se atualizam sozinhos a cada 6 horas.",
    },
  ],
};
