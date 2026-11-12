# 03 monorepo の骨組み

ルートに bun の workspaces と TurboRepo を置く。

## package.json

```bash
cat <<'EOF' > package.json
{
  "name": "nextjs-boilerplate",
  "private": true,
  "license": "MIT",
  "packageManager": "bun@1.4.4",
  "workspaces": ["apps/*", "packages/*"]
}
EOF
```

スクリプトは jq で足す。各パッケージの `typecheck` と `test` を turbo 経由で回す。

```bash
jq '.scripts = {
  "dev": "turbo run dev",
  "build": "turbo run build",
  "typecheck": "turbo run typecheck",
  "test": "turbo run test"
}' package.json > package.json.tmp && mv package.json.tmp package.json
```

## bunfig.toml

lint と fmt の設定は 04 の工程で書く。ここでは空のファイルだけ作る。

```bash
touch bunfig.toml
```

## tsconfig.base.json

各パッケージが継承する共通設定。`strict` に加えて、配列や索引アクセスの `undefined`、`override` の付け忘れ、値を返さない分岐、`switch` の fall through を型エラーにする。`verbatimModuleSyntax` で、型だけの import に `import type` を書かせる。

```bash
cat <<'EOF' > tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "paths": { "@app/*": ["./packages/*/src/index.ts"] }
  }
}
EOF
```

## turbo.json

各パッケージの tsconfig は `tsconfig.base.json` を継承するが、turbo はパッケージの外のファイルをハッシュに含めない。`globalDependencies` に入れて、変わったときにキャッシュを使わないようにする。

```bash
cat <<'EOF' > turbo.json
{
  "$schema": "https://turborepo.dev/schema.json",
  "globalDependencies": ["tsconfig.base.json"],
  "tasks": {
    "typecheck": {},
    "test": {},
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
EOF
```

turbo を入れる。

```bash
bun add -d turbo
```

## .gitignore

02 の工程で playwright-cli が足した `.playwright-cli/` の 2 行も含めて書き直す。

```bash
cat <<'EOF' > .gitignore
node_modules
.next
.turbo
storybook-static
docs/api
playwright-report
test-results
apps/counter-sqlite-app/data
# Playwright CLI output (may contain credentials)
.playwright-cli/
# スキルの実体は skills-lock.json と 02 の手順から復元する
.claude/skills/
.agents/
EOF
```

## README.md

```bash
cat <<'EOF' > README.md
# nextjs-boilerplate

TurboRepo と bun の monorepo に Next.js アプリを載せるボイラープレート。

環境の作り方は `docs/setup/` の手順書にコマンドで書いてある。番号の順に実行する。
EOF
```

## LICENSE

MIT ライセンスにする。年と著作権者は、実行した年と git の `user.name` から入れる。

```bash
cat <<EOF > LICENSE
MIT License

Copyright (c) $(date +%Y) $(git config user.name)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
```

## 確認

```bash
bun install
bunx turbo run typecheck
```

どちらも終了コード 0 で終わる。パッケージがまだ無いので、turbo が走らせるタスクは 0 件になる。
