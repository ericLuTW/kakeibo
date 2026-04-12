# 家計簿

個人與家庭收據掃描及支出追蹤工具。透過 AI 辨識收據圖片，自動擷取品項資訊，一鍵上傳至 Google 試算表。

## 連結

- **應用程式：** https://ericlutw.github.io/kakeibo/index.html
- **Apps Script 後端：** https://script.google.com/macros/s/AKfycbzAZgygwrPV4m2VKlzhkUkC-xhvk2O35yHGGZ-wLpAxXhORPUN7hCaaOE2XDzIMgP3QsA/exec

## 功能

- **AI 收據掃描** — 上傳收據圖片，透過 Gemini API 自動辨識商家、品項、金額
- **手動輸入** — 快速新增支出記錄至暫存區
- **暫存區** — 批次確認與編輯後一次上傳
- **自動報表** — Google 試算表自動產生月報與日報（依類別彙總）
- **多幣別** — 支援 TWD、JPY、USD 等常見幣別
- **個人 / 家庭分類** — 支出自動分流至不同工作表

## 使用方式

### 1. 部署 Google Apps Script

1. 建立一個新的 Google 試算表
2. 從試算表選單進入 **Extensions（擴充功能）→ Apps Script**
3. 刪除預設程式碼，將 `Code.gs` 的內容貼上
4. 儲存後點選 **部署 → 新增部署作業**
5. 類型選擇 **網頁應用程式**
6. 設定如下：
   - **執行身分：** 我
   - **誰可以存取：** 所有人
7. 點選 **部署**，首次會要求授權，請點選允許
8. 複製產生的 Web App 網址（格式為 `https://script.google.com/macros/s/.../exec`）

> **注意：** 首次收到資料時，Apps Script 會自動建立 6 張工作表（個人、家庭、個人－月報、家庭－月報、個人－日報、家庭－日報），無需手動設定。

### 2. 取得 Gemini API 金鑰

1. 前往 [Google AI Studio](https://aistudio.google.com/)
2. 建立 API 金鑰
3. 複製金鑰備用

### 3. 開啟家計簿

- **電腦：** 直接開啟 `ReceiptFlow.html`，或前往 GitHub Pages 網址
- **手機：** 用瀏覽器開啟 GitHub Pages 網址

首次使用時，進入 **設定** 頁面填入：
- Gemini API 金鑰
- Google Apps Script Web App 網址

這些設定會儲存在瀏覽器的 localStorage 中，每台裝置需各自設定一次。

## 工作表結構

| 工作表 | 說明 |
|---|---|
| 個人 | 個人支出原始資料 |
| 家庭 | 家庭支出原始資料 |
| 個人－月報 | 按年月與類別彙總（自動更新） |
| 家庭－月報 | 按年月與類別彙總（自動更新） |
| 個人－日報 | 按日期與類別彙總（自動更新） |
| 家庭－日報 | 按日期與類別彙總（自動更新） |

### 支出類別

`餐飲`、`交通`、`購物`、`娛樂`、`醫療`、`水電費`、`辦公用品`、`住宿`、`其他`

## 注意事項

- 本工具為個人使用設計，Gemini API 金鑰僅儲存在使用者的瀏覽器中，請勿在共用電腦上保存
- 由於本機 HTML 搭配 Apps Script 的架構限制（`no-cors`），送出資料後無法即時確認伺服器端結果，請至 Google 試算表確認是否寫入成功
- 月報與日報於每次新增資料時自動更新，無需手動操作

## 檔案說明

| 檔案 | 說明 |
|---|---|
| `ReceiptFlow.html` / `index.html` | 前端應用程式（單一 HTML 檔案） |
| `Code.gs` | Google Apps Script 後端程式碼 |
