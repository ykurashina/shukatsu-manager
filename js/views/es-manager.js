// es-manager.js — ES管理ビュー

import { Store, ES_STATUS_OPTIONS, ES_STATUS_LABELS, NOTE_CATEGORY_LABELS } from '../store.js';
import { Modal } from '../components/modal.js';
import { Toast } from '../components/toast.js';
import { FormUtils } from '../components/form-utils.js';
import { DateUtils } from '../utils/date.js';

let _unsubscribe = null;
let _container = null;

export function render(container) {
  _container = container;
  _renderContent();
}

export function init() {
  _unsubscribe = Store.onDataChange((event) => {
    if (event.startsWith('es_') || event === 'save' || event === 'import' || event === 'clear') {
      _renderContent();
    }
  });
}

export function destroy() {
  if (_unsubscribe) _unsubscribe();
  _unsubscribe = null;
  _container = null;
}

function _renderContent() {
  if (!_container) return;

  const esDocuments = Store.getESDocuments();
  const companies = Store.getCompanies();

  _container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">ES管理</h1>
      <div class="page-actions">
        <button class="btn btn-primary" id="es-add-btn">
          <i data-lucide="plus"></i> ES追加
        </button>
      </div>
    </div>
    <div class="es-layout">
      <div class="es-table-container">
        ${esDocuments.length === 0 ? _renderEmpty() : _renderTable(esDocuments, companies)}
      </div>
    </div>
  `;

  // イベントリスナー
  _container.querySelector('#es-add-btn')?.addEventListener('click', () => _openESModal());

  // 行クリック
  _container.querySelectorAll('.es-row').forEach(row => {
    row.addEventListener('click', () => _openESModal(row.dataset.id));
  });

  // 削除ボタン
  _container.querySelectorAll('.es-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      Modal.confirm('このESを削除しますか？', () => {
        Store.deleteESDocument(btn.dataset.id);
        Toast.success('ESを削除しました');
      });
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

function _renderEmpty() {
  return `
    <div class="empty-state">
      <div class="empty-state-icon"><i data-lucide="file-text"></i></div>
      <h3>ESがまだ登録されていません</h3>
      <p>「ES追加」ボタンからエントリーシートを登録しましょう</p>
    </div>
  `;
}

function _renderTable(docs, companies) {
  const companyMap = {};
  companies.forEach(c => companyMap[c.id] = c.name);

  return `
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th>企業名</th>
            <th>設問</th>
            <th>文字数</th>
            <th>締切</th>
            <th>ステータス</th>
            <th style="width:60px;"></th>
          </tr>
        </thead>
        <tbody>
          ${docs.map(doc => {
            const companyName = companyMap[doc.companyId] || '—';
            const charInfo = doc.charLimit > 0 ? `${doc.content.length}/${doc.charLimit}` : `${doc.content.length}文字`;
            const isOver = doc.charLimit > 0 && doc.content.length > doc.charLimit;
            const deadlineDays = DateUtils.daysUntil(doc.deadline);
            const deadlineClass = deadlineDays !== null && deadlineDays <= 0 ? 'deadline-urgent' : deadlineDays !== null && deadlineDays <= 3 ? 'deadline-soon' : 'deadline-ok';
            const statusClass = `badge badge-${doc.status.replace('_', '-')}`;

            return `
              <tr class="clickable-row es-row" data-id="${doc.id}">
                <td>${companyName}</td>
                <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${doc.questionTitle || '（無題）'}</td>
                <td class="${isOver ? 'deadline-urgent' : ''}">${charInfo}</td>
                <td class="${deadlineClass}">${doc.deadline ? DateUtils.formatShortDate(doc.deadline) : '—'} ${doc.deadline ? `<span class="text-small">${DateUtils.daysUntilLabel(doc.deadline)}</span>` : ''}</td>
                <td><span class="${statusClass}">${ES_STATUS_LABELS[doc.status] || doc.status}</span></td>
                <td>
                  <div class="row-actions">
                    <button class="btn-icon es-delete-btn" data-id="${doc.id}" data-tooltip="削除"><i data-lucide="trash-2"></i></button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function _openESModal(esId) {
  const doc = esId ? Store.getESDocument(esId) : null;
  const companies = Store.getCompanies();
  const isEdit = !!doc;

  const content = document.createElement('div');

  // 企業選択
  const companyOptions = companies.map(c => ({ value: c.id, label: c.name }));
  const companySelect = FormUtils.createSelect(companyOptions, doc?.companyId || '');
  content.appendChild(FormUtils.createFormGroup('企業', companySelect, { required: true }));

  // 設問タイトル
  const titleInput = FormUtils.createInput('text', '例: 学生時代に力を入れたことは？', doc?.questionTitle || '', { name: 'questionTitle' });
  content.appendChild(FormUtils.createFormGroup('設問', titleInput, { required: true }));

  // フォーム行（文字数制限 + 締切）
  const row = document.createElement('div');
  row.className = 'form-row';
  const charLimitInput = FormUtils.createInput('number', '0 = 制限なし', doc?.charLimit || '', { name: 'charLimit' });
  row.appendChild(FormUtils.createFormGroup('文字数制限', charLimitInput));
  const deadlineInput = FormUtils.createInput('date', '', doc?.deadline || '', { name: 'deadline' });
  row.appendChild(FormUtils.createFormGroup('締切日', deadlineInput));
  content.appendChild(row);

  // ステータス
  const statusOptions = ES_STATUS_OPTIONS.map(s => ({ value: s, label: ES_STATUS_LABELS[s] }));
  const statusSelect = FormUtils.createSelect(statusOptions, doc?.status || 'not_started', { noEmpty: true });
  content.appendChild(FormUtils.createFormGroup('ステータス', statusSelect));

  // 本文
  const textWrapper = FormUtils.createTextarea(
    '回答内容を入力...',
    doc?.content || '',
    doc?.charLimit || 0,
    { name: 'content', rows: 12 }
  );
  content.appendChild(FormUtils.createFormGroup('回答内容', textWrapper));

  // 「自己分析ノートから挿入」ボタン
  const notes = Store.getNotes();
  if (notes.length > 0) {
    const insertSection = document.createElement('div');
    insertSection.style.cssText = 'margin-top: var(--sp-2); margin-bottom: var(--sp-3);';

    const insertLabel = document.createElement('div');
    insertLabel.style.cssText = 'font-size: var(--text-xs); color: var(--text-secondary); margin-bottom: var(--sp-1); font-weight: var(--fw-medium);';
    insertLabel.textContent = 'ネタ帳から挿入';
    insertSection.appendChild(insertLabel);

    const insertRow = document.createElement('div');
    insertRow.style.cssText = 'display:flex; gap:var(--sp-2); align-items:center; flex-wrap:wrap;';

    // ノート選択ドロップダウン
    const noteSelect = document.createElement('select');
    noteSelect.className = 'form-select';
    noteSelect.style.cssText = 'flex:1; min-width:200px;';
    noteSelect.innerHTML = '<option value="">— ネタを選択 —</option>' +
      notes.map(n => `<option value="${n.id}">${NOTE_CATEGORY_LABELS[n.category] || n.category}: ${n.title || '(無題)'}</option>`).join('');
    insertRow.appendChild(noteSelect);

    // 挿入ボタン
    const insertBtn = document.createElement('button');
    insertBtn.type = 'button';
    insertBtn.className = 'btn btn-secondary btn-sm';
    insertBtn.innerHTML = '<i data-lucide="clipboard-paste" style="width:14px;height:14px;"></i> 挿入';
    insertBtn.addEventListener('click', () => {
      const selectedId = noteSelect.value;
      if (!selectedId) { Toast.warning('ネタを選択してください'); return; }
      const note = Store.getNote(selectedId);
      if (!note || !note.content) { Toast.warning('ネタの内容が空です'); return; }
      const textarea = textWrapper.querySelector('textarea');
      if (textarea) {
        const cursorPos = textarea.selectionStart;
        const before = textarea.value.substring(0, cursorPos);
        const after = textarea.value.substring(cursorPos);
        textarea.value = before + note.content + after;
        textarea.dispatchEvent(new Event('input')); // 文字数カウント更新のため
        Toast.success(`「${note.title}」を挿入しました`);
      }
    });
    insertRow.appendChild(insertBtn);

    insertSection.appendChild(insertRow);
    content.appendChild(insertSection);
  }

  Modal.open({
    title: isEdit ? 'ES編集' : 'ES追加',
    content,
    size: 'large',
    saveLabel: isEdit ? '更新' : '追加',
    onSave: () => {
      const data = {
        companyId: companySelect.value,
        questionTitle: titleInput.value,
        charLimit: parseInt(charLimitInput.value) || 0,
        deadline: deadlineInput.value,
        status: statusSelect.value,
        content: textWrapper.querySelector('textarea').value
      };

      if (!data.companyId) { Toast.warning('企業を選択してください'); return; }
      if (!data.questionTitle) { Toast.warning('設問を入力してください'); return; }

      if (isEdit) {
        Store.updateESDocument(doc.id, data);
        Toast.success('ESを更新しました');
      } else {
        Store.addESDocument(data);
        Toast.success('ESを追加しました');
      }
      Modal.close();
    }
  });
}
