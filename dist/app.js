const app = document.querySelector('#app');
const toastEl = document.querySelector('#toast');

let loginMethod = 'phone';
const AVATARS = [
  '1-Cz2mt-nl.png', '2-DzTtSgI1.png', '3-CieZaTkx.png',
  '4-FzE5GskB.png', '5-BE1kalqa.png', '6-BptTdCuy.png',
  '7-OCP1Ruci.png', '8-4L9YXhCn.png', '9-iOf3oyEz.png',
  '10-BcpE5fen.png', '11-DBjki8Hc.png', '12-DZNy4n9Y.png',
  '13-DEwaMq4g.png', '14-DwyWmQfy.png', '15-CLyM484-.png',
  '16-BSWOqo6F.png', '17-q-XMVoEb.png', '18-nEcSw01G.png',
  '19-B4g10rGY.png', '20-jsNPML4j.png'
];
const DEFAULT_AVATAR = '2-DzTtSgI1.png';
const ICONS = {
  email: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m3 5 9 8 9-8"/></svg>`,
  back: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 19 8.5 12l7-7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  chevron: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  phone: `<img class="auth-asset-icon" src="assets/icons/phone.svg" alt="" aria-hidden="true" />`,
  lock: `<img class="auth-asset-icon" src="assets/icons/lock.svg" alt="" aria-hidden="true" />`,
  gift: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16v10H4z"/><path d="M3 7h18v4H3zM12 7v13"/><path d="M12 7H8.5A2.5 2.5 0 1 1 11 4.5c0 1.7 1 2.5 1 2.5Zm0 0h3.5A2.5 2.5 0 1 0 13 4.5c0 1.7-1 2.5-1 2.5Z" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  invite: `<img class="auth-asset-icon" src="assets/icons/invite-code.svg" alt="" aria-hidden="true" />`,
  eye: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg>`,
  eyeOff: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.7 6.1A10.3 10.3 0 0 1 12 6c6.1 0 9.5 6 9.5 6a15.4 15.4 0 0 1-2.2 2.8M6.2 6.2C3.8 8 2.5 12 2.5 12s3.4 6 9.5 6c1.2 0 2.3-.2 3.2-.5M9.9 9.9A3 3 0 0 0 14.1 14.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`
};

const languageLabels = {
  en: { flag: '🇺🇸', code: 'EN' },
  hi: { flag: '🇮🇳', code: 'HI' }
};

function currentLanguage() {
  return localStorage.getItem('cw_language') || 'en';
}

function topbar() {
  const lang = languageLabels[currentLanguage()] || languageLabels.en;
  return `
    <header class="topbar">
      <button class="icon-btn" id="backBtn" type="button" aria-label="Go back">${ICONS.back}</button>
      <img class="brand-logo" src="assets/web%20images/color-win-logo-supplied.png" alt="Color Win" />
      <button class="lang-btn" id="langBtn" type="button" aria-label="Language">
        <span class="lang-flag">${lang.code === 'EN' ? '<img src="assets/web%20images/flag-en.png" alt="English" width="48" height="48">' : lang.flag}</span>
        <span class="lang-code">${lang.code}</span>
        ${ICONS.chevron}
      </button>
      ${languageMenu()}
    </header>`;
}

function languageMenu() {
  return `
    <div class="lang-menu" id="langMenu" hidden>
      <button class="lang-option" data-lang="en" type="button">🇺🇸 English</button>
      <button class="lang-option" data-lang="hi" type="button">🇮🇳 Hindi</button>
    </div>`;
}

function hero({ title, text }) {
  return `
    <section class="hero">
      <div class="hero-copy">
        <h1 class="hero-title">${title}</h1>
        <p class="hero-text">${text}</p>
      </div>
      <img class="hero-art" src="assets/web%20images/auth-banner.png" alt="Color Win banner" />
    </section>`;
}

function label(icon, text) {
  return `
    <div class="field-label">
      <span class="label-icon">${ICONS[icon]}</span>
      <span>${text}</span>
    </div>`;
}

function phoneField(id = 'phone') {
  return `
    <div class="form-group">
      ${label('phone', 'Phone number')}
      <div class="input-shell">
        <button class="country-btn" type="button" aria-label="Country code India" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}Country">
          <span>+91</span>${ICONS.chevron}
        </button>
        <input class="field-input" id="${id}" name="phone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="10" placeholder="Enter your phone number" />
      </div>
      <div class="country-menu" id="${id}Country" role="listbox" aria-label="Country code" hidden><button type="button" role="option" aria-selected="true" data-country="91"><span>+91</span><span>India (भारत)</span></button></div>
    </div>`;
}

function passwordField({ id, labelText, placeholder, autocomplete = 'current-password' }) {
  return `
    <div class="form-group">
      ${label('lock', labelText)}
      <div class="input-shell">
        <input class="field-input" id="${id}" name="${id}" type="password" autocomplete="${autocomplete}" placeholder="${placeholder}" />
        <button class="eye-btn" type="button" data-password-toggle="${id}" aria-label="Show password">${ICONS.eyeOff}</button>
      </div>
    </div>`;
}

function loginView() {
  return `<div class="page auth-redesign-page">${window.ColorWinAuthRedesign.views.login}</div>`;
}

function registerView() {
  return `<div class="page auth-redesign-page">${window.ColorWinAuthRedesign.views.register}</div>`;
}

function validPassword(value) {
  return value.length >= 8;
}

function validPhone(value) {
  return /^[0-9]{10}$/.test(value);
}

function showMessage(box, message, success = false) {
  clearMessage(box);
  toast(message, !success);
}

function clearMessage(box) {
  box.textContent = '';
  box.classList.remove('show', 'success');
}

let toastTimer;
function toast(message, isError = false, duration = 3000) {
  clearTimeout(toastTimer);
  toastEl.replaceChildren();
  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = isError ? '!' : 'i';
  const text = document.createElement('span');
  text.textContent = message;
  toastEl.append(icon, text);
  toastEl.classList.add('show');
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
}

