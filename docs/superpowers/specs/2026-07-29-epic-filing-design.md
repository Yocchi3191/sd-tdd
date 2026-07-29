# epic-filing スキル設計

日付: 2026-07-29

## 背景・課題

`spec-interview` / `task-filing` により、実装をこなすための仕様レベルの粒度のissue（task-issue）は十分な精度で起票できるようになっている。しかし、これらは常に「作業タスク」単位であり、その作業が結局どのアイデア・企画を満たすためのものなのか、作業全体のゴールが何なのかを表すissueが存在しない。

現状、「この依頼は1個の作業タスクとして起票すべきか、それとも複数の作業タスクに分かれる企画として扱うべきか」を判断し、企画なら目的・ゴールを表す親issueを起票するための明確なskillはsd-tddに存在しない。

なお、`spec-interview` Step 4には既に「独立した関心事が複数あるとわかったら sub issue に分割する」という判断ロジックがある。これは「REQを掘り下げていく過程で事後的に発覚する」タイミングでの分割判断であり、今回追加したい「依頼を受けた直後の一次判定」と本質的に同じ問い（独立した関心事の集合か、単一のまとまった変更か）に対する答えである。判断ロジックを重複させないため、本設計ではこの2つを統合する。

## 目的

- タスク依頼が企画・アイデアレベルなら、目的・ゴール・成功指標を表す **epic-issue** として起票する
- 実装をこなすための作業タスク単位のissue（従来通り `spec-interview` → `task-filing` で起票するもの）は **task-issue** と呼び、対応する epic-issue の sub-issue として起票する
- 上記の判定・ヒアリング・分解・起票を一手に担う新規skill `epic-filing` を追加する
- `spec-interview` Step 4 の「sub issue split」判断を `epic-filing` 呼び出しに一本化し、判断ロジックの重複を排除する

## 全体フロー

```
run: 依頼受信
  └→ Step 1 拡張: resume / 新規task-or-epic の二択判定
       - resume はrun自身が判定（既存どおり）
       - resumeでなければ epic-filing を呼び、企画か単一taskかの一次判定を委譲する
            （run はsequencingのみを担当し、判定ロジック自体は持たない）

epic-filing: 2つの入り口を持つ

  経路A（run経由 / 直接発話「タスクを切って」等からのゼロベース起票）
    1. 一次判定: 依頼が単一の具体的な変更か、ゴール止まりで複数作業に
       またがりそうかを判定。曖昧なら1問だけ確認する
       - 単一task判定 → epic化せず、spec-interview→task-filing(通常operation)
         で起票して終了
       - 企画判定 → 2へ
    2. ヒアリング: 背景・ゴール・成功指標を1問ずつ確認
    3. 作業タスク候補への分解: 実現に必要な作業タスク候補（タイトルレベル）
       をリスト化し、ユーザーと過不足を合意
    4. epic-issue起票: epic-template.md + epicラベルで `gh issue create`
    5. 各候補を順にtask化: 候補ごとに新規 spec-interview → task-filing
       （File a task under a parent epic operation、sub-issue化）

  経路B（spec-interview Step4での事後発覚）
    - 既に集まったREQ群 + 提案済みグループ分けを引き継ぐ
    - ゴール・成功指標のみ簡略確認（背景は対話履歴から要約）
    - 分解は既存のグループ提案をそのまま使う（再分解しない）
    - epic-issue起票は経路Aと同じ
    - 各グループは新規spec-interviewを回さず、集まっているREQをそのまま
      task-filingに渡してtask-issue化する
```

## epic-filing の判定基準

一次判定（経路A Step1）の目安:

- 依頼文が具体的な単一の実装対象（特定の機能・ファイル・バグ）を指している → task
- 依頼文がゴール・テーマ止まりで実装対象が定まっていない、または明らかに複数の独立した関心事にまたがる → epic
- 判断に迷う場合は一度だけ確認する（例:「これは1つのまとまった変更ですか、それとも複数の独立した作業に分かれそうな大きめのテーマですか？」）

この基準は経路B（`spec-interview` Step4）で使われてきたものと同一であり、発覚するタイミングが「依頼直後」か「REQ収集中」かの違いに過ぎない。

## epic-template.md

```markdown
## 背景・課題
<!-- なぜこの企画が必要か。問題・機会・きっかけ -->

## ゴール・あるべき姿
<!-- この企画が達成したい状態。何のためにやるのか -->

## 成功指標・完了条件
<!-- 何をもって企画の完了・成功とするか -->

## スコープ外（任意）
<!-- 今回は扱わないこと -->

## 関連task-issue
<!-- gh sub-issueで親子関係が自動連携されるため参考情報。起票の都度追記 -->
- #<N>: <タスク名>

## 決定事項（任意）
<!-- 検討した代替案と、それを採用しなかった理由 -->

## 注意点・既知のトレードオフ（任意）
<!-- あえてやらないこと、既知のリスク -->
```

`task-template.md` と構造を揃えつつ、REQ台帳の代わりに「ゴール・あるべき姿」「成功指標・完了条件」を置く。必須項目・任意項目の考え方（該当する場合のみ埋める）は `task-template.md` に準拠する。

## epicラベル

