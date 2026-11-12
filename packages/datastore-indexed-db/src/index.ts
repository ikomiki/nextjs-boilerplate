import { get, set } from "idb-keyval";

/** 非同期の get / set で 1 つの値を保存する保存先。 */
export type KeyValueStore<T> = {
  get(): Promise<T | undefined>;
  set(value: T): Promise<void>;
};

/**
 * ブラウザの IndexedDB に値を保存する保存先を作る。値は構造化複製でそのまま保存する。
 * @param key 保存に使うキー
 * @returns キーを束縛した保存先。最初の get / set まで indexedDB に触れない
 */
export function createIndexedDbStore<T>(key: string): KeyValueStore<T> {
  return {
    get: () => get<T>(key),
    set: (value) => set(key, value),
  };
}
