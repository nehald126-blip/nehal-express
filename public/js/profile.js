const TOKEN_KEY = 'ne_auth_token';
const USER_KEY = 'ne_auth_user';

const state = {
  token: localStorage.getItem(TOKEN_KEY),
  user: null,
  addresses: [],
  orders: [],
  wishlist: []
};

const rupee = (n) => 'Rs ' + Number(n || 0).toLocaleString('en-IN');
const orderStatuses = ['Placed', 'Packed', 'Shipped', 'Delivered'];
function observeReveals(root = document) {
  if (window.NehalAnimations) {
    window.NehalAnimations.observeReveals(root);
  }
}

function prepareStaticReveals() {
  if (window.NehalAnimations) {
    window.NehalAnimations.prepareReveals('.section-head, .help-card, .delete-account-card');
  }
}

function authHeaders() {
  return {
    Authorization: 'Bearer ' + state.token,
    'Content-Type': 'application/json'
  };
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(state.token ? authHeaders() : { 'Content-Type': 'application/json' }),
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    clearSession();
    showAuth();
  }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function setSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  state.token = null;
  state.user = null;
  state.addresses = [];
  state.orders = [];
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function resetAuthSuccess() {
  const authBox = document.querySelector('.auth-box');
  const successCard = document.getElementById('authSuccessCard');

  authBox?.classList.remove('is-completing');
  if (successCard) successCard.hidden = true;
  document.querySelectorAll('.auth-tab').forEach((button) => {
    button.disabled = false;
  });
}

function setFormProcessing(form, processing, loadingText) {
  if (!form) return;

  form.querySelectorAll('input, button').forEach((control) => {
    if (processing) {
      control.dataset.wasDisabled = control.disabled ? 'true' : 'false';
      control.disabled = true;
    } else {
      control.disabled = control.dataset.wasDisabled === 'true';
      delete control.dataset.wasDisabled;
    }
  });

  const submitButton = form.querySelector('button[type="submit"]');
  if (!submitButton) return;

  if (processing) {
    submitButton.dataset.originalText = submitButton.textContent;
    submitButton.textContent = loadingText;
    submitButton.classList.add('is-loading');
  } else {
    submitButton.textContent = submitButton.dataset.originalText || submitButton.textContent;
    delete submitButton.dataset.originalText;
    submitButton.classList.remove('is-loading');
  }
}

function showAuthSuccess(mode) {
  const copy = {
    login: {
      kicker: 'Signed in',
      title: 'Welcome back',
      text: 'Taking you to your profile dashboard.'
    },
    signup: {
      kicker: 'Account created successfully',
      title: 'Welcome to Nehal Express',
      text: 'Your account is ready. Taking you to My Account.'
    }
  }[mode];

  document.querySelector('.auth-box')?.classList.add('is-completing');
  document.querySelectorAll('.auth-tab').forEach((button) => {
    button.disabled = true;
  });
  document.getElementById('authSuccessKicker').textContent = copy.kicker;
  document.getElementById('authSuccessTitle').textContent = copy.title;
  document.getElementById('authSuccessText').textContent = copy.text;
  document.getElementById('authSuccessCard').hidden = false;
  document.getElementById('authMessage').hidden = true;
}

async function completeAuthFlow(mode) {
  showAuthSuccess(mode);
  const [loaded] = await Promise.all([
    loadAccount({ reveal: false }),
    delay(1400)
  ]);

  if (loaded) showAccount();
  return loaded;
}

function showAuth() {
  document.getElementById('authPanel').hidden = false;
  document.getElementById('accountShell').hidden = true;
  resetAuthSuccess();
}

function showAccount() {
  document.getElementById('authPanel').hidden = true;
  document.getElementById('accountShell').hidden = false;
}

function showMessage(id, text, type = 'error') {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = 'form-message ' + type;
  el.hidden = false;
}

function showToast(message) {
  if (window.NehalAnimations) {
    window.NehalAnimations.showToast(message, 'info');
    return;
  }

  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
}

