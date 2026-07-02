# プラグインバージョン自動バンプ + タグ付け Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `plugins/sd-tdd/**` に変更が入ってmainにマージされたら、3箇所のバージョン番号（plugin.json / package.json / marketplace.json）を自動でpatch+1し、コミット・pushし、`sd-tdd--vX.Y.Z` タグも自動で打つ。

**Architecture:** 素のNode.js（CommonJS、依存ゼロ）で書いたバンプスクリプトを、`push to main`（`plugins/sd-tdd/**`変更時のみ）をトリガーとするGitHub Actionsワークフローから呼び出す。スクリプトは「純粋なロジック（semverのpatchを1つ上げる／marketplaceエントリを差し替える）」と「ファイルIOを行うCLIオーケストレーション」を分離し、既存の `plugins/sd-tdd/scripts/coverage-check/` と同じ構成パターンに合わせる。

**Tech Stack:** Node.js組み込みの `node:test` / `node:assert/strict`（追加依存なし）、GitHub Actions。

## Global Constraints

- 新規npm依存を追加しない（既存 `scripts/coverage-check` と同じくNode組み込みモジュールのみ使用）
- CommonJS形式（`require`/`module.exports`）で統一する。既存コードベースの流儀に合わせる
- バージョンは `\d+\.\d+\.\d+` 形式のみサポートする（プレリリース/ビルドメタデータ非対応）。それ以外の形式なら例外を投げて失敗させる
- ファイルパスは常にリポジトリルートからの相対パスで固定する（このスクリプトはこのリポジトリ専用であり、汎用ツールとして設計しない）

---

### Task 1: バージョン文字列のpatchバンプ純関数

**Files:**
- Create: `.github/scripts/bump-plugin-version/version.js`
- Test: `.github/scripts/bump-plugin-version/version.test.js`

**Interfaces:**
- Produces: `bumpPatch(version: string): string` — `"0.1.0"` → `"0.1.1"`。`\d+\.\d+\.\d+` にマッチしない入力では `Error` をthrowする。

- [ ] **Step 1: 失敗するテストを書く**

`.github/scripts/bump-plugin-version/version.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { bumpPatch } = require('./version');

test('patchを1つ上げる', () => {
  assert.equal(bumpPatch('0.1.0'), '0.1.1');
});

test('patchが2桁以上でも正しく繰り上がる', () => {
  assert.equal(bumpPatch('1.2.9'), '1.2.10');
});

test('major/minorはそのまま維持する', () => {
  assert.equal(bumpPatch('3.4.5'), '3.4.6');
});

test('semver形式でない文字列はエラーを投げる', () => {
  assert.throws(() => bumpPatch('v1.2'), /Invalid version/);
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `node --test .github/scripts/bump-plugin-version/version.test.js`
Expected: FAIL（`./version` モジュールが存在しない、または `bumpPatch` が未定義というエラー）

- [ ] **Step 3: 最小実装を書く**

`.github/scripts/bump-plugin-version/version.js`:
```js
// .github/scripts/bump-plugin-version/version.js
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

function bumpPatch(version) {
  const match = version.match(SEMVER_RE);
  if (!match) {
    throw new Error(`Invalid version: "${version}" (expected "x.y.z")`);
  }
  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number(patch) + 1}`;
}

module.exports = { bumpPatch };
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `node --test .github/scripts/bump-plugin-version/version.test.js`
Expected: PASS（4件すべて成功）

- [ ] **Step 5: コミット**

```bash
git add .github/scripts/bump-plugin-version/version.js .github/scripts/bump-plugin-version/version.test.js
git commit -m "feat: バージョン文字列のpatchバンプ関数を追加"
```

---

### Task 2: marketplace.json内のプラグインエントリのバージョン差し替え純関数

**Files:**
- Create: `.github/scripts/bump-plugin-version/marketplace.js`
- Test: `.github/scripts/bump-plugin-version/marketplace.test.js`

**Interfaces:**
- Consumes: なし（Task 1とは独立）
- Produces: `setPluginVersion(marketplaceDoc: {plugins: Array<{name: string, version: string}>}, pluginName: string, newVersion: string): object` — `marketplaceDoc.plugins` の中から `name === pluginName` のエントリを探し `version` を上書きして同じオブジェクト参照を返す。該当エントリが無ければ `Error` をthrowする。

- [ ] **Step 1: 失敗するテストを書く**

`.github/scripts/bump-plugin-version/marketplace.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { setPluginVersion } = require('./marketplace');

