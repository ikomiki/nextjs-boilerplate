# 01 ツール導入

Node、bun、direnv などの実行環境を用意する。macOS で jq、git、nvm、brew が入っていることを前提にする。

## Node

Next.js の実行には Node 26.13.1 (LTS) を使う。

```bash
source ~/.nvm/nvm.sh
nvm install 26.13.1
echo "26.13.1" > .nvmrc
```

direnv が `.nvmrc` の版へ切り替えるよう、`.envrc` を作る。

```bash
cat <<'EOF' > .envrc
export NODE_VERSIONS="$HOME/.nvm/versions/node"
export NODE_VERSION_PREFIX="v"
use node
EOF
direnv allow
```

確認する。

```bash
direnv exec . node -v
```

`v26.13.1` と出ればよい。

## bun

bun は 1.4.4 を使う。oven-sh の tap から版を固定して入れる。

```bash
brew install oven-sh/bun/bun@1.4.4
bun --version
bun lint --help
```

`bun --version` が `1.4.4` を出し、`bun lint --help` も通ることを確かめる。`bun lint` と `bun fmt`、`bun check` は 1.4.4 の機能に依存する。

## brew で入れるもの

無ければ入れる。

```bash
brew install direnv lefthook atlas gitleaks
```
