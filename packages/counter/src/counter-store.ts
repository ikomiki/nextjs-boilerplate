import { createStore, type StoreApi } from "zustand/vanilla";

/** counter が必要とする保存先。datastore-* の工場関数の戻り値が構造的にこの形に合う。 */
export type CounterStore = {
  get(): Promise<number | undefined>;
  set(value: number): Promise<void>;
};

/** カウンターの状態と操作。`ready` は保存値の読み込みが終わるまで false。 */
export type CounterState = {
  value: number;
  ready: boolean;
  load(): Promise<void>;
  increment(): Promise<void>;
  reset(): Promise<void>;
};

/**
 * 保存先を受け取ってカウンターの Zustand ストアを作る。
 * @param store 値の読み書きに使う保存先
 * @returns `load` を呼ぶまで `ready` が false のストア
 */
export function createCounterStore(
  store: CounterStore,
): StoreApi<CounterState> {
  return createStore<CounterState>((set, get) => ({
    value: 0,
    ready: false,
    async load() {
      set({ value: (await store.get()) ?? 0, ready: true });
    },
    // 読み込み前に値を書くと load の結果で上書きされて押下が消えるので無視する
    async increment() {
      if (!get().ready) return;
      const value = get().value + 1;
      set({ value });
      await store.set(value);
    },
    async reset() {
      if (!get().ready) return;
      set({ value: 0 });
      await store.set(0);
    },
  }));
}
