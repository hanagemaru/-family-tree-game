# 競走馬18枚・生成器（作業ブランチ）

## データと再現手順

- `data/source/horse-audit-2026-11-11.json`：GitHub Actions [#43021772462](https://github.com/hanagemaru/-family-tree-game/actions/runs/43021772462) の元データから抽出したQID・名前・父・母。
- `data/source/lineage-audit-2026-11-11.json`：GitHub Actions [#43024294135](https://github.com/hanagemaru/-family-tree-game/actions/runs/43024294135) の13系統の子QID・父母情報。
- `data/horse-pedigree.v1.json`：上記を整形・検査した、**凍結された**ゲーム入力。元ファイルと加工コードを固定すれば再生成できる。
- QIDは個体識別子。父 `P22`・母 `P25` を区別し、名付けが不明な馬はQIDを保持して出題から除外する。データに親が見つからなくても「実際に親がいない」と解釈しない。

```sh
python3 scripts/build_horse_snapshot.py \
  --horse-audit data/source/horse-audit-2026-11-11.json \
  --lineage-audit data/source/lineage-audit-2026-11-11.json
npm test
npm run build
node scripts/benchmark-horse-stages.mjs --runs=1000 --attempts=24
```

Wikidataを再取得してから同じデータを再生成する場合、`--enrich --save-enriched data/source/wikidata-live-entities.json` を付け、生成された原本をコミットする。後日同じソースで再作成するときは `--enriched-input data/source/wikidata-live-entities.json` を使用する。外部APIを使うのは取得時のみで、ゲーム生成とテストはオフライン。

## 処理

1. `scripts/build_horse_snapshot.py`：父母が複数主張される場合、その欄は除外。自己親・父母同一・世代サイクル・生年から不可能と判定できる親子辺も除外し、`docs/horse-data-audit-2026-11-12.json` に理由を保存。同名異個体はQIDを維持し、同一問題内での同名出題を回避する。**実際の血縁を独立した外部原本で照合できたわけではない**。
2. `src/random-horse-stage.js`：再現可能な乱数で起点を選び、父母・産駒・共通親を持つきょうだいから連結集合を拡張。選択時にすべての直接親子世代差が1、兄弟は同世代であることを確認。18頭の候補群を複数作り、世代数・内部の分岐・祖父母ルート・母系・同一父産駒への集中・盤面横幅を加点／減点する。枚数以外の配合比率は固定しない。
3. 採用候補を**既存 `newGame` / `place` / `ensurePlayable`** で全枚配置し、毎ターン `layoutFamily`、最後に `buildDiagram` / `renderGeometry` を実行。360×320の盤面倍率と交差数を算出。失敗した候補は除外。
4. `scripts/benchmark-horse-stages.mjs`：100～1000個以上のシードで成功率、失敗理由、問題重複、系統偏り、世代、分岐、母系、画面幾何を実測。人間の認識しやすさや実際の競馬ファンの正答率は未検証。

## 互換性と範囲

- `src/data.js` の徳川18人／競走馬24頭および `src/app.js` と保存キーは**変更しない**。生成器は別モジュールであり、現在のゲーム画面には追加しない。
- ランダム問題のセーブ／リロードやランキング・画像は実装対象外。将来、問題IDとデータ版の永続化仕様を別途設計する。
- 問題がつながることと、見やすく覚えやすい良問であることは異なる。実測の分布とサンプルの目視評価を踏まえて次の難易度調整を行う。
