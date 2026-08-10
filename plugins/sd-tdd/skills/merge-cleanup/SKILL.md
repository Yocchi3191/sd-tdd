---
name: merge-cleanup
description: Use when the user reports that a PR/branch has just been merged (e.g. "merge done", "マージ完了", "マージ済みです") — verifies the merge actually happened via gh/git before touching anything, then updates the default branch and removes the merged branch and its dedicated worktree if any. Never runs based on the utterance alone; always confirms actual merged state first. Does not reinstall dependencies (node_modules etc.).
---

# Merge Cleanup

PRマージ後にローカル状態をクリーンアップする: 既定ブランチを最新化し、マージ済みのローカルブランチを削除し、その専用git worktreeを削除する — ただしマージが実際に起きたことを独自に確認した後にのみ行う。ユーザーが「マージ完了」と言うことは確認のきっかけであって、行動の許可証ではない。

## Step 1: トリガーを認識し、次に検証する — 発言のみを根拠に行動しない

マージを報告している可能性がある発言はすべてトリガー**候補**として扱う（例: 「merge done」「マージ完了しました」「マージ済みです」「PRマージしました」）。そのようなシグナルがない発言（例: 「テストを直して」等、無関係な依頼）は候補ではない — 何もせず、以下のステップには進まない。

トリガー候補と判断した場合でも、Step 3以降のアクションはまだ実行しない。まず確認対象のPRを特定する:

- 発言（または進行中の会話）が特定のブランチ名やissue番号を挙げている場合、そのPRを明示的に特定する: `gh pr view <branch>`、あるいは指定されたissueから対応するPRをまず特定する。
- それ以外の場合は現在のブランチをデフォルトとする（引数なしの`gh pr view`）— ただし、現在のブランチが実際にユーザーの意図するものであることを確認した上で行う。セッションのcwdがユーザーの意図するworktree/ブランチとは別のものへ既に移動している場合、「現在のブランチ」で解決すると気づかぬまま誤ったPRを確認してしまう。判断に迷う場合は推測せず、どのブランチ/PRを指しているかユーザーに確認する。

```bash
gh pr view [<branch>] --json state,headRefName
```

- **`state`が`MERGED`の場合:** Step 2へ進む。
- **`state`がそれ以外（`OPEN`、`DRAFT`等）、または現在のブランチに対応するPRが見つからない場合:** ここで停止する。実際の状態をユーザーに報告し（例: 「PR #N はまだ OPEN です。マージが確認できないため、クリーンアップは行いませんでした。」）、Step 2以降は一切実行しない。この確認は、発言だけを根拠に破壊的操作が実行されないようにするために存在する — 決して省略せず、「ユーザーがそう言ったから」だけを十分な確認として扱わない。

## Step 2: 対象ブランチとそのworktreeを特定する

- 対象ブランチはStep 1で確認したPRの`headRefName`である — 今回の実行が触れるのは*このブランチのみ*。
- 専用worktreeが存在するか確認する:

```bash
git worktree list
```

対象ブランチをcheckoutしているworktreeを照合する。該当がなければ、専用worktreeは存在しない（Step 5の「worktreeなし」の経路を参照）。

## Step 3: 何も切り替えずに既定ブランチを更新する

リポジトリの既定ブランチ（`gh repo view --json defaultBranchRef`等で取得）を、checkoutせず、また現在のworktree/ブランチを切り替えることもなく、ローカル参照を直接更新することで最新化する:

```bash
git fetch origin <default-branch>:<default-branch>
```

既定ブランチが別のworktreeでcheckoutされていたとしても、この操作は参照を更新するだけで作業ツリーには触れないため安全に実行できる。以降のステップの結果にかかわらずこれは実行する — 未コミットの変更やworktreeの状態によってブロックされることはない。

（現在のブランチ自体が既定ブランチである場合 — Step 1で特定した対象ブランチはマージされたばかりのfeatureブランチであるため通常は想定しないケースだが — その場合は単純にその場で`git pull`する方がシンプルで問題ない。）

## Step 4: 削除前に未コミットの変更を確認する

対象ブランチの作業ツリー（専用worktreeがあればそこ、なければcheckoutされている場所）で、staged・unstaged・untrackedの変更を確認する:

```bash
git status --porcelain
```

