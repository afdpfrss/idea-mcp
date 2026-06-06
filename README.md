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
