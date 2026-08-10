---
name: test-infra-setup
description: Use before spec-to-tests, or whenever a target project might be missing a test framework or mutation-testing setup. Detects and installs both, and makes sure mutation testing runs as a scheduled CI job instead of per-commit. Idempotent — skips anything already present.
---

# Test Infrastructure Setup

`spec-to-tests`は、プロジェクトがテストを実行できて初めて意味のあるものを生み出せる。また「テストがパスする」ことも、`expect(result).toBeDefined()`のような弱いテストがミューテーションの下で実際に失敗するのでなければ、何も証明したことにならない。このスキルは、REQからテストへの生成が始まる前に、その両方が揃っていることを確認する。

## Step 1: テストフレームワークの検出またはインストール

プロジェクトのエコシステムに合った手がかりを使って、既存のテストフレームワークの有無を確認する（網羅的ではない — 記載のないエコシステムでは判断で補う）:

- Node/TS: `package.json`の`devDependencies`に`vitest`、`jest`、`mocha`、`node:test`の利用があるか。
- Python: `pyproject.toml`、`requirements*.txt`に`pytest`/`unittest`があるか、既存の`test_*.py`ファイルがあるか。
- Go: 標準の`testing`パッケージ — Goプロジェクトはほぼ常にこれを持っている。`*_test.go`ファイルが存在するか、作成可能かを確認すればよい。
- Rust: 標準の`cargo test` — `tests/`ディレクトリまたは`#[test]`の利用が可能であることを確認する。
- Java/Kotlin: `pom.xml`/`build.gradle`のJUnit。

見つかった場合: Step 2へ進む。

見つからなかった場合: そのエコシステムで慣用的な最小構成をインストールし（例: 素のJS/TSプロジェクトには`vitest`、素のPythonプロジェクトには`pytest`）、ランナーが実際に動作することを確認するための自明なスモークテストを1つ書く（例: `assert 1 + 1 == 2`）。次に進む前に、それを実行してパスすることを確認する。

## Step 2: ミューテーションテストツールの検出またはインストール

ミューテーションテストは、コードに意図的に小さなバグ（「ミュータント」）を注入し、テストスイートがそれを検知できるかを確認する。これは、テストが単に存在しているだけでなく実際に何かをアサートしていることを示す唯一の信頼できるシグナルである。

- Node/TS: Stryker（`@stryker-mutator/core`）。
- Python: `mutmut`または`cosmic-ray`。
- Rust: `cargo-mutants`。
- Go: `go-mutesting`。
- Java: PIT（`pitest`）。

見つかった場合（設定ファイルまたは依存関係が既に存在する）: Step 3へ進む。

見つからなかった場合: プロジェクトのソースディレクトリを対象とする最小構成でインストールし、少なくとも1回はローカルで実行できることを確認する（セットアップ中に遅い全実行を避けるため、可能であれば`--dry-run`相当のオプションを使う）。

## Step 3: ミューテーションテストをスケジュール実行のCIジョブに組み込む — コミットごとには実行しない

ミューテーションテストはコストが高い（ミュータントごとにスイートを再実行する）。プッシュやPRのたびに同期的に実行してはならない。

- CI設定が既に存在し（例: `.github/workflows/*.yml`）、ミューテーションテストを実行するスケジュール（`schedule:`/cron）ジョブが既にある場合: スキップ。
- CI設定は存在するがスケジュール実行のミューテーションジョブがない場合: `schedule: cron`トリガー（他に手がかりがなければ週次を妥当なデフォルトとする）を持つ新しいワークフローファイルを追加し、ミューテーションテストのコマンドのみを実行させる。既存のpush/PRごとのジョブには手を加えない — それらは通常の（高速な）テストスイートのみを実行し続ける。
- CI設定が全く存在しない場合: 2つのジョブを持つ最小構成を作成する — pushごとにテストスイートを実行するジョブと、スケジュール実行でミューテーションテストを実行するジョブ。

## Step 4: 報告

検出したものとインストールしたもの（テストフレームワーク、ミューテーションツール、CIスケジューリング）をまとめ、実際の機能実装と一緒にコミットされる前にユーザーが差分をレビューできるようにする。
