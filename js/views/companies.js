// companies.js — 企業管理テーブルビュー

import { Store, STATUS_OPTIONS, STATUS_LABELS, STATUS_COLORS, INDUSTRY_OPTIONS, PRIORITY_OPTIONS, PRIORITY_COLORS, SOURCE_OPTIONS, STEP_TYPE_OPTIONS, STEP_TYPE_LABELS, EVENT_CATEGORY_OPTIONS, EVENT_CATEGORY_LABELS, CALENDAR_TYPE_COLORS, TRACK_TYPE_OPTIONS, TRACK_TYPE_LABELS } from '../store.js';
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
      <i data-lucide="building-2" class="icon-xl" style="color:var(--text-tertiary)"></i>
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
    gbizBtn.innerHTML = '<i data-lucide="search" class="icon-sm"></i> gBizINFOで企業情報を検索';
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
  secWarn.innerHTML = '<i data-lucide="alert-triangle" class="icon-sm icon-inline"></i>パスワードはブラウザのローカルストレージに平文で保存されます。機密性の高いパスワードの保存は推奨しません。';
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
  content.className = 'company-detail-modal-new';

  // --- A. ヘッダーカード ---
  var headerHtml = '<div class="header-card-top">'
    + '<h2 class="company-detail-title">' + escapeHtml(company.name || '(未入力)') + '</h2>'
    + '<button class="btn btn-secondary btn-sm" id="btn-edit-company">'
    + '<i data-lucide="edit-2" class="icon-sm"></i> 編集</button>'
    + '</div>'
    + '<div class="header-card-badges">'
    + '<span class="badge-priority badge-priority-' + (company.priority || 'b').toLowerCase() + '">' + escapeHtml(company.priority || '-') + '</span>'
    + '<span class="badge ' + statusClass(company.status) + '">' + escapeHtml(STATUS_LABELS[company.status] || company.status || '-') + '</span>'
    + '<span class="badge badge-industry">' + escapeHtml(company.industry || '未設定') + '</span>'
    + '</div>'
    + '<div class="header-card-meta">'
    + '<span class="meta-item"><i data-lucide="file-text" class="icon-xs"></i> 応募元: ' + escapeHtml(company.source || '-') + '</span>'
    + '<span class="meta-item"><i data-lucide="calendar" class="icon-xs"></i> 次の予定: ' + (company.nextDate ? DateUtils.formatDate(company.nextDate) : '-') + '</span>'
    + '</div>';

  var headerCard = document.createElement('div');
  headerCard.className = 'card header-card';
  headerCard.innerHTML = headerHtml;
  content.appendChild(headerCard);

  // 編集ボタンのイベント
  setTimeout(function() {
    var editBtn = document.getElementById('btn-edit-company');
    if (editBtn) {
      editBtn.addEventListener('click', function() {
        Modal.close();
        setTimeout(function() { openCompanyFormModal(companyId); }, 250);
      });
    }
  }, 50);

  // --- B. クイックアクセスカード ---
  if (company.websiteUrl || company.mypageUrl || company.mypageId || company.mypagePassword) {
    var quickHtml = '<div class="quick-links">';
    if (company.websiteUrl) {
      quickHtml += '<a href="' + escapeHtml(company.websiteUrl) + '" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">'
        + '<i data-lucide="globe" class="icon-sm"></i> Webサイト</a>';
    }
    if (company.mypageUrl) {
      quickHtml += '<a href="' + escapeHtml(company.mypageUrl) + '" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">'
        + '<i data-lucide="external-link" class="icon-sm"></i> マイページ</a>';
    }
    quickHtml += '</div>';

    if (company.mypageId || company.mypagePassword) {
      quickHtml += '<div class="quick-credentials">'
        + '<div class="cred-item"><span class="cred-label">ID</span>'
        + '<span class="cred-value">' + escapeHtml(company.mypageId || '-') + '</span></div>'
        + '<div class="cred-item"><span class="cred-label">PW</span>'
        + '<span class="cred-value password-masked" id="quick-pw-display">••••••••</span>'
        + '<button type="button" class="btn-icon-sm" id="quick-pw-toggle" title="表示/非表示">'
        + '<i data-lucide="eye" class="icon-sm"></i></button></div>'
        + '</div>';
    }

    var quickCard = document.createElement('div');
    quickCard.className = 'card quick-access-card';
    quickCard.innerHTML = quickHtml;
    content.appendChild(quickCard);

    // パスワードトグル
    setTimeout(function() {
      var toggle = document.getElementById('quick-pw-toggle');
      var display = document.getElementById('quick-pw-display');
      if (toggle && display) {
        var visible = false;
        toggle.addEventListener('click', function() {
          visible = !visible;
          display.textContent = visible ? (company.mypagePassword || '-') : '••••••••';
          toggle.innerHTML = '<i data-lucide="' + (visible ? 'eye-off' : 'eye') + '" class="icon-sm"></i>';
          if (window.lucide) window.lucide.createIcons();
        });
      }
    }, 50);
  }

  // --- C. メモセクション ---
  if (company.memo) {
    var memoCard = document.createElement('div');
    memoCard.className = 'card memo-card';
    memoCard.innerHTML = '<h4 class="card-subtitle"><i data-lucide="file-text" class="icon-sm"></i> メモ</h4>'
      + '<p class="memo-text">' + escapeHtml(company.memo) + '</p>';
    content.appendChild(memoCard);
  }

  var sectionsGrid = document.createElement('div');
  sectionsGrid.className = 'detail-sections-grid';

  // --- D. 選考トラックセクション ---
  var tracksSection = document.createElement('div');
  tracksSection.className = 'timeline-section';
  var tracks = Store.getTracks(companyId);

  if (tracks.length === 0) {
    // === すっぴん表示（トラック未登録） ===
    tracksSection.innerHTML = '<div class="timeline-header">'
      + '<h3 class="timeline-title">選考プロセス</h3>'
      + '</div>'
      + '<div class="empty-track-state">'
      + '<div class="empty-track-icon"><i data-lucide="briefcase" style="width:32px;height:32px;"></i></div>'
      + '<p class="empty-track-message">現在、登録されている選考はありません</p>'
      + '<p class="empty-track-hint">エントリーしたら「選考を追加」で管理を始めましょう</p>'
      + '<button class="btn btn-primary" id="btn-add-track">'
      + '<i data-lucide="plus" class="icon-sm"></i> 選考を追加</button>'
      + '</div>';

    setTimeout(function() {
      var addTrackBtn = document.getElementById('btn-add-track');
      if (addTrackBtn) {
        addTrackBtn.addEventListener('click', function() {
          Modal.close();
          setTimeout(function() { openTrackFormModal(companyId); }, 250);
        });
      }
    }, 50);
  } else {
    // === トラック一覧表示 ===
    tracksSection.innerHTML = '<div class="timeline-header">'
      + '<h3 class="timeline-title">選考プロセス</h3>'
      + '<button class="btn btn-primary btn-sm" id="btn-add-track-header">'
      + '<i data-lucide="plus" class="icon-sm"></i> 選考を追加</button></div>';

    setTimeout(function() {
      var addTrackHeaderBtn = document.getElementById('btn-add-track-header');
      if (addTrackHeaderBtn) {
        addTrackHeaderBtn.addEventListener('click', function() {
          Modal.close();
          setTimeout(function() { openTrackFormModal(companyId); }, 250);
        });
      }
    }, 50);

    // 各トラックを描画
    for (var ti = 0; ti < tracks.length; ti++) {
      (function(track) {
        var trackBlock = document.createElement('div');
        trackBlock.className = 'track-block';

        var trackTypeLabel = TRACK_TYPE_LABELS[track.type] || track.type || 'その他';
        var trackStatusLabel = STATUS_LABELS[track.status] || track.status || '興味あり';
        var positionHtml = track.position
          ? '<span class="track-position">【' + escapeHtml(track.position) + '】</span>'
          : '';

        // トラックヘッダー
        trackBlock.innerHTML = '<div class="track-header">'
          + '<div class="track-header-left">'
          + '<span class="badge badge-track-type">' + escapeHtml(trackTypeLabel) + '</span>'
          + positionHtml
          + '<span class="badge ' + statusClass(track.status) + '">' + escapeHtml(trackStatusLabel) + '</span>'
          + '</div>'
          + '<div class="track-header-right">'
          + '<button class="btn-icon-sm" data-track-edit="' + track.id + '" title="編集">'
          + '<i data-lucide="edit-2" class="icon-sm"></i></button>'
          + '<button class="btn-icon-sm btn-icon-danger" data-track-delete="' + track.id + '" title="削除">'
          + '<i data-lucide="trash-2" class="icon-sm"></i></button>'
          + '</div></div>';

        // トラックメモ
        if (track.memo) {
          var trackMemoDiv = document.createElement('div');
          trackMemoDiv.className = 'track-memo';
          trackMemoDiv.innerHTML = '<i data-lucide="file-text" class="icon-xs"></i> ' + escapeHtml(track.memo);
          trackBlock.appendChild(trackMemoDiv);
        }

        // トラック内のステップ
        var trackSteps = Store.getSteps(companyId, track.id);
        var stepsContainer = document.createElement('div');
        stepsContainer.className = 'timeline-list';

        if (trackSteps.length === 0) {
          stepsContainer.innerHTML = '<p class="empty-state-text">ステップがまだ登録されていません</p>';
        } else {
          trackSteps.sort(function(a, b) { return new Date(a.scheduledDate || 0) - new Date(b.scheduledDate || 0); });
          for (var si = 0; si < trackSteps.length; si++) {
            var step = trackSteps[si];
            var stepItem = document.createElement('div');
            stepItem.className = 'timeline-item';
            var typeLabel = STEP_TYPE_LABELS[step.type] || step.type || 'その他';
            var resultObj = RESULT_OPTIONS.find(function(r) { return r.value === step.result; });
            var resultLabel = resultObj ? resultObj.label : '結果待ち';

            var stepDateHtml = step.scheduledDate
              ? '<span class="meta-item"><i data-lucide="calendar" class="icon-xs"></i> ' + DateUtils.formatDate(step.scheduledDate) + '</span>'
              : '';
            var stepLocHtml = step.location
              ? '<span class="meta-item"><i data-lucide="map-pin" class="icon-xs"></i> ' + escapeHtml(step.location) + '</span>'
              : '';

            stepItem.innerHTML = '<div class="timeline-marker"></div>'
              + '<div class="timeline-content card">'
              +   '<div class="timeline-content-header">'
              +     '<div class="timeline-content-title-area">'
              +       '<span class="badge badge-step-type">' + escapeHtml(typeLabel) + '</span>'
              +       '<strong class="timeline-step-name">' + escapeHtml(step.stepName || typeLabel) + '</strong>'
              +     '</div>'
              +     '<div class="timeline-actions">'
              +       '<span class="badge badge-result-' + (step.result || 'pending') + '">' + escapeHtml(resultLabel) + '</span>'
              +       '<button class="btn-icon-sm" data-step-edit="' + step.id + '" title="編集">'
              +         '<i data-lucide="edit-2" class="icon-sm"></i>'
              +       '</button>'
              +       '<button class="btn-icon-sm btn-icon-danger" data-step-delete="' + step.id + '" title="削除">'
              +         '<i data-lucide="trash-2" class="icon-sm"></i>'
              +       '</button>'
              +     '</div>'
              +   '</div>'
              +   '<div class="timeline-meta">' + stepDateHtml + stepLocHtml + '</div>'
              + '</div>';

            // ステップ編集・削除ボタン
            (function(stepId, stepDisplayName, stepTrackId) {
              setTimeout(function() {
                var editBtn = stepItem.querySelector('[data-step-edit="' + stepId + '"]');
                if (editBtn) {
                  editBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    Modal.close();
                    setTimeout(function() { openStepFormModal(companyId, stepTrackId, stepId); }, 250);
                  });
                }
                var delBtn = stepItem.querySelector('[data-step-delete="' + stepId + '"]');
                if (delBtn) {
                  delBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    Modal.confirm(
                      'このステップ「' + stepDisplayName + '」を削除しますか？',
                      function() {
                        Store.deleteStep(stepId);
                        Toast.show('ステップを削除しました', 'success');
                        setTimeout(function() { openCompanyDetailModal(companyId); }, 250);
                      },
                      '削除'
                    );
                  });
                }
              }, 50);
            })(step.id, step.stepName || typeLabel, track.id);

            // 詳細情報
            var details = step.details || {};
            var detailLines = buildStepDetailLines(step.type, details);
            if (detailLines.length > 0) {
              var detailDiv = document.createElement('div');
              detailDiv.className = 'timeline-details';
              for (var dj = 0; dj < detailLines.length; dj++) {
                var p = document.createElement('p');
                p.innerHTML = '<span class="detail-label-inline">' + escapeHtml(detailLines[dj].label) + ':</span> ' + escapeHtml(detailLines[dj].value);
                detailDiv.appendChild(p);
              }
              stepItem.querySelector('.timeline-content').appendChild(detailDiv);
            }

            stepsContainer.appendChild(stepItem);
          }
        }
        trackBlock.appendChild(stepsContainer);

        // 「＋ ステップ追加」ボタン（各トラック内）
        var addStepDiv = document.createElement('div');
        addStepDiv.className = 'track-add-step';
        addStepDiv.innerHTML = '<button class="btn btn-secondary btn-sm" data-track-add-step="' + track.id + '">'
          + '<i data-lucide="plus" class="icon-sm"></i> ステップ追加</button>';
        trackBlock.appendChild(addStepDiv);

        // トラック編集・削除・ステップ追加のイベントリスナー
        setTimeout(function() {
          var editBtn = trackBlock.querySelector('[data-track-edit="' + track.id + '"]');
          if (editBtn) {
            editBtn.addEventListener('click', function() {
              Modal.close();
              setTimeout(function() { openTrackFormModal(companyId, track.id); }, 250);
            });
          }
          var deleteBtn = trackBlock.querySelector('[data-track-delete="' + track.id + '"]');
          if (deleteBtn) {
            deleteBtn.addEventListener('click', function(e) {
              e.stopPropagation();
              Modal.confirm(
                'この選考「' + trackTypeLabel + (track.position ? ' ' + track.position : '') + '」を削除しますか？\n（関連するステップも全て削除されます）',
                function() {
                  Store.deleteTrack(track.id);
                  Toast.show('選考を削除しました', 'success');
                  setTimeout(function() { openCompanyDetailModal(companyId); }, 250);
                },
                '削除'
              );
            });
          }
          var addStepBtn = trackBlock.querySelector('[data-track-add-step="' + track.id + '"]');
          if (addStepBtn) {
            addStepBtn.addEventListener('click', function() {
              Modal.close();
              setTimeout(function() { openStepFormModal(companyId, track.id); }, 250);
            });
          }
        }, 50);

        tracksSection.appendChild(trackBlock);
      })(tracks[ti]);
    }
  }
  sectionsGrid.appendChild(tracksSection);

  // --- E. イベント履歴セクション ---
  var eventsSection = document.createElement('div');
  eventsSection.className = 'timeline-section';
  eventsSection.innerHTML = '<div class="timeline-header">'
    + '<h3 class="timeline-title">イベント履歴</h3>'
    + '<button class="btn btn-secondary btn-sm" id="btn-add-event">'
    + '<i data-lucide="plus" class="icon-sm"></i> イベント追加</button></div>';

  setTimeout(function() {
    var addEventBtn = document.getElementById('btn-add-event');
    if (addEventBtn) {
      addEventBtn.addEventListener('click', function() {
        Modal.close();
        setTimeout(function() { openEventFormModal(companyId); }, 250);
      });
    }
  }, 50);

  var eventsList = document.createElement('div');
  eventsList.className = 'timeline-list';
  var companyEvents = Store.getEvents ? Store.getEvents(companyId) : [];

  if (companyEvents.length === 0) {
    eventsList.innerHTML = '<p class="empty-state-text">イベント履歴はありません</p>';
  } else {
    companyEvents.sort(function(a, b) { return new Date(a.date || 0) - new Date(b.date || 0); });
    for (var k = 0; k < companyEvents.length; k++) {
      var ev = companyEvents[k];
      var evItem = document.createElement('div');
      evItem.className = 'timeline-item';
      var catLabel = EVENT_CATEGORY_LABELS[ev.category] || ev.category || 'その他';
      var evColor = CALENDAR_TYPE_COLORS[ev.category] || '#94a3b8';

      var evDateHtml = ev.date
        ? '<span class="meta-item"><i data-lucide="calendar" class="icon-xs"></i> ' + DateUtils.formatDate(ev.date) + '</span>'
        : '';
      var evLocHtml = ev.location
        ? '<span class="meta-item"><i data-lucide="map-pin" class="icon-xs"></i> ' + escapeHtml(ev.location) + '</span>'
        : '';
      var evMemoHtml = ev.memo
        ? '<div class="timeline-details"><p>' + escapeHtml(ev.memo) + '</p></div>'
        : '';

      evItem.innerHTML = '<div class="timeline-marker" style="background-color: ' + evColor + ';"></div>'
        + '<div class="timeline-content card">'
        +   '<div class="timeline-content-header">'
        +     '<div class="timeline-content-title-area">'
        +       '<span class="badge" style="background-color: ' + evColor + '; color: #fff;">' + escapeHtml(catLabel) + '</span>'
        +       '<strong class="timeline-step-name">' + escapeHtml(ev.title || catLabel) + '</strong>'
        +     '</div>'
        +     '<div class="timeline-actions">'
        +       '<button class="btn-icon-sm btn-icon-danger" data-event-delete="' + ev.id + '" title="削除">'
        +         '<i data-lucide="trash-2" class="icon-sm"></i>'
        +       '</button>'
        +     '</div>'
        +   '</div>'
        +   '<div class="timeline-meta">' + evDateHtml + evLocHtml + '</div>'
        +   evMemoHtml
        + '</div>';

      // イベント削除ボタン
      (function(evId, evDisplayName) {
        setTimeout(function() {
          var delBtn = evItem.querySelector('[data-event-delete="' + evId + '"]');
          if (delBtn) {
            delBtn.addEventListener('click', function(e) {
              e.stopPropagation();
              Modal.confirm(
                'このイベント「' + evDisplayName + '」を削除しますか？',
                function() {
                  Store.deleteEvent(evId);
                  Toast.show('イベントを削除しました', 'success');
                  setTimeout(function() { openCompanyDetailModal(companyId); }, 250);
                },
                '削除'
              );
            });
          }
        }, 50);
      })(ev.id, ev.title || catLabel);

      eventsList.appendChild(evItem);
    }
  }
  eventsSection.appendChild(eventsList);
  sectionsGrid.appendChild(eventsSection);

  content.appendChild(sectionsGrid);

  Modal.open({
    title: company.name || '企業詳細',
    content: content,
    size: 'large',
    hideFooter: true,
    onClose: function() { renderTable(); }
  });

  if (window.lucide) window.lucide.createIcons();
}





