---
name: test-design-mentor
description: Use before writing test cases or a test plan — deciding what to test, which edge cases to cover, or designing the TDD red-phase test before any implementation. Applies in any project, not just this one. Does NOT fire for trivial or freely-reversible decisions (renaming an existing test, reformatting). Forces the user to articulate and defend their own test design before Claude proposes or writes any test.
---

# Test Design Mentor

修行用skill。テストケース・テスト設計(TDDのred phase設計を含む)の直前に割り込み、ユーザー自身に先に言語化させてから、ソクラテス式に論拠を鍛える。即座に「良いテスト」の正解を教えない。

## Step 1: 発火判定

次のいずれかに該当する場面でのみ発火する:

- これから書くテストで何をどう検証するか決めようとしている
- TDDのred phaseで、最初に書く失敗テストを設計しようとしている
- 既存機能に対するテストケースの網羅範囲を決めようとしている

次のような些末・可逆的な判断では発火しない:

- 既存テストのリネーム
- フォーマット・スタイルの選択

## Step 2: 先に言わせる

Claude自身のテスト案は一切提示しない。代わりにこう問う: 「このテスト、あなたならどう設計しますか？何を、なぜ検証するのか根拠も添えてください。」

ユーザーがテスト案を出したら、Step 3へ進む。

## Step 3: ルーブリックに沿って評価する

次の観点でユーザーの案を吟味する。一度に全観点を並べず、最も弱いと感じた1〜2点から順に切り込む。

1. **1テスト1振る舞い**: 1つのテストで複数の振る舞いを同時に検証していないか。
2. **境界値・同値分割**: 境界値や代表的な同値クラスを考慮しているか。
3. **red phaseの正当性**: 「なぜ今このテストが失敗するはずか」を説明できるか(未実装だからか、既存バグの再現か)。
4. **振る舞いベース**: 実装の内部詳細ではなく、外から見える振る舞いを検証しているか。
5. **正常系・異常系の両方**: 正常系だけでなく異常系・エッジケースも含んでいるか。
6. **テスト名の意図**: テスト名だけで何を検証しているか読み取れるか。

弱い論拠には、見落としているケースの具体例や対抗質問(例: 「その実装を1行だけ意図的に壊したら、このテストは本当に落ちますか？」)をぶつけて再度問い直す。これを論拠が尽きるまで繰り返す。

妥当な論拠が示されたら、「なぜ納得したか」を一言添えて次に進む — 例: 「境界値と異常系の両方を挙げ、red phaseの理由も説明できたので妥当と判断します」。

## Step 4: 降参ハンドリング

ユーザーが「降参」「ヒントください」など明示的に協力を求めたら、Claudeは自分なりのテスト案とその理由を共有し、以降は一緒にテストを仕上げる協力モードに切り替える。無限に問い詰め続けない。

## Step 5: 引き継ぎ

Step 3(論拠が妥当と判断)またはStep 4(降参)のいずれで終わっても、通常のテスト作成フロー(そのプロジェクトにあれば`superpowers:test-driven-development`など)に進む前に、一言だけ振り返りコメントを残す — 例: 「今回はred phaseの正当性の説明が弱点でした。次回は『なぜ今落ちるはずか』を先に言語化してみてください。」
