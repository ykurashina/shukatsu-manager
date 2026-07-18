// store.js — データストア（LocalStorage / Google Drive ハイブリッド切替）

const STORAGE_KEY = 'shukatsu_manager_data';
const STORAGE_MODE_KEY = 'shukatsu_storage_mode';

// Google Drive 連携設定
const GOOGLE_CLIENT_ID = '289971491168-ktd8j68u57tmm0roa9fknhat557onq9q.apps.googleusercontent.com';
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GOOGLE_DRIVE_FILENAME = 'shukatsu_data.json';
const GOOGLE_DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

// ステータス定義
export const STATUS_OPTIONS = ['interested', 'es_drafting', 'es_submitted', 'webtest', 'interviewing', 'offer', 'declined', 'rejected'];

export const STATUS_LABELS = {
  interested: '興味あり',
  es_drafting: 'ES作成中',
  es_submitted: 'ES提出済',
  webtest: 'Webテスト・筆記',
  interviewing: '面接中',
  offer: '内定',
  declined: '辞退',
  rejected: '不採用'
};

export const STATUS_COLORS = {
  interested: '#94a3b8',
  es_drafting: '#f59e0b',
  es_submitted: '#3b82f6',
  webtest: '#8b5cf6',
  interviewing: '#06b6d4',
  offer: '#10b981',
  declined: '#6b7280',
  rejected: '#ef4444'
};

export const INDUSTRY_OPTIONS = ['IT', '金融', 'メーカー', 'コンサル', '商社', 'インフラ', '公務員', 'その他'];
export const PRIORITY_OPTIONS = ['S', 'A', 'B', 'C'];
export const PRIORITY_COLORS = { S: '#ef4444', A: '#f59e0b', B: '#3b82f6', C: '#94a3b8' };
export const SOURCE_OPTIONS = ['マイナビ', 'リクナビ', '直接応募', 'スカウト', 'その他'];

export const STEP_TYPE_OPTIONS = ['webtest', 'interview', 'briefing', 'obog', 'other'];
export const STEP_TYPE_LABELS = {
  webtest: 'Webテスト・筆記',
  interview: '面接',
  briefing: '説明会',
  obog: 'OB/OG訪問',
  other: 'その他'
};

export const ES_STATUS_OPTIONS = ['not_started', 'drafting', 'completed', 'submitted'];
export const ES_STATUS_LABELS = {
  not_started: '未作成',
  drafting: '作成中',
  completed: '完成',
  submitted: '提出済み'
};

export const NOTE_CATEGORY_OPTIONS = ['gakuchika', 'self_pr', 'motivation', 'strengths', 'hobbies', 'free'];
export const NOTE_CATEGORY_LABELS = {
  gakuchika: 'ガクチカ',
  self_pr: '自己PR',
  motivation: '志望動機の軸',
  strengths: '強み / 弱み',
  hobbies: '趣味・特技',
  free: '自由メモ'
};

export const BOOKMARK_CATEGORY_OPTIONS = ['job_site', 'research', 'webtest', 'news', 'other'];
export const BOOKMARK_CATEGORY_LABELS = {
  job_site: '就活サイト',
  research: '企業研究',
  webtest: 'Webテスト対策',
  news: 'ニュース',
  other: 'その他'
};

export const EVENT_TYPE_COLORS = {
  es_deadline: '#ef4444',
  interview: '#3b82f6',
  briefing: '#10b981',
  webtest: '#f59e0b',
  obog: '#8b5cf6',
  other: '#94a3b8'
};

// ---------- ユーティリティ ----------
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function now() {
  return new Date().toISOString();
}

// ---------- デフォルトデータ ----------
function createDefaultData() {
  return {
    companies: [],
    steps: [],
    esDocuments: [],
    interviews: [],
    notes: [],
    bookmarks: getDefaultBookmarks(),
    settings: {
      storageMode: null, // 'local' | 'google' — 初回起動時に選択
      gbizToken: '',
      rssFeedUrl: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fnews.mynavi.jp%2Frss%2Findex'
    }
  };
}

