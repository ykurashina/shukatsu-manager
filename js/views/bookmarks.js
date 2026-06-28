// bookmarks.js — ブックマークビュー

import { Store, BOOKMARK_CATEGORY_OPTIONS, BOOKMARK_CATEGORY_LABELS } from '../store.js';
import { Modal } from '../components/modal.js';
import { Toast } from '../components/toast.js';
import { FormUtils } from '../components/form-utils.js';

let _unsubscribe = null;
let _container = null;

export function render(container) {
  _container = container;
  _renderContent();
}

export function init() {
  _unsubscribe = Store.onDataChange((event) => {
    if (event.startsWith('bookmark_') || event === 'save' || event === 'import' || event === 'clear') {
      _renderContent();
    }
  });
}

export function destroy() {
  if (_unsubscribe) _unsubscribe();
  _container = null;
}

function _renderContent() {
  if (!_container) return;

  const bookmarks = Store.getBookmarks();

  // カテゴリ別グループ化
  const groups = {};
  BOOKMARK_CATEGORY_OPTIONS.forEach(cat => groups[cat] = []);
  bookmarks.forEach(b => {
    if (!groups[b.category]) groups[b.category] = [];
    groups[b.category].push(b);
  });

  const CATEGORY_ICONS = {
    job_site: 'briefcase',
    research: 'search',
    webtest: 'brain',
    news: 'newspaper',
    other: 'link'
  };

  _container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">ブックマーク</h1>
      <div class="page-actions">
        <button class="btn btn-primary" id="bookmark-add-btn">
          <i data-lucide="plus"></i> ブックマーク追加
        </button>
      </div>
    </div>
    ${bookmarks.length === 0 ? `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="bookmark"></i></div>
        <h3>ブックマークがまだありません</h3>
        <p>よく使うサイトを登録しましょう</p>
      </div>
    ` : BOOKMARK_CATEGORY_OPTIONS.map(cat => {
      const items = groups[cat];
      if (items.length === 0) return '';
      return `
        <div class="bookmark-group">
          <h2 class="bookmark-group-title">
            <i data-lucide="${CATEGORY_ICONS[cat] || 'link'}"></i>
            ${BOOKMARK_CATEGORY_LABELS[cat]}
          </h2>
          <div class="bookmarks-grid">
            ${items.map(b => `
              <div class="bookmark-card" data-id="${b.id}">
                <div class="bookmark-card-header">
                  <a href="${b.url}" target="_blank" rel="noopener noreferrer" class="bookmark-card-name" onclick="event.stopPropagation();">
                    <i data-lucide="external-link"></i> ${b.name}
                  </a>
                  <div class="bookmark-card-actions">
                    <button class="btn-icon bookmark-edit-btn" data-id="${b.id}" data-tooltip="編集">
                      <i data-lucide="pencil"></i>
                    </button>
                    <button class="btn-icon bookmark-delete-btn" data-id="${b.id}" data-tooltip="削除">
                      <i data-lucide="trash-2"></i>
                    </button>
                  </div>
                </div>
                <div class="bookmark-card-url">${b.url}</div>
                ${b.memo ? `<div class="bookmark-card-memo">${b.memo}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('')}
  `;

  // イベント
  _container.querySelector('#bookmark-add-btn')?.addEventListener('click', () => _openBookmarkModal());
  _container.querySelectorAll('.bookmark-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      _openBookmarkModal(btn.dataset.id);
    });
  });
  _container.querySelectorAll('.bookmark-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      Modal.confirm('このブックマークを削除しますか？', () => {
        Store.deleteBookmark(btn.dataset.id);
        Toast.success('ブックマークを削除しました');
      });
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

function _openBookmarkModal(bookmarkId) {
  const bookmark = bookmarkId ? Store.getBookmark(bookmarkId) : null;
  const isEdit = !!bookmark;

  const content = document.createElement('div');

  // 名前
  const nameInput = FormUtils.createInput('text', 'サイト名', bookmark?.name || '', { name: 'name' });
  content.appendChild(FormUtils.createFormGroup('名前', nameInput, { required: true }));

  // URL
  const urlInput = FormUtils.createInput('url', 'https://...', bookmark?.url || '', { name: 'url' });
  content.appendChild(FormUtils.createFormGroup('URL', urlInput, { required: true }));

  // カテゴリ
  const categoryOptions = BOOKMARK_CATEGORY_OPTIONS.map(c => ({ value: c, label: BOOKMARK_CATEGORY_LABELS[c] }));
  const categorySelect = FormUtils.createSelect(categoryOptions, bookmark?.category || 'other', { noEmpty: true });
  content.appendChild(FormUtils.createFormGroup('カテゴリ', categorySelect));

  // メモ
  const memoInput = FormUtils.createInput('text', 'メモ（任意）', bookmark?.memo || '', { name: 'memo' });
  content.appendChild(FormUtils.createFormGroup('メモ', memoInput));

  Modal.open({
    title: isEdit ? 'ブックマーク編集' : 'ブックマーク追加',
    content,
    saveLabel: isEdit ? '更新' : '追加',
    onSave: () => {
      const data = {
        name: nameInput.value,
        url: urlInput.value,
        category: categorySelect.value,
        memo: memoInput.value,
      };

      if (!data.name) { Toast.warning('名前を入力してください'); return; }
      if (!data.url) { Toast.warning('URLを入力してください'); return; }

      if (isEdit) {
        Store.updateBookmark(bookmark.id, data);
        Toast.success('ブックマークを更新しました');
      } else {
        Store.addBookmark(data);
        Toast.success('ブックマークを追加しました');
      }
      Modal.close();
    }
  });
}
