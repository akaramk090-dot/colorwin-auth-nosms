// Color Win puzzle-image slide captcha.
// UX verification only; it is not server-side bot protection.
(() => {
  // Resolve images relative to this JS file so the captcha works whether
  // dist/ is the server root or the project is served from a subfolder.
  const CAPTCHA_SCRIPT_URL = document.currentScript?.src || new URL('js/slide-captcha.js', document.baseURI).href;
  const captchaAsset = name => new URL(`../assets/captcha/${name}`, CAPTCHA_SCRIPT_URL).href;
  const CAPTCHA_IMAGES = [
    'captcha-01.jpg',
    'captcha-02.jpg',
    'captcha-03.jpg',
    'captcha-04.jpg',
    'captcha-05.jpg',
    'captcha-06.jpg',
    'captcha-07.jpg',
    'captcha-08.jpg'
  ].map(captchaAsset);

  const PIECE_SIZE = 58;
  const TOLERANCE = 8;
  let previousImageIndex = -1;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  function randomImagePath() {
    if (CAPTCHA_IMAGES.length === 1) return CAPTCHA_IMAGES[0];
    let index;
    do index = randomInt(0, CAPTCHA_IMAGES.length - 1);
    while (index === previousImageIndex);
    previousImageIndex = index;
    return CAPTCHA_IMAGES[index];
  }

  // A compact jigsaw silhouette that stays fully inside the supplied square.
  function puzzlePath(ctx, x, y, size) {
    const r = size * 0.115;
    const top = y + r;
    const right = x + size - r;
    const bottom = y + size - r;
    const left = x + r;
    const cx = x + size * 0.5;
    const cy = y + size * 0.5;

    ctx.beginPath();
    ctx.moveTo(left, top);

    // Top edge + outward tab.
    ctx.lineTo(cx - r, top);
    ctx.bezierCurveTo(cx - r, top - r, cx + r, top - r, cx + r, top);
    ctx.lineTo(right, top);

    // Right edge + inward notch.
    ctx.lineTo(right, cy - r);
    ctx.bezierCurveTo(right - r, cy - r, right - r, cy + r, right, cy + r);
    ctx.lineTo(right, bottom);

    // Bottom edge + outward tab.
    ctx.lineTo(cx + r, bottom);
    ctx.bezierCurveTo(cx + r, bottom + r, cx - r, bottom + r, cx - r, bottom);
    ctx.lineTo(left, bottom);

    // Left edge + inward notch.
    ctx.lineTo(left, cy + r);
    ctx.bezierCurveTo(left + r, cy + r, left + r, cy - r, left, cy - r);
    ctx.closePath();
  }

  function drawCover(ctx, image, canvas) {
    const cw = canvas.width;
    const ch = canvas.height;
    const scale = Math.max(cw / image.naturalWidth, ch / image.naturalHeight);
    const dw = image.naturalWidth * scale;
    const dh = image.naturalHeight * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(image, dx, dy, dw, dh);
  }

  window.openSlideCaptcha = function openSlideCaptcha() {
    return new Promise(resolve => {
      const dialog = document.createElement('dialog');
      dialog.className = 'captcha puzzle-captcha';
      dialog.setAttribute('aria-label', 'Puzzle verification');
      dialog.innerHTML = `
        <div class="puzzle-captcha__image" aria-label="Puzzle image">
          <canvas class="puzzle-captcha__background"></canvas>
          <canvas class="puzzle-captcha__piece"></canvas>
          <div class="puzzle-captcha__loading">Loading…</div>
          <button type="button" class="puzzle-captcha__refresh" aria-label="New puzzle">↻</button>
          <button type="button" class="captcha-close" aria-label="Close verification">×</button>
          <div class="puzzle-captcha__feedback" role="status" aria-live="polite"></div>
        </div>
        <div class="captcha__bar">
          <div class="captcha_progress_bar"></div>
          <span class="captcha-status">Hold and slide</span>
          <button type="button" class="captcha_handler" role="slider"
            aria-label="Slide the puzzle piece" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <span aria-hidden="true">»</span>
          </button>
        </div>
      `;

      document.body.appendChild(dialog);
      dialog.showModal();

      const imageWrap = dialog.querySelector('.puzzle-captcha__image');
      const bgCanvas = dialog.querySelector('.puzzle-captcha__background');
      const pieceCanvas = dialog.querySelector('.puzzle-captcha__piece');
      const loading = dialog.querySelector('.puzzle-captcha__loading');
      const refreshButton = dialog.querySelector('.puzzle-captcha__refresh');
      const closeButton = dialog.querySelector('.captcha-close');
      const feedback = dialog.querySelector('.puzzle-captcha__feedback');
      const bar = dialog.querySelector('.captcha__bar');
      const handle = dialog.querySelector('.captcha_handler');
      const progress = dialog.querySelector('.captcha_progress_bar');
      const status = dialog.querySelector('.captcha-status');
      const bgCtx = bgCanvas.getContext('2d', { willReadFrequently: true });
      const pieceCtx = pieceCanvas.getContext('2d');

      let image = null;
      let targetX = 0;
      let targetY = 0;
      let maxPieceX = 1;
      let maxHandleX = 1;
      let pieceX = 0;
      let handleX = 0;
      let activePointer = null;
      let startPointerX = 0;
      let startHandleX = 0;
      let verified = false;
      let closed = false;
      let resetTimer = 0;
      let resizeTimer = 0;
      let imageLoadToken = 0;

      function finish(result) {
        if (closed) return;
        closed = true;
        clearTimeout(resetTimer);
        clearTimeout(resizeTimer);
        window.removeEventListener('hashchange', cancel);
        window.removeEventListener('resize', onResize);
        try { dialog.close(); } catch {}
        dialog.remove();
        resolve(result);
      }

      function cancel() {
        finish(false);
      }

      function sizeCanvases() {
        const width = Math.max(1, Math.round(imageWrap.clientWidth));
        const height = Math.max(1, Math.round(imageWrap.clientHeight));
        bgCanvas.width = width;
        bgCanvas.height = height;
        pieceCanvas.width = PIECE_SIZE;
        pieceCanvas.height = PIECE_SIZE;
        pieceCanvas.style.width = `${PIECE_SIZE}px`;
        pieceCanvas.style.height = `${PIECE_SIZE}px`;
        maxPieceX = Math.max(1, width - PIECE_SIZE);
        maxHandleX = Math.max(1, bar.clientWidth - handle.offsetWidth);
      }

      function setPiecePosition(x) {
        pieceX = clamp(x, 0, maxPieceX);
        pieceCanvas.style.transform = `translate3d(${pieceX}px, ${targetY}px, 0)`;
      }

      function setHandlePosition(x) {
        handleX = clamp(x, 0, maxHandleX);
        const ratio = maxHandleX ? handleX / maxHandleX : 0;
        handle.style.transform = `translate3d(${handleX}px,0,0)`;
        progress.style.width = `${handleX + handle.offsetWidth}px`;
        handle.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
        setPiecePosition(ratio * maxPieceX);
        status.style.opacity = ratio > 0.06 ? '0.32' : '1';
      }

      function removeMotionClasses() {
        handle.classList.remove('captcha-return');
        progress.classList.remove('captcha-return');
        pieceCanvas.classList.remove('captcha-return');
      }

      function resetSlider(animated = true) {
        verified = false;
        dialog.classList.remove('is-success', 'is-error');
        feedback.textContent = '';
        status.textContent = 'Hold and slide';
        status.style.opacity = '1';
        handle.innerHTML = '<span aria-hidden="true">»</span>';
        handle.disabled = !image;

        if (animated) {
          handle.classList.add('captcha-return');
          progress.classList.add('captcha-return');
          pieceCanvas.classList.add('captcha-return');
        } else {
          removeMotionClasses();
        }

        setHandlePosition(0);
        if (animated) setTimeout(removeMotionClasses, 360);
      }

      function drawPuzzle() {
        if (!image || closed) return;
        sizeCanvases();
        drawCover(bgCtx, image, bgCanvas);

        // Keep the gap in the right 55% so there is enough room to drag toward it.
        const minTargetX = Math.max(PIECE_SIZE + 18, Math.round(maxPieceX * 0.45));
        const maxTargetX = Math.max(minTargetX, Math.round(maxPieceX * 0.88));
        const minTargetY = 18;
        const maxTargetY = Math.max(minTargetY, bgCanvas.height - PIECE_SIZE - 18);
        targetX = randomInt(minTargetX, maxTargetX);
        targetY = randomInt(minTargetY, maxTargetY);

        // Extract the exact piece before drawing the target hole.
        pieceCtx.clearRect(0, 0, PIECE_SIZE, PIECE_SIZE);
        pieceCtx.save();
        puzzlePath(pieceCtx, 0, 0, PIECE_SIZE);
        pieceCtx.clip();
        pieceCtx.drawImage(
          bgCanvas,
          targetX, targetY, PIECE_SIZE, PIECE_SIZE,
          0, 0, PIECE_SIZE, PIECE_SIZE
        );
        pieceCtx.restore();
        pieceCtx.save();
        puzzlePath(pieceCtx, 0, 0, PIECE_SIZE);
        pieceCtx.lineWidth = 2;
        pieceCtx.strokeStyle = 'rgba(255,255,255,.96)';
        pieceCtx.stroke();
        pieceCtx.restore();

        // Dark missing-piece area on the main image.
        bgCtx.save();
        puzzlePath(bgCtx, targetX, targetY, PIECE_SIZE);
        bgCtx.fillStyle = 'rgba(25,29,39,.68)';
        bgCtx.fill();
        bgCtx.lineWidth = 2;
        bgCtx.strokeStyle = 'rgba(255,255,255,.90)';
        bgCtx.stroke();
        bgCtx.restore();

        resetSlider(false);
        handle.disabled = false;
      }

      function loadNewPuzzle() {
        activePointer = null;
        const token = ++imageLoadToken;
        clearTimeout(resetTimer);
        image = null;
        handle.disabled = true;
        dialog.classList.remove('is-success', 'is-error');
        feedback.textContent = '';
        loading.hidden = false;
        loading.textContent = 'Loading…';

        const nextImage = new Image();
        nextImage.onload = () => {
          if (closed || token !== imageLoadToken) return;
          image = nextImage;
          loading.hidden = true;
          drawPuzzle();
        };
        nextImage.onerror = () => {
          if (closed || token !== imageLoadToken) return;
          loading.hidden = false;
          loading.textContent = 'Image could not load — tap ↻';
        };
        nextImage.src = randomImagePath();
      }

      function succeed() {
        verified = true;
        dialog.classList.remove('is-error');
        dialog.classList.add('is-success');
        setPiecePosition(targetX);
        feedback.textContent = 'Verified ✓';
        status.textContent = 'Verified';
        status.style.opacity = '1';
        handle.innerHTML = '<span aria-hidden="true">✓</span>';
        handle.disabled = true;
        resetTimer = setTimeout(() => finish(true), 520);
      }

      function fail() {
        dialog.classList.remove('is-success');
        dialog.classList.add('is-error');
        feedback.textContent = 'Try again';
        resetTimer = setTimeout(() => resetSlider(true), 460);
      }

      function validatePosition() {
        if (!image || verified) return;
        const difference = Math.abs(pieceX - targetX);
        if (difference <= TOLERANCE) succeed();
        else fail();
      }

      function onPointerDown(event) {
        if (!image || verified || handle.disabled) return;
        if (activePointer !== null) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        clearTimeout(resetTimer);
        activePointer = event.pointerId;
        startPointerX = event.clientX;
        startHandleX = handleX;
        dialog.classList.remove('is-error');
        feedback.textContent = '';
        removeMotionClasses();
        try { handle.setPointerCapture(activePointer); } catch {}
      }

      function onPointerMove(event) {
        if (activePointer === null || event.pointerId !== activePointer) return;
        setHandlePosition(startHandleX + (event.clientX - startPointerX));
      }

      function onPointerEnd(event) {
        if (activePointer === null || event.pointerId !== activePointer) return;
        try { handle.releasePointerCapture(activePointer); } catch {}
        activePointer = null;
        validatePosition();
      }

      function onResize() {
        if (!image || closed || verified) return;
        activePointer = null;
        clearTimeout(resetTimer);
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(drawPuzzle, 140);
      }

      handle.addEventListener('pointerdown', onPointerDown);
      handle.addEventListener('pointermove', onPointerMove);
      handle.addEventListener('pointerup', onPointerEnd);
      handle.addEventListener('pointercancel', () => {
        activePointer = null;
        if (!verified) resetSlider(true);
      });
      handle.addEventListener('keydown', event => {
        if (!image || verified || handle.disabled) return;
        const key = event.key;
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' '].includes(key)) return;
        event.preventDefault();
        if (key === 'Enter' || key === ' ') return validatePosition();
        if (key === 'Home') return setHandlePosition(0);
        if (key === 'End') return setHandlePosition(maxHandleX);
        setHandlePosition(handleX + (key === 'ArrowRight' ? 8 : -8));
      });

      refreshButton.addEventListener('click', loadNewPuzzle);
      closeButton.addEventListener('click', cancel);
      dialog.addEventListener('cancel', event => {
        event.preventDefault();
        cancel();
      });
      window.addEventListener('hashchange', cancel);
      window.addEventListener('resize', onResize, { passive: true });

      loadNewPuzzle();
    });
  };
})();
