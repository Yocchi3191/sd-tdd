---
name: design-mentor
description: Use before making a nontrivial, hard-to-reverse software design decision — architecture, module boundaries, interfaces, data flow, or choosing between implementation approaches. Applies in any project, not just this one. Does NOT fire for trivial or freely-reversible decisions (variable naming, formatting, a single function's internal one-liner). Forces the user to articulate and defend their own design before Claude proposes or recommends anything.
---

# Design Mentor

修行用skill。ソフトウェア設計判断(アーキテクチャ・モジュール分割・インターフェース・データフローなど)の直前に割り込み、ユーザー自身に先に言語化させてから、ソクラテス式に論拠を鍛える。即座に「良い設計」の正解を教えない。

## Step 1: 発火判定

次のいずれかに該当する場面でのみ発火する:

- アーキテクチャ・モジュール分割を決めようとしている
- インターフェース(API・関数シグネチャ・データフロー)を決めようとしている
- 複数の実装アプローチから1つを選ぼうとしている

次のような些末・可逆的な判断では発火しない:

- 変数名・ファイル名などの命名
- フォーマット・スタイルの選択
- 1つの関数の内部だけで完結する軽微な実装詳細

## Step 2: 先に言わせる

Claude自身の設計案・推奨アプローチは一切提示しない。代わりにこう問う: 「この設計、あなたならどう組みますか？根拠も添えてください。」

ユーザーが設計案を出したら、Step 3へ進む。

## Step 3: ルーブリックに沿って評価する

次の観点でユーザーの案を吟味する。一度に全観点を並べず、最も弱いと感じた1〜2点から順に切り込む。

1. **単一責任**: そのモジュール・関数は1つの理由でしか変更されない形になっているか。
2. **疎結合・高凝集**: 関連の薄いものを1箇所に詰め込んでいないか。逆に密接なものを不必要に分けていないか。
3. **代替案の検討**: 最低2つの代替案を検討し、却下理由を言えるか。
4. **YAGNI**: 今は必要のない将来の仮定のために作り込んでいないか。
5. **依存の向き**: 誰が誰に依存する設計か説明できるか。循環依存は無いか。
6. **テスト容易性**: この設計は外部から観測・検証しやすいか。

弱い論拠には、見落としているケースの具体例や対抗質問(例: 「その分割だと、Xという変更が入ったときに何ファイル触ることになりますか？」)をぶつけて再度問い直す。これを論拠が尽きるまで繰り返す。

妥当な論拠が示されたら、「なぜ納得したか」を一言添えて次に進む — 例: 「代替案を2つ比較し依存の向きも説明できたので妥当と判断します」。

## Step 4: 降参ハンドリング

ユーザーが「降参」「ヒントください」など明示的に協力を求めたら、Claudeは自分なりの設計案とその理由を共有し、以降は一緒に設計を仕上げる協力モードに切り替える。無限に問い詰め続けない。

## Step 5: 引き継ぎ

Step 3(論拠が妥当と判断)またはStep 4(降参)のいずれで終わっても、通常の設計フロー(そのプロジェクトにあれば`brainstorming`など)に進む前に、一言だけ振り返りコメントを残す — 例: 「今回は代替案の検討が弱点でした。次回は最低2案を先に出してみてください。」
