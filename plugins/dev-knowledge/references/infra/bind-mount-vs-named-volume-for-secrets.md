---
name: bind-mount-vs-named-volume-for-secrets
description: 認証情報等の永続化キャッシュはbind mountでなくnamed volumeにして誤コミット・誤持ち出しリスクを構造的に無くす
domain: infra
tags: [docker, devcontainer, secrets, volume, security]
origin: Webアプリケーション開発 (2026-07)
---

**原則**: コンテナ再作成後も認証情報(gh CLIトークン、AIツールの認証情報など)を永続化する際は、bind mountではなくDocker named volumeを使う。

**なぜ**: bind mountはプロジェクトルート配下の実ファイルとして作業ツリーに存在し続けるため、`.gitignore`で除外していても`git add -A`やバックアップツール、IDEの全体スキャン等が対象に含めてしまうリスクが構造的に残る。named volumeはDockerが管理する領域に置かれ、そもそもプロジェクトディレクトリの外にあるため、この種の誤持ち出しが原理的に起こらない。

**どう適用するか**: devcontainerやdocker-composeで永続化が必要な秘密情報を扱うときは、まずnamed volumeを検討する。bind mountを選ぶのは、ホスト側から直接ファイルを編集/参照する必要が明確にあり、トレードオフ(`docker compose exec`等の一手間、プロジェクトフォルダのコピーに中身が付いてこないこと)を許容できる場合に限る。
