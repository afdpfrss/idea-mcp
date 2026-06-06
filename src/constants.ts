import type { Status } from "./tools/types.js";

/**
 * 許可されたステータス遷移。
 *   seed       → validating, archived
 *   validating → building,   archived
 *   building   → released,   archived
 *   released   → （遷移なし）
 *   archived   → （遷移なし）
 */
export const VALID_TRANSITIONS: Record<Status, Status[]> = {
  seed: ["validating", "archived"],
  validating: ["building", "archived"],
  building: ["released", "archived"],
  released: [],
  archived: [],
};
