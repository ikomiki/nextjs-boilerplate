import { formatSegments } from "./seven-segment";

/**
 * 数字を DSEG7 の 7 セグメント表示で描く。消えているセグメントは同じ桁数の "8" を薄く重ねて見せる。
 * 値が無いときは消灯セグメントだけを見せ、数字の幅は残してレイアウトを動かさない。
 * @param props 表示する値と最小の桁数
 * @returns 値があれば `data-value` にその値を持つ `<output>` 要素
 */
export function SevenSegmentDisplay(props: {
  /** 表示する整数。読み込み前など値が無いときは省く */
  value?: number;
  /** 最小の桁数。既定は 4 */
  minDigits?: number;
}) {
  const { value, minDigits } = props;
  const { text, ghost } = formatSegments(value ?? 0, minDigits);
  return (
    <output
      aria-label="カウンター"
      data-value={value}
      className="relative inline-block font-segment text-8xl"
    >
      <span className={value === undefined ? "invisible" : undefined}>
        {text}
      </span>
      <span aria-hidden className="absolute inset-0 opacity-15">
        {ghost}
      </span>
    </output>
  );
}
