"use client";

import { CounterTemplate } from "@app/counter";
import { createIndexedDbStore } from "@app/datastore-indexed-db";

const store = createIndexedDbStore<number>("counter");

/**
 * IndexedDB の保存先を注入したカウンター。
 * @returns カウンター画面
 */
export function Counter() {
  return <CounterTemplate store={store} />;
}