function getDefaultBookmarks() {
  return [
    { id: generateId(), name: 'マイナビ', url: 'https://job.mynavi.jp/', category: 'job_site', memo: '新卒就活サイト', createdAt: now() },
    { id: generateId(), name: 'リクナビ', url: 'https://job.rikunabi.com/', category: 'job_site', memo: '新卒就活サイト', createdAt: now() },
    { id: generateId(), name: 'ワンキャリア', url: 'https://www.onecareer.jp/', category: 'job_site', memo: '選考体験記・ES閲覧', createdAt: now() },
    { id: generateId(), name: 'OpenWork', url: 'https://www.openwork.jp/', category: 'research', memo: '社員口コミ・企業評価', createdAt: now() },
    { id: generateId(), name: '就活会議', url: 'https://syukatsu-kaigi.jp/', category: 'research', memo: 'ES・面接体験記', createdAt: now() },
    { id: generateId(), name: 'OfferBox', url: 'https://offerbox.jp/', category: 'job_site', memo: 'スカウト型就活', createdAt: now() },
  ];
}

// ---------- ストアクラス ----------
class DataStore {
  constructor() {
    this._data = null;
    this._listeners = [];
    this._saveTimeout = null;
    this._storageMode = null; // 'local' | 'google'
    this._isOffline = false; // オフラインフラグ（読み取り専用）

    // Google Drive 関連
    this._googleTokenClient = null;
    this._googleAccessToken = null;
    this._googleFileId = null; // ドライブ上のファイルID
    this._googleUser = null; // { name, email, picture }
    this._gapiInited = false;
    this._gisInited = false;
    this._googleSyncing = false; // 同期中フラグ
  }

  // --- 初期化 ---
  async init() {
    // オフライン状態の検知
    this._isOffline = !navigator.onLine;

    // オンライン/オフライン状態の変化を監視
    window.addEventListener('online', () => {
      this._isOffline = false;
      this._notifyListeners('online');
    });
    window.addEventListener('offline', () => {
      this._isOffline = true;
      this._notifyListeners('offline');
    });

    // 保存モードの復元
    try {
      this._storageMode = localStorage.getItem(STORAGE_MODE_KEY);
      // 旧バージョンの 'file' モードは 'local' にマイグレーション
      if (this._storageMode === 'file') {
        this._storageMode = 'local';
        localStorage.setItem(STORAGE_MODE_KEY, 'local');
      }
    } catch (e) {
      this._storageMode = null;
    }

    // Google API の初期化（モードに関係なく準備しておく）
    if (!this._isOffline) {
      await this._initGoogleApis();
    }

    // データの読み込み
    if (this._storageMode === 'google') {
      if (this._isOffline) {
        // オフライン時: LocalStorageのキャッシュから読み込み（読み取り専用）
        this._loadFromLocalStorage();
      } else {
        // オンライン時: キャッシュされたトークンで自動ログインを試みる
        const autoSuccess = await this.autoLoginFromCache();
        if (!autoSuccess) {
          // 自動ログイン失敗時は、いったん空データにする（app.js側でログイン画面に誘導される）
          this._data = createDefaultData();
        }
      }
    } else if (this._storageMode === 'local') {
      this._loadFromLocalStorage();
    } else {
      // まだ保存モードが選択されていない → デフォルトデータで初期化
      this._data = createDefaultData();
    }
  }

  // --- 保存モード ---
  get storageMode() {
    return this._storageMode;
  }

  get isStorageModeSelected() {
    return this._storageMode !== null;
  }

  get isGoogleMode() {
    return this._storageMode === 'google';
  }

  get isGoogleConnected() {
    return this._storageMode === 'google' && this._googleAccessToken !== null;
  }

  get googleUser() {
    return this._googleUser;
  }

  get isGoogleSyncing() {
    return this._googleSyncing;
  }

  get isOffline() {
    return this._isOffline;
  }

