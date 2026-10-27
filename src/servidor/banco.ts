import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Elemento } from "@/plano/elementos";

// Banco de dados do encEditor: um arquivo SQLite (padrão dados/encditor.db),
// usando o SQLite que já vem no Node — sem serviço externo nem custo.
//
// Organização: CLIENTES (pastas) → PROJETOS (vídeos) + BANCO DE MÍDIA do
// cliente (arquivos compartilhados por todos os projetos dele). Também
// guarda as análises de IA de cada arquivo, os arquivos com efeitos e os
// proxies (cópias leves para o preview).

const ARQUIVO = path.resolve(process.env.BANCO_ARQUIVO ?? "dados/encditor.db");

export const CLIENTE_PADRAO = "geral";

// Em desenvolvimento o Next recarrega módulos; guardar a conexão no
// globalThis evita abrir o mesmo arquivo várias vezes.
const global = globalThis as unknown as {
  bancoEncditor?: DatabaseSync;
  esquemaEncditor?: number;
};

// Suba este número ao criar tabelas/colunas: a conexão guardada (em
// desenvolvimento) reaplica o esquema sem precisar reiniciar o servidor.
const VERSAO_ESQUEMA = 8;

const colunas = (db: DatabaseSync, tabela: string) =>
  (db.prepare(`PRAGMA table_info(${tabela})`).all() as { name: string }[]).map(
    (c) => c.name,
  );

// Ajustes de estrutura feitos uma vez, ao abrir o banco.
const migrar = (db: DatabaseSync) => {
  const existentes = colunas(db, "projetos");
  for (const [coluna, tipo] of [
    ["cliente_id", "TEXT"],
    ["nome", "TEXT"],
    ["criado_em", "INTEGER"],
    ["resultado", "TEXT"],
  ]) {
    if (!existentes.includes(coluna)) {
      db.exec(`ALTER TABLE projetos ADD COLUMN ${coluna} ${tipo}`);
    }
  }

  // Versão exportada ligada ao post/anúncio dela (métricas automáticas).
  const deExportacoes = colunas(db, "exportacoes");
  for (const coluna of ["vinculos", "metricas"]) {
    if (!deExportacoes.includes(coluna)) {
      db.exec(`ALTER TABLE exportacoes ADD COLUMN ${coluna} TEXT`);
    }
  }

  db.prepare(
    `INSERT OR IGNORE INTO clientes (id, nome, criado_em) VALUES (?, ?, ?)`,
  ).run(CLIENTE_PADRAO, "Meus projetos", Date.now());

  // Projetos antigos (sem cliente) vão para "Meus projetos".
  const orfaos = db
    .prepare(
      "SELECT id, dados, atualizado_em FROM projetos WHERE cliente_id IS NULL",
    )
    .all() as { id: string; dados: string; atualizado_em: number }[];
  for (const p of orfaos) {
    db.prepare(
      `UPDATE projetos SET cliente_id = ?, nome = COALESCE(nome, ?), criado_em = COALESCE(criado_em, ?) WHERE id = ?`,
    ).run(
      CLIENTE_PADRAO,
      p.id === "principal" ? "Projeto principal" : p.id,
      p.atualizado_em,
      p.id,
    );
  }

  // Bibliotecas que ficavam dentro do projeto passam para o banco do cliente.
  const comBiblioteca = db
    .prepare("SELECT id, cliente_id, dados FROM projetos")
    .all() as { id: string; cliente_id: string; dados: string }[];
  for (const p of comBiblioteca) {
    const dados = JSON.parse(p.dados) as { biblioteca?: { id: string }[] };
    for (const midia of dados.biblioteca ?? []) {
      db.prepare(
        `INSERT OR IGNORE INTO midias_cliente (id, cliente_id, dados, atualizado_em) VALUES (?, ?, ?, ?)`,
      ).run(midia.id, p.cliente_id, JSON.stringify(midia), Date.now());
    }
  }
};

