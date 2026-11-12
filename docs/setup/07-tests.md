# 07 テスト

unit test は各パッケージの `bun test` で、06 までの工程で `bun run test` から回るようにしてある。ここでは 3 アプリを Playwright で通しに確かめる E2E を置く。

## Playwright

```bash
bun add -d @playwright/test
bunx playwright install chromium
```

`webServer` で 3 アプリの `dev` を起動し、各ポートが応答するまで待つ。SQLite 版は `predev` で移行を当てるので、DB ファイルが無い状態からでも起動できる。初回の `next dev` はコンパイルに時間が掛かるので、起動待ちを 120 秒にする。手元ですでに `dev` が動いていれば、それをそのまま使う。

```bash
cat <<'EOF' > playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

const apps = [
  { name: "counter-indexed-db-app", port: 3001 },
  { name: "counter-memory-app", port: 3002 },
  { name: "counter-sqlite-app", port: 3003 },
];

export default defineConfig({
  testDir: "e2e",
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
  webServer: apps.map((app) => ({
    command: `bun run --cwd apps/${app.name} dev`,
    port: app.port,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  })),
});
EOF
jq '.scripts += { "e2e": "playwright test" }' package.json > package.json.tmp && mv package.json.tmp package.json
```

レポートの `playwright-report/` と `test-results/` は 03 の工程で `.gitignore` に入れてある。

## E2E

テストは `e2e/counter.spec.ts` にある。3 アプリに同じテストを回し、再読込後に値が残るかどうかだけをアプリごとに変える。

```ts
const apps = [
  { name: "indexed-db", url: "http://localhost:3001", persists: true },
  { name: "memory", url: "http://localhost:3002", persists: false },
  { name: "sqlite", url: "http://localhost:3003", persists: true },
];
```

値は 7 セグメント表示の `<output aria-label="カウンター">` の `data-value` で読む。各テストの前に [リセット] を押して 0 から始める。ボタンは保存値の読み込みが終わるまで無効なので、Playwright の `click` は有効になるまで待ってから押す。

| テスト                       | 確かめること                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------- |
| +1 を 3 回で 3、リセットで 0 | `data-value` が "3" になり、[リセット] で "0" に戻る                         |
| 再読込後の値                 | +1 を 2 回押して再読込すると、IndexedDB 版と SQLite 版は "2"、メモリ版は "0" |
| 素早く 10 回押してすぐ再読込 | `click` を待たずに 10 回押し、"10" を確かめてすぐ再読込しても値が残る        |

SQLite 版の DB はサーバーに 1 つしかなく、テストが並んで走ると値を奪い合うので、`test.describe.configure({ mode: "serial" })` で順に流す。

## 確認

```bash
rm -rf apps/counter-sqlite-app/data
bun run e2e
```

9 件のテストが通る。
