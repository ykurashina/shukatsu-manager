// toast.js — トースト通知コンポーネント

let _toastContainer = null;

function _ensureContainer() {
  if (_toastContainer) return;
  _toastContainer = document.createElement('div');
  _toastContainer.className = 'toast-container';
  document.body.appendChild(_toastContainer);
}

const ICONS = {
  success: 'check-circle-2',
  error: 'alert-circle',
  warning: 'alert-triangle',
  info: 'info'
};

export const Toast = {
  /**
   * トーストを表示
   * @param {string} message - メッセージ
   * @param {'success'|'error'|'warning'|'info'} [type='info'] - タイプ
   * @param {number} [duration=3000] - 表示時間（ms）
   */
  show(message, type = 'info', duration = 3000) {
    _ensureContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <i data-lucide="${ICONS[type] || ICONS.info}" class="toast-icon"></i>
      <span class="toast-message">${message}</span>
      <button class="toast-close" aria-label="閉じる">
        <i data-lucide="x"></i>
      </button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    });

    _toastContainer.appendChild(toast);

    // Lucideアイコンをレンダリング
    if (window.lucide) window.lucide.createIcons();

    // フェードイン
    requestAnimationFrame(() => {
      toast.classList.add('toast-enter');
    });

    // 自動消去
    if (duration > 0) {
      setTimeout(() => {
        if (toast.parentNode) {
          toast.classList.add('toast-exit');
          setTimeout(() => toast.remove(), 300);
        }
      }, duration);
    }
  },

  success(message, duration) {
    this.show(message, 'success', duration);
  },

  error(message, duration) {
    this.show(message, 'error', duration);
  },

  warning(message, duration) {
    this.show(message, 'warning', duration);
  },

  info(message, duration) {
    this.show(message, 'info', duration);
  }
};
