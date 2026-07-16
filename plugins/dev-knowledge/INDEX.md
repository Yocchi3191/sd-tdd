# dev-knowledge INDEX

`dev-knowledge` プラグインが蓄積した知見の索引。各行が1知見への1行フックで、詳細本文は `references/<domain>/<slug>.md` にある。

`recall-insight` はまずこのファイルだけを読み、関連しそうな行が見つかった時だけ対応するファイル本体を読み込む(全文grepはしない)。`capture-insight` は新規知見を確認した後、ここに1行追記する。

フォーマット: `- [<name>](references/<domain>/<slug>.md): <description>`

<!-- 以下に知見を1行ずつ追記していく -->
- [layered-statefulness](references/design/layered-statefulness.md): レイヤーごとにステートフル/レスを判断し、Presentation層はステートレスに保つ
