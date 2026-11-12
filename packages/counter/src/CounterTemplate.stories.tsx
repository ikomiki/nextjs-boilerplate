import type { Meta, StoryObj } from "@storybook/react-vite";

import type { CounterStore } from "./counter-store";
import { CounterTemplate } from "./CounterTemplate";

function fakeStore(initial?: number): CounterStore {
  let saved = initial;
  return {
    get: () => Promise.resolve(saved),
    set: (value) => {
      saved = value;
      return Promise.resolve();
    },
  };
}

const meta = {
  component: CounterTemplate,
  args: { store: fakeStore() },
} satisfies Meta<typeof CounterTemplate>;

export default meta;

/** 保存値が無い初回起動。0 から始まる。 */
export const Default: StoryObj<typeof meta> = {};

/** 保存値 7 を読み込んで始まる。 */
export const WithSavedValue: StoryObj<typeof meta> = {
  args: { store: fakeStore(7) },
};
