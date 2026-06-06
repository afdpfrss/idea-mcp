import { DatabaseSync, type StatementSync } from "node:sqlite";

/**
 * node:sqlite を Cloudflare D1 の D1Database インターフェース互換に見せる
 * 薄いアダプタ。これにより src/db.ts と src/tools/ideas.ts を一切変更せず、
 * ローカル(stdio)版でもクラウド(Workers/D1)版と同じロジックを再利用できる。
 *
 * 使用しているのは D1 の prepare().bind().{first,all,run}() のみ。
 */
class PreparedStatement {
  constructor(
    private readonly stmt: StatementSync,
    private readonly params: unknown[] = []
  ) {}

  bind(...params: unknown[]): PreparedStatement {
    return new PreparedStatement(this.stmt, params);
  }

  // D1: 先頭 1 行を返す（無ければ null）。INSERT/UPDATE ... RETURNING * にも使う。
  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const row = this.stmt.get(...(this.params as never[]));
    return (row as T) ?? null;
  }

  // D1: { results } 形式で全行を返す。
  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    const results = this.stmt.all(...(this.params as never[])) as T[];
    return { results };
  }

  // D1: meta.changes に変更行数を入れて返す。
  async run(): Promise<{ meta: { changes: number } }> {
    const info = this.stmt.run(...(this.params as never[]));
    return { meta: { changes: Number(info.changes) } };
  }
}

export class SqliteD1 {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
  }

  /** スキーマ(複数文)の一括実行に使う。 */
  exec(sql: string): void {
    this.db.exec(sql);
  }

  prepare(sql: string): PreparedStatement {
    return new PreparedStatement(this.db.prepare(sql));
  }
}