const banco = () => {
  const aberto = global.bancoEncditor;
  if (aberto && global.esquemaEncditor === VERSAO_ESQUEMA) return aberto;
  if (!aberto) mkdirSync(path.dirname(ARQUIVO), { recursive: true });
  const db = aberto ?? new DatabaseSync(ARQUIVO);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS clientes (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      criado_em INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projetos (
      id TEXT PRIMARY KEY,
      dados TEXT NOT NULL,
      atualizado_em INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS midias_cliente (
      id TEXT PRIMARY KEY,
      cliente_id TEXT NOT NULL,
      dados TEXT NOT NULL,
      atualizado_em INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_midias_cliente ON midias_cliente (cliente_id);
    CREATE TABLE IF NOT EXISTS exportacoes (
      id TEXT PRIMARY KEY,
      projeto_id TEXT NOT NULL,
      cliente_id TEXT NOT NULL,
      nome TEXT NOT NULL,
      arquivo TEXT NOT NULL,
      duracao REAL NOT NULL,
      edicao TEXT NOT NULL,
      criado_em INTEGER NOT NULL,
      resultado TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_exportacoes_projeto ON exportacoes (projeto_id);
    CREATE TABLE IF NOT EXISTS efeitos (
      chave TEXT PRIMARY KEY,
      arquivo TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS proxies (
      original TEXT PRIMARY KEY,
      proxy TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS analises (
      arquivo TEXT PRIMARY KEY,
      dados TEXT NOT NULL,
      atualizado_em INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS planos (
      projeto_id TEXT PRIMARY KEY,
      dados TEXT NOT NULL,
      atualizado_em INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS elementos (
      id TEXT PRIMARY KEY,
      cliente_id TEXT NOT NULL,
      nome TEXT NOT NULL,
      descricao TEXT NOT NULL,
      imagem TEXT,
      criado_em INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_elementos_cliente ON elementos (cliente_id);
    CREATE TABLE IF NOT EXISTS aprendizados (
      cliente_id TEXT PRIMARY KEY,
      fonte TEXT NOT NULL,
      dados TEXT NOT NULL,
      atualizado_em INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS direcoes (
      cliente_id TEXT PRIMARY KEY,
      dados TEXT NOT NULL,
      atualizado_em INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS geracoes (
      id TEXT PRIMARY KEY,
      projeto_id TEXT NOT NULL,
      cliente_id TEXT,
      chave TEXT NOT NULL,
      estado TEXT NOT NULL,
      dados TEXT NOT NULL,
      criado_em INTEGER NOT NULL,
      atualizado_em INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_geracoes_projeto ON geracoes (projeto_id);
    CREATE TABLE IF NOT EXISTS cotacoes (
      dia TEXT PRIMARY KEY,
      dolar REAL NOT NULL,
      fonte TEXT NOT NULL,
      buscado_em INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS custos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quando INTEGER NOT NULL,
      projeto_id TEXT,
      cliente_id TEXT,
      pedido TEXT,
      tipo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      modelo TEXT NOT NULL,
      entrada INTEGER NOT NULL,
      cache INTEGER NOT NULL,
      saida INTEGER NOT NULL,
      segundos REAL,
      valor REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_custos_cliente ON custos (cliente_id);
    CREATE INDEX IF NOT EXISTS idx_custos_projeto ON custos (projeto_id);
    CREATE TABLE IF NOT EXISTS padroes (
      nome TEXT NOT NULL,
      cliente_id TEXT NOT NULL,
      dados TEXT NOT NULL,
      atualizado_em INTEGER NOT NULL,
      PRIMARY KEY (cliente_id, nome)
    );
    CREATE TABLE IF NOT EXISTS conexoes (
      cliente_id TEXT NOT NULL,
      plataforma TEXT NOT NULL,
      segredo TEXT NOT NULL,
      info TEXT NOT NULL,
      criado_em INTEGER NOT NULL,
      atualizado_em INTEGER NOT NULL,
      PRIMARY KEY (cliente_id, plataforma)
    );
  `);
  migrar(db);
  global.bancoEncditor = db;
  global.esquemaEncditor = VERSAO_ESQUEMA;
  return db;
};

// Id legível e único: "linda-cosmeticos-3f9a".
const novoId = (nome: string) => {
  const base = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  return `${base || "item"}-${randomUUID().slice(0, 4)}`;
};

// ---------- Clientes ----------

export type ResumoCliente = {
  id: string;
  nome: string;
  criadoEm: number;
  projetos: number;
  midias: number;
};

export const listarClientes = (): ResumoCliente[] =>
  (
    banco()
      .prepare(
        `SELECT c.id, c.nome, c.criado_em,
          (SELECT COUNT(*) FROM projetos p WHERE p.cliente_id = c.id) AS projetos,
          (SELECT COUNT(*) FROM midias_cliente m WHERE m.cliente_id = c.id) AS midias
         FROM clientes c ORDER BY c.criado_em`,
      )
      .all() as {
      id: string;
      nome: string;
      criado_em: number;
      projetos: number;
      midias: number;
    }[]
  ).map((c) => ({
    id: c.id,
    nome: c.nome,
    criadoEm: c.criado_em,
    projetos: c.projetos,
    midias: c.midias,
  }));

export const lerCliente = (id: string) =>
  listarClientes().find((c) => c.id === id) ?? null;

export const criarCliente = (nome: string) => {
  const id = novoId(nome);
  banco()
    .prepare("INSERT INTO clientes (id, nome, criado_em) VALUES (?, ?, ?)")
    .run(id, nome, Date.now());
  return id;
};

export const renomearCliente = (id: string, nome: string) => {
  banco().prepare("UPDATE clientes SET nome = ? WHERE id = ?").run(nome, id);
};

// ---------- Projetos ----------

export type ResumoProjeto = {
  id: string;
  nome: string;
  clienteId: string;
  criadoEm: number;
  atualizadoEm: number;
  resultado: unknown;
  cenas: number;
};

export const listarProjetos = (clienteId: string): ResumoProjeto[] =>
  (
    banco()
      .prepare(
        `SELECT id, nome, cliente_id, criado_em, atualizado_em, resultado, dados
         FROM projetos WHERE cliente_id = ? ORDER BY atualizado_em DESC`,
      )
      .all(clienteId) as {
      id: string;
      nome: string | null;
      cliente_id: string;
      criado_em: number | null;
      atualizado_em: number;
      resultado: string | null;
      dados: string;
    }[]
  ).map((p) => ({
    id: p.id,
    nome: p.nome ?? p.id,
    clienteId: p.cliente_id,
    criadoEm: p.criado_em ?? p.atualizado_em,
    atualizadoEm: p.atualizado_em,
    resultado: p.resultado ? JSON.parse(p.resultado) : null,
    cenas:
      (JSON.parse(p.dados) as { timeline?: { clipes?: unknown[] } }).timeline
        ?.clipes?.length ?? 0,
  }));

export const criarProjeto = (
  clienteId: string,
  nome: string,
  dados: unknown,
) => {
  const id = novoId(nome);
  const agora = Date.now();
  banco()
    .prepare(
      `INSERT INTO projetos (id, cliente_id, nome, dados, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, clienteId, nome, JSON.stringify(dados), agora, agora);
  return id;
};

export const lerProjeto = (id: string) => {
  const linha = banco()
    .prepare(
      `SELECT p.dados, p.atualizado_em, p.nome, p.cliente_id, p.resultado, c.nome AS cliente_nome
       FROM projetos p LEFT JOIN clientes c ON c.id = p.cliente_id WHERE p.id = ?`,
    )
    .get(id) as
    | {
        dados: string;
        atualizado_em: number;
        nome: string | null;
        cliente_id: string | null;
        resultado: string | null;
        cliente_nome: string | null;
      }
    | undefined;
  if (!linha) return null;
  return {
    projeto: JSON.parse(linha.dados) as unknown,
    atualizadoEm: linha.atualizado_em,
    nome: linha.nome ?? id,
    cliente: {
      id: linha.cliente_id ?? CLIENTE_PADRAO,
      nome: linha.cliente_nome ?? "Meus projetos",
    },
    resultado: linha.resultado
      ? (JSON.parse(linha.resultado) as unknown)
      : null,
  };
};

// Salva a timeline e a conversa. Projeto novo sem cliente entra em
// "Meus projetos".
export const salvarProjeto = (id: string, projeto: unknown) => {
  const agora = Date.now();
  banco()
    .prepare(
      `INSERT INTO projetos (id, dados, atualizado_em, cliente_id, nome, criado_em)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET dados = excluded.dados, atualizado_em = excluded.atualizado_em`,
    )
    .run(id, JSON.stringify(projeto), agora, CLIENTE_PADRAO, id, agora);
  return agora;
};

export const renomearProjeto = (id: string, nome: string) => {
  banco().prepare("UPDATE projetos SET nome = ? WHERE id = ?").run(nome, id);
};

// ---------- Banco de mídia do cliente ----------

export const lerMidiasDoCliente = (clienteId: string): unknown[] =>
  (
    banco()
      .prepare(
        "SELECT dados FROM midias_cliente WHERE cliente_id = ? ORDER BY rowid",
      )
      .all(clienteId) as { dados: string }[]
  ).map((m) => JSON.parse(m.dados));

// Grava (ou atualiza) as mídias recebidas. Não apaga as que não vieram.
export const salvarMidiasDoCliente = (
  clienteId: string,
  midias: { id: string }[],
) => {
  const db = banco();
  const gravar = db.prepare(
    `INSERT INTO midias_cliente (id, cliente_id, dados, atualizado_em) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET dados = excluded.dados, atualizado_em = excluded.atualizado_em`,
  );
  db.exec("BEGIN");
  try {
    for (const m of midias) {
      gravar.run(m.id, clienteId, JSON.stringify(m), Date.now());
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
};

// ---------- Análises e efeitos ----------

export const lerAnaliseDoBanco = (arquivo: string): unknown => {
  const linha = banco()
    .prepare("SELECT dados FROM analises WHERE arquivo = ?")
    .get(arquivo) as { dados: string } | undefined;
  return linha ? JSON.parse(linha.dados) : null;
};

export const salvarAnaliseNoBanco = (arquivo: string, analise: unknown) => {
  banco()
    .prepare(
      `INSERT INTO analises (arquivo, dados, atualizado_em) VALUES (?, ?, ?)
       ON CONFLICT(arquivo) DO UPDATE SET dados = excluded.dados, atualizado_em = excluded.atualizado_em`,
    )
    .run(arquivo, JSON.stringify(analise), Date.now());
};

// Arquivo já processado com uma combinação de efeitos (para não refazer).
export const lerEfeitoProcessado = (chave: string) =>
  (
    banco()
      .prepare("SELECT arquivo FROM efeitos WHERE chave = ?")
      .get(chave) as { arquivo: string } | undefined
  )?.arquivo ?? null;

export const salvarEfeitoProcessado = (chave: string, arquivo: string) => {
  banco()
    .prepare(
      `INSERT INTO efeitos (chave, arquivo) VALUES (?, ?)
       ON CONFLICT(chave) DO UPDATE SET arquivo = excluded.arquivo`,
    )
    .run(chave, arquivo);
};

// Cópia leve (proxy) de um vídeo, usada só no preview.
export const lerProxy = (original: string) =>
  (
    banco()
      .prepare("SELECT proxy FROM proxies WHERE original = ?")
      .get(original) as { proxy: string } | undefined
  )?.proxy ?? null;

export const salvarProxy = (original: string, proxy: string) => {
  banco()
    .prepare(
      `INSERT INTO proxies (original, proxy) VALUES (?, ?)
       ON CONFLICT(original) DO UPDATE SET proxy = excluded.proxy`,
    )
    .run(original, proxy);
};

// ---------- Apagar ----------
// Cada função apaga as linhas do banco e devolve os nomes dos arquivos em
// disco que ficaram sem uso (quem chama remove-os do armazenamento).

// O MP4 de cada versão e as miniaturas guardadas ao ligá-la ao post/anúncio.
const arquivosExportados = (onde: string, valor: string) =>
  (
    banco()
      .prepare(`SELECT arquivo, vinculos FROM exportacoes WHERE ${onde} = ?`)
      .all(valor) as { arquivo: string; vinculos: string | null }[]
  ).flatMap((l) => {
    const v = l.vinculos
      ? (JSON.parse(l.vinculos) as {
          instagram?: { miniatura?: string | null } | null;
          anuncios?: { miniatura?: string | null }[];
        })
      : null;
    const miniaturas = [
      v?.instagram?.miniatura,
      ...(v?.anuncios ?? []).map((a) => a.miniatura),
    ]
      .filter((u): u is string => !!u?.startsWith("/api/midia/"))
      .map((u) => u.split("?")[0].split("/").pop() ?? "")
      .filter(Boolean);
    return [l.arquivo, ...miniaturas];
  });

const emTransacao = <T>(fazer: () => T): T => {
  const db = banco();
  db.exec("BEGIN");
  try {
    const r = fazer();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
};

export const apagarExportacao = (id: string) =>
  emTransacao(() => {
    const arquivos = arquivosExportados("id", id);
    banco().prepare("DELETE FROM exportacoes WHERE id = ?").run(id);
    return arquivos;
  });

// Projeto + os vídeos exportados dele. O banco de mídia é do cliente e fica.
export const apagarProjeto = (id: string) =>
  emTransacao(() => {
    const arquivos = [
      ...arquivosExportados("projeto_id", id),
      ...arquivosDoPlano(id),
    ];
    banco().prepare("DELETE FROM exportacoes WHERE projeto_id = ?").run(id);
    banco().prepare("DELETE FROM custos WHERE projeto_id = ?").run(id);
    banco().prepare("DELETE FROM geracoes WHERE projeto_id = ?").run(id);
    banco().prepare("DELETE FROM planos WHERE projeto_id = ?").run(id);
    banco().prepare("DELETE FROM projetos WHERE id = ?").run(id);
    return arquivos;
  });

// Arquivos de referência do plano (exemplos enviados para a IA).
const arquivosDoPlano = (projetoId: string) => {
  const plano = lerPlano(projetoId) as {
    briefing?: { exemplos?: { url?: string }[] };
    vozTeste?: { arquivo?: string; trechos?: { arquivo?: string }[] } | null;
  } | null;
  return [
    ...(plano?.briefing?.exemplos ?? []).map(
      (e) => e.url?.split("/").pop() ?? "",
    ),
    // Narração de exemplo (voz sintética).
    plano?.vozTeste?.arquivo ?? "",
    ...(plano?.vozTeste?.trechos ?? []).map((t) => t.arquivo ?? ""),
  ].filter(Boolean);
};

// Cliente inteiro: projetos, vídeos exportados e banco de mídia (com as
// análises dos arquivos).
export const apagarCliente = (id: string) =>
  emTransacao(() => {
    const db = banco();
    const midias = lerMidiasDoCliente(id) as {
      url?: string;
      urlOriginal?: string;
      preview?: { url?: string };
    }[];
    // Arquivo enviado, original (antes dos efeitos de áudio) e proxy.
    const daMidia = midias
      .flatMap((m) => [m.url, m.urlOriginal, m.preview?.url])
      .map((u) => u?.split("?")[0].split("/").pop() ?? "")
      .filter(Boolean);
    const projetos = (
      db.prepare("SELECT id FROM projetos WHERE cliente_id = ?").all(id) as {
        id: string;
      }[]
    ).map((p) => p.id);
    const imagensDosElementos = (
      db
        .prepare("SELECT imagem FROM elementos WHERE cliente_id = ?")
        .all(id) as { imagem: string | null }[]
    )
      .map((e) => e.imagem ?? "")
      .filter(Boolean);
    const arquivos = [
      ...new Set([
        ...arquivosExportados("cliente_id", id),
        ...daMidia,
        ...projetos.flatMap(arquivosDoPlano),
        ...imagensDosElementos,
      ]),
    ];
    const apagarPlano = db.prepare("DELETE FROM planos WHERE projeto_id = ?");
    for (const p of projetos) apagarPlano.run(p);
    db.prepare("DELETE FROM elementos WHERE cliente_id = ?").run(id);
    db.prepare("DELETE FROM aprendizados WHERE cliente_id = ?").run(id);
    db.prepare("DELETE FROM conexoes WHERE cliente_id = ?").run(id);
    const apagarAnalise = db.prepare("DELETE FROM analises WHERE arquivo = ?");
    const apagarProxy = db.prepare(
      "DELETE FROM proxies WHERE original = ? OR proxy = ?",
    );
    for (const nome of daMidia) {
      apagarAnalise.run(nome);
      apagarProxy.run(nome, nome);
    }
    db.prepare("DELETE FROM exportacoes WHERE cliente_id = ?").run(id);
    db.prepare("DELETE FROM custos WHERE cliente_id = ?").run(id);
    db.prepare("DELETE FROM geracoes WHERE cliente_id = ?").run(id);
    db.prepare("DELETE FROM projetos WHERE cliente_id = ?").run(id);
    db.prepare("DELETE FROM midias_cliente WHERE cliente_id = ?").run(id);
    db.prepare("DELETE FROM clientes WHERE id = ?").run(id);
    return arquivos;
  });

// ---------- Vídeos exportados (versões finais de um projeto) ----------
// Cada exportação guarda o MP4, uma "foto" da edição (timeline + quais
// arquivos foram usados) e o resultado no tráfego — base para a IA
// aprender o que funciona com cada cliente.

export type Exportacao = {
  id: string;
  projetoId: string;
  clienteId: string;
  nome: string;
  arquivo: string;
  duracao: number;
  criadoEm: number;
  resultado: unknown;
  // Post/anúncio em que a versão foi publicada (src/conexoes/vinculos.ts)
  // e a última leitura automática das métricas.
  vinculos: unknown;
  metricas: unknown;
};

type LinhaExportacao = {
  id: string;
  projeto_id: string;
  cliente_id: string;
  nome: string;
  arquivo: string;
  duracao: number;
  criado_em: number;
  resultado: string | null;
  vinculos: string | null;
  metricas: string | null;
};

const paraExportacao = (l: LinhaExportacao): Exportacao => ({
  id: l.id,
  projetoId: l.projeto_id,
  clienteId: l.cliente_id,
  nome: l.nome,
  arquivo: l.arquivo,
  duracao: l.duracao,
  criadoEm: l.criado_em,
  resultado: l.resultado ? JSON.parse(l.resultado) : null,
  vinculos: l.vinculos ? JSON.parse(l.vinculos) : null,
  metricas: l.metricas ? JSON.parse(l.metricas) : null,
});

export const registrarExportacao = (e: {
  projetoId: string;
  clienteId: string;
  nome: string;
  arquivo: string;
  duracao: number;
  edicao: unknown;
}) => {
  const id = randomUUID();
  banco()
    .prepare(
      `INSERT INTO exportacoes (id, projeto_id, cliente_id, nome, arquivo, duracao, edicao, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      e.projetoId,
      e.clienteId,
      e.nome,
      e.arquivo,
      e.duracao,
      JSON.stringify(e.edicao),
      Date.now(),
    );
  return id;
};

export const listarExportacoesDoCliente = (clienteId: string) =>
  (
    banco()
      .prepare(
        `SELECT id, projeto_id, cliente_id, nome, arquivo, duracao, criado_em, resultado, vinculos, metricas
         FROM exportacoes WHERE cliente_id = ? ORDER BY criado_em DESC`,
      )
      .all(clienteId) as LinhaExportacao[]
  ).map(paraExportacao);

export const contarExportacoes = (projetoId: string) =>
  (
    banco()
      .prepare("SELECT COUNT(*) AS n FROM exportacoes WHERE projeto_id = ?")
      .get(projetoId) as { n: number }
  ).n;

export const lerExportacao = (id: string) => {
  const l = banco()
    .prepare(
      `SELECT id, projeto_id, cliente_id, nome, arquivo, duracao, criado_em, resultado, vinculos, metricas
       FROM exportacoes WHERE id = ?`,
    )
    .get(id) as LinhaExportacao | undefined;
  return l ? paraExportacao(l) : null;
};

export const atualizarExportacao = (
  id: string,
  mudancas: {
    nome?: string;
    resultado?: unknown;
    vinculos?: unknown;
    metricas?: unknown;
  },
) => {
  for (const coluna of ["vinculos", "metricas"] as const) {
    const valor = mudancas[coluna];
    if (valor === undefined) continue;
    banco()
      .prepare(`UPDATE exportacoes SET ${coluna} = ? WHERE id = ?`)
      .run(valor === null ? null : JSON.stringify(valor), id);
  }
  if (mudancas.nome !== undefined) {
    banco()
      .prepare("UPDATE exportacoes SET nome = ? WHERE id = ?")
      .run(mudancas.nome, id);
  }
  if (mudancas.resultado !== undefined) {
    banco()
      .prepare("UPDATE exportacoes SET resultado = ? WHERE id = ?")
      .run(
        mudancas.resultado === null ? null : JSON.stringify(mudancas.resultado),
        id,
      );
  }
};

// Edição exportada ("foto": timeline + arquivos usados) de cada versão do
// cliente, para a IA cruzar o que foi feito com o resultado.
export const lerEdicoesDoCliente = (clienteId: string) =>
  new Map(
    (
      banco()
        .prepare("SELECT id, edicao FROM exportacoes WHERE cliente_id = ?")
        .all(clienteId) as { id: string; edicao: string }[]
    ).map((l) => [l.id, JSON.parse(l.edicao) as unknown]),
  );

// ---------- Planejamento (roteiro + takes + edição de um projeto) ----------

export const lerPlano = (projetoId: string): unknown => {
  const l = banco()
    .prepare("SELECT dados FROM planos WHERE projeto_id = ?")
    .get(projetoId) as { dados: string } | undefined;
  return l ? JSON.parse(l.dados) : null;
};

export const salvarPlano = (projetoId: string, plano: unknown) => {
  const agora = Date.now();
  banco()
    .prepare(
      `INSERT INTO planos (projeto_id, dados, atualizado_em) VALUES (?, ?, ?)
       ON CONFLICT(projeto_id) DO UPDATE SET dados = excluded.dados, atualizado_em = excluded.atualizado_em`,
    )
    .run(projetoId, JSON.stringify(plano), agora);
  return agora;
};

// ---------- Elementos do Higgsfield (personagens, produtos, lugares) ----------
// Cada cliente tem os seus, citados nos prompts com @nome (como no
// Higgsfield), com uma imagem de referência e uma descrição.

type LinhaElemento = {
  id: string;
  cliente_id: string;
  nome: string;
  descricao: string;
  imagem: string | null;
  criado_em: number;
};

const paraElemento = (l: LinhaElemento): Elemento => ({
  id: l.id,
  clienteId: l.cliente_id,
  nome: l.nome,
  descricao: l.descricao,
  imagem: l.imagem,
  criadoEm: l.criado_em,
});

export const listarElementos = (clienteId: string) =>
  (
    banco()
      .prepare(
        "SELECT * FROM elementos WHERE cliente_id = ? ORDER BY criado_em",
      )
      .all(clienteId) as LinhaElemento[]
  ).map(paraElemento);

export const lerElemento = (id: string) => {
  const l = banco().prepare("SELECT * FROM elementos WHERE id = ?").get(id) as
    | LinhaElemento
    | undefined;
  return l ? paraElemento(l) : null;
};

export const criarElemento = (e: Omit<Elemento, "id" | "criadoEm">) => {
  const id = randomUUID();
  banco()
    .prepare(
      `INSERT INTO elementos (id, cliente_id, nome, descricao, imagem, criado_em)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, e.clienteId, e.nome, e.descricao, e.imagem, Date.now());
  return id;
};

export const atualizarElemento = (
  id: string,
  m: Partial<Pick<Elemento, "nome" | "descricao" | "imagem">>,
) => {
  const atual = lerElemento(id);
  if (!atual) return;
  const novo = { ...atual, ...m };
  banco()
    .prepare(
      "UPDATE elementos SET nome = ?, descricao = ?, imagem = ? WHERE id = ?",
    )
    .run(novo.nome, novo.descricao, novo.imagem, id);
};

// Devolve a imagem do elemento apagado (para remover do disco).
export const apagarElemento = (id: string) => {
  const atual = lerElemento(id);
  banco().prepare("DELETE FROM elementos WHERE id = ?").run(id);
  return atual?.imagem ? [atual.imagem] : [];
};

// ---------- Aprendizados do cliente ----------
// Resumo (feito pela IA) do que funcionou e do que deu errado nos vídeos
// do cliente. "fonte" = impressão digital dos resultados usados: se nada
// mudou, não precisa resumir de novo.

export const lerAprendizados = (clienteId: string) => {
  const l = banco()
    .prepare(
      "SELECT fonte, dados, atualizado_em FROM aprendizados WHERE cliente_id = ?",
    )
    .get(clienteId) as
    | { fonte: string; dados: string; atualizado_em: number }
    | undefined;
  return l
    ? {
        fonte: l.fonte,
        dados: JSON.parse(l.dados) as unknown,
        atualizadoEm: l.atualizado_em,
      }
    : null;
};

export const salvarAprendizados = (
  clienteId: string,
  fonte: string,
  dados: unknown,
) => {
  banco()
    .prepare(
      `INSERT INTO aprendizados (cliente_id, fonte, dados, atualizado_em) VALUES (?, ?, ?, ?)
       ON CONFLICT(cliente_id) DO UPDATE SET fonte = excluded.fonte, dados = excluded.dados, atualizado_em = excluded.atualizado_em`,
    )
    .run(clienteId, fonte, JSON.stringify(dados), Date.now());
};

// ---------- Direção de arte do cliente ----------
// A última direção de arte usada nos vídeos do cliente (cores, fundo, tom):
// os próximos vídeos mantêm a mesma identidade, salvo pedido diferente.

export const lerDirecaoDoCliente = (clienteId: string): unknown => {
  const l = banco()
    .prepare("SELECT dados FROM direcoes WHERE cliente_id = ?")
    .get(clienteId) as { dados: string } | undefined;
  return l ? JSON.parse(l.dados) : null;
};

export const salvarDirecaoDoCliente = (clienteId: string, dados: unknown) => {
  banco()
    .prepare(
      `INSERT INTO direcoes (cliente_id, dados, atualizado_em) VALUES (?, ?, ?)
       ON CONFLICT(cliente_id) DO UPDATE SET dados = excluded.dados, atualizado_em = excluded.atualizado_em`,
    )
    .run(clienteId, JSON.stringify(dados), Date.now());
};

// ---------- Custos da IA (cada chamada paga, por projeto) ----------
// Gravados por src/servidor/custos.ts. "pedido" junta as chamadas de um
// mesmo pedido (ex.: um pedido ao chat = editor + revisor + visão).

export type LinhaDeCusto = {
  quando: number;
  projetoId: string | null;
  clienteId: string | null;
  pedido: string | null;
  tipo: string;
  descricao: string;
  modelo: string;
  entrada: number;
  cache: number;
  saida: number;
  segundos: number | null;
  valor: number;
};

export const registrarCusto = (c: LinhaDeCusto) => {
  banco()
    .prepare(
      `INSERT INTO custos (quando, projeto_id, cliente_id, pedido, tipo, descricao, modelo, entrada, cache, saida, segundos, valor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      c.quando,
      c.projetoId,
      c.clienteId,
      c.pedido,
      c.tipo,
      c.descricao,
      c.modelo,
      c.entrada,
      c.cache,
      c.saida,
      c.segundos,
      c.valor,
    );
};

// Pedidos (chamadas juntadas) de um cliente, do mais antigo ao mais novo.
export type PedidoComCusto = {
  projetoId: string | null;
  quando: number;
  tipo: string;
  descricao: string;
  valor: number;
  chamadas: number;
};
export const custosDoCliente = (clienteId: string): PedidoComCusto[] =>
  (
    banco()
      .prepare(
        `SELECT projeto_id AS projetoId, MIN(quando) AS quando, MIN(tipo) AS tipo,
                MIN(descricao) AS descricao, SUM(valor) AS valor, COUNT(*) AS chamadas
         FROM custos WHERE cliente_id = ?
         GROUP BY projeto_id, COALESCE(pedido, 'linha-' || id)
         ORDER BY MIN(quando)`,
      )
      .all(clienteId) as PedidoComCusto[]
  );

// Total já gasto num projeto (para a nota do chat).
export const totalDoProjeto = (projetoId: string) =>
  (
    banco()
      .prepare("SELECT COALESCE(SUM(valor), 0) AS total FROM custos WHERE projeto_id = ?")
      .get(projetoId) as { total: number }
  ).total;

// ---------- Gerações no Higgsfield (takes do plano) ----------
// Um registro por pedido de vídeo: o estado (subindo → na fila → gerando
// → pronto/erro), o que foi pedido e, pronto, a mídia criada. Fica no
// banco para continuar acompanhando mesmo se o encEditor reiniciar.

export type LinhaGeracao = {
  id: string;
  projetoId: string;
  clienteId: string | null;
  chave: string;
  estado: string;
  dados: Record<string, unknown>;
  criadoEm: number;
  atualizadoEm: number;
};

const lerLinhaGeracao = (l: {
  id: string;
  projeto_id: string;
  cliente_id: string | null;
  chave: string;
  estado: string;
  dados: string;
  criado_em: number;
  atualizado_em: number;
}): LinhaGeracao => ({
  id: l.id,
  projetoId: l.projeto_id,
  clienteId: l.cliente_id,
  chave: l.chave,
  estado: l.estado,
  dados: JSON.parse(l.dados),
  criadoEm: l.criado_em,
  atualizadoEm: l.atualizado_em,
});

export const salvarGeracao = (g: LinhaGeracao) => {
  banco()
    .prepare(
      `INSERT INTO geracoes (id, projeto_id, cliente_id, chave, estado, dados, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET estado = excluded.estado, dados = excluded.dados, atualizado_em = excluded.atualizado_em`,
    )
    .run(g.id, g.projetoId, g.clienteId, g.chave, g.estado, JSON.stringify(g.dados), g.criadoEm, g.atualizadoEm);
};

export const geracoesDoProjeto = (projetoId: string) =>
  (
    banco()
      .prepare("SELECT * FROM geracoes WHERE projeto_id = ? ORDER BY criado_em")
      .all(projetoId) as Parameters<typeof lerLinhaGeracao>[0][]
  ).map(lerLinhaGeracao);

export const geracoesEmAndamento = () =>
  (
    banco()
      .prepare("SELECT * FROM geracoes WHERE estado IN ('subindo', 'na fila', 'gerando', 'baixando') ORDER BY criado_em")
      .all() as Parameters<typeof lerLinhaGeracao>[0][]
  ).map(lerLinhaGeracao);

export const lerGeracao = (id: string) => {
  const l = banco().prepare("SELECT * FROM geracoes WHERE id = ?").get(id) as
    | Parameters<typeof lerLinhaGeracao>[0]
    | undefined;
  return l ? lerLinhaGeracao(l) : null;
};

// ---------- Cotação do dólar (para mostrar os custos em real) ----------

export type CotacaoSalva = { dia: string; dolar: number; fonte: string; buscadoEm: number };

export const lerUltimaCotacao = (): CotacaoSalva | null =>
  (banco()
    .prepare("SELECT dia, dolar, fonte, buscado_em AS buscadoEm FROM cotacoes ORDER BY buscado_em DESC LIMIT 1")
    .get() as CotacaoSalva | undefined) ?? null;

export const salvarCotacao = (c: CotacaoSalva) => {
  banco()
    .prepare(
      `INSERT INTO cotacoes (dia, dolar, fonte, buscado_em) VALUES (?, ?, ?, ?)
       ON CONFLICT(dia) DO UPDATE SET dolar = excluded.dolar, fonte = excluded.fonte, buscado_em = excluded.buscado_em`,
    )
    .run(c.dia, c.dolar, c.fonte, c.buscadoEm);
};

// ---------- Padrões de animação (motions "desenho" salvos) ----------
// A IA guarda as cenas desenhadas que ficaram boas para reusar: do cliente
// (cliente_id) ou para todos (cliente_id = "*").

export type PadraoSalvo = {
  nome: string;
  descricao: string;
  duracao: number;
  camadas: unknown[];
};

export const lerPadroes = (clienteId: string | null): PadraoSalvo[] =>
  (
    banco()
      .prepare(
        "SELECT dados FROM padroes WHERE cliente_id = ? OR cliente_id = ? ORDER BY atualizado_em",
      )
      .all("*", clienteId ?? "*") as { dados: string }[]
  ).map((l) => JSON.parse(l.dados));

export const salvarPadrao = (clienteId: string | null, padrao: PadraoSalvo) => {
  banco()
    .prepare(
      `INSERT INTO padroes (nome, cliente_id, dados, atualizado_em) VALUES (?, ?, ?, ?)
       ON CONFLICT(cliente_id, nome) DO UPDATE SET dados = excluded.dados, atualizado_em = excluded.atualizado_em`,
    )
    .run(padrao.nome, clienteId ?? "*", JSON.stringify(padrao), Date.now());
};

// ---------- Conexões (contas do cliente para ler métricas) ----------
// O segredo (token) chega aqui JÁ criptografado (src/servidor/segredos.ts);
// "info" é o que pode aparecer na tela (nome, contas achadas, permissões).

export type LinhaConexao = {
  clienteId: string;
  plataforma: string;
  segredo: string;
  info: unknown;
  criadoEm: number;
  atualizadoEm: number;
};

export const lerConexao = (
  clienteId: string,
  plataforma: string,
): LinhaConexao | null => {
  const l = banco()
    .prepare("SELECT * FROM conexoes WHERE cliente_id = ? AND plataforma = ?")
    .get(clienteId, plataforma) as
    | {
        cliente_id: string;
        plataforma: string;
        segredo: string;
        info: string;
        criado_em: number;
        atualizado_em: number;
      }
    | undefined;
  return l
    ? {
        clienteId: l.cliente_id,
        plataforma: l.plataforma,
        segredo: l.segredo,
        info: JSON.parse(l.info),
        criadoEm: l.criado_em,
        atualizadoEm: l.atualizado_em,
      }
    : null;
};

export const salvarConexao = (
  clienteId: string,
  plataforma: string,
  segredo: string,
  info: unknown,
) => {
  const agora = Date.now();
  banco()
    .prepare(
      `INSERT INTO conexoes (cliente_id, plataforma, segredo, info, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(cliente_id, plataforma) DO UPDATE SET
         segredo = excluded.segredo, info = excluded.info, atualizado_em = excluded.atualizado_em`,
    )
    .run(clienteId, plataforma, segredo, JSON.stringify(info), agora, agora);
};

export const atualizarInfoDaConexao = (
  clienteId: string,
  plataforma: string,
  info: unknown,
) => {
  banco()
    .prepare(
      "UPDATE conexoes SET info = ?, atualizado_em = ? WHERE cliente_id = ? AND plataforma = ?",
    )
    .run(JSON.stringify(info), Date.now(), clienteId, plataforma);
};

export const apagarConexao = (clienteId: string, plataforma: string) => {
  banco()
    .prepare("DELETE FROM conexoes WHERE cliente_id = ? AND plataforma = ?")
    .run(clienteId, plataforma);
};

// Todas as conexões de uma plataforma (manutenção em segundo plano).
export const listarConexoes = (plataforma: string) =>
  (
    banco()
      .prepare("SELECT cliente_id, info FROM conexoes WHERE plataforma = ?")
      .all(plataforma) as { cliente_id: string; info: string }[]
  ).map((l) => ({
    clienteId: l.cliente_id,
    info: JSON.parse(l.info) as unknown,
  }));
