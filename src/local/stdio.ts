import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { registerIdeaTools } from "../tools/ideas.js";
import { SqliteD1 } from "./sqlite-adapter.js";

/**
 * ローカル(stdio)版エントリポイント。
 *
 * Claude Desktop / Claude Code が起動時にこのプロセスを spawn し、終了時に
 * 終了させる。標準入出力で JSON-RPC をやり取りするため、HTTP サーバーや
 * wrangler、ネットワークは不要。DB はローカルの SQLite ファイル。
 *
 * DB ファイルの場所は環境変数 IDEA_MCP_DB_PATH で上書き可能
 * (既定: ~/.idea-mcp/ideas.db)。本番 / wrangler ローカル D1 とは別物。
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS ideas (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'seed',
  impact      INTEGER NOT NULL DEFAULT 3,
  confidence  INTEGER NOT NULL DEFAULT 3,
  effort      INTEGER NOT NULL DEFAULT 3,
  category    TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ideas_status   ON ideas(status);
CREATE INDEX IF NOT EXISTS idx_ideas_category ON ideas(category);
`;

const dbPath =
  process.env.IDEA_MCP_DB_PATH ?? join(homedir(), ".idea-mcp", "ideas.db");
mkdirSync(dirname(dbPath), { recursive: true });

const db = new SqliteD1(dbPath);
db.exec(SCHEMA);

const server = new McpServer({ name: "idea-mcp", version: "0.1.0" });
registerIdeaTools(server, db as unknown as D1Database);

const transport = new StdioServerTransport();
await server.connect(transport);
