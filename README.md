# sd-tdd

Claude Code向けプラグインのモノレポ。スペック駆動TDDワークフローを提供する `sd-tdd` を中心に、`dev-dojo`・`dev-knowledge` を含む(詳細は [.claude-plugin/marketplace.json](.claude-plugin/marketplace.json))。

## プラグイン一覧

- **sd-tdd** — 要件をテスト可能なREQ台帳に落とし込み、REQと対応付けた失敗テストを生成し、カバレッジを検証した上でsuperpowersのTDDに実装を引き渡す。
- **dev-dojo** — 要件定義・ソフトウェア設計・テスト設計の意思決定の直前にソクラテス式で問い返し、判断力を鍛える修行用プラグイン。
- **dev-knowledge** — 他プロジェクトでも通用する設計・テスト・プロセスの知見を蓄積し、非自明な判断の場面で自然に参照するナレッジベース。

## sd-tdd の主要フロー

`sd-tdd:run`(`plugins/sd-tdd/skills/run`)が入口であり、要件定義(`spec-interview`)→issue起票(`task-filing`)→テスト生成(`spec-to-tests`)→TDD実装→PR作成(`submit`)→レビュー(`review-pr`)までを自動でつなぐ。各skillの詳細は `plugins/sd-tdd/skills/*/SKILL.md` を参照。

## eval-runner: 実際にclaudeを動かした実挙動テスト

`sd-tdd:eval-runner` skillは、各skillの `evals/evals.json` のプロンプトを実際に `claude -p` サブプロセスで実行し、出力を採点する。skillのSKILL.md/evals.jsonの記述が実際にClaudeにどう解釈されるかを確認できる唯一の手段。

**CIには載せられない** — `claude -p` はローカルセッションのサブスクリプション認証に依存しており、CIの認証情報では動かせないため。毎回実トークンを消費する重い処理でもあるため、コミットやPR個別修正の都度、あるいはTDDサイクルのたびに実行するものではない。運用は週末バッチ: その週に変更のあった内容をまとめて、日曜20時までに人間が手動で一括実行する。バッチで指摘が見つかっても即座に再実行はせず、修正後は次回の週末バッチで確認する。詳細は `plugins/sd-tdd/skills/eval-runner/SKILL.md` を参照。
