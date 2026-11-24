# プレイ数計測（2026-11-24）

目的: 訪問した人が実際に遊び始めたか、どの難易度が何回遊ばれ、何回最後まで進んだかを知る。Putt・Sweeperの計測と同じ方針で、永続的な訪問者IDは持たない。

## 状態

実装済み・**既定は無効**（`wrangler.hub.jsonc` の `GAMEPLAY_ANALYTICS_MODE` は `"off"`）。公開フラグOFFのゲームなので、公開時に次を順に行う。

1. ハブのプライバシー日英に本ゲームが含まれることを公開する（`hanage-hub` 側の文言は対応済み）。
2. 本番D1へ `migrations/0002_gameplay_events.sql` を適用する。
3. `GAMEPLAY_ANALYTICS_MODE` を `"production"` にして配信する。
4. 本番で一巡し、集計SQLで `visit/start` が入ることを確認する（検証データは削除）。

停止は `"off"` へ戻して配信（旧キャッシュのクライアントにも効く）。終了時は `DELETE FROM gameplay_events`。

## 数えるもの

| event | 発生 | 備考 |
|---|---|---|
| `visit` | ページを開いた | 1タブ訪問につき1件 |
| `start` | 新しい問題を始めた | 「同じ問題を最初から」「別の問題」も新しいプレイ。**保存済みのつづきから再開は数えない** |
| `complete` | 最後まで配置した（`clear`）／答えを見た（`gaveup`） | プレイごとに1件 |

**プレイ数 = `start` の件数**（難易度別に集計可）。固定ステージ（出題ID無し）は対象外。

## 保存するもの・しないもの

- 保存: ランダムなタブ内訪問ID（sessionStorage、30分無操作で更新）、プレイごとのランダムID、イベント、難易度、`clear/gaveup`、流入分類（`x_ads/x_share/x_other/share/hub/search/other/direct` の固定値）、サーバー受信時刻。
- 保存しない: 生URL・UTM文字列・参照元URL・IP・UA・ランキングのプレイヤーID/認証情報・表示名・操作履歴・スコア・出題内容。Cookie・localStorage・永続IDは使わない。
- 受信処理時に30日超を削除。ランキングD1内の別テーブルで、ランキングの表とは結び付けない。
- 送信先は同一オリジンの `api/gameplay-events` のみ。Origin必須・Cookie/Authorization付き拒否・余分な項目拒否・1024bytes超拒否。本番は `hanage.app` 上の `/games/horse-pedigree/play/` のみ送信・受信。`?debug` は除外。

## 集計

```sql
-- 難易度別プレイ数・完走率（受信時刻はUTC epoch ms）
SELECT s.difficulty,
  COUNT(*) AS plays,
  SUM(c.outcome='clear') AS cleared,
  SUM(c.outcome='gaveup') AS gave_up
FROM gameplay_events s
LEFT JOIN gameplay_events c ON c.session_id=s.session_id AND c.run_id=s.run_id AND c.event='complete'
WHERE s.event='start' AND s.received_at >= :from_ms AND s.received_at < :to_ms
GROUP BY s.difficulty;

-- 訪問を分母にした開始率（流入元別）
SELECT v.source, COUNT(*) AS visits,
  COUNT(DISTINCT s.session_id) AS visits_with_a_play
FROM gameplay_events v
LEFT JOIN gameplay_events s ON s.session_id=v.session_id AND s.event='start'
WHERE v.event='visit' AND v.received_at >= :from_ms AND v.received_at < :to_ms
GROUP BY v.source;
```

## 限界

- 人数・日またぎの継続率は測れない（永続IDを使わないため）。新しいタブは別訪問。
- 再開したプレイの `complete` には対応する `start` が無い（再開は新規開始に数えないため）。完走率は期間が短いと100%を超えうるので、`start` に紐づく `complete` だけを使う上のSQLで見る。
- オフライン・通信失敗・ストレージ制限・拡張機能で欠測する。失敗はゲームを止めない。不正送信を完全には防げず、広告費の厳密な精算には使わない。
