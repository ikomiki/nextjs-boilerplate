# 06 アプリ

`apps/` に Next.js のアプリを 3 つ置く。どれも同じ `CounterTemplate` を表示し、違うのは渡す保存先だけにする。`create-next-app` は使わず、設定ファイルはコマンドで作る。

| アプリ                   | 保存先                             | ポート |
| ------------------------ | ---------------------------------- | ------ |
| `counter-indexed-db-app` | ブラウザの IndexedDB               | 3001   |
| `counter-memory-app`     | メモリ (再読込で 0 に戻る)         | 3002   |
| `counter-sqlite-app`     | サーバーの SQLite (Server Actions) | 3003   |

packages は TS のソースをそのまま export しているので、各アプリの `next.config.ts` の `transpilePackages` に、使う `@app/*` を並べる。`next dev` はコーディングエージェントを検出するとアプリ直下に `AGENTS.md` を書き出すので、`agentRules: false` で止める。

`next-env.d.ts` は `next dev` と `next build` が生成し、そのたびに中身を書き換えるので、git では管理しない。

```bash
grep -qx next-env.d.ts .gitignore || echo next-env.d.ts >> .gitignore
```

## counter-memory-app

`app/globals.css` は ui-components の `styles.css` を読み、`@source` で `packages/counter/src` を Tailwind の走査対象に足す。ui-components は自分を使う側のパッケージを知らないので、使う側が足す。

```bash
mkdir -p apps/counter-memory-app/app
cat <<'EOF' > apps/counter-memory-app/package.json
{
  "name": "@app/counter-memory-app",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3002",
    "build": "next build",
    "start": "next start --port 3002",
    "typecheck": "bun check"
  }
}
EOF
(cd apps/counter-memory-app && bun add next react react-dom "@app/counter@workspace:*" "@app/ui-components@workspace:*" "@app/datastore-memory@workspace:*" && bun add -d typescript @types/node @types/react @types/react-dom tailwindcss @tailwindcss/postcss)
cat <<'EOF' > apps/counter-memory-app/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "plugins": [{ "name": "next" }] },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF
cat <<'EOF' > apps/counter-memory-app/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@app/counter",
    "@app/datastore-memory",
    "@app/ui-components",
  ],
  agentRules: false,
};

export default nextConfig;
EOF
cat <<'EOF' > apps/counter-memory-app/postcss.config.mjs
export default { plugins: { "@tailwindcss/postcss": {} } };
EOF
cat <<'EOF' > apps/counter-memory-app/app/globals.css
@import "@app/ui-components/styles.css";
@source "../../../packages/counter/src";
EOF
cat <<'EOF' > apps/counter-memory-app/app/layout.tsx
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
EOF
```

保存先を注入するのは `app/counter.tsx` だけにする。工場関数で作った保存先をそのまま `CounterTemplate` に渡す。関数を含むオブジェクトはサーバーコンポーネントからクライアントコンポーネントへ渡せないので、`"use client"` のファイルの中で作る。

```tsx
"use client";

import { CounterTemplate } from "@app/counter";
import { createMemoryStore } from "@app/datastore-memory";

const store = createMemoryStore<number>("counter");

export function Counter() {
  return <CounterTemplate store={store} />;
}
```

`app/page.tsx` は `<Counter />` を返すだけにする。

```bash
bunx turbo run build --filter=@app/counter-memory-app
bun run --filter @app/counter-memory-app dev
```

http://localhost:3002 を開く。メモリ版は再読込すると 0 に戻る。

## counter-indexed-db-app

`tsconfig.json`、`postcss.config.mjs`、`app/globals.css`、`app/layout.tsx` はメモリ版と同じなので複製する。

```bash
mkdir -p apps/counter-indexed-db-app/app
cat <<'EOF' > apps/counter-indexed-db-app/package.json
{
  "name": "@app/counter-indexed-db-app",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start --port 3001",
    "typecheck": "bun check"
  }
}
EOF
(cd apps/counter-indexed-db-app && bun add next react react-dom "@app/counter@workspace:*" "@app/ui-components@workspace:*" "@app/datastore-indexed-db@workspace:*" && bun add -d typescript @types/node @types/react @types/react-dom tailwindcss @tailwindcss/postcss)
cp apps/counter-memory-app/tsconfig.json apps/counter-memory-app/postcss.config.mjs apps/counter-indexed-db-app/
cp apps/counter-memory-app/app/globals.css apps/counter-memory-app/app/layout.tsx apps/counter-indexed-db-app/app/
cat <<'EOF' > apps/counter-indexed-db-app/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@app/counter",
    "@app/datastore-indexed-db",
    "@app/ui-components",
  ],
  agentRules: false,
};

export default nextConfig;
EOF
```

