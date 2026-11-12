# 05 保存先のパッケージ

保存先ごとに、キーを束縛した工場関数を公開するパッケージを作る。`KeyValueStore<T>` は各パッケージが自分で export し、共有の型パッケージは作らない。

```ts
export type KeyValueStore<T> = {
  get(): Promise<T | undefined>;
  set(value: T): Promise<void>;
};
```

## datastore-memory

```bash
mkdir -p packages/datastore-memory/src
cat <<'EOF' > packages/datastore-memory/package.json
{
  "name": "@app/datastore-memory",
  "private": true,
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "bun check", "test": "bun test" }
}
EOF
cat <<'EOF' > packages/datastore-memory/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["bun"] },
  "include": ["src"]
}
EOF
(cd packages/datastore-memory && bun add -d @types/bun)
```

`bun check` が `bun:test` の型を解決するために、`@types/bun` を各パッケージに入れ、tsconfig の `types` に `bun` を足す。

工場関数は `createMemoryStore<T>(key: string): KeyValueStore<T>`。値はクロージャの変数 1 つに持つ。

## datastore-indexed-db

```bash
mkdir -p packages/datastore-indexed-db/src
cat <<'EOF' > packages/datastore-indexed-db/package.json
{
  "name": "@app/datastore-indexed-db",
  "private": true,
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "bun check", "test": "bun test" }
}
EOF
cat <<'EOF' > packages/datastore-indexed-db/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["bun"] },
  "include": ["src"]
}
EOF
(cd packages/datastore-indexed-db && bun add idb-keyval && bun add -d fake-indexeddb @types/bun)
```

工場関数は `createIndexedDbStore<T>(key: string): KeyValueStore<T>`。idb-keyval の `get` と `set` に委ねる。値は構造化複製でそのまま保存するので JSON にしない。idb-keyval は最初の `get` / `set` まで `indexedDB` に触れないため、サーバー描画中に工場関数を呼んでも落ちない。

## database

Kysely のクライアントと DB 型、Atlas のスキーマと移行を置く。ドライバは `node:sqlite` で、Node 26 と bun の両方で動く。

```bash
mkdir -p packages/database/src
cat <<'EOF' > packages/database/package.json
{
  "name": "@app/database",
  "private": true,
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "bun check",
    "test": "bun test",
    "migrate:diff": "atlas migrate diff --env local",
    "migrate:apply": "mkdir -p ../../apps/counter-sqlite-app/data && atlas migrate apply --env local"
  }
}
EOF
cat <<'EOF' > packages/database/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["bun"] },
  "include": ["src"]
}
EOF
(cd packages/database && bun add kysely && bun add -d @types/bun)
```

スキーマは SQL で書き、Atlas がこれと移行ディレクトリの差分から移行を作る。差分を計算する dev DB は SQLite のインメモリにする。適用先は counter-sqlite-app の `data/counter.db` で、`data` は `.gitignore` に入れてある。

```bash
cat <<'EOF' > packages/database/schema.sql
CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
EOF
cat <<'EOF' > packages/database/atlas.hcl
env "local" {
  src = "file://schema.sql"
  dev = "sqlite://dev?mode=memory"
  migration {
    dir = "file://migrations"
  }
  url = "sqlite://../../apps/counter-sqlite-app/data/counter.db"
}
EOF
```

### 移行を作って当てる

スキーマを変えたら、名前を付けて移行を作り、適用する。`migrations/` にできた SQL と `atlas.sum` はコミットする。

```bash
(cd packages/database && bun run migrate:diff init && bun run migrate:apply)
```

### Kysely と node:sqlite の変換

Kysely の `SqliteDialect` は better-sqlite3 の形のデータベースを受け取る。`node:sqlite` の `DatabaseSync` をその形に合わせる薄い変換を `src/node-sqlite-adapter.ts` に置き、better-sqlite3 は入れない。`prepare` した文を次のように対応させる。

| `SqliteDialect` が使うもの | `node:sqlite` での実装                                  |
| -------------------------- | ------------------------------------------------------- |
| `reader`                   | `stmt.columns().length > 0`                             |
| `all(params)`              | `stmt.all(...params)`                                   |
| `run(params)`              | `stmt.run(...params)` の `changes` と `lastInsertRowid` |
| `iterate(params)`          | `stmt.iterate(...params)`                               |

DB 型はテーブルが 1 つなので手書きする。

