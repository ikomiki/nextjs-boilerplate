# Web アプリ開発ボイラープレート 設計

## 目的

macOS 上で、TurboRepo + bun の monorepo に Next.js アプリを載せるボイラープレートを作る。
目的は開発環境 (monorepo、品質ツール、依存の向きの強制、依存性注入の構造) を作ることで、カウンターアプリはその構造を通して確かめるための例題にすぎない。
環境構築の手順はすべてコマンドとしてドキュメントに残し、人が手で打てば同じ環境が再現できる状態にする。
例題のカウンターアプリは 3 本作り、「画面とロジックは共有し、保存先だけをアプリ側の注入で差し替える」設計を実際に通す。

## ゴール / 非ゴール / アンチゴール

- ゴール
  - `docs/setup/` の手順書どおりにコマンドを打つと、このリポジトリと同じ開発環境ができる (カウンターアプリの実装は除く)
  - lint・fmt・スペルチェック・型チェック・unit test・E2E が、lefthook とスクリプトから回る
  - パッケージ間の依存の向きが eslint で強制され、AI が逆向きの import を書くと lint で落ちる
- 非ゴール
  - デプロイ、CI、認証、本番 DB
- アンチゴール (動いても失敗とみなす)
  - 環境構築の部分で、手順書と実際のリポジトリがずれている (手順書に無い設定ファイルがある、手順書のコマンドで再現できない)
  - 生成コマンドの出力を大量にコミットし、何が必要で何が不要か分からない
  - 共有パッケージ (datastore-*, ui-components) がアプリ固有のパッケージ (counter) を import している

## 前提環境

- macOS。jq / git / nvm / brew は導入済み
- 確認済みの版: bun 1.4.4 (npm の latest、brew の stable と同じ。手元は 1.4.4-canary)、Node は nvm で v26.13.1 (LTS) を入れる (手元は v24.22.1)
- bun は `packageManager: "bun@1.4.4"` で固定し、手順書の最初で `bun --version` と `bun lint --help` が通ることを確かめる。lint・fmt・型チェックの工程は bun 1.4.4 の `lint` / `fmt` / `check` に依存する
- 冗長でない範囲で brew による追加導入を許す (gsed 等)。direnv / lefthook / atlas は導入済み

## 構成

```
apps/
  counter-indexed-db-app/   # IndexedDB に永続
  counter-memory-app/       # メモリ (再読込で 0)
  counter-sqlite-app/       # サーバー側 SQLite に永続 (Server Actions 経由)
packages/
  counter/                  # カウンターの Template・状態 (Zustand)・保存先の型
  ui-components/            # shadcn/ui の部品、7 セグメント数字表示
  datastore-indexed-db/     # idb-keyval で get/set
  datastore-memory/         # メモリで get/set
  datastore-sqlite/         # Kysely で get/set (サーバー専用)
  database/                 # Kysely クライアント・DB 型・Atlas のスキーマと移行
docs/setup/                 # 作成手順書 (工程ごとに分割)
```

- packages はフラットに並べる (人の決定)
- パッケージ名は `@app/<ディレクトリ名>`

### Atomic Design との対応

- apps = Pages。Next.js のルーティング、保存先の注入だけを持つ
- packages/counter = Templates とアプリ固有のロジック
- packages/ui-components = Atoms / Molecules (ボタン、数字表示)

### 依存の向き

eslint-plugin-boundaries で次だけを許し、それ以外の import を error にする。

