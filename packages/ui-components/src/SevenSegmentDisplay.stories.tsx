import type { Meta, StoryObj } from "@storybook/react-vite";

import { SevenSegmentDisplay } from "./SevenSegmentDisplay";

const meta = {
  component: SevenSegmentDisplay,
  args: { value: 3 },
} satisfies Meta<typeof SevenSegmentDisplay>;

export default meta;

/** 4 桁に満たない値。上の桁は 0 で埋める。 */
export const Default: StoryObj<typeof meta> = {};

/** 4 桁を超える値。桁を増やして全部表示する。 */
export const Overflow: StoryObj<typeof meta> = { args: { value: 12345 } };

/** 値が無いとき。消灯セグメントだけを見せ、大きさは値があるときと同じ。 */
export const Empty: StoryObj<typeof meta> = { args: { value: undefined } };
