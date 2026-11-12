import { expect, test } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";

import { CounterTemplate } from "./CounterTemplate";

test("読み込み前は 0 を表示しない", () => {
  const html = renderToStaticMarkup(
    <CounterTemplate
      store={{ get: () => Promise.resolve(5), set: () => Promise.resolve() }}
    />,
  );
  expect(html).not.toContain("data-value");
});
