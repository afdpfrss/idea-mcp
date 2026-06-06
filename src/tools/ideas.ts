import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { VALID_TRANSITIONS } from "../constants.js";
import {
  deleteIdeaById,
  insertIdea,
  selectIdeaById,
  selectIdeas,
  updateIdeaFields,
  updateIdeaStatus,
} from "../db.js";
import {
  advanceStatusSchema,
  computeIceScore,
  createIdeaSchema,
  deleteIdeaSchema,
  getIdeaSchema,
  listIdeasSchema,
  rankByIceSchema,
  toIdea,
  updateIdeaSchema,
  type IceRanking,
  type Status,
} from "./types.js";

/** 任意の JSON 値をテキストコンテンツとして返す。 */
function ok(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

/** エラーメッセージを isError 付きで返す。 */
function fail(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

/**
 * 7 本の MCP ツールを server に登録する。
 */
export function registerIdeaTools(server: McpServer, db: D1Database): void {
  // 1. create_idea
  server.tool(
    "create_idea",
    "プロダクトアイデアを新規登録する。ice_score 付きの Idea を返す。",
    createIdeaSchema,
    async (args) => {
      const row = await insertIdea(db, {
        id: crypto.randomUUID(),
        title: args.title,
        description: args.description,
        status: args.status,
        impact: args.impact,
        confidence: args.confidence,
        effort: args.effort,
        category: args.category ?? null,
      });
      return ok(toIdea(row));
    }
  );

  // 2. list_ideas
  server.tool(
    "list_ideas",
    "アイデアを一覧する。status / category でフィルタ可能。ソートなし。",
    listIdeasSchema,
    async (args) => {
      const rows = await selectIdeas(db, {
        status: args.status,
        category: args.category,
        limit: args.limit,
        offset: args.offset,
      });
      return ok(rows.map(toIdea));
    }
  );

  // 3. get_idea
  server.tool(
    "get_idea",
    "id でアイデアを 1 件取得する。",
    getIdeaSchema,
    async (args) => {
      const row = await selectIdeaById(db, args.id);
      if (!row) return fail(`Idea not found: ${args.id}`);
      return ok(toIdea(row));
    }
  );

  // 4. update_idea
  server.tool(
    "update_idea",
    "渡されたフィールドのみ部分更新する。updated_at は自動更新。",
    updateIdeaSchema,
    async (args) => {
      const { id, ...fields } = args;
      const row = await updateIdeaFields(db, id, fields);
      if (!row) return fail(`Idea not found: ${id}`);
      return ok(toIdea(row));
    }
  );

  // 5. delete_idea
  server.tool(
    "delete_idea",
    "アイデアを物理削除する。",
    deleteIdeaSchema,
    async (args) => {
      const deleted = await deleteIdeaById(db, args.id);
      if (!deleted) return fail(`Idea not found: ${args.id}`);
      return ok({ success: true });
    }
  );

  // 6. advance_status
  server.tool(
    "advance_status",
    "ステータスを次のフェーズへ遷移する。遷移ルール違反はエラー。",
    advanceStatusSchema,
    async (args) => {
      const row = await selectIdeaById(db, args.id);
      if (!row) return fail(`Idea not found: ${args.id}`);

      const from = row.status as Status;
      const allowed = VALID_TRANSITIONS[from] ?? [];
      if (!allowed.includes(args.to_status)) {
        const allowedText = allowed.length ? allowed.join(", ") : "(none)";
        return fail(
          `Invalid status transition: ${from} → ${args.to_status}. Allowed from ${from}: ${allowedText}`
        );
      }

      const updated = await updateIdeaStatus(db, args.id, args.to_status);
      if (!updated) return fail(`Idea not found: ${args.id}`);
      return ok(toIdea(updated));
    }
  );

  // 7. rank_by_ice
  server.tool(
    "rank_by_ice",
    "フィルタ後に ICE スコア順でランキングを返す。",
    rankByIceSchema,
    async (args) => {
      const rows = await selectIdeas(db, {
        status: args.status,
        category: args.category,
        limit: Number.MAX_SAFE_INTEGER,
        offset: 0,
      });

      const ranking: IceRanking[] = rows
        .map((row) => ({
          id: row.id,
          title: row.title,
          status: row.status,
          impact: row.impact,
          confidence: row.confidence,
          effort: row.effort,
          ice_score: computeIceScore(row.impact, row.confidence, row.effort),
          category: row.category,
        }))
        .sort((a, b) => b.ice_score - a.ice_score)
        .slice(0, args.top_n);

      return ok(ranking);
    }
  );
}