function bindPasswordToggles() {
  document.querySelectorAll('[data-password-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.passwordToggle);
      if (!input) return;
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      btn.innerHTML = reveal ? ICONS.eye : ICONS.eyeOff;
      btn.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
    });
  });
}

function bindTopbar() {
  document.querySelector('#backBtn')?.addEventListener('click', () => {
    if (location.hash === '#/privacy') location.hash = '#/register';
    else if (history.length > 1) history.back();
    else location.hash = '#/login';
  });

  const langBtn = document.querySelector('#langBtn');
  const menu = document.querySelector('#langMenu');
  langBtn?.addEventListener('click', () => { menu.hidden = !menu.hidden; });

  document.querySelectorAll('[data-lang]').forEach(btn => {
    btn.addEventListener('click', () => {
      localStorage.setItem('cw_language', btn.dataset.lang);
      menu.hidden = true;
      render();
      toast('Language preference saved.');
    });
  });

  document.addEventListener('click', (event) => {
    if (!menu || menu.hidden) return;
    if (!menu.contains(event.target) && !langBtn.contains(event.target)) menu.hidden = true;
  }, { once: true });
}

const authRedesignState = {
  lang: localStorage.getItem('cw_language') || 'en',
  country: 'IN',
  loginMode: 'phone'
};

function authRedesignError(id, message = '') {
  const input = document.getElementById(id);
  const errorEl = document.getElementById(`${id}-error`);
  // Keep the uploaded auth UI clean: the main app toast is the only visible alert.
  if (errorEl) errorEl.textContent = '';
  if (input) {
    input.setAttribute('aria-invalid', String(Boolean(message)));
    input.closest('.input-shell')?.classList.toggle('invalid', Boolean(message));
  }
  if (message) toast(message, true);
}

function authRedesignApplyLanguage(route) {
  const ui = window.ColorWinAuthRedesign;
  const labels = ui.labels[authRedesignState.lang] || ui.labels.en;
  document.documentElement.lang = authRedesignState.lang;
  document.querySelectorAll('[data-text]').forEach(el => {
    let key = el.dataset.text;
    if (route === 'register' && key === 'subtitle') key = 'registerSubtitle';
    if (route === 'register' && key === 'password') key = 'setPassword';
    if (labels[key]) el.textContent = labels[key];
  });
  const flag = document.getElementById('header-flag');
  if (flag) flag.innerHTML = authRedesignState.lang === 'hi' ? ui.flagIN : ui.flagUS;
  const languageCode = document.getElementById('language-code');
  if (languageCode) languageCode.textContent = authRedesignState.lang === 'hi' ? 'HI' : 'EN';
  const languageButton = document.querySelector('.language');
  if (languageButton) languageButton.setAttribute('aria-label', authRedesignState.lang === 'hi' ? 'भाषा: हिन्दी' : 'Language: English');
  const phone = document.getElementById('phone');
  if (phone) phone.placeholder = authRedesignState.lang === 'hi' ? 'फोन नंबर दर्ज करें' : 'Please enter the phone number';
  const email = document.getElementById('email');
  if (email) email.placeholder = authRedesignState.lang === 'hi' ? 'अपना ईमेल दर्ज करें' : 'please input your email';
  const password = document.getElementById('password');
  if (password) password.placeholder = route === 'register' ? labels.setPassword : labels.password;
  const confirm = document.getElementById('confirm');
  if (confirm) confirm.placeholder = labels.confirm;
}

function ensureAuthLanguageSheet(ui) {
  let sheet = document.getElementById('auth-language-sheet');
  if (sheet) return sheet;

  sheet = document.createElement('div');
  sheet.id = 'auth-language-sheet';
  sheet.className = 'auth-language-sheet';
  sheet.hidden = true;
  sheet.setAttribute('aria-hidden', 'true');
  sheet.innerHTML = `
    <button class="auth-language-backdrop" type="button" data-auth-lang-close aria-label="Close language selector"></button>
    <section class="auth-language-panel" role="dialog" aria-modal="true" aria-labelledby="auth-language-title">
      <div class="auth-language-handle" aria-hidden="true"></div>
      <div class="auth-language-heading">
        <h2 id="auth-language-title">Select language</h2>
        <button class="auth-language-close" type="button" data-auth-lang-close aria-label="Close">×</button>
      </div>
      <button class="auth-language-option" type="button" data-auth-sheet-lang="en">
        <span class="auth-language-flag"><svg viewBox="0 0 52 52" aria-hidden="true">${ui.flagUS}</svg></span>
        <span><strong>English</strong><small>English</small></span>
        <span class="auth-language-check">✓</span>
      </button>
      <button class="auth-language-option" type="button" data-auth-sheet-lang="hi">
        <span class="auth-language-flag"><svg viewBox="0 0 52 52" aria-hidden="true">${ui.flagIN}</svg></span>
        <span><strong>हिन्दी</strong><small>Hindi</small></span>
        <span class="auth-language-check">✓</span>
      </button>
      <div class="auth-language-safe" aria-hidden="true"></div>
    </section>`;
  document.body.appendChild(sheet);
  return sheet;
}

