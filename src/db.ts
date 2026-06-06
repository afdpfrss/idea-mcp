import type { IdeaRow } from "./tools/types.js";

/**
 * D1 に対するクエリ関数群。SQL の組み立てとパラメータバインドのみを担い、
 * ice_score の計算やビジネスロジックは呼び出し側（tools）に委ねる。
 */

export type CreateIdeaInput = {
  id: string;
  title: string;
  description: string;
  status: string;
  impact: number;
  confidence: number;
  effort: number;
  category: string | null;
};

export async function insertIdea(
  db: D1Database,
  input: CreateIdeaInput
): Promise<IdeaRow> {
  const row = await db
    .prepare(
      `INSERT INTO ideas (id, title, description, status, impact, confidence, effort, category)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .bind(
      input.id,
      input.title,
      input.description,
      input.status,
      input.impact,
      input.confidence,
      input.effort,
      input.category
    )
    .first<IdeaRow>();

  if (!row) throw new Error("Failed to insert idea");
  return row;
}

export type ListIdeasFilter = {
  status?: string;
  category?: string;
  limit: number;
  offset: number;
};

export async function selectIdeas(
  db: D1Database,
  filter: ListIdeasFilter
): Promise<IdeaRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.status !== undefined) {
    where.push("status = ?");
    params.push(filter.status);
  }
  if (filter.category !== undefined) {
    where.push("category = ?");
    params.push(filter.category);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  params.push(filter.limit, filter.offset);

  const { results } = await db
    .prepare(`SELECT * FROM ideas ${whereClause} LIMIT ? OFFSET ?`)
    .bind(...params)
    .all<IdeaRow>();

  return results ?? [];
}

export async function selectIdeaById(
  db: D1Database,
  id: string
): Promise<IdeaRow | null> {
  return db.prepare("SELECT * FROM ideas WHERE id = ?").bind(id).first<IdeaRow>();
}

export type UpdateIdeaFields = {
  title?: string;
  description?: string;
  impact?: number;
  confidence?: number;
  effort?: number;
  category?: string;
};

/**
 * 渡されたフィールドのみ UPDATE する。updated_at は常に更新する。
 * 対象行が存在しなければ null を返す。
 */
export async function updateIdeaFields(
  db: D1Database,
  id: string,
  fields: UpdateIdeaFields
): Promise<IdeaRow | null> {
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const key of [
    "title",
    "description",
    "impact",
    "confidence",
    "effort",
    "category",
  ] as const) {
    const value = fields[key];
    if (value !== undefined) {
      sets.push(`${key} = ?`);
      params.push(value);
    }
  }

  sets.push("updated_at = datetime('now')");
  params.push(id);

  const row = await db
    .prepare(`UPDATE ideas SET ${sets.join(", ")} WHERE id = ? RETURNING *`)
    .bind(...params)
    .first<IdeaRow>();

  return row;
}

export async function updateIdeaStatus(
  db: D1Database,
  id: string,
  status: string
): Promise<IdeaRow | null> {
  return db
    .prepare(
      `UPDATE ideas SET status = ?, updated_at = datetime('now') WHERE id = ? RETURNING *`
    )
    .bind(status, id)
    .first<IdeaRow>();
}

export async function deleteIdeaById(
  db: D1Database,
  id: string
): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM ideas WHERE id = ?")
    .bind(id)
    .run();
  return (result.meta.changes ?? 0) > 0;
}
