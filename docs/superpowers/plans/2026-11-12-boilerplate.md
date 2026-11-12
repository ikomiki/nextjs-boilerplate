# Web アプリ開発ボイラープレート 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** bun + TurboRepo の monorepo に、品質ツール一式と依存性注入の構造を持つ Next.js 開発環境を作り、その作成手順を `docs/setup/` に残す。

**Architecture:** apps は Next.js のルーティングと保存先の注入だけを持ち、packages はフラットに並ぶ。counter が保存先の型を宣言し、datastore-* は counter を知らずに同じ形の get/set を返す工場関数を公開する。依存の向きは eslint-plugin-boundaries で強制する。

**Tech Stack:** bun 1.4.4 (install / test / lint / fmt / check)、Node 26.13.1、TurboRepo、Next.js、React、Zustand、idb-keyval、Kysely + `node:sqlite`、Atlas、Tailwind CSS v4、shadcn/ui、DSEG7、Storybook、Playwright、CSpell、TypeDoc、lefthook、direnv、eslint (boundaries と jsdoc のみ)

**Spec:** `docs/superpowers/specs/2026-11-12-boilerplate-design.md`

## Global Constraints

- Node は `v26.13.1`、`.nvmrc` に `26.13.1`。bun は `packageManager: "bun@1.4.4"`
- パッケージ名は `@app/<ディレクトリ名>`。packages は TS ソースを直接 export し (`"exports": { ".": "./src/index.ts" }`)、ビルド工程を持たない。apps は `transpilePackages` で読む
- dev サーバーのポート: counter-indexed-db-app `3001`、counter-memory-app `3002`、counter-sqlite-app `3003`
- 1 ファイル 300 行、1 関数 100 行 (空行とコメントを除く)
- 公開関数・公開型・公開定数には日本語の JSDoc を付ける。それ以外のコメントは非自明な理由だけ
- package.json のスクリプトと lefthook から `bun lint` / `bun fmt` を呼ぶときは必ず `--no-script` を付ける
- 環境構築のファイル (設定ファイル、package.json、ツールの設定) は、手順書に書いた `cat <<'EOF' > path` / echo リダイレクト / jq のコマンドをそのまま実行して作る。手順書を先に書き、そのコマンドを流す。手で直したらコマンドも直す
- カウンターアプリの実装 (画面・ストア・datastore の本体) は通常どおりファイルを書き、手順書には要所だけを載せる (spec「手順書」節の列挙どおり)
- ドキュメントとコメントは humanizer の規則に従う。ダッシュ (— と –)、誇張語、太字見出し付き箇条書き、決まり文句、変更経緯を書かない
- 生成コマンドは `bunx shadcn add` だけ。create-next-app / shadcn init / storybook init は使わない
- 各ライブラリは作業時点の最新安定版を `bun add` で入れ、lockfile をコミットする
- コミットは 1 関心ごとに分ける。メッセージ末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Review Focus

1. 保存値の読み込みが終わる前に [+1] を押す: 読み込んだ値で上書きされて押下が消えてはいけない。読み込み完了までボタンを無効にする (Task 7 のストアテストと Task 9 の E2E)
2. [+1] を素早く 10 回押してすぐ再読込: IndexedDB 版と SQLite 版は 10 が残る (Task 9 の E2E)
3. IndexedDB 版をサーバー描画するとき: サーバー側で `indexedDB` に触れて落ちない。工場関数は呼び出し時点で `indexedDB` に触れない (Task 4 のテスト)
4. 保存先に値が無い初回起動: 0 を表示する (Task 4, 5 の `get` が `undefined`、Task 7 で 0 になるテスト)
5. SQLite の DB ファイルがまだ無い状態で dev / E2E を起動: 移行を自動で当ててから起動し、エラーにならない (Task 8 の `predev` と Task 9 の webServer)

---

### Task 1: ツール導入と monorepo の骨組み

**Files:**
- Create: `docs/setup/01-toolchain.md`, `docs/setup/03-monorepo.md`
- Create: `.nvmrc`, `.envrc`, `.gitignore`, `package.json`, `bunfig.toml`, `tsconfig.base.json`, `turbo.json`, `README.md`