```ts
export type KvTable = { key: string; value: string };
export type Database = { kv: KvTable };

export function createDatabase(filename: string): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new SqliteDialect({
      database: toKyselySqlite(new DatabaseSync(filename)),
    }),
  });
}
```

## datastore-sqlite

Kysely で `kv` テーブルに読み書きする。`node:sqlite` を使うのでサーバー専用。

```bash
mkdir -p packages/datastore-sqlite/src
cat <<'EOF' > packages/datastore-sqlite/package.json
{
  "name": "@app/datastore-sqlite",
  "private": true,
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "bun check", "test": "bun test" },
  "dependencies": { "@app/database": "workspace:*" }
}
EOF
cat <<'EOF' > packages/datastore-sqlite/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["bun"] },
  "include": ["src"]
}
EOF
(cd packages/datastore-sqlite && bun add kysely && bun add -d @types/bun)
```

eslint-plugin-boundaries が `@app/database` の import を解決できるように、`dependencies` に `workspace:*` で載せる。

工場関数は `createSqliteStore<T>(db: Kysely<Database>, key: string): KeyValueStore<T>`。DB は呼び出し側で `createDatabase` から作って渡す。値は `JSON.stringify` で文字列にして `value` 列に入れ、`get` で `JSON.parse` する。`set` は `onConflict` で同じキーの行を上書きし、行を増やさない。

## ui-components

shadcn/ui の部品と 7 セグメントの数字表示を置く。Tailwind CSS のテーマもこのパッケージの `styles.css` に持たせ、apps と Storybook はこの CSS だけを読む。

```bash
mkdir -p packages/ui-components/src/lib
cat <<'EOF' > packages/ui-components/package.json
{
  "name": "@app/ui-components",
  "private": true,
  "exports": {
    ".": "./src/index.ts",
    "./styles.css": "./src/styles.css",
    "./lib/*": "./src/lib/*.ts",
    "./components/*": "./src/components/*.tsx"
  },
  "scripts": { "typecheck": "bun check", "test": "bun test" }
}
EOF
cat <<'EOF' > packages/ui-components/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["bun"],
    "paths": { "@app/ui-components/*": ["./src/*"] }
  },
  "include": ["src"]
}
EOF
(cd packages/ui-components && bun add react react-dom dseg class-variance-authority && bun add -d @types/bun @types/react @types/react-dom tailwindcss)
```

shadcn の部品がほかの部品や utils を import するときは、`components.json` の `aliases` どおり `@app/ui-components/lib/utils` のように自分のパッケージ名を使う。型チェックでは tsconfig の `paths` で、apps と Storybook のバンドラでは `exports` の `./lib/*` と `./components/*` で解決する。

### shadcn

`shadcn init` は使わず、`components.json` を手で書く。`aliases` を自分のパッケージ名にしておくと、`bunx shadcn add` は `paths` をたどって `src/components/ui` に部品を置く。

```bash
cat <<'EOF' > packages/ui-components/components.json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@app/ui-components/components",
    "ui": "@app/ui-components/components/ui",
    "utils": "@app/ui-components/lib/utils",
    "lib": "@app/ui-components/lib",
    "hooks": "@app/ui-components/hooks"
  }
}
EOF
cat <<'EOF' > packages/ui-components/src/lib/utils.ts
/** クラス名を連結し、衝突する Tailwind のクラスは後のものを残す。shadcn の部品が使うものと同じ関数。 */
export { cn } from "cn";
EOF
```

### styles.css

Tailwind の読み込み、走査するソース、shadcn のテーマ変数、DSEG7 のフォントをまとめる。`@source` は CSS ファイルからの相対パスで、自分の `src` と、この部品を使う `packages/counter/src` を対象にする。まだ無いディレクトリを指しても Tailwind はエラーにしない。

テーマ変数は shadcn の neutral から、Button が使う色と角丸だけを置く。ダークモードは `.dark` クラスを付けたときだけ効くようにし、OS の設定では切り替えない。

DSEG7 は npm の `dseg` に入っている woff2 を `@font-face` の相対 URL で指す。bun は workspace の依存を各パッケージの `node_modules` に置くので、`styles.css` から `../node_modules/dseg` で届く。Vite も Next.js も CSS の相対 URL をビルド時に解決してフォントを出力に含めるので、`next/font/local` は使わない。

```bash
cat <<'EOF' > packages/ui-components/src/styles.css
@import "tailwindcss";

@source ".";
@source "../../counter/src";

@custom-variant dark (&:is(.dark *));

@font-face {
  font-family: "DSEG7-Classic";
  src: url("../node_modules/dseg/fonts/DSEG7-Classic/DSEG7Classic-Regular.woff2")
    format("woff2");
  font-display: block;
}

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}

@theme inline {
  --font-segment: "DSEG7-Classic", monospace;
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
EOF
```