`app/counter.tsx` で、メモリ版の工場関数を `@app/datastore-indexed-db` の `createIndexedDbStore` に替える。

```tsx
import { createIndexedDbStore } from "@app/datastore-indexed-db";

const store = createIndexedDbStore<number>("counter");
```

この行はサーバー描画でも評価される。`createIndexedDbStore` は最初の `get` / `set` まで `indexedDB` に触れず、`get` は `CounterTemplate` の `useEffect` の中で呼ばれるので、サーバーでは `indexedDB` に触れない。

```bash
bunx turbo run build --filter=@app/counter-indexed-db-app
bun run --filter @app/counter-indexed-db-app dev
```

http://localhost:3001 を開く。再読込しても値が残る。

## counter-sqlite-app

値はサーバーの SQLite に置き、ブラウザからは Server Actions で読み書きする。DB ファイルは `apps/counter-sqlite-app/data/counter.db` で、`.gitignore` に入れてある。`predev` と `prebuild` で Atlas の移行を当てるので、DB ファイルが無くても `dev` と `build` はそのまま動く。

```bash
mkdir -p apps/counter-sqlite-app/app
cat <<'EOF' > apps/counter-sqlite-app/package.json
{
  "name": "@app/counter-sqlite-app",
  "private": true,
  "scripts": {
    "predev": "bun run --filter @app/database migrate:apply",
    "dev": "next dev --port 3003",
    "prebuild": "bun run --filter @app/database migrate:apply",
    "build": "next build",
    "start": "next start --port 3003",
    "typecheck": "bun check"
  }
}
EOF
(cd apps/counter-sqlite-app && bun add next react react-dom server-only "@app/counter@workspace:*" "@app/ui-components@workspace:*" "@app/datastore-sqlite@workspace:*" "@app/database@workspace:*" && bun add -d typescript @types/node @types/react @types/react-dom tailwindcss @tailwindcss/postcss)
cp apps/counter-memory-app/tsconfig.json apps/counter-memory-app/postcss.config.mjs apps/counter-sqlite-app/
cp apps/counter-memory-app/app/globals.css apps/counter-memory-app/app/layout.tsx apps/counter-sqlite-app/app/
cat <<'EOF' > apps/counter-sqlite-app/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@app/counter",
    "@app/database",
    "@app/datastore-sqlite",
    "@app/ui-components",
  ],
  agentRules: false,
};

export default nextConfig;
EOF
cat <<'EOF' > apps/counter-sqlite-app/turbo.json
{
  "$schema": "https://turborepo.dev/schema.json",
  "extends": ["//"],
  "tasks": { "build": { "cache": false } }
}
EOF
```

`data/` は turbo の出力に含めないので、`build` をキャッシュすると、キャッシュが当たったときに `prebuild` ごと飛ばされて DB ができない。このアプリの `turbo.json` で `build` のキャッシュを切る。

`app/actions.ts` に、datastore-sqlite を呼ぶ Server Actions を 2 つ置く。`server-only` はこのファイルだけで import する。DB はモジュールの中で 1 度だけ開く。

```ts
"use server";

import "server-only";
import path from "node:path";
import { createDatabase } from "@app/database";
import { createSqliteStore } from "@app/datastore-sqlite";

const store = createSqliteStore<number>(
  createDatabase(path.join(process.cwd(), "data/counter.db")),
  "counter",
);

export async function getCounter(): Promise<number | undefined> {
  return store.get();
}

export async function setCounter(value: number): Promise<void> {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError("value must be an integer");
  }
  await store.set(value);
}
```

Server Actions は外から任意の値で呼べるので、`setCounter` は受け取った値が整数かを確かめてから保存する。

`app/page.tsx` はサーバーコンポーネントのまま、2 つの Server Actions を `CounterStore` の形にして渡す。Server Actions はクライアントコンポーネントに渡せる。

```tsx
import { CounterTemplate } from "@app/counter";
import { getCounter, setCounter } from "./actions";

export default function Page() {
  return <CounterTemplate store={{ get: getCounter, set: setCounter }} />;
}
```

```bash
rm -rf apps/counter-sqlite-app/data
bunx turbo run build --filter=@app/counter-sqlite-app
bun run --filter @app/counter-sqlite-app dev
```

`build` の前に移行が当たり、`data/counter.db` に `kv` テーブルができる。http://localhost:3003 を開く。再読込しても値が残る。
