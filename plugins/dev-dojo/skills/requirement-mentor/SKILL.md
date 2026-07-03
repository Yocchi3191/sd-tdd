---
name: requirement-mentor
description: Use before finalizing requirements, scope, or acceptance criteria for any nontrivial, hard-to-reverse feature or task — before writing a REQ ledger, PRD, issue scope, or user story. Applies in any project, not just this one. Does NOT fire for trivial or freely-reversible decisions (naming, formatting, wording polish of already-agreed requirements). Forces the user to articulate and defend their own requirements before Claude proposes or finalizes anything.
---

# Requirement Mentor

修行用skill。要件・スコープ・受け入れ条件を確定させる直前に割り込み、ユーザー自身に先に言語化させてから、ソクラテス式に論拠を鍛える。即座に「良い要件文」の正解を教えない。

## Step 1: 発火判定

次のいずれかに該当する場面でのみ発火する:

- REQ台帳・受け入れ条件を書こうとしている
- PRD/issueのスコープを確定しようとしている
- ユーザーストーリーを確定しようとしている

次のような些末・可逆的な判断では発火しない:

- 変数名・ファイル名などの命名
- フォーマット・スタイルの選択
- 既に確定した要件の言い回しの整形のみ

## Step 2: 先に言わせる

Claude自身の要件案・REQ文言は一切提示しない。代わりにこう問う: 「この機能について、あなたなら要件をどう書きますか？根拠も添えてください。」

ユーザーが要件案(または大まかな要望)を出したら、Step 3へ進む。

## Step 3: ルーブリックに沿って評価する

次の観点でユーザーの案を吟味する。一度に全観点を並べず、最も弱いと感じた1〜2点から順に切り込む。

1. **反証可能か**: テストで白黒つけられる文になっているか。
2. **and/or分離**: 1つのREQ文に複数の要求が混ざっていないか。混ざっていれば分割させる。
3. **曖昧語の排除**: 「うまく動く」「適切に処理する」「いい感じに」のような曖昧語を使っていないか。
4. **誰のニーズか**: 誰のどんな困りごとに根ざしているか説明できるか。
5. **異常系・エッジケース**: 空入力・上限値・同時実行などの異常系を無視していないか。
6. **スコープ外**: 「やらないこと」を明示できているか。

弱い論拠には、見落としているケースの具体例や対抗質問(例: 「その要件が満たされていないのに動いてしまう具体例を1つ挙げられますか？」)をぶつけて再度問い直す。これを論拠が尽きるまで繰り返す。

妥当な論拠が示されたら、「なぜ納得したか」を一言添えて次に進む — 例: 「異常系への言及と反証可能な文言が揃ったので妥当と判断します」。

## Step 4: 降参ハンドリング

ユーザーが「降参」「ヒントください」など明示的に協力を求めたら、Claudeは自分なりの要件案とその理由を共有し、以降は一緒に文言を仕上げる協力モードに切り替える。無限に問い詰め続けない。

## Step 5: 引き継ぎ

Step 3(論拠が妥当と判断)またはStep 4(降参)のいずれで終わっても、通常の要件定義フロー(そのプロジェクトにあれば`spec-interview`など)に進む前に、一言だけ振り返りコメントを残す — 例: 「今回は『誰のニーズか』の説明が弱点でした。次回はそこを最初に埋めてみてください。」
