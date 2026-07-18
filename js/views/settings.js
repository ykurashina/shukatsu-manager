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
  const isGoogleMode = Store.isGoogleMode;
  const isGoogleConnected = Store.isGoogleConnected;
  const googleUser = Store.googleUser;
  const isOffline = Store.isOffline;

  _container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">設定</h1>
    </div>

    <!-- データ保存 -->
    <div class="settings-section">
      <h2 class="settings-section-title">
        <i data-lucide="cloud"></i> データ同期
      </h2>
      <div class="settings-row">
        <div>
          <div class="settings-label">保存モード</div>
          <div class="settings-description">
            ${isGoogleMode ? 'Googleドライブに同期' : 'ブラウザ内（LocalStorage）に保存'}
            ${isGoogleMode && isGoogleConnected ? ` — ✅ ${googleUser?.email || '接続中'}` : ''}
            ${isGoogleMode && !isGoogleConnected && !isOffline ? ' — ⚠️ 未接続（再ログインが必要です）' : ''}
            ${isOffline ? ' — 📴 オフライン（閲覧のみ）' : ''}
          </div>
        </div>
        <div class="page-actions">
          ${isGoogleMode ? `
            <button class="btn btn-secondary btn-sm" id="google-logout-btn" ${isOffline ? 'disabled' : ''}>
              <i data-lucide="log-out" style="width:14px;height:14px;"></i> Googleからログアウト
            </button>
          ` : `
            <button class="btn btn-primary btn-sm" id="google-login-btn" ${isOffline ? 'disabled' : ''}>
              <i data-lucide="cloud" style="width:14px;height:14px;"></i> Googleドライブで同期
            </button>
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
        <button class="btn btn-secondary btn-sm" id="import-btn" ${isOffline ? 'disabled' : ''}>
          <i data-lucide="upload"></i> インポート
        </button>
        <input type="file" id="import-file-input" accept=".json" style="display:none;">
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-label">全データを削除</div>
          <div class="settings-description">すべてのデータをリセットします。この操作は取り消せません</div>
        </div>
        <button class="btn btn-danger btn-sm" id="clear-btn" ${isOffline ? 'disabled' : ''}>
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
                   value="${settings.gbizToken || ''}" style="flex:1;" ${isOffline ? 'disabled' : ''}>
            <button class="btn btn-primary btn-sm" id="gbiz-token-save-btn" ${isOffline ? 'disabled' : ''}>保存</button>
            ${settings.gbizToken ? `<button class="btn btn-secondary btn-sm" id="gbiz-token-clear-btn" ${isOffline ? 'disabled' : ''}>削除</button>` : ''}
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
          <div class="settings-description">バージョン 2.0.0 — Googleドライブ自動同期対応</div>
        </div>
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-label">対応ブラウザ</div>
          <div class="settings-description">Google Chrome / Safari / Microsoft Edge / Firefox</div>
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

  // Googleドライブログイン
  _container.querySelector('#google-login-btn')?.addEventListener('click', async () => {
    const btn = _container.querySelector('#google-login-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'ログイン中...'; }

    let isTimedOut = false;
    const timeoutId = setTimeout(() => {
      isTimedOut = true;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="cloud" style="width:14px;height:14px;"></i> Googleドライブで同期';
      }
      Toast.warning('ログインがタイムアウトしました。ポップアップがブロックされていないか確認してください。');
    }, 15000); // 15秒でタイムアウト

    const success = await Store.loginWithGoogle();
    clearTimeout(timeoutId);

    if (isTimedOut) return;

    if (success) {
      Toast.success('Googleドライブに接続しました');
      _renderContent();
    } else {
      Toast.error('Googleログインに失敗しました');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="cloud" style="width:14px;height:14px;"></i> Googleドライブで同期'; }
    }
  });

  // Googleログアウト
  _container.querySelector('#google-logout-btn')?.addEventListener('click', () => {
    Modal.confirm('Googleからログアウトしますか？\nデータはブラウザ内保存に切り替わります。', () => {
      Store.logoutFromGoogle();
      Toast.info('Googleからログアウトしました');
      _renderContent();
    }, 'ログアウト');
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
