# 07 Astra（GPT-6）

本目錄為 **Astra** 實驗館的規格摘要。可玩靜態頁在 [`gpt6-astra/`](../gpt6-astra/)，並已寫入 [`data/games.json`](../data/games.json) 的「07 Astra」分類，總覽選單可直接進入。

每款對應一則短規格（本目錄 `*.md`）與 `gpt6-astra/<id>/index.html`。完整 one-shot 提示詞若存在，見同名資料夾內的 `prompt.md`。

## 備註

- 不走 `Games/` Vite workspace；Pages 部署時整包複製 `gpt6-astra/`。
- `3d-sailing`、`3d-fill-the-void`、`borderland` 使用本機 `gpt6-astra/vendor/three/`（three@0.170.0）；`check:no-cdn` 會掃描 `gpt6-astra`。