let authRedesignDocumentAbort = null;
function bindAuthRedesignCommon(route) {
  const ui = window.ColorWinAuthRedesign;
  authRedesignDocumentAbort?.abort();
  authRedesignDocumentAbort = new AbortController();
  const signal = authRedesignDocumentAbort.signal;

  const languageButton = document.querySelector('.language');
  const languageMenu = document.getElementById('language-menu');
  const languageSheet = ensureAuthLanguageSheet(ui);
  const languageSheetOptions = [...languageSheet.querySelectorAll('[data-auth-sheet-lang]')];
  const countryToggle = document.getElementById('country-toggle');
  const countryMenu = document.getElementById('country-menu');
  const countryCode = document.getElementById('country-code');
  const countryOptions = [...document.querySelectorAll('.country-option')];

  // Keep the original inline language menu disabled. Language selection now opens
  // as a mobile bottom sheet without changing the uploaded auth layout.
  if (languageMenu) languageMenu.hidden = true;
  languageSheet.classList.remove('open');
  languageSheet.hidden = true;
  languageSheet.setAttribute('aria-hidden', 'true');

  const updateLanguageSheet = () => {
    languageSheetOptions.forEach(option => {
      const selected = option.dataset.authSheetLang === authRedesignState.lang;
      option.classList.toggle('selected', selected);
      option.setAttribute('aria-selected', String(selected));
    });
  };
  const openLanguage = () => {
    closeCountry();
    updateLanguageSheet();
    languageSheet.hidden = false;
    languageSheet.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => languageSheet.classList.add('open'));
    languageButton?.setAttribute('aria-expanded', 'true');
    setTimeout(() => languageSheetOptions.find(option => option.dataset.authSheetLang === authRedesignState.lang)?.focus(), 250);
  };
  const closeLanguage = () => {
    languageSheet.classList.remove('open');
    languageSheet.setAttribute('aria-hidden', 'true');
    languageButton?.setAttribute('aria-expanded', 'false');
    setTimeout(() => {
      if (!languageSheet.classList.contains('open')) languageSheet.hidden = true;
    }, 240);
  };
  const closeCountry = () => {
    if (!countryMenu) return;
    countryMenu.hidden = true;
    countryToggle?.setAttribute('aria-expanded', 'false');
  };
  const chooseCountry = code => {
    if (!ui.countryInfo[code]) return;
    authRedesignState.country = code;
    if (countryCode) countryCode.textContent = ui.countryInfo[code].code;
    countryToggle?.setAttribute('aria-label', `Country calling code: ${ui.countryInfo[code].name} ${ui.countryInfo[code].code}`);
    countryOptions.forEach(option => option.setAttribute('aria-selected', String(option.dataset.country === code)));
  };

  // Header EN/HI control -> bottom sheet.
  languageButton?.addEventListener('click', event => {
    event.preventDefault();
    openLanguage();
  }, { signal });
  languageSheet.querySelectorAll('[data-auth-lang-close]').forEach(button => button.addEventListener('click', () => {
    closeLanguage();
    languageButton?.focus();
  }, { signal }));
  languageSheetOptions.forEach(button => button.addEventListener('click', () => {
    authRedesignState.lang = button.dataset.authSheetLang || 'en';
    localStorage.setItem('cw_language', authRedesignState.lang);
    authRedesignApplyLanguage(route);
    updateLanguageSheet();
    closeLanguage();
    languageButton?.focus();
  }, { signal }));

  chooseCountry(authRedesignState.country);
  countryToggle?.addEventListener('click', event => {
    event.preventDefault();
    if (!countryMenu) return;
    const open = countryMenu.hidden;
    countryMenu.hidden = !open;
    countryToggle.setAttribute('aria-expanded', String(open));
    if (open) countryOptions.find(option => option.dataset.country === authRedesignState.country)?.focus();
    closeLanguage();
  }, { signal });
  countryOptions.forEach(option => option.addEventListener('click', () => {
    chooseCountry(option.dataset.country);
    closeCountry();
    countryToggle?.focus();
  }, { signal }));
  countryToggle?.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (countryMenu) countryMenu.hidden = false;
      countryToggle.setAttribute('aria-expanded', 'true');
      countryOptions.find(option => option.dataset.country === authRedesignState.country)?.focus();
    }
  }, { signal });
  countryMenu?.addEventListener('keydown', event => {
    const index = countryOptions.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + countryOptions.length) % countryOptions.length;
      countryOptions[next]?.focus();
    }
    if (event.key === 'Escape') { closeCountry(); countryToggle?.focus(); }
    if (event.key === 'Tab') closeCountry();
  }, { signal });

  document.querySelectorAll('.eye-toggle').forEach(button => button.addEventListener('click', () => {
    const targetId = button.dataset.target || 'password';
    const input = document.getElementById(targetId);
    if (!input) return;
    const reveal = input.type === 'password';
    input.type = reveal ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(reveal));
    button.setAttribute('aria-label', `${reveal ? 'Hide' : 'Show'} ${targetId === 'confirm' ? 'confirm password' : 'password'}`);
  }, { signal }));

  // Match the uploaded file: back toggles between Login and Register.
  document.querySelector('.back')?.addEventListener('click', () => {
    location.hash = route === 'login' ? '#/register' : '#/login';
  }, { signal });

  document.addEventListener('click', event => {
    if (!event.target.closest('.country')) closeCountry();
  }, { signal });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { closeLanguage(); closeCountry(); }
  }, { signal });

  authRedesignApplyLanguage(route);
}

async function runAuthCaptcha() {
  if (typeof window.openSlideCaptcha !== 'function') {
    toast('Puzzle verification is unavailable. Reload the page and try again.', true);
    return false;
  }
  return !!(await window.openSlideCaptcha());
}

