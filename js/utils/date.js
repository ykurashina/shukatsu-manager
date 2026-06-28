// date.js — 日付ユーティリティ

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export const DateUtils = {
  /**
   * 日付を「YYYY-MM-DD」形式に変換
   */
  toISODate(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  },

  /**
   * 日付を「YYYY年MM月DD日（曜日）」形式で表示
   */
  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const w = WEEKDAYS[d.getDay()];
    return `${y}年${m}月${day}日（${w}）`;
  },

  /**
   * 日付を「MM/DD（曜日）」の短い形式で表示
   */
  formatShortDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const w = WEEKDAYS[d.getDay()];
    return `${m}/${day}（${w}）`;
  },

  /**
   * 日時を「YYYY年MM月DD日 HH:MM」形式で表示
   */
  formatDateTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const w = WEEKDAYS[d.getDay()];
    return `${y}年${m}月${day}日（${w}） ${h}:${min}`;
  },

  /**
   * 残り日数を計算
   * @returns {number|null} 残り日数（過去の場合は負の数）
   */
  daysUntil(dateStr) {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    if (isNaN(target.getTime())) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  },

  /**
   * 残り日数をラベルとして表示
   */
  daysUntilLabel(dateStr) {
    const days = this.daysUntil(dateStr);
    if (days === null) return '';
    if (days < 0) return `${Math.abs(days)}日前`;
    if (days === 0) return '今日';
    if (days === 1) return '明日';
    return `あと${days}日`;
  },

  /**
   * 今日の日付をYYYY-MM-DD形式で取得
   */
  today() {
    return this.toISODate(new Date());
  },

  /**
   * 指定月のカレンダー配列を生成
   * @param {number} year
   * @param {number} month - 0-indexed (0=1月)
   * @returns {Array<{date: Date, isCurrentMonth: boolean}>}
   */
  getCalendarDays(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days = [];

    // 前月の日を埋める
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false
      });
    }

    // 当月
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        date: new Date(year, month, d),
        isCurrentMonth: true
      });
    }

    // 翌月の日を埋める（6行 × 7日 = 42日分にする）
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({
        date: new Date(year, month + 1, d),
        isCurrentMonth: false
      });
    }

    return days;
  },

  /**
   * 同じ日付かどうかを判定
   */
  isSameDay(d1, d2) {
    if (!d1 || !d2) return false;
    const a = new Date(d1);
    const b = new Date(d2);
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
  },

  /**
   * 今日かどうかを判定
   */
  isToday(dateStr) {
    return this.isSameDay(dateStr, new Date());
  }
};
