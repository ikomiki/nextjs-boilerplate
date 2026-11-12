# 03 monorepo の骨組み

ルートに bun の workspaces と TurboRepo を置く。

## package.json

```bash
cat <<'EOF' > package.json
{
  "name": "sports-score-system",
  "private": true,
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

各パッケージが継承する共通設定。

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
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  }
}
EOF
```

## turbo.json

```bash
cat <<'EOF' > turbo.json
{
  "$schema": "https://turborepo.dev/schema.json",
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
EOF
```

## README.md

```bash
cat <<'EOF' > README.md
# sports-score-system

TurboRepo と bun の monorepo に Next.js アプリを載せるボイラープレート。

環境の作り方は `docs/setup/` の手順書にコマンドで書いてある。番号の順に実行する。
EOF
```

## 確認

```bash
bun install
bunx turbo run typecheck
```

どちらも終了コード 0 で終わる。パッケージがまだ無いので、turbo が走らせるタスクは 0 件になる。
