# 04 品質ツール

lint、fmt、スペルチェック、API ドキュメント、git フックを設定する。

## 依存を入れる

```bash
bun add -d eslint-plugin-boundaries eslint-plugin-jsdoc eslint-import-resolver-typescript cspell typedoc
```

lefthook と gitleaks は 01 の工程で brew から入れてある。

## bunfig.toml

lint と fmt の設定はすべて `bunfig.toml` に置き、`eslint.config.*` は作らない。`eslint.config.*` があると `bun lint` は ESLint と同じく設定に書いたルールだけを動かし、組み込みの既定ルールを使わなくなるため。

`[install]` の `linker = "isolated"` で、各パッケージの依存をそのパッケージの `node_modules` に置く。ui-components の `styles.css` は DSEG7 のフォントを `../node_modules/dseg` の相対パスで指すので、この配置に頼る。

### lint

既定で ESLint と typescript-eslint の推奨ルール、React の `rules-of-hooks` と `exhaustive-deps` が動く。そのうえで次を足す。

- `typeAware = true` で、typescript-eslint の型を使う推奨ルール (`no-floating-promises`、`require-await` など) を動かす。型は `bun check` から取る
- `[lint.categories]` の `correctness` を error にする。誤りがほぼ確実なコードを報告するルールの組で、jsx-a11y と Next.js (`@next/next`) のルールも含む。Next.js のルールは `next` を依存に持つ apps だけに掛かる
- `maxWarnings = 0` で、未使用の変数などの警告も失敗にする
- 1 ファイル 300 行、1 関数 100 行。空行とコメントは数えない

`ignorePatterns` には、取り込んだスキル、作業メモ、設計書のように検査しないファイルを並べる。Storybook のビルド出力 `storybook-static/` と各アプリの Next.js のビルド出力 `.next/` は `.gitignore` にあっても `bun lint` が読むので、ここにも並べる。

ESLint のプラグインは 2 つだけを `plugins` で読む。

eslint-plugin-boundaries で、パッケージ間の import を次の表の向きだけに絞る。表に無い向きは error になる。`@app/*` の import 先は eslint-import-resolver-typescript が `tsconfig.base.json` の `paths` で解決する。

| from                                                            | 許可する import 先                       |
| --------------------------------------------------------------- | ---------------------------------------- |
| `app` (`apps/*`)                                                | `counter`, `ui`, `datastore`, `database` |
| `counter` (`packages/counter`)                                  | `ui`                                     |
| `datastore` のうち `packages/datastore-sqlite`                  | `database`                               |
| `ui` (`packages/ui-components`)、ほかの `datastore`、`database` | なし                                     |

同じパッケージの中の相対 import と、外部ライブラリの import は対象にならない。

eslint-plugin-jsdoc で、export した関数、クラス、型、インターフェース、enum、変数、default export のアロー関数とオブジェクトに JSDoc を必須にする。`export { f }` で後から export した関数も対象になる。`export { x }` や `export default x` で後から export した関数以外の値は、プラグインが export を判定できないので対象にならない。`packages/ui-components/src/components/ui` は `bunx shadcn add` が生成するファイル、`*.config.*` と `.storybook/` はツールの設定ファイルなので、`[[lint.overrides]]` で対象から外す。

### fmt

- `sortImports` で import を並べ替え、標準ライブラリ、外部パッケージ、`@app/*`、相対パスの順にグループを分ける
- `sortTailwindcss` で `className` と `cn` などに渡した Tailwind のクラスを並べ替える。並び順は `stylesheet` の Tailwind の設定から決まる
- `sortPackageJson` で package.json のキーを並べ替える

```bash
cat <<'EOF' > bunfig.toml
[install]
linker = "isolated"

[lint]
plugins = ["boundaries", "jsdoc"]
typeAware = true
maxWarnings = 0
ignorePatterns = [
  ".claude/",
  ".superpowers/",
  "akapen/",
  "storybook-static/",
  "**/.next/",
]

[lint.categories]
correctness = "error"

[lint.settings."import/resolver".typescript]
project = "tsconfig.base.json"

[[lint.settings."boundaries/elements"]]
type = "app"
pattern = "apps/*"

[[lint.settings."boundaries/elements"]]
type = "counter"
pattern = "packages/counter"

[[lint.settings."boundaries/elements"]]
type = "ui"
pattern = "packages/ui-components"

[[lint.settings."boundaries/elements"]]
type = "datastore"
pattern = "packages/datastore-*"
capture = ["name"]

[[lint.settings."boundaries/elements"]]
type = "database"
pattern = "packages/database"

[lint.rules]
"max-lines" = [
  "error",
  { max = 300, skipBlankLines = true, skipComments = true },
]
"max-lines-per-function" = [
  "error",
  { max = 100, skipBlankLines = true, skipComments = true },
]
"boundaries/dependencies" = [
  "error",
  { default = "disallow", policies = [
    { from = { element = { type = "app" } }, allow = { to = { element = { types = ["counter", "ui", "datastore", "database"] } } } },
    { from = { element = { type = "counter" } }, allow = { to = { element = { type = "ui" } } } },
    { from = { element = { type = "datastore", captured = { name = "sqlite" } } }, allow = { to = { element = { type = "database" } } } },
  ] },
]
"jsdoc/require-jsdoc" = [
  "error",
  { publicOnly = true, require = { FunctionDeclaration = true, ClassDeclaration = true, ArrowFunctionExpression = true, FunctionExpression = true }, contexts = ["TSTypeAliasDeclaration", "TSInterfaceDeclaration", "TSEnumDeclaration", "VariableDeclarator", "ExportDefaultDeclaration > ObjectExpression"] },
]

[[lint.overrides]]
files = [
  "packages/ui-components/src/components/ui/**",
  "*.config.{js,mjs,ts}",
  ".storybook/**",
]
rules = { "jsdoc/require-jsdoc" = "off" }

[fmt]
ignorePatterns = [
  ".claude/",
  ".superpowers/",
  "akapen/",
  "docs/superpowers/",
  "skills-lock.json",
]
sortPackageJson = true

[fmt.sortImports]
internalPattern = ["@app/"]

[fmt.sortTailwindcss]
stylesheet = "./packages/ui-components/src/styles.css"
EOF
```

