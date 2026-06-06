import { z } from "zod";

export const STATUSES = [
  "seed",
  "validating",
  "building",
  "released",
  "archived",
] as const;

export type Status = (typeof STATUSES)[number];

/**
 * アプリケーション層で扱う Idea 型。
 * ice_score は計算値であり DB カラムとしては保持しない。
 */
export type Idea = {
  id: string;
  title: string;
  description: string;
  status: string;
  impact: number;
  confidence: number;
  effort: number;
  ice_score: number; // 計算値、DB には持たない
  category: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * DB の ideas テーブルの 1 行（ice_score を含まない生データ）。
 */
export type IdeaRow = {
  id: string;
  title: string;
  description: string;
  status: string;
  impact: number;
  confidence: number;
  effort: number;
  category: string | null;
  created_at: string;
  updated_at: string;
};

export type IceRanking = {
  id: string;
  title: string;
  status: string;
  impact: number;
  confidence: number;
  effort: number;
  ice_score: number;
  category: string | null;
};

/**
 * ICE スコア = (impact * confidence) / effort
 * 小数点 1 桁に丸める。effort が 0 の場合は 0 を返す（防御的）。
 */
export function computeIceScore(
  impact: number,
  confidence: number,
  effort: number
): number {
  if (!effort) return 0;
  const score = (impact * confidence) / effort;
  return Math.round(score * 10) / 10;
}

/**
 * DB の生データ行に ice_score を付与して Idea を組み立てる。
 */
export function toIdea(row: IdeaRow): Idea {
  return {
    ...row,
    ice_score: computeIceScore(row.impact, row.confidence, row.effort),
  };
}

// ---- Zod スキーマ（ツール引数バリデーション） ----

const scoreField = z.number().int().min(1).max(10);

export const statusSchema = z.enum(STATUSES);

export const createIdeaSchema = {
  title: z.string().min(1),
  description: z.string().default(""),
  status: statusSchema.default("seed"),
  impact: scoreField.default(3),
  confidence: scoreField.default(3),
  effort: scoreField.default(3),
  category: z.string().optional(),
};

export const listIdeasSchema = {
  status: statusSchema.optional(),
  category: z.string().optional(),
  limit: z.number().int().min(1).default(20),
  offset: z.number().int().min(0).default(0),
};

export const getIdeaSchema = {
  id: z.string().min(1),
};

export const updateIdeaSchema = {
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  impact: scoreField.optional(),
  confidence: scoreField.optional(),
  effort: scoreField.optional(),
  category: z.string().optional(),
};

export const deleteIdeaSchema = {
  id: z.string().min(1),
};

export const advanceStatusSchema = {
  id: z.string().min(1),
  to_status: statusSchema,
};

export const rankByIceSchema = {
  status: statusSchema.optional(),
  category: z.string().optional(),
  top_n: z.number().int().min(1).default(10),
};
