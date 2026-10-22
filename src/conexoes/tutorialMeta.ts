// Passo a passo (do zero) para cada pessoa ligar o Instagram e os anúncios
// da Meta ao encEditor com um app DELA — sem análise da Meta, porque o app
// fica no portfólio dono das contas e só lê. Mostrado em /conectar.
//
// Fontes: documentação oficial da Meta (developers.facebook.com), conferida
// em out/2026 por pesquisa com verificação, e revisão independente (detalhes
// no CLAUDE.MD, "Métricas da Meta"). A Meta muda telas e nomes com
// frequência: por isso cada botão aparece em português e, entre parênteses,
// em inglês, com variações. Os ids dos passos são usados nos avisos de
// src/conexoes/meta.ts. Itens que começam com "⚠" são alertas e com "ℹ"
// são explicações (aparecem sem número).

export type PassoTutorial = {
  id: string;
  titulo: string;
  // Por que este passo existe, em uma frase.
  porque: string;
  minutos: number;
  // "Pule se…" (quando já está feito).
  pule?: string;
  // "{app}" na url = ID do app (passo 7); sem ele, abre a lista de apps.
  links: { rotulo: string; url: string }[];
  // O que fazer, em ordem.
  fazer: string[];
  // Como saber que deu certo.
  confira: string;
  problemas: { sintoma: string; solucao: string }[];
  // Passo especial que mostra o formulário de colar a chave.
  formulario?: boolean;
  // Textos para copiar com um clique ({nomeApp}, {appId}).
  copiar?: { rotulo: string; valor: string }[];
  // Mostra o campo para guardar o ID do app (usado nos links dos próximos).
  pedirIdDoApp?: boolean;
};

// Nome sugerido para o app: sem acentos e sem as palavras que a Meta recusa.
export const nomeDoApp = (marca: string) => {
  const limpo = marca
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/face|book|insta|gram/gi, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24)
    .trim();
  return `Metricas ${limpo || "Marca"}`;
};

const PORTFOLIO_CERTO =
  "⚠ Tem mais de um portfólio (ex.: o da agência e o da marca)? Antes de mexer em Configurações do negócio, confira no topo da página se é o portfólio DA MARCA. Se não for, troque pelo seletor no canto superior esquerdo.";

export const ANTES_DE_COMECAR = {
  oQue: "Você vai criar um “app” seu na Meta — é só um cadastro, não precisa programar nem publicar nada — e gerar uma chave de acesso que deixa o encEditor LER os números do seu Instagram e dos seus anúncios. Com ela, os resultados de cada vídeo entram sozinhos.",
  porQueGratis:
    "É grátis e não passa por análise da Meta: o app fica no seu próprio portfólio empresarial e só lê as suas contas. A Meta só exige análise de apps que acessam contas de outras empresas. Algumas telas da Meta ainda falam em “análise”; se em algum passo a Meta EXIGIR análise ou verificação para continuar, pare e fale com quem cuida do encEditor — não envie nada.",
  tempo:
    "40 a 60 minutos na primeira vez (dá para parar e continuar depois: o encEditor lembra os passos marcados neste computador).",
  separe: [
    "Um computador (o painel da Meta é ruim no celular).",
    "O perfil PESSOAL do Facebook de quem administra a marca — o mesmo que tem controle total do portfólio empresarial e da conta de anúncios.",
    "Um celular que recebe SMS e um e-mail que você lê (a Meta manda códigos).",
    "O app do Instagram da marca instalado no celular.",
  ],
  agencia:
    "É agência (ou cuida das contas de um cliente)? Quem cola a chave é quem usa o encEditor. O jeito recomendado: o cliente te dá Controle total no portfólio DELE (Configurações do negócio → Usuários → Pessoas → Adicionar) e você faz os passos 6 a 15 com o seu perfil, colando a chave direto aqui — assim a chave não passa por mensagem. Tudo é feito no portfólio do CLIENTE (o dono do Instagram e da conta de anúncios): um app no portfólio da agência não lê contas que são só compartilhadas com ela. Cada pessoa pode ser administradora de no máximo 15 apps em portfólios não verificados. Pelos Termos da Meta, usar a chave do app de outra empresa faz de você um “Provedor de Serviços” dela: combine isso por escrito com o cliente.",
  idioma:
    "Os nomes dos botões aparecem em português e, entre parênteses, em inglês. A Meta muda as telas com frequência: se um nome estiver um pouco diferente, procure o mais parecido.",
};

