(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const games = {
    wingo: {label:'WinGo', digits:1, minDigit:0, maxDigit:9},
    'trx-wingo': {label:'TRX', digits:1, minDigit:0, maxDigit:9},
    k3: {label:'K3', digits:3, minDigit:1, maxDigit:6},
    '5d': {label:'5D', digits:5, minDigit:0, maxDigit:9}
  };
  let selected = [];
  let activeSlot = 0;

  function renderSlots() {
    const game = games[$('game').value];
    selected = selected.slice(0, game.digits);
    while (selected.length < game.digits) selected.push('');
    activeSlot = Math.min(activeSlot, game.digits - 1);
    $('number-pad').classList.toggle('dice', game.minDigit === 1);
    $('number-pad').setAttribute('aria-label', game.minDigit === 1 ? 'Choose a K3 dice face from 1 to 6' : 'Choose a digit from 0 to 9');
    $('number-pad').innerHTML = Array.from({length:game.maxDigit - game.minDigit + 1}, (_, index) => {
      const digit = index + game.minDigit;
      return `<button type="button" data-digit="${digit}">${digit}</button>`;
    }).join('');
    $('digit-fields').innerHTML = selected.map((digit, index) =>
      `<button class="digit-slot${digit === '' ? '' : ' filled'}" type="button" data-slot="${index}" aria-label="Result digit ${index + 1}${digit === '' ? ', empty' : ', ' + digit}" aria-pressed="${index === activeSlot}">${digit === '' ? '–' : digit}</button>`
    ).join('');
    $('format-help').textContent = game.minDigit === 1
      ? 'K3 result teen dice faces ka hota hai. Har dice ke liye 1–6 choose karein.'
      : game.digits === 1
        ? `${game.label} result ek digit hota hai. 0–9 mein se choose karein.`
        : `${game.label} result ${game.digits} digits ka hota hai. Har position ke liye 0–9 choose karein.`;
    $('result-card').hidden = true;
    $('input-error').hidden = true;
  }

  function selectDigit(digit) {
    selected[activeSlot] = digit;
    const nextEmpty = selected.findIndex(value => value === '');
    activeSlot = nextEmpty === -1
      ? Math.min(activeSlot + 1, selected.length - 1)
      : nextEmpty;
    renderSlots();
  }

  $('game').addEventListener('change', () => {
    selected = [];
    activeSlot = 0;
    renderSlots();
  });

  $('digit-fields').addEventListener('click', event => {
    const slot = event.target.closest('[data-slot]');
    if (!slot) return;
    activeSlot = Number(slot.dataset.slot);
    renderSlots();
  });

  document.querySelector('.number-pad').addEventListener('click', event => {
    const button = event.target.closest('[data-digit]');
    if (button) selectDigit(button.dataset.digit);
  });

  $('clear').addEventListener('click', () => {
    selected = selected.map(() => '');
    activeSlot = 0;
    $('result-card').hidden = true;
    $('input-error').hidden = true;
    renderSlots();
  });

  $('show-result').addEventListener('click', () => {
    const period = $('period').value.trim();
    const game = games[$('game').value];
    if (!period || selected.some(digit => !/^\d$/.test(digit) || Number(digit) < game.minDigit || Number(digit) > game.maxDigit)) {
      $('input-error').textContent = !period
        ? 'Demo period enter karein.'
        : game.minDigit ? 'K3 ke har dice ke liye 1–6 mein se choose karein.' : 'Har result position ke liye 0–9 mein se digit choose karein.';
      $('input-error').hidden = false;
      return;
    }

    $('input-error').hidden = true;
    $('result-game').textContent = games[$('game').value].label;
    $('result-period').textContent = period;
    $('result-digits').innerHTML = selected.map(digit => `<span>${digit}</span>`).join('');
    $('result-card').hidden = false;
  });

  renderSlots();
})();
