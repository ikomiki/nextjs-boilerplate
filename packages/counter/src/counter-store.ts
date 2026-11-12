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
  /** increment / reset が始めた保存のうち、終わっていないものがある間は true。 */
  saving: boolean;
  load: () => Promise<void>;
  increment: () => Promise<void>;
  reset: () => Promise<void>;
};

/**
 * 保存先を受け取ってカウンターの Zustand ストアを作る。
 * @param store 値の読み書きに使う保存先
 * @returns `load` を呼ぶまで `ready` が false のストア
 */
export function createCounterStore(
  store: CounterStore,
): StoreApi<CounterState> {
  let pending = 0;
  return createStore<CounterState>((set, get) => {
    const save = async (value: number) => {
      pending++;
      set({ saving: true });
      try {
        await store.set(value);
      } finally {
        pending--;
        set({ saving: pending > 0 });
      }
    };
    return {
      value: 0,
      ready: false,
      saving: false,
      // React の StrictMode は effect を 2 回走らせるので load も 2 回呼ばれる。
      // 後から返った get で、読み込み後の操作を上書きしない
      async load() {
        const value = (await store.get()) ?? 0;
        if (get().ready) return;
        set({ value, ready: true });
      },
      // 読み込み前に値を書くと load の結果で上書きされて押下が消えるので無視する
      async increment() {
        if (!get().ready) return;
        const value = get().value + 1;
        set({ value });
        await save(value);
      },
      async reset() {
        if (!get().ready) return;
        set({ value: 0 });
        await save(0);
      },
    };
  });
}
