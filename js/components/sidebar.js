// sidebar.js — サイドバーナビゲーション

const NAV_ITEMS = [
  { id: 'dashboard', icon: 'layout-dashboard', label: 'ダッシュボード' },
  { id: 'companies', icon: 'building-2', label: '企業管理' },
  { id: 'kanban', icon: 'columns-3', label: 'カンバン' },
  { id: 'es-manager', icon: 'file-text', label: 'ES管理' },
  { id: 'calendar', icon: 'calendar', label: 'カレンダー' },
  { id: 'interviews', icon: 'message-square', label: '面接記録' },
  { id: 'notes', icon: 'notebook-pen', label: '自己分析ノート' },
  { id: 'bookmarks', icon: 'bookmark', label: 'ブックマーク' },
  { id: 'settings', icon: 'settings', label: '設定' },
];

export class Sidebar {
  constructor(container, onNavigate) {
    this._container = container;
    this._onNavigate = onNavigate;
    this._collapsed = false;
    this.render();
  }

  render() {
    this._container.innerHTML = '';

    // ロゴエリア
    const logo = document.createElement('div');
    logo.className = 'sidebar-logo';
    logo.innerHTML = `
      <div class="sidebar-logo-icon">
        <i data-lucide="briefcase-business"></i>
      </div>
      <span class="sidebar-logo-text">就活管理</span>
    `;
    this._container.appendChild(logo);

    // ナビゲーション
    const nav = document.createElement('nav');
    nav.className = 'sidebar-nav';

    for (const item of NAV_ITEMS) {
      const link = document.createElement('a');
      link.href = `#${item.id}`;
      link.className = 'sidebar-nav-item';
      link.dataset.route = item.id;
      link.innerHTML = `
        <i data-lucide="${item.icon}"></i>
        <span class="sidebar-nav-label">${item.label}</span>
      `;
      link.addEventListener('click', (e) => {
        e.preventDefault();
        if (this._onNavigate) this._onNavigate(item.id);
        window.location.hash = item.id;
      });
      nav.appendChild(link);
    }

    this._container.appendChild(nav);

    // 折りたたみボタン
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'sidebar-toggle';
    toggleBtn.innerHTML = '<i data-lucide="panel-left-close"></i>';
    toggleBtn.addEventListener('click', () => this.toggle());
    this._container.appendChild(toggleBtn);

    // モバイル用オーバーレイ
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.addEventListener('click', () => this.close());
    document.body.appendChild(overlay);
  }

  setActive(routeId) {
    const items = this._container.querySelectorAll('.sidebar-nav-item');
    items.forEach(item => {
      item.classList.toggle('active', item.dataset.route === routeId);
    });
  }

  toggle() {
    this._collapsed = !this._collapsed;
    document.body.classList.toggle('sidebar-collapsed', this._collapsed);
    const icon = this._container.querySelector('.sidebar-toggle i');
    if (icon) {
      icon.setAttribute('data-lucide', this._collapsed ? 'panel-left-open' : 'panel-left-close');
      if (window.lucide) window.lucide.createIcons();
    }
  }

  open() {
    document.body.classList.add('sidebar-open');
  }

  close() {
    document.body.classList.remove('sidebar-open');
  }
}
