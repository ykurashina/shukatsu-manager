// settings.js — 設定ビュー

import { Store } from '../store.js';
import { Modal } from '../components/modal.js';
import { Toast } from '../components/toast.js';

let _container = null;

export function render(container) {
  _container = container;
  _renderContent();
}

export function init() {}

export function destroy() {
  _container = null;
}

function _renderContent() {
  if (!_container) return;

  const settings = Store.getSettings();
  const isFileMode = Store.isFileMode;
  const isFileConnected = Store.isFileConnected;

  _container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">設定</h1>
    </div>

    <!-- データ保存 -->
    <div class="settings-section">
      <h2 class="settings-section-title">
        <i data-lucide="hard-drive"></i> データ保存
      </h2>
      <div class="settings-row">
        <div>
          <div class="settings-label">保存モード</div>
          <div class="settings-description">
            ${isFileMode ? 'パソコン内のファイルに保存' : 'ブラウザ内（LocalStorage）に保存'}
            ${isFileMode && isFileConnected ? ' — ✅ 接続中' : ''}
            ${isFileMode && !isFileConnected ? ' — ⚠️ 未接続' : ''}
          </div>
        </div>
        <div class="page-actions">
          ${isFileMode && !isFileConnected ? `
            <button class="btn btn-primary btn-sm" id="reconnect-btn">ファイルを再接続</button>
          ` : ''}
          ${isFileMode ? `
            <button class="btn btn-secondary btn-sm" id="switch-local-btn">ブラウザ内保存に切替</button>
          ` : `
            ${Store.supportsFileSystemAccess() ? `
              <button class="btn btn-primary btn-sm" id="switch-file-btn">ファイル保存に切替</button>
            ` : ''}
          `}
        </div>
      </div>
    </div>

    <!-- データ管理 -->
    <div class="settings-section">
      <h2 class="settings-section-title">
        <i data-lucide="database"></i> データ管理
      </h2>
      <div class="settings-row">
        <div>
          <div class="settings-label">データをエクスポート</div>
          <div class="settings-description">全データをJSONファイルとしてダウンロードします</div>
        </div>
        <button class="btn btn-secondary btn-sm" id="export-btn">
          <i data-lucide="download"></i> エクスポート
        </button>
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-label">データをインポート</div>
          <div class="settings-description">JSONファイルからデータを復元します（現在のデータは上書きされます）</div>
        </div>
        <button class="btn btn-secondary btn-sm" id="import-btn">
          <i data-lucide="upload"></i> インポート
        </button>
        <input type="file" id="import-file-input" accept=".json" style="display:none;">
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-label">全データを削除</div>
          <div class="settings-description">すべてのデータをリセットします。この操作は取り消せません</div>
        </div>
        <button class="btn btn-danger btn-sm" id="clear-btn">
          <i data-lucide="trash-2"></i> 全データ削除
        </button>
      </div>
    </div>

    <!-- gBizINFO API連携 -->
    <div class="settings-section">
      <h2 class="settings-section-title">
        <i data-lucide="globe"></i> gBizINFO API連携
      </h2>
      <div class="settings-row">
        <div style="flex:1;">
          <div class="settings-label">APIトークン</div>
          <div class="settings-description">企業情報（資本金・住所等）の自動取得に使用します。<br>
            <a href="https://info.gbiz.go.jp/hojin/APIUseTop" target="_blank" rel="noopener noreferrer" style="color:var(--primary);">APIトークンの無料申請はこちら（経産省 gBizINFO）</a>
          </div>
          <div style="display:flex; gap:var(--sp-2); margin-top:var(--sp-2); max-width:480px;">
            <input type="text" class="form-input" id="gbiz-token-input"
                   placeholder="トークンを入力（未設定でもアプリは動作します）"
                   value="${settings.gbizToken || ''}" style="flex:1;">
            <button class="btn btn-primary btn-sm" id="gbiz-token-save-btn">保存</button>
            ${settings.gbizToken ? '<button class="btn btn-secondary btn-sm" id="gbiz-token-clear-btn">削除</button>' : ''}
          </div>
        </div>
      </div>
    </div>

    <!-- アプリ情報 -->
    <div class="settings-section">
      <h2 class="settings-section-title">
        <i data-lucide="info"></i> アプリ情報
      </h2>
      <div class="settings-row">
        <div>
          <div class="settings-label">就活管理</div>
          <div class="settings-description">バージョン 1.1.0 — ブラウザベースの新卒就活管理アプリ</div>
        </div>
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-label">推奨ブラウザ</div>
          <div class="settings-description">Google Chrome / Microsoft Edge（ファイル保存機能に必要）</div>
        </div>
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-label" style="color: var(--warning);">⚠️ パスワードに関する注意</div>
          <div class="settings-description">マイページのパスワードはプレーンテキストで保存されます。他人と共有するPCではパスワードの保存を避けてください。</div>
        </div>
      </div>
    </div>
  `;

  // --- イベントリスナー ---

  // ファイル再接続
  _container.querySelector('#reconnect-btn')?.addEventListener('click', async () => {
    const success = await Store.reconnectFile();
    if (success) {
      Toast.success('ファイルに再接続しました');
      _renderContent();
    }
  });

  // ブラウザ内保存に切替
  _container.querySelector('#switch-local-btn')?.addEventListener('click', () => {
    Modal.confirm('ブラウザ内保存に切り替えますか？\n（データは保持されます）', () => {
      Store.selectLocalMode();
      Toast.info('ブラウザ内保存に切り替えました');
      _renderContent();
    }, '切替');
  });

  // ファイル保存に切替
  _container.querySelector('#switch-file-btn')?.addEventListener('click', async () => {
    const success = await Store.selectFileMode();
    if (success) {
      Toast.success('ファイル保存に切り替えました');
      _renderContent();
    }
  });

  // エクスポート
  _container.querySelector('#export-btn')?.addEventListener('click', () => {
    const data = Store.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shukatsu_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.success('データをエクスポートしました');
  });

  // インポート
  const importBtn = _container.querySelector('#import-btn');
  const importInput = _container.querySelector('#import-file-input');
  importBtn?.addEventListener('click', () => importInput?.click());
  importInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Modal.confirm('インポートすると現在のデータが上書きされます。よろしいですか？', () => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const success = Store.importData(ev.target.result);
        if (success) {
          Toast.success('データをインポートしました');
          _renderContent();
        } else {
          Toast.error('インポートに失敗しました。ファイルの形式を確認してください');
        }
      };
      reader.readAsText(file);
    }, 'インポート');
  });

  // 全データ削除
  _container.querySelector('#clear-btn')?.addEventListener('click', () => {
    Modal.confirm('本当にすべてのデータを削除しますか？\nこの操作は取り消せません。', () => {
      Store.clearAllData();
      Toast.success('全データを削除しました');
      _renderContent();
    });
  });

  // gBizINFO APIトークン保存
  _container.querySelector('#gbiz-token-save-btn')?.addEventListener('click', () => {
    const tokenInput = _container.querySelector('#gbiz-token-input');
    const token = tokenInput?.value?.trim() || '';
    Store.updateSettings({ gbizToken: token });
    Toast.success('APIトークンを保存しました');
    _renderContent();
  });

  // gBizINFO APIトークン削除
  _container.querySelector('#gbiz-token-clear-btn')?.addEventListener('click', () => {
    Store.updateSettings({ gbizToken: '' });
    Toast.success('APIトークンを削除しました');
    _renderContent();
  });

  if (window.lucide) window.lucide.createIcons();
}