export const PASSOS_META: PassoTutorial[] = [
  {
    id: "dois-fatores",
    titulo: "Proteja o seu Facebook com a verificação em duas etapas",
    porque:
      "A Meta pede isso para mexer no portfólio empresarial e em usuários do sistema; sem ela, alguns botões ficam bloqueados.",
    minutos: 5,
    pule: "a verificação em duas etapas já está ativada no seu perfil.",
    links: [
      {
        rotulo: "Central de Contas",
        url: "https://accountscenter.facebook.com/password_and_security",
      },
    ],
    fazer: [
      "Entre no Facebook com o seu perfil PESSOAL (não crie “perfil da empresa”: a empresa entra como Página no passo 3).",
      "Abra a Central de Contas (Accounts Center) → Senha e segurança (Password and security) → Autenticação de dois fatores (Two-factor authentication).",
      "Escolha o seu perfil e um método: app autenticador, SMS ou WhatsApp. Siga as instruções até o fim.",
      "Aproveite e confira em Dados pessoais → Informações de contato se o celular e o e-mail estão certos.",
    ],
    confira: "A autenticação de dois fatores aparece como ativada.",
    problemas: [
      {
        sintoma: "O código por SMS não chega.",
        solucao:
          "Não fique reenviando (a Meta bloqueia por um tempo). Confira o número, espere algumas horas e tente de novo — ou use um app autenticador.",
      },
    ],
  },
  {
    id: "instagram-profissional",
    titulo: "Deixe o Instagram como conta profissional",
    porque: "A Meta só entrega os números (insights) de contas profissionais.",
    minutos: 3,
    pule: "o perfil já mostra o “Painel profissional”.",
    links: [],
    fazer: [
      "No app do Instagram, vá no seu perfil → menu ☰ → Configurações e privacidade (Settings and privacy).",
      "Toque em Tipo de conta e ferramentas (Account type and tools) — em algumas versões fica dentro de “Para profissionais” — → Mudar para conta profissional (Switch to professional account).",
      "Escolha uma categoria e o tipo: Empresa (Business), para marcas e lojas, ou Criador de conteúdo (Creator). Os dois funcionam.",
      "Deixe a conta pública.",
    ],
    confira:
      "O perfil passa a mostrar o Painel profissional e as publicações ganham “Ver insights”.",
    problemas: [
      {
        sintoma: "Não acho a opção.",
        solucao:
          "O nome muda conforme a versão do app: procure por “Tipo de conta” na busca das configurações.",
      },
    ],
  },
  {
    id: "pagina-instagram",
    titulo: "Ligue o Instagram a uma Página do Facebook",
    porque:
      "O caminho que dá a chave que não expira lê o Instagram ATRAVÉS da Página ligada a ele.",
    minutos: 5,
    pule: "na sua Página, em Contas vinculadas → Instagram, já aparece o @ da marca.",
    links: [
      { rotulo: "Criar Página", url: "https://www.facebook.com/pages/create" },
    ],
    fazer: [
      "Se a marca ainda não tem Página no Facebook, crie uma (Criar Página / Create Page) com o nome da marca.",
      "Ligue pelo Instagram: perfil → Editar perfil (Edit profile) → Página (Page) → Conectar ou criar (Connect or create) → entre no Facebook e escolha a Página.",
      "Ou ligue pelo Facebook, no computador: mude para o perfil da Página → Configurações e privacidade → Configurações → Contas vinculadas (Linked accounts) → Instagram → Conectar conta (Connect account).",
      "⚠ Ligar o Instagram só pela Central de Contas NÃO basta: tem que ser por um dos dois caminhos acima.",
    ],
    confira:
      "Na Página, em Contas vinculadas → Instagram, aparece o @. No Instagram, em Editar perfil → Página, aparece o nome da Página.",
    problemas: [
      {
        sintoma: "Não deixa ligar.",
        solucao:
          "Você precisa ter controle total (administrador) da Página, e a conta do Instagram precisa ser profissional (passo 2). Cada Instagram se liga a uma Página só.",
      },
    ],
  },
  {
    id: "portfolio",
    titulo:
      "Tenha um portfólio empresarial da marca (o antigo Gerenciador de Negócios)",
    porque:
      "O app, as contas e o “usuário do sistema” que gera a chave moram dentro dele.",
    minutos: 5,
    pule: "a marca já tem portfólio e você tem Controle total nele (NÃO crie outro).",
    links: [
      { rotulo: "Meta Business Suite", url: "https://business.facebook.com" },
      {
        rotulo: "Configurações do negócio",
        url: "https://business.facebook.com/settings",
      },
    ],
    fazer: [
      "Abra business.facebook.com com o mesmo perfil do passo 1.",
      "Se você ainda não tem nenhum portfólio, a própria página pede os dados: nome do negócio, seu nome e um e-mail comercial → Enviar (Submit) → confirme pelo e-mail que a Meta mandar.",
      "Já administra outro portfólio (ex.: o da agência) e a marca não tem um? Clique no nome do portfólio no canto superior esquerdo → Criar um portfólio empresarial (Create a business portfolio) e crie o DA MARCA.",
      "Se a marca JÁ tem portfólio, não crie outro: peça a quem administra para te dar Controle total (Full control).",
    ],
    confira:
      "business.facebook.com/settings abre com o nome do portfólio DA MARCA no topo, e em Usuários → Pessoas (Users → People) você aparece com Controle total.",
    problemas: [
      {
        sintoma: "“Unable to access Meta Business Suite with this account”.",
        solucao: "Crie uma Página antes (passo 3) e tente de novo.",
      },
    ],
  },
  {
    id: "contas-no-portfolio",
    titulo:
      "Coloque a Página, o Instagram e a conta de anúncios dentro do portfólio",
    porque: "O app só lê o que está no MESMO portfólio dele.",
    minutos: 5,
    pule: "as três já aparecem nas listas de Contas do portfólio da marca.",
    links: [
      {
        rotulo: "Páginas",
        url: "https://business.facebook.com/settings/pages",
      },
      {
        rotulo: "Contas de anúncios",
        url: "https://business.facebook.com/settings/ad-accounts",
      },
      {
        rotulo: "Configurações do negócio",
        url: "https://business.facebook.com/settings",
      },
    ],
    fazer: [
      PORTFOLIO_CERTO,
      "Em Configurações do negócio → Contas (Accounts):",
      "Páginas (Pages) → Adicionar (Add) → escolha a Página da marca.",
      "Contas do Instagram (Instagram accounts) → Adicionar → entre no Instagram da marca.",
      "Contas de anúncios (Ad accounts) → Adicionar → “Adicionar uma conta de anúncios” (informe o ID dela) ou “Criar uma nova conta de anúncios”.",
      "⚠ Reivindicar ou criar conta de anúncios no portfólio é permanente. Se a conta for de OUTRA empresa, faça o tutorial no portfólio dela.",
    ],
    confira:
      "Cada uma aparece na sua lista (Páginas, Contas do Instagram, Contas de anúncios).",
    problemas: [
      {
        sintoma:
          "“Personal ad account can't be added to your business portfolio”.",
        solucao:
          "Conta de anúncios pessoal não entra em portfólio: crie uma conta de anúncios nova dentro do portfólio. Atenção: os anúncios que rodaram na conta pessoal (inclusive os impulsionamentos feitos pelo app do Instagram) não serão lidos pelo encEditor. Daqui em diante, crie e impulsione pela conta nova (no Instagram, confira que o impulsionamento usa essa conta).",
      },
      {
        sintoma: "Pedido fica pendente.",
        solucao:
          "Pedidos para contas de outras pessoas ficam em Solicitações (Requests) até o dono aceitar.",
      },
    ],
  },
  {
    id: "desenvolvedor",
    titulo: "Cadastre-se como desenvolvedor da Meta",
    porque: "Só desenvolvedores podem criar apps. É grátis e não pede cartão.",
    minutos: 5,
    pule: "developers.facebook.com/apps já abre com o botão Criar app.",
    links: [
      {
        rotulo: "Meta for Developers",
        url: "https://developers.facebook.com/async/registration",
      },
    ],
    fazer: [
      "Abra developers.facebook.com logado com o seu perfil → Começar (Get Started).",
      "Clique em Avançar (Next) para aceitar os termos.",
      "Confirme o celular e o e-mail com os códigos que a Meta mandar.",
      "Escolha a ocupação mais próxima e conclua.",
    ],
    confira:
      "Abre a página Meus apps (My Apps) com o botão Criar app (Create app).",
    problemas: [
      {
        sintoma: "O SMS não chega.",
        solucao:
          "Pare de reenviar, confira o celular na Central de Contas e tente mais tarde.",
      },
    ],
  },
  {
    id: "criar-app",
    titulo: "Crie o seu app",
    porque:
      "É o app que vai “assinar” a chave de acesso. Ele fica só seu, sem publicar.",
    minutos: 5,
    links: [
      {
        rotulo: "Criar app",
        url: "https://developers.facebook.com/apps/creation/",
      },
    ],
    fazer: [
      "Em developers.facebook.com/apps → Criar app (Create app).",
      "Detalhes do app: um nome neutro, como “Metricas Loja X” (sem “Face”, “Book”, “Insta” ou “Gram”, que a Meta recusa) e o seu e-mail → Avançar.",
      "Casos de uso (Use cases): role até o fim, marque Outro (Other) → Avançar.",
      "Tipo do app: Empresa / Negócios (Business) → Avançar.",
      "Na tela seguinte, conecte o portfólio DA MARCA (passo 4) → Criar app (Create app). A Meta pode pedir a sua senha.",
      "⚠ Não escolha Consumidor (Consumer): esse tipo não gera chave. O tipo não muda depois.",
      "Se NÃO existir a opção “Outro”: no filtro “Anúncios e monetização” (Ads and monetization) marque “Mensurar dados de desempenho do anúncio com a API de Marketing” (Measure ad performance data with Marketing API) e, no filtro “Gerenciamento de conteúdo” (Content Management), se não estiver cinza, “Gerenciar mensagens e conteúdo no Instagram” (Manage messaging and content on Instagram) → Avançar → escolha o portfólio da marca → Avançar até o painel.",
    ],
    confira:
      "Abre o painel do app, com o ID do app (App ID) no topo. É normal NÃO ver a chave Desenvolvimento/Ao vivo.",
    copiar: [{ rotulo: "Nome do app", valor: "{nomeApp}" }],
    pedirIdDoApp: true,
    problemas: [
      {
        sintoma: "Aparece limite de apps.",
        solucao:
          "Cada pessoa pode ser administradora de no máximo 15 apps em portfólios não verificados (os arquivados contam). Apague apps antigos ou peça a outra pessoa do negócio para criar.",
      },
      {
        sintoma: "A lista de portfólios aparece vazia.",
        solucao: "Você precisa de Controle total no portfólio (passo 4).",
      },
    ],
  },
  {
    id: "api-marketing",
    titulo: "Adicione a API de Marketing ao app",
    porque:
      "É ela que libera a leitura dos anúncios e permite criar a chave do usuário do sistema (vale também para ler o Instagram).",
    minutos: 3,
    links: [
      {
        rotulo: "Painel do seu app",
        url: "https://developers.facebook.com/apps/{app}/dashboard/",
      },
    ],
    fazer: [
      "No painel do app → Adicionar produto (Add product) → API de Marketing (Marketing API) → Configurar (Set up).",
      "Se o painel mostrar “Casos de uso” em vez de produtos: Adicionar caso de uso → filtro “Anúncios e monetização” → “Mensurar dados de desempenho do anúncio com a API de Marketing”.",
      "⚠ NÃO clique em “+Upgrade”, “Solicitar acesso avançado” (Request advanced access) nem “Solicitar limite maior” (Request higher limit).",
    ],
    confira:
      "Em Análise do app → Permissões e recursos (App Review → Permissions and features): “Marketing API Access Tier: Limited access” (em telas antigas: “Acesso padrão ao gerenciamento de anúncios”) e ads_read com Acesso padrão (Standard access). App criado por casos de uso: confira em Casos de uso → Personalizar → Permissões e recursos.",
    problemas: [
      {
        sintoma: "Fico na dúvida se o “Limited” basta.",
        solucao:
          "Basta: ele dá acesso às suas próprias contas, com um limite baixo de leituras — suficiente para o encEditor, que lê no máximo a cada 6 horas.",
      },
    ],
  },
  {
    id: "produto-instagram",
    titulo: "Adicione o Instagram ao app (com login do Facebook)",
    porque: "Libera as permissões de ler os posts e as métricas do Instagram.",
    minutos: 3,
    links: [
      {
        rotulo: "Painel do seu app",
        url: "https://developers.facebook.com/apps/{app}/dashboard/",
      },
    ],
    fazer: [
      "No painel do app → Adicionar produto → Instagram → Configurar → “Configuração da API com login do Facebook” (API setup with Facebook login).",
      "No painel de casos de uso: Casos de uso → “Gerenciar mensagens e conteúdo no Instagram” (se não estiver lá: Adicionar caso de uso → filtro “Gerenciamento de conteúdo” / Content Management) → Personalizar (Customize) → API setup with Facebook login → clique em “Adicionar todas as permissões necessárias” (Add all required permissions) → depois, em Permissões e recursos (Permissions and features), clique em Adicionar ao lado de instagram_manage_insights.",
      "⚠ NÃO use “API setup with Instagram login” (é outro tipo de chave, que vence em 60 dias).",
    ],
    confira:
      "Em Análise do app → Permissões e recursos (app por casos de uso: Casos de uso → Personalizar → Permissões e recursos), procure e veja “Acesso padrão” em: instagram_basic, instagram_manage_insights, pages_show_list, pages_read_engagement, business_management e ads_read.",
    problemas: [
      {
        sintoma: "O caso de uso do Instagram está cinza (não dá para marcar).",
        solucao:
          "Veja “O Instagram ficou cinza” nos Problemas comuns, no fim da página.",
      },
    ],
  },
  {
    id: "nao-publicar",
    titulo: "Deixe o app como está (e veja uma configuração)",
    porque:
      "Publicar, pedir análise ou verificar a empresa só é exigido de apps que acessam contas de OUTRAS empresas.",
    minutos: 2,
    links: [
      {
        rotulo: "Configurações avançadas do app",
        url: "https://developers.facebook.com/apps/{app}/settings/advanced/",
      },
      {
        rotulo: "Chave secreta (Básico)",
        url: "https://developers.facebook.com/apps/{app}/settings/basic/",
      },
    ],
    fazer: [
      "NÃO clique em Publicar / Ficar ao vivo (Publish / Go live), Enviar para análise (Submit for review), Verificação da empresa nem Acesso avançado.",
      "Não precisa preencher política de privacidade, ícone nem categoria.",
      "Abra Configurações do app → Avançado → Segurança (App settings → Advanced → Security) e veja “Exigir chave secreta do app” (Require App Secret). Se estiver LIGADO, vá em Configurações do app → Básico → Chave secreta do app → Mostrar (a Meta pede a senha) e guarde a chave secreta: você vai colar no encEditor também.",
    ],
    confira:
      "O app continua no painel sem nada publicado. Tudo bem aparecer “não publicado” ou nenhum indicador de modo.",
    problemas: [
      {
        sintoma: "A Meta avisa que o app pode ficar “inativo”.",
        solucao:
          "Um app fica inativo depois de 90 dias sem nenhum uso. Enquanto o encEditor estiver ligado, ele fala com a Meta a cada 6 horas, o que evita isso. Se o encEditor ficar mais de 90 dias desligado e o painel do app disser “inativo”, restaure o app ali, gere uma chave nova (passo 14) e cole no encEditor.",
      },
    ],
  },
  {
    id: "app-no-portfolio",
    titulo: "Confira se o app está no portfólio da marca",
    porque: "O usuário do sistema só recebe apps do mesmo portfólio.",
    minutos: 2,
    links: [
      {
        rotulo: "Apps do portfólio",
        url: "https://business.facebook.com/settings/apps",
      },
      {
        rotulo: "Configurações do negócio",
        url: "https://business.facebook.com/settings",
      },
    ],
    fazer: [
      PORTFOLIO_CERTO,
      "Em Configurações do negócio → Contas → Apps (em algumas telas, “Aplicativos”).",
      "O seu app tem que estar na lista.",
      "Se não estiver: Adicionar (Add) → “Conectar um ID do app” (Connect an app ID) → cole o ID do app (fica no topo do painel do app) → Adicionar app.",
      "⚠ NÃO use “Criar um novo ID do app” nem “Solicitar acesso a um ID do app” (Request access to an app ID): o app tem que ser DO portfólio, não emprestado.",
      "Se não funcionar: crie o app de novo (passo 7) escolhendo o portfólio da marca na criação e REFAÇA nele os passos 8, 9 e 10 (desmarque-os aqui). Apague o app antigo: apps arquivados também contam no limite de 15.",
    ],
    confira: "O app aparece em Contas → Apps do portfólio da marca.",
    problemas: [],
    copiar: [{ rotulo: "ID do app", valor: "{appId}" }],
  },
  {
    id: "usuario-do-sistema",
    titulo: "Crie o “usuário do sistema”",
    porque:
      "É um usuário-robô do portfólio: a chave dele não depende da sua senha nem vence.",
    minutos: 3,
    pule: "o portfólio já tem um usuário do sistema FUNCIONÁRIO criado para o encEditor.",
    links: [
      {
        rotulo: "Usuários do sistema",
        url: "https://business.facebook.com/settings/system-users",
      },
    ],
    fazer: [
      PORTFOLIO_CERTO,
      "Em Configurações do negócio → Usuários → Usuários do sistema (System users) → Adicionar (+ Add).",
      "Nome: encEditor. Função: Funcionário (Employee) — ele só enxerga o que você der no próximo passo (o Administrador enxerga TODAS as contas do portfólio) → Criar.",
      "⚠ Sem análise da Meta, cada portfólio pode ter só 1 usuário do sistema Funcionário + 1 Administrador. Se a vaga de Funcionário já estiver ocupada por outra ferramenta, você pode reaproveitá-lo — mas veja os cuidados no passo 14 e em Segurança. Nunca revogue as chaves do “Conversions API System User” (ele envia as conversões do site).",
    ],
    confira:
      "O usuário encEditor aparece na lista de Usuários do sistema, como Funcionário.",
    copiar: [{ rotulo: "Nome", valor: "encEditor" }],
    problemas: [
      {
        sintoma: "O botão Adicionar não aparece ou está cinza.",
        solucao:
          "Confira o passo 11 (o portfólio precisa ter um app) e se você tem Controle total. Se aparecer limite, reaproveite o usuário do sistema que já existe.",
      },
      {
        sintoma: "“Temporariamente bloqueado”.",
        solucao:
          "Ative a verificação em duas etapas (passo 1) e tente de novo mais tarde.",
      },
    ],
  },
  {
    id: "dar-acesso",
    titulo: "Dê ao usuário do sistema o app e as contas",
    porque:
      "Um usuário Funcionário só enxerga o que recebe aqui (um Administrador já enxerga todas as contas do portfólio).",
    minutos: 5,
    links: [
      {
        rotulo: "Usuários do sistema",
        url: "https://business.facebook.com/settings/system-users",
      },
    ],
    fazer: [
      "Em Usuários do sistema → clique em encEditor → Atribuir ativos (Assign assets; algumas telas dizem Adicionar ativos).",
      "Apps → o seu app → Gerenciar app / Controle total (Manage app / Full control).",
      "Contas de anúncios → a conta da marca → só “Ver desempenho” (View performance). É só leitura: assim a chave não consegue mexer em campanhas.",
      "⚠ Se a única opção for “Gerenciar campanhas” (Manage campaigns), dá para usar, mas então NÃO marque ads_management no passo 14.",
      "Páginas → a Página ligada ao Instagram → Controle total (Full control). A chave não vai ter permissão de publicar, então não consegue postar nada.",
      "Contas do Instagram (se aparecer) → a conta da marca → marque as opções de ver/insights.",
      "Clique em Atribuir ativos (Assign assets) e espere alguns minutos; depois recarregue a página.",
    ],
    confira:
      "Na tela do usuário encEditor aparecem o app (Controle total), a conta de anúncios (Ver desempenho), a Página (e o Instagram).",
    problemas: [],
  },
  {
    id: "gerar-chave",
    titulo: "Gere a chave de acesso",
    porque:
      "É a chave que você cola no encEditor. Ela é como uma senha: guarde bem.",
    minutos: 3,
    links: [
      {
        rotulo: "Usuários do sistema",
        url: "https://business.facebook.com/settings/system-users",
      },
      {
        rotulo: "Depurador de token (conferir)",
        url: "https://developers.facebook.com/tools/debug/accesstoken/",
      },
    ],
    copiar: [
      "ads_read",
      "business_management",
      "pages_show_list",
      "pages_read_engagement",
      "instagram_basic",
      "instagram_manage_insights",
    ].map((p) => ({ rotulo: p, valor: p })),
    fazer: [
      "ℹ A página dos usuários do sistema mostra um aviso dizendo que eles só geram chaves para permissões aprovadas na Análise do App (System Users can only generate access tokens for permissions their app has been granted through App Review). Ele aparece para todo mundo: ignore e NÃO envie o app para análise.",
      "⚠ Use só o botão desta página. Os botões de gerar token do painel do app (Ferramentas / Tools) e o Explorador da API dão chaves PESSOAIS, que vencem.",
      "Em Usuários do sistema → encEditor → Gerar token / Gerar novo token (Generate token).",
      "Escolha o seu app.",
      "Validade (Token expiration): Nunca (Never).",
      "Marque estas 6 permissões: ads_read, business_management, pages_show_list, pages_read_engagement, instagram_basic, instagram_manage_insights.",
      "Gerar token → copie a chave inteira na hora (começa com “EAA” e é bem longa) e cole direto no encEditor (passo 15). Se precisar guardar, use um gerenciador de senhas.",
      "ℹ Se depois o encEditor avisar que a Meta pediu ads_management para ler o Instagram: gere a chave de novo incluindo também ads_management — MAS só se o usuário do sistema for Funcionário e a conta de anúncios estiver só com “Ver desempenho”. Com Administrador ou “Gerenciar campanhas”, essa permissão deixaria a chave mexer em campanhas.",
    ],
    confira:
      "Aparece uma sequência longa começando com EAA. (Se quiser conferir: cole no Depurador de token da Meta e veja “Expira: Nunca” e as permissões.)",
    problemas: [
      {
        sintoma: "Alguma permissão não aparece na lista.",
        solucao:
          "Falta o produto que libera: API de Marketing (passo 8) ou Instagram, com “Adicionar todas as permissões necessárias” (passo 9). Adicione e gere de novo.",
      },
      {
        sintoma: "O app não aparece na lista.",
        solucao:
          "O usuário do sistema não recebeu o app com Gerenciar app (passo 13), ou o app não tem a API de Marketing (passo 8). Corrija, espere uns minutos e recarregue.",
      },
      {
        sintoma: "Não existe a opção “Nunca”.",
        solucao:
          "O portfólio exige chaves com validade: escolha 60 dias e marque na agenda para gerar outra (e colar no encEditor) antes de vencer.",
      },
      {
        sintoma: "Perdi a chave.",
        solucao:
          "Gere outra do mesmo jeito. Gerar uma nova NÃO desliga a antiga: se a perdida pode estar salva em algum lugar (print, conversa, bloco de notas), revogue as chaves (veja Segurança) e gere de novo.",
      },
    ],
  },
  {
    id: "colar",
    titulo: "Cole a chave no encEditor",
    porque:
      "O encEditor confere a chave, mostra o que encontrou e guarda criptografada.",
    minutos: 1,
    links: [],
    fazer: [
      "Cole a chave abaixo e clique em Conectar.",
      "Só se o app exige a chave secreta (passo 10): marque a opção e cole também a chave secreta do app.",
    ],
    confira:
      "O encEditor mostra “Meta conectada como encEditor” (o nome que você deu ao usuário do sistema no passo 12), a conta de anúncios e o @ do Instagram. Se aparecer o SEU nome, a chave é pessoal e vai vencer: gere outra pelo passo 14.",
    problemas: [],
    formulario: true,
  },
  {
    id: "ligar-versoes",
    titulo: "Ligue cada vídeo ao post e aos anúncios dele",
    porque:
      "Assim o encEditor sabe de qual post e de quais anúncios buscar os números de cada versão.",
    minutos: 1,
    links: [{ rotulo: "Aba Resultados", url: "/resultados" }],
    fazer: [
      "Na aba Resultados, em cada versão exportada, clique em “ligar ao post/anúncio”.",
      "Escolha o post do Instagram em que o vídeo foi publicado e os anúncios que usam esse vídeo (o encEditor já marca os anúncios que usam o post escolhido).",
      "Salvar: os números entram na hora e depois se atualizam sozinhos (a cada 6 horas com o encEditor ligado, ou pelo botão Atualizar números).",
    ],
    confira:
      "Os blocos Pago e Orgânico · Instagram da versão aparecem preenchidos, com a hora da leitura. Em reels, “Seguidores” fica vazio: a Meta não informa seguidores ganhos por reel (se quiser, preencha à mão).",
    problemas: [
      {
        sintoma: "O Instagram ainda está zerado ou vazio.",
        solucao:
          "A Meta demora até 48 horas para liberar as métricas de um post novo. Post de dentro de carrossel não tem números próprios.",
      },
      {
        sintoma: "Os números do Instagram são menores que no app do Instagram.",
        solucao:
          "O bloco Orgânico mostra só o alcance orgânico. O app do Instagram soma o impulsionamento; o resultado dos anúncios aparece no bloco Pago.",
      },
      {
        sintoma: "Os números não batem com o Gerenciador de Anúncios.",
        solucao:
          "Compare com o período “Máximo” e com as mesmas colunas (CTR de link, conversas por mensagem iniciadas, compras). Os dados de anúncio ainda mudam por até 28 dias.",
      },
      {
        sintoma: "Vendas ficou vazio.",
        solucao:
          "O anúncio não rastreia compras (comum em anúncios de WhatsApp). O campo fica para você preencher à mão.",
      },
    ],
  },
];

