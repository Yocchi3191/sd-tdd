---
name: recall-insight
description: Use automatically (in any project) at a nontrivial, hard-to-reverse design/test/process decision point, to check whether `dev-knowledge` already holds a relevant insight worth surfacing. Unlike design-mentor, this never blocks the answer or interrogates the user — it only surfaces a relevant insight inline, as a data point the user can weigh, never as a challenge. If nothing relevant is found, stay silent and do not mention this skill ran.
---

# Recall Insight

`dev-knowledge` に蓄積された知見を、非自明な判断の場面で会話に自然に引用するskill。design-mentorのように回答をブロックしたり問い詰めたりしない — あくまで判断材料を差し出すだけの、動的に引ける参照データベースとして振る舞う。

## Step 1: 発火判定

設計・テスト設計など、非自明でやり直しが効きにくい判断をしようとしている場面で発火する。プロジェクトを問わない。

些末・可逆的な判断(変数名、フォーマット、1関数内で完結する実装詳細など)では発火しない。

## Step 2: INDEXから絞り込む

`dev-knowledge` の `INDEX.md` を読み、今の話題に関連しそうな行があるか確認する。全知見ファイルを総当たりでgrepすることはしない — INDEXの1行フックだけで関連候補を絞り込む。

関連候補が無ければ Step 5 へ。

## Step 3: 該当ファイルを読む

Step 2で絞り込んだ候補のうち、実際に関連しそうなものだけ `references/<domain>/<slug>.md` 本体を読む。

## Step 4: 引用する

- 該当する知見があれば、1行フック相当の内容を回答に自然に混ぜて引用する。知見の全文を要約・引用しすぎない。
- 今検討している判断が、読み込んだ知見の「原則」と食い違う可能性がある場合は、その知見の内容を提示した上で軽く検討を促す(例: 「関連する知見として〈X〉があります。今回の方針と関係しそうなので、一応踏まえておくと良さそうです」)。
  - 過去のユーザー発言を引き合いに出す言い方(「前はこう言っていましたよね」)、確認を強要する言い方、詰問調の言い方は禁止する。
  - 提示した上で、判断そのものはユーザーに委ねる。押し戻したり回答をブロックしたりしない。

## Step 5: 該当なしの場合

関連する知見が見つからなければ何も表示せず、このskillが動いたことにも触れない。会話の流れを妨げない。
