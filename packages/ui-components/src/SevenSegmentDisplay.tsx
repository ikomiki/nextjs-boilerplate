import { formatSegments } from "./seven-segment";

/**
 * 数字を DSEG7 の 7 セグメント表示で描く。消えているセグメントは同じ桁数の "8" を薄く重ねて見せる。
 * @param props 表示する値と最小の桁数
 * @returns `data-value` に値を持つ `<output>` 要素
 */
export function SevenSegmentDisplay(props: {
  /** 表示する整数 */
  value: number;
  /** 最小の桁数。既定は 4 */
  minDigits?: number;
}) {
  const { value, minDigits } = props;
  const { text, ghost } = formatSegments(value, minDigits);
  return (
    <output
      aria-label="カウンター"
      data-value={value}
      className="relative inline-block font-segment text-8xl"
    >
      <span>{text}</span>
      <span aria-hidden className="absolute inset-0 opacity-15">
        {ghost}
      </span>
    </output>
  );
}