export const PROBLEMAS_COMUNS: { sintoma: string; solucao: string }[] = [
  {
    sintoma: "“Nenhuma conta de anúncios apareceu.”",
    solucao:
      "O usuário do sistema não recebeu a conta de anúncios (passo 13). Atribua com “Ver desempenho”, gere a chave de novo (passo 14) e cole aqui. Conta de anúncios pessoal não aparece (passo 5).",
  },
  {
    sintoma: "“Nenhuma Página do Facebook apareceu.”",
    solucao:
      "Dê ao usuário do sistema a Página com Controle total (passo 13) e gere a chave de novo.",
  },
  {
    sintoma: "“A Página não tem Instagram profissional ligado a ela.”",
    solucao:
      "Ligue o Instagram pela Página ou pelo Editar perfil do Instagram (passo 3) — pela Central de Contas não vale. A conta precisa ser profissional (passo 2).",
  },
  {
    sintoma: "“A Meta não aceitou essa chave.”",
    solucao:
      "Copie a chave inteira de novo (ela é longa e começa com EAA). Tem que ser a chave do usuário do sistema (passo 14), não a do Explorador da API nem a das Ferramentas do app.",
  },
  {
    sintoma: "“Falta permissão…”",
    solucao:
      "Gere a chave de novo marcando as 6 permissões (passo 14). Se alguma não aparece, falta o produto no app (passos 8 e 9).",
  },
  {
    sintoma: "A Meta pediu ads_management para ler o Instagram.",
    solucao:
      "Gere a chave de novo incluindo ads_management — só se o usuário do sistema for Funcionário e a conta de anúncios estiver só com “Ver desempenho” (passo 14).",
  },
  {
    sintoma: "“O app exige a chave secreta.”",
    solucao:
      "No passo 15, marque “O meu app exige a chave secreta” e cole a chave secreta (App Secret) do app (passo 10). Confira se é a do app certo.",
  },
  {
    sintoma: "O Instagram ficou cinza ao criar o app.",
    solucao:
      "Crie o app pelo caminho “Outro” → “Empresa” (passo 7): nesse tipo de app a API de Marketing e o Instagram entram juntos, por “Adicionar produto”. Se a sua conta não mostrar “Outro”, tente um segundo app no mesmo portfólio com a API de Marketing e o Instagram (login do Facebook), dê os dois apps ao mesmo usuário do sistema, gere uma chave para cada e, aqui, marque “Usei dois apps” e cole as duas (e a chave secreta de cada app, se exigirem). Se o segundo app não aparecer na hora de gerar a chave, a Meta não deixou: os anúncios funcionam e o Instagram fica manual por enquanto.",
  },
  {
    sintoma: "“A Meta pediu uma pausa.”",
    solucao:
      "É normal: o app próprio tem limite de leituras. O encEditor tenta de novo sozinho depois da hora indicada.",
  },
  {
    sintoma: "“A chave de acesso não vale mais.”",
    solucao:
      "A chave foi revogada, o usuário do sistema perdeu as contas ou o app ficou inativo (90 dias sem uso). Se o painel do app disser “inativo”, restaure-o. Depois gere uma chave nova (passo 14) e cole aqui.",
  },
];

export const SEGURANCA: string[] = [
  "A chave fica guardada CRIPTOGRAFADA no encEditor e nunca aparece inteira na tela — só o começo e o fim.",
  "A chave foi montada para LER: não publica na Página nem no Instagram e, com o usuário do sistema Funcionário e a conta de anúncios só em “Ver desempenho”, não altera campanhas. Ela não vence: trate como a senha do Gerenciador de Anúncios.",
  "Para cortar o acesso na Meta: Configurações do negócio → Usuários do sistema → o usuário que você usou → Revogar tokens (Revoke tokens) — só se ele for exclusivo do encEditor. Se você reaproveitou o de outra ferramenta, NÃO revogue: em Ativos atribuídos, tire o SEU app desse usuário e gere outra chave.",
  "“Desconectar” aqui só apaga a cópia do encEditor; na Meta a chave continua valendo até ser revogada.",
  "Não mande a chave por WhatsApp, e-mail ou print — nem em conversa individual. Quem tiver a chave lê os números das suas contas (e, se ela tiver ads_management com mais acesso, pode mexer em campanhas).",
];