| from | 許可する import 先 |
|---|---|
| apps/* | counter, ui-components, datastore-*, database |
| counter | ui-components |
| datastore-sqlite | database |
| ui-components / datastore-indexed-db / datastore-memory / database | なし (外部ライブラリのみ) |

- `server-only` は counter-sqlite-app の Server Actions のファイルだけで import する。packages 側に置くと `bun test` で読み込めないため

### 保存先の注入

- counter が、自分が必要とする保存先の型 (ポート) を宣言する。形は「非同期の get / set」
  - 例: `type CounterStore = { get(): Promise<number | undefined>; set(value: number): Promise<void> }`
- datastore-* は counter を知らない。各自がキーを束縛した工場関数を公開し、値はジェネリクス `T` で受け取る。保存の形は datastore ごとに違い、sqlite は JSON 文字列、indexed-db は構造化複製、memory は受け取った値をそのまま持つ
  - 例: `createMemoryStore<T>(key)` / `createIndexedDbStore<T>(key)` / `createSqliteStore<T>(db, key)` → `{ get(): Promise<T | undefined>; set(value: T): Promise<void> }`
  - 戻り値が `CounterStore` と同じ形になるので、アプリは `createXxxStore<number>("counter")` を渡すだけでよく、型の一致は TypeScript が構造的に検査する
- counter は `createCounterStore(store)` で Zustand ストアを作る。初回マウントで `get()`、+1 / リセットのたびに `set()`
- counter-sqlite-app は、datastore-sqlite を呼ぶ Server Actions を app 内に置き、その 2 関数を `CounterStore` として counter に渡す

### Kysely / Atlas (3 本目のアプリまで作る: 人の決定)

- DB は SQLite (Docker 不要)。DB ファイルは `apps/counter-sqlite-app` 配下に置き、git 管理外
- テーブルは汎用 key-value 1 つ (`kv(key TEXT PRIMARY KEY, value TEXT NOT NULL)`)。カウンターはキー 1 つを使う
- Atlas: `packages/database` にスキーマ (SQL) と移行ディレクトリを置き、`atlas migrate diff` / `atlas migrate apply` を使う。dev DB は SQLite のインメモリ
- Kysely の DB 型は手書きする (テーブル 1 つなので型生成ツールは入れない)
- ドライバは `node:sqlite` (Node 26 と bun の両方で動くことを確認済み)。Kysely 0.29.8 には専用 dialect が無いので、`SqliteDialect` が求める形 (`prepare` した文の `reader` / `all` / `run` / `iterate`) に合わせる薄い変換を `packages/database` に置く。native モジュールの better-sqlite3 は入れない

## UI

- 1 ページ。大きな 7 セグメント数字、[+1] ボタン、[リセット] ボタン (人の決定)
- 数字のフォントは DSEG7 (npm `dseg` 0.46.0、OFL-1.1)。消えているセグメントを薄く表示する
- Tailwind CSS v4 + shadcn/ui。shadcn の部品は `packages/ui-components` に置き、追加だけ `bunx shadcn add` を使う

## ツールと役割

| 用途 | ツール | 設定の置き場 |
|---|---|---|
| ランタイム (Next.js 実行) | Node 26 (direnv が `.nvmrc` を読んで切り替え) | `.nvmrc`, `.envrc` |
| パッケージ管理・test・型チェック | bun (`bun install` / `bun test` / `bun check`) | `bunfig.toml` |
| lint | `bun lint` (行数制限含む) + eslint (boundaries と jsdoc の 2 プラグインのみ) | `bunfig.toml`, `eslint.config.mjs` |
| fmt | `bun fmt` | `bunfig.toml` |
| タスク実行 | TurboRepo | `turbo.json` |
| スペルチェック | CSpell | `cspell.json`, `project-words.txt` |
| コンポーネント確認 | Storybook (リポジトリ直下に 1 つ。packages の `*.stories.tsx` を集める) | `.storybook/` |
| E2E | Playwright | `playwright.config.ts` (直下) |
| API ドキュメント | TypeDoc (packages の公開 API、出力は git 管理外) | `typedoc.json` |
| git フック | lefthook | `lefthook.yml` |

### lint の規則

- 1 ファイル 300 行、1 関数 100 行。空行とコメントは数えない (`bun lint` の `max-lines` / `max-lines-per-function`、`skipBlankLines` / `skipComments` を true)
- 公開関数・公開型・公開定数に日本語 JSDoc を必須にする (eslint-plugin-jsdoc)。それ以外のコメントは任意で、書くなら非自明な理由だけ
- package.json のスクリプトから呼ぶときは `bun lint --no-script` / `bun fmt --no-script` と書く (スクリプトが自分自身を呼ぶのを防ぐ)

### lefthook

- pre-commit (ステージしたファイルのみ): `bun fmt --staged`、`bun lint --staged`、eslint、cspell
- pre-push: turbo で型チェックと unit test

## テスト

- unit (`bun test`): counter のストア (+1、リセット、get/set の呼び出し)、datastore-memory、datastore-indexed-db、datastore-sqlite (インメモリ SQLite)
- E2E (Playwright): 3 アプリそれぞれで「+1 を 3 回 → 3」「リセット → 0」「再読込後、IndexedDB 版と SQLite 版は値が残り、メモリ版は 0」

## 手順書

- `docs/setup/NN-<工程>.md` に分割する。工程の順は、ツール導入 → 公式スキル → monorepo の骨組み → 品質ツール → 共有パッケージ → アプリ → テスト
- 新規ファイルは `cat <<'EOF' > path` (または echo のリダイレクト) で作る。既存 JSON (package.json 等) への追記は jq で行う
- 雛形は手書きを基本にし、生成コマンドは `bunx shadcn add` だけを使う (人の決定)
- 手順書は最新の手順だけを書き、経緯は書かない
- 環境構築 (ツール導入・monorepo・品質ツール・Storybook・Playwright・TypeDoc・lefthook・Atlas の設定) はコマンドを省略せずに書く
- カウンターアプリの部分は要所だけを書く。書くのは、counter が宣言する保存先の型、datastore-* の工場関数の形、アプリでの注入箇所、依存の向きの eslint 設定、Kysely と `node:sqlite` の変換、Atlas の移行手順。画面やストアの実装全文は載せず、リポジトリのファイルを参照させる

## 文章の規則 (ソースコードのコメントと全ドキュメント)

- humanizer の規則に従う。誇張語、三点並べ、太字見出し付きの箇条書き、ダッシュ (— と –)、前置きや締めの決まり文句を使わない
- 物事を今の姿で書き、変更の経緯や「〜を追加した」は書かない

## 公式スキル

ツール導入の次の工程で、プロジェクトスコープに入れてコミットする (以降の構築でスキルを使うため)。playwright-cli はこの工程で `bunx @playwright/cli` (npm 0.1.24 時点) から使う。

| 技術 | 入れ方 |
|---|---|
| Turborepo | `npx skills add vercel/turborepo --skill turborepo` |
| Next.js | `npx skills add vercel/next.js` |
| Playwright | `playwright-cli install --skills` |
| Storybook | `claude plugin marketplace add storybookjs/mcp` → `claude plugin install storybook@storybook` |
| shadcn/ui | `npx skills add shadcn/ui` |
| Atlas | `claude plugin marketplace add ariga/atlas` → `claude plugin install atlas@ariga` |

Bun / CSpell / TypeDoc / lefthook / Zustand / idb-keyval / Kysely / direnv / Tailwind CSS / ESLint には公式スキルが無い (2026-11-12 時点、各公式リポジトリで確認)。

## 実装者に任せること

- 各ライブラリの版 (手順書を書く時点の最新安定版で固定する)
- eslint を `bun lint` に読ませるか、eslint CLI を別に回すか (`bun lint --plugin` で 2 プラグインが動くかを最初に試し、動かなければ CLI)
- DSEG7 のフォントファイルの配信方法 (next/font/local か CSS の `@font-face`)
- Storybook の framework 選択、Turbo のタスク名と依存関係、各 tsconfig の継承構造
- 各アプリの dev サーバーのポート