  selectLocalMode() {
    this._storageMode = 'local';
    try {
      localStorage.setItem(STORAGE_MODE_KEY, 'local');
    } catch (e) { /* ignore */ }
    this._saveToLocalStorage();
  }

  // --- LocalStorage ---
  _loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this._data = JSON.parse(raw);
        this._migrateData();
      } else {
        this._data = createDefaultData();
        this._data.settings.storageMode = 'local';
      }
    } catch (e) {
      console.error('LocalStorage読み込みエラー:', e);
      this._data = createDefaultData();
      this._data.settings.storageMode = 'local';
    }
  }

  _saveToLocalStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
    } catch (e) {
      console.error('LocalStorage書き込みエラー:', e);
    }
  }

  // --- データマイグレーション ---
  _migrateData() {
    const defaults = createDefaultData();
    for (const key of Object.keys(defaults)) {
      if (!(key in this._data)) {
        this._data[key] = defaults[key];
      }
    }
    if (!this._data.settings) this._data.settings = defaults.settings;
    for (const key of Object.keys(defaults.settings)) {
      if (!(key in this._data.settings)) {
        this._data.settings[key] = defaults.settings[key];
      }
    }
  }

  // --- 保存（デバウンス付き） ---
  _scheduleSave() {
    // オフライン時は保存をブロック（読み取り専用）
    if (this._isOffline) {
      console.warn('オフラインのため保存をスキップしました');
      return;
    }
    if (this._saveTimeout) clearTimeout(this._saveTimeout);
    this._saveTimeout = setTimeout(() => this._save(), 300);
  }

  async _save() {
    if (this._storageMode === 'google') {
      await this._saveToGoogleDrive();
    } else {
      this._saveToLocalStorage();
    }
    this._notifyListeners('save');
  }

  // --- リスナー ---
  onDataChange(callback) {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter(l => l !== callback);
    };
  }

  _notifyListeners(event = 'change') {
    for (const cb of this._listeners) {
      try { cb(event); } catch (e) { console.error(e); }
    }
  }

  // ========================
  //   CRUD: Companies（企業）
  // ========================
  getCompanies() {
    return [...(this._data.companies || [])];
  }

  getCompany(id) {
    return this._data.companies.find(c => c.id === id) || null;
  }

  addCompany(data) {
    const company = {
      id: generateId(),
      name: data.name || '',
      industry: data.industry || '',
      priority: data.priority || 'B',
      status: data.status || 'interested',
      currentStep: data.currentStep || '',
      nextDate: data.nextDate || '',
      source: data.source || '',
      memo: data.memo || '',
      websiteUrl: data.websiteUrl || '',
      mypageUrl: data.mypageUrl || '',
      mypageId: data.mypageId || '',
      mypagePassword: data.mypagePassword || '',
      createdAt: now(),
      updatedAt: now()
    };
    this._data.companies.push(company);
    this._scheduleSave();
    this._notifyListeners('company_add');
    return company;
  }

  updateCompany(id, data) {
    const idx = this._data.companies.findIndex(c => c.id === id);
    if (idx === -1) return null;
    this._data.companies[idx] = { ...this._data.companies[idx], ...data, updatedAt: now() };
    this._scheduleSave();
    this._notifyListeners('company_update');
    return this._data.companies[idx];
  }

  deleteCompany(id) {
    this._data.companies = this._data.companies.filter(c => c.id !== id);
    // 関連データも削除
    this._data.steps = this._data.steps.filter(s => s.companyId !== id);
    this._data.esDocuments = this._data.esDocuments.filter(e => e.companyId !== id);
    this._data.interviews = this._data.interviews.filter(i => i.companyId !== id);
    this._scheduleSave();
    this._notifyListeners('company_delete');
  }

  // ========================
  //   CRUD: Steps（選考ステップ）
  // ========================
  getSteps(companyId) {
    return this._data.steps
      .filter(s => s.companyId === companyId)
      .sort((a, b) => new Date(b.scheduledDate || b.createdAt) - new Date(a.scheduledDate || a.createdAt));
  }

  getStep(id) {
    return this._data.steps.find(s => s.id === id) || null;
  }

  addStep(data) {
    const step = {
      id: generateId(),
      companyId: data.companyId,
      type: data.type || 'other',
      stepName: data.stepName || '',
      scheduledDate: data.scheduledDate || '',
      location: data.location || '',
      result: data.result || 'pending', // pending | passed | failed
      details: data.details || {},
      createdAt: now()
    };
    this._data.steps.push(step);
    // 企業のステータスと現在のステップを自動更新
    this._autoUpdateCompanyStatus(step.companyId);
    this._scheduleSave();
    this._notifyListeners('step_add');
    return step;
  }

  updateStep(id, data) {
    const idx = this._data.steps.findIndex(s => s.id === id);
    if (idx === -1) return null;
    this._data.steps[idx] = { ...this._data.steps[idx], ...data };
    this._autoUpdateCompanyStatus(this._data.steps[idx].companyId);
    this._scheduleSave();
    this._notifyListeners('step_update');
    return this._data.steps[idx];
  }

  deleteStep(id) {
    const step = this._data.steps.find(s => s.id === id);
    if (!step) return;
    const companyId = step.companyId;
    this._data.steps = this._data.steps.filter(s => s.id !== id);
    this._autoUpdateCompanyStatus(companyId);
    this._scheduleSave();
    this._notifyListeners('step_delete');
  }

  // 選考ステップに基づいて企業のステータスと現在のステップを自動更新
  _autoUpdateCompanyStatus(companyId) {
    const steps = this.getSteps(companyId);
    if (steps.length === 0) return;
    const latest = steps[0]; // 最新のステップ（日付降順）

    const company = this.getCompany(companyId);
    if (!company) return;

    // ステップタイプから選考ステータスへのマッピング
    const typeToStatus = {
      webtest: 'webtest',
      interview: 'interviewing',
      briefing: company.status, // 説明会ではステータスを変えない
      obog: company.status, // OB/OG訪問ではステータスを変えない
      other: company.status
    };

    const newStatus = typeToStatus[latest.type] || company.status;
    const updates = {
      currentStep: latest.stepName || STEP_TYPE_LABELS[latest.type] || '',
    };

    // 結果に応じたステータス更新
    if (latest.result === 'passed' && latest.type === 'interview') {
      // 面接通過 → ステータスは面接中のまま
      updates.status = 'interviewing';
    } else if (latest.result === 'failed') {
      updates.status = 'rejected';
    } else {
      updates.status = newStatus;
    }

    // 次の予定日を更新（未来の日付を持つステップの中で最も近いもの）
    const futureSteps = steps.filter(s => s.scheduledDate && new Date(s.scheduledDate) >= new Date());
    if (futureSteps.length > 0) {
      futureSteps.sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
      updates.nextDate = futureSteps[0].scheduledDate;
    }

    this.updateCompany(companyId, updates);
  }

  // ========================
  //   CRUD: ES Documents
  // ========================
  getESDocuments(companyId) {
    if (companyId) {
      return this._data.esDocuments.filter(e => e.companyId === companyId);
    }
    return [...(this._data.esDocuments || [])];
  }

  getESDocument(id) {
    return this._data.esDocuments.find(e => e.id === id) || null;
  }

  addESDocument(data) {
    const doc = {
      id: generateId(),
      companyId: data.companyId || '',
      questionTitle: data.questionTitle || '',
      content: data.content || '',
      charLimit: data.charLimit || 0,
      deadline: data.deadline || '',
      status: data.status || 'not_started',
      createdAt: now(),
      updatedAt: now()
    };
    this._data.esDocuments.push(doc);
    this._scheduleSave();
    this._notifyListeners('es_add');
    return doc;
  }

  updateESDocument(id, data) {
    const idx = this._data.esDocuments.findIndex(e => e.id === id);
    if (idx === -1) return null;
    this._data.esDocuments[idx] = { ...this._data.esDocuments[idx], ...data, updatedAt: now() };
    this._scheduleSave();
    this._notifyListeners('es_update');
    return this._data.esDocuments[idx];
  }

  deleteESDocument(id) {
    this._data.esDocuments = this._data.esDocuments.filter(e => e.id !== id);
    this._scheduleSave();
    this._notifyListeners('es_delete');
  }

  // ========================
  //   CRUD: Interviews（面接記録）
  // ========================
  getInterviews(companyId) {
    if (companyId) {
      return this._data.interviews.filter(i => i.companyId === companyId);
    }
    return [...(this._data.interviews || [])];
  }

  getInterview(id) {
    return this._data.interviews.find(i => i.id === id) || null;
  }

  addInterview(data) {
    const interview = {
      id: generateId(),
      companyId: data.companyId || '',
      stepId: data.stepId || '',
      round: data.round || '',
      format: data.format || '',
      method: data.method || '',
      location: data.location || '',
      date: data.date || '',
      interviewerCount: data.interviewerCount || 0,
      atmosphere: data.atmosphere || '',
      confidence: data.confidence || '',
      questions: data.questions || '',
      answers: data.answers || '',
      reflection: data.reflection || '',
      result: data.result || 'pending',
      createdAt: now()
    };
    this._data.interviews.push(interview);
    this._scheduleSave();
    this._notifyListeners('interview_add');
    return interview;
  }

  updateInterview(id, data) {
    const idx = this._data.interviews.findIndex(i => i.id === id);
    if (idx === -1) return null;
    this._data.interviews[idx] = { ...this._data.interviews[idx], ...data };
    this._scheduleSave();
    this._notifyListeners('interview_update');
    return this._data.interviews[idx];
  }

  deleteInterview(id) {
    this._data.interviews = this._data.interviews.filter(i => i.id !== id);
    this._scheduleSave();
    this._notifyListeners('interview_delete');
  }

  // ========================
  //   CRUD: Notes（自己分析ノート）
  // ========================
  getNotes() {
    return [...(this._data.notes || [])];
  }

  getNote(id) {
    return this._data.notes.find(n => n.id === id) || null;
  }

  addNote(data) {
    const note = {
      id: generateId(),
      title: data.title || '',
      category: data.category || 'free',
      content: data.content || '',
      usedInMemo: data.usedInMemo || '',
      createdAt: now(),
      updatedAt: now()
    };
    this._data.notes.push(note);
    this._scheduleSave();
    this._notifyListeners('note_add');
    return note;
  }

  updateNote(id, data) {
    const idx = this._data.notes.findIndex(n => n.id === id);
    if (idx === -1) return null;
    this._data.notes[idx] = { ...this._data.notes[idx], ...data, updatedAt: now() };
    this._scheduleSave();
    this._notifyListeners('note_update');
    return this._data.notes[idx];
  }

  deleteNote(id) {
    this._data.notes = this._data.notes.filter(n => n.id !== id);
    this._scheduleSave();
    this._notifyListeners('note_delete');
  }

  // ========================
  //   CRUD: Bookmarks
  // ========================
  getBookmarks() {
    return [...(this._data.bookmarks || [])];
  }

  getBookmark(id) {
    return this._data.bookmarks.find(b => b.id === id) || null;
  }

  addBookmark(data) {
    const bookmark = {
      id: generateId(),
      name: data.name || '',
      url: data.url || '',
      category: data.category || 'other',
      memo: data.memo || '',
      createdAt: now()
    };
    this._data.bookmarks.push(bookmark);
    this._scheduleSave();
    this._notifyListeners('bookmark_add');
    return bookmark;
  }

  updateBookmark(id, data) {
    const idx = this._data.bookmarks.findIndex(b => b.id === id);
    if (idx === -1) return null;
    this._data.bookmarks[idx] = { ...this._data.bookmarks[idx], ...data };
    this._scheduleSave();
    this._notifyListeners('bookmark_update');
    return this._data.bookmarks[idx];
  }

  deleteBookmark(id) {
    this._data.bookmarks = this._data.bookmarks.filter(b => b.id !== id);
    this._scheduleSave();
    this._notifyListeners('bookmark_delete');
  }

  // ========================
  //   Settings
  // ========================
  getSettings() {
    return { ...(this._data.settings || {}) };
  }

  updateSettings(data) {
    this._data.settings = { ...this._data.settings, ...data };
    this._scheduleSave();
    this._notifyListeners('settings_update');
  }

  // ========================
  //   Events（カレンダー用 — 選考ステップから自動生成）
  // ========================
  getAllEvents() {
    const events = [];

    // 選考ステップからイベント生成
    for (const step of (this._data.steps || [])) {
      if (!step.scheduledDate) continue;
      const company = this.getCompany(step.companyId);
      const companyName = company ? company.name : '不明な企業';

      let eventType = 'other';
      if (step.type === 'interview') eventType = 'interview';
      else if (step.type === 'webtest') eventType = 'webtest';
      else if (step.type === 'briefing') eventType = 'briefing';
      else if (step.type === 'obog') eventType = 'obog';

      events.push({
        id: step.id,
        date: step.scheduledDate,
        title: `${companyName} - ${step.stepName || STEP_TYPE_LABELS[step.type]}`,
        type: eventType,
        companyId: step.companyId,
        color: EVENT_TYPE_COLORS[eventType]
      });
    }

    // ES締切からイベント生成
    for (const doc of (this._data.esDocuments || [])) {
      if (!doc.deadline) continue;
      const company = this.getCompany(doc.companyId);
      const companyName = company ? company.name : '不明な企業';
      events.push({
        id: `es_${doc.id}`,
        date: doc.deadline,
        title: `${companyName} - ES締切「${doc.questionTitle}」`,
        type: 'es_deadline',
        companyId: doc.companyId,
        color: EVENT_TYPE_COLORS['es_deadline']
      });
    }

    return events.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  // 今後N日間のイベント
  getUpcomingEvents(days = 7) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + days);

    return this.getAllEvents().filter(e => {
      const d = new Date(e.date);
      return d >= today && d <= end;
    });
  }

  // 要アクション（3日以内の締切）
  getUrgentActions() {
    return this.getUpcomingEvents(3);
  }

  // ========================
  //   エクスポート / インポート
  // ========================
  exportData() {
    return JSON.stringify(this._data, null, 2);
  }

  importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      // 基本的なバリデーション
      if (!data.companies || !Array.isArray(data.companies)) {
        throw new Error('無効なデータ形式です');
      }
      this._data = data;
      this._migrateData();
      this._scheduleSave();
      this._notifyListeners('import');
      return true;
    } catch (e) {
      console.error('インポートエラー:', e);
      return false;
    }
  }

  clearAllData() {
    this._data = createDefaultData();
    this._data.settings.storageMode = this._storageMode;
    this._scheduleSave();
    this._notifyListeners('clear');
  }

  // ========================
  //   統計（ダッシュボード用）
  // ========================
  getStats() {
    const companies = this.getCompanies();
    const activeStatuses = ['es_drafting', 'es_submitted', 'webtest', 'interviewing'];
    return {
      total: companies.length,
      active: companies.filter(c => activeStatuses.includes(c.status)).length,
      offers: companies.filter(c => c.status === 'offer').length,
      weeklyEvents: this.getUpcomingEvents(7).length
    };
  }
  // ========================
  //   Google Drive 連携
  // ========================

  /**
   * Google API（gapi + GIS）の初期化
   * index.htmlで読み込んだスクリプトが利用可能になるまで待機する
   */
  async _initGoogleApis() {
    // gapi の初期化
    try {
      await new Promise((resolve, reject) => {
        const check = () => {
          if (typeof gapi !== 'undefined') {
            gapi.load('client', async () => {
              try {
                await gapi.client.init({});
                await gapi.client.load(GOOGLE_DISCOVERY_DOC);
                this._gapiInited = true;
                resolve();
              } catch (err) {
                console.warn('gapi client init error:', err);
                resolve(); // エラーでもアプリ自体は止めない
              }
            });
          } else {
            setTimeout(check, 100);
          }
        };
        check();
        // 5秒でタイムアウト
        setTimeout(() => resolve(), 5000);
      });
    } catch (e) {
      console.warn('gapi load timeout');
    }

    // GIS トークンクライアントの初期化
    try {
      await new Promise((resolve) => {
        const check = () => {
          if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
            this._googleTokenClient = google.accounts.oauth2.initTokenClient({
              client_id: GOOGLE_CLIENT_ID,
              scope: GOOGLE_DRIVE_SCOPE,
              callback: () => {}, // 後でオーバーライド
            });
            this._gisInited = true;
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        check();
        setTimeout(() => resolve(), 5000);
      });
    } catch (e) {
      console.warn('GIS load timeout');
    }
  }

  /**
   * Googleアカウントでログインし、Googleドライブモードに切り替える
   * @returns {Promise<boolean>} ログイン成功ならtrue
   */
  async loginWithGoogle() {
    if (!this._gapiInited || !this._gisInited) {
      console.error('Google API が初期化されていません');
      return false;
    }

    return new Promise((resolve) => {
      this._googleTokenClient.callback = async (tokenResponse) => {
        if (tokenResponse.error) {
          console.error('Google login error:', tokenResponse);
          resolve(false);
          return;
        }

        this._googleAccessToken = tokenResponse.access_token;

        // ユーザー情報を取得
        try {
          const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { 'Authorization': `Bearer ${this._googleAccessToken}` }
          });
          const userInfo = await res.json();
          this._googleUser = {
            name: userInfo.name || '',
            email: userInfo.email || '',
            picture: userInfo.picture || ''
          };
        } catch (e) {
          this._googleUser = { name: '', email: 'ログイン済み', picture: '' };
        }

        // セッションキャッシュにトークンとユーザー情報を保存
        try {
          sessionStorage.setItem('google_access_token', this._googleAccessToken);
          sessionStorage.setItem('google_user', JSON.stringify(this._googleUser));
        } catch (e) { /* ignore */ }

        // ストレージモードをgoogleに設定
        this._storageMode = 'google';
        try {
          localStorage.setItem(STORAGE_MODE_KEY, 'google');
        } catch (e) { /* ignore */ }

        // ドライブからデータ読み込み
        await this._loadFromGoogleDrive();

        this._notifyListeners('google_login');
        resolve(true);
      };

      // Safari対応: ポップアップではなくリダイレクト方式で認証
      // ※ただしGISのrequestAccessTokenはポップアップのみなので、
      //   まずはポップアップで試行する
      this._googleTokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  /**
   * sessionStorageのキャッシュからログイン状態を復元する（リロード対策）
   * @returns {Promise<boolean>} 自動ログイン成功ならtrue
   */
  async autoLoginFromCache() {
    try {
      const cachedToken = sessionStorage.getItem('google_access_token');
      const cachedUser = sessionStorage.getItem('google_user');

      if (!cachedToken) return false;

      this._googleAccessToken = cachedToken;
      if (cachedUser) {
        this._googleUser = JSON.parse(cachedUser);
      } else {
        this._googleUser = { name: '', email: 'ログイン済み', picture: '' };
      }

      // gapiのトークンを設定（gapi client経由の通信用）
      if (this._gapiInited) {
        gapi.client.setToken({ access_token: this._googleAccessToken });
      }

      // ドライブからデータ読み込み
      await this._loadFromGoogleDrive();
      this._notifyListeners('google_login');
      return true;
    } catch (e) {
      console.warn('自動ログイン復元エラー:', e);
      return false;
    }
  }

  /**
   * Googleアカウントからログアウト
   */
  logoutFromGoogle() {
    if (this._googleAccessToken) {
      google.accounts.oauth2.revoke(this._googleAccessToken, () => {
        console.log('Google token revoked');
      });
    }
    this._googleAccessToken = null;
    this._googleFileId = null;
    this._googleUser = null;

    // キャッシュ削除
    try {
      sessionStorage.removeItem('google_access_token');
      sessionStorage.removeItem('google_user');
    } catch (e) { /* ignore */ }

    // ローカルモードにフォールバック
    this._storageMode = 'local';
    try {
      localStorage.setItem(STORAGE_MODE_KEY, 'local');
    } catch (e) { /* ignore */ }

    this._saveToLocalStorage(); // ログアウト前にローカルにもバックアップ
    this._notifyListeners('google_logout');
  }

  /**
   * Googleドライブからデータを読み込む
   * ファイルが存在しない場合は新規作成する
   */
  async _loadFromGoogleDrive() {
    this._googleSyncing = true;
    this._notifyListeners('sync_start');

    try {
      // gapiのトークンを確実にセットする
      if (this._gapiInited && this._googleAccessToken) {
        gapi.client.setToken({ access_token: this._googleAccessToken });
      }

      // 1. ドライブ上で既存ファイルを検索
      const searchRes = await gapi.client.drive.files.list({
        q: `name='${GOOGLE_DRIVE_FILENAME}' and trashed=false`,
        fields: 'files(id, name, modifiedTime)',
        spaces: 'drive'
      });

      const files = searchRes.result.files;

      if (files && files.length > 0) {
        // 2a. ファイルが見つかった → ダウンロード
        this._googleFileId = files[0].id;
        const downloadRes = await gapi.client.drive.files.get({
          fileId: this._googleFileId,
          alt: 'media'
        });

        if (downloadRes.body && downloadRes.body.trim() !== '') {
          this._data = JSON.parse(downloadRes.body);
          this._migrateData();
        } else {
          this._data = createDefaultData();
          this._data.settings.storageMode = 'google';
        }
      } else {
        // 2b. ファイルが無い → 新規作成
        this._data = createDefaultData();
        this._data.settings.storageMode = 'google';
        await this._createGoogleDriveFile();
      }

      // ローカルにもバックアップ（オフライン時の保険）
      this._saveToLocalStorage();
    } catch (err) {
      console.error('Google Drive 読み込みエラー:', err);
      // フォールバック: ローカルのデータを使う
      this._loadFromLocalStorage();
    } finally {
      this._googleSyncing = false;
      this._notifyListeners('sync_end');
    }
  }

  /**
   * Googleドライブにデータを保存（上書き）
   */
  async _saveToGoogleDrive() {
    if (!this._googleAccessToken) return;

    this._googleSyncing = true;
    this._notifyListeners('sync_start');

    try {
      const jsonStr = JSON.stringify(this._data, null, 2);

      if (this._googleFileId) {
        // 既存ファイルを上書き
        await fetch(`https://www.googleapis.com/upload/drive/v3/files/${this._googleFileId}?uploadType=media`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${this._googleAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: jsonStr
        });
      } else {
        // ファイルIDが無い場合は新規作成
        await this._createGoogleDriveFile();
      }

      // ローカルにもバックアップ
      this._saveToLocalStorage();
    } catch (err) {
      console.error('Google Drive 書き込みエラー:', err);
      // フォールバック: ローカルに保存
      this._saveToLocalStorage();
    } finally {
      this._googleSyncing = false;
      this._notifyListeners('sync_end');
    }
  }

  /**
   * Googleドライブ上に新しいファイルを作成する
   */
  async _createGoogleDriveFile() {
    try {
      const metadata = {
        name: GOOGLE_DRIVE_FILENAME,
        mimeType: 'application/json'
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([JSON.stringify(this._data, null, 2)], { type: 'application/json' }));

      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this._googleAccessToken}`
        },
        body: form
      });

      const result = await res.json();
      this._googleFileId = result.id;
    } catch (err) {
      console.error('Google Drive ファイル作成エラー:', err);
    }
  }
}

// シングルトンインスタンス
export const Store = new DataStore();
