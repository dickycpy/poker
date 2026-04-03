<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/28ab1fbb-92b5-4f69-b069-e5d8b3ecbab3

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
   
# 味真香慈善啤王大賽 (Poker Tracker)

呢個係一個專為「味真香慈善啤王大賽」而設嘅戰報追蹤應用程式。

## 功能
- **戰報儀表板**：即時查看今日賭神 (Top 3) 同埋提款機 (Bottom 3)。
- **戰力分佈圖**：用圖表顯示各個損友嘅贏輸情況。
- **入帳功能**：快速記錄每一場嘅贏輸，支援日期選擇。
- **損友管理**：管理參賽球員名單。
- **即時更新**：使用 Firebase Firestore 實時同步數據。

## 技術棧
- **Frontend**: React 19, Vite, Tailwind CSS, Recharts, Framer Motion (Motion)
- **Backend/Database**: Firebase Firestore
- **Icons**: Lucide React

## 部署說明 (Vercel)
1. 將程式碼推送到 GitHub。
2. 喺 Vercel 匯入專案。
3. Vercel 會自動偵測 Vite 設定。
4. 構建指令 (Build Command): `npm run build`
5. 輸出目錄 (Output Directory): `dist`

## 本地開發
```bash
npm install
npm run dev
```

## 聲明
本程式僅供娛樂及記錄用途，小賭怡情，大賭亂性。
