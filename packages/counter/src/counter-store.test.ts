import { expect, test } from "bun:test";
import { createCounterStore, type CounterStore } from "./counter-store";

function fakeStore(initial?: number) {
  const sets: number[] = [];
  const store: CounterStore = {
    get: async () => initial,
    set: async (value) => {
      sets.push(value);
    },
  };
  return { store, sets };
}

test("load 前は ready が false", () => {
  expect(createCounterStore(fakeStore().store).getState().ready).toBe(false);
});

test("保存値が無ければ load 後は 0 で ready", async () => {
  const s = createCounterStore(fakeStore().store);
  await s.getState().load();
  expect(s.getState()).toMatchObject({ value: 0, ready: true });
});

test("保存値 5 を load で読み込む", async () => {
  const s = createCounterStore(fakeStore(5).store);
  await s.getState().load();
  expect(s.getState()).toMatchObject({ value: 5, ready: true });
});

test("increment は値を 1 増やし、その値で set を呼ぶ", async () => {
  const { store, sets } = fakeStore(5);
  const s = createCounterStore(store);
  await s.getState().load();
  await s.getState().increment();
  expect(s.getState().value).toBe(6);
  expect(sets).toEqual([6]);
});

test("reset は 0 にし、0 で set を呼ぶ", async () => {
  const { store, sets } = fakeStore(5);
  const s = createCounterStore(store);
  await s.getState().load();
  await s.getState().reset();
  expect(s.getState().value).toBe(0);
  expect(sets).toEqual([0]);
});

test("ready でない間の increment は何もしない", async () => {
  const { store, sets } = fakeStore(5);
  const s = createCounterStore(store);
  await s.getState().increment();
  expect(s.getState().value).toBe(0);
  expect(sets).toEqual([]);
});

function deferredStore() {
  const resolvers: (() => void)[] = [];
  const store: CounterStore = {
    get: async () => undefined,
    set: () => new Promise<void>((resolve) => resolvers.push(resolve)),
  };
  return { store, resolvers };
}

test("set が終わるまで saving は true、終われば false", async () => {
  const { store, resolvers } = deferredStore();
  const s = createCounterStore(store);
  await s.getState().load();
  const done = s.getState().increment();
  expect(s.getState().saving).toBe(true);
  resolvers[0]?.();
  await done;
  expect(s.getState().saving).toBe(false);
});

test("重なった 2 つの set が両方終わるまで saving は true", async () => {
  const { store, resolvers } = deferredStore();
  const s = createCounterStore(store);
  await s.getState().load();
  const first = s.getState().increment();
  const second = s.getState().increment();
  resolvers[0]?.();
  await first;
  expect(s.getState().saving).toBe(true);
  resolvers[1]?.();
  await second;
  expect(s.getState().saving).toBe(false);
});

test("set が失敗しても saving は false に戻る", async () => {
  const s = createCounterStore({
    get: async () => undefined,
    set: async () => {
      throw new Error("失敗");
    },
  });
  await s.getState().load();
  await expect(s.getState().increment()).rejects.toThrow("失敗");
  expect(s.getState().saving).toBe(false);
});
