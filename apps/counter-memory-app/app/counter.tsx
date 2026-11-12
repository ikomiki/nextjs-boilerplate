"use client";

import { CounterTemplate } from "@app/counter";
import { createMemoryStore } from "@app/datastore-memory";

const store = createMemoryStore<number>("counter");

/**
 * メモリの保存先を注入したカウンター。
 * @returns カウンター画面
 */
export function Counter() {
  return <CounterTemplate store={store} />;
}
