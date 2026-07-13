// ============================================================
// Nehal Express — Storefront logic
// ============================================================
const state = {
  categories: [],
  products: [],
  cart: JSON.parse(localStorage.getItem('ne_cart') || '[]'),
  activeCategory: 'all',
  search: '',
  sort: '',
  wishlist: [],
  productReviews: [],
  currentProduct: null,
  pmSelection: { size: null, color: null, qty: 1 }
};

const rupee = (n) => '₹' + Number(n).toLocaleString('en-IN');

const AUTH_TOKEN_KEY = 'ne_auth_token';
let productEmptyText = '';
let productLoadSequence = 0;

function setBusy(el, busy) {
  if (!el) return;
  if (busy) el.setAttribute('aria-busy', 'true');
  else el.setAttribute('aria-busy', 'false');
}

function finishLoading(el) {
  window.NehalAnimations?.clearSkeletons(el);
}

function showProductSkeletons() {
  const grid = document.getElementById('productGrid');
  const empty = document.getElementById('emptyState');
  if (!grid || !window.NehalAnimations) return;

  if (empty) empty.hidden = true;
  setBusy(grid, true);
  grid.innerHTML = Array.from({ length: 8 }, () => `
    <article class="product-card product-skeleton-card skeleton-placeholder" aria-hidden="true">
      <div class="product-thumb">
        <div class="skeleton product-skeleton-image"></div>
        <div class="skeleton product-skeleton-action"></div>
      </div>
      <div class="product-info">
        <div class="skeleton skeleton-line short"></div>
        <div class="skeleton skeleton-line medium"></div>
        <div class="product-skeleton-price-row">
          <div class="skeleton skeleton-line current-price"></div>
          <div class="skeleton skeleton-line original-price"></div>
        </div>
        <div class="skeleton skeleton-line rating"></div>
      </div>
    </article>
  `).join('');
}

function observeReveals(root = document) {
  if (window.NehalAnimations) {
    window.NehalAnimations.observeReveals(root);
  }
}

function prepareStaticReveals() {
  if (window.NehalAnimations) {
    window.NehalAnimations.prepareReveals('.catalog-head, .empty-state, .footer-cols, .profile-summary');
  }
}

function authToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function authHeaders() {
  return {
    Authorization: 'Bearer ' + authToken(),
    'Content-Type': 'application/json'
  };
}

function isWishlisted(productId) {
  return state.wishlist.some((product) => product.id === productId);
}

function renderWishlistCount() {
  const count = document.getElementById('wishlistCount');
  if (count) count.textContent = state.wishlist.length;
}

