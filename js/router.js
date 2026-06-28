// router.js — ハッシュベースのSPAルーター

export class Router {
  constructor() {
    this._routes = {};
    this._currentView = null;
    this._container = null;
    this._onNavigateCallbacks = [];
  }

  setContainer(container) {
    this._container = container;
  }

  register(hash, viewModule) {
    this._routes[hash] = viewModule;
  }

  onNavigate(callback) {
    this._onNavigateCallbacks.push(callback);
  }

  start() {
    window.addEventListener('hashchange', () => this._handleRoute());
    this._handleRoute();
  }

  navigateTo(hash) {
    window.location.hash = hash;
  }

  getCurrentRoute() {
    return window.location.hash.slice(1) || 'dashboard';
  }

  async _handleRoute() {
    const hash = this.getCurrentRoute();
    const viewModule = this._routes[hash];

    if (!viewModule) {
      // 未登録のルート → ダッシュボードにリダイレクト
      this.navigateTo('#dashboard');
      return;
    }

    // 現在のビューを破棄
    if (this._currentView && this._currentView.destroy) {
      this._currentView.destroy();
    }

    // コンテナをクリア
    if (this._container) {
      this._container.innerHTML = '';
    }

    // 新しいビューをレンダリング
    this._currentView = viewModule;
    if (viewModule.render) {
      viewModule.render(this._container);
    }
    if (viewModule.init) {
      viewModule.init();
    }

    // ナビゲーションコールバック
    for (const cb of this._onNavigateCallbacks) {
      try { cb(hash); } catch (e) { console.error(e); }
    }
  }
}
