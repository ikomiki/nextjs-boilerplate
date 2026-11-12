# 02 公式スキル

以降の構築で使う公式スキルを、プロジェクトスコープに入れる。`skills` CLI は `-a claude-code -y` で対話なしに流す。

git に入れるのは `skills-lock.json` と `.claude/settings.json` だけで、`.claude/skills/` の実体は 03 の `.gitignore` で除外する。clone した後は「clone 後の復元」の手順で実体を戻す。

## Turborepo、Next.js、shadcn/ui

```bash
npx skills add vercel/turborepo --skill turborepo -a claude-code -y
npx skills add vercel/next.js -a claude-code -y
npx skills add shadcn/ui -a claude-code -y
```

## Playwright

```bash
bunx @playwright/cli install --skills
```

## Storybook

```bash
claude plugin marketplace add storybookjs/mcp
claude plugin install storybook@storybook --scope project
```

## Atlas

```bash
claude plugin marketplace add ariga/atlas
claude plugin install atlas@ariga --scope project
```

## clone 後の復元

```bash
npx skills install -a claude-code
bunx @playwright/cli install --skills
```

playwright-cli のスキルは `skills-lock.json` に載らないので、2 行目で入れ直す。

## 確認

```bash
ls .claude/skills
claude plugin list
```

Bun、CSpell、TypeDoc、lefthook、Zustand、idb-keyval、Kysely、direnv、Tailwind CSS、ESLint には公式スキルが無い。