function stars(value) {
  const rating = Math.round(Number(value || 0));
  return '★'.repeat(rating) + '☆'.repeat(Math.max(0, 5 - rating));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function emptyStateContent(icon, title, text, action = '') {
  const icons = {
    products: '<path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5zM4 7.5l8 4.5m8-4.5L12 12m0 9v-9"/>',
    cart: '<path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H7M10 20h.01M18 20h.01"/>'
  };

  return `
    <span class="empty-state-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[icon]}</svg>
    </span>
    <h3 class="empty-state-title">${title}</h3>
    <p class="empty-state-text">${text}</p>
    ${action ? `<div class="empty-state-actions">${action}</div>` : ''}
  `;
}

async function loadWishlist() {
  if (!authToken()) {
    state.wishlist = [];
    renderWishlistCount();
    renderProductGrid();
    return;
  }

  try {
    const res = await fetch('/api/profile/wishlist', { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load wishlist');
    state.wishlist = data.wishlist || [];
  } catch (_err) {
    state.wishlist = [];
  }

  renderWishlistCount();
  renderProductGrid();
}

function saveCart() {
  localStorage.setItem('ne_cart', JSON.stringify(state.cart));
  renderCartCount();
}

async function loadCategories() {
  const res = await fetch('/api/categories');
  state.categories = await res.json();
  renderCategoryStrip();
}

async function loadProducts() {
  const loadSequence = ++productLoadSequence;
  const params = new URLSearchParams();
  if (state.activeCategory !== 'all') params.set('category', state.activeCategory);
  if (state.search) params.set('search', state.search);
  if (state.sort) params.set('sort', state.sort);

  showProductSkeletons();

  try {
    const res = await fetch('/api/products?' + params.toString());

    const data = await res.json();
    if (loadSequence !== productLoadSequence) {
      return false;
    }

    if (!res.ok) {
      throw new Error(data.error || 'Could not load products');
    }

    state.products = data;
    renderProductGrid();
    return true;
  } catch (err) {
    if (loadSequence !== productLoadSequence) {
      return false;
    }

    const grid = document.getElementById('productGrid');
    const empty = document.getElementById('emptyState');

    finishLoading(grid);

    if (grid) {
      grid.innerHTML = '';
    }

    if (empty) {
      empty.textContent = 'Could not load products. Please try again.';
      empty.hidden = false;
    }

    showToast(err.message || 'Could not load products', 'error');
    return true;
  }
}

function renderCategoryStrip() {
  const strip = document.getElementById('categoryStrip');
  strip.innerHTML = [{ id: 'all', name: 'All' }, ...state.categories]
    .map(c => `<button class="category-chip reveal-on-scroll ${c.id === state.activeCategory ? 'active' : ''}" data-cat="${c.id}">${c.name}</button>`)
    .join('');
  observeReveals(strip);
}

function handleCategoryStripClick(event) {
  const button = event.target.closest('.category-chip');
  if (button) window.filterByCategory(button.dataset.cat);
}

function handleProductGridClick(event) {
  const wishlistButton = event.target.closest('[data-wishlist]');
  if (wishlistButton) {
    event.stopPropagation();
    toggleWishlist(wishlistButton.dataset.wishlist);
    return;
  }

  const card = event.target.closest('.product-card[data-id]');
  if (card) openProductModal(card.dataset.id);
}

function renderProductGrid() {
  const grid = document.getElementById('productGrid');
  const empty = document.getElementById('emptyState');
  finishLoading(grid);
  if (empty) empty.textContent = productEmptyText;

  if (!state.products.length) {
    grid.innerHTML = '';
    const hasCategory = state.activeCategory !== 'all';
    const hasSearch = !!state.search;
    const context = hasSearch && hasCategory
      ? `No products match “${escapeHtml(state.search)}” in ${escapeHtml(categoryName(state.activeCategory))}.`
      : hasSearch
        ? `No products match “${escapeHtml(state.search)}”. Try a different search.`
        : hasCategory
          ? `There are no products in ${escapeHtml(categoryName(state.activeCategory))} right now.`
          : 'Our catalogue is being refreshed. Please check back soon.';
    const clearAction = hasSearch || hasCategory
      ? '<button class="btn btn-primary empty-state-button" type="button" data-clear-product-filters>Clear Filters</button>'
      : '';
    empty.innerHTML = emptyStateContent('products', 'No products found', context, clearAction);
    empty.hidden = false;
    empty.querySelector('[data-clear-product-filters]')?.addEventListener('click', () => {
      state.search = '';
      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.value = '';
      window.filterByCategory('all');
    }, { once: true });
    return;
  }

  empty.hidden = true;

  const wishlistIds = new Set(state.wishlist.map((product) => product.id));
  const categoryNames = new Map(state.categories.map((category) => [category.id, category.name]));

  grid.innerHTML = state.products.map(p => {
    const hasDiscount = p.mrp > p.price;
    const discount = hasDiscount ? Math.round(100 - (p.price / p.mrp) * 100) : 0;
    const badge = p.tags.includes('bestseller') ? 'Bestseller' : p.tags.includes('new') ? 'New' : p.tags.includes('festive') ? 'Festive' : '';
    const wishlisted = wishlistIds.has(p.id);
    const category = categoryNames.has(p.category) ? categoryNames.get(p.category) : p.category;
    const price = rupee(p.price);
    const mrp = hasDiscount ? rupee(p.mrp) : '';

    return `
      <article class="product-card reveal-on-scroll" data-id="${p.id}">
        <div class="product-thumb">
          ${badge ? `<span class="product-badge">${badge}</span>` : ''}
          <button class="wishlist-heart ${wishlisted ? 'active' : ''}" type="button" data-wishlist="${p.id}" aria-label="${wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}">
            <span>${wishlisted ? '&hearts;' : '&#9825;'}</span>
          </button>
          <img src="${p.images[0]}" alt="${p.name}" loading="lazy" decoding="async" />
        </div>
        <div class="product-info">
          <span class="product-cat">${category}</span>
          <span class="product-name">${p.name}</span>
          <div class="product-price-row">
            <span class="product-price">${price}</span>
            ${hasDiscount ? `<span class="product-mrp">${mrp}</span><span class="product-discount">${discount}% off</span>` : ''}
          </div>
          <div class="product-rating">★ ${p.rating.toFixed(1)} (${p.reviews})</div>
        </div>
      </article>
    `;
  }).join('');
  observeReveals(grid);
}

async function toggleWishlist(productId) {
  if (!authToken()) {
    showToast('Please login to use Wishlist');
    setTimeout(() => { window.location.href = '/profile'; }, 600);
    return;
  }

  const product = state.products.find((item) => item.id === productId);
  const wasWishlisted = isWishlisted(productId);
  const previous = [...state.wishlist];

  state.wishlist = wasWishlisted
    ? state.wishlist.filter((item) => item.id !== productId)
    : [...state.wishlist, product].filter(Boolean);
  renderWishlistCount();
  renderProductGrid();
  showToast(wasWishlisted ? 'Removed from Wishlist' : 'Added to Wishlist');

  try {
    const res = await fetch('/api/profile/wishlist/' + encodeURIComponent(productId), {
      method: wasWishlisted ? 'DELETE' : 'POST',
      headers: authHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Wishlist update failed');
    state.wishlist = data.wishlist || [];
    renderWishlistCount();
    renderProductGrid();
  } catch (err) {
    state.wishlist = previous;
    renderWishlistCount();
    renderProductGrid();
    showToast(err.message || 'Could not update Wishlist');
  }
}

function categoryName(id) {
  const c = state.categories.find(c => c.id === id);
  return c ? c.name : id;
}

function renderCartCount() {
  document.getElementById('cartCount').textContent = state.cart.reduce((sum, i) => sum + i.qty, 0);
}

window.filterByCategory = function (cat) {
  state.activeCategory = cat;
  document.getElementById('catalogTitle').textContent = cat === 'all' ? 'All products' : categoryName(cat);
  document.querySelectorAll('.nav-link').forEach(n => {
    const active = n.dataset.category === cat;
    n.classList.toggle('active', active);
    if (active) n.setAttribute('aria-current', 'page');
    else n.removeAttribute('aria-current');
  });
  loadProducts().then(renderCategoryStrip);
};

document.querySelectorAll('.nav-link').forEach(btn => {
  btn.addEventListener('click', () => {
    window.filterByCategory(btn.dataset.category);
    closeMobileMenu();
  });
});

let searchTimer;
document.getElementById('searchInput').addEventListener('input', e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = e.target.value.trim();
    loadProducts();
  }, 300);
});

document.getElementById('sortSelect').addEventListener('change', e => {
  state.sort = e.target.value;
  loadProducts();
});

function closeMobileMenu() {
  document.getElementById('mainNav').classList.remove('open');
  document.getElementById('menuToggle').setAttribute('aria-expanded', 'false');
}

document.getElementById('menuToggle').addEventListener('click', e => {
  e.stopPropagation();
  const open = document.getElementById('mainNav').classList.toggle('open');
  e.currentTarget.setAttribute('aria-expanded', String(open));
});

document.getElementById('mobileMenuBack').addEventListener('click', closeMobileMenu);

document.addEventListener('click', e => {
  const nav = document.getElementById('mainNav');
  const toggle = document.getElementById('menuToggle');
  if (!nav.classList.contains('open')) return;
  if (window.innerWidth <= 760 && e.clientX > nav.getBoundingClientRect().width) {
    closeMobileMenu();
    return;
  }
  if (nav.contains(e.target) || toggle.contains(e.target)) return;
  closeMobileMenu();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeMobileMenu();
});

async function openProductModal(id) {
  const res = await fetch('/api/products/' + id);
  if (!res.ok) return;

  const p = await res.json();
  state.currentProduct = p;
  state.productReviews = [];
  state.pmSelection = { size: p.sizes[0] || null, color: p.colors[0] || null, qty: 1 };
  renderProductModal();
  toggleOverlay('productOverlay', true);
  await loadProductReviews(id);
  renderProductModal();
}

function renderProductModal() {
  const p = state.currentProduct;
  const sel = state.pmSelection;
  const discount = p.mrp > p.price ? Math.round(100 - (p.price / p.mrp) * 100) : 0;

  document.getElementById('productModalBody').innerHTML = `
    <div class="pm-gallery"><img src="${p.images[0]}" alt="${p.name}" decoding="async" /></div>
    <div class="pm-details">
      <span class="pm-cat">${categoryName(p.category)}</span>
      <h3 class="pm-name">${p.name}</h3>
      <div class="pm-price-row">
        <span>${rupee(p.price)}</span>
        ${p.mrp > p.price ? `<span class="pm-mrp">${rupee(p.mrp)}</span><span style="color:var(--sage);font-size:0.85rem;">${discount}% off</span>` : ''}
      </div>
      <p class="pm-desc">${p.description}</p>
      <div class="pm-review-summary">
        <span>${stars(p.rating)}</span>
        <strong>${Number(p.rating || 0).toFixed(1)}</strong>
        <small>${p.reviews || 0} ${(p.reviews || 0) === 1 ? 'review' : 'reviews'}</small>
      </div>

      ${p.sizes.length ? `
        <div class="pm-field">
          <label>Size</label>
          <div class="pm-options" id="pmSizes">
            ${p.sizes.map(s => `<button class="pm-option ${s === sel.size ? 'selected' : ''}" data-size="${s}">${s}</button>`).join('')}
          </div>
        </div>` : ''}

      ${p.colors.length ? `
        <div class="pm-field">
          <label>Colour</label>
          <div class="pm-options" id="pmColors">
            ${p.colors.map(c => `<button class="pm-option ${c === sel.color ? 'selected' : ''}" data-color="${c}">${c}</button>`).join('')}
          </div>
        </div>` : ''}

      <div class="pm-field">
        <label>Quantity</label>
        <div class="pm-qty">
          <button id="pmQtyMinus">−</button>
          <span id="pmQtyValue">${sel.qty}</span>
          <button id="pmQtyPlus">+</button>
        </div>
      </div>

      <p class="pm-stock">${p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}</p>
      <button class="btn btn-primary btn-block" id="pmAddToCart" ${p.stock === 0 ? 'disabled' : ''}>Add to bag</button>
      <section class="pm-reviews">
        <div class="pm-reviews-head">
          <h4>Customer reviews</h4>
          <span>${state.productReviews.length} ${state.productReviews.length === 1 ? 'review' : 'reviews'}</span>
        </div>
        ${renderReviewForm()}
        <div class="review-list">
          ${renderReviewList()}
        </div>
      </section>
    </div>
  `;

  document.querySelectorAll('#pmSizes .pm-option').forEach(btn => {
    btn.addEventListener('click', () => {
      state.pmSelection.size = btn.dataset.size;
      renderProductModal();
    });
  });

  document.querySelectorAll('#pmColors .pm-option').forEach(btn => {
    btn.addEventListener('click', () => {
      state.pmSelection.color = btn.dataset.color;
      renderProductModal();
    });
  });

  document.getElementById('pmQtyMinus').addEventListener('click', () => {
    state.pmSelection.qty = Math.max(1, state.pmSelection.qty - 1);
    renderProductModal();
  });

  document.getElementById('pmQtyPlus').addEventListener('click', () => {
    state.pmSelection.qty = Math.min(p.stock, state.pmSelection.qty + 1);
    renderProductModal();
  });

  document.getElementById('pmAddToCart').addEventListener('click', addCurrentToCart);
  const reviewForm = document.getElementById('reviewForm');
  if (reviewForm) reviewForm.addEventListener('submit', submitProductReview);
  document.querySelectorAll('[data-delete-review]').forEach(button => {
    button.addEventListener('click', () => deleteProductReview(button.dataset.deleteReview));
  });
}

function renderReviewForm() {
  if (!authToken()) {
    return '<div class="review-login-note">Login after purchase to write a review.</div>';
  }

  const existingReview = state.productReviews.find((review) => review.canDelete);
  const selectedRating = existingReview?.rating || 5;

  return `
    <form class="review-form" id="reviewForm">
      <label>Rating</label>
      <div class="star-input" role="radiogroup" aria-label="Rating">
        ${[5, 4, 3, 2, 1].map((value) => `
          <input type="radio" id="reviewStar${value}" name="rating" value="${value}" ${value === selectedRating ? 'checked' : ''} />
          <label for="reviewStar${value}" aria-label="${value} stars">★</label>
        `).join('')}
      </div>
      <label>Review
        <textarea id="reviewText" rows="3" maxlength="800" placeholder="Share fit, fabric, and delivery experience." required>${existingReview ? escapeHtml(existingReview.text) : ''}</textarea>
      </label>
      <button class="btn btn-primary" type="submit">${existingReview ? 'Update review' : 'Submit review'}</button>
      <p class="review-message" id="reviewMessage" hidden></p>
    </form>
  `;
}

function renderReviewList() {
  if (!state.productReviews.length) {
    return '<div class="review-empty">No reviews yet.</div>';
  }

  return state.productReviews.map((review) => `
    <article class="review-card">
      <div class="review-card-head">
        <div>
          <strong>${escapeHtml(review.userName)}</strong>
          <span>${stars(review.rating)}</span>
        </div>
        ${review.verifiedPurchase ? '<em>Verified purchase</em>' : ''}
      </div>
      <p>${escapeHtml(review.text)}</p>
      <small>${new Date(review.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })}</small>
      ${review.canDelete ? `<button type="button" data-delete-review="${review.id}">Delete my review</button>` : ''}
    </article>
  `).join('');
}

async function loadProductReviews(productId) {
  try {
    const res = await fetch('/api/products/' + encodeURIComponent(productId) + '/reviews', {
      headers: authToken() ? authHeaders() : {}
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load reviews');
    state.productReviews = data.reviews || [];
  } catch (_err) {
    state.productReviews = [];
  }
}

function updateProductInState(product) {
  state.currentProduct = product;
  state.products = state.products.map((item) => item.id === product.id ? product : item);
  state.wishlist = state.wishlist.map((item) => item.id === product.id ? product : item);
  renderProductGrid();
}

async function submitProductReview(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.getElementById('reviewMessage');
  const submit = form.querySelector('button[type=submit]');
  const isUpdate = state.productReviews.some((review) => review.canDelete);
  const idleText = isUpdate ? 'Update review' : 'Submit review';
  message.hidden = true;
  submit.disabled = true;
  submit.textContent = isUpdate ? 'Updating...' : 'Submitting...';

  try {
    const res = await fetch('/api/products/' + encodeURIComponent(state.currentProduct.id) + '/reviews', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        rating: Number(form.rating.value),
        text: document.getElementById('reviewText').value.trim()
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save review');

    state.productReviews = data.reviews || [];
    updateProductInState(data.product);
    renderProductModal();
    showToast(isUpdate ? 'Review updated' : 'Review submitted');
  } catch (err) {
    message.textContent = err.message;
    message.hidden = false;
  } finally {
    submit.disabled = false;
    submit.textContent = idleText;
  }
}

async function deleteProductReview(reviewId) {
  try {
    const res = await fetch('/api/products/' + encodeURIComponent(state.currentProduct.id) + '/reviews/' + encodeURIComponent(reviewId), {
      method: 'DELETE',
      headers: authHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not delete review');
    state.productReviews = data.reviews || [];
    updateProductInState(data.product);
    renderProductModal();
    showToast('Review removed');
  } catch (err) {
    showToast(err.message || 'Could not delete review');
  }
}

function addCurrentToCart() {
  const p = state.currentProduct;
  const sel = state.pmSelection;

  const existing = state.cart.find(i => i.productId === p.id && i.size === sel.size && i.color === sel.color);

  if (existing) existing.qty += sel.qty;
  else state.cart.push({ productId: p.id, size: sel.size, color: sel.color, qty: sel.qty });

  saveCart();
  showToast(`Added ${p.name} to your bag`);
  toggleOverlay('productOverlay', false);
}

async function renderCart() {
  const wrap = document.getElementById('cartItems');

  if (!state.cart.length) {
    wrap.innerHTML = `
      <div class="empty-state empty-state-compact cart-empty">
        ${emptyStateContent(
          'cart',
          'Your cart is empty',
          'Explore the collection and add something you love.',
          '<button class="btn btn-primary empty-state-button" type="button" data-continue-shopping>Continue Shopping</button>'
        )}
      </div>
    `;
    wrap.querySelector('[data-continue-shopping]').addEventListener('click', () => {
      toggleOverlay('cartOverlay', false);
      document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, { once: true });
    document.getElementById('checkoutBtn').disabled = true;
    updateCartTotals(0);
    return;
  }

  document.getElementById('checkoutBtn').disabled = false;

  const details = await Promise.all(state.cart.map(i => fetch('/api/products/' + i.productId).then(r => r.json())));

  wrap.innerHTML = state.cart.map((item, idx) => {
    const p = details[idx];

    return `
      <div class="cart-item" data-idx="${idx}">
        <img src="${p.images[0]}" alt="${p.name}" loading="lazy" decoding="async" />
        <div class="cart-item-info">
          <span class="cart-item-name">${p.name}</span>
          <span class="cart-item-meta">${item.size ? item.size + ' · ' : ''}${item.color || ''}</span>
          <div class="cart-item-row">
            <div class="cart-item-qty">
              <button class="qty-minus">−</button>
              <span>${item.qty}</span>
              <button class="qty-plus">+</button>
            </div>
            <span class="cart-item-price">${rupee(p.price * item.qty)}</span>
          </div>
          <button class="cart-item-remove">Remove</button>
        </div>
      </div>
    `;
  }).join('');

  let subtotal = 0;
  state.cart.forEach((item, idx) => subtotal += details[idx].price * item.qty);
  updateCartTotals(subtotal);

  wrap.querySelectorAll('.cart-item').forEach(el => {
    const idx = Number(el.dataset.idx);

    el.querySelector('.qty-plus').addEventListener('click', () => {
      state.cart[idx].qty += 1;
      saveCart();
      renderCart();
    });

    el.querySelector('.qty-minus').addEventListener('click', () => {
      state.cart[idx].qty = Math.max(1, state.cart[idx].qty - 1);
      saveCart();
      renderCart();
    });

    el.querySelector('.cart-item-remove').addEventListener('click', () => {
      state.cart.splice(idx, 1);
      saveCart();
      renderCart();
    });
  });
}

function updateCartTotals(subtotal) {
  const shipping = subtotal > 0 && subtotal < 1499 ? 79 : 0;
  document.getElementById('cartSubtotal').textContent = rupee(subtotal);
  document.getElementById('cartShipping').textContent = shipping ? rupee(shipping) : 'Free';
  document.getElementById('cartTotal').textContent = rupee(subtotal + shipping);
}

document.getElementById('cartToggle').addEventListener('click', () => {
  renderCart();
  toggleOverlay('cartOverlay', true);
});

document.getElementById('cartClose').addEventListener('click', () => toggleOverlay('cartOverlay', false));

let checkoutPayment = 'cod';
let checkoutCoupon = null;

function renderCheckoutForm() {
  checkoutPayment = 'cod';
  checkoutCoupon = null;

  document.getElementById('checkoutBody').innerHTML = `
    <div class="checkout-body">
      <h3>Checkout</h3>
      <p class="muted" style="color:var(--ink-soft);font-size:0.85rem;margin-bottom:10px;">All amounts in Indian Rupees (₹). Delivery available pan-India.</p>

      <form id="checkoutForm">
        <div class="checkout-grid">
          <label>Full name<input type="text" id="ckName" required /></label>
          <label>Phone number<input type="tel" id="ckPhone" pattern="[0-9]{10}" required placeholder="10-digit mobile" /></label>
        </div>

        <div class="field-full">
          <label>Email for invoice<input type="email" id="ckEmail" required placeholder="you@example.com" /></label>
        </div>

        <div class="field-full">
          <label>Delivery address<textarea id="ckAddress" rows="2" required></textarea></label>
        </div>

        <div class="checkout-grid">
          <label>City<input type="text" id="ckCity" /></label>
          <label>State<input type="text" id="ckState" /></label>
        </div>

        <div class="checkout-grid">
          <label>Pincode<input type="text" id="ckPincode" pattern="[0-9]{6}" required placeholder="6-digit pincode" /></label>
        </div>

        <div class="pm-field">
          <label>Payment method</label>
          <div class="payment-options">
            <button type="button" class="payment-option selected" data-pay="cod">💵 Cash on Delivery</button>
            <button type="button" class="payment-option" data-pay="upi">📱 UPI</button>
            <button type="button" class="payment-option" data-pay="razorpay">Online Payment</button>
          </div>
        </div>

        <div class="coupon-box">
          <label>Coupon code</label>
          <div class="coupon-row">
            <input type="text" id="couponCode" placeholder="Enter coupon code" />
            <button class="btn btn-ghost" type="button" id="applyCouponBtn">Apply</button>
          </div>
          <p class="coupon-message" id="couponMessage" hidden></p>
        </div>

        <div class="order-summary" id="orderSummary"></div>

        <button class="btn btn-primary btn-block" type="submit">Place order</button>
        <p class="checkout-error" id="checkoutError" hidden></p>
      </form>
    </div>
  `;

  renderOrderSummary();

  document.querySelectorAll('.payment-option').forEach(btn => {
    btn.addEventListener('click', () => {
      checkoutPayment = btn.dataset.pay;
      document.querySelectorAll('.payment-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  document.getElementById('checkoutForm').addEventListener('submit', submitOrder);
  document.getElementById('applyCouponBtn').addEventListener('click', () => {
    if (checkoutCoupon) removeCoupon();
    else applyCoupon();
  });
  document.getElementById('couponCode').addEventListener('input', () => {
    checkoutCoupon = null;
    document.getElementById('couponMessage').hidden = true;
    document.getElementById('applyCouponBtn').textContent = 'Apply';
    renderOrderSummary();
  });
}

async function renderOrderSummary() {
  const details = await Promise.all(state.cart.map(i => fetch('/api/products/' + i.productId).then(r => r.json())));
  let subtotal = 0;

  const rows = state.cart.map((item, idx) => {
    const p = details[idx];
    subtotal += p.price * item.qty;
    return `<div class="cart-line"><span>${p.name} × ${item.qty}</span><span>${rupee(p.price * item.qty)}</span></div>`;
  }).join('');

  const shipping = subtotal < 1499 ? 79 : 0;
  const discount = checkoutCoupon ? Number(checkoutCoupon.discountAmount || 0) : 0;

  document.getElementById('orderSummary').innerHTML =
    rows +
    `<div class="cart-line"><span>Shipping</span><span>${shipping ? rupee(shipping) : 'Free'}</span></div>
     ${discount ? `<div class="cart-line discount-line"><span>Coupon ${checkoutCoupon.code}</span><span>- ${rupee(discount)}</span></div>` : ''}
     <div class="cart-line cart-total"><span>Total</span><span>${rupee(subtotal + shipping - discount)}</span></div>`;
}

async function calculateCartSubtotal() {
  const details = await Promise.all(state.cart.map(i => fetch('/api/products/' + i.productId).then(r => r.json())));
  return state.cart.reduce((sum, item, idx) => sum + details[idx].price * item.qty, 0);
}

async function applyCoupon() {
  const codeInput = document.getElementById('couponCode');
  const message = document.getElementById('couponMessage');
  const button = document.getElementById('applyCouponBtn');
  const code = codeInput.value.trim();
  message.hidden = true;

  if (!code) {
    checkoutCoupon = null;
    renderOrderSummary();
    return;
  }

  button.disabled = true;
  button.textContent = 'Checking...';

  try {
    const subtotal = await calculateCartSubtotal();
    const res = await fetch('/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotal })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Coupon could not be applied');
    checkoutCoupon = data;
    codeInput.value = data.code;
    codeInput.readOnly = true;
    button.textContent = 'Remove Coupon';
    message.textContent = `Coupon applied. You saved ${rupee(data.discountAmount)}.`;
    message.className = 'coupon-message success';
    message.hidden = false;
    renderOrderSummary();
  } catch (err) {
    checkoutCoupon = null;
    codeInput.readOnly = false;
    message.textContent = err.message;
    message.className = 'coupon-message error';
    message.hidden = false;
    renderOrderSummary();
  } finally {
    button.disabled = false;
    button.textContent = checkoutCoupon ? 'Remove Coupon' : 'Apply';
  }
}

function removeCoupon() {
  const codeInput = document.getElementById('couponCode');
  const message = document.getElementById('couponMessage');
  const button = document.getElementById('applyCouponBtn');

  checkoutCoupon = null;
  codeInput.value = '';
  codeInput.readOnly = false;
  button.textContent = 'Apply';
  message.hidden = true;
  renderOrderSummary();
  showToast('Coupon removed');
}

function buildCheckoutPayload() {
  return {
    items: state.cart,
    couponCode: checkoutCoupon?.code || document.getElementById('couponCode')?.value.trim() || '',
    customer: {
      name: document.getElementById('ckName').value.trim(),
      phone: document.getElementById('ckPhone').value.trim(),
      email: document.getElementById('ckEmail').value.trim(),
      address: document.getElementById('ckAddress').value.trim(),
      city: document.getElementById('ckCity').value.trim(),
      state: document.getElementById('ckState').value.trim(),
      pincode: document.getElementById('ckPincode').value.trim(),
      paymentMethod: checkoutPayment
    }
  };
}

async function createCodOrUpiOrder(payload) {
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

async function createRazorpayOrder(payload) {
  const res = await fetch('/api/payments/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not start online payment');
  return data;
}

async function verifyRazorpayPayment(response) {
  const res = await fetch('/api/payments/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(response)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Payment verification failed');
  return data;
}

function payWithRazorpay(payload) {
  if (!window.Razorpay) {
    return Promise.reject(new Error('Online payment is unavailable. Please try again.'));
  }

  return createRazorpayOrder(payload).then(({ keyId, razorpayOrder, order }) => {
    return new Promise((resolve, reject) => {
      const checkout = new window.Razorpay({
        key: keyId,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        name: 'Nehal Express',
        description: `Order ${order.id}`,
        order_id: razorpayOrder.id,
        prefill: {
          name: payload.customer.name,
          contact: payload.customer.phone
        },
        notes: {
          nehalOrderId: order.id
        },
        theme: {
          color: '#7B2331'
        },
        handler: async (response) => {
          try {
            const verifiedOrder = await verifyRazorpayPayment(response);
            resolve(verifiedOrder);
          } catch (err) {
            reject(err);
          }
        },
        modal: {
          ondismiss: () => reject(new Error('Payment cancelled. Your cart is still saved.'))
        }
      });

      checkout.on('payment.failed', (response) => {
        reject(new Error(response.error?.description || 'Payment failed. Please try again.'));
      });

      checkout.open();
    });
  });
}

async function submitOrder(e) {
  e.preventDefault();

  const errorEl = document.getElementById('checkoutError');
  errorEl.hidden = true;

  const payload = buildCheckoutPayload();

  const submitBtn = e.target.querySelector('button[type=submit]');
  submitBtn.disabled = true;
  submitBtn.textContent = checkoutPayment === 'razorpay' ? 'Opening payment…' : 'Placing order…';

  try {
    const data = checkoutPayment === 'razorpay'
      ? await payWithRazorpay(payload)
      : await createCodOrUpiOrder(payload);

    state.cart = [];
    saveCart();
    renderOrderSuccess(data);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Place order';
  }
}

function renderOrderSuccess(order) {
  document.getElementById('checkoutBody').innerHTML = `
    <div class="checkout-body order-success">
      <div class="big-check">✓</div>
      <h3>Order placed successfully</h3>
      <p class="success-copy">Thank you, ${order.customer.name}. Your order has been confirmed and will be delivered to ${order.customer.address}.</p>
      <div class="success-order-box">
        <span>Order ID</span>
        <strong>${order.id}</strong>
      </div>
      <p style="color:var(--ink-soft);font-size:0.85rem;">Payment: ${order.paymentMethod} · Total: ${rupee(order.total)}</p>
      <div class="success-actions">
        <a class="btn btn-primary btn-block" href="/profile#orders">View My Orders</a>
        <button class="btn btn-ghost btn-block" id="closeSuccessBtn">Continue shopping</button>
      </div>
    </div>
  `;

  document.getElementById('closeSuccessBtn').addEventListener('click', () => {
    toggleOverlay('checkoutOverlay', false);
  });
}

document.getElementById('checkoutBtn').addEventListener('click', () => {
  if (!state.cart.length) return;
  toggleOverlay('cartOverlay', false);
  renderCheckoutForm();
  toggleOverlay('checkoutOverlay', true);
});

document.getElementById('checkoutClose').addEventListener('click', () => toggleOverlay('checkoutOverlay', false));

document.getElementById('trackOrderBtn').addEventListener('click', () => {
  document.getElementById('trackResult').innerHTML = '';
  document.getElementById('trackForm').reset();
  toggleOverlay('trackOverlay', true);
});

document.getElementById('trackClose').addEventListener('click', () => toggleOverlay('trackOverlay', false));

document.getElementById('trackForm').addEventListener('submit', async e => {
  e.preventDefault();

  const id = document.getElementById('trackOrderId').value.trim();
  const phone = document.getElementById('trackPhone').value.trim();
  const resultEl = document.getElementById('trackResult');

  resultEl.innerHTML = '<p class="muted">Looking up your order…</p>';

  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(id)}?phone=${encodeURIComponent(phone)}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Order not found');

    resultEl.innerHTML = renderOrderCard(data);
  } catch (err) {
    resultEl.innerHTML = `<p style="color:var(--oxblood);font-size:0.85rem;">${err.message}</p>`;
  }
});

// ---------------- MY PROFILE / ORDER HISTORY ----------------
///// ---------------- profile dropdown ----------------
const profileBtn = document.getElementById('profileBtn');
const profileDropdown = document.getElementById('profileDropdown');

profileBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const open = profileDropdown.classList.toggle('open');
  profileBtn.setAttribute('aria-expanded', String(open));
});

document.addEventListener('click', () => {
  profileDropdown.classList.remove('open');
  profileBtn.setAttribute('aria-expanded', 'false');
});

profileDropdown.addEventListener('click', (e) => {
  e.stopPropagation();
});

document.getElementById('profileOrdersBtn').addEventListener('click', () => {
  profileDropdown.classList.remove('open');
  profileBtn.setAttribute('aria-expanded', 'false');
  document.getElementById('profileOrders').innerHTML = '';
  document.getElementById('profileForm').reset();
  toggleOverlay('profileOverlay', true);
});

document.getElementById('profileDetailsBtn').addEventListener('click', () => {
  profileDropdown.classList.remove('open');
  profileBtn.setAttribute('aria-expanded', 'false');
  window.location.href = '/profile';
});

const profileWishlistBtn = document.getElementById('profileWishlistBtn') ||
  Array.from(profileDropdown.querySelectorAll('.profile-menu-item')).find((button) => button.textContent.includes('Wishlist'));

if (profileWishlistBtn) {
  profileWishlistBtn.addEventListener('click', () => {
    profileDropdown.classList.remove('open');
    profileBtn.setAttribute('aria-expanded', 'false');
    window.location.href = '/profile#wishlist';
  });
}
document.getElementById('profileClose').addEventListener('click', () => {
  toggleOverlay('profileOverlay', false);
});

document.getElementById('profileForm').addEventListener('submit', async e => {
  e.preventDefault();

  const phone = document.getElementById('profilePhone').value.trim();
  const box = document.getElementById('profileOrders');

  box.innerHTML = '<p class="muted">Loading your order history…</p>';

  try {
    const res = await fetch(`/api/customer/orders?phone=${encodeURIComponent(phone)}`);
    const orders = await res.json();

    if (!res.ok) throw new Error(orders.error || 'Could not load orders');

    if (!orders.length) {
      box.innerHTML = '<p style="color:var(--ink-soft);font-size:0.9rem;">No orders found for this phone number.</p>';
      return;
    }

    box.innerHTML = `
      <div class="profile-summary">
        <strong>${orders.length}</strong>
        <span>${orders.length === 1 ? 'order found' : 'orders found'}</span>
      </div>
      ${orders.map(order => renderOrderCard(order)).join('')}
    `;
  } catch (err) {
    box.innerHTML = `<p style="color:var(--oxblood);font-size:0.85rem;">${err.message}</p>`;
  }
});

function renderOrderCard(order) {
  return `
    <div class="profile-order-card reveal-on-scroll">
      <div class="track-status-row">
        <strong>Order ${order.id}</strong>
        <span class="status-pill ${order.status}">${order.status}</span>
      </div>

      ${order.items.map(item => `
        <div class="track-status-row">
          <span>${item.name} × ${item.qty}</span>
          <span>${rupee(item.lineTotal)}</span>
        </div>
      `).join('')}

      <div class="track-status-row">
        <span>Total</span>
        <strong>${rupee(order.total)}</strong>
      </div>

      <div class="track-status-row">
        <span>Payment</span>
        <span>${order.paymentMethod}</span>
      </div>

      <div class="track-status-row">
        <span>Date</span>
        <span>${new Date(order.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        })}</span>
      </div>
    </div>
  `;
}

function toggleOverlay(id, open) {
  const el = document.getElementById(id);
  el.classList.toggle('open', open);
  el.setAttribute('aria-hidden', String(!open));
  document.body.style.overflow = open ? 'hidden' : '';
}

['productOverlay', 'cartOverlay', 'checkoutOverlay', 'trackOverlay', 'profileOverlay'].forEach(overlayId => {
  document.getElementById(overlayId).addEventListener('click', e => {
    if (e.target.id === overlayId) toggleOverlay(overlayId, false);
  });
});

document.getElementById('productModalClose').addEventListener('click', () => toggleOverlay('productOverlay', false));

function showToast(msg, type = 'info') {
  if (window.NehalAnimations) {
    window.NehalAnimations.showToast(msg, type, { duration: 2200 });
    return;
  }

  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

async function openRequestedProductFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('product');
  if (!productId) return;

  document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  await openProductModal(productId);

  params.delete('product');
  const nextQuery = params.toString();
  const nextUrl = window.location.pathname + (nextQuery ? '?' + nextQuery : '') + window.location.hash;
  window.history.replaceState({}, '', nextUrl);
}

window.addEventListener('offline', () => {
  showToast("You're offline. Some features may be unavailable.", 'error');
});

window.addEventListener('online', () => {
  showToast("You're back online.", 'success');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        let updateLogged = false;
        const logUpdate = () => {
          if (updateLogged) return;
          updateLogged = true;
          console.info('[Nehal Express] Update available.');
        };

        if (registration.waiting) logUpdate();
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;

          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              logUpdate();
            }
          });
        }, { once: true });
      })
      .catch((err) => {
        console.warn('[Nehal Express] Service worker registration failed:', err);
      });
  }, { once: true });
}

document.querySelector('.nav-link[data-category="all"]').classList.add('active');
productEmptyText = document.getElementById('emptyState')?.textContent || '';
document.getElementById('categoryStrip').addEventListener('click', handleCategoryStripClick);
document.getElementById('productGrid').addEventListener('click', handleProductGridClick);
window.NehalAnimations?.init();
prepareStaticReveals();
observeReveals();
renderCartCount();
renderWishlistCount();
loadCategories().catch((err) => {
  console.warn('[Nehal Express] Category loading failed:', err);
});
loadProducts().then(async (isCurrent) => {
  if (!isCurrent) return;
  await loadWishlist();
  await openRequestedProductFromUrl();
}).catch((err) => {
  console.warn('[Nehal Express] Storefront initialization failed:', err);
});