// =========================================================
//  選考トラック追加・編集モーダル
// =========================================================
function openTrackFormModal(companyId, trackId) {
  var company = Store.getCompany(companyId);
  if (!company) return;
  var existing = trackId ? Store.getTrack(trackId) : null;
  var isEdit = !!existing;

  var form = document.createElement('div');

  // 選考区分
  var typeOptionsHtml = '';
  for (var i = 0; i < TRACK_TYPE_OPTIONS.length; i++) {
    var opt = TRACK_TYPE_OPTIONS[i];
    var selected = (existing && existing.type === opt) ? ' selected' : '';
    typeOptionsHtml += '<option value="' + opt + '"' + selected + '>' + escapeHtml(TRACK_TYPE_LABELS[opt] || opt) + '</option>';
  }
  form.innerHTML = '<div class="form-group">'
    + '<label class="form-label">選考区分</label>'
    + '<select class="form-select" id="track-type">' + typeOptionsHtml + '</select>'
    + '</div>';

  // コース名（任意）
  var positionDiv = document.createElement('div');
  positionDiv.className = 'form-group';
  positionDiv.innerHTML = '<label class="form-label">応募職種・コース名 <span class="form-hint">（任意）</span></label>'
    + '<input type="text" class="form-input" id="track-position" placeholder="例: クラウドソリューションSEコース" value="' + escapeHtml(existing ? existing.position || '' : '') + '">';
  form.appendChild(positionDiv);

  // メモ（任意）
  var memoDiv = document.createElement('div');
  memoDiv.className = 'form-group';
  memoDiv.innerHTML = '<label class="form-label">募集要項・メモ <span class="form-hint">（任意）</span></label>'
    + '<textarea class="form-textarea" id="track-memo" rows="3" placeholder="例: ES締切7/15、プログラミング経験必須">' + escapeHtml(existing ? existing.memo || '' : '') + '</textarea>';
  form.appendChild(memoDiv);

  // ステータス
  var statusOptionsHtml = '';
  for (var j = 0; j < STATUS_OPTIONS.length; j++) {
    var st = STATUS_OPTIONS[j];
    var stSelected = '';
    if (existing && existing.status === st) {
      stSelected = ' selected';
    } else if (!existing && st === 'interested') {
      stSelected = ' selected';
    }
    statusOptionsHtml += '<option value="' + st + '"' + stSelected + '>' + escapeHtml(STATUS_LABELS[st] || st) + '</option>';
  }
  var statusDiv = document.createElement('div');
  statusDiv.className = 'form-group';
  statusDiv.innerHTML = '<label class="form-label">選考ステータス</label>'
    + '<select class="form-select" id="track-status">' + statusOptionsHtml + '</select>';
  form.appendChild(statusDiv);

  Modal.open({
    title: (isEdit ? '選考を編集' : '選考を追加') + ' — ' + escapeHtml(company.name),
    content: form,
    size: 'medium',
    saveLabel: isEdit ? '更新' : '追加',
    onSave: function() {
      var typeVal = document.getElementById('track-type').value;
      var positionVal = (document.getElementById('track-position').value || '').trim();
      var memoVal = (document.getElementById('track-memo').value || '').trim();
      var statusVal = document.getElementById('track-status').value;

      if (isEdit) {
        Store.updateTrack(trackId, {
          type: typeVal,
          position: positionVal,
          memo: memoVal,
          status: statusVal
        });
        Toast.show('選考を更新しました', 'success');
      } else {
        Store.addTrack({
          companyId: companyId,
          type: typeVal,
          position: positionVal,
          memo: memoVal
        });
        // 新規作成時にステータスを設定
        var tracks = Store.getTracks(companyId);
        if (tracks.length > 0 && statusVal !== 'interested') {
          Store.updateTrack(tracks[0].id, { status: statusVal });
        }
        Toast.show('選考を追加しました', 'success');
      }

      Modal.close();
      setTimeout(function() { openCompanyDetailModal(companyId); }, 250);
    }
  });
}

