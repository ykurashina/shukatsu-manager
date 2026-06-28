// form-utils.js — フォームユーティリティ

export const FormUtils = {
  /**
   * セレクトボックスを作成
   * @param {Array<{value: string, label: string}>} options
   * @param {string} selectedValue
   * @param {Object} [attrs] - 追加属性 { name, id, className, required }
   * @returns {HTMLSelectElement}
   */
  createSelect(options, selectedValue = '', attrs = {}) {
    const select = document.createElement('select');
    select.className = `form-select ${attrs.className || ''}`;
    if (attrs.name) select.name = attrs.name;
    if (attrs.id) select.id = attrs.id;
    if (attrs.required) select.required = true;

    // 空オプション
    if (!attrs.noEmpty) {
      const emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = '選択してください';
      select.appendChild(emptyOpt);
    }

    for (const opt of options) {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (opt.value === selectedValue) option.selected = true;
      select.appendChild(option);
    }

    return select;
  },

  /**
   * テキスト入力フィールドを作成
   * @param {string} type - input type
   * @param {string} placeholder
   * @param {string} value
   * @param {Object} [attrs] - 追加属性
   * @returns {HTMLInputElement}
   */
  createInput(type = 'text', placeholder = '', value = '', attrs = {}) {
    const input = document.createElement('input');
    input.type = type;
    input.className = `form-input ${attrs.className || ''}`;
    input.placeholder = placeholder;
    input.value = value;
    if (attrs.name) input.name = attrs.name;
    if (attrs.id) input.id = attrs.id;
    if (attrs.required) input.required = true;
    if (attrs.maxLength) input.maxLength = attrs.maxLength;
    return input;
  },

  /**
   * テキストエリアを作成（文字数カウント付き）
   * @param {string} placeholder
   * @param {string} value
   * @param {number} [maxLength] - 制限文字数
   * @param {Object} [attrs] - 追加属性
   * @returns {HTMLElement} - wrapper div containing textarea and counter
   */
  createTextarea(placeholder = '', value = '', maxLength = 0, attrs = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = 'textarea-wrapper';

    const textarea = document.createElement('textarea');
    textarea.className = `form-textarea ${attrs.className || ''}`;
    textarea.placeholder = placeholder;
    textarea.value = value;
    textarea.rows = attrs.rows || 6;
    if (attrs.name) textarea.name = attrs.name;
    if (attrs.id) textarea.id = attrs.id;

    wrapper.appendChild(textarea);

    // 文字数カウンター
    if (maxLength > 0) {
      const counter = document.createElement('div');
      counter.className = 'char-counter';
      const currentLen = value.length;
      counter.textContent = `${currentLen} / ${maxLength}`;
      if (currentLen > maxLength) counter.classList.add('over-limit');
      wrapper.appendChild(counter);

      textarea.addEventListener('input', () => {
        const len = textarea.value.length;
        counter.textContent = `${len} / ${maxLength}`;
        counter.classList.toggle('over-limit', len > maxLength);
      });
    } else {
      const counter = document.createElement('div');
      counter.className = 'char-counter';
      counter.textContent = `${value.length} 文字`;
      wrapper.appendChild(counter);

      textarea.addEventListener('input', () => {
        counter.textContent = `${textarea.value.length} 文字`;
      });
    }

    return wrapper;
  },

  /**
   * フォームグループ（ラベル + 入力要素）を作成
   * @param {string} label
   * @param {HTMLElement} inputElement
   * @param {Object} [options] - { required, helpText }
   * @returns {HTMLElement}
   */
  createFormGroup(label, inputElement, options = {}) {
    const group = document.createElement('div');
    group.className = 'form-group';

    const labelEl = document.createElement('label');
    labelEl.className = 'form-label';
    labelEl.textContent = label;
    if (options.required) {
      const req = document.createElement('span');
      req.className = 'form-required';
      req.textContent = ' *';
      labelEl.appendChild(req);
    }
    group.appendChild(labelEl);
    group.appendChild(inputElement);

    if (options.helpText) {
      const help = document.createElement('p');
      help.className = 'form-help';
      help.textContent = options.helpText;
      group.appendChild(help);
    }

    return group;
  },

  /**
   * パスワード入力フィールド（表示/非表示切替付き）
   * @param {string} placeholder
   * @param {string} value
   * @param {Object} [attrs]
   * @returns {HTMLElement}
   */
  createPasswordInput(placeholder = '', value = '', attrs = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = 'password-wrapper';

    const input = document.createElement('input');
    input.type = 'password';
    input.className = `form-input ${attrs.className || ''}`;
    input.placeholder = placeholder;
    input.value = value;
    if (attrs.name) input.name = attrs.name;
    if (attrs.id) input.id = attrs.id;

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'password-toggle';
    toggleBtn.innerHTML = '<i data-lucide="eye"></i>';
    toggleBtn.setAttribute('aria-label', 'パスワードを表示');

    toggleBtn.addEventListener('click', () => {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      toggleBtn.innerHTML = `<i data-lucide="${isPassword ? 'eye-off' : 'eye'}"></i>`;
      toggleBtn.setAttribute('aria-label', isPassword ? 'パスワードを隠す' : 'パスワードを表示');
      if (window.lucide) window.lucide.createIcons();
    });

    wrapper.appendChild(input);
    wrapper.appendChild(toggleBtn);

    return wrapper;
  },

  /**
   * フォームからデータを収集
   * @param {HTMLElement} form - フォーム要素またはフォーム要素を含むコンテナ
   * @returns {Object}
   */
  collectFormData(form) {
    const data = {};
    const inputs = form.querySelectorAll('input, select, textarea');
    for (const input of inputs) {
      if (!input.name) continue;
      if (input.type === 'checkbox') {
        data[input.name] = input.checked;
      } else {
        data[input.name] = input.value;
      }
    }
    return data;
  }
};
