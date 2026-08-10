---
name: eval-runner
description: Use when you want to actually execute a skill's evals/evals.json and grade the result — e.g. "このskillのevalを実行して", "evals.jsonを走らせて判定して", or before merging a skill change to confirm it behaves as the evals describe. Runs each eval's prompt against the target skill as a `claude -p --plugin-dir <worktree>` subprocess, grades the captured output against expected_output/expectations in this same session, and reports a pass/fail summary as text or JSON. Also use for verifying a skill description's trigger accuracy, by invoking skill-creator's run_eval.py directly. This is an on-demand tool only — it is never invoked automatically by sd-tdd:run, and it never runs in CI.
---

# Eval Runner

skillの`evals/evals.json`を実際の実行エンジンに接続する: 各evalのpromptを対象skillに対して実行し、出力を採点してpass/failを報告する。このskillがなければ、`evals.json`ファイルは何も読み取らず実行もされない、単なる不活性なドキュメントのままである。

**自動実行はしない。** このskillは人間、またはClaudeが明示的に実行を選んだ場合にのみ、オンデマンドで呼び出される。`sd-tdd:run`のパイプラインのステップではなく（そのパイプラインはこのskillを一切呼び出さない）、CI（GitHub Actionsなど）にも組み込まれていない — mutation testingとunit testは`test-infra-setup`が定めた通常のスケジュールで実行されるが、このskillが採点するevalは常に手動・オンデマンドのチェックである。

## 開始前に必要な入力

- **対象skillの`evals/evals.json`のパス** — 例: `plugins/sd-tdd/skills/task-filing/evals/evals.json`。
- **対象プラグインのworktreeパス** — `claude -p --plugin-dir <path>`を実行する際にプラグインをチェックアウト/読み込みするファイルシステム上のパス（プラグインの通常のインストール先でも、マージ前の変更を検証するための未マージworktreeでもよい）。
- **実行するeval** — ユーザーが特定の`id`や`name`を指定しない限り、ファイル内の全evalをデフォルトとする。

これらのいずれかが欠けている、または曖昧な場合は、パスを推測して進めるのではなく、先に確認すること。対象skillに`evals/evals.json`が全く存在しない場合（例えば`coverage-check`のようにunit testで検証されるスクリプト型skillなど）は、evalをでっち上げたり別のチェックにすり替えたりせず、このskillが採点できるものは何もないとユーザーに伝えること。`evals.json`のパースに失敗した場合、または実行対象のevalに`prompt`や`expectations`フィールドが欠けている場合は、そこで停止し、どのevalのどのフィールドが問題かを報告すること — 欠けている内容を推測したり、黙ってスキップしたりしないこと。

## Step 1: 各evalのpromptをexecutorのsubprocessとして実行する

実行対象の各eval objectについて、その`prompt`フィールドを読み取り、対象プラグインにスコープした新規の非対話的な`claude -p`subprocessとして実行する。`prompt`のテキストは複数行になりうる上、バッククォートや引用符、`$(...)`を含むことがある — これをdouble-quotedのshell引数へ直接埋め込んではならない。そうすると内容がリテラルなテキストとして渡されるのではなく、shellのcommand substitutionとして実行されてしまうためである（これは`submit`のSKILL.mdがPR本文についてheredocで解決しているのと同じ種類の問題である）。まずpromptを一時ファイルに書き出し、それをstdin経由で渡すこと:

```bash
cat <<'EVAL_RUNNER_PROMPT_EOF' > /tmp/eval-runner-prompt.txt
<eval.prompt, verbatim>
EVAL_RUNNER_PROMPT_EOF
claude -p --plugin-dir <target-plugin-worktree-path> < /tmp/eval-runner-prompt.txt
```

bare `EOF`ではなく、ここまで固有性の高いdelimiterを使うこと。そうすることで、promptにたまたま単独の`EOF`行が含まれていた場合にheredocが途中で終端してしまい、不完全なpromptがexecutorに黙って渡されてしまう事態を防げる。

出力モードはデフォルト（プレーンテキスト）を使うこと — `--output-format stream-json`や`--verbose`は使わない。こうすることで、取得するのはexecutorの最終的な回答テキストであり、途中のtool-call transcriptや内部の推論過程ではなくなる。その標準出力テキストをこのevalの**executor output**として取得すること。subprocessが非ゼロで終了した場合や何も出力しなかった場合も、それをexecutor outputとして記録すること（空/エラーになった実行結果も、evalをスキップする理由ではなく、採点すべき実際の結果である）。

これを実行対象の各evalについて1回ずつ行ってからStep 2の採点に進むこと — 各evalのpromptと取得したexecutor outputはペアで保持しておくこと。

## Step 2: executor outputをexpected_output/expectationsと照合して採点する

各evalについて、取得した**executor output**（Step 1）を、`evals.json`のそのevalの`expected_output`および`expectations`フィールドと照合する:

