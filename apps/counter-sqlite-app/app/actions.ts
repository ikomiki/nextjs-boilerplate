"use server";

import "server-only";
import path from "node:path";

import { createDatabase } from "@app/database";
import { createSqliteStore } from "@app/datastore-sqlite";

const store = createSqliteStore<number>(
  createDatabase(path.join(process.cwd(), "data/counter.db")),
  "counter",
);

/**
 * SQLite に保存したカウンターの値を読む。
 * @returns 保存した値。まだ無ければ undefined
 */
export async function getCounter(): Promise<number | undefined> {
  return store.get();
}

/**
 * カウンターの値を SQLite に保存する。
 * @param value 保存する整数
 */
export async function setCounter(value: number): Promise<void> {
  // Server Actions は外から任意の値で呼べるので、型注釈だけに頼らない
  if (!Number.isSafeInteger(value)) {
    throw new TypeError("value must be an integer");
  }
  await store.set(value);
}