function bindLogin() {
  bindAuthRedesignCommon('login');
  const ui = window.ColorWinAuthRedesign;
  const form = document.querySelector('#login-form');
  const phone = document.querySelector('#phone');
  const email = document.querySelector('#email');
  const pass = document.querySelector('#password');
  const remember = document.querySelector('#remember');
  const button = form?.querySelector('button[type="submit"]');
  if (!form || !phone || !pass || !remember || !button) return;
  let pending = false;
  remember.checked = localStorage.getItem('cw_remember_login') !== 'false';

  function setMode(mode) {
    authRedesignState.loginMode = mode;
    const phoneField = document.querySelector('.phone-field');
    const emailField = document.querySelector('.email-field');
    if (phoneField) phoneField.hidden = mode !== 'phone';
    if (emailField) emailField.hidden = mode !== 'email';
    phone.disabled = mode !== 'phone';
    if (email) email.disabled = mode !== 'email';
    document.querySelectorAll('[data-mode]').forEach(tab => {
      const active = tab.dataset.mode === mode;
      tab.classList.toggle('active', active);
      tab.classList.toggle('inactive', !active);
      tab.setAttribute('aria-selected', String(active));
    });
    authRedesignError('phone');
    authRedesignError('email');
  }
  document.querySelectorAll('[data-mode]').forEach(tab => tab.addEventListener('click', () => setMode(tab.dataset.mode)));
  setMode(authRedesignState.loginMode);

  phone.addEventListener('input', () => {
    phone.value = phone.value.replace(/\D/g, '').slice(0, 10);
    authRedesignError('phone');
  });
  email?.addEventListener('input', () => authRedesignError('email'));
  pass.addEventListener('input', () => authRedesignError('password'));

  // Remove the auth page's own recovery dialog behavior; use the main app alert/toast.
  document.querySelector('.forgot')?.addEventListener('click', event => {
    event.preventDefault();
    toast('Please contact customer service to recover your account.', false);
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending) return;
    authRedesignError('phone');
    authRedesignError('email');
    authRedesignError('password');

    if (authRedesignState.loginMode === 'phone') {
      if (!/^\d{10}$/.test(phone.value.trim())) { authRedesignError('phone', 'Enter a 10-digit phone number.'); phone.focus(); return; }
    } else if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
      authRedesignError('email', 'Enter a valid email address.');
      email?.focus();
      return;
    }
    if (!pass.value) { authRedesignError('password', 'Enter your password.'); pass.focus(); return; }
    if (!ColorWinAuth.configured) { toast('Authentication is not configured.', true); return; }

    pending = true;
    button.disabled = true;
    const original = button.textContent;
    button.textContent = 'Verify to continue...';
    let finishLoading;
    try {
      const captchaVerified = await runAuthCaptcha();
      if (!form.isConnected) return;
      if (!captchaVerified) { toast('Complete puzzle verification.', true); return; }
      button.textContent = 'Logging in...';
      finishLoading=window.ColorWinLoader?.begin();
      let result;
      if (authRedesignState.loginMode === 'phone') {
        const prefix = ui.countryInfo[authRedesignState.country]?.code || '+91';
        result = await ColorWinAuth.authenticate('login', prefix + phone.value.trim(), pass.value, remember.checked);
      } else {
        result = await ColorWinAuth.authenticateEmail('login', email.value.trim(), pass.value, remember.checked);
      }
      pass.value = '';
      location.hash = '#/home';
      if (result?.profileError) toast('Profile unavailable. Please check the database setup.', true);
    } catch (error) {
      toast(error?.message || 'Unable to complete your request. Please try again.', true);
    } finally {
      finishLoading?.();
      pending = false;
      if (form.isConnected) {
        button.disabled = false;
        button.textContent = original;
        authRedesignApplyLanguage('login');
      }
    }
  });
}

function bindRegister() {
  bindAuthRedesignCommon('register');
  const ui = window.ColorWinAuthRedesign;
  const form = document.querySelector('#register-form');
  const phone = document.querySelector('#phone');
  const password = document.querySelector('#password');
  const invite = document.querySelector('#invite');
  if(invite){invite.value=window.ColorWinPromotion.referral();invite.maxLength=11;invite.placeholder='Invitation code (optional)';invite.addEventListener('input',()=>{invite.value=invite.value.replace(/\D/g,'').slice(0,11);});}
  const confirm = document.querySelector('#confirm');
  const privacy = document.querySelector('#agree');
  const button = form?.querySelector('button[type="submit"]');
  if (!form || !phone || !password || !confirm || !privacy || !button) return;
  let pending = false;

  phone.addEventListener('input', () => {
    phone.value = phone.value.replace(/\D/g, '').slice(0, 10);
    authRedesignError('phone');
  });
  [password, confirm].forEach(input => input.addEventListener('input', () => authRedesignError(input.id)));
  privacy.addEventListener('change', () => authRedesignError('agree'));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending) return;
    ['phone','password','confirm','agree'].forEach(id => authRedesignError(id));
    if (!/^\d{10}$/.test(phone.value.trim())) { authRedesignError('phone', 'Enter a 10-digit phone number.'); phone.focus(); return; }
    if (password.value.length < 8) { authRedesignError('password', 'Use at least 8 characters.'); password.focus(); return; }
    if (password.value !== confirm.value) { authRedesignError('confirm', 'Passwords must match.'); confirm.focus(); return; }
    if (!privacy.checked) { authRedesignError('agree', 'Please agree to the Privacy Agreement.'); privacy.focus(); return; }
    if (!ColorWinAuth.configured) { toast('Authentication is not configured.', true); return; }

    pending = true;
    button.disabled = true;
    const original = button.textContent;
    button.textContent = 'Verify to continue...';
    let finishLoading;
    try {
      const captchaVerified = await runAuthCaptcha();
      if (!form.isConnected) return;
      if (!captchaVerified) { toast('Complete puzzle verification.', true); return; }
      button.textContent = 'Registering...';
      finishLoading=window.ColorWinLoader?.begin();
      const prefix = ui.countryInfo[authRedesignState.country]?.code || '+91';
      if(invite?.value && !/^\d{11}$/.test(invite.value)){toast('Enter an 11-digit invitation code.',true);return;}
      const result = await ColorWinAuth.authenticate('register', prefix + phone.value.trim(), password.value, true, invite?.value || '');
      sessionStorage.removeItem('cw_referral');
      password.value = '';
      confirm.value = '';
      location.hash = '#/home';
      if (result?.profileError) toast('Profile unavailable. Please check the database setup.', true);
    } catch (error) {
      toast(error?.message || 'Unable to complete your request. Please try again.', true);
    } finally {
      finishLoading?.();
      pending = false;
      if (form.isConnected) {
        button.disabled = false;
        button.textContent = original;
        authRedesignApplyLanguage('register');
      }
    }
  });
}

