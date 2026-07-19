// app.js — メインアプリケーションエントリーポイント

import { Store } from './store.js';
import { Router } from './router.js';
import { Sidebar } from './components/sidebar.js';
import { Toast } from './components/toast.js';

// Views
import * as DashboardView from './views/dashboard.js';
import * as CompaniesView from './views/companies.js';
import * as KanbanView from './views/kanban.js';
import * as ESManagerView from './views/es-manager.js';
import * as CalendarView from './views/calendar.js';
import * as InterviewsView from './views/interviews.js';
import * as NotesView from './views/notes.js';
import * as BookmarksView from './views/bookmarks.js';
import * as SettingsView from './views/settings.js';

// ヘッダータイトルマッピング
const PAGE_TITLES = {
  dashboard: 'ダッシュボード',
  companies: '企業管理',
  kanban: 'カンバンボード',
  'es-manager': 'ES管理',
  calendar: 'カレンダー',
  interviews: '面接記録',
  notes: '自己分析ノート',
  bookmarks: 'ブックマーク',
  settings: '設定'
};

class App {
  constructor() {
    this.router = new Router();
    this.sidebar = null;
  }

  async start() {
    // ストアの初期化
    await Store.init();

    // Googleモードで再訪問時（オフラインならキャッシュで起動、オンラインなら再ログイン）
    if (Store.isGoogleMode && !Store.isGoogleConnected) {
      if (Store.isOffline) {
        // オフライン: キャッシュデータで読み取り専用表示
        this._showApp();
        return;
      }
      // オンラインだがトークン切れ: ログイン画面を表示
      this._showSetupScreen();
      return;
    }

    // 保存モードが未選択 → セットアップ画面を表示
    if (!Store.isStorageModeSelected) {
      this._showSetupScreen();
      return;
    }

    this._showApp();
  }

  _showSetupScreen() {
    const setupScreen = document.getElementById('setup-screen');
    const app = document.getElementById('app');
    setupScreen.style.display = '';
    app.style.display = 'none';

    // ブラウザ内保存
    document.getElementById('setup-local-btn').addEventListener('click', () => {
      Store.selectLocalMode();
      Toast.info('ブラウザ内保存モードで開始します');
      setupScreen.style.display = 'none';
      this._showApp();
    });

    // Googleドライブ同期
    document.getElementById('setup-google-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('setup-google-btn');
      btn.disabled = true;
      btn.textContent = 'ログイン中...';

      // 3秒後にボタンを再有効化（ログイン画面を閉じた場合にフリーズしないため）
      const reenableId = setTimeout(() => {
        btn.disabled = false;
        btn.textContent = 'Googleアカウントでログイン';
      }, 3000);

      const success = await Store.loginWithGoogle();
      clearTimeout(reenableId);

      if (success) {
        Toast.success('Googleドライブに接続しました');
        setupScreen.style.display = 'none';
        this._showApp();
      } else {
        btn.disabled = false;
        btn.textContent = 'Googleアカウントでログイン';
      }
    });

    // Lucide アイコンを初期化
    if (window.lucide) window.lucide.createIcons();
  }

  _showApp() {
    const setupScreen = document.getElementById('setup-screen');
    const app = document.getElementById('app');

    setupScreen.style.display = 'none';
    app.style.display = '';

    // サイドバー初期化
    const sidebarEl = document.getElementById('sidebar');
    this.sidebar = new Sidebar(sidebarEl, (route) => {
      // モバイルでのサイドバー閉じ
      this.sidebar.close();
    });

    // モバイルメニューボタン
    document.getElementById('mobile-menu-btn').addEventListener('click', () => {
      this.sidebar.open();
    });

    // ストレージインジケーター更新
    this._updateStorageIndicator();

    // オフラインバナーの初期表示
    this._updateOfflineBanner();

    // ルーター初期化
    this.router.setContainer(document.getElementById('main-content'));
    this.router.register('dashboard', DashboardView);
    this.router.register('companies', CompaniesView);
    this.router.register('kanban', KanbanView);
    this.router.register('es-manager', ESManagerView);
    this.router.register('calendar', CalendarView);
    this.router.register('interviews', InterviewsView);
    this.router.register('notes', NotesView);
    this.router.register('bookmarks', BookmarksView);
    this.router.register('settings', SettingsView);

    this.router.onNavigate((hash) => {
      // サイドバーのアクティブ状態更新
      this.sidebar.setActive(hash);
      // ヘッダータイトル更新
      document.getElementById('header-title').textContent = PAGE_TITLES[hash] || '';
    });

    this.router.start();

    // イベント監視
    Store.onDataChange((event) => {
      // 同期状態の更新（ヘッダーのアイコンを切り替え）
      if (event === 'sync_start' || event === 'sync_end' || event === 'google_login' || event === 'google_logout') {
        this._updateStorageIndicator();
      }
      // オンライン/オフライン切替の監視
      if (event === 'online' || event === 'offline') {
        this._updateOfflineBanner();
        this._updateStorageIndicator();
      }
    });

    // Lucide アイコン初期化
    if (window.lucide) window.lucide.createIcons();
  }

  _updateStorageIndicator() {
    const indicator = document.getElementById('storage-indicator');
    if (Store.isOffline) {
      indicator.className = 'storage-indicator offline-mode';
      indicator.innerHTML = `<i data-lucide="wifi-off" style="width:14px;height:14px;"></i> <span class="indicator-text">オフライン</span>`;
    } else if (Store.isGoogleMode) {
      const user = Store.googleUser;
      const syncIcon = Store.isGoogleSyncing ? 'loader' : 'cloud';
      indicator.className = 'storage-indicator google-mode';
      indicator.innerHTML = `
        <i data-lucide="${syncIcon}" style="width:14px;height:14px;"></i>
        <span class="indicator-text">${user?.email ? user.email : 'Googleドライブ'}</span>
      `;
    } else {
      indicator.className = 'storage-indicator local-mode';
      indicator.innerHTML = `<i data-lucide="globe" style="width:14px;height:14px;"></i> <span class="indicator-text">ブラウザ内保存</span>`;
    }
    if (window.lucide) window.lucide.createIcons();
  }

  _updateOfflineBanner() {
    const banner = document.getElementById('offline-banner');
    if (banner) {
      banner.style.display = Store.isOffline ? 'flex' : 'none';
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

// --- アプリ起動 ---
const app = new App();
app.start().catch(console.error);
