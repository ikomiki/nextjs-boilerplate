import { expect, test } from "bun:test";

import { sql } from "kysely";

import { createDatabase } from "./index";

test("node:sqlite 経由で Kysely のクエリが通る", async () => {
  const db = createDatabase(":memory:");
  const r = await sql<{ x: number }>`select 1 as x`.execute(db);
  expect(r.rows).toEqual([{ x: 1 }]);
});
