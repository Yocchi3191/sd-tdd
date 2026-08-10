# 作業ルール

- ファイルの追加・更新・削除が必要なタスクは、着手前に `sd-tdd:run` を起動すること。内部で `spec-interview` によるREQ台帳確定・`task-filing` によるissue起票が自動的に行われる。
- `plugins/sd-tdd` 配下で新規作成・改定する各skillの `SKILL.md` は日本語で書くこと（frontmatterのkey名・コード識別子・bashコマンド文字列・`REQ-<n>:` 表記などの構造は変更しない）。日本語しか読めないレビュアーでもレビューできる状態を維持するための規約（issue #50 / PR #55のレビューで英語のskill文書が読めないと指摘されたことに由来）。