function openPhoneConfirmation(form,phone){
  if(form.querySelector('.auth-otp'))return;
  const panel=document.createElement('div');panel.className='auth-otp';panel.innerHTML='<label>SMS code <input inputmode="numeric" autocomplete="one-time-code" maxlength="6" aria-label="SMS verification code"></label><button type="button">Verify phone</button>';
  form.append(panel);panel.querySelector('button').onclick=async()=>{const b=panel.querySelector('button');b.disabled=true;try{if(await ColorWinAuth.verify(phone,panel.querySelector('input').value.trim()))location.hash='#/home';}catch(error){toast(error.message);}finally{b.disabled=false;}};
}
function authText(value){return String(value??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function profileLoginTime(){const value=ColorWinAuth.profile?.last_login_at;return value?new Date(value).toLocaleString('sv-SE'):'—';}

function applyAuthRedesignRouteStyle(route) {
  let style = document.getElementById('auth-redesign-route-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'auth-redesign-route-style';
    // Shared overlays and phone fixes must follow the route's design rules.
    document.head.insertBefore(style, document.querySelector('link[href="auth-extra.css"]'));
  }
  if (route.startsWith('#/login')) style.textContent = window.ColorWinAuthRedesign.styles.login;
  else if (route.startsWith('#/register')) style.textContent = window.ColorWinAuthRedesign.styles.register;
  else style.textContent = '';
}

function render() {
  window.ColorWinAccount.avatar=selectedAvatar;
  if(!ColorWinAuth.ready)return;
  const current=(location.hash||'#/login').toLowerCase();
  const publicRoute=['#/login','#/register','#/privacy'].includes(current);
  if(!ColorWinAuth.session&&!publicRoute){location.replace('#/login');return;}
  if(ColorWinAuth.session&&['#/login','#/register'].includes(current)){location.replace('#/home');return;}
  if(window.ColorWinCheckout?.guardRoute(current)===false)return;
  clearTimeout(toastTimer);
  toastEl.classList.remove('show');
  const route = (location.hash || '#/login').toLowerCase();
  if(ColorWinAuth.profile?.is_blocked){app.innerHTML='<section class="ac-content"><h1>Account suspended</h1><p>Please contact Color Win support.</p><button id="blocked-logout">Sign out</button></section>';document.querySelector('#blocked-logout').onclick=()=>ColorWinAuth.logout();window.ColorWinLoader?.ready(app);return;}
  if(ColorWinAuth.session&&ColorWinAuth.session.user.id!=='preview'&&window.ColorWinOperations&&!window.ColorWinOperations.config){window.ColorWinOperations.loadConfig().then(()=>window.dispatchEvent(new Event('hashchange'))).catch(()=>{});}
  const site=window.ColorWinOperations?.config?.settings;
  if(site?.site.maintenance&&!['#/account','#/account/notifications','#/account/notifications/information','#/support'].includes(route)){app.innerHTML='<section class="ac-content"><h1>Maintenance</h1><p>Color Win is temporarily undergoing maintenance.</p><a href="#/account">Open account</a></section>';window.ColorWinLoader?.ready(app);return;}
  if((route.startsWith('#/promotion')&&site?.promotion.enabled===false)||(route.startsWith('#/support')&&site?.site.supportEnabled===false)){app.innerHTML='<section class="ac-content"><h1>Temporarily unavailable</h1><a href="#/account">Back to account</a></section>';window.ColorWinLoader?.ready(app);return;}
  if (['#/main','#/turntable','#/turntable/history','#/activity/invite-wheel'].includes(route)) { location.replace('#/tournaments'); return; }
  applyAuthRedesignRouteStyle(route);
  const isRegister = route.startsWith('#/register');
  const isPrivacy = route.startsWith('#/privacy');
  const isAvatar = route === '#/account/avatar';
  const isAccount = route === '#/account';
  const isAccountSubpage = window.ColorWinAccount.matches(route);
  const isSupport = window.ColorWinSupport.matches(route);
  const isVIP = window.ColorWinVIP.matches(route);
  const isTournaments = window.ColorWinTournaments.matches(route);
  const isHome = route === '#/home';
  if(isHome && window.ColorWinSourceHome?.retainHome?.())return;
  if(isHome && window.ColorWinSourceHome?.restoreHome?.(app)){bindTabbar();window.ColorWinLoader?.ready(app);return;}
  const isWallet = window.ColorWinWallet.matches(route);
  if(route==='#/games/pvc'){location.replace('#/home');return;}
  const isGames = route.startsWith('#/games/');
  const isActivity = route === '#/activity' || ['#/activity/activity-award','#/activity/check-in','#/activity/attendance-bonus'].includes(route) || window.ColorWinActivity.activityItems.some(item => item.route === route);
  const tabRoute = route === '#/promotion' || route.startsWith('#/promotion/') ? 'promotion' : null;
  const pageMarkup = isAvatar ? avatarView()
    : isAccount ? accountView()
      : isAccountSubpage ? window.ColorWinAccount.view(route)
      : isSupport ? window.ColorWinSupport.view(route)
      : isVIP ? window.ColorWinVIP.view(route)
      : isTournaments ? window.ColorWinTournaments.view(route, accountTabbar('tournaments'))
      : isWallet ? window.ColorWinWallet.view(route)
      : isHome ? window.ColorWinHome.view(accountTabbar('home'))
        : isGames ? window.ColorWinCatalog.view(route, accountTabbar('home'))
        : isActivity ? window.ColorWinActivity.view(topbar(), accountTabbar('activity'), accountIcon, route)
        : tabRoute === 'promotion' ? window.ColorWinPromotion.view(accountTabbar('promotion'), route)

          : isPrivacy ? privacyView()
            : isRegister ? registerView() : loginView();
  window.ColorWinSourceHome.renderPage(app,pageMarkup,isHome);
  document.querySelectorAll('[data-method]').forEach(button => button.addEventListener('click', () => { loginMethod = button.dataset.method; render(); }));
  document.querySelectorAll('.form-group').forEach(group => { const input = group.querySelector('input'); const title = group.querySelector('.field-label'); if(input && title) input.setAttribute('aria-label',title.textContent.trim()); });
  document.querySelectorAll('.error-box').forEach(box => box.setAttribute('role','alert'));
  window.ColorWinNavigation.bind(app);
  bindTopbar();
  bindPasswordToggles();
  bindCountryMenus();
  if (isAvatar) bindAvatarView();
  else if (isAccount) bindAccount();
  else if (isAccountSubpage) window.ColorWinAccount.bind(route,toast);
  else if (isSupport) window.ColorWinSupport.bind(route,toast);
  else if (isVIP) window.ColorWinVIP.bind(route,toast);
  else if (isTournaments) {window.ColorWinTournaments.bind();bindTabbar();}
  else if (isWallet) window.ColorWinWallet.bind(route,toast);
  else if (isHome) {
    window.ColorWinHome.bind();
    bindTabbar();
  } else if (isGames) {
    window.ColorWinCatalog.bind();
    bindTabbar();
  } else if (isActivity) {
    window.ColorWinActivity.bind();
    bindTabbar();
  } else if (tabRoute === 'promotion') {window.ColorWinPromotion.bind(toast);bindTabbar();}

  else if (isRegister) bindRegister();
  else if (!isPrivacy) bindLogin();
  window.ColorWinLoader?.ready(app);
}

window.addEventListener('hashchange', () => { render(); window.scrollTo(0,0); });
window.addEventListener('colorwin:session-replaced',()=>toast('Your account was logged in on another device.',true,5000));
ColorWinAuth.init(render);

function bindCountryMenus() {
  document.querySelectorAll('.country-btn').forEach(button => {
    const menu = document.getElementById(button.getAttribute('aria-controls'));
    const option = menu.querySelector('[data-country]');
    const close = () => { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); };
    const open = () => { menu.hidden = false; button.setAttribute('aria-expanded', 'true'); option.focus(); };
    button.addEventListener('click', () => menu.hidden ? open() : close());
    button.addEventListener('keydown', event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); open(); } });
    option.addEventListener('click', () => { close(); button.focus(); });
    menu.addEventListener('keydown', event => { if (event.key === 'Escape') { close(); button.focus(); } });
    const group = button.closest('.form-group');
    group.addEventListener('focusout', event => { if (!group.contains(event.relatedTarget)) close(); });
  });
}
document.addEventListener('click', event => {
  document.querySelectorAll('.country-menu').forEach(menu => {
    if (!menu.parentElement.contains(event.target)) {
      menu.hidden = true;
      menu.parentElement.querySelector('.country-btn, .country-toggle')?.setAttribute('aria-expanded', 'false');
    }
  });
});
function privacyView() {
  const topics = [
    ['Information you enter', 'The current preview checks the information you enter in your browser. It does not create an account or sign you in.'],
    ['Local preferences', 'Your language preference may be saved on this device. When you select the remember option, your login identifier may also be saved locally. Passwords are not saved by this preview.'],
    ['Account security', 'Keep your password private and avoid entering a password you use elsewhere while exploring this preview. Close the page when using a shared device.'],
    ['Your choices', 'You can clear saved preferences and remembered login details through your browser’s site-data settings. You can choose whether to use the remember option.'],
    ['Policy updates', 'These five topics are sample content for this preview. A complete privacy policy describing the live service, its operator, data practices, retention and contact details must replace this draft before accounts are enabled.']
  ];
  return `<section class="auth-page privacy-page">${topbar()}<article class="privacy-content"><p class="privacy-eyebrow">COLOR WIN</p><h1>Privacy Agreement</h1><p class="privacy-intro">Sample privacy information for the Color Win preview.</p>${topics.map(([title,text],i) => `<section class="privacy-topic"><span class="topic-number">0${i+1}</span><h2>${title}</h2><p>${text}</p></section>`).join('')}<a class="secondary-btn privacy-back" href="#/register">Back to registration</a></article></section>`;
}


