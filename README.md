# idea-mcp

プロダクトアイデアをチームで管理する MCP サーバー。

Claude から自然言語でアイデアを登録・更新・評価でき、
全員が同じ Cloudflare D1 データベースにリアルタイムでアクセスできます。

## Architecture

Claude (any client)
    │  MCP / Streamable HTTP
    ▼
Cloudflare Workers  ←── MCP server (TypeScript)
    │  D1 binding
    ▼
Cloudflare D1       ←── SQLite-compatible shared DB

## Features

- アイデアの CRUD（作成・一覧・取得・更新・削除）
- ステータス管理： seed → validating → building → released / archived
- ICE スコアリング（Impact × Confidence ÷ Effort）でアイデアをランキング
- Cloudflare Workers にデプロイ → チーム全員が同じ URL で接続

## MCP Tools

| Tool | Description |
|---|---|
| `create_idea` | アイデアを登録 |
| `list_ideas` | 一覧・ステータス/カテゴリでフィルタ |
| `get_idea` | 単体取得 |
| `update_idea` | 部分更新 |
| `delete_idea` | 削除 |
| `advance_status` | ステータスを次のフェーズへ遷移 |
| `rank_by_ice` | ICE スコア順でランキング表示 |

## ステータス遷移ルール

サーバー側で強制されます（違反は `advance_status` がエラーを返す）。

```
seed       → validating, archived
validating → building,    archived
building   → released,    archived
released   → （遷移なし）
archived   → （遷移なし）
```

## ICE スコア

`ice_score = (impact * confidence) / effort`（小数点 1 桁に丸め）。
DB カラムではなくアプリ側で計算して付与します。

## Setup & Deploy

```bash
npm install

# D1 を作成し、払い出された database_id を wrangler.toml に記入
wrangler d1 create idea-mcp-db

# スキーマ適用（ローカル確認用）
wrangler d1 execute idea-mcp-db --local --file=schema.sql

# ローカル動作確認（http://localhost:8787/mcp）
wrangler dev

# 本番スキーマ適用 → デプロイ
wrangler d1 execute idea-mcp-db --file=schema.sql
wrangler deploy
# → https://idea-mcp.<subdomain>.workers.dev/mcp
```

## Claude 接続設定

`~/.claude/mcp.json`（Claude Code）/
`~/Library/Application Support/Claude/claude_desktop_config.json`（Claude Desktop）:

```json
{
  "mcpServers": {
    "idea-mcp": {
      "type": "http",
      "url": "https://idea-mcp.<subdomain>.workers.dev/mcp"
    }
  }
}
```
