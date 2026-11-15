# 競走馬血統ならべ v5：公開手順とランキング検証（2026-11-15）

> **履歴資料**：この文書はv5の当初仕様を記録したものです。最新出題は **v6（初級上位10%、中級6〜8、上級3〜5）**で、ランキングバージョンも `horse-score-v2-v6-12x4` です。現在の難易度・旧v5との互換性と検証結果は [v6難易度再調整](horse-v6-difficulty-2026-11-15.md) を参照してください。Cloudflareの公開手順は基本的に同じですが、最新のv6を配信・検証してから公開してください。

## 実装仕様

- 新出題：難易度3段階、12頭、最大4世代（必ず3〜4世代）、親子の有向関係がすべて既存の血統QIDと一致する
- スコア：実プレイ時間（ms） + ヒント10秒×使用頭数 + 誤回答15秒×回数 + 自動配置45秒×使用頭数。同じ馬のヒントと自動配置は重複計上しない
- 自己ベスト： `horse-score-v1-12x4` と難易度をキーに独立ランキング、匿名ID・検証用credentialを端末保存
- 旧v1〜v4：旧18頭の保存データだけ復元可能。v5の12頭スコアとは混ぜない
- リザルト画面：補正タイム（大）と実時間／ヒント／誤回答／自動配置の内訳、順位、登録／ランキングボタン
- クライアント：`src/ranking-client.js`、`src/app.js`
- サーバー：`src/server/worker.js`、`src/server/ranking-verification.js`
- DB：専用の `horse-pedigree-ranking`（Sweeper/PuttのD1から分離）
- API：`/api/runs`（署名付きチケット）、`/api/records`（スコア検証と1人1自己ベスト）、`/api/rankings`（各難易度＋自分の順位）、`/api/player`（表示名変更・削除）
- ゲームURL：`https://hanage.app/games/horse-pedigree/play/`。ハブ紹介は`https://hanage.app/games/horse-pedigree/`、別タブで遊ぶ。ゲーム内の「ゲーム紹介へ戻る」から紹介へ。
- **未公開時のハブ**：`NEXT_PUBLIC_HORSE_PEDIGREE_PLAY_ENABLED` 未設定または false。ナビとサイトマップに未公開の遊ぶURLは入れない

## 公開前の必須ステップ

1. ゲーム本体のCI `Family tree checks`（ユニット・実ブラウザ Chromium/WebKit）を通す
2. `Horse leaderboard local Worker verification`で**ローカル専用D1**へマイグレーションし、署名付き開始／スコア改ざん拒否／自己ベストのみの更新／同一runの冪等性／ユーザー削除を検証する
3. **別途CloudflareにD1 `horse-pedigree-ranking` を作成し**、得られたUUIDを`wrangler.hub.jsonc` の`database_id` に設定する。`SET_DATABASE_ID_BEFORE_DEPLOY` のままはデプロイ禁止
4. 本番の `RANKING_SECRET` をランダムな32バイト以上の安全な文字列としてCloudflare Worker Secretに登録（ローカル用のダミー文字列を使わない）
5. **リモートD1に**`migrations/0001_horse_ranking.sql` を適用する。独立DBを選び、既存のSweeper/Putt DBには実行しない
6. `npm run build`後、`wrangler.hub.jsonc` により`horse-pedigree-hub`を**2つの該当Routeのみに**公開する。ハブ本体のWorker / ほかのゲームのRouteには触れない
7. **本番HTTPで**ゲーム表示、CSS/JS/JSON読み込み、`/api/health`、実プレイとランキング登録・表示・記録削除・異常スコア拒否を確認。誤って作成したテスト記録は削除
8. 本番Workerを確認できた**後**、ハブの紹介ページ・遊ぶボタンを`NEXT_PUBLIC_HORSE_PEDIGREE_PLAY_ENABLED=true`で有効化しデプロイ。日本語・英語の紹介ページ、別タブで開くゲームURL、戻りリンク、サイトマップを確認
9. AdSense審査への影響を意識し、未完成のAPIや404への遊ぶ導線を公開しない

## 記録の検証範囲と制限

サーバーは署名の正しさ、起点とQIDセットの適格性、3〜4世代・親子連結・知名度（初級）、操作順序・手札・合法な関係・誤答・ヒント・自動配置、タイム加算と開始時刻との差を検証します。**ただし、提示された12頭の集合がその乱数シードから生成される唯一の集合かどうかまでは現段階で再生成照合していません**。完全な改ざん防止や人間の操作を証明する仕組みではなく、今後の強化ポイントです。

クライアントは実時間の自己申告を送信します。チケット発行前の問題はランキング登録対象とせず、ランキング公開後の新しい問題から始めてください。

## ローカルテスト

```sh
npm test
npm run build
npx wrangler@4.47.0 d1 migrations apply horse-pedigree-ranking --local --config wrangler.test.jsonc --persist-to .wrangler/state
node scripts/ranking-worker-smoke.mjs
```

`wrangler.test.jsonc`は本番の秘密鍵・D1 ID・Routeを一切使いません。バックエンドの検証に実Cloudflareの契約認証は不要です。

## GitHub

- ゲーム実装PR： https://github.com/hanagemaru/-family-tree-game/pull/13
- ハブ側導線PR：別途作成
- 過去18頭の実測： `docs/horse-difficulty-benchmark.json`
- 初級知名度調整： `docs/horse-easier-beginner-2026-11-15.md`
