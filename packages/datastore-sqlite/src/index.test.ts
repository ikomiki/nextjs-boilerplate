import { beforeEach, expect, test } from "bun:test";

import { type Kysely, sql } from "kysely";

import { createDatabase, type Database } from "@app/database";

import { createSqliteStore, type KeyValueStore } from "./index";

const schema = await Bun.file(
  new URL("../../database/schema.sql", import.meta.url),
).text();

let db: Kysely<Database>;
let store: KeyValueStore<number>;

beforeEach(async () => {
  db = createDatabase(":memory:");
  await sql.raw(schema).execute(db);
  store = createSqliteStore<number>(db, "count");
});

test("未保存のキーは undefined を返す", async () => {
  expect(await store.get()).toBeUndefined();
});

test("set した値を get で返す", async () => {
  await store.set(7);
  expect(await store.get()).toBe(7);
});

test("2 回 set すると後の値で上書きされ、行は 1 つ", async () => {
  await store.set(1);
  await store.set(2);
  expect(await store.get()).toBe(2);
  expect((await db.selectFrom("kv").selectAll().execute()).length).toBe(1);
});