- `expectations[]`内の各文字列について、**pass**または**fail**を判定し、その判定の根拠となるexecutor outputテキストの該当部分を示す1〜2文の**evidence**（根拠）を付けること（引用するか、近い形で言い換える）。
- すべての判定はStep 1で取得した**executor outputのテキストのみ**を根拠にすること。executor subprocess自身のtool-callログ、リトライ、内部の推論過程は、たとえ（誤って`--verbose`を付けたなどで）見えてしまったとしても、決して根拠として使わないこと — 採点者が下書きの試行錯誤を覗き見たことでしかpassしないevalは、実際には最終的な振る舞いを検証していないことになる。
- 採点はこのskill呼び出しと同じセッション内でインラインに行うこと — 別の採点用subagentを立てないこと。採点者（このセッション）はexecutor subprocessとは別のプロセス/コンテキストであるため、executorの出力をテキストとして判定することで、executor自身の下書きからの汚染を避けられる。

## Step 3: サマリを報告する

要求された全evalの実行と採点が終わったら、まず各evalの個別結果（id、pass/fail）をすべて書き出すこと — 記憶だけで集計しないこと。次に、その書き出したリストから件数を数えること — 暗算ではなく。集計を誤ったサマリは、単に簡素なサマリより悪い。報告する内容:

- 全体のpass/fail件数（例: `3/5 passed`）— 上記で書き出したeval単位の結果から算出したもの。
- eval単位の結果: eval `id`/`name`、各expectationのpass/failとそのevidence。

これをプレーンテキストまたはJSONとして、回答の中で出力すること — ユーザーのリクエストが示唆する方を選び、指定がなければテキストをデフォルトとする。この結果について、HTMLビューア（`eval-viewer`）を生成したり開いたりすることは**決して**しないこと — そのツールは`skill-creator`が自身のワークフローのために持つものであり、ここでは対象外である。

JSON形式を選ぶ場合、レポートは次のような形になる:

```json
{
  "skill_name": "example-skill",
  "summary": { "passed": 3, "failed": 2, "total": 5 },
  "results": [
    {
      "id": 0,
      "name": "issue-N_REQ-M_short_description",
      "expectations": [
        { "text": "...", "passed": true, "evidence": "..." }
      ]
    }
  ]
}
```

## skill descriptionのトリガー精度を検証する（Step 1〜3とは別枠）

トリガー精度 — skillの`description`がClaudeを正しいクエリで起動させるかどうか — は、いったん起動したskillが正しく*振る舞う*かどうか（上記Step 1〜3）とは別の問題であり、eval-setの形も異なる（`{prompt, expected_output, expectations}`ではなく`{query, should_trigger}`）。これを自前で再実装しないこと: `skill-creator`自身のスクリプトを直接呼び出すこと。

まず、インストール済みの`skill-creator`プラグイン内にある`run_eval.py`を探すこと — pluginキャッシュ配下の深さを固定と決めつけない（marketplace/versionのセグメントが変わりうる）、ファイル自体を検索すること:

```bash
find ~/.claude/plugins/cache -iname run_eval.py -path "*/skill-creator/*"
```

見つからない場合は、パスを推測するのではなく、`skill-creator`がインストールされていないとユーザーに伝えること — これはこのステップの前提であり、このskillが代替できるものではない。

`run_eval.py`はパッケージパスで兄弟モジュール`scripts.utils`をimportするため、working directoryを自身の親の親ディレクトリ（`skill-creator`のskillディレクトリ、すなわち`run_eval.py`自体から2階層上 — `scripts/run_eval.py` → `scripts/` → `skills/skill-creator/`）に設定した上で、moduleとして実行しなければならない — 単なるスクリプトパスとして別の場所から呼び出す（`python .../scripts/run_eval.py ...`）と`ModuleNotFoundError: No module named 'scripts'`で失敗する:

```bash
cd "$(dirname "$(dirname "<path-to-run_eval.py-from-the-find-above>")")"
python -m scripts.run_eval --eval-set <trigger-eval-set.json> --skill-path <target-skill-path>
```

そのスクリプト自身の`--help`で全フラグ（`--description`、`--num-workers`、`--timeout`、`--runs-per-query`、`--trigger-threshold`、`--model`、`--verbose`）を確認すること。出力された内容はそのままユーザーに報告すること — Step 2〜3の採点フォーマットで後処理・再要約しないこと。すでにそれ自体でトリガー率の結果を生成しているためである。

## このrunnerが採点するskillのevals.jsonを書く

このskillが実行する`evals/evals.json`を新規作成・更新する際は、`skill-creator`のスキーマを使うこと — eval1件ごとに、`{name, description}`のオブジェクト配列である`assertions`ではなく、検証可能な文の文字列配列である`expectations`を使う:

```json
{
  "skill_name": "example-skill",
  "evals": [
    {
      "id": 0,
      "name": "issue-N_REQ-M_short_description",
      "prompt": "...",
      "expected_output": "...",
      "files": [],
      "expectations": ["...", "..."]
    }
  ]
}
```

このskill自身の`evals/evals.json`（このファイルの隣にある）もその形式に従っている。`evals.json`がまだ古い`assertions`形式のままの既存sd-tdd skillについては、このskillでは移行を行わない — その移行作業は別の後続タスクである。このrunnerの採点ステップ（Step 2）は`expected_output`/`expectations`のみを読むため、未移行の`assertions`形式のファイルは、変換されるまでここでは正しく採点されない。