// =========================================================
//  イベント追加モーダル（企業詳細から呼び出し）
// =========================================================
function openEventFormModal(companyId) {
  var company = Store.getCompany(companyId);
  if (!company) return;

  var form = document.createElement('div');
  form.className = 'modal-form';

  // イベント種別
  var categorySelect = FormUtils.createSelect(
    EVENT_CATEGORY_OPTIONS.map(function(c) { return { value: c, label: EVENT_CATEGORY_LABELS[c] }; }),
    '',
    { name: 'category', id: 'event-category-select' }
  );
  form.appendChild(FormUtils.createFormGroup('イベント種別', categorySelect, { required: true }));

  // タイトル
  form.appendChild(
    FormUtils.createFormGroup('タイトル',
      FormUtils.createInput('text', '例：夏季1Dayインターン', '', { name: 'title' })
    )
  );

  // 日付
  form.appendChild(
    FormUtils.createFormGroup('日付',
      FormUtils.createInput('date', '', '', { name: 'date' }),
      { required: true }
    )
  );

  // 場所
  form.appendChild(
    FormUtils.createFormGroup('場所',
      FormUtils.createInput('text', '例：東京本社 / オンライン', '', { name: 'location' })
    )
  );

  // 参加URL
  form.appendChild(
    FormUtils.createFormGroup('参加URL',
      FormUtils.createInput('url', 'https://...', '', { name: 'url' })
    )
  );

  // メモ
  form.appendChild(
    FormUtils.createFormGroup('メモ',
      FormUtils.createTextarea('イベントに関するメモ', '', 0, { name: 'memo', rows: 3 })
    )
  );

  Modal.open({
    title: company.name + ' — イベント追加',
    content: form,
    size: 'medium',
    saveLabel: '追加',
    onSave: function(modal) {
      var data = FormUtils.collectFormData(modal);
      if (!data.category) {
        Toast.show('イベント種別を選択してください', 'error');
        return;
      }
      if (!data.date) {
        Toast.show('日付を入力してください', 'error');
        return;
      }

      Store.addEvent({
        companyId: companyId,
        category: data.category,
        title: data.title || '',
        date: data.date,
        location: data.location || '',
        companyName: company.name || '',
        url: data.url || '',
        memo: data.memo || ''
      });

      Toast.show('イベントを追加しました', 'success');
      Modal.close();
      setTimeout(function() { openCompanyDetailModal(companyId); }, 250);
    },
    onClose: function() {
      setTimeout(function() { openCompanyDetailModal(companyId); }, 250);
    }
  });

  if (window.lucide) window.lucide.createIcons();
}