test('該当プラグインのversionを上書きする', () => {
  const doc = {
    plugins: [
      { name: 'other-plugin', version: '2.0.0' },
      { name: 'sd-tdd', version: '0.1.0' },
    ],
  };
  const result = setPluginVersion(doc, 'sd-tdd', '0.1.1');
  assert.equal(result.plugins[1].version, '0.1.1');
  assert.equal(result.plugins[0].version, '2.0.0');
});

test('該当プラグインが見つからない場合はエラーを投げる', () => {
  const doc = { plugins: [{ name: 'other-plugin', version: '2.0.0' }] };
  assert.throws(() => setPluginVersion(doc, 'sd-tdd', '0.1.1'), /sd-tdd/);
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `node --test .github/scripts/bump-plugin-version/marketplace.test.js`
Expected: FAIL（`./marketplace` モジュールが存在しない）

- [ ] **Step 3: 最小実装を書く**

`.github/scripts/bump-plugin-version/marketplace.js`:
```js
// .github/scripts/bump-plugin-version/marketplace.js
function setPluginVersion(marketplaceDoc, pluginName, newVersion) {
  const entry = (marketplaceDoc.plugins || []).find((p) => p.name === pluginName);
  if (!entry) {
    throw new Error(`Plugin "${pluginName}" not found in marketplace.json`);
  }
  entry.version = newVersion;
  return marketplaceDoc;
}

module.exports = { setPluginVersion };
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `node --test .github/scripts/bump-plugin-version/marketplace.test.js`
Expected: PASS（2件すべて成功）

- [ ] **Step 5: コミット**

```bash
git add .github/scripts/bump-plugin-version/marketplace.js .github/scripts/bump-plugin-version/marketplace.test.js
git commit -m "feat: marketplace.jsonのプラグインバージョン差し替え関数を追加"
```

---

### Task 3: CLIオーケストレーション（3ファイルの読み書き）

**Files:**
- Create: `.github/scripts/bump-plugin-version/cli.js`

**Interfaces:**
- Consumes: `bumpPatch` (Task 1の `./version`)、`setPluginVersion` (Task 2の `./marketplace`)
- Produces: `main(): void` — 実行すると以下3ファイルを読み、`plugin.json`の`version`を起点にpatchを1つ上げて3ファイルへ書き戻し、新バージョンを標準出力へ出す。`process.env.GITHUB_OUTPUT` が設定されていればそのファイルに `version=X.Y.Z` を追記する。
  - `plugins/sd-tdd/.claude-plugin/plugin.json`
  - `plugins/sd-tdd/package.json`
  - `.claude-plugin/marketplace.json`（`plugins[].name === "sd-tdd"` のエントリ）

このタスクはファイルIOを直接行うオーケストレーション層のため、既存の `scripts/coverage-check/cli.js` の `main`/`fetchIssueBody` と同様に単体テストは書かない（`parseArgs`のような純関数部分がないため）。代わりにStep 2でリポジトリ実ファイルに対して実際に動かして目視確認し、確認後に変更を戻す。

- [ ] **Step 1: 実装を書く**

`.github/scripts/bump-plugin-version/cli.js`:
```js
#!/usr/bin/env node
// .github/scripts/bump-plugin-version/cli.js
const fs = require('node:fs');
const { bumpPatch } = require('./version');
const { setPluginVersion } = require('./marketplace');

const PLUGIN_JSON_PATH = 'plugins/sd-tdd/.claude-plugin/plugin.json';
const PACKAGE_JSON_PATH = 'plugins/sd-tdd/package.json';
const MARKETPLACE_JSON_PATH = '.claude-plugin/marketplace.json';
const PLUGIN_NAME = 'sd-tdd';

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(relPath, 'utf8'));
}

function writeJson(relPath, doc) {
  fs.writeFileSync(relPath, `${JSON.stringify(doc, null, 2)}\n`);
}

