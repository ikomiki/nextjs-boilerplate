import type { DatabaseSync, SQLInputValue } from "node:sqlite";

import type { SqliteDatabase } from "kysely";

/**
 * `node:sqlite` の `DatabaseSync` を Kysely の `SqliteDialect` が受け取る形に合わせる。
 * @param db 開いた `node:sqlite` のデータベース
 * @returns `SqliteDialect` の `database` に渡せるデータベース
 */
export function toKyselySqlite(db: DatabaseSync): SqliteDatabase {
  return {
    close: () => db.close(),
    prepare: (sql) => {
      const stmt = db.prepare(sql);
      return {
        reader: stmt.columns().length > 0,
        all: (params) => stmt.all(...(params as SQLInputValue[])),
        run: (params) => {
          const { changes, lastInsertRowid } = stmt.run(
            ...(params as SQLInputValue[]),
          );
          return { changes, lastInsertRowid };
        },
        iterate: (params) => stmt.iterate(...(params as SQLInputValue[])),
      };
    },
  };
}
