import { expect, test } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";

import { CounterTemplate } from "./CounterTemplate";

test("読み込み前は 0 を表示しない", () => {
  const html = renderToStaticMarkup(
    <CounterTemplate store={{ get: async () => 5, set: async () => {} }} />,
  );
  expect(html).not.toContain("data-value");
});
