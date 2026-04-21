# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

家計簿 (Kakeibo) is a personal/family expense tracker with AI-powered receipt scanning. It consists of:
- A vanilla JS single-page app (`index.html`) deployed via GitHub Pages
- A Google Apps Script backend (`Code.gs`) deployed as a Web App on script.google.com

**No build system, package manager, or test framework.** There are no `npm install`, `build`, `lint`, or `test` commands. Development is done by directly editing the HTML/JS files and refreshing the browser.

## Development Workflow

**Frontend:** Open `index.html` (or `ReceiptFlow.html`, which is a copy) directly in a browser, or via a local HTTP server. Changes are immediately visible on refresh.

**Backend:** Paste `Code.gs` content into script.google.com, then deploy as a Web App. The Apps Script runtime is Google's proprietary JS environment — standard Node.js APIs don't apply.

**Deploying backend changes:**
1. Open script.google.com, find the project
2. Replace the script content with updated `Code.gs`
3. Deploy → New deployment (or update existing deployment)

## Architecture

### Frontend (`index.html`)

Single HTML file with embedded CSS and JS. All state management is manual:

- **Settings** (API keys, Google Apps Script URL, sheet type) stored in `localStorage`, loaded on page init via `loadSettings()`
- **Staging rows** (items queued for upload) held in the `stagingRows` array + synced to `localStorage` via `saveStaging()`
- **Receipt scan flow:** `processImageFile()` → `compressImage()` (canvas-based, client-side) → `startScan()` → Gemini API → parse JSON → push to `stagingRows`
- **Upload flow:** `uploadStaging()` → POST JSON to Apps Script URL → `mode: 'no-cors'` (response is unreadable; user must verify in Sheets)
- Gemini response parsing strips ```json``` fences before `JSON.parse`

### Backend (`Code.gs`)

Google Apps Script that acts as an HTTP endpoint:

- `doPost(e)`: Entry point — parses JSON body, calls `setupSheetsIfNeeded()`, inserts rows, calls `refreshSummaries()`
- `setupSheetsIfNeeded()`: Creates 6 sheets on first run: `個人`, `家庭`, `個人－月報`, `家庭－月報`, `個人－日報`, `家庭－日報`
- `refreshSummaries()`: **Deletes and recreates** all 4 summary sheets from scratch each time to avoid stale data
- Data rows are auto-sorted by date after insertion

### Data Model

Each expense row: `date (YYYY-MM-DD)`, `store`, `item`, `quantity`, `unit`, `price`, `currency`, `category`, `note`

Categories (9): 餐飲, 交通, 購物, 娛樂, 醫療, 水電費, 辦公用品, 住宿, 其他  
Currencies: TWD, JPY, USD, EUR, GBP, HKD, CNY, KRW, SGD, AUD  
Sheet types: `個人` (personal) or `家庭` (family)

## Key Conventions

- **`mode: 'no-cors'`** on the Apps Script POST means fetch always succeeds regardless of backend errors. Errors in `Code.gs` are only visible in the Apps Script execution log.
- **Summary sheets are fully regenerated** on every POST — never partially update them.
- API keys live only in the user's `localStorage`; they're sent directly from the browser to the Gemini API and never pass through the Apps Script backend.
- Settings inputs use a **500ms debounce** before writing to `localStorage`.
- `Logger.log()` in `Code.gs` writes to the Apps Script execution log (View → Executions in script.google.com) — useful for debugging backend issues.