## CSpell

`project-words.txt` にプロジェクトで使う固有名を 1 行 1 語で書く。英語の辞書に無い正しい語は、ここに足す。`.gitignore` にあるファイルは検査しない。

```bash
cat <<'EOF' > cspell.json
{
  "version": "0.2",
  "language": "en",
  "dictionaryDefinitions": [
    { "name": "project-words", "path": "./project-words.txt", "addWords": true }
  ],
  "dictionaries": ["project-words"],
  "useGitignore": true,
  "ignorePaths": [
    "node_modules",
    ".next",
    "bun.lock",
    "docs/api",
    "*.svg",
    ".claude",
    ".superpowers",
    "akapen",
    "docs/superpowers",
    "skills-lock.json",
    "LICENSE"
  ]
}
EOF
```

```bash
cat <<'EOF' > project-words.txt
akapen
ariga
bunfig
bunx
direnv
dseg
envrc
indexeddb
keyval
kysely
oklch
prebuild
predev
storybookjs
stylesheet
EOF
```

## TypeDoc

`packages/*` の公開 API を `docs/api` に出力する。`docs/api` は git 管理外にしてある。

```bash
cat <<'EOF' > typedoc.json
{
  "$schema": "https://typedoc.org/schema.json",
  "entryPointStrategy": "packages",
  "entryPoints": ["packages/*"],
  "out": "docs/api"
}
EOF
```

## gitleaks

gitleaks で、API キーやトークン、秘密鍵のような機密情報がコミットに入るのを止める。既定のルールをそのまま使い、設定ファイルは置かない。

誤検知は、`gitleaks git` が出す fingerprint (`コミット:ファイル:ルール:行`) を `.gitleaksignore` に書いて外す。`akapen/boilerplate-01.html` の下書き保存用のキー名 `DRAFT_KEY` は、文字列の形から `generic-api-key` と判定されるので外しておく。

```bash
cat <<'EOF' > .gitleaksignore
40375eda4c8ca0c3c9fd75caff9ed95fa1977342:akapen/boilerplate-01.html:generic-api-key:279
EOF
```

## lefthook

pre-commit はステージしたファイルだけを fmt、lint、スペルチェックにかけ、ステージした差分に機密情報が無いかを gitleaks で調べる。pre-push は turbo で型チェックと unit test を回し、gitleaks で全履歴を調べる。gitleaks の出力では `--redact` で見つけた値を伏せる。

```bash
cat <<'EOF' > lefthook.yml
pre-commit:
  parallel: true
  commands:
    fmt:
      run: bun fmt --no-script --staged
    lint:
      run: bun lint --no-script --staged
    spell:
      run: bunx cspell --no-progress --no-must-find-files {staged_files}
    secrets:
      run: gitleaks git --pre-commit --staged --redact --no-banner
pre-push:
  commands:
    check:
      run: bun run typecheck && bun run test
    secrets:
      run: bun run secrets
EOF
lefthook install
```

## package.json のスクリプト

`bun lint` と `bun fmt` は、package.json に同名のスクリプトがあるとそれを実行する。スクリプトが自分自身を呼ばないよう、`--no-script` を付ける。

```bash
jq '.scripts += {
  "lint": "bun lint --no-script",
  "fmt": "bun fmt --no-script",
  "fmt:check": "bun fmt --no-script --check",
  "spell": "cspell --no-progress .",
  "docs:api": "typedoc",
  "secrets": "gitleaks git --redact --no-banner"
}' package.json > package.json.tmp && mv package.json.tmp package.json
```

## 確認

```bash
bun run lint
bun run fmt:check
bun run spell
bun run secrets
```

どれも終了コード 0 で終わる。`bun run docs:api` は packages を作ったあとで使う。
