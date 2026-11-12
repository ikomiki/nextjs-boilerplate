import type { Database } from "@app/database";
import type { Kysely } from "kysely";

/** 非同期の get / set で 1 つの値を保存する保存先。 */
export type KeyValueStore<T> = {
  get(): Promise<T | undefined>;
  set(value: T): Promise<void>;
};

/**
 * SQLite の `kv` テーブルの 1 行に値を保存する保存先を作る。サーバー専用。
 * @param db `createDatabase` で作った Kysely クライアント
 * @param key `kv` テーブルの行のキー
 * @returns 値を JSON 文字列にして読み書きする保存先
 */
export function createSqliteStore<T>(
  db: Kysely<Database>,
  key: string,
): KeyValueStore<T> {
  return {
    get: async () => {
      const row = await db
        .selectFrom("kv")
        .select("value")
        .where("key", "=", key)
        .executeTakeFirst();
      return row ? (JSON.parse(row.value) as T) : undefined;
    },
    set: async (value) => {
      const json = JSON.stringify(value);
      await db
        .insertInto("kv")
        .values({ key, value: json })
        .onConflict((oc) => oc.column("key").doUpdateSet({ value: json }))
        .execute();
    },
  };
}
