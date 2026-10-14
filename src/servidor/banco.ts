import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// Banco de dados do ENCeditor: um arquivo SQLite (padrão dados/encditor.db),
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
const global = globalThis as unknown as { bancoEncditor?: DatabaseSync };

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
  if (global.bancoEncditor) return global.bancoEncditor;
  mkdirSync(path.dirname(ARQUIVO), { recursive: true });
  const db = new DatabaseSync(ARQUIVO);
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
  `);
  migrar(db);
  global.bancoEncditor = db;
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

const arquivosExportados = (onde: string, valor: string) =>
  (
    banco()
      .prepare(`SELECT arquivo FROM exportacoes WHERE ${onde} = ?`)
      .all(valor) as { arquivo: string }[]
  ).map((l) => l.arquivo);

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
    const arquivos = arquivosExportados("projeto_id", id);
    banco().prepare("DELETE FROM exportacoes WHERE projeto_id = ?").run(id);
    banco().prepare("DELETE FROM projetos WHERE id = ?").run(id);
    return arquivos;
  });

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
    const arquivos = [
      ...new Set([...arquivosExportados("cliente_id", id), ...daMidia]),
    ];
    const apagarAnalise = db.prepare("DELETE FROM analises WHERE arquivo = ?");
    const apagarProxy = db.prepare(
      "DELETE FROM proxies WHERE original = ? OR proxy = ?",
    );
    for (const nome of daMidia) {
      apagarAnalise.run(nome);
      apagarProxy.run(nome, nome);
    }
    db.prepare("DELETE FROM exportacoes WHERE cliente_id = ?").run(id);
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
        `SELECT id, projeto_id, cliente_id, nome, arquivo, duracao, criado_em, resultado
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
      `SELECT id, projeto_id, cliente_id, nome, arquivo, duracao, criado_em, resultado
       FROM exportacoes WHERE id = ?`,
    )
    .get(id) as LinhaExportacao | undefined;
  return l ? paraExportacao(l) : null;
};

export const atualizarExportacao = (
  id: string,
  mudancas: { nome?: string; resultado?: unknown },
) => {
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
