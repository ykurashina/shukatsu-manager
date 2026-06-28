// notes.js — 自己分析ノートビュー

import { Store, NOTE_CATEGORY_OPTIONS, NOTE_CATEGORY_LABELS } from '../store.js';
import { Modal } from '../components/modal.js';
import { Toast } from '../components/toast.js';
import { FormUtils } from '../components/form-utils.js';
import { DateUtils } from '../utils/date.js';

let _unsubscribe = null;
let _container = null;
let _filterCategory = '';

export function render(container) {
  _container = container;
  _renderContent();
}

export function init() {
  _unsubscribe = Store.onDataChange((event) => {
    if (event.startsWith('note_') || event === 'save' || event === 'import' || event === 'clear') {
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

  let notes = Store.getNotes();
  if (_filterCategory) {
    notes = notes.filter(n => n.category === _filterCategory);
  }

  // 更新日順（新しい順）
  notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  const filterOptions = NOTE_CATEGORY_OPTIONS.map(c => `
    <button class="tab ${_filterCategory === c ? 'active' : ''}" data-category="${c}">
      ${NOTE_CATEGORY_LABELS[c]}
    </button>
  `).join('');

  _container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">自己分析ノート</h1>
      <div class="page-actions">
        <button class="btn btn-primary" id="note-add-btn">
          <i data-lucide="plus"></i> ノート追加
        </button>
      </div>
    </div>
    <div class="tabs" style="margin-bottom: var(--sp-5);">
      <button class="tab ${_filterCategory === '' ? 'active' : ''}" data-category="">すべて</button>
      ${filterOptions}
    </div>
    ${notes.length === 0 ? `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="notebook-pen"></i></div>
        <h3>ノートがまだありません</h3>
        <p>自己分析の記録を始めましょう</p>
      </div>
    ` : `
      <div class="notes-grid">
        ${notes.map(note => `
          <div class="note-card" data-id="${note.id}">
            <div class="note-card-category">${NOTE_CATEGORY_LABELS[note.category] || note.category}</div>
            <div class="note-card-title">${note.title || '（無題）'}</div>
            <div class="note-card-preview">${note.content || ''}</div>
            <div class="note-card-footer">
              <span>${DateUtils.formatShortDate(note.updatedAt)}</span>
              <button class="btn-icon note-delete-btn" data-id="${note.id}" data-tooltip="削除">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `}
  `;

  // イベント
  _container.querySelector('#note-add-btn')?.addEventListener('click', () => _openNoteModal());
  _container.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      _filterCategory = tab.dataset.category;
      _renderContent();
    });
  });
  _container.querySelectorAll('.note-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.note-delete-btn')) return;
      _openNoteModal(card.dataset.id);
    });
  });
  _container.querySelectorAll('.note-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      Modal.confirm('このノートを削除しますか？', () => {
        Store.deleteNote(btn.dataset.id);
        Toast.success('ノートを削除しました');
      });
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

function _openNoteModal(noteId) {
  const note = noteId ? Store.getNote(noteId) : null;
  const isEdit = !!note;

  const content = document.createElement('div');

  // カテゴリ
  const categoryOptions = NOTE_CATEGORY_OPTIONS.map(c => ({ value: c, label: NOTE_CATEGORY_LABELS[c] }));
  const categorySelect = FormUtils.createSelect(categoryOptions, note?.category || 'free', { noEmpty: true });
  content.appendChild(FormUtils.createFormGroup('カテゴリ', categorySelect));

  // タイトル
  const titleInput = FormUtils.createInput('text', 'ノートのタイトル', note?.title || '', { name: 'title' });
  content.appendChild(FormUtils.createFormGroup('タイトル', titleInput, { required: true }));

  // 本文
  const contentArea = FormUtils.createTextarea(
    '自己分析の内容を記録...\n\n例:\n・具体的なエピソード\n・そこから学んだこと\n・自分の強みとの関連',
    note?.content || '',
    0,
    { name: 'content', rows: 12 }
  );
  content.appendChild(FormUtils.createFormGroup('内容', contentArea));

  // ESでの使用先
  const usedInput = FormUtils.createInput('text', '例: ○○社のガクチカ、自己PR全般', note?.usedInMemo || '', { name: 'usedInMemo' });
  content.appendChild(FormUtils.createFormGroup('ESでの活用先メモ', usedInput, { helpText: 'このネタをどのESで使ったかメモできます' }));

  Modal.open({
    title: isEdit ? 'ノート編集' : 'ノート追加',
    content,
    size: 'large',
    saveLabel: isEdit ? '更新' : '追加',
    onSave: () => {
      const data = {
        category: categorySelect.value,
        title: titleInput.value,
        content: contentArea.querySelector('textarea').value,
        usedInMemo: usedInput.value,
      };

      if (!data.title) { Toast.warning('タイトルを入力してください'); return; }

      if (isEdit) {
        Store.updateNote(note.id, data);
        Toast.success('ノートを更新しました');
      } else {
        Store.addNote(data);
        Toast.success('ノートを追加しました');
      }
      Modal.close();
    }
  });
}
