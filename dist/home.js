(() => {
  const icon = (name) => {
    const paths = {
      support: '<path d="M4 13v-2a8 8 0 0 1 16 0v2"/><path d="M4 12H3a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2v-6zm16 0h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2v-6zM9 20h6"/>',
      inbox: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 13h4l2 3h6l2-3h4"/>',
      notification: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
      announcement: '<path d="m3 11 18-6v14L3 13z"/><path d="M7 14l2 6h4l-2.5-5.2"/>',
      wallet: '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 8V5l14-3v3M21 11h-6v5h6M17 13.5h.01"/>',
      deposit: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
      invite: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2m4-11v6m-3-3h6"/>',
      lottery: '<circle cx="12" cy="12" r="9"/><path d="M8 8h.01M16 8h.01M8 16h.01M16 16h.01M12 11h.01"/>',
      games: '<rect x="3" y="7" width="18" height="12" rx="3"/><path d="M8 10v6m-3-3h6m5-2h.01M18 14h.01"/>',
      slots: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 4v16m6-16v16M6.5 10h.01M12 14h.01M17.5 9h.01"/>',
      casino: '<path d="M12 3 3 8l9 5 9-5-9-5zm-9 9 9 5 9-5m-18 5 9 5 9-5"/>',
      sports: '<circle cx="12" cy="12" r="9"/><path d="m12 3 2 6 6 2-5 4v6l-5-4-6 2 2-6-3-5 6 1z"/>',
      fishing: '<path d="M4 5c4 0 7 3 7 7 0 3-2 5-5 5-2 0-3-1-3-3 0-1 1-2 2-2"/><path d="M11 12h8l2-2v4l-2-2m-8 0 4 7"/>',
      popular: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3z"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.games}</svg>`;
  };

  const homeBanners = [
    { image: 'assets/web%20images/banner-1.png', route: '#/activity/refer-friends' },
    { image: 'assets/web%20images/banner-2.png', route: '#/activity/welcome-bonus' },
    { image: 'assets/web%20images/banner-3.png', route: '#/activity/dailytasks' },
    { image: 'assets/web%20images/banner-4.png', route: '#/activity/super-jackpot' },
    { image: 'assets/web%20images/banner-5.png', route: '#/activity/dailysignin' }
  ];

  function view(tabbar) {
    const campaigns=window.ColorWinOperations?.config?.campaigns||[];const banners=campaigns.filter(c=>c.banner).map(c=>({image:c.banner,route:homeBanners.find(b=>decodeURIComponent(b.image)===decodeURIComponent(c.banner))?.route||'#/activity'}));const visibleBanners=banners.length?banners:homeBanners;
    return `<section class="home-page">
      <header class="home-topbar">
        <a class="home-brand" href="#/home" aria-label="Color Win home"><img src="assets/web%20images/color-win-logo-supplied.png" alt="Color Win"></a>
        <div class="home-topbar-balance" data-home-topbar-route="#/deposit">
          <button type="button" class="home-balance-value" data-home-topbar-route="#/deposit">₹—</button>
          <button type="button" class="home-balance-add" data-home-topbar-route="#/deposit" aria-label="Add funds"><img class="home-balance-plus-image" src="assets/web%20images/headerDepositPlus-BYMjCOAj.svg" alt=""></button>
        </div>
        <button type="button" class="home-topbar-action notification-btn" data-home-topbar-route="#/account/notifications" aria-label="Notifications">${icon('notification')}</button>
      </header>
      <main class="home-content">
        <section class="home-carousel" aria-label="Promotions" aria-roledescription="carousel">
          <div class="home-carousel-track">
            ${visibleBanners.map((banner, index) => {
              const tag = banner.route ? 'a' : 'div';
              const route = banner.route ? ` href="${banner.route}"` : '';
              return `<${tag} class="home-slide${index === 0 ? ' is-active' : ''}" data-home-slide="${index}" aria-hidden="${index !== 0}"${route}>
                <img src="${banner.image}" alt="Color Win promotion banner ${index + 1}" ${index ? 'loading="eager"' : 'fetchpriority="high"'}>
              </${tag}>`;
            }).join('')}
          </div>
          <div class="home-carousel-dots" aria-label="Select banner">
            ${visibleBanners.map((_, index) => `<button type="button" class="home-carousel-dot${index === 0 ? ' is-active' : ''}" data-home-dot="${index}" aria-label="Show banner ${index + 1}" aria-pressed="${index === 0}"></button>`).join('')}
          </div>
        </section>
        ${window.ColorWinHomeLayout.view()}
      </main>
      ${tabbar}
    </section>`;
  }

  function bind() {
    window.ColorWinAccount?.refreshBalance?.().catch(()=>{});
    document.querySelectorAll('[data-home-topbar-route]').forEach((button) => {
      button.addEventListener('click', () => { location.hash = button.dataset.homeTopbarRoute; });
    });

    window.ColorWinCatalog.bind();
    window.ColorWinHomeLayout.bind();

    const carousel = document.querySelector('.home-carousel');
    const track = carousel.querySelector('.home-carousel-track');
    let slides = Array.from(carousel.querySelectorAll('.home-slide'));
    let activeIndex = 0;
    let timer = null;
    let pointerStart = null;
    const controller = new AbortController();
    const { signal } = controller;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const stopTimer = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const updateCarousel = (index) => {
      if (!slides.length) return;
      activeIndex = (index + slides.length) % slides.length;
      track.style.transform = `translateX(-${activeIndex * 100}%)`;
      slides.forEach((slide, slideIndex) => {
        const active = slideIndex === activeIndex;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', String(!active));
      });
      carousel.querySelectorAll('[data-home-dot]').forEach((dot, dotIndex) => {
        const active = dotIndex === activeIndex;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-pressed', String(active));
      });
    };

    const startTimer = () => {
      stopTimer();
      if (slides.length > 1 && !document.hidden && !reducedMotion) {
        timer = window.setInterval(() => updateCarousel(activeIndex + 1), 4000);
      }
    };

    const rebuildDots = () => {
      const dots = carousel.querySelector('.home-carousel-dots');
      dots.replaceChildren(...slides.map((_, index) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = `home-carousel-dot${index === activeIndex ? ' is-active' : ''}`;
        dot.dataset.homeDot = String(index);
        dot.setAttribute('aria-label', `Show banner ${index + 1}`);
        dot.setAttribute('aria-pressed', String(index === activeIndex));
        return dot;
      }));
    };

    slides.forEach((slide) => {
      const image = slide.querySelector('img');
      image.addEventListener('load', () => {
        if (slide === slides[activeIndex]) updateCarousel(activeIndex);
      }, { once: true, signal });
      image.addEventListener('error', () => {
        const failedIndex = slides.indexOf(slide);
        if (failedIndex === -1) return;
        slide.remove();
        slides = Array.from(carousel.querySelectorAll('.home-slide'));
        if (failedIndex < activeIndex) activeIndex -= 1;
        else if (failedIndex === activeIndex) activeIndex = Math.min(failedIndex, slides.length - 1);
        rebuildDots();
        if (slides.length) updateCarousel(activeIndex);
        else carousel.hidden = true;
        startTimer();
      }, { once: true, signal });
    });

    if (slides[activeIndex]) updateCarousel(activeIndex);
    carousel.addEventListener('click', (event) => {
      const dot = event.target.closest('[data-home-dot]');
      if (!dot) return;
      updateCarousel(Number(dot.dataset.homeDot));
      startTimer();
    }, { signal });
    carousel.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary) return;
      pointerStart = { x: event.clientX, y: event.clientY };
    }, { signal });
    carousel.addEventListener('pointerup', (event) => {
      if (!pointerStart) return;
      const deltaX = event.clientX - pointerStart.x;
      const deltaY = event.clientY - pointerStart.y;
      pointerStart = null;
      if (Math.abs(deltaX) < 35 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
      updateCarousel(activeIndex + (deltaX < 0 ? 1 : -1));
      startTimer();
    }, { signal });
    carousel.addEventListener('pointercancel', () => { pointerStart = null; }, { signal });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopTimer();
      else startTimer();
    }, { signal });

    const cleanup = () => {
      stopTimer();
      controller.abort();
    };
    const handleRouteChange = () => {
      if (location.hash.toLowerCase() !== '#/home') cleanup();
    };
    window.addEventListener('hashchange', handleRouteChange, { signal });
    window.addEventListener('pagehide', cleanup, { once: true, signal });
    if (location.hash.toLowerCase() !== '#/home') {
      cleanup();
      return;
    }
    startTimer();
  }

  window.ColorWinHome = { view, bind };
})();