**何らかの出力がある場合（staged/unstaged/untrackedいずれか）:** ブランチやworktreeを削除する前に停止する。未コミットの変更が残っており何も削除しなかった旨をユーザーに報告する（例: 「未コミットの変更が残っているため、ブランチ/worktreeの削除は行いませんでした。」）。Step 3はこれに関係なく既に実行済みである — これを理由に取り消したり省略したりしない。

**出力がない場合（クリーン）:** Step 5へ進む。

## Step 5: worktreeがあれば削除する — カレントディレクトリになっている場合は先に退避する

Step 2で対象ブランチの専用worktreeが見つかった場合:

- **そのworktreeが現在のシェルセッションのカレントディレクトリである場合:** gitはアクティブなcwdになっているworktreeを削除できない — しかしStep 1で既にマージを確実に確認済みであるため、これは停止してユーザーに委ねる理由にはならない。退避した上で、以下のいずれか該当する削除方法で削除する:
  - 以下の`ExitWorktree`/ネイティブツールの経路が該当する場合は、それをそのまま呼び出す — その`remove`アクションはworktree削除の一部としてセッションの作業ディレクトリを既に復元するため、別途の退避ステップは不要。
  それ以外の場合は、まずセッションのカレントディレクトリをリポジトリ本体の作業ツリー（そのルートのcheckout — 他のディレクトリではない）へ移動してから、以下のとおり`git worktree remove`を実行する。
  これはworktreeを元々誰が作成したかにかかわらず適用される — 別セッションが作成したものや、手動で`git worktree add`されたものも、マージが確認済みであれば同様に退避・削除する。これは今回のセッション自身が入ったworktreeに限らない。
- **それ以外の場合（cwdではない）:** 以下のいずれか該当する削除方法で直接削除する。

**削除方法**（上記いずれの場合も共通）: *このセッション自身*がネイティブツール経由でまさにこのworktreeに入った場合（例: ハーネスの`EnterWorktree`で作成され、現在のセッションのcwdが現在または過去にそのworktreeだった場合）は、以下の生のgitコマンドではなく、そのツールの削除アクション（例: removeアクション付きの`ExitWorktree`）を優先する — これによりネイティブツールが設定した他の要素（ロック、セッションのcwd、アタッチされたプロセス）も併せて後始末される。`ExitWorktree`のようなネイティブworktree削除ツールは通常*自セッションが作成した*worktreeのみを対象とする。別セッションや過去のセッションが作成したworktreeに対しては（実際には何も削除せず）no-opになるため、このセッション自身が入っていないworktreeには決して使用しない — 別セッションによってロックされているものも含め、その場合は以下のgitコマンドを直接使う:

```bash
git worktree remove <path>
```

worktreeがロックされている（`git worktree list`で`locked`と表示される、またはコマンドが「is locked」と報告する）ためこれが失敗する場合は、先にロックを解除してから再試行する:

```bash
git worktree unlock <path>
git worktree remove <path>
```

### 未マージ/失われるコミットを理由に削除が拒否される場合（squashまたはrebaseマージ）

上記いずれの削除経路も、そのブランチのコミットがディスク上の他の何かの祖先に文字通りなっていないことを理由に拒否する場合がある — `ExitWorktree`はこれを`discard_changes: true`を要求すること（および失われるコミットの一覧を示すこと）で表面化させ、`git worktree remove`は同様の理由で`--force`を必要とする場合がある。これはsquashまたはrebaseマージされたブランチでは想定内の挙動である: Step 1で既にGitHubからPRが実際にマージされたという確実な証拠を得ているにもかかわらず、そのコミットはローカルではどこの祖先にもなりようがない。

上書きする前に、実際に失われる作業がないことを確認する — 以下のStep 6の「not fully merged」ケースと同じ確認である:

```bash
git rev-list origin/<target-branch>..<target-branch>
```

- **出力がない場合（ローカルがpush済みの内容より先に進んでいない）:** GitHubで既にマージ済みの内容を超えて失われるものはない。上書きする前にユーザーへ簡潔に確認する（例: 「squash/rebaseマージのため削除時に〇コミット分の警告が出ていますが、push済み内容を超えるコミットはありません。worktreeを削除してよいですか？」）。確認が取れたら、上書きオプション付きで再試行する（`discard_changes: true`付きの`ExitWorktree`、または`git worktree remove --force <path>`）。
- **何らかの出力がある、またはコマンド自体がエラーになる場合:** 停止する — 上書きしない。push済みの内容を超えるコミットが失われる旨をユーザーに報告する。worktreeは削除しない。