function main() {
  const pluginJson = readJson(PLUGIN_JSON_PATH);
  const packageJson = readJson(PACKAGE_JSON_PATH);
  const marketplaceJson = readJson(MARKETPLACE_JSON_PATH);

  const newVersion = bumpPatch(pluginJson.version);

  pluginJson.version = newVersion;
  packageJson.version = newVersion;
  setPluginVersion(marketplaceJson, PLUGIN_NAME, newVersion);

  writeJson(PLUGIN_JSON_PATH, pluginJson);
  writeJson(PACKAGE_JSON_PATH, packageJson);
  writeJson(MARKETPLACE_JSON_PATH, marketplaceJson);

  console.log(newVersion);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${newVersion}\n`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
```

- [ ] **Step 2: リポジトリルートで実際に動かして目視確認し、元に戻す**

Run: `node .github/scripts/bump-plugin-version/cli.js`
Expected: 標準出力に `0.1.1` が出る

続けて差分を確認:
Run: `git diff plugins/sd-tdd/.claude-plugin/plugin.json plugins/sd-tdd/package.json .claude-plugin/marketplace.json`
Expected: 3ファイルすべての `"version"` が `0.1.0` → `0.1.1` に変わっている

確認できたら元に戻す（このタスクではバージョンを実際に上げない。上がるのはワークフローが実際に動いたときのみ）:
Run: `git checkout -- plugins/sd-tdd/.claude-plugin/plugin.json plugins/sd-tdd/package.json .claude-plugin/marketplace.json`
Expected: `git status` で該当3ファイルの変更が消えている

- [ ] **Step 3: コミット**

```bash
git add .github/scripts/bump-plugin-version/cli.js
git commit -m "feat: バージョンバンプCLIオーケストレーションを追加"
```

---

### Task 4: GitHub Actionsワークフロー

**Files:**
- Create: `.github/workflows/bump-plugin-version.yml`

**Interfaces:**
- Consumes: Task 3の `node .github/scripts/bump-plugin-version/cli.js`（標準出力とGITHUB_OUTPUTでバージョン文字列を返す）

- [ ] **Step 1: ワークフローファイルを書く**

`.github/workflows/bump-plugin-version.yml`:
```yaml
name: Bump plugin version

on:
  push:
    branches: [main]
    paths:
      - 'plugins/sd-tdd/**'

permissions:
  contents: write

jobs:
  bump-version:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Bump version
        id: bump
        run: node .github/scripts/bump-plugin-version/cli.js

      - name: Commit version bump
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add plugins/sd-tdd/.claude-plugin/plugin.json plugins/sd-tdd/package.json .claude-plugin/marketplace.json
          git commit -m "chore: sd-tdd v${{ steps.bump.outputs.version }}"
          git push

      - name: Tag release
        run: |
          git tag "sd-tdd--v${{ steps.bump.outputs.version }}"
          git push origin "sd-tdd--v${{ steps.bump.outputs.version }}"
```

- [ ] **Step 2: YAML構文を検証する**

Run: `node -e "require('node:fs').readFileSync('.github/workflows/bump-plugin-version.yml','utf8')" && python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/bump-plugin-version.yml', encoding='utf-8'))" 2>&1 || echo "pythonのyamlモジュールが無ければ省略可"`
Expected: エラーが出ない（pythonが無い/PyYAML未導入の場合は目視でインデントを確認する）

- [ ] **Step 3: コミット**

```bash
git add .github/workflows/bump-plugin-version.yml
git commit -m "feat: mainへのプラグイン変更push時にバージョン自動バンプ+タグ付けするワークフローを追加"
```

---

### Task 5: PR作成とissueの紐付け

**Files:** なし（PR作成のみ）

- [ ] **Step 1: 全テストを実行する**

Run: `node --test .github/scripts/bump-plugin-version/*.test.js`
Expected: 全PASS（Task 1, 2のテスト計6件）

- [ ] **Step 2: リモートにpushしてPRを作成する**

```bash
git push -u origin feature/plugin-version-auto-bump
gh pr create --title "プラグインのバージョン自動バンプ+タグ付けを追加" --base main --head feature/plugin-version-auto-bump --body "Closes #8"
```

Expected: PR URLが出力される。本文に `Closes #8` を含めることでマージ時にissue #8が自動クローズされる。
