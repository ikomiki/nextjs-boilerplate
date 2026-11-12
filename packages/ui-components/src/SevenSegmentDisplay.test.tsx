import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SevenSegmentDisplay } from "./SevenSegmentDisplay";

test("値があれば data-value と数字を出す", () => {
  const html = renderToStaticMarkup(<SevenSegmentDisplay value={3} />);
  expect(html).toContain('data-value="3"');
  expect(html).toContain("<span>0003</span>");
});

test("値が無ければ数字を見せず、data-value も出さない", () => {
  const html = renderToStaticMarkup(<SevenSegmentDisplay />);
  expect(html).not.toContain("data-value");
  expect(html).toContain('<span class="invisible">0000</span>');
});