function accountIcon(name, assetOverride = null) {
  const assets = {
    wallet:'ar-wallet.svg',
    deposit:'deposit.svg',
    withdraw:'withdraw.svg',
    crown:'vip.svg',
    history:'game-history.svg',
    chart:'statistics.svg',
    bell:'announcement.svg',
    gift:'gift.svg',
    ticket:'coupon.svg',
    globe:'language.svg',
    settings:'settings.svg',
    chat:'feedback.svg',
    user:'customer-service.svg',
    info:'about-us.svg'
  };
  const asset = assetOverride || assets[name];
  if (asset) return `<img class="account-asset-icon" src="assets/icons/${asset}" alt="" aria-hidden="true">`;
  const paths = {
    home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/>',
    handshake:'<path d="m8 12 3 3a2 2 0 0 0 3 0l2-2m-8-5-3-2-4 4 4 4 3-2m7-6 3-2 4 4-4 4-3-2m-6 5 2 2a2 2 0 0 0 3 0l1-1m-3 3 1 1a2 2 0 0 0 3-1l1-1"/>',
    safe:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="4"/><path d="m9 9 6 6m0-6-6 6M6 7v3"/>',
    guide:'<path d="M12 5C8 2 4 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-3-1-6-2-10 1zm0 0v16"/>',
    copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    refresh:'<path d="M20 7a9 9 0 1 0 1 8M21 2v6h-6"/>',
    logout:'<path d="M9 3H3v18h6M8 12h13m-5-5 5 5-5 5"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.guide}</svg>`;
}
function selectedAvatar() {
  const storedAvatar = ColorWinAuth.session?.user?.user_metadata?.avatar || localStorage.getItem('cw_avatar_'+(ColorWinAuth.session?.user?.id||'preview')) || localStorage.getItem('cw_avatar');
  return AVATARS.includes(storedAvatar) ? storedAvatar : DEFAULT_AVATAR;
}
function accountTabbar(active = 'account') {
  return `<nav class="account-tabbar" aria-label="Main navigation">
    <button type="button" class="tabbar-item${active === 'home' ? ' is-current' : ''}" data-tab-action="home"${active === 'home' ? ' aria-current="page"' : ''}><img class="tabbar-icon" src="assets/web%20images/tab-home.png" alt=""><span>Home</span>${active === 'home' ? '<span class="tabbar-indicator"></span>' : ''}</button>
    <button type="button" class="tabbar-item${active === 'activity' ? ' is-current' : ''}" data-tab-action="activity"${active === 'activity' ? ' aria-current="page"' : ''}><img class="tabbar-icon" src="assets/web%20images/tab-activity.png" alt=""><span>Activity</span>${active === 'activity' ? '<span class="tabbar-indicator"></span>' : ''}</button>
    <button type="button" class="tabbar-reward tabbar-tournaments${active === 'tournaments' ? ' is-current' : ''}" data-tab-action="tournaments"${active === 'tournaments' ? ' aria-current="page"' : ''}><img class="tournament-characters" src="assets/tournaments/characters.png" alt=""><span class="tournament-label">Tournaments</span>${active === 'tournaments' ? '<span class="tabbar-indicator"></span>' : ''}</button>
    <button type="button" class="tabbar-item${active === 'promotion' ? ' is-current' : ''}" data-tab-action="promotion"${active === 'promotion' ? ' aria-current="page"' : ''}><img class="tabbar-icon" src="assets/web%20images/tab-promotion.png" alt=""><span>Promotion</span>${active === 'promotion' ? '<span class="tabbar-indicator"></span>' : ''}</button>
    <button type="button" class="tabbar-item${active === 'account' ? ' is-current' : ''}" data-tab-action="account"${active === 'account' ? ' aria-current="page"' : ''}><img class="tabbar-icon" src="assets/web%20images/tab-account.png" alt=""><span>Account</span>${active === 'account' ? '<span class="tabbar-indicator"></span>' : ''}</button>
  </nav>`;
}

function avatarView() {
  const selected = selectedAvatar();
  return `<section class="auth-page account-page avatar-page">
    <header class="avatar-header"><button type="button" id="avatarBackBtn" aria-label="Go back">${ICONS.back}</button><h1>Change avatar</h1><span aria-hidden="true"></span></header>
    <div class="avatar-grid" role="group" aria-label="Choose an avatar">${AVATARS.map((filename, index) => `<button type="button" class="avatar-option${filename === selected ? ' is-selected' : ''}" data-avatar="${filename}" aria-label="Avatar ${index + 1}" aria-pressed="${filename === selected}"><img src="assets/avatars/${filename}" alt=""><span class="avatar-check" aria-hidden="true">✓</span></button>`).join('')}</div>
  </section>`;
}
function accountView() {
  const avatar = selectedAvatar();
  const action = (name,icon,label=name,asset=null) => `<button type="button" data-account-panel="${name}" class="tone-${icon}"><span class="account-icon">${accountIcon(icon,asset)}</span><span>${label}</span></button>`;
  const history = (name,icon,title,subtitle,asset=null) => `<button type="button" data-account-panel="${name}" class="tone-${icon}"><span class="account-icon">${accountIcon(icon,asset)}</span><span class="history-copy"><strong>${title}</strong><small>${subtitle}</small></span><span class="row-chevron">›</span></button>`;
  return `<section class="auth-page account-page reference-account"><div class="account-content">
    <section class="profile-card"><button type="button" class="avatar avatar-link" id="changeAvatar" aria-label="Change avatar"><img src="assets/avatars/${avatar}" alt=""></button><div class="profile-details"><div class="member-name">${authText(window.ColorWinAccount.nickname())} <span class="vip-badge">${accountIcon('crown')} VIP0</span></div><div class="uid-row">UID <strong>${authText(ColorWinAuth.profile?.public_uid)}</strong><button type="button" id="copyUid" aria-label="Copy UID">${accountIcon('copy')}</button></div><p>Last login: <span>${authText(profileLoginTime())}</span></p></div></section>
    <section class="account-wallet-card" aria-label="Account wallet"><section class="balance-card"><div class="balance-heading"><span>Total balance</span></div><div class="balance-line"><div class="balance-value">₹${window.ColorWinAccount.balance().toFixed(2)}</div><button type="button" id="refreshBalance" aria-label="Refresh balance">${accountIcon('refresh')}</button></div><button type="button" data-account-panel="Wallet" class="enter-wallet">Enter wallet</button></section>
    <div class="wallet-actions">${action('ARWallet','wallet','ARWallet')}${action('Deposit','deposit')}${action('Withdraw','withdraw')}${action('VIP','crown')}</div></section>
    <section class="history-grid" id="accountHistory" aria-label="Account history">${history('Game History','history','Game History','My game history','game-history.svg')}${history('Transaction','chart','Transaction','My transaction history','wallet-confirmed.svg')}${history('Deposit History','deposit','Deposit','My deposit history','deposit-history.svg')}${history('Withdraw History','wallet','Withdraw','My withdraw history','withdraw.svg')}</section>
    <section class="account-menu" aria-label="Account options">${[['Notification','bell','message.svg'],['Gifts','gift','gift.svg'],['My Top-Up Coupons','ticket','coupon.svg'],['Game Statistics','chart','statistics.svg'],['Language','globe','language.svg']].map(([name,icon,asset])=>`<button type="button" class="tone-${icon}" data-account-panel="${name}"><span class="menu-icon">${accountIcon(icon,asset)}</span><span>${name}</span>${name==='Language'?'<span class="language-value">English</span>':''}<span class="row-chevron">›</span></button>`).join('')}</section>
    <section class="service-card"><h2 class="service-heading">Service center</h2><div class="service-grid">${action('Settings','settings','Settings','settings.svg')}${action('Feedback','chat','Feedback','feedback.svg')}${action('Announcement','bell','Announcement','announcement.svg')}${action('Customer','user','Customer Service','customer-service.svg')}${action('Guide','guide',"Beginner’s Guide",'about-us.svg')}${action('About us','info','About us','about-us.svg')}</div></section>
    <button type="button" class="logout-button" id="accountLogout">${accountIcon('logout')}Log out</button><p class="account-preview-note">Wallet services are not connected</p>
    </div>${accountTabbar()}<dialog class="account-dialog" id="accountDialog"><div class="dialog-heading"><h2 id="panelTitle"></h2><button type="button" id="closeAccountDialog" aria-label="Close">×</button></div><div id="panelContent"></div></dialog><dialog class="logout-dialog" id="logoutDialog"><div class="logout-warning" aria-hidden="true">!</div><p>Do you want to log out?</p><button type="button" class="logout-confirm" id="confirmLogout">Confirm</button><button type="button" class="logout-cancel" id="cancelLogout">Cancel</button></dialog></section>`;
}

function bindTabbar() {
  document.querySelectorAll('[data-tab-action]').forEach(button => {if(button.dataset.cwTabBound)return;button.dataset.cwTabBound='1';button.addEventListener('click', () => {
    const routes = { home: '#/home', activity: '#/activity', tournaments: '#/tournaments', promotion: '#/promotion', account: '#/account' };
    if(button.dataset.tabAction === 'promotion' && location.hash === '#/promotion'){render();return;}
    location.hash = routes[button.dataset.tabAction];
  });});
}

function bindAccount() {
  document.querySelector('#changeAvatar').addEventListener('click', () => { location.hash = '#/account/avatar'; });
  document.querySelector('#copyUid').addEventListener('click', async () => { try { await navigator.clipboard.writeText(String(ColorWinAuth.profile?.public_uid || '')); toast(ColorWinAuth.profile ? 'UID copied' : 'Profile unavailable'); } catch { toast('UID: '+(ColorWinAuth.profile?.public_uid || 'unavailable')); } });
  window.ColorWinAccount.avatar=selectedAvatar;window.ColorWinAccount.refreshBalance().catch(()=>{});document.querySelector('#refreshBalance').addEventListener('click', async () => {try{await window.ColorWinAccount.refreshBalance();toast('Balance refreshed');}catch{toast('Balance could not be loaded.',true);}});
  const logoutDialog = document.querySelector('#logoutDialog');
  document.querySelector('#accountLogout').addEventListener('click', () => logoutDialog.showModal());
  document.querySelector('#confirmLogout').addEventListener('click', async event => { event.currentTarget.disabled=true; try { await ColorWinAuth.logout(); location.hash='#/login'; } catch { toast('Logout failed. Check your connection and retry.'); event.target.disabled=false; } });
  document.querySelector('#cancelLogout').addEventListener('click', () => logoutDialog.close());
  logoutDialog.addEventListener('click', event => { if (event.target === logoutDialog) logoutDialog.close(); });
  const dialog=document.querySelector('#accountDialog');
  document.querySelector('#closeAccountDialog').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  const descriptions={
    Wallet:'Your wallet balance is ₹0.00 in this preview.',
    Deposit:'Deposits are not enabled in this preview. No payment will be collected.',
    Withdraw:'Withdrawals are not enabled in this preview.',
    VIP:'VIP benefits and membership details will appear here when available.',
    Safe:'Safe transfers are not enabled in this preview.',
    'Game History':'No games to show.',Transaction:'No transactions to show.',
    'Deposit History':'No deposits to show.','Withdraw History':'No withdrawals to show.',
    Notification:'You have no notifications.',Gifts:'No gifts available yet.',
    'My Top-Up Coupons':'You have no top-up coupons.','Game Statistics':'No games played. Statistics will appear here.',
    Language:'English is the current display language.',Settings:'Account settings will be available when account services are connected.',
    Feedback:'Feedback submission is not enabled in this preview.',Announcement:'No announcements yet.',Customer:'Customer support contact details have not been added yet.',
    Guide:'Use Wallet to view your balance, history shortcuts to review activity, and the copy icon to copy your UID.',
    'About us':'Color Win account preview. Account, payment and gaming services are not connected.'
  };
  document.querySelectorAll('[data-account-panel]').forEach(button=>button.addEventListener('click',()=>{const name=button.dataset.accountPanel;if(window.ColorWinAccount.routes[name]){location.hash=window.ColorWinAccount.routes[name];return;}if(name==='ARWallet'){window.ColorWinCheckout.maintenance(document.querySelector('.account-page'),'ARWallet');return;}const walletRoutes={Wallet:'#/wallet',Deposit:'#/deposit',Withdraw:'#/withdraw','Deposit History':'#/deposit/history','Withdraw History':'#/withdraw/history'};if(walletRoutes[name]){location.hash=walletRoutes[name];return;}document.querySelector('#panelTitle').textContent=name;document.querySelector('#panelContent').textContent=descriptions[name];dialog.showModal();}));
  bindTabbar();
}

function bindAvatarView() {
  document.querySelector('#avatarBackBtn').addEventListener('click', () => { location.hash = sessionStorage.getItem('cw_avatar_return') || '#/account';sessionStorage.removeItem('cw_avatar_return'); });
  document.querySelectorAll('[data-avatar]').forEach(button => button.addEventListener('click', () => {
    localStorage.setItem('cw_avatar_'+(ColorWinAuth.session?.user?.id||'preview'), button.dataset.avatar);
    location.hash = sessionStorage.getItem('cw_avatar_return') || '#/account';sessionStorage.removeItem('cw_avatar_return');
  }));
}