epic-issueには `epic` ラベルを付与する。存在しなければ作成する（`gh label list` で確認 → 無ければ `gh label create epic` してから `gh issue create --label epic`）。task-issue側にはラベルを付与しない（既存 `task-filing` と同じ）。

## `task-filing` への変更

新規operationを追加する。

**Operation: File a task under a parent epic**

- 呼び出し元: `epic-filing`（経路A/Bどちらも）
- 中身は既存の「File a split as sub issues」operationのsub issue作成部分を流用する:

```bash
gh sub-issue create --parent <epic-N> --title "<task title>" --body "$(cat <<'EOF'
<task-template.mdを埋めたもの>
EOF
)"
```

- `gh-sub-issue` extensionの確認・インストールは既存の「File a split as sub issues」と同じ手順を踏襲する（`gh extension list | grep -q sub-issue || gh extension install yahsan2/gh-sub-issue`、失敗時はユーザーに手動インストールを促して停止）
- 報告文言: 「Task filed as issue #<M> (sub-issue of epic #<epic-N>)」

**既存の「File a split as sub issues」operationは廃止し、この新operationに統合する。** parentが「REQ台帳を持つ通常issue」か「epic-issue」かの違いだけで、sub issue作成の実体は同じであるため。既存の呼び出し元は `spec-interview` Step4のみであり、そちらを経路Bに差し替えることで影響範囲は閉じる。

## `spec-interview` への変更

Step 4を書き換える。

- **現状**: 「sub issue split」と「PR-group split」の2択を提案し、確定させるロジック
- **変更後**: 独立した関心事が複数あると判断したら、グループ分け案を添えて `epic-filing` を呼ぶ（経路B）。sub-issue化の提案・承認自体は `epic-filing` 側のヒアリングに統合されるため、`spec-interview` 自身はsub issue化を確定させる責務を持たなくなる。**PR-group split判断はそのまま残す**（依存した実装ステップの分割は企画/task判定とは別の関心事のため）。

## `run` への変更

- **Step 1**（「Determine new task vs. resume」）を3分岐に拡張する。resumeはrun自身が判定（既存どおり）。新規task/新規epicの一次判定は `epic-filing` を呼んで委譲する — run はsequencingのみを担当する既存方針を維持する
- `epic-filing` が「単一taskだった」と判定して `spec-interview`→`task-filing` まで済ませて返してきたら、run は通常の「Implementing one scope」以降に進む
- `epic-filing` が「企画だった」と判定してepic-issue + 複数task-issueを起票し終えたら、run は**どのtask-issueから実装を始めるか人間に確認する**（既存の「Handling a split」のsub issue splitと同様、run既存の5つのエスカレーションポイントの1つとして扱う）。選ばれたtask-issueに対しては「Resuming an existing issue」と同じ扱いで進める

## run無しでの直接起動

`epic-filing` のdescriptionに「タスクを切って」「issueにして」等のトリガー表現を含め、run経由でなくても直接発話から起動できるようにする。判定ロジックの二重実装を避けるため、判定自体を `epic-filing` に一本化し、`task-filing` のdescriptionは「spec-interviewでREQ台帳が確定した後に使う」という現状のまま維持することで、"タスクを切って"系の入口は `epic-filing` に絞る。

run無しで直接呼ばれた場合、`epic-filing` は起票（epic-issue + task-issue、または単一task-issue）まで行ったところで終了する。実装・PR作成のフェーズには進まない。

## エラーハンドリング・エッジケース

- **分解結果が候補1つだけ**: それでもepicとして起票する（epic-issue + task-issue 1個）。ゴール・背景の文脈が失われないことを優先する。
- **epic途中で失敗**（例: 3個中2個目のtask-issue起票で失敗）: epic-issue番号を指定して `epic-filing` を再度呼ぶ。`epic-filing` 自身がepic-issue本文の「関連task-issue」欄と `gh sub-issue list --json ...`（相当のsub-issue一覧取得）を見て、未起票の候補だけ継続する軽量レジュームを持つ。run全体のresume機構とは別の、`epic-filing` 固有の再開処理とする。
- **`gh-sub-issue` extension未インストール**: 既存の `task-filing` と同じパターンを踏襲する。
- **経路BとPR-group分割の関係**: 経路Bはsub-issue分割（独立した関心事）のみを扱う。各task-issue内部でさらに実装ステップとしてPR-group分割したい場合は、そのtask-issue用に個別に回る `spec-interview` のStep4がPR-group判断のみで引き続き対応する（ネストしない）。

## 既存スキルとの整合性

- `spec-to-tests` / `coverage-check` は変更不要。task-issue本文の `REQ-<id>:` 行フォーマットは変わらないため、既存実装のまま動作する。epic-issueにはREQ行が存在しないため、これらのスキルはepic-issueを対象にしない。
- 既存の `task-filing`「File a split as sub issues」operationは廃止し、「File a task under a parent epic」に統合する（前述）。
- `personal-issue-management` との非統合方針は維持する（変更なし）。

## スコープ外

- epic-issue自体をさらに上位のepicの下にネストする多階層epic構造
- GitHub以外のトラッカー（Linear/Jira等）への実装対応
- 既存issueのepic-issue/task-issue形式への移行（過去分は対象外、今後の新規タスクから適用する）
