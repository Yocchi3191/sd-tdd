# sd-tdd:run オーケストレーターskill 設計

日付: 2026-07-02

## 背景・課題

sd-tddプラグインは `test-infra-setup` → `spec-interview` → `task-filing` → `spec-to-tests` → `coverage-check` → (`superpowers:test-driven-development`) という5つの独立したskillの連鎖として設計されている(`docs/superpowers/specs/2026-06-25-sd-tdd-plugin-design.md`)。各skillのdescriptionが「次はこれを呼んで」と手渡しする形でチェーンをつないでおり、意図的にオーケストレーター的な単一skillは作られていなかった。

この設計は「1skill=1責務」を貫く一方、人間側から見ると「どこから始めればよいか分かりにくい」「各stageを手動で呼び進める必要がある」という2つの摩擦を生んでいた。本設計はこれを解消する、既存5skillを一切変更しない**追加のみ**の対応である。

## 目的

1. 「ここから始めればよい」という単一の明確なエントリポイントを用意する
2. 承認が必要な箇所(REQ台帳確定)を除き、パイプラインを自動で進行させる
3. 既存issueの途中再開にも対応する

## 設計

### skill概要

- **配置**: `plugins/sd-tdd/skills/run/SKILL.md`
- **呼び出し名**: `sd-tdd:run`(plugin名:skill名記法。明示的に`/sd-tdd:run`とも呼べる)
- **description**: このプロジェクトでファイル変更を伴う機能開発・バグ修正を行うタスクに限定してトリガーする。単なる質問・読み取り専用の分析では発火しないよう明示的に除外文言を入れる。専用の「タスク割り振りskill」は追加しない — 既存の`using-superpowers`ゲートと役割が重複するため、description自体の精度で対応する。
- 既存5skill(`spec-interview`, `task-filing`, `spec-to-tests`, `coverage-check`, `test-infra-setup`)は無変更。単独起動の経路(実装中のREQ追記など)はそのまま維持される。

### 自動進行の粒度

「ほぼ全自動」を採用する。停止するのは以下の1箇所のみ:

- `spec-interview`内の既存ゲート(REQ台帳のユーザー承認)

それ以外—`test-infra-setup`でのパッケージ導入・CI設定変更、`task-filing`でのissue作成/更新、`coverage-check`失敗時の`spec-to-tests`への差し戻しループ、`coverage-check`通過後の`superpowers:test-driven-development`への引き継ぎ—は確認なしで自動的に進む。

> 補足: `test-infra-setup`によるCI設定変更・依存追加は本来「破壊的/共有状態に影響する操作」として確認を挟むのが基本方針だが、本skillに関してはユーザーが明示的に「ほぼ全自動」を選択したため、この停止ポイントには含めない。

### 新規タスクのフロー

1. `test-infra-setup`を呼ぶ(冪等。セットアップ済みなら即スキップ)
2. `spec-interview`を呼ぶ → ユーザー承認まで対話(唯一の停止ポイント)
3. 承認後、自動で`task-filing`を呼びissueを起票
4. 自動で`spec-to-tests`を呼びテストを生成
5. 自動で`coverage-check`を呼ぶ。不足があれば自動的に3(`spec-to-tests`)へ差し戻してループ
6. 通過したら自動で`superpowers:test-driven-development`を呼び実装フェーズへ引き継ぐ

進行はTodoWriteで6ステップとして可視化し、各ステップ完了時に一言ステータスを報告する(停止はしない)。

### 既存issue再開のフロー

ユーザーが対象issueを指定(例: 「issue #12の続き」)した場合、次の手順で再開stageを機械的に判定する:

1. `gh issue view <N> --json body,state -q .` でissue本文を取得し、`REQ-`行の有無を確認
2. テストディレクトリを`issue-<N>_REQ-`でgrepし、生成済みテストの有無を確認
3. 既存の`node scripts/coverage-check/cli.js --issue <N> --tests <path>`を実行し、不足REQを機械的に判定
4. 判定結果に応じて上記フローの該当stageに合流する:
   - REQ台帳なし → `spec-interview`から(=対話・承認ゲートで自然に止まる)
   - REQ台帳ありだがテスト不足 → `coverage-check`が報告するREQに対して`spec-to-tests`から
   - `coverage-check`通過済み → `superpowers:test-driven-development`へ直行

再開時もstage間の確認は挟まない。

### CLAUDE.mdの更新

現在の一文「spec-interviewでREQ台帳を確定させ、task-filingで起票する」を、「`sd-tdd:run`オーケストレーターskillを起動すること(内部でspec-interview→task-filingが自動的に呼ばれる)」に更新し、単一のエントリポイントを明記する。

## スコープ外

- 専用の「タスク割り振り/トリアージskill」の新設(`using-superpowers`ゲートとの重複を避けるため見送り)
- 既存5skillの内部ロジック変更
- test-infra-setupのCI変更・依存追加の前に確認を挟む挙動(ユーザーが明示的に不要と判断)

## 検証方法

コード資産(scriptsなど)を追加しないため、mutation testingや自動テストの対象にはならない。実装後、このリポジトリ上でダミーの小機能要望を1つ流し、6ステップが意図通り連鎖するか、既存issueの再開判定が正しいstageに合流するかを手動でドライラン確認する。

## 進め方についての補足

本skill追加はsd-tddプラグイン自体のメタ開発であり、過去の同種の作業(`task-filing`skill自体の新設など)と同様、sd-tdd自身のflow(spec-interview→task-filing)ではなく、汎用の`brainstorming → writing-plans → 実装`で進める。
