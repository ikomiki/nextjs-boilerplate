import { DatabaseSync } from "node:sqlite";

import { Kysely, SqliteDialect } from "kysely";

import { toKyselySqlite } from "./node-sqlite-adapter";

/** キーと JSON 文字列の値を 1 行ずつ持つ `kv` テーブルの行。 */
export type KvTable = { key: string; value: string };

/** Kysely に渡す DB 全体の型。 */
export type Database = { kv: KvTable };

/**
 * `node:sqlite` で SQLite のファイルを開き、Kysely のクライアントを作る。
 * @param filename DB ファイルのパス。`:memory:` ならインメモリ
 * @returns `Database` 型の Kysely クライアント
 */
export function createDatabase(filename: string): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new SqliteDialect({
      database: toKyselySqlite(new DatabaseSync(filename)),
    }),
  });
}
