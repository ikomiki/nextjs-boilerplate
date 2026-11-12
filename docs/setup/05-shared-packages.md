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
