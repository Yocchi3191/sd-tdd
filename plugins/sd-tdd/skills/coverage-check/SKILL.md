---
name: coverage-check
description: Use after spec-to-tests has generated tests for an issue's REQ ledger, or whenever a new REQ is appended during implementation — mechanically verifies every active REQ-ID has at least one test before moving forward. Never substitute LLM judgment for this check; always run the script.
---

# Coverage Check

GitHub issue上のREQ台帳とテストスイートが一致しているかを検証する。LLMの判断には頼らない — これは読み合わせではなく、機械的なgrep/diffである。

## いつ実行するか

- `spec-to-tests`がissue向けにテストを生成した直後。
- 実装中にREQ台帳へ新規REQが追記されたとき（新たに発見したエッジケース、またはsupersedeによる訂正）— カバレッジが依然として保たれているとみなさず、再実行する。

## 実行方法

```bash
node scripts/coverage-check/cli.js --issue <N> --tests <path-to-test-dir>
```

（パスはsd-tddプラグインルートからの相対パス。`--tests`は対象プロジェクトのテストが実際に置かれている場所に合わせて調整する。）

issueが段階的なPRグループとして実装されている場合（`task-filing`の`## PRグループ`セクション参照）、台帳全体ではなくそのグループのREQ-IDだけを検査するために`--group <N>`を渡す:

```bash
node scripts/coverage-check/cli.js --issue <N> --tests <path-to-test-dir> --group <N>
```

各グループが実装されるたびに1回ずつ実行する。全グループが完了した時点で`--group`を外し、台帳全体の最終チェックを行う。

## 結果の読み方

- **Exit 0、missing/orphansに関する出力なし:** すべてのアクティブなREQにテストが存在する。
- **「Missing tests for: REQ-X, REQ-Y」（exit 1）:** `spec-to-tests`スキルに戻り、それらのREQ-IDのぶんだけテストを書く。台帳からそれらを削除して対応してはならない — 台帳は追記専用であり、あるREQが誤りだと判明した場合はsupersede扱いにする（`spec-interview`参照）のであって、削除はしない。
- **「Tests reference REQ-IDs not in the issue ledger」（警告、exit 0）:** `issue-N_REQ-XX`キーが台帳のどの行にも一致しないテストが存在する。有効な解決策は2つ:
  1. テスト作成中・実装中に本当に新しく発見された要件である場合 — `spec-interview`を呼んでREQを起草し、`task-filing`で新規REQ-N+1として台帳に追記してから、このチェックを再実行する。
  2. 単なる誤り（issue番号・REQ番号のタイプミス、意図しないスコープ拡大）である場合 — テストを修正または削除してから、このチェックを再実行する。

孤立REQを黙って無視してはならない。台帳の存在意義そのものが、すべてのテストが記録された理由に遡れることにある。
