import { indexedDB as fakeIndexedDb } from "fake-indexeddb";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createIndexedDbStore } from "./index";

test("indexedDB が無い環境でも工場関数の呼び出しでは例外を出さない", () => {
  expect(globalThis.indexedDB).toBeUndefined();
  expect(() => createIndexedDbStore<number>("counter")).not.toThrow();
});

describe("fake-indexeddb 上", () => {
  // 同じプロセスの他のテストに影響しないよう、fake の indexedDB は describe の間だけグローバルに置く
  beforeAll(() => {
    globalThis.indexedDB = fakeIndexedDb;
  });
  afterAll(() => {
    // @ts-expect-error lib.dom の indexedDB は省略できないプロパティとして宣言されている
    delete globalThis.indexedDB;
  });

  test("未保存のキーは undefined を返す", async () => {
    expect(await createIndexedDbStore<number>("empty").get()).toBeUndefined();
  });

  test("set した値を get で返し、別に作ったストアからも読める", async () => {
    await createIndexedDbStore<number>("counter").set(5);
    expect(await createIndexedDbStore<number>("counter").get()).toBe(5);
  });
});