function initials(name) {
  return String(name || 'NE')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function statusClass(value) {
  return String(value || '').replace(/[^a-z0-9_-]/gi, '');
}

function profileEmptyState(icon, title, text, action) {
  const icons = {
    address: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    orders: '<path d="m4 7 8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10"/>',
    wishlist: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>'
  };

  return `
    <div class="empty-state empty-state-compact">
      <span class="empty-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[icon]}</svg>
      </span>
      <h3 class="empty-state-title">${title}</h3>
      <p class="empty-state-text">${text}</p>
      <div class="empty-state-actions">${action}</div>
    </div>
  `;
}

function setBusy(el, busy) {
  if (!el) return;
  if (busy) el.setAttribute('aria-busy', 'true');
  else el.setAttribute('aria-busy', 'false');
}

function finishLoading(el) {
  window.NehalAnimations?.clearSkeletons(el);
}

function setCardSkeletons(id, count, className, options = {}) {
  const list = document.getElementById(id);
  if (!list || !window.NehalAnimations) return;

  setBusy(list, true);
  list.innerHTML = window.NehalAnimations.createCardSkeletons(count, {
    className,
    thumb: options.thumb,
    lines: options.lines || ['medium', 'short', 'short']
  });
}

function clearAccountLoading() {
  ['addressList', 'orderList', 'wishlistList'].forEach((id) => {
    finishLoading(document.getElementById(id));
  });
}

function resetAccountForLoading() {
  state.user = null;
  state.addresses = [];
  state.orders = [];
  state.wishlist = [];

  document.getElementById('sidebarName').textContent = 'Customer';
  document.getElementById('accountAvatar').textContent = 'NE';
  document.getElementById('profileName').value = '';
  document.getElementById('profileEmail').value = '';
  document.getElementById('profilePhone').value = '';
  document.getElementById('statusOrderSelect').innerHTML = '';
  document.getElementById('statusPanel').innerHTML = '';

  setCardSkeletons('addressList', 2, 'address-card account-skeleton-card');
  setCardSkeletons('orderList', 3, 'order-card account-skeleton-card', {
    lines: ['medium', 'medium', 'short', 'short']
  });
  setCardSkeletons('wishlistList', 4, 'wishlist-card wishlist-skeleton-card', {
    thumb: true,
    lines: ['medium', 'short']
  });
}

async function loadAccount({ reveal = true } = {}) {
  if (!state.token) {
    showAuth();
    return false;
  }

  resetAccountForLoading();
  if (reveal) showAccount();

  try {
    const [{ user }, addressData, orderData, wishlistData] = await Promise.all([
      apiFetch('/api/profile'),
      apiFetch('/api/profile/addresses'),
      apiFetch('/api/profile/orders'),
      apiFetch('/api/profile/wishlist')
    ]);

    state.user = user;
    state.addresses = addressData.addresses || [];
    state.orders = orderData.orders || [];
    state.wishlist = wishlistData.wishlist || [];
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    renderAccount();
    observeReveals();
    const hashSection = window.location.hash.replace('#', '');
    if (hashSection) switchSection(hashSection);
    return true;
  } catch (err) {
    showMessage('authMessage', err.message);
    return false;
  } finally {
    clearAccountLoading();
  }
}

function renderAccount() {
  const user = state.user || {};
  document.getElementById('sidebarName').textContent = user.name || 'Customer';
  document.getElementById('accountAvatar').textContent = initials(user.name);
  document.getElementById('profileName').value = user.name || '';
  document.getElementById('profileEmail').value = user.email || '';
  document.getElementById('profilePhone').value = user.phone || '';
  renderAddresses();
  renderOrders();
  renderWishlist();
  renderStatusTools();
}

function renderAddresses() {
  const list = document.getElementById('addressList');
  finishLoading(list);

  if (!state.addresses.length) {
    list.innerHTML = profileEmptyState(
      'address',
      'No saved addresses',
      'Add your home or work address for faster checkout.',
      '<button class="btn btn-primary empty-state-button" type="button" data-add-first-address>Add Address</button>'
    );
    list.querySelector('[data-add-first-address]').addEventListener('click', () => {
      document.getElementById('newAddressBtn').click();
    }, { once: true });
    return;
  }

  list.innerHTML = state.addresses.map((addr) => `
    <article class="address-card reveal-on-scroll">
      <div class="address-card-head">
        <h3>${escapeHtml(addr.label || 'Home')}</h3>
        ${addr.isDefault ? '<span class="default-pill">Default</span>' : ''}
      </div>
      <p><strong>${escapeHtml(addr.name)}</strong> - ${escapeHtml(addr.phone)}</p>
      <p>${escapeHtml(addr.address)}</p>
      <p>${escapeHtml(addr.city)} ${escapeHtml(addr.state)} ${escapeHtml(addr.pincode)}</p>
      <div class="mini-actions">
        <button type="button" data-edit-address="${escapeHtml(addr.id)}">Edit</button>
        <button type="button" class="danger" data-delete-address="${escapeHtml(addr.id)}">Delete</button>
      </div>
    </article>
  `).join('');

  list.querySelectorAll('[data-edit-address]').forEach((button) => {
    button.addEventListener('click', () => openAddressForm(button.dataset.editAddress));
  });
  list.querySelectorAll('[data-delete-address]').forEach((button) => {
    button.addEventListener('click', () => deleteAddress(button.dataset.deleteAddress));
  });
  observeReveals(list);
}

function orderDate(order) {
  if (!order.createdAt) return '';
  return new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function orderDateTime(value) {
  if (!value) return 'Not paid yet';
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function renderOrderCard(order) {
  const itemCount = (order.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const previewItems = (order.items || []).slice(0, 2);
  const remaining = Math.max((order.items || []).length - previewItems.length, 0);

  return `
    <article class="order-card reveal-on-scroll">
      <div class="order-card-head">
        <div>
          <h3>Order ${escapeHtml(order.id)}</h3>
          <p>${escapeHtml(orderDate(order))} - ${escapeHtml(itemCount)} ${itemCount === 1 ? 'item' : 'items'}</p>
        </div>
        <span class="status-pill ${statusClass(order.status)}">${escapeHtml(order.status)}</span>
      </div>
      <div class="order-meta-grid">
        <span><small>Payment</small><strong>${escapeHtml(order.paymentStatus || 'Pending')}</strong></span>
        <span><small>Status</small><strong>${escapeHtml(order.status || 'Placed')}</strong></span>
        <span><small>Total</small><strong>${rupee(order.total)}</strong></span>
      </div>
      <div class="order-items compact">
        ${previewItems.map((item) => `
          <div class="order-row">
            <span>${escapeHtml(item.name)} x ${escapeHtml(item.qty)}</span>
            <strong>${rupee(item.lineTotal)}</strong>
          </div>
        `).join('')}
        ${remaining ? `<div class="order-row"><span>More products</span><strong>+${remaining}</strong></div>` : ''}
      </div>
      <div class="order-card-actions">
        <button type="button" data-order-detail="${escapeHtml(order.id)}">View details</button>
      </div>
    </article>
  `;
}

function renderOrders() {
  const list = document.getElementById('orderList');
  finishLoading(list);
  if (!state.orders.length) {
    list.innerHTML = profileEmptyState(
      'orders',
      'No orders yet',
      'Your Nehal Express orders will appear here after checkout.',
      '<a class="btn btn-primary empty-state-button" href="/#catalog">Start Shopping</a>'
    );
    return;
  }
  list.innerHTML = state.orders.map(renderOrderCard).join('');
  list.querySelectorAll('[data-order-detail]').forEach((button) => {
    button.addEventListener('click', () => openOrderDetail(button.dataset.orderDetail));
  });
  observeReveals(list);
}

function renderStatusTools() {
  const select = document.getElementById('statusOrderSelect');
  if (!state.orders.length) {
    select.innerHTML = '<option value="">No orders found</option>';
    document.getElementById('statusPanel').innerHTML = '<div class="empty-panel"><strong>No active orders</strong><span>Place an order to track packing, shipping, and delivery here.</span></div>';
    return;
  }

  select.innerHTML = state.orders.map((order) => `<option value="${escapeHtml(order.id)}">${escapeHtml(order.id)} - ${escapeHtml(order.status)}</option>`).join('');
  renderSelectedStatus();
}

function renderSelectedStatus() {
  const id = document.getElementById('statusOrderSelect').value;
  const order = state.orders.find((item) => item.id === id) || state.orders[0];
  const panel = document.getElementById('statusPanel');

  if (!order) return;

  const activeIndex = order.status === 'Cancelled' ? -1 : orderStatuses.indexOf(order.status);

  panel.innerHTML = `
    <div class="status-card reveal-on-scroll">
      <div class="order-card-head">
        <div>
          <h3>Order ${escapeHtml(order.id)}</h3>
          <p>${escapeHtml(orderDate(order))} - Total ${rupee(order.total)}</p>
        </div>
        <span class="status-pill ${statusClass(order.status)}">${escapeHtml(order.status)}</span>
      </div>
      <div class="status-row"><span>Delivery address</span><strong>${escapeHtml(order.customer?.city || '')} ${escapeHtml(order.customer?.pincode || '')}</strong></div>
      <div class="status-steps">
        ${orderStatuses.map((step, index) => `<span class="status-step ${index <= activeIndex ? 'active' : ''}">${step}</span>`).join('')}
      </div>
    </div>
  `;
  observeReveals(panel);
}

async function openOrderDetail(id) {
  const modal = document.getElementById('orderDetailModal');
  const body = document.getElementById('orderDetailBody');
  modal.hidden = false;
  body.innerHTML = '<div class="empty-panel"><strong>Loading order</strong><span>Fetching your order details securely.</span></div>';

  try {
    const data = await apiFetch('/api/profile/orders/' + encodeURIComponent(id));
    renderOrderDetail(data.order);
  } catch (err) {
    body.innerHTML = `<div class="empty-panel"><strong>Could not load order</strong><span>${escapeHtml(err.message)}</span></div>`;
  }
}

function closeOrderDetail() {
  document.getElementById('orderDetailModal').hidden = true;
}

function renderOrderDetail(order) {
  const body = document.getElementById('orderDetailBody');
  body.innerHTML = `
    <div class="detail-head">
      <div>
        <p class="account-kicker">Order Details</p>
        <h2 id="orderDetailTitle">Order ${escapeHtml(order.id)}</h2>
        <span>${escapeHtml(orderDate(order))}</span>
      </div>
      <span class="status-pill ${statusClass(order.status)}">${escapeHtml(order.status)}</span>
    </div>

    <div class="detail-summary">
      <span><small>Payment method</small><strong>${escapeHtml(order.paymentMethod)}</strong></span>
      <span><small>Payment status</small><strong>${escapeHtml(order.paymentStatus)}</strong></span>
      <span><small>Total</small><strong>${rupee(order.total)}</strong></span>
      <span><small>Paid at</small><strong>${escapeHtml(orderDateTime(order.paidAt))}</strong></span>
      <span><small>Invoice</small><strong>${escapeHtml(order.invoiceNumber || 'Ready on download')}</strong></span>
    </div>

    <div class="detail-actions">
      <button class="btn btn-primary" type="button" data-download-invoice="${escapeHtml(order.id)}">Download Invoice</button>
    </div>

    <div class="detail-block">
      <h3>Products</h3>
      <div class="order-items">
        ${(order.items || []).map((item) => `
          <div class="order-row detail-item">
            <span>
              <strong>${escapeHtml(item.name)}</strong>
              <small>${escapeHtml([item.size, item.color].filter(Boolean).join(' - '))}</small>
            </span>
            <span>${escapeHtml(item.qty)} x ${rupee(item.price)}</span>
            <strong>${rupee(item.lineTotal)}</strong>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="detail-grid">
      <div class="detail-block">
        <h3>Customer</h3>
        <p><strong>${escapeHtml(order.customer?.name || '')}</strong></p>
        <p>${escapeHtml(order.customer?.phone || '')}</p>
        <p>${escapeHtml(order.customer?.address || '')}</p>
        <p>${escapeHtml(order.customer?.city || '')} ${escapeHtml(order.customer?.state || '')} ${escapeHtml(order.customer?.pincode || '')}</p>
      </div>
      <div class="detail-block">
        <h3>Totals</h3>
        <div class="order-row"><span>Subtotal</span><strong>${rupee(order.subtotal)}</strong></div>
        <div class="order-row"><span>Shipping</span><strong>${order.shipping ? rupee(order.shipping) : 'Free'}</strong></div>
        ${order.discountAmount ? `<div class="order-row"><span>Coupon ${escapeHtml(order.couponCode || '')}</span><strong>- ${rupee(order.discountAmount)}</strong></div>` : ''}
        <div class="order-row grand-total"><span>Total</span><strong>${rupee(order.total)}</strong></div>
      </div>
    </div>
  `;

  body.querySelector('[data-download-invoice]').addEventListener('click', (event) => {
    downloadInvoice(order.id, event.currentTarget);
  });
}

async function downloadInvoice(id, button) {
  const originalText = button?.textContent || 'Download Invoice';
  if (button) {
    button.disabled = true;
    button.textContent = 'Downloading...';
  }

  try {
    const res = await fetch('/api/profile/orders/' + encodeURIComponent(id) + '/invoice', {
      headers: state.token ? { Authorization: 'Bearer ' + state.token } : {}
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Invoice is not ready yet. Please try again in a moment.');
    }

    const blob = await res.blob();
    if (!blob.size) {
      throw new Error('Invoice download was empty. Please try again.');
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = id + '-invoice.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Invoice downloaded');
  } catch (err) {
    showToast(err.message || 'Could not download invoice. Please try again.');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

function openAddressForm(id) {
  const form = document.getElementById('addressForm');
  form.hidden = false;
  form.reset();

  const address = state.addresses.find((item) => item.id === id);
  document.getElementById('addressId').value = address ? address.id : '';
  document.getElementById('addressLabel').value = address?.label || '';
  document.getElementById('addressName').value = address?.name || state.user?.name || '';
  document.getElementById('addressPhone').value = address?.phone || state.user?.phone || '';
  document.getElementById('addressLine').value = address?.address || '';
  document.getElementById('addressPincode').value = address?.pincode || '';
  document.getElementById('addressCity').value = address?.city || '';
  document.getElementById('addressState').value = address?.state || '';
  document.getElementById('addressDefault').checked = !!address?.isDefault;
}

function closeAddressForm() {
  document.getElementById('addressForm').hidden = true;
  document.getElementById('addressForm').reset();
  document.getElementById('addressId').value = '';
}

async function refreshAddresses() {
  setCardSkeletons('addressList', 2, 'address-card account-skeleton-card');
  try {
    const data = await apiFetch('/api/profile/addresses');
    state.addresses = data.addresses || [];
    renderAddresses();
  } finally {
    finishLoading(document.getElementById('addressList'));
  }
}

async function refreshOrders() {
  setCardSkeletons('orderList', 3, 'order-card account-skeleton-card', {
    lines: ['medium', 'medium', 'short', 'short']
  });
  try {
    const data = await apiFetch('/api/profile/orders');
    state.orders = data.orders || [];
    renderOrders();
    renderStatusTools();
  } finally {
    finishLoading(document.getElementById('orderList'));
  }
}

async function refreshWishlist() {
  setCardSkeletons('wishlistList', 4, 'wishlist-card wishlist-skeleton-card', {
    thumb: true,
    lines: ['medium', 'short']
  });
  try {
    const data = await apiFetch('/api/profile/wishlist');
    state.wishlist = data.wishlist || [];
    renderWishlist();
  } finally {
    finishLoading(document.getElementById('wishlistList'));
  }
}

function renderWishlist() {
  const list = document.getElementById('wishlistList');
  if (!list) return;
  finishLoading(list);

  if (!state.wishlist.length) {
    list.innerHTML = profileEmptyState(
      'wishlist',
      'Your wishlist is empty',
      'Tap the heart on any product to save it here for later.',
      '<a class="btn btn-primary empty-state-button" href="/#catalog">Browse Products</a>'
    );
    return;
  }

  list.innerHTML = state.wishlist.map((product) => `
    <article class="wishlist-card reveal-on-scroll" data-wishlist-product="${escapeHtml(product.id)}">
      <div class="wishlist-thumb">
        <img src="${escapeHtml(product.images?.[0] || '')}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async" />
      </div>
      <div class="wishlist-info">
        <span>${escapeHtml(product.category || '')}</span>
        <h3>${escapeHtml(product.name)}</h3>
        <strong>${rupee(product.price)}</strong>
      </div>
      <button type="button" class="wishlist-remove" data-remove-wishlist="${escapeHtml(product.id)}" aria-label="Remove from wishlist">&hearts;</button>
    </article>
  `).join('');

  list.querySelectorAll('[data-wishlist-product]').forEach((card) => {
    card.addEventListener('click', () => openWishlistProduct(card.dataset.wishlistProduct));
  });

  list.querySelectorAll('[data-remove-wishlist]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      await removeWishlistItem(button.dataset.removeWishlist);
    });
  });
  observeReveals(list);
}

async function removeWishlistItem(productId) {
  const previous = [...state.wishlist];
  state.wishlist = state.wishlist.filter((product) => product.id !== productId);
  renderWishlist();

  try {
    await apiFetch('/api/profile/wishlist/' + encodeURIComponent(productId), { method: 'DELETE' });
    showToast('Removed from Wishlist');
  } catch (err) {
    state.wishlist = previous;
    renderWishlist();
    showToast(err.message || 'Could not update Wishlist');
  }
}

async function openWishlistProduct(productId) {
  const modal = document.getElementById('wishlistProductModal');
  const body = document.getElementById('wishlistProductBody');
  modal.hidden = false;
  body.innerHTML = '<div class="empty-panel"><strong>Loading product</strong><span>Opening your saved style.</span></div>';

  try {
    const res = await fetch('/api/products/' + encodeURIComponent(productId));
    const product = await res.json();
    if (!res.ok) throw new Error(product.error || 'Product not found');
    renderWishlistProductModal(product);
  } catch (err) {
    body.innerHTML = `<div class="empty-panel"><strong>Could not load product</strong><span>${escapeHtml(err.message)}</span></div>`;
  }
}

function renderWishlistProductModal(product) {
  const body = document.getElementById('wishlistProductBody');
  body.innerHTML = `
    <div class="wishlist-product-detail">
      <div class="wishlist-product-image">
        <img src="${escapeHtml(product.images?.[0] || '')}" alt="${escapeHtml(product.name)}" decoding="async" />
      </div>
      <div class="wishlist-product-copy">
        <p class="account-kicker">${escapeHtml(product.category || 'Product')}</p>
        <h2 id="wishlistProductTitle">${escapeHtml(product.name)}</h2>
        <div class="pm-price-row">
          <span>${rupee(product.price)}</span>
          ${product.mrp > product.price ? `<span class="pm-mrp">${rupee(product.mrp)}</span>` : ''}
        </div>
        <p>${escapeHtml(product.description || '')}</p>
        <button class="btn btn-primary" type="button" data-view-shop-product="${escapeHtml(product.id)}">View in shop</button>
      </div>
    </div>
  `;

  body.querySelector('[data-view-shop-product]').addEventListener('click', (event) => {
    const productId = event.currentTarget.dataset.viewShopProduct;
    closeWishlistProduct();
    window.location.href = '/?product=' + encodeURIComponent(productId) + '#catalog';
  });
}

function closeWishlistProduct() {
  document.getElementById('wishlistProductModal').hidden = true;
}

async function deleteAddress(id) {
  if (!confirm('Delete this address?')) return;
  await apiFetch('/api/profile/addresses/' + encodeURIComponent(id), { method: 'DELETE' });
  showToast('Address deleted');
  await refreshAddresses();
}

function switchSection(section) {
  document.querySelectorAll('.account-nav-item').forEach((button) => {
    button.classList.toggle('active', button.dataset.section === section);
  });
  document.querySelectorAll('.account-section').forEach((panel) => {
    panel.classList.toggle('active', panel.id === 'section-' + section);
  });
  document.getElementById('pageTitle').textContent =
    document.querySelector(`[data-section="${section}"]`)?.textContent || 'My Account';
  observeReveals(document.getElementById('section-' + section));
}

document.querySelectorAll('.auth-tab').forEach((button) => {
  button.addEventListener('click', () => {
    const tab = button.dataset.authTab;
    document.querySelectorAll('.auth-tab').forEach((item) => item.classList.toggle('active', item === button));
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    loginForm.hidden = tab !== 'login';
    signupForm.hidden = tab !== 'signup';
    forgotPasswordForm.hidden = true;
    loginForm.classList.toggle('is-active', tab === 'login');
    signupForm.classList.toggle('is-active', tab === 'signup');
    forgotPasswordForm.classList.remove('is-active');
    document.getElementById('authMessage').hidden = true;
  });
});

function showForgotPasswordForm() {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const forgotPasswordForm = document.getElementById('forgotPasswordForm');
  const resetEmail = document.getElementById('resetEmail');
  const loginEmail = document.getElementById('loginEmail');

  document.querySelectorAll('.auth-tab').forEach((item) => item.classList.remove('active'));
  loginForm.hidden = true;
  signupForm.hidden = true;
  forgotPasswordForm.hidden = false;
  loginForm.classList.remove('is-active');
  signupForm.classList.remove('is-active');
  forgotPasswordForm.classList.add('is-active');
  document.getElementById('authMessage').hidden = true;

  if (resetEmail && loginEmail?.value) resetEmail.value = loginEmail.value.trim();
  resetEmail?.focus();
}

function showLoginForm() {
  const loginTab = document.querySelector('[data-auth-tab="login"]');
  loginTab?.click();
}

document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  setFormProcessing(form, true, 'Logging in...');
  try {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: document.getElementById('loginEmail').value.trim(),
        password: document.getElementById('loginPassword').value
      })
    });
    setSession(data.token, data.user);
    if (await completeAuthFlow('login')) showToast('Welcome back');
  } catch (err) {
    showMessage('authMessage', err.message);
  } finally {
    setFormProcessing(form, false);
  }
});

document.getElementById('forgotPasswordBtn').addEventListener('click', showForgotPasswordForm);
document.getElementById('backToLoginBtn').addEventListener('click', showLoginForm);

document.getElementById('sendResetOtpBtn').addEventListener('click', async () => {
  const email = document.getElementById('resetEmail').value.trim();
  const button = document.getElementById('sendResetOtpBtn');

  if (!email) {
    showMessage('authMessage', 'Email is required');
    return;
  }

  button.disabled = true;
  button.textContent = 'Sending...';

  try {
    await apiFetch('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    document.getElementById('resetFields').hidden = false;
    document.getElementById('resetOtp').value = '';
    document.getElementById('resetNewPassword').value = '';
    showMessage('authMessage', 'If the email exists, a reset OTP has been sent.', 'success');
  } catch (err) {
    showMessage('authMessage', err.message || 'Could not send reset OTP');
  } finally {
    button.disabled = false;
    button.textContent = 'Send reset OTP';
  }
});

document.getElementById('forgotPasswordForm').addEventListener('submit', async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const email = document.getElementById('resetEmail').value.trim();
  const otp = (document.getElementById('resetOtp').value || '').trim();
  const newPassword = document.getElementById('resetNewPassword').value;

  if (!/^\d{6}$/.test(otp)) {
    showMessage('authMessage', 'OTP must be a 6-digit number');
    return;
  }

  setFormProcessing(form, true, 'Updating password...');

  try {
    await apiFetch('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        email,
        otp,
        newPassword
      })
    });
    form.reset();
    document.getElementById('resetFields').hidden = true;
    showLoginForm();
    showMessage('authMessage', 'Password updated. Please login with your new password.', 'success');
  } catch (err) {
    showMessage('authMessage', err.message || 'Could not update password');
  } finally {
    setFormProcessing(form, false);
  }
});

let signupState = {
  otpVerified: false,
  lastOtpEmail: '',
  sendActive: false,
  verifyActive: false
};

function setSignupOtpVerified(verified) {
  signupState.otpVerified = verified;
  const createBtn = document.getElementById('createAccountBtn');
  if (createBtn) createBtn.disabled = !verified;
}

function getSignupEmail() {
  return document.getElementById('signupEmail')?.value.trim() || '';
}

async function sendSignupOtp({ resend = false } = {}) {
  if (signupState.sendActive) return;
  const email = getSignupEmail();
  if (!email) {
    throw new Error('Email is required');
  }

  const sendBtn = resend ? document.getElementById('resendSignupOtpBtn') : document.getElementById('sendSignupOtpBtn');
  signupState.sendActive = true;
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = resend ? 'Resending…' : 'Sending…';
  }

  try {
    const data = await apiFetch('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({
        email,
        type: 'EMAIL_VERIFY'
      })
    });

    if (!data.ok) throw new Error(data.error || 'Could not send OTP');

    document.getElementById('signupOtpField').hidden = false;
    setSignupOtpVerified(false);
    document.getElementById('signupOtp').value = '';
    document.getElementById('signupOtp').focus();

    showMessage('authMessage', resend ? 'OTP resent. Check your email.' : 'OTP sent. Check your email.', 'success');
  } finally {
    signupState.sendActive = false;
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = resend ? 'Resend OTP' : 'Send OTP';
    }
  }
}

async function verifySignupOtp() {
  if (signupState.verifyActive) return;
  const email = getSignupEmail();
  const otp = (document.getElementById('signupOtp')?.value || '').trim();

  if (!/^\d{6}$/.test(otp)) {
    throw new Error('OTP must be a 6-digit number');
  }

  const verifyBtn = document.getElementById('verifySignupOtpBtn');
  signupState.verifyActive = true;
  if (verifyBtn) {
    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Verifying…';
  }

  try {
    const data = await apiFetch('/api/auth/verify-email-otp', {
      method: 'POST',
      body: JSON.stringify({
        email,
        otp
      })
    });

    if (!data.ok) throw new Error(data.error || 'OTP verification failed');

    setSignupOtpVerified(true);
    showMessage('authMessage', 'Email verified successfully.', 'success');
  } finally {
    signupState.verifyActive = false;
    if (verifyBtn) {
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Verify OTP';
    }
  }
}

document.getElementById('signupForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;

  if (!signupState.otpVerified) {
    showMessage('authMessage', 'Please verify your email OTP before creating an account.');
    return;
  }

  setFormProcessing(form, true, 'Creating account...');
  try {
    const data = await apiFetch('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('signupName').value.trim(),
        email: document.getElementById('signupEmail').value.trim(),
        phone: document.getElementById('signupPhone').value.trim(),
        password: document.getElementById('signupPassword').value
      })
    });
    setSession(data.token, data.user);
    if (await completeAuthFlow('signup')) showToast('Account created');
  } catch (err) {
    showMessage('authMessage', err.message);
  } finally {
    setFormProcessing(form, false);
  }
});

document.getElementById('goAccountBtn').addEventListener('click', async () => {
  if (document.getElementById('profileEmail').value) {
    showAccount();
    return;
  }
  await loadAccount();
});

// Signup OTP wiring
document.getElementById('sendSignupOtpBtn').addEventListener('click', async () => {
  try {
    await sendSignupOtp({ resend: false });
  } catch (err) {
    showMessage('authMessage', err.message || 'Failed to send OTP');
  }
});

document.getElementById('resendSignupOtpBtn').addEventListener('click', async () => {
  try {
    await sendSignupOtp({ resend: true });
  } catch (err) {
    showMessage('authMessage', err.message || 'Failed to resend OTP');
  }
});

document.getElementById('verifySignupOtpBtn').addEventListener('click', async () => {
  try {
    await verifySignupOtp();
  } catch (err) {
    showMessage('authMessage', err.message || 'OTP verification failed');
    setSignupOtpVerified(false);
  }
});

// Reset OTP verification if email changes
document.getElementById('signupEmail').addEventListener('input', () => {
  setSignupOtpVerified(false);
});


document.querySelectorAll('.account-nav-item[data-section]').forEach((button) => {
  button.addEventListener('click', () => switchSection(button.dataset.section));
});

document.getElementById('profileForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const data = await apiFetch('/api/profile', {
      method: 'PUT',
      body: JSON.stringify({
        name: document.getElementById('profileName').value.trim(),
        email: document.getElementById('profileEmail').value.trim(),
        phone: document.getElementById('profilePhone').value.trim()
      })
    });
    state.user = data.user;
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    renderAccount();
    showToast('Profile updated');
  } catch (err) {
    showToast(err.message);
  }
});

document.getElementById('newAddressBtn').addEventListener('click', () => openAddressForm());
document.getElementById('cancelAddressBtn').addEventListener('click', closeAddressForm);

document.getElementById('addressForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = document.getElementById('addressId').value;
  const payload = {
    label: document.getElementById('addressLabel').value.trim(),
    name: document.getElementById('addressName').value.trim(),
    phone: document.getElementById('addressPhone').value.trim(),
    address: document.getElementById('addressLine').value.trim(),
    pincode: document.getElementById('addressPincode').value.trim(),
    city: document.getElementById('addressCity').value.trim(),
    state: document.getElementById('addressState').value.trim(),
    isDefault: document.getElementById('addressDefault').checked
  };

  try {
    await apiFetch('/api/profile/addresses' + (id ? '/' + encodeURIComponent(id) : ''), {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    });
    closeAddressForm();
    await refreshAddresses();
    showToast(id ? 'Address updated' : 'Address added');
  } catch (err) {
    showToast(err.message);
  }
});

document.getElementById('statusOrderSelect').addEventListener('change', renderSelectedStatus);
document.getElementById('statusRefreshBtn').addEventListener('click', async () => {
  await refreshOrders();
  showToast('Orders refreshed');
});

document.getElementById('orderDetailClose').addEventListener('click', closeOrderDetail);
document.getElementById('orderDetailModal').addEventListener('click', (event) => {
  if (event.target.id === 'orderDetailModal') closeOrderDetail();
});
document.getElementById('wishlistProductClose').addEventListener('click', closeWishlistProduct);
document.getElementById('wishlistProductModal').addEventListener('click', (event) => {
  if (event.target.id === 'wishlistProductModal') closeWishlistProduct();
});

document.getElementById('passwordForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const message = await apiFetch('/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({
        currentPassword: document.getElementById('currentPassword').value,
        newPassword: document.getElementById('newPassword').value,
        confirmPassword: document.getElementById('confirmPassword').value
      })
    });
    event.target.reset();
    showToast(message.message || 'Password changed');
  } catch (err) {
    showToast(err.message);
  }
});

document.getElementById('deleteAccountForm').addEventListener('submit', async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const confirmText = document.getElementById('deleteAccountConfirm').value.trim();

  if (confirmText.toUpperCase() !== 'DELETE') {
    showToast('Type DELETE to confirm account deletion');
    return;
  }
  if (!confirm('Delete your Nehal Express account permanently?')) return;

  setFormProcessing(form, true, 'Deleting...');

  try {
    const data = await apiFetch('/api/profile', {
      method: 'DELETE',
      body: JSON.stringify({
        password: document.getElementById('deleteAccountPassword').value,
        confirmText
      })
    });
    clearSession();
    form.reset();
    showAuth();
    showToast(data.message || 'Account deleted');
  } catch (err) {
    showToast(err.message || 'Could not delete account');
  } finally {
    setFormProcessing(form, false);
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  clearSession();
  showAuth();
  showToast('Logged out');
});

document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('mainNav').classList.toggle('open');
});

prepareStaticReveals();
window.NehalAnimations?.init();
loadAccount();
observeReveals();