**Interfaces:**
- Produces: ルート `package.json` (`"private": true`, `"workspaces": ["apps/*", "packages/*"]`, `packageManager`)。`tsconfig.base.json` (strict、`moduleResolution: "bundler"`、`jsx: "react-jsx"`)。turbo タスク `typecheck` / `test` / `dev` / `build`。後続の各パッケージは `"typecheck": "bun check"`、`"test": "bun test"` を持つ

- [ ] **Step 1: `docs/setup/01-toolchain.md` を書く**

内容: `nvm install 26.13.1`、`.nvmrc` 作成、`.envrc` (`export NODE_VERSIONS="$HOME/.nvm/versions/node"`、`export NODE_VERSION_PREFIX="v"`、`use node`) 作成、`direnv allow`、bun 1.4.4 の確認 (`bun --version`、`bun lint --help`)。brew で入れるもの (direnv / lefthook / atlas が無ければ `brew install`)

- [ ] **Step 2: 手順書のコマンドを流し、版を確かめる**

Run: `direnv exec . node -v && bun --version`
Expected: `v26.13.1` と `1.4.4` 系

- [ ] **Step 3: `docs/setup/03-monorepo.md` を書き、コマンドを流す**

`package.json` (heredoc で骨組み、以後の追記は jq)、`bunfig.toml` (この時点では空でよい)、`tsconfig.base.json`、`turbo.json`、`.gitignore` (`node_modules`、`.next`、`.turbo`、`storybook-static`、`docs/api`、`playwright-report`、`test-results`、`apps/counter-sqlite-app/data`)、`README.md` (`docs/setup/` への案内だけ)

- [ ] **Step 4: 確かめる**

Run: `bun install && bunx turbo run typecheck`
Expected: どちらも exit 0 (パッケージが無いので turbo は 0 タスク)

- [ ] **Step 5: Commit** (`chore: Node 26 と bun の monorepo 骨組みを追加`)

---

### Task 2: 公式スキル

**Files:**
- Create: `docs/setup/02-skills.md`
- Create: スキルの導入で生成されるファイル (`.claude/` 配下、`skills` CLI の lock ファイル等)

**Interfaces:**
- Produces: 以降のタスクで使える Turborepo / Next.js / Playwright / Storybook / shadcn/ui / Atlas のスキル

- [ ] **Step 1: `docs/setup/02-skills.md` を書く** (spec「公式スキル」の表の 6 コマンド。プロジェクトスコープで入れる。playwright は `bunx @playwright/cli install --skills`)

- [ ] **Step 2: コマンドを流す**

Run: 手順書の 6 コマンド
Expected: それぞれ成功。`claude plugin` の 2 つが対話を求める場合は、人に `! <command>` で打ってもらう

- [ ] **Step 3: 確かめる**

Run: `ls .claude/skills && claude plugin list`
Expected: turborepo / next.js 系 / playwright / shadcn のスキルと、storybook / atlas のプラグインが見える

- [ ] **Step 4: Commit** (`chore: 公式スキルを導入`)

---

### Task 3: 品質ツール (lint / fmt / スペル / TypeDoc / lefthook)

**Files:**
- Create: `docs/setup/04-quality.md`
- Create: `eslint.config.mjs`, `cspell.json`, `project-words.txt`, `typedoc.json`, `lefthook.yml`
- Modify: `bunfig.toml`, `package.json` (scripts と devDependencies)

**Interfaces:**
- Produces: ルートスクリプト `lint`、`fmt`、`fmt:check`、`spell`、`typecheck`、`test`、`docs:api`。eslint の要素型 `app` (`apps/*`)、`counter`、`ui` (`packages/ui-components`)、`datastore` (`packages/datastore-*`)、`database`

- [ ] **Step 1: eslint の実行方法を決める試験をする**

eslint-plugin-boundaries、eslint-plugin-jsdoc、typescript-eslint、eslint-import-resolver-typescript を devDependencies に入れ、`eslint.config.mjs` を書く。
Run: `bun lint --no-script --plugin eslint-plugin-boundaries --plugin eslint-plugin-jsdoc .` で 2 プラグインのルールが効くか (違反を含む一時ファイルで確認)
Expected: 効けば `lint` は `bun lint --no-script` 1 本、効かなければ `bun lint --no-script && eslint .`。結果を手順書に書く (どちらを採ったかだけ。経緯は書かない)

