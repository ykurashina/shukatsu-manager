// companies.js — 企業管理テーブルビュー

import { Store, STATUS_OPTIONS, STATUS_LABELS, STATUS_COLORS, INDUSTRY_OPTIONS, PRIORITY_OPTIONS, PRIORITY_COLORS, SOURCE_OPTIONS, STEP_TYPE_OPTIONS, STEP_TYPE_LABELS } from '../store.js';
import { Modal } from '../components/modal.js';
import { Toast } from '../components/toast.js';
import { FormUtils } from '../components/form-utils.js';
import { DateUtils } from '../utils/date.js';
import { searchCompanyByGBiz } from '../utils/api.js';

// ---------------------
// 状態管理
// ---------------------
let _container = null;
let _sortKey = 'name';
let _sortDir = 'asc';
let _filterStatus = '';
let _filterIndustry = '';
let _filterPriority = '';
let _searchQuery = '';
let _unsubscribe = null;

// ---------------------
// ヘルパー
// ---------------------
const RESULT_OPTIONS = [
  { value: 'pending', label: '結果待ち' },
  { value: 'passed', label: '通過' },
  { value: 'failed', label: '不合格' }
];

function statusClass(status) {
  return 'badge-' + (status || '').replace(/_/g, '-');
}

function getFilteredCompanies() {
  let companies = Store.getCompanies();

  // 検索
  if (_searchQuery) {
    const q = _searchQuery.toLowerCase();
    companies = companies.filter(c => (c.name || '').toLowerCase().includes(q));
  }
  // フィルター
  if (_filterStatus) {
    companies = companies.filter(c => c.status === _filterStatus);
  }
  if (_filterIndustry) {
    companies = companies.filter(c => c.industry === _filterIndustry);
  }
  if (_filterPriority) {
    companies = companies.filter(c => c.priority === _filterPriority);
  }

  // ソート
  companies.sort((a, b) => {
    let va = a[_sortKey] || '';
    let vb = b[_sortKey] || '';

    // 日付フィールド
    if (_sortKey === 'nextDate') {
      va = va ? new Date(va).getTime() : 0;
      vb = vb ? new Date(vb).getTime() : 0;
    }
    // 志望度は S>A>B>C の順
    if (_sortKey === 'priority') {
      const order = { S: 0, A: 1, B: 2, C: 3 };
      va = order[va] ?? 99;
      vb = order[vb] ?? 99;
    }

    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();

    if (va < vb) return _sortDir === 'asc' ? -1 : 1;
    if (va > vb) return _sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return companies;
}

// ---------------------
// render
// ---------------------
export function render(container) {
  _container = container;
  container.innerHTML = '';

  // ページタイトル
  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = `<h1 class="page-title">企業管理</h1>`;
  container.appendChild(header);

  // ツールバー
  const toolbar = document.createElement('div');
  toolbar.className = 'table-toolbar';

  // --- 左側：検索 + フィルター ---
  const toolbarLeft = document.createElement('div');
  toolbarLeft.className = 'table-toolbar-left';

  // 検索バー
  const searchBar = document.createElement('div');
  searchBar.className = 'search-bar';
  searchBar.innerHTML = `<i data-lucide="search" class="search-icon"></i>`;
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'form-input';
  searchInput.placeholder = '企業名で検索…';
  searchInput.value = _searchQuery;
  searchInput.id = 'company-search-input';
  searchBar.appendChild(searchInput);
  toolbarLeft.appendChild(searchBar);

  // フィルターバー
  const filterBar = document.createElement('div');
  filterBar.className = 'filter-bar';

  // ステータスフィルター
  const statusFilter = FormUtils.createSelect(
    STATUS_OPTIONS.map(s => ({ value: s, label: STATUS_LABELS[s] })),
    _filterStatus,
    { id: 'filter-status', className: '' }
  );
  statusFilter.querySelector('option[value=""]').textContent = 'ステータス';
  filterBar.appendChild(statusFilter);

  // 業界フィルター
  const industryFilter = FormUtils.createSelect(
    INDUSTRY_OPTIONS.map(i => ({ value: i, label: i })),
    _filterIndustry,
    { id: 'filter-industry', className: '' }
  );
  industryFilter.querySelector('option[value=""]').textContent = '業界';
  filterBar.appendChild(industryFilter);

  // 志望度フィルター
  const priorityFilter = FormUtils.createSelect(
    PRIORITY_OPTIONS.map(p => ({ value: p, label: p })),
    _filterPriority,
    { id: 'filter-priority', className: '' }
  );
  priorityFilter.querySelector('option[value=""]').textContent = '志望度';
  filterBar.appendChild(priorityFilter);

  toolbarLeft.appendChild(filterBar);
  toolbar.appendChild(toolbarLeft);

  // --- 右側：新規追加ボタン ---
  const toolbarRight = document.createElement('div');
  toolbarRight.className = 'table-toolbar-right';
  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-primary';
  addBtn.id = 'btn-add-company';
  addBtn.innerHTML = '<i data-lucide="plus"></i> 新規追加';
  toolbarRight.appendChild(addBtn);
  toolbar.appendChild(toolbarRight);

  container.appendChild(toolbar);

  // テーブル
  const tableContainer = document.createElement('div');
  tableContainer.className = 'table-container';
  const tableScroll = document.createElement('div');
  tableScroll.className = 'table-scroll';
  tableScroll.id = 'companies-table-scroll';
  tableContainer.appendChild(tableScroll);
  container.appendChild(tableContainer);

  renderTable();

  // Lucide アイコン
  if (window.lucide) window.lucide.createIcons();
}

// ---------------------
// テーブル本体の描画
// ---------------------
function renderTable() {
  const scrollContainer = document.getElementById('companies-table-scroll');
  if (!scrollContainer) return;
  scrollContainer.innerHTML = '';

  const companies = getFilteredCompanies();

  if (companies.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <i data-lucide="building-2" style="width:48px;height:48px;color:var(--text-tertiary)"></i>
      <p class="empty-state-text">${_searchQuery || _filterStatus || _filterIndustry || _filterPriority ? '条件に一致する企業がありません' : '企業がまだ登録されていません'}</p>
      <p class="empty-state-sub">「新規追加」から企業を追加しましょう</p>
    `;
    scrollContainer.appendChild(empty);
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  const table = document.createElement('table');
  table.className = 'data-table';

  // ヘッダー
  const thead = document.createElement('thead');
  const headers = [
    { key: 'priority', label: '志望度' },
    { key: 'name', label: '企業名' },
    { key: 'industry', label: '業界' },
    { key: 'status', label: 'ステータス' },
    { key: 'currentStep', label: '現在のステップ' },
    { key: 'nextDate', label: '次の予定日' }
  ];

  const headerRow = document.createElement('tr');
  for (const h of headers) {
    const th = document.createElement('th');
    th.dataset.sortKey = h.key;
    th.style.cursor = 'pointer';
    th.style.userSelect = 'none';

    let arrow = '';
    if (_sortKey === h.key) {
      arrow = _sortDir === 'asc' ? ' ↑' : ' ↓';
    }
    th.textContent = h.label + arrow;
    th.classList.add('sortable-header');
    headerRow.appendChild(th);
  }
  // アクション列
  const thAction = document.createElement('th');
  thAction.textContent = '';
  thAction.style.width = '60px';
  headerRow.appendChild(thAction);
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // ボディ
  const tbody = document.createElement('tbody');
  for (const company of companies) {
    const tr = document.createElement('tr');
    tr.className = 'clickable-row';
    tr.dataset.companyId = company.id;

    // 志望度
    const tdPri = document.createElement('td');
    const priBadge = document.createElement('span');
    priBadge.className = `badge-priority badge-priority-${(company.priority || 'b').toLowerCase()}`;
    priBadge.textContent = company.priority || '-';
    tdPri.appendChild(priBadge);
    tr.appendChild(tdPri);

    // 企業名
    const tdName = document.createElement('td');
    tdName.className = 'company-name-cell';
    tdName.textContent = company.name || '(未入力)';
    tr.appendChild(tdName);

    // 業界
    const tdInd = document.createElement('td');
    tdInd.textContent = company.industry || '-';
    tr.appendChild(tdInd);

    // ステータス
    const tdSt = document.createElement('td');
    const stBadge = document.createElement('span');
    stBadge.className = `badge ${statusClass(company.status)}`;
    stBadge.textContent = STATUS_LABELS[company.status] || company.status || '-';
    tdSt.appendChild(stBadge);
    tr.appendChild(tdSt);

    // 現在のステップ
    const tdStep = document.createElement('td');
    tdStep.textContent = company.currentStep || '-';
    tr.appendChild(tdStep);

    // 次の予定日
    const tdDate = document.createElement('td');
    if (company.nextDate) {
      const dateLabel = DateUtils.formatShortDate(company.nextDate);
      const daysLabel = DateUtils.daysUntilLabel(company.nextDate);
      tdDate.innerHTML = `<span>${dateLabel}</span>`;
      if (daysLabel) {
        const days = DateUtils.daysUntil(company.nextDate);
        const urgentClass = days !== null && days <= 3 && days >= 0 ? ' urgent' : '';
        tdDate.innerHTML += ` <small class="days-label${urgentClass}">${daysLabel}</small>`;
      }
    } else {
      tdDate.textContent = '-';
    }
    tr.appendChild(tdDate);

    // アクション
    const tdAct = document.createElement('td');
    tdAct.className = 'row-actions';
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon btn-icon-danger';
    delBtn.dataset.deleteId = company.id;
    delBtn.title = '削除';
    delBtn.innerHTML = '<i data-lucide="trash-2"></i>';
    tdAct.appendChild(delBtn);
    tr.appendChild(tdAct);

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  scrollContainer.appendChild(table);

  if (window.lucide) window.lucide.createIcons();
}

// ---------------------
// init — イベントリスナー登録
// ---------------------
const _handlers = {};

export function init() {
  // 検索
  _handlers.search = (e) => {
    _searchQuery = e.target.value;
    renderTable();
  };
  document.getElementById('company-search-input')?.addEventListener('input', _handlers.search);

  // ステータスフィルター
  _handlers.filterStatus = (e) => {
    _filterStatus = e.target.value;
    renderTable();
  };
  document.getElementById('filter-status')?.addEventListener('change', _handlers.filterStatus);

  // 業界フィルター
  _handlers.filterIndustry = (e) => {
    _filterIndustry = e.target.value;
    renderTable();
  };
  document.getElementById('filter-industry')?.addEventListener('change', _handlers.filterIndustry);

  // 志望度フィルター
  _handlers.filterPriority = (e) => {
    _filterPriority = e.target.value;
    renderTable();
  };
  document.getElementById('filter-priority')?.addEventListener('change', _handlers.filterPriority);

  // 新規追加
  _handlers.addCompany = () => openCompanyFormModal();
  document.getElementById('btn-add-company')?.addEventListener('click', _handlers.addCompany);

  // テーブルイベント委譲
  _handlers.tableClick = (e) => {
    // 削除ボタン
    const delBtn = e.target.closest('[data-delete-id]');
    if (delBtn) {
      e.stopPropagation();
      const id = delBtn.dataset.deleteId;
      const company = Store.getCompany(id);
      Modal.confirm(
        `「${company?.name || ''}」を削除しますか？\n関連する選考ステップ・ES・面接記録もすべて削除されます。`,
        () => {
          Store.deleteCompany(id);
          Toast.show('企業を削除しました', 'success');
          renderTable();
        },
        '削除'
      );
      return;
    }

    // ソートヘッダー
    const th = e.target.closest('[data-sort-key]');
    if (th) {
      const key = th.dataset.sortKey;
      if (_sortKey === key) {
        _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        _sortKey = key;
        _sortDir = 'asc';
      }
      renderTable();
      return;
    }

    // 行クリック → 詳細モーダル
    const row = e.target.closest('.clickable-row');
    if (row) {
      openCompanyDetailModal(row.dataset.companyId);
    }
  };
  document.getElementById('companies-table-scroll')?.addEventListener('click', _handlers.tableClick);

  // データ変更監視
  _unsubscribe = Store.onDataChange(() => renderTable());
}

// ---------------------
// destroy — クリーンアップ
// ---------------------
export function destroy() {
  document.getElementById('company-search-input')?.removeEventListener('input', _handlers.search);
  document.getElementById('filter-status')?.removeEventListener('change', _handlers.filterStatus);
  document.getElementById('filter-industry')?.removeEventListener('change', _handlers.filterIndustry);
  document.getElementById('filter-priority')?.removeEventListener('change', _handlers.filterPriority);
  document.getElementById('btn-add-company')?.removeEventListener('click', _handlers.addCompany);
  document.getElementById('companies-table-scroll')?.removeEventListener('click', _handlers.tableClick);

  if (_unsubscribe) {
    _unsubscribe();
    _unsubscribe = null;
  }

  _container = null;
}

// =========================================================
//  企業追加 / 編集モーダル
// =========================================================
function openCompanyFormModal(companyId = null) {
  const isEdit = !!companyId;
  const company = isEdit ? Store.getCompany(companyId) : {};

  const form = document.createElement('div');
  form.className = 'modal-form';

  // 企業名（必須）
  const nameInput = FormUtils.createInput('text', '例：株式会社○○', company.name || '', { name: 'name', required: true });
  form.appendChild(
    FormUtils.createFormGroup('企業名', nameInput, { required: true })
  );

  // gBizINFO API 検索ボタン（トークンが設定されている場合のみ表示）
  const gbizToken = Store.getSettings().gbizToken;
  if (gbizToken) {
    const gbizRow = document.createElement('div');
    gbizRow.style.cssText = 'display:flex; gap:var(--sp-2); align-items:center; margin-bottom:var(--sp-3);';
    const gbizBtn = document.createElement('button');
    gbizBtn.type = 'button';
    gbizBtn.className = 'btn btn-secondary btn-sm';
    gbizBtn.innerHTML = '<i data-lucide="search" style="width:14px;height:14px;"></i> gBizINFOで企業情報を検索';
    const gbizResult = document.createElement('span');
    gbizResult.style.cssText = 'font-size:var(--text-xs); color:var(--text-tertiary);';
    gbizBtn.addEventListener('click', async () => {
      const companyName = nameInput.value.trim();
      if (!companyName) { Toast.show('企業名を先に入力してください', 'warning'); return; }
      gbizResult.textContent = '検索中...';
      const info = await searchCompanyByGBiz(companyName, gbizToken);
      if (info) {
        gbizResult.textContent = `✅ ${info.name} が見つかりました`;
        // メモ欄に自動入力
        const memoEl = form.querySelector('[name="memo"]');
        if (memoEl) {
          const autoInfo = [
            info.location ? `所在地: ${info.location}` : '',
            info.capitalStock ? `資本金: ${info.capitalStock}` : '',
            info.employeeNumber ? `従業員数: ${info.employeeNumber}人` : '',
            info.dateOfEstablishment ? `設立: ${info.dateOfEstablishment}` : '',
          ].filter(Boolean).join('\n');
          const textarea = memoEl.tagName === 'TEXTAREA' ? memoEl : memoEl.querySelector('textarea');
          if (textarea) {
            textarea.value = textarea.value ? textarea.value + '\n---\n' + autoInfo : autoInfo;
          }
        }
        Toast.show('企業情報をメモに追加しました', 'success');
      } else {
        gbizResult.textContent = '❓ 企業が見つかりませんでした';
      }
    });
    gbizRow.appendChild(gbizBtn);
    gbizRow.appendChild(gbizResult);
    form.appendChild(gbizRow);
  }

  // 業界
  form.appendChild(
    FormUtils.createFormGroup('業界',
      FormUtils.createSelect(
        INDUSTRY_OPTIONS.map(i => ({ value: i, label: i })),
        company.industry || '',
        { name: 'industry' }
      )
    )
  );

  // 志望度
  form.appendChild(
    FormUtils.createFormGroup('志望度',
      FormUtils.createSelect(
        PRIORITY_OPTIONS.map(p => ({ value: p, label: p })),
        company.priority || 'B',
        { name: 'priority' }
      )
    )
  );

  // ステータス
  form.appendChild(
    FormUtils.createFormGroup('ステータス',
      FormUtils.createSelect(
        STATUS_OPTIONS.map(s => ({ value: s, label: STATUS_LABELS[s] })),
        company.status || 'interested',
        { name: 'status' }
      )
    )
  );

  // 応募元
  form.appendChild(
    FormUtils.createFormGroup('応募元',
      FormUtils.createSelect(
        SOURCE_OPTIONS.map(s => ({ value: s, label: s })),
        company.source || '',
        { name: 'source' }
      )
    )
  );

  // WebサイトURL
  form.appendChild(
    FormUtils.createFormGroup('WebサイトURL',
      FormUtils.createInput('url', 'https://example.com', company.websiteUrl || '', { name: 'websiteUrl' })
    )
  );

  // マイページURL
  form.appendChild(
    FormUtils.createFormGroup('マイページURL',
      FormUtils.createInput('url', 'https://mypage.example.com', company.mypageUrl || '', { name: 'mypageUrl' })
    )
  );

  // マイページID
  form.appendChild(
    FormUtils.createFormGroup('マイページID',
      FormUtils.createInput('text', 'ログインID', company.mypageId || '', { name: 'mypageId' })
    )
  );

  // マイページパスワード
  const pwInput = FormUtils.createPasswordInput('パスワード', company.mypagePassword || '', { name: 'mypagePassword' });
  const pwGroup = FormUtils.createFormGroup('マイページパスワード', pwInput);
  const secWarn = document.createElement('p');
  secWarn.className = 'form-warning';
  secWarn.innerHTML = '<i data-lucide="alert-triangle" style="width:14px;height:14px;display:inline;vertical-align:middle;margin-right:4px"></i>パスワードはブラウザのローカルストレージに平文で保存されます。機密性の高いパスワードの保存は推奨しません。';
  pwGroup.appendChild(secWarn);
  form.appendChild(pwGroup);

  // メモ
  form.appendChild(
    FormUtils.createFormGroup('メモ',
      FormUtils.createTextarea('自由にメモを記入', company.memo || '', 0, { name: 'memo', rows: 4 })
    )
  );

  Modal.open({
    title: isEdit ? '企業を編集' : '企業を追加',
    content: form,
    size: 'medium',
    saveLabel: isEdit ? '更新' : '追加',
    onSave: (modal) => {
      const data = FormUtils.collectFormData(modal);
      if (!data.name || !data.name.trim()) {
        Toast.show('企業名は必須です', 'error');
        return;
      }
      if (isEdit) {
        Store.updateCompany(companyId, data);
        Toast.show('企業情報を更新しました', 'success');
      } else {
        Store.addCompany(data);
        Toast.show('企業を追加しました', 'success');
      }
      Modal.close();
      renderTable();
    }
  });

  if (window.lucide) window.lucide.createIcons();
}

// =========================================================
//  企業詳細モーダル
// =========================================================
function openCompanyDetailModal(companyId) {
  const company = Store.getCompany(companyId);
  if (!company) return;

  const content = document.createElement('div');
  content.className = 'company-detail';

  // --- 企業情報セクション ---
  const infoSection = document.createElement('div');
  infoSection.className = 'detail-section';

  const infoHeader = document.createElement('div');
  infoHeader.className = 'detail-section-header';
  infoHeader.innerHTML = `<h3>企業情報</h3>`;
  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-secondary btn-sm';
  editBtn.innerHTML = '<i data-lucide="edit-2" style="width:14px;height:14px"></i> 編集';
  editBtn.addEventListener('click', () => {
    Modal.close();
    setTimeout(() => openCompanyFormModal(companyId), 250);
  });
  infoHeader.appendChild(editBtn);
  infoSection.appendChild(infoHeader);

  const infoGrid = document.createElement('div');
  infoGrid.className = 'detail-grid';

  const infoItems = [
    { label: '企業名', value: company.name || '-' },
    { label: '業界', value: company.industry || '-' },
    { label: '志望度', value: company.priority || '-', badge: `badge-priority badge-priority-${(company.priority || 'b').toLowerCase()}` },
    { label: 'ステータス', value: STATUS_LABELS[company.status] || '-', badge: statusClass(company.status) },
    { label: '応募元', value: company.source || '-' },
    { label: '現在のステップ', value: company.currentStep || '-' },
    { label: '次の予定日', value: company.nextDate ? DateUtils.formatDate(company.nextDate) : '-' }
  ];

  for (const item of infoItems) {
    const div = document.createElement('div');
    div.className = 'detail-item';
    const label = document.createElement('span');
    label.className = 'detail-label';
    label.textContent = item.label;
    div.appendChild(label);
    if (item.badge) {
      const badge = document.createElement('span');
      badge.className = `badge ${item.badge}`;
      badge.textContent = item.value;
      div.appendChild(badge);
    } else {
      const val = document.createElement('span');
      val.className = 'detail-value';
      val.textContent = item.value;
      div.appendChild(val);
    }
    infoGrid.appendChild(div);
  }
  infoSection.appendChild(infoGrid);

  // リンク表示
  if (company.websiteUrl || company.mypageUrl) {
    const linksDiv = document.createElement('div');
    linksDiv.className = 'detail-links';
    if (company.websiteUrl) {
      const a = document.createElement('a');
      a.href = company.websiteUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'detail-link';
      a.innerHTML = '<i data-lucide="external-link" style="width:14px;height:14px"></i> Webサイト';
      linksDiv.appendChild(a);
    }
    if (company.mypageUrl) {
      const a = document.createElement('a');
      a.href = company.mypageUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'detail-link';
      a.innerHTML = '<i data-lucide="external-link" style="width:14px;height:14px"></i> マイページ';
      linksDiv.appendChild(a);
    }
    infoSection.appendChild(linksDiv);
  }

  // マイページ認証情報
  if (company.mypageId || company.mypagePassword) {
    const credDiv = document.createElement('div');
    credDiv.className = 'detail-credentials';
    credDiv.innerHTML = `
      <span class="detail-label">マイページID:</span>
      <span class="detail-value">${company.mypageId || '-'}</span>
      <span class="detail-label" style="margin-left:16px">パスワード:</span>
      <span class="detail-value password-masked" id="detail-pw-display">••••••••</span>
      <button type="button" class="btn-icon btn-icon-sm" id="detail-pw-toggle" title="表示/非表示">
        <i data-lucide="eye" style="width:14px;height:14px"></i>
      </button>
    `;
    infoSection.appendChild(credDiv);
    // パスワード表示切替
    setTimeout(() => {
      const toggle = document.getElementById('detail-pw-toggle');
      const display = document.getElementById('detail-pw-display');
      if (toggle && display) {
        let visible = false;
        toggle.addEventListener('click', () => {
          visible = !visible;
          display.textContent = visible ? (company.mypagePassword || '-') : '••••••••';
          toggle.innerHTML = `<i data-lucide="${visible ? 'eye-off' : 'eye'}" style="width:14px;height:14px"></i>`;
          if (window.lucide) window.lucide.createIcons();
        });
      }
    }, 50);
  }

  // メモ
  if (company.memo) {
    const memoDiv = document.createElement('div');
    memoDiv.className = 'detail-memo';
    memoDiv.innerHTML = `<span class="detail-label">メモ</span><p class="detail-memo-text">${escapeHtml(company.memo)}</p>`;
    infoSection.appendChild(memoDiv);
  }

  content.appendChild(infoSection);

  // --- 選考ステップセクション ---
  const stepsSection = document.createElement('div');
  stepsSection.className = 'detail-section';

  const stepsHeader = document.createElement('div');
  stepsHeader.className = 'detail-section-header';
  stepsHeader.innerHTML = '<h3>選考ステップ</h3>';
  const addStepBtn = document.createElement('button');
  addStepBtn.className = 'btn btn-primary btn-sm';
  addStepBtn.innerHTML = '<i data-lucide="plus" style="width:14px;height:14px"></i> ステップ追加';
  addStepBtn.addEventListener('click', () => {
    Modal.close();
    setTimeout(() => openStepFormModal(companyId), 250);
  });
  stepsHeader.appendChild(addStepBtn);
  stepsSection.appendChild(stepsHeader);

  const steps = Store.getSteps(companyId);
  if (steps.length === 0) {
    const emptyStep = document.createElement('p');
    emptyStep.className = 'empty-state-text';
    emptyStep.textContent = '選考ステップがまだ登録されていません';
    stepsSection.appendChild(emptyStep);
  } else {
    const stepsList = document.createElement('div');
    stepsList.className = 'steps-list';
    for (const step of steps) {
      const stepCard = document.createElement('div');
      stepCard.className = 'step-card';

      const stepTop = document.createElement('div');
      stepTop.className = 'step-card-header';

      const stepTypeBadge = document.createElement('span');
      stepTypeBadge.className = 'badge badge-step-type';
      stepTypeBadge.textContent = STEP_TYPE_LABELS[step.type] || step.type;
      stepTop.appendChild(stepTypeBadge);

      const stepName = document.createElement('span');
      stepName.className = 'step-name';
      stepName.textContent = step.stepName || STEP_TYPE_LABELS[step.type] || '';
      stepTop.appendChild(stepName);

      // 結果バッジ
      const resultBadge = document.createElement('span');
      resultBadge.className = `badge badge-result-${step.result || 'pending'}`;
      resultBadge.textContent = RESULT_OPTIONS.find(r => r.value === step.result)?.label || '結果待ち';
      stepTop.appendChild(resultBadge);

      // ステップアクションボタン
      const stepActions = document.createElement('div');
      stepActions.className = 'step-card-actions';
      const stepDelBtn = document.createElement('button');
      stepDelBtn.className = 'btn-icon btn-icon-danger btn-icon-sm';
      stepDelBtn.title = '削除';
      stepDelBtn.innerHTML = '<i data-lucide="trash-2" style="width:14px;height:14px"></i>';
      stepDelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        Modal.confirm(
          `このステップ「${step.stepName || STEP_TYPE_LABELS[step.type]}」を削除しますか？`,
          () => {
            Store.deleteStep(step.id);
            Toast.show('ステップを削除しました', 'success');
            // 詳細モーダルを再表示
            setTimeout(() => openCompanyDetailModal(companyId), 250);
          },
          '削除'
        );
      });
      stepActions.appendChild(stepDelBtn);
      stepTop.appendChild(stepActions);

      stepCard.appendChild(stepTop);

      // 日時・場所
      const stepMeta = document.createElement('div');
      stepMeta.className = 'step-card-meta';
      if (step.scheduledDate) {
        stepMeta.innerHTML += `<span><i data-lucide="calendar" style="width:12px;height:12px"></i> ${DateUtils.formatDate(step.scheduledDate)}</span>`;
      }
      if (step.location) {
        stepMeta.innerHTML += `<span><i data-lucide="map-pin" style="width:12px;height:12px"></i> ${escapeHtml(step.location)}</span>`;
      }
      if (stepMeta.innerHTML) stepCard.appendChild(stepMeta);

      // type固有の詳細
      const details = step.details || {};
      const detailLines = buildStepDetailLines(step.type, details);
      if (detailLines.length > 0) {
        const detailDiv = document.createElement('div');
        detailDiv.className = 'step-card-details';
        for (const line of detailLines) {
          const p = document.createElement('p');
          p.innerHTML = `<strong>${line.label}:</strong> ${escapeHtml(line.value)}`;
          detailDiv.appendChild(p);
        }
        stepCard.appendChild(detailDiv);
      }

      stepsList.appendChild(stepCard);
    }
    stepsSection.appendChild(stepsList);
  }

  content.appendChild(stepsSection);

  Modal.open({
    title: company.name || '企業詳細',
    content,
    size: 'large',
    hideFooter: true,
    onClose: () => renderTable()
  });

  if (window.lucide) window.lucide.createIcons();
}

// ---------------------
// ステップ詳細テキスト生成
// ---------------------
function buildStepDetailLines(type, details) {
  const lines = [];
  switch (type) {
    case 'webtest':
      if (details.testType) lines.push({ label: 'テスト種類', value: details.testType });
      if (details.method) lines.push({ label: '受験方法', value: details.method });
      if (details.examUrl) lines.push({ label: '受験URL', value: details.examUrl });
      if (details.confidence) lines.push({ label: '手応え', value: details.confidence });
      break;
    case 'interview':
      if (details.round) lines.push({ label: '次数', value: details.round });
      if (details.format) lines.push({ label: '形式', value: details.format });
      if (details.interviewMethod) lines.push({ label: '方式', value: details.interviewMethod });
      if (details.interviewerCount) lines.push({ label: '面接官人数', value: details.interviewerCount });
      if (details.atmosphere) lines.push({ label: '雰囲気', value: details.atmosphere });
      if (details.confidence) lines.push({ label: '手応え', value: details.confidence });
      if (details.questions) lines.push({ label: '質問内容', value: details.questions });
      if (details.answers) lines.push({ label: '回答内容', value: details.answers });
      if (details.reflection) lines.push({ label: '反省点', value: details.reflection });
      break;
    case 'briefing':
      if (details.speakerName) lines.push({ label: '講演者名', value: details.speakerName });
      if (details.speakerDept) lines.push({ label: '部署', value: details.speakerDept });
      if (details.learnings) lines.push({ label: '学びメモ', value: details.learnings });
      break;
    case 'obog':
      if (details.contactName) lines.push({ label: '連絡先名', value: details.contactName });
      if (details.contactDept) lines.push({ label: '部署', value: details.contactDept });
      if (details.notes) lines.push({ label: 'メモ', value: details.notes });
      break;
    default:
      if (details.freeText) lines.push({ label: 'メモ', value: details.freeText });
      break;
  }
  return lines;
}

// =========================================================
//  選考ステップ追加モーダル
// =========================================================
function openStepFormModal(companyId) {
  const company = Store.getCompany(companyId);
  if (!company) return;

  const form = document.createElement('div');
  form.className = 'modal-form';

  // ステップ種類
  const typeSelect = FormUtils.createSelect(
    STEP_TYPE_OPTIONS.map(t => ({ value: t, label: STEP_TYPE_LABELS[t] })),
    '',
    { name: 'type', id: 'step-type-select' }
  );
  form.appendChild(FormUtils.createFormGroup('ステップ種類', typeSelect, { required: true }));

  // ステップ名
  form.appendChild(
    FormUtils.createFormGroup('ステップ名',
      FormUtils.createInput('text', '例：一次面接', '', { name: 'stepName' })
    )
  );

  // 日時
  form.appendChild(
    FormUtils.createFormGroup('予定日',
      FormUtils.createInput('date', '', '', { name: 'scheduledDate' })
    )
  );

  // 場所
  form.appendChild(
    FormUtils.createFormGroup('場所',
      FormUtils.createInput('text', '例：東京本社 / オンライン', '', { name: 'location' })
    )
  );

  // 結果
  form.appendChild(
    FormUtils.createFormGroup('結果',
      FormUtils.createSelect(
        RESULT_OPTIONS,
        'pending',
        { name: 'result' }
      )
    )
  );

  // 動的フィールドコンテナ
  const dynamicFields = document.createElement('div');
  dynamicFields.id = 'step-dynamic-fields';
  form.appendChild(dynamicFields);

  // type変更時に動的フィールドを更新
  typeSelect.addEventListener('change', () => {
    renderStepDynamicFields(typeSelect.value, dynamicFields);
  });

  Modal.open({
    title: `${company.name} — ステップ追加`,
    content: form,
    size: 'large',
    saveLabel: '追加',
    onSave: (modal) => {
      const data = FormUtils.collectFormData(modal);
      const type = data.type;
      if (!type) {
        Toast.show('ステップ種類を選択してください', 'error');
        return;
      }

      // details をまとめる
      const details = extractStepDetails(type, data);

      Store.addStep({
        companyId,
        type,
        stepName: data.stepName || '',
        scheduledDate: data.scheduledDate || '',
        location: data.location || '',
        result: data.result || 'pending',
        details
      });

      Toast.show('ステップを追加しました', 'success');
      Modal.close();
      setTimeout(() => openCompanyDetailModal(companyId), 250);
    },
    onClose: () => {
      // 詳細モーダルに戻る
      setTimeout(() => openCompanyDetailModal(companyId), 250);
    }
  });

  if (window.lucide) window.lucide.createIcons();
}

// ---------------------
// 動的フィールドレンダリング
// ---------------------
function renderStepDynamicFields(type, container) {
  container.innerHTML = '';

  if (!type) return;

  const divider = document.createElement('hr');
  divider.className = 'form-divider';
  container.appendChild(divider);

  const heading = document.createElement('h4');
  heading.className = 'form-section-title';
  heading.textContent = `${STEP_TYPE_LABELS[type] || type} 詳細`;
  container.appendChild(heading);

  switch (type) {
    case 'webtest':
      container.appendChild(
        FormUtils.createFormGroup('テスト種類',
          FormUtils.createSelect(
            [
              { value: 'SPI', label: 'SPI' },
              { value: '玉手箱', label: '玉手箱' },
              { value: 'TG-WEB', label: 'TG-WEB' },
              { value: 'GAB', label: 'GAB' },
              { value: 'CAB', label: 'CAB' },
              { value: 'その他', label: 'その他' }
            ],
            '',
            { name: 'detail_testType' }
          )
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('受験方法',
          FormUtils.createSelect(
            [
              { value: '自宅受験', label: '自宅受験' },
              { value: 'テストセンター', label: 'テストセンター' },
              { value: '会場受験', label: '会場受験' }
            ],
            '',
            { name: 'detail_method' }
          )
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('受験URL',
          FormUtils.createInput('url', 'https://...', '', { name: 'detail_examUrl' })
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('手応え',
          FormUtils.createSelect(
            [
              { value: '◎', label: '◎ とても良い' },
              { value: '○', label: '○ まあまあ' },
              { value: '△', label: '△ 微妙' },
              { value: '×', label: '× 厳しい' }
            ],
            '',
            { name: 'detail_confidence' }
          )
        )
      );
      break;

    case 'interview':
      container.appendChild(
        FormUtils.createFormGroup('次数',
          FormUtils.createSelect(
            [
              { value: '一次', label: '一次' },
              { value: '二次', label: '二次' },
              { value: '三次', label: '三次' },
              { value: '最終', label: '最終' }
            ],
            '',
            { name: 'detail_round' }
          )
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('形式',
          FormUtils.createSelect(
            [
              { value: '個人面接', label: '個人面接' },
              { value: '集団面接', label: '集団面接' },
              { value: 'GD', label: 'グループディスカッション' }
            ],
            '',
            { name: 'detail_format' }
          )
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('方式',
          FormUtils.createSelect(
            [
              { value: '対面', label: '対面' },
              { value: 'オンライン', label: 'オンライン' },
              { value: 'ハイブリッド', label: 'ハイブリッド' }
            ],
            '',
            { name: 'detail_interviewMethod' }
          )
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('面接官人数',
          FormUtils.createInput('number', '例：2', '', { name: 'detail_interviewerCount' })
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('雰囲気',
          FormUtils.createSelect(
            [
              { value: '和やか', label: '和やか' },
              { value: '普通', label: '普通' },
              { value: '厳しい', label: '厳しい' },
              { value: '圧迫', label: '圧迫' }
            ],
            '',
            { name: 'detail_atmosphere' }
          )
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('手応え',
          FormUtils.createSelect(
            [
              { value: '◎', label: '◎ とても良い' },
              { value: '○', label: '○ まあまあ' },
              { value: '△', label: '△ 微妙' },
              { value: '×', label: '× 厳しい' }
            ],
            '',
            { name: 'detail_confidence' }
          )
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('質問内容',
          FormUtils.createTextarea('聞かれた質問を記録', '', 0, { name: 'detail_questions', rows: 3 })
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('回答内容',
          FormUtils.createTextarea('自分の回答を記録', '', 0, { name: 'detail_answers', rows: 3 })
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('反省点',
          FormUtils.createTextarea('改善点・気づきを記録', '', 0, { name: 'detail_reflection', rows: 3 })
        )
      );
      break;

    case 'briefing':
      container.appendChild(
        FormUtils.createFormGroup('講演者名',
          FormUtils.createInput('text', '例：山田太郎', '', { name: 'detail_speakerName' })
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('部署',
          FormUtils.createInput('text', '例：人事部', '', { name: 'detail_speakerDept' })
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('学びメモ',
          FormUtils.createTextarea('説明会で学んだことを記録', '', 0, { name: 'detail_learnings', rows: 4 })
        )
      );
      break;

    case 'obog':
      container.appendChild(
        FormUtils.createFormGroup('連絡先名',
          FormUtils.createInput('text', '例：鈴木花子さん', '', { name: 'detail_contactName' })
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('部署',
          FormUtils.createInput('text', '例：営業部', '', { name: 'detail_contactDept' })
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('メモ',
          FormUtils.createTextarea('OB/OG訪問で聞いた内容を記録', '', 0, { name: 'detail_notes', rows: 4 })
        )
      );
      break;

    case 'other':
    default:
      container.appendChild(
        FormUtils.createFormGroup('自由記述',
          FormUtils.createTextarea('詳細を自由に記入', '', 0, { name: 'detail_freeText', rows: 4 })
        )
      );
      break;
  }

  if (window.lucide) window.lucide.createIcons();
}

// ---------------------
// details抽出
// ---------------------
function extractStepDetails(type, formData) {
  const details = {};
  const prefix = 'detail_';

  // detail_ プレフィックスのフィールドを抽出
  for (const [key, value] of Object.entries(formData)) {
    if (key.startsWith(prefix) && value) {
      const fieldName = key.substring(prefix.length);
      details[fieldName] = value;
    }
  }

  return details;
}

// ---------------------
// ユーティリティ
// ---------------------
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
