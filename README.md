# 就活管理 (shukatsu-manager)

ブラウザで動作する、29卒向けの新卒就活管理シングルページアプリケーション（SPA）です。  
GitHub Pages 上にホスティングされており、データはブラウザ内（LocalStorage）またはGoogleドライブに保存されます。

**🌐 アプリURL**: [https://ykurashina.github.io/shukatsu-manager/](https://ykurashina.github.io/shukatsu-manager/)

## 🚀 使い方
1. 上記URLにアクセスします（デスクトップの「就活管理」ショートカットからも開けます）。
2. 初回起動時に**保存モード**を選択します：
   - **ブラウザに保存**（LocalStorage）: ログイン不要。データはそのブラウザ内に保存されます。
   - **Googleドライブで同期**: Googleアカウントでログインし、データをGoogleドライブに自動同期します。複数端末でのデータ共有が可能です。

---

## 📱 機能一覧

| 画面 | 主な機能 |
|---|---|
| **ダッシュボード** | KPI統計（登録企業数・選考中・内定数）、直近の予定、要アクション、就活ニュースフィード |
| **企業管理** | 企業一覧テーブル（フィルター・ソート・検索）、企業詳細モーダル、選考ステップ登録、gBizINFO API連携 |
| **カンバンボード** | ステータスごとのカンバン形式で進捗を可視化 |
| **カレンダー** | 月間カレンダーと日付ごとの予定表示 |
| **ES管理** | ES設問の下書き管理、提出日・文字数カウント、自己分析ノートからの挿入機能 |
| **面接記録** | 面接官人数、雰囲気、質問・回答・反省点の記録 |
| **自己分析ノート** | ガクチカ・自己PR等のカテゴリ別ネタ帳 |
| **ブックマーク** | 就活サイトや企業研究用リンクの管理 |
| **設定** | データ同期設定、バックアップ（JSON）のエクスポート/インポート、gBizINFO APIトークン管理 |

---

## 📁 フォルダ構成

### アプリの土台
*   `index.html`: アプリ全体の骨組みを定義する唯一のHTMLファイル。
*   `favicon.svg`: アプリアイコン（ブラウザタブ・ホーム画面用）。

### デザインシステム（CSS）
*   `css/variables.css`: 色、文字サイズ、余白などの共通デザイン変数。
*   `css/base.css`: 表示リセットと基本フォント設定。
*   `css/layout.css`: サイドバーやメイン領域のレスポンシブレイアウト。
*   `css/components.css`: ボタン、入力欄、モーダル、タブ、ニュースアイテムなどの共通パーツ。
*   `css/*.css`: 各画面（カレンダー、カンバン等）特有のデザイン。

### コアシステム（JavaScript）
*   `js/app.js`: アプリ起動時の初期化、保存先セットアップ画面、全体の統括。
*   `js/store.js`: データ管理（LocalStorage / Google Drive ハイブリッド同期）、CRUD処理、イベント通知。
*   `js/router.js`: 画面の切り替え（SPAルーター）。
*   `js/utils/date.js`: 日付フォーマット変換、カレンダー日付生成、残り日数計算。
*   `js/utils/api.js`: RSSニュースフィード取得（rss2json.com経由）と gBizINFO API 連携。

### 共通UIコンポーネント（JavaScript）
*   `js/components/sidebar.js`: 画面左側のメニューバー。
*   `js/components/modal.js`: 入力用ポップアップ窓。
*   `js/components/toast.js`: 右上お知らせメッセージ。
*   `js/components/form-utils.js`: パスワード表示切替・文字数制限カウンター付き入力欄。

### 各画面（JavaScript）
*   `js/views/dashboard.js`: ダッシュボード。
*   `js/views/companies.js`: 企業管理。
*   `js/views/kanban.js`: カンバンボード。
*   `js/views/calendar.js`: カレンダー。
*   `js/views/es-manager.js`: ES管理。
*   `js/views/interviews.js`: 面接記録。
*   `js/views/notes.js`: 自己分析ノート。
*   `js/views/bookmarks.js`: ブックマーク。
*   `js/views/settings.js`: 設定。

---

## ⚙️ 技術仕様・設計ルール

1.  **データ永続化（ハイブリッド切替）**
    *   **LocalStorage モード**: データはブラウザの LocalStorage に保存されます。
    *   **Google Drive モード**: Google OAuth2 認証後、Google Drive の `shukatsu_data.json` に自動同期されます。ブラウザを閉じても再アクセス時にキャッシュトークンで自動ログインを試みます。
2.  **パスワードセキュリティ**
    *   マイページのパスワードはプレーンテキストで保管されます。
    *   入力画面ではマスク切替（目のアイコン）を表示し、セキュリティ警告を明記しています。
3.  **画面の構築ルール**
    *   SPA構成のため、各画面は `render()` → `init()` → `destroy()` のライフサイクルに従います。
4.  **gBizINFO API 連携（オプション）**
    *   設定画面でAPIトークンを登録すると、企業追加時に企業情報を自動検索・補完できます。
5.  **就活ニュースフィード**
    *   Googleニュース（就活・新卒検索）のRSSを `rss2json.com` 経由で取得し、最新5件を表示します。
6.  **自己分析ノート → ES挿入連携**
    *   ES編集モーダルから自己分析ノートのネタをワンクリック挿入できます。