- [ ] **Step 2: `bunfig.toml` の `[lint]` と `[fmt]` を書く**

`"max-lines" = ["error", { max = 300, skipBlankLines = true, skipComments = true }]`、`"max-lines-per-function" = ["error", { max = 100, skipBlankLines = true, skipComments = true }]`

- [ ] **Step 3: 行数制限が効くことを確かめる**

Run: 空行とコメントを除いて 301 行ある一時ファイル `tmp-max-lines.ts` を作って `bun lint --no-script tmp-max-lines.ts`。続けて、コード 300 行 + 空行 50 行 + コメント 50 行のファイルで同じことをする
Expected: 1 つ目は `max-lines` で exit 1、2 つ目は exit 0。一時ファイルを消す

- [ ] **Step 4: `eslint.config.mjs` を仕上げる**

boundaries: spec「依存の向き」の表どおりに `default: "disallow"` で許可を並べる。import の解決には eslint-import-resolver-typescript を使う。jsdoc: `jsdoc/require-jsdoc` を `publicOnly: true` で、関数・クラス・`TSTypeAliasDeclaration`・`TSInterfaceDeclaration`・export された `VariableDeclaration` に効かせる。`packages/ui-components/src/components/ui/**` (shadcn の生成物) は jsdoc の対象外

- [ ] **Step 5: CSpell / TypeDoc / lefthook を書く**

`cspell.json` (language `en`、`project-words.txt` を辞書として参照、`node_modules` / `.next` / `bun.lock` / `docs/api` / `*.svg` を除外)。`typedoc.json` (`entryPointStrategy: "packages"`、`entryPoints: ["packages/*"]`、`out: "docs/api"`)。`lefthook.yml`:

```yaml
pre-commit:
  parallel: true
  commands:
    fmt:
      run: bun fmt --no-script --staged
    lint:
      glob: "*.{ts,tsx,js,mjs}"
      run: bun lint --no-script {staged_files}
    spell:
      run: bunx cspell --no-progress --no-must-find-files {staged_files}
pre-push:
  commands:
    check:
      run: bun run typecheck && bun run test
```

(Step 1 で eslint CLI が要ると決まったら pre-commit に `eslint {staged_files}` を足す。`lefthook install` も手順書に入れる)

- [ ] **Step 6: 確かめる**

Run: `bun run lint && bun run fmt:check && bun run spell`
Expected: すべて exit 0
Run: 綴りを誤った語 (`recieve`) を含むファイルを stage して `lefthook run pre-commit`
Expected: spell で exit 1。ファイルを消して unstage する

- [ ] **Step 7: Commit** (`chore: lint・fmt・スペルチェック・TypeDoc・lefthook を設定`)

---

### Task 4: datastore-memory と datastore-indexed-db

**Files:**
- Create: `packages/datastore-memory/{package.json,tsconfig.json,src/index.ts,src/index.test.ts}`
- Create: `packages/datastore-indexed-db/{package.json,tsconfig.json,src/index.ts,src/index.test.ts}`
- Create: `docs/setup/05-shared-packages.md` (この 2 つの工場関数の形を要所として書く。以後のタスクで追記する)

**Interfaces:**
- Produces:
  - `export type KeyValueStore<T> = { get(): Promise<T | undefined>; set(value: T): Promise<void> }` を各パッケージが自分で export する (共有の型パッケージは作らない)
  - `@app/datastore-memory`: `createMemoryStore<T>(key: string): KeyValueStore<T>`
  - `@app/datastore-indexed-db`: `createIndexedDbStore<T>(key: string): KeyValueStore<T>` (idb-keyval の `get` / `set`。値は構造化複製でそのまま保存するので JSON 化しない)

- [ ] **Step 1: 失敗するテストを書く**

```ts
// packages/datastore-memory/src/index.test.ts
test("未保存のキーは undefined を返す", async () => {
  expect(await createMemoryStore<number>("counter").get()).toBeUndefined();
});
test("set した値を get で返す", async () => {
  const store = createMemoryStore<number>("counter");
  await store.set(3);
  expect(await store.get()).toBe(3);
});
```

