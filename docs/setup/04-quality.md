# 04 品質ツール

lint、fmt、スペルチェック、API ドキュメント、git フックを設定する。

## 依存を入れる

```bash
bun add -d eslint-plugin-boundaries eslint-plugin-jsdoc typescript-eslint eslint-import-resolver-typescript cspell typedoc
```

lefthook は 01 の工程で brew から入れてある。

## bunfig.toml

`[install]` の `linker = "isolated"` で、各パッケージの依存をそのパッケージの `node_modules` に置く。ui-components の `styles.css` は DSEG7 のフォントを `../node_modules/dseg` の相対パスで指すので、この配置に頼る。

`bun lint` の組み込み規則で行数を制限する。1 ファイル 300 行、1 関数 100 行で、空行とコメントは数えない。`ignorePatterns` には、取り込んだスキル、作業メモ、設計書のように検査しないファイルを並べる。Storybook のビルド出力 `storybook-static/` と各アプリの Next.js のビルド出力 `.next/` は `.gitignore` にあっても `bun lint` が読むので、ここにも並べる。

fmt では次を有効にする。

- `sortImports` で import を並べ替え、標準ライブラリ、外部パッケージ、`@app/*`、相対パスの順にグループを分ける
- `sortTailwindcss` で `className` と `cn` などに渡した Tailwind のクラスを並べ替える。並び順は `stylesheet` の Tailwind の設定から決まる
- `sortPackageJson` で package.json のキーを並べ替える

```bash
cat <<'EOF' > bunfig.toml
[install]
linker = "isolated"

[lint]
ignorePatterns = [
  ".claude/",
  ".superpowers/",
  "akapen/",
  "storybook-static/",
  "**/.next/",
]

[lint.rules]
"max-lines" = [
  "error",
  { max = 300, skipBlankLines = true, skipComments = true },
]
"max-lines-per-function" = [
  "error",
  { max = 100, skipBlankLines = true, skipComments = true },
]

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

## eslint.config.mjs

`bun lint` は `bunfig.toml` の `[lint]` と `eslint.config.mjs` を両方読む。eslint のプラグインもこの設定から読み込むので、lint は `bun lint` だけを流せばよく、eslint の CLI は使わない。

eslint の設定に置くのは 2 つのプラグインだけにする。

eslint-plugin-boundaries で、パッケージ間の import を次の表の向きだけに絞る。表に無い向きは error になる。`@app/*` の import 先は eslint-import-resolver-typescript で解決する。

| from                                                            | 許可する import 先                       |
| --------------------------------------------------------------- | ---------------------------------------- |
| `app` (`apps/*`)                                                | `counter`, `ui`, `datastore`, `database` |
| `counter` (`packages/counter`)                                  | `ui`                                     |
| `datastore` のうち `packages/datastore-sqlite`                  | `database`                               |
| `ui` (`packages/ui-components`)、ほかの `datastore`、`database` | なし                                     |

同じパッケージの中の相対 import と、外部ライブラリの import は対象にならない。

eslint-plugin-jsdoc で、export した関数、クラス、型、インターフェース、enum、変数、default export のアロー関数とオブジェクトに JSDoc を必須にする。`export { f }` で後から export した関数も対象になる。`export { x }` や `export default x` で後から export した関数以外の値は、プラグインが export を判定できないので対象にならない。`packages/ui-components/src/components/ui` は `bunx shadcn add` が生成するファイル、`*.config.*` と `.storybook/` はツールの設定ファイルなので対象から外す。

```bash
cat <<'EOF' > eslint.config.mjs
import boundaries from "eslint-plugin-boundaries";
import jsdoc from "eslint-plugin-jsdoc";
import tseslint from "typescript-eslint";

export default [
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx}"],
    languageOptions: { parser: tseslint.parser },
    plugins: { boundaries },
    settings: {
      "import/resolver": { typescript: { project: "tsconfig.base.json" } },
      "boundaries/elements": [
        { type: "app", pattern: "apps/*" },
        { type: "counter", pattern: "packages/counter" },
        { type: "ui", pattern: "packages/ui-components" },
        {
          type: "datastore",
          pattern: "packages/datastore-*",
          capture: ["name"],
        },
        { type: "database", pattern: "packages/database" },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            {
              from: { element: { type: "app" } },
              allow: {
                to: {
                  element: {
                    types: ["counter", "ui", "datastore", "database"],
                  },
                },
              },
            },
            {
              from: { element: { type: "counter" } },
              allow: { to: { element: { type: "ui" } } },
            },
            {
              from: {
                element: { type: "datastore", captured: { name: "sqlite" } },
              },
              allow: { to: { element: { type: "database" } } },
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx}"],
    ignores: [
      "packages/ui-components/src/components/ui/**",
      "**/*.config.{js,mjs,ts}",
      ".storybook/**",
    ],
    plugins: { jsdoc },
    rules: {
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: true,
            FunctionExpression: true,
          },
          contexts: [
            "TSTypeAliasDeclaration",
            "TSInterfaceDeclaration",
            "TSEnumDeclaration",
            "VariableDeclarator",
            "ExportDefaultDeclaration > ObjectExpression",
          ],
        },
      ],
    },
  },
];
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
    "skills-lock.json"
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

## lefthook

pre-commit はステージしたファイルだけを fmt、lint、スペルチェックにかける。pre-push は turbo で型チェックと unit test を回す。

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
pre-push:
  commands:
    check:
      run: bun run typecheck && bun run test
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
  "docs:api": "typedoc"
}' package.json > package.json.tmp && mv package.json.tmp package.json
```

## 確認

```bash
bun run lint
bun run fmt:check
bun run spell
```

どれも終了コード 0 で終わる。`bun run docs:api` は packages を作ったあとで使う。
