/**
 * 7 セグメント表示に渡す文字列を作る。
 * @param value 表示する整数
 * @param minDigits 最小の桁数。足りない桁は 0 で埋め、超えた桁は切らずに桁を増やす
 * @returns 表示する数字 `text` と、同じ桁数の "8" を並べた消灯セグメント用の `ghost`
 */
export function formatSegments(
  value: number,
  minDigits = 4,
): { text: string; ghost: string } {
  const text = String(value).padStart(minDigits, "0");
  return { text, ghost: "8".repeat(text.length) };
}
