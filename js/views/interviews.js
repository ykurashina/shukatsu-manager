// interviews.js — 面接記録ビュー

import { Store } from '../store.js';
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
    if (event.startsWith('interview_') || event === 'save' || event === 'import' || event === 'clear') {
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

  const interviews = Store.getInterviews();
  const companies = Store.getCompanies();
  const companyMap = {};
  companies.forEach(c => companyMap[c.id] = c.name);

  // 日付順（新しい順）
  interviews.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

  _container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">面接記録</h1>
      <div class="page-actions">
        <button class="btn btn-primary" id="interview-add-btn">
          <i data-lucide="plus"></i> 面接記録を追加
        </button>
      </div>
    </div>
    ${interviews.length === 0 ? `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="message-square"></i></div>
        <h3>面接記録がまだありません</h3>
        <p>面接を受けた後に記録を残しましょう</p>
      </div>
    ` : `
      <div class="interview-list">
        ${interviews.map(interview => {
          const companyName = companyMap[interview.companyId] || '不明な企業';
          const resultBadge = interview.result === 'passed' ? 'badge-passed' :
                              interview.result === 'failed' ? 'badge-failed' : 'badge-pending';
          const resultLabel = interview.result === 'passed' ? '合格' :
                              interview.result === 'failed' ? '不合格' : '結果待ち';
          return `
            <div class="interview-card" data-id="${interview.id}">
              <div class="interview-card-header">
                <div>
                  <span class="interview-card-company">${companyName}</span>
                  <span class="badge ${resultBadge}" style="margin-left:8px;">${resultLabel}</span>
                </div>
                <div class="page-actions">
                  <button class="btn-icon interview-delete-btn" data-id="${interview.id}" data-tooltip="削除">
                    <i data-lucide="trash-2"></i>
                  </button>
                </div>
              </div>
              <div class="interview-card-meta">
                ${interview.round ? `<div class="interview-meta-item"><i data-lucide="hash"></i> ${interview.round}</div>` : ''}
                ${interview.format ? `<div class="interview-meta-item"><i data-lucide="users"></i> ${interview.format}</div>` : ''}
                ${interview.method ? `<div class="interview-meta-item"><i data-lucide="monitor"></i> ${interview.method}</div>` : ''}
                ${interview.date ? `<div class="interview-meta-item"><i data-lucide="calendar"></i> ${DateUtils.formatShortDate(interview.date)}</div>` : ''}
                ${interview.confidence ? `<div class="interview-meta-item"><i data-lucide="gauge"></i> 手応え: ${interview.confidence}</div>` : ''}
              </div>
              ${interview.reflection ? `<div class="interview-card-reflection">${interview.reflection}</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;

  // イベント
  _container.querySelector('#interview-add-btn')?.addEventListener('click', () => _openInterviewModal());
  _container.querySelectorAll('.interview-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.interview-delete-btn')) return;
      _openInterviewModal(card.dataset.id);
    });
  });
  _container.querySelectorAll('.interview-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      Modal.confirm('この面接記録を削除しますか？', () => {
        Store.deleteInterview(btn.dataset.id);
        Toast.success('面接記録を削除しました');
      });
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

function _openInterviewModal(interviewId) {
  const interview = interviewId ? Store.getInterview(interviewId) : null;
  const companies = Store.getCompanies();
  const isEdit = !!interview;

  const content = document.createElement('div');

  // 企業選択
  const companyOptions = companies.map(c => ({ value: c.id, label: c.name }));
  const companySelect = FormUtils.createSelect(companyOptions, interview?.companyId || '');
  content.appendChild(FormUtils.createFormGroup('企業', companySelect, { required: true }));

  // 面接次数・形式
  const row1 = document.createElement('div');
  row1.className = 'form-row';
  const roundInput = FormUtils.createInput('text', '例: 一次面接', interview?.round || '', { name: 'round' });
  row1.appendChild(FormUtils.createFormGroup('面接次数', roundInput));
  const formatSelect = FormUtils.createSelect(
    [{ value: '個人面接', label: '個人面接' }, { value: '集団面接', label: '集団面接' }, { value: 'グループディスカッション', label: 'グループディスカッション' }],
    interview?.format || ''
  );
  row1.appendChild(FormUtils.createFormGroup('形式', formatSelect));
  content.appendChild(row1);

  // 方式・日付
  const row2 = document.createElement('div');
  row2.className = 'form-row';
  const methodSelect = FormUtils.createSelect(
    [{ value: '対面', label: '対面' }, { value: 'オンライン', label: 'オンライン' }],
    interview?.method || ''
  );
  row2.appendChild(FormUtils.createFormGroup('方式', methodSelect));
  const dateInput = FormUtils.createInput('date', '', interview?.date || '', { name: 'date' });
  row2.appendChild(FormUtils.createFormGroup('面接日', dateInput));
  content.appendChild(row2);

  // 面接官人数・雰囲気
  const row3 = document.createElement('div');
  row3.className = 'form-row';
  const countInput = FormUtils.createInput('number', '人数', interview?.interviewerCount || '', { name: 'interviewerCount' });
  row3.appendChild(FormUtils.createFormGroup('面接官人数', countInput));
  const atmosphereSelect = FormUtils.createSelect(
    [{ value: '和やか', label: '和やか' }, { value: '普通', label: '普通' }, { value: '厳しめ', label: '厳しめ' }, { value: '圧迫', label: '圧迫' }],
    interview?.atmosphere || ''
  );
  row3.appendChild(FormUtils.createFormGroup('雰囲気', atmosphereSelect));
  content.appendChild(row3);

  // 手応え・結果
  const row4 = document.createElement('div');
  row4.className = 'form-row';
  const confidenceSelect = FormUtils.createSelect(
    [{ value: '◎', label: '◎ とても良い' }, { value: '○', label: '○ まあまあ' }, { value: '△', label: '△ 微妙' }, { value: '×', label: '× ダメだった' }],
    interview?.confidence || ''
  );
  row4.appendChild(FormUtils.createFormGroup('手応え', confidenceSelect));
  const resultSelect = FormUtils.createSelect(
    [{ value: 'pending', label: '結果待ち' }, { value: 'passed', label: '合格' }, { value: 'failed', label: '不合格' }],
    interview?.result || 'pending',
    { noEmpty: true }
  );
  row4.appendChild(FormUtils.createFormGroup('結果', resultSelect));
  content.appendChild(row4);

  // 質問内容
  const questionsArea = FormUtils.createTextarea('聞かれた質問を記録...', interview?.questions || '', 0, { name: 'questions', rows: 4 });
  content.appendChild(FormUtils.createFormGroup('質問内容', questionsArea));

  // 回答内容
  const answersArea = FormUtils.createTextarea('自分の回答を記録...', interview?.answers || '', 0, { name: 'answers', rows: 4 });
  content.appendChild(FormUtils.createFormGroup('回答内容', answersArea));

  // 反省点
  const reflectionArea = FormUtils.createTextarea('反省点・改善点を記録...', interview?.reflection || '', 0, { name: 'reflection', rows: 4 });
  content.appendChild(FormUtils.createFormGroup('反省点', reflectionArea));

  Modal.open({
    title: isEdit ? '面接記録を編集' : '面接記録を追加',
    content,
    size: 'large',
    saveLabel: isEdit ? '更新' : '追加',
    onSave: () => {
      const data = {
        companyId: companySelect.value,
        round: roundInput.value,
        format: formatSelect.value,
        method: methodSelect.value,
        date: dateInput.value,
        interviewerCount: parseInt(countInput.value) || 0,
        atmosphere: atmosphereSelect.value,
        confidence: confidenceSelect.value,
        result: resultSelect.value,
        questions: questionsArea.querySelector('textarea').value,
        answers: answersArea.querySelector('textarea').value,
        reflection: reflectionArea.querySelector('textarea').value,
      };

      if (!data.companyId) { Toast.warning('企業を選択してください'); return; }

      if (isEdit) {
        Store.updateInterview(interview.id, data);
        Toast.success('面接記録を更新しました');
      } else {
        Store.addInterview(data);
        Toast.success('面接記録を追加しました');
      }
      Modal.close();
    }
  });
}
