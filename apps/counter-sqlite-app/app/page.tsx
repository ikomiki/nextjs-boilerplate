import { CounterTemplate } from "@app/counter";
import { getCounter, setCounter } from "./actions";

/**
 * SQLite の保存先を Server Actions で注入したカウンターのページ。
 * @returns ページ
 */
export default function Page() {
  return <CounterTemplate store={{ get: getCounter, set: setCounter }} />;
}
