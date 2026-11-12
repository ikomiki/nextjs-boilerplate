import type { ReactNode } from "react";
import "./globals.css";

/**
 * 全ページで共通の html と body。
 * @param props ページの中身
 * @returns ルートのレイアウト
 */
export default function RootLayout(props: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{props.children}</body>
    </html>
  );
}
