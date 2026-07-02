# task-filing スキル設計

日付: 2026-07-02

## 背景・課題

PR #9（ルートCLAUDE.mdに「ファイル変更タスクは着手前にissueを作成する」運用ルールを追記するPR）のレビューで、以下の指摘を受けた。

- 追記した文言「内容はsd-tdd（brainstorming/personal-issue-management）で詰めた内容をそのまま書く」は実態と合っていない。sd-tddの実体は`spec-interview`→`spec-to-tests`であり、`superpowers:brainstorming`や`personal-issue-management`のラッパーではない（[2026-06-25 sd-tdd プラグイン設計](2026-06-25-sd-tdd-plugin-design.md)でも「personal-issue-managementなどの既存skillとの統合は考慮しない」と明記済み）
- `personal-issue-management`は個人的に作った「オレオレskill」であり、一般的な運用ルールの前提にすべきではない

この指摘をきっかけに文言修正のみを検討していたが、議論の過程で以下の構造的な問題が見つかった。

- 現行の`spec-interview`は「要求をREQ台帳に変換する」対話と「`gh issue create`/`gh issue edit`でGitHub issueに書き込む」という2つの異なる関心事を1つのskillが担っている
- CLAUDE.mdが「issueに何を書けばよいか」を「きちんとした内容」のような曖昧な表現に頼ると、書く人（Claude）によって出力の質がばらつく

## 目的

- `spec-interview`をトラッカー非依存にし、「要求をREQ台帳として確定させる」責務だけを残す
- 起票（トラッカーへの実際の読み書き）を専任する新規skill `task-filing` を作り、決まったフォーマットを埋めるだけで誰が使っても十分な情報が揃ったタスクが起票される状態にする

## 全体フロー（改訂後）

```
[1. spec-interview] ── 対話でREQ台帳を確定
      │                  継続タスクの場合は task-filing の「台帳取得」を呼び、
      │                  返ってきた現在のREQ台帳を見て次番号(REQ-N+1)を決める
      │                  gh 等のトラッカーコマンドは一切呼ばない
      ▼
[2. task-filing]     ── 確定したREQ台帳 + タスク文脈を受け取り、
      │                  task-template.md を埋めて起票/追記する
      │                  新規: gh issue create／追記: gh issue edit（どちらも本skillが担当）
      ▼
[3. spec-to-tests]   ── （変更なし）issueのREQリストからテストを生成
      ▼
[4. coverage-check]  ── （変更なし）
```

[2026-06-25 sd-tdd プラグイン設計](2026-06-25-sd-tdd-plugin-design.md)の全体フローのうち、フェーズ1（`spec-interview`）を「対話でREQ台帳を確定させる」ことだけに絞り、そこから先の「トラッカーへの記録」を新設の`task-filing`に切り出す変更である。フェーズ0（`test-infra-setup`）・2・3・4は変更しない。

## `spec-interview` の変更

- **Step 1（既存台帳の確認）**: `gh issue view`の直接呼び出しをやめ、「継続タスクなら`task-filing`に台帳取得を依頼する」に変更する。`task-filing`が返す現在のREQリストの最大番号を見て、新規REQの採番を`REQ-<max+1>`から始める。新規タスクなら`REQ-1`から始める（変更なし）
- **Step 4（issueへ書き込む）**: 削除する。台帳が固まったら`task-filing`へ引き継ぐだけにする
- **Step 5（ハンドオフ文言）**: 「REQ台帳がissue #Nに書き込まれました」ではなく「REQ台帳が確定しました。次は`task-filing`で起票してください」に変更する。issue番号は`task-filing`が起票した後に初めて確定するため、`spec-interview`自身はissue番号を知らない

## 新規 `task-filing` skill

- **位置**: `plugins/sd-tdd/skills/task-filing/`
- **責務**: 確定したREQ台帳（および付随するタスク文脈）を受け取り、`task-template.md`に沿った内容で実際にタスクを起票・追記する。トラッカーへの読み書きはこのskillに閉じる
- **操作**:
  - **台帳取得**: 指定されたタスク（issue番号など）の現在のREQ台帳を返す。`spec-interview`から呼ばれる（`gh issue view <N> --json body -q .body`相当）
  - **新規起票**: REQ台帳一式とテンプレートの必須項目を埋め、`gh issue create`で新規作成する。作成したissue番号を呼び出し元に報告する
  - **追記**: 既存issueに新規REQ行（および該当する場合は任意項目の更新）を追記する。`gh issue edit`で本文を更新する
- **制約**: REQ-N行は`spec-interview`が確定した文言を一字一句そのまま転記する。書き換え・要約は禁止（`spec-to-tests`/`coverage-check`が`issue-N_REQ-XX`複合キーで本文をgrepする前提が壊れるため）
- デフォルトの起票先はGitHub issue（`gh` CLI）。他のトラッカーへの対応は将来の拡張とし、今回は実装しない（YAGNI）。ただしskill名・説明文に「GitHub」を固定しないことで拡張の余地は残す

## `task-template.md`

「これだけ読めば誰でも作業できる」を目標に、必須3項目 + 該当する場合のみ埋める任意3項目とする。

```markdown
## 背景・課題
<!-- なぜこのタスクが必要か。問題・背景・きっかけ -->

## やること・要件
<!-- REQ台帳をそのまま転記する。書き換え・要約は禁止 -->
REQ-1: ...
REQ-2: ...

## 完了条件
<!-- 何をもって完了とするか。受け入れ基準・確認方法 -->

## 決定事項（任意・該当する場合のみ）
<!-- 検討した代替案と、それを採用しなかった理由 -->

## 設計・実装方針（任意・該当する場合のみ）
<!-- 具体的な変更対象ファイルやアプローチ -->

## 注意点・既知のトレードオフ（任意・該当する場合のみ）
<!-- あえてやらないこと、既知のリスク -->
```

セクション見出し直下のヒント文はHTMLコメント（`<!-- ... -->`）で書く。GitHub等のMarkdownプレビューでは表示されず、生issueの編集時にだけガイドとして見える。

任意項目を「該当する場合のみ」とするのは、`spec-interview`のREQ理由記載ルール（Step 3: 代替案の説明が要る／外部要因がある／一文で言い切れない場合のみREQに理由を書く）と同じ考え方に揃えるためで、簡単なタスクまで儀式的に全項目を埋めさせないようにする。

## CLAUDE.mdの変更

現行:

> ファイルの追加・更新・削除が必要なタスクは、着手前にissueを作成すること。内容はsd-tdd（brainstorming/personal-issue-management）で詰めた内容をそのまま書く。

変更後:

> ファイルの追加・更新・削除が必要なタスクは、着手前にissueを作成すること。`spec-interview`でREQ台帳を確定させ、`task-filing`で起票する。

## 既存スキルとの整合性

- `spec-to-tests`/`coverage-check`は変更不要。issue本体を`gh issue view`で読み、`REQ-<id>:`行をgrepする既存実装のまま動作する（本文の書き込み元が`spec-interview`から`task-filing`に変わるだけで、フォーマットは変えない）
- `personal-issue-management`との非統合方針は維持する（[2026-06-25設計](2026-06-25-sd-tdd-plugin-design.md)から変更なし）

## スコープ外

- GitHub以外のトラッカー（Linear/Jira等）への実装対応
- 既存issue #1, #2, #3, #7, #8のtask-template形式への移行（過去分は対象外、今後の新規タスクから適用する）