Button を足し、生成されたファイルを `bun fmt` の形にそろえる。

```bash
(cd packages/ui-components && bunx shadcn add button)
bun run fmt
```

Button が使う `cn` (shadcn の npm パッケージ) と `radix-ui` は、このとき `dependencies` に入る。

### 7 セグメント表示

実装は `packages/ui-components/src/seven-segment.ts` と `src/SevenSegmentDisplay.tsx` にある。

- `formatSegments(value, minDigits = 4)` は、`minDigits` 桁にゼロ埋めした `text` と、同じ桁数の "8" を並べた `ghost` を返す。桁があふれたら切らずに桁を増やす
- `SevenSegmentDisplay` は `<output aria-label="カウンター" data-value={value}>` に `text` を DSEG7 で描き、`ghost` を `aria-hidden` で薄く重ねる。DSEG7 の "8" は全セグメントが点いた形なので、消えているセグメントが薄く見える

## Storybook

リポジトリ直下に 1 つ置き、packages の `*.stories.tsx` を集める。framework は `@storybook/react-vite` で、Tailwind は `@tailwindcss/vite` を Vite の設定に足して処理する。`storybook init` は使わない。

```bash
bun add -d storybook @storybook/react-vite vite @tailwindcss/vite react react-dom "@app/ui-components@workspace:*"
mkdir -p .storybook
cat <<'EOF' > .storybook/main.ts
import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";
import { mergeConfig } from "vite";

const config: StorybookConfig = {
  stories: ["../packages/*/src/**/*.stories.tsx"],
  framework: "@storybook/react-vite",
  viteFinal: (config) => mergeConfig(config, { plugins: [tailwindcss()] }),
};

export default config;
EOF
cat <<'EOF' > .storybook/preview.ts
import "@app/ui-components/styles.css";
import type { Preview } from "@storybook/react-vite";

const preview: Preview = {};

export default preview;
EOF
jq '.scripts += {
  "storybook": "storybook dev -p 6006",
  "storybook:build": "storybook build"
}' package.json > package.json.tmp && mv package.json.tmp package.json
```

preview が `@app/ui-components/styles.css` を import できるように、ルートの `devDependencies` に `workspace:*` で載せる。ビルド出力の `storybook-static/` は `.gitignore` に入れてある。

```bash
bun run storybook
bun run storybook:build
```

## counter

Template と、アプリ固有のロジックを置く。保存先は自分で型を宣言し、datastore-* は import しない。依存してよいのは ui-components だけにする。

```bash
mkdir -p packages/counter/src
cat <<'EOF' > packages/counter/package.json
{
  "name": "@app/counter",
  "private": true,
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "bun check", "test": "bun test" }
}
EOF
cat <<'EOF' > packages/counter/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["bun"] },
  "include": ["src"]
}
EOF
(cd packages/counter && bun add react react-dom zustand "@app/ui-components@workspace:*" && bun add -d @types/bun @types/react @types/react-dom)
```

counter が宣言する保存先の型と、ストアの工場関数の形は次のとおり。実装は `packages/counter/src/counter-store.ts` と `CounterTemplate.tsx` にある。

```ts
export type CounterStore = {
  get(): Promise<number | undefined>;
  set(value: number): Promise<void>;
};

export function createCounterStore(store: CounterStore): StoreApi<CounterState>;
```

`ready` は `load()` が終わるまで false で、その間の `increment` は何もしない。`CounterTemplate` も `ready` になるまで [+1] と [リセット] を `disabled` にする。保存値が無ければ 0 から始める。

### 依存の向き

`eslint.config.mjs` の `boundaries/dependencies` で、許す import だけを列挙する。それ以外は error になる。

```js
{
  from: { element: { type: "counter" } },
  allow: { to: { element: { type: "ui" } } },
},
{
  from: { element: { type: "datastore", captured: { name: "sqlite" } } },
  allow: { to: { element: { type: "database" } } },
},
```

counter から datastore-* へ、datastore-* から counter への import は、どちらもこの設定で `bun run lint` が落ちる。

`@app/*` は `tsconfig.base.json` の `paths` で `packages/*/src/index.ts` に解決する。eslint の resolver がこの `paths` を読むので、package.json に宣言していない import も依存の向きの検査に掛かる。
