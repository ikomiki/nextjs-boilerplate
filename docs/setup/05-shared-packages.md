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
cd packages/database
bun run migrate:diff init
bun run migrate:apply
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
