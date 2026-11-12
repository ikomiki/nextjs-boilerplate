import { expect, test } from "bun:test";

import { formatSegments } from "./seven-segment";

test("4 桁にゼロ埋めし、ghost は同じ桁数の 8", () => {
  expect(formatSegments(3)).toEqual({ text: "0003", ghost: "8888" });
});
test("桁あふれは切らずに桁を増やす", () => {
  expect(formatSegments(12345)).toEqual({ text: "12345", ghost: "88888" });
});