```ts
// packages/datastore-indexed-db/src/index.test.ts (先頭で import "fake-indexeddb/auto" を使うテストと、使わないテストをファイルで分けてよい)
test("indexedDB が無い環境でも工場関数の呼び出しでは例外を出さない", () => {
  expect(() => createIndexedDbStore<number>("counter")).not.toThrow();
});
test("未保存のキーは undefined を返す", async () => { /* fake-indexeddb 上で */ });
test("set した値を get で返し、別に作ったストアからも読める", async () => {
  await createIndexedDbStore<number>("counter").set(5);
  expect(await createIndexedDbStore<number>("counter").get()).toBe(5);
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `bun test packages/datastore-memory packages/datastore-indexed-db`
Expected: FAIL (`createMemoryStore` / `createIndexedDbStore` が無い)

- [ ] **Step 3: 2 つの工場関数を実装する** (memory は closure の変数 1 つ。indexed-db は idb-keyval に委ねる。idb-keyval は初回の get/set まで `indexedDB` に触れない)

- [ ] **Step 4: 通ることを確かめる**

Run: `bunx turbo run test typecheck --filter=@app/datastore-*` と `bun run lint`
Expected: PASS、exit 0

- [ ] **Step 5: 手順書に要所を書き、Commit** (`feat: メモリと IndexedDB の datastore を追加`)

---

### Task 5: database (Kysely + node:sqlite + Atlas) と datastore-sqlite

**Files:**
- Create: `packages/database/{package.json,tsconfig.json,atlas.hcl,schema.sql,migrations/,src/index.ts,src/node-sqlite-adapter.ts,src/index.test.ts}`
- Create: `packages/datastore-sqlite/{package.json,tsconfig.json,src/index.ts,src/index.test.ts}`
- Modify: `docs/setup/05-shared-packages.md` (Atlas の設定と移行コマンドは省略なし。変換と工場関数は要所)

**Interfaces:**
- Produces:
  - `@app/database`: `type KvTable = { key: string; value: string }`、`type Database = { kv: KvTable }`、`createDatabase(filename: string): Kysely<Database>`
  - `packages/database/schema.sql`: `CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);`
  - スクリプト `migrate:diff` (`atlas migrate diff --env local`)、`migrate:apply` (`mkdir -p ../../apps/counter-sqlite-app/data && atlas migrate apply --env local`)
  - `atlas.hcl` の env `local`: `src = "file://schema.sql"`、`dev = "sqlite://dev?mode=memory"`、`migration { dir = "file://migrations" }`、`url = "sqlite://../../apps/counter-sqlite-app/data/counter.db"`
  - `@app/datastore-sqlite`: `KeyValueStore<T>` (Task 4 と同じ形を自分で export)、`createSqliteStore<T>(db: Kysely<Database>, key: string): KeyValueStore<T>` (値は `JSON.stringify` / `JSON.parse`、set は `onConflict` で upsert)

- [ ] **Step 1: 失敗するテストを書く**

```ts
// packages/database/src/index.test.ts
test("node:sqlite 経由で Kysely のクエリが通る", async () => {
  const db = createDatabase(":memory:");
  const r = await sql<{ x: number }>`select 1 as x`.execute(db);
  expect(r.rows).toEqual([{ x: 1 }]);
});
```

```ts
// packages/datastore-sqlite/src/index.test.ts (各テストで :memory: の DB を作り、schema.sql を sql.raw で流す)
test("未保存のキーは undefined を返す", ...);
test("set した値を get で返す", async () => { await store.set(7); expect(await store.get()).toBe(7); });
test("2 回 set すると後の値で上書きされ、行は 1 つ", async () => {
  await store.set(1); await store.set(2);
  expect(await store.get()).toBe(2);
  expect((await db.selectFrom("kv").selectAll().execute()).length).toBe(1);
});
```

- [ ] **Step 2: 失敗を確かめる** (Run: `bun test packages/database packages/datastore-sqlite`、Expected: FAIL)

- [ ] **Step 3: `node:sqlite` の変換を実装する**

`src/node-sqlite-adapter.ts` に `toKyselySqlite(db: DatabaseSync): SqliteDatabase`。`prepare(sql)` が返す文は `reader = stmt.columns().length > 0`、`all(params) => stmt.all(...params)`、`run(params)` は `{ changes, lastInsertRowid }`、`iterate(params) => stmt.iterate(...params)`。`createDatabase` は `new Kysely({ dialect: new SqliteDialect({ database: toKyselySqlite(new DatabaseSync(filename)) }) })`

- [ ] **Step 4: `createSqliteStore` を実装する**

- [ ] **Step 5: 通ることを確かめる** (Run: `bunx turbo run test typecheck --filter=@app/database --filter=@app/datastore-sqlite && bun run lint`、Expected: PASS)

- [ ] **Step 6: Atlas の移行を作って当てる**

Run: `cd packages/database && bun run migrate:diff init && bun run migrate:apply`
Expected: `migrations/` に SQL と `atlas.sum` ができ、`apps/counter-sqlite-app/data/counter.db` に `kv` テーブルができる (`sqlite3` が無ければ `bun -e` で確認)

- [ ] **Step 7: 手順書を書き、Commit** (`feat: Kysely と Atlas の database と SQLite の datastore を追加`)

---

### Task 6: ui-components と Storybook

**Files:**
- Create: `packages/ui-components/{package.json,tsconfig.json,components.json,src/index.ts,src/lib/utils.ts,src/styles.css,src/seven-segment.ts,src/seven-segment.test.ts,src/SevenSegmentDisplay.tsx,src/SevenSegmentDisplay.stories.tsx}`
- Create (生成): `packages/ui-components/src/components/ui/button.tsx` (`bunx shadcn add button`)
- Create: `.storybook/main.ts`, `.storybook/preview.ts`
- Modify: `package.json` (scripts `storybook`、`storybook:build`)、`docs/setup/05-shared-packages.md`

**Interfaces:**
- Produces:
  - `formatSegments(value: number, minDigits?: number): { text: string; ghost: string }` (`minDigits` の既定は 4)
  - `SevenSegmentDisplay(props: { value: number; minDigits?: number })`: `<output aria-label="カウンター" data-value={value}>`。DSEG7 で `text` を表示し、`ghost` (同じ桁数の "8") を薄く重ねる。ghost は `aria-hidden`
  - `Button` (shadcn)
  - `@app/ui-components/styles.css`: `@import "tailwindcss"`、`@source` で `packages/ui-components/src` と `packages/counter/src` を対象にする、shadcn のテーマ変数、DSEG7 の `@font-face`。apps と Storybook はこれだけを読む

- [ ] **Step 1: 失敗するテストを書く**

```ts
test("4 桁にゼロ埋めし、ghost は同じ桁数の 8", () => {
  expect(formatSegments(3)).toEqual({ text: "0003", ghost: "8888" });
});
test("桁あふれは切らずに桁を増やす", () => {
  expect(formatSegments(12345)).toEqual({ text: "12345", ghost: "88888" });
});
```

- [ ] **Step 2: 失敗を確かめる** (Run: `bun test packages/ui-components`、Expected: FAIL)

- [ ] **Step 3: `formatSegments` を実装し、テストを通す**

- [ ] **Step 4: `components.json` と `src/lib/utils.ts` を手書きし、`bunx shadcn add button` を流す** (生成物はそのままコミット。追加された依存も含める)

- [ ] **Step 5: `styles.css` と `SevenSegmentDisplay` を書く** (DSEG7 は `bun add dseg`。woff2 の配信方法は実装者が決め、Next.js と Storybook の両方で表示できることを優先する)

- [ ] **Step 6: Storybook を手書きで設定する** (`@storybook/react-vite` と `@tailwindcss/vite`。`stories: ["../packages/*/src/**/*.stories.tsx"]`。preview で `@app/ui-components/styles.css` を読む)

- [ ] **Step 7: 確かめる**

Run: `bun run storybook:build && bunx turbo run test typecheck --filter=@app/ui-components && bun run lint && bun run spell`
Expected: すべて exit 0

- [ ] **Step 8: 手順書を書き (Storybook と shadcn の設定は省略なし)、Commit** (`feat: 7 セグメント表示と Button の ui-components、Storybook を追加`)

---

### Task 7: counter (保存先の型・ストア・Template) と依存の向きの検証

**Files:**
- Create: `packages/counter/{package.json,tsconfig.json,src/index.ts,src/counter-store.ts,src/counter-store.test.ts,src/CounterTemplate.tsx,src/CounterTemplate.stories.tsx}`
- Modify: `docs/setup/05-shared-packages.md` (`CounterStore` の型と `createCounterStore` の形、依存の向きの eslint 設定)

**Interfaces:**
- Consumes: `SevenSegmentDisplay`、`Button` (Task 6)
- Produces:
  - `type CounterStore = { get(): Promise<number | undefined>; set(value: number): Promise<void> }`
  - `type CounterState = { value: number; ready: boolean; load(): Promise<void>; increment(): Promise<void>; reset(): Promise<void> }`
  - `createCounterStore(store: CounterStore): StoreApi<CounterState>` (`zustand/vanilla` の `createStore`)
  - `CounterTemplate(props: { store: CounterStore })` (`"use client"`。`useState` で一度だけ `createCounterStore` し、`useEffect` で `load()`。`ready` が false の間は [+1] と [リセット] を `disabled`)。ボタンの名前は `+1` と `リセット`

- [ ] **Step 1: 失敗するテストを書く**

```ts
// fake: get/set を記録する CounterStore をテスト内で作る (datastore-* は import しない)
test("保存値が無ければ load 後は 0 で ready", async () => { /* get が undefined */ expect(s.getState()).toMatchObject({ value: 0, ready: true }); });
test("保存値 5 を load で読み込む", ...);
test("load 前は ready が false", () => { expect(createCounterStore(fake).getState().ready).toBe(false); });
test("increment は値を 1 増やし、その値で set を呼ぶ", async () => { /* value 6、set に 6 */ });
test("reset は 0 にし、0 で set を呼ぶ", ...);
test("ready でない間の increment は何もしない", async () => { /* value 0 のまま、set は呼ばれない */ });
```

- [ ] **Step 2: 失敗を確かめる** (Run: `bun test packages/counter`、Expected: FAIL)

- [ ] **Step 3: `createCounterStore` を実装し、テストを通す**

- [ ] **Step 4: `CounterTemplate` と、その story (テスト内と同じ形の fake store を story ファイル内に置く) を書く**

- [ ] **Step 5: 依存の向きが lint で落ちることを確かめる**

Run: `packages/datastore-memory/src/violation.ts` に `import "@app/counter";` を書いて `bun run lint`。続けて `packages/counter/src/violation.ts` に `import "@app/datastore-memory";` を書いて `bun run lint`
Expected: どちらも boundaries のルールで exit 1。一時ファイルを消すと exit 0

- [ ] **Step 6: 確かめる** (Run: `bunx turbo run test typecheck --filter=@app/counter && bun run storybook:build && bun run lint`、Expected: exit 0)

- [ ] **Step 7: 手順書に要所を書き、Commit** (`feat: counter のストアと Template を追加`)

---

### Task 8: 3 つのアプリ (注入)

**Files:**
- Create (各アプリ共通): `apps/<name>/{package.json,tsconfig.json,next.config.ts,postcss.config.mjs,next-env.d.ts,app/layout.tsx,app/globals.css,app/page.tsx}`
- Create: `apps/counter-indexed-db-app/app/counter.tsx`、`apps/counter-memory-app/app/counter.tsx` (`"use client"`。工場関数でストアを作って `CounterTemplate` に渡す)
- Create: `apps/counter-sqlite-app/app/actions.ts` (`"use server"` と `import "server-only"`。`getCounter(): Promise<number | undefined>` と `setCounter(value: number): Promise<void>`。DB は `createDatabase(path.join(process.cwd(), "data/counter.db"))` をモジュール内で 1 度だけ作る)
- Create: `docs/setup/06-apps.md`

**Interfaces:**
- Consumes: `createMemoryStore` / `createIndexedDbStore` (Task 4)、`createSqliteStore`・`createDatabase` (Task 5)、`CounterTemplate`・`CounterStore` (Task 7)、`@app/ui-components/styles.css` (Task 6)
- Produces: ポート 3001 / 3002 / 3003 で動くアプリ。各アプリのスクリプト `dev` (`next dev --port <port>`)、`build`、`start`、`typecheck`。counter-sqlite-app は `predev` と `prebuild` で `bun run --filter @app/database migrate:apply`

- [ ] **Step 1: 1 本目 (memory) を手書きする** (`globals.css` は `@import "@app/ui-components/styles.css";` の 1 行。`next.config.ts` は `transpilePackages` に `@app/*` の使うものを列挙)

- [ ] **Step 2: 確かめる**

Run: `bunx turbo run build --filter=@app/counter-memory-app`
Expected: exit 0

- [ ] **Step 3: indexed-db 版を作り、`build` が通ることを確かめる**

- [ ] **Step 4: sqlite 版を作る** (page.tsx はサーバーコンポーネントで `<CounterTemplate store={{ get: getCounter, set: setCounter }} />`)

- [ ] **Step 5: DB ファイルが無い状態から起動できることを確かめる**

Run: `rm -rf apps/counter-sqlite-app/data && bunx turbo run build --filter=@app/counter-sqlite-app`
Expected: exit 0 で、`data/counter.db` ができる

- [ ] **Step 6: 全体を確かめる** (Run: `bun run typecheck && bun run lint && bun run spell`、Expected: exit 0)

- [ ] **Step 7: 手順書 `06-apps.md` を書く** (Next.js の設定ファイルは省略なし。注入箇所 `counter.tsx` / `actions.ts` / `page.tsx` は要所として載せる)

- [ ] **Step 8: Commit** (アプリごとに分けて 3 コミット。`feat: メモリ版のカウンターアプリを追加` など)

---

### Task 9: Playwright の E2E と仕上げ

**Files:**
- Create: `playwright.config.ts`, `e2e/counter.spec.ts`, `docs/setup/07-tests.md`
- Modify: `package.json` (script `e2e`)、`.gitignore`、`project-words.txt`

**Interfaces:**
- Consumes: 3 アプリのポートと `dev` スクリプト (Task 8)、`aria-label="カウンター"` と `data-value` (Task 6)、ボタン名 `+1` / `リセット` (Task 7)
- Produces: `bun run e2e` (`playwright test`)。webServer は 3 アプリを `bun run --cwd apps/<name> dev` で起動し、ポートで待つ

- [ ] **Step 1: E2E を書く**

```ts
const apps = [
  { name: "indexed-db", url: "http://localhost:3001", persists: true },
  { name: "memory", url: "http://localhost:3002", persists: false },
  { name: "sqlite", url: "http://localhost:3003", persists: true },
];
for (const app of apps) {
  test.describe(app.name, () => {
    test.beforeEach(/* goto、リセットを押して data-value "0" を待つ */);
    test("+1 を 3 回で 3、リセットで 0", ...);       // data-value "3" → "0"
    test("再読込後の値", ...);                       // +1 を 2 回 → reload → persists ? "2" : "0"
    test("素早く 10 回押してすぐ再読込", ...);       // click を await なしで 10 回 → data-value "10" を待つ → reload → persists ? "10" : "0"
  });
}
```

(sqlite 版は DB をアプリ間で共有するので `test.describe.configure({ mode: "serial" })` を使う)

- [ ] **Step 2: 走らせる**

Run: `bunx playwright install chromium && rm -rf apps/counter-sqlite-app/data && bun run e2e`
Expected: 9 テスト PASS

- [ ] **Step 3: 全チェックを通す**

Run: `bun run lint && bun run fmt:check && bun run spell && bun run typecheck && bun run test && bun run storybook:build && bun run docs:api`
Expected: すべて exit 0、`docs/api/` に `@app/counter` などのページができる

- [ ] **Step 4: 手順書を通しで点検する**

Run: `git ls-files | grep -vE '^(apps|packages)/.*/src/|^apps/.*/app/|^e2e/|^docs/superpowers/|^akapen/'` の各ファイルが、`docs/setup/*.md` のどこかのコマンドで作られていることを確かめる。手順書を `grep -n '—\|–' docs/setup/*.md` で検査する
Expected: 漏れなし、ダッシュ 0 件

- [ ] **Step 5: Commit** (`test: 3 アプリの E2E を追加`、手順書の修正は `docs: 手順書を点検して修正` で分ける)
