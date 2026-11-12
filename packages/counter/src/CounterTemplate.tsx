"use client";

import { Button, SevenSegmentDisplay } from "@app/ui-components";
import { useEffect, useState } from "react";
import { useStore } from "zustand";
import { createCounterStore, type CounterStore } from "./counter-store";

/**
 * 7 セグメントの数字と [+1] [リセット] を並べたカウンター画面。
 * @param props 値の保存先
 * @returns 読み込みが終わるまでボタンを無効にした画面
 */
export function CounterTemplate(props: { store: CounterStore }) {
  const [counter] = useState(() => createCounterStore(props.store));
  const { value, ready, saving, load, increment, reset } = useStore(counter);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <main aria-busy={saving} className="flex flex-col items-center gap-6 p-8">
      <SevenSegmentDisplay value={ready ? value : undefined} />
      <div className="flex gap-4">
        <Button disabled={!ready} onClick={() => void increment()}>
          +1
        </Button>
        <Button
          variant="outline"
          disabled={!ready}
          onClick={() => void reset()}
        >
          リセット
        </Button>
      </div>
    </main>
  );
}