Step 2で専用worktreeが全く見つからなかった場合は、このステップ全体をスキップし（削除対象がないため）、Step 6へ進む。

## Step 6: マージ済みブランチを削除する — このブランチのみ

Step 2で特定した対象ブランチのみを削除する。マージ済みか否かを問わず、他のローカルブランチには一切触れない — これは一般的なブランチの一斉削除ではなく、今回確認したマージに紐づくブランチのみを削除するものである。

- **そのブランチに専用worktreeがあり、Step 5で`ExitWorktree`の`remove`アクションによって削除された場合:** ここで行うことは何もない — `ExitWorktree`の`remove`アクションは、worktreeと*その*ブランチの両方を既に削除している。`git branch -d`は実行しない。ブランチは既に存在しないため、実行すればStep 6が想定していないエラーで失敗する。
- **そのブランチに専用worktreeがあり、Step 5で`git worktree remove`によって削除された場合**（かつてカレントディレクトリだったworktreeを退避した後のケースを含む — Step 5の退避処理を参照）: `ExitWorktree`と異なり、このコマンドはブランチを削除しない — どこにもcheckoutされなくなるだけでブランチ自体はまだ存在する。直接削除する:

```bash
git branch -d <target-branch>
```

- **Step 5がworktreeを削除できなかった場合**（未push分のコミットがあるため未マージ/失われるコミットの上書きが拒否された — Step 5の「未マージ/失われるコミットを理由に削除が拒否される場合」を参照）: 今回の実行ではブランチを削除しない — そのworktreeでまだcheckoutされたままであり、理由は既にStep 5でユーザーに報告済みである。両方ともユーザーの対応に委ねる。
- **そのブランチに専用worktreeがなく、リポジトリ本体の作業ツリーで直接checkoutされている場合:** gitはcheckoutされたブランチの削除を拒否するため、まずその作業ツリーを既定ブランチへ切り替えてから削除する:

```bash
git checkout <default-branch>
git branch -d <target-branch>
```

いずれの削除ケースでも、`git branch -d`が「not fully merged」で拒否した場合、すぐに強制削除しない — この拒否には2つの異なる原因があり、そのうち安全に上書きできるのは一方だけである:

```bash
git rev-list origin/<target-branch>..<target-branch>
```

このコマンド自体がエラーになる場合（例: リモートブランチが既に自動削除・pruneされたことによる「unknown revision」）、出力の有無がクリーンに得られないケースとして、「停止してユーザーに確認する」場合と同様に扱う — クリーンな回答が得られない状態で安全だと決めつけない。

- **出力がない場合（ローカルが最後にpushされた状態より先に進んでいない）:** この拒否は表面上のものにすぎない — squashまたはrebaseマージでは、GitHubがPRを実際にマージ済みと報告していても、そのブランチのコミットが既定ブランチの祖先に文字通りなることは決してない。Step 1で既にGitHubからその確実な証拠を得ており、これはgitのローカルな祖先関係のヒューリスティックに優先するため、`git branch -D <target-branch>`にフォールバックしても安全である。
- **何らかの出力がある場合（ローカルにpush済みの内容を超えるコミットがある）:** 停止する — それらのコミットはGitHubがマージ済みと確認した内容には含まれていないため、強制削除すると実際に作業が失われる。削除する代わりにユーザーへ報告する（例: 「ブランチ `<target-branch>` にpush済みの状態より先のコミットが残っているため、削除しませんでした。」）。

何にも妨げられず完全に成功した場合は、その旨を報告する。例: 「PR #N のマージを確認しました。main を最新化し、ブランチ `<target-branch>` とそのworktreeを削除しました。」

## Step 7: 依存関係の再インストールは絶対に行わない

このskillのスコープはgit/worktreeのクリーンアップまでで終わる。削除したworktreeにインストール済みの依存関係（例: `node_modules`）が含まれていたとしても、クリーンアップの一部として、またはクリーンアップ後に、`npm install`・`pip install`等の依存関係再インストールコマンドを実行しない。依存関係の再構築は全面的にユーザーに委ねる。
