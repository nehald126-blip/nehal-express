// Shared lightweight animation helpers for Nehal Express.
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let toastTimer = null;
  let ripplesInitialized = false;
  let headerInitialized = false;

  const revealObserver = !reduceMotion && 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 })
    : null;

  function observeReveals(root = document, options = {}) {
    const stagger = options.stagger ?? 35;
    const maxDelay = options.maxDelay ?? 180;
    const items = root.querySelectorAll?.('.reveal-on-scroll:not(.is-visible)') || [];

    items.forEach((item, index) => {
      item.style.transitionDelay = reduceMotion ? '' : `${Math.min(index * stagger, maxDelay)}ms`;
      if (revealObserver) revealObserver.observe(item);
      else item.classList.add('is-visible');
    });
  }

  function prepareReveals(selectors, root = document) {
    root.querySelectorAll(selectors).forEach((item) => {
      item.classList.add('reveal-on-scroll');
    });
  }

  function initToast(toast = document.getElementById('toast')) {
    if (!toast) return null;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');
    return toast;
  }

  function showToast(message, type = 'info', options = {}) {
    const toast = initToast();
    if (!toast) return;

    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.remove('toast-success', 'toast-error', 'toast-info', 'show');
    toast.classList.add(`toast-${type}`);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, options.duration ?? (type === 'error' ? 3200 : 2400));
  }

  function initButtonRipples(root = document) {
    if (ripplesInitialized || reduceMotion) return;
    ripplesInitialized = true;

    root.addEventListener('click', (event) => {
      const button = event.target.closest('button, .btn, .icon-btn');
      if (!button || button.disabled || button.classList.contains('is-loading')) return;

      const rect = button.getBoundingClientRect();
      const ripple = document.createElement('span');
      const size = Math.max(rect.width, rect.height);
      ripple.className = 'ne-ripple';
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
      button.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    });
  }

  function pulseBadge(badge, previousValue, nextValue) {
    if (!badge || reduceMotion || String(previousValue) === String(nextValue)) return;
    badge.classList.remove('is-bouncing');
    void badge.offsetWidth;
    badge.classList.add('is-bouncing');
  }

  function initStickyHeader(header = document.getElementById('siteHeader')) {
    if (!header || headerInitialized) return;
    headerInitialized = true;

    let ticking = false;
    const update = () => {
      header.classList.toggle('is-compact', window.scrollY > 28);
      ticking = false;
    };

    update();
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });
  }

  function createCardSkeletons(count = 1, options = {}) {
    const total = Math.max(0, Number(count) || 0);
    const className = options.className || 'skeleton-card';
    const lines = options.lines || ['medium', '', 'short'];
    const thumb = options.thumb ? '<div class="skeleton skeleton-thumb"></div>' : '';

    return Array.from({ length: total }, () => `
      <div class="${className} skeleton-placeholder" aria-hidden="true">
        ${thumb}
        ${lines.map((size) => `<div class="skeleton skeleton-line ${size}"></div>`).join('')}
      </div>
    `).join('');
  }

  function createTableSkeletonRows(columns = 4, rows = 3) {
    const colCount = Math.max(1, Number(columns) || 1);
    const rowCount = Math.max(0, Number(rows) || 0);

    return Array.from({ length: rowCount }, () => `
      <tr class="skeleton-placeholder skeleton-table-row" aria-hidden="true">
        ${Array.from({ length: colCount }, (_, index) => `
          <td><div class="skeleton skeleton-line ${index % 3 === 0 ? 'short' : 'medium'}"></div></td>
        `).join('')}
      </tr>
    `).join('');
  }

  function clearSkeletons(root) {
    if (!root) return;
    root.querySelectorAll?.('.skeleton-placeholder').forEach((item) => item.remove());
    root.setAttribute?.('aria-busy', 'false');
  }

  function init(root = document) {
    if (document.getElementById('toast')) initToast();
    if (root.querySelector('button, .btn, .icon-btn')) initButtonRipples(root);
    if (document.getElementById('siteHeader')) initStickyHeader();
  }

  window.NehalAnimations = Object.freeze({
    reduceMotion,
    observeReveals,
    prepareReveals,
    initToast,
    showToast,
    initButtonRipples,
    pulseBadge,
    initStickyHeader,
    createCardSkeletons,
    createTableSkeletonRows,
    clearSkeletons,
    init
  });
})();
