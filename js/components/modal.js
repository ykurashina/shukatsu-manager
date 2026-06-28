// modal.js — モーダルダイアログコンポーネント

let _modalOverlay = null;
let _onCloseCallback = null;

function _ensureOverlay() {
  if (_modalOverlay) return;
  _modalOverlay = document.createElement('div');
  _modalOverlay.className = 'modal-overlay';
  _modalOverlay.addEventListener('click', (e) => {
    if (e.target === _modalOverlay) Modal.close();
  });
  document.body.appendChild(_modalOverlay);
}

export const Modal = {
  /**
   * モーダルを開く
   * @param {Object} options
   * @param {string} options.title - モーダルタイトル
   * @param {string|HTMLElement} options.content - 本文（HTML文字列 or DOM要素）
   * @param {Function} [options.onSave] - 保存ボタンクリック時のコールバック
   * @param {Function} [options.onClose] - 閉じた時のコールバック
   * @param {string} [options.saveLabel] - 保存ボタンのラベル（デフォルト: '保存'）
   * @param {boolean} [options.hideFooter] - フッター（ボタン）を非表示にするか
   * @param {string} [options.size] - 'small' | 'medium' | 'large' | 'full'
   * @param {string} [options.id] - モーダルのID属性
   */
  open(options = {}) {
    _ensureOverlay();
    _onCloseCallback = options.onClose || null;

    const modal = document.createElement('div');
    modal.className = `modal ${options.size ? `modal-${options.size}` : ''}`;
    if (options.id) modal.id = options.id;

    // ヘッダー
    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = `
      <h2 class="modal-title">${options.title || ''}</h2>
      <button class="modal-close-btn" type="button" aria-label="閉じる">
        <i data-lucide="x"></i>
      </button>
    `;
    header.querySelector('.modal-close-btn').addEventListener('click', () => Modal.close());
    modal.appendChild(header);

    // ボディ
    const body = document.createElement('div');
    body.className = 'modal-body';
    if (typeof options.content === 'string') {
      body.innerHTML = options.content;
    } else if (options.content instanceof HTMLElement) {
      body.appendChild(options.content);
    }
    modal.appendChild(body);

    // フッター
    if (!options.hideFooter) {
      const footer = document.createElement('div');
      footer.className = 'modal-footer';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-secondary';
      cancelBtn.textContent = 'キャンセル';
      cancelBtn.addEventListener('click', () => Modal.close());
      footer.appendChild(cancelBtn);

      if (options.onSave) {
        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn btn-primary';
        saveBtn.textContent = options.saveLabel || '保存';
        saveBtn.addEventListener('click', () => {
          options.onSave(modal);
        });
        footer.appendChild(saveBtn);
      }

      modal.appendChild(footer);
    }

    // 既存モーダルをクリア
    _modalOverlay.innerHTML = '';
    _modalOverlay.appendChild(modal);

    // 表示
    requestAnimationFrame(() => {
      _modalOverlay.classList.add('active');
      modal.classList.add('active');
    });

    // Escキーで閉じる
    document.addEventListener('keydown', Modal._escHandler);

    // Lucideアイコンを再レンダリング
    if (window.lucide) window.lucide.createIcons();

    return modal;
  },

  close() {
    if (!_modalOverlay) return;

    const modal = _modalOverlay.querySelector('.modal');
    if (modal) modal.classList.remove('active');
    _modalOverlay.classList.remove('active');

    setTimeout(() => {
      _modalOverlay.innerHTML = '';
    }, 200);

    document.removeEventListener('keydown', Modal._escHandler);

    if (_onCloseCallback) {
      _onCloseCallback();
      _onCloseCallback = null;
    }
  },

  // モーダルのボディ部分のDOM要素を取得
  getBody() {
    if (!_modalOverlay) return null;
    return _modalOverlay.querySelector('.modal-body');
  },

  // モーダル全体のDOM要素を取得
  getModal() {
    if (!_modalOverlay) return null;
    return _modalOverlay.querySelector('.modal');
  },

  _escHandler(e) {
    if (e.key === 'Escape') Modal.close();
  },

  /**
   * 確認ダイアログ
   * @param {string} message - 確認メッセージ
   * @param {Function} onConfirm - 確認ボタンクリック時のコールバック
   * @param {string} [confirmLabel] - 確認ボタンのラベル
   */
  confirm(message, onConfirm, confirmLabel = '削除') {
    const content = document.createElement('div');
    content.className = 'modal-confirm-content';
    content.innerHTML = `<p>${message}</p>`;

    Modal.open({
      title: '確認',
      content,
      saveLabel: confirmLabel,
      size: 'small',
      onSave: () => {
        onConfirm();
        Modal.close();
      }
    });
  }
};