// ---------------------
// ステップ詳細テキスト生成
// ---------------------
function buildStepDetailLines(type, details) {
  var lines = [];
  switch (type) {
    case 'es':
      if (details.questionTitle) lines.push({ label: '設問タイトル', value: details.questionTitle });
      if (details.charLimit) lines.push({ label: '文字数上限', value: details.charLimit + '字' });
      if (details.submissionMemo) lines.push({ label: '提出メモ', value: details.submissionMemo });
      break;
    case 'webtest':
      if (details.testType) lines.push({ label: 'テスト種類', value: details.testType });
      if (details.method) lines.push({ label: '受験方法', value: details.method });
      if (details.examUrl) lines.push({ label: '受験URL', value: details.examUrl });
      if (details.confidence) lines.push({ label: '手応え', value: details.confidence });
      break;
    case 'gd':
      if (details.theme) lines.push({ label: 'テーマ', value: details.theme });
      if (details.participants) lines.push({ label: '参加人数', value: details.participants + '人' });
      if (details.role) lines.push({ label: '役割', value: details.role });
      if (details.confidence) lines.push({ label: '手応え', value: details.confidence });
      if (details.reflection) lines.push({ label: '反省・メモ', value: details.reflection });
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
    case 'intern_day':
      if (details.internType) lines.push({ label: 'インターン種別', value: details.internType });
      if (details.duration) lines.push({ label: '期間', value: details.duration });
      if (details.content) lines.push({ label: '実施内容', value: details.content });
      if (details.learnings) lines.push({ label: '学び・感想', value: details.learnings });
      break;
    case 'offer':
      if (details.offerDate) lines.push({ label: '内定連絡日', value: details.offerDate });
      if (details.deadline) lines.push({ label: '承諾期限', value: details.deadline });
      if (details.conditions) lines.push({ label: '条件・メモ', value: details.conditions });
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
function openStepFormModal(companyId, trackId, stepId) {
  var company = Store.getCompany(companyId);
  if (!company) return;
  var existing = stepId ? Store.getStep(stepId) : null;
  var isEdit = !!existing;

  // トラック名をヘッダーに表示
  var trackLabel = '';
  if (trackId) {
    var track = Store.getTrack(trackId);
    if (track) {
      var trackTypeName = TRACK_TYPE_LABELS[track.type] || track.type || '';
      trackLabel = ' [' + trackTypeName + (track.position ? ': ' + track.position : '') + ']';
    }
  }

  var form = document.createElement('div');
  form.className = 'modal-form';

  // ステップ種類
  var typeOptionsHtml = '<option value="">-- 選択 --</option>';
  for (var i = 0; i < STEP_TYPE_OPTIONS.length; i++) {
    var t = STEP_TYPE_OPTIONS[i];
    var sel = (existing && existing.type === t) ? ' selected' : '';
    typeOptionsHtml += '<option value="' + t + '"' + sel + '>' + escapeHtml(STEP_TYPE_LABELS[t] || t) + '</option>';
  }
  var typeGroup = document.createElement('div');
  typeGroup.className = 'form-group';
  typeGroup.innerHTML = '<label class="form-label">ステップ種類 <span style="color:#ef4444;">*</span></label>'
    + '<select class="form-select" name="type" id="step-type-select">' + typeOptionsHtml + '</select>';
  form.appendChild(typeGroup);

  // ステップ名
  var nameGroup = document.createElement('div');
  nameGroup.className = 'form-group';
  nameGroup.innerHTML = '<label class="form-label">ステップ名</label>'
    + '<input type="text" class="form-input" name="stepName" placeholder="例：一次面接" value="' + escapeHtml(existing ? existing.stepName || '' : '') + '">';
  form.appendChild(nameGroup);

  // 予定日
  var dateGroup = document.createElement('div');
  dateGroup.className = 'form-group';
  dateGroup.innerHTML = '<label class="form-label">予定日</label>'
    + '<input type="date" class="form-input" name="scheduledDate" value="' + (existing ? existing.scheduledDate || '' : '') + '">';
  form.appendChild(dateGroup);

  // 場所
  var locGroup = document.createElement('div');
  locGroup.className = 'form-group';
  locGroup.innerHTML = '<label class="form-label">場所</label>'
    + '<input type="text" class="form-input" name="location" placeholder="例：東京本社 / オンライン" value="' + escapeHtml(existing ? existing.location || '' : '') + '">';
  form.appendChild(locGroup);

  // 結果
  var resultOptionsHtml = '';
  for (var r = 0; r < RESULT_OPTIONS.length; r++) {
    var ro = RESULT_OPTIONS[r];
    var rSel = (existing && existing.result === ro.value) ? ' selected' : '';
    if (!existing && ro.value === 'pending') rSel = ' selected';
    resultOptionsHtml += '<option value="' + ro.value + '"' + rSel + '>' + escapeHtml(ro.label) + '</option>';
  }
  var resultGroup = document.createElement('div');
  resultGroup.className = 'form-group';
  resultGroup.innerHTML = '<label class="form-label">結果</label>'
    + '<select class="form-select" name="result">' + resultOptionsHtml + '</select>';
  form.appendChild(resultGroup);

  // 動的フィールドコンテナ
  var dynamicFields = document.createElement('div');
  dynamicFields.id = 'step-dynamic-fields';
  form.appendChild(dynamicFields);

  // type変更時に動的フィールドを更新
  var typeSelect = form.querySelector('#step-type-select');
  typeSelect.addEventListener('change', function() {
    renderStepDynamicFields(typeSelect.value, dynamicFields, null);
  });

  // 編集時: 既存typeに応じた動的フィールドをプリフィル表示
  if (existing && existing.type) {
    setTimeout(function() {
      renderStepDynamicFields(existing.type, dynamicFields, existing.details || {});
    }, 50);
  }

  Modal.open({
    title: company.name + ' — ' + (isEdit ? 'ステップ編集' : 'ステップ追加') + trackLabel,
    content: form,
    size: 'large',
    saveLabel: isEdit ? '更新' : '追加',
    onSave: function(modal) {
      var data = FormUtils.collectFormData(modal);
      var type = data.type;
      if (!type) {
        Toast.show('ステップ種類を選択してください', 'error');
        return;
      }

      // details をまとめる
      var details = extractStepDetails(type, data);

      if (isEdit) {
        Store.updateStep(stepId, {
          type: type,
          stepName: data.stepName || '',
          scheduledDate: data.scheduledDate || '',
          location: data.location || '',
          result: data.result || 'pending',
          details: details
        });
        Toast.show('ステップを更新しました', 'success');
      } else {
        Store.addStep({
          companyId: companyId,
          trackId: trackId || null,
          type: type,
          stepName: data.stepName || '',
          scheduledDate: data.scheduledDate || '',
          location: data.location || '',
          result: data.result || 'pending',
          details: details
        });
        Toast.show('ステップを追加しました', 'success');
      }

      Modal.close();
      setTimeout(function() { openCompanyDetailModal(companyId); }, 250);
    },
    onClose: function() {
      setTimeout(function() { openCompanyDetailModal(companyId); }, 250);
    }
  });

  if (window.lucide) window.lucide.createIcons();
}

// ---------------------
// 動的フィールドレンダリング
// ---------------------
function renderStepDynamicFields(type, container, existingDetails) {
  container.innerHTML = '';
  if (!type) return;
  var d = existingDetails || {};

  var divider = document.createElement('hr');
  divider.className = 'form-divider';
  container.appendChild(divider);

  var heading = document.createElement('h4');
  heading.className = 'form-section-title';
  heading.textContent = (STEP_TYPE_LABELS[type] || type) + ' 詳細';
  container.appendChild(heading);

  switch (type) {
    case 'es':
      container.appendChild(
        FormUtils.createFormGroup('設問タイトル',
          FormUtils.createInput('text', '例：学生時代に力を入れたこと', d.questionTitle || '', { name: 'detail_questionTitle' })
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('文字数上限',
          FormUtils.createInput('number', '例：400', d.charLimit || '', { name: 'detail_charLimit' })
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('提出メモ',
          FormUtils.createTextarea('提出に関するメモ', d.submissionMemo || '', 0, { name: 'detail_submissionMemo', rows: 3 })
        )
      );
      break;

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
            d.testType || '',
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
            d.method || '',
            { name: 'detail_method' }
          )
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('受験URL',
          FormUtils.createInput('url', 'https://...', d.examUrl || '', { name: 'detail_examUrl' })
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
            d.confidence || '',
            { name: 'detail_confidence' }
          )
        )
      );
      break;

    case 'gd':
      container.appendChild(
        FormUtils.createFormGroup('テーマ',
          FormUtils.createInput('text', '例：新規事業の提案', d.theme || '', { name: 'detail_theme' })
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('参加人数',
          FormUtils.createInput('number', '例：6', d.participants || '', { name: 'detail_participants' })
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('自分の役割',
          FormUtils.createSelect(
            [
              { value: 'リーダー', label: 'リーダー' },
              { value: '書記', label: '書記' },
              { value: 'タイムキーパー', label: 'タイムキーパー' },
              { value: '発表者', label: '発表者' },
              { value: 'その他', label: 'その他' }
            ],
            d.role || '',
            { name: 'detail_role' }
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
            d.confidence || '',
            { name: 'detail_confidence' }
          )
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('反省・メモ',
          FormUtils.createTextarea('GDの反省点や気づき', d.reflection || '', 0, { name: 'detail_reflection', rows: 3 })
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
            d.round || '',
            { name: 'detail_round' }
          )
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('形式',
          FormUtils.createSelect(
            [
              { value: '個人面接', label: '個人面接' },
              { value: '集団面接', label: '集団面接' }
            ],
            d.format || '',
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
            d.interviewMethod || '',
            { name: 'detail_interviewMethod' }
          )
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('面接官人数',
          FormUtils.createInput('number', '例：2', d.interviewerCount || '', { name: 'detail_interviewerCount' })
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
            d.atmosphere || '',
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
            d.confidence || '',
            { name: 'detail_confidence' }
          )
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('質問内容',
          FormUtils.createTextarea('聞かれた質問を記録', d.questions || '', 0, { name: 'detail_questions', rows: 3 })
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('回答内容',
          FormUtils.createTextarea('自分の回答を記録', d.answers || '', 0, { name: 'detail_answers', rows: 3 })
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('反省点',
          FormUtils.createTextarea('改善点・気づきを記録', d.reflection || '', 0, { name: 'detail_reflection', rows: 3 })
        )
      );
      break;

    case 'intern_day':
      container.appendChild(
        FormUtils.createFormGroup('インターン種別',
          FormUtils.createSelect(
            [
              { value: '1Day', label: '1Day' },
              { value: '短期（2〜5日）', label: '短期（2〜5日）' },
              { value: '長期（1週間以上）', label: '長期（1週間以上）' }
            ],
            d.internType || '',
            { name: 'detail_internType' }
          )
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('期間',
          FormUtils.createInput('text', '例：8/20〜8/24（5日間）', d.duration || '', { name: 'detail_duration' })
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('実施内容',
          FormUtils.createTextarea('インターンでの内容', d.content || '', 0, { name: 'detail_content', rows: 3 })
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('学び・感想',
          FormUtils.createTextarea('学んだこと・感想を記録', d.learnings || '', 0, { name: 'detail_learnings', rows: 3 })
        )
      );
      break;

    case 'offer':
      container.appendChild(
        FormUtils.createFormGroup('内定連絡日',
          FormUtils.createInput('date', '', d.offerDate || '', { name: 'detail_offerDate' })
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('承諾期限',
          FormUtils.createInput('date', '', d.deadline || '', { name: 'detail_deadline' })
        )
      );
      container.appendChild(
        FormUtils.createFormGroup('条件・メモ',
          FormUtils.createTextarea('給与・勤務地・その他条件メモ', d.conditions || '', 0, { name: 'detail_conditions', rows: 3 })
        )
      );
      break;

    case 'other':
    default:
      container.appendChild(
        FormUtils.createFormGroup('自由記述',
          FormUtils.createTextarea('詳細を自由に記入', d.freeText || '', 0, { name: 'detail_freeText', rows: 4 })
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
