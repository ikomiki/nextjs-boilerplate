/** 非同期の get / set で 1 つの値を保存する保存先。 */
export type KeyValueStore<T> = {
  get(): Promise<T | undefined>;
  set(value: T): Promise<void>;
};

/**
 * メモリ上に値を持つ保存先を作る。ページを再読込すると値は消える。
 * @param _key 保存先の識別子。メモリ版では使わないが、他の保存先と呼び出しの形をそろえるために受け取る
 * @returns 呼び出しごとに独立した保存先
 */
export function createMemoryStore<T>(_key: string): KeyValueStore<T> {
  let value: T | undefined;
  return {
    get: () => Promise.resolve(value),
    set: (next) => {
      value = next;
      return Promise.resolve();
    },
  };
}
