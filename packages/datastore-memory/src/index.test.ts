import { expect, test } from "bun:test";

import { createMemoryStore } from "./index";

test("未保存のキーは undefined を返す", async () => {
  expect(await createMemoryStore<number>("counter").get()).toBeUndefined();
});

test("set した値を get で返す", async () => {
  const store = createMemoryStore<number>("counter");
  await store.set(3);
  expect(await store.get()).toBe(3);
});
