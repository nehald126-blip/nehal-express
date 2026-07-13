// ============================================================
// Nehal Express — Admin dashboard logic
// ============================================================
const adminState = {
  token: localStorage.getItem('ne_admin_token') || null,
  categories: [],
  products: [],
  orders: [],
  coupons: [],
  productImages: []
};

const rupee = (n) => '₹' + Number(n).toLocaleString('en-IN');
function observeReveals(root = document) {
  if (window.NehalAnimations) {
    window.NehalAnimations.observeReveals(root, { stagger: 30, maxDelay: 150 });
  }
}

function authHeaders() {
  return { Authorization: 'Bearer ' + adminState.token, 'Content-Type': 'application/json' };
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
  if (res.status === 401) {
    logout();
    throw new Error('Session expired, please log in again');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function uploadProductImage(file) {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch('/api/admin/upload-image', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + adminState.token },
    body: formData
  });

  if (res.status === 401) {
    logout();
    throw new Error('Session expired, please log in again');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Image upload failed');
  return data;
}

// ---------------- auth ----------------
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('loginError');
  errorEl.hidden = true;
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    adminState.token = data.token;
    localStorage.setItem('ne_admin_token', data.token);
    showDashboard();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
});

function logout() {
  adminState.token = null;
  localStorage.removeItem('ne_admin_token');
  document.getElementById('adminShell').hidden = true;
  document.getElementById('loginScreen').style.display = 'flex';
}
document.getElementById('logoutBtn').addEventListener('click', async () => {
  try {
    await apiFetch('/api/admin/logout', { method: 'POST' });
  } catch (_err) {
    // Local logout must still proceed if the server request fails.
  }
  logout();
});

async function showDashboard() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminShell').hidden = false;
  await Promise.all([loadCategories(), loadOverview(), loadProducts(), loadOrders(), loadCoupons()]);
}

// ---------------- nav ----------------
document.querySelectorAll('.admin-nav-link').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-nav-link').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.admin-view').forEach((v) => (v.hidden = true));
    document.getElementById('view-' + btn.dataset.view).hidden = false;
  });
});

// ---------------- categories ----------------
async function loadCategories() {
  const res = await fetch('/api/categories');
  adminState.categories = await res.json();
  const select = document.getElementById('pfCategory');
  select.innerHTML = adminState.categories.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
}
function categoryName(id) {
  const c = adminState.categories.find((c) => c.id === id);
  return c ? c.name : id;
}

function setBusy(el, busy) {
  if (!el) return;
  if (busy) el.setAttribute('aria-busy', 'true');
  else el.setAttribute('aria-busy', 'false');
}

function setCardSkeletons(id, count, className, options = {}) {
  const el = document.getElementById(id);
  if (!el || !window.NehalAnimations) return;

  setBusy(el, true);
  el.innerHTML = window.NehalAnimations.createCardSkeletons(count, {
    className,
    lines: options.lines || ['medium', 'short']
  });
}

function setTableSkeleton(tableSelector, columns, rows = 4) {
  const tbody = document.querySelector(`${tableSelector} tbody`);
  if (!tbody || !window.NehalAnimations) return;

  setBusy(tbody, true);
  tbody.innerHTML = window.NehalAnimations.createTableSkeletonRows(columns, rows);
}

function finishLoading(el) {
  window.NehalAnimations?.clearSkeletons(el);
}

function adminEmptyRow(columns, title, text) {
  return `
    <tr>
      <td colspan="${columns}">
        <div class="empty-state empty-state-compact admin-empty-state">
          <span class="empty-state-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="m4 7 8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10"/>
            </svg>
          </span>
          <h3 class="empty-state-title">${title}</h3>
          <p class="empty-state-text">${text}</p>
        </div>
      </td>
    </tr>
  `;
}

function showOverviewSkeletons() {
  setCardSkeletons('revenueStatGrid', 4, 'stat-card admin-skeleton-card');
  setCardSkeletons('orderStatGrid', 5, 'stat-card admin-skeleton-card');
  setCardSkeletons('productStatGrid', 6, 'stat-card admin-skeleton-card');
  ['paymentMethodBreakdown', 'paymentStatusBreakdown', 'bestSellingProducts', 'lowStockAlerts'].forEach((id) => {
    setCardSkeletons(id, 3, 'analytics-row admin-analytics-skeleton', {
      lines: ['medium', 'short']
    });
  });
  setTableSkeleton('#recentOrdersTable', 6, 3);
  setTableSkeleton('#recentPaidOrdersTable', 5, 3);
}

// ---------------- overview ----------------
function renderStatGrid(id, cards) {
  const el = document.getElementById(id);
  finishLoading(el);
  el.innerHTML = cards
    .map((card) => `
      <div class="stat-card reveal-on-scroll">
        <div class="stat-label">${card.label}</div>
        <div class="stat-value ${card.warn ? 'warn' : ''}">${card.value}</div>
      </div>
    `)
    .join('');
  observeReveals(el);
}

function renderBreakdown(id, breakdown) {
  const entries = Object.entries(breakdown || {});
  const el = document.getElementById(id);
  finishLoading(el);
  el.innerHTML = entries.length
    ? entries.map(([label, value]) => `
      <div class="analytics-row reveal-on-scroll">
        <span>${label}</span>
        <strong>${value}</strong>
      </div>
    `).join('')
    : '<p class="analytics-empty">No data yet</p>';
  observeReveals(el);
}

function renderProductList(id, products, emptyText) {
  const el = document.getElementById(id);
  finishLoading(el);
  el.innerHTML = products && products.length
    ? products.map((product) => `
      <div class="analytics-row reveal-on-scroll">
        <span>${product.name}</span>
        <strong>${product.qty != null ? product.qty + ' sold' : product.stock + ' left'}</strong>
      </div>
    `).join('')
    : `<p class="analytics-empty">${emptyText}</p>`;
  observeReveals(el);
}

async function loadOverview() {
  showOverviewSkeletons();
  try {
    const stats = await apiFetch('/api/admin/stats');
    renderStatGrid('revenueStatGrid', [
      { label: 'Total revenue', value: rupee(stats.totalRevenue) },
      { label: 'Today', value: rupee(stats.todayRevenue) },
      { label: 'Last 7 days', value: rupee(stats.weekRevenue) },
      { label: 'This month', value: rupee(stats.monthRevenue) }
    ]);
    renderStatGrid('orderStatGrid', [
      { label: 'Total orders', value: stats.totalOrders },
      { label: 'Today', value: stats.todayOrders },
      { label: 'Pending', value: stats.pendingOrders, warn: stats.pendingOrders > 0 },
      { label: 'Delivered', value: stats.deliveredOrders },
      { label: 'Cancelled', value: stats.cancelledOrders, warn: stats.cancelledOrders > 0 }
    ]);
    renderStatGrid('productStatGrid', [
      { label: 'Products listed', value: stats.totalProducts },
      { label: 'Low stock', value: (stats.lowStockProducts || []).length, warn: (stats.lowStockProducts || []).length > 0 },
      { label: 'Out of stock', value: (stats.outOfStockProducts || []).length, warn: (stats.outOfStockProducts || []).length > 0 },
      { label: 'Customers', value: stats.totalCustomers },
      { label: 'Active coupons', value: stats.activeCoupons },
      { label: 'Coupon uses', value: stats.couponUsageCount },
      { label: 'Discount given', value: rupee(stats.totalDiscountGiven) }
    ]);
    renderBreakdown('paymentMethodBreakdown', stats.paymentMethodBreakdown);
    renderBreakdown('paymentStatusBreakdown', stats.paymentStatusBreakdown);
    renderProductList('bestSellingProducts', stats.bestSellingProducts, 'No sales yet');
    renderProductList('lowStockAlerts', stats.lowStockProducts, 'No low-stock products');

    const tbody = document.querySelector('#recentOrdersTable tbody');
    finishLoading(tbody);
    tbody.innerHTML = stats.recentOrders
      .map(
        (o) => `
      <tr class="reveal-on-scroll">
        <td>${o.id}</td>
        <td>${o.customer.name}</td>
        <td>${o.items.reduce((s, i) => s + i.qty, 0)} item(s)</td>
        <td>${rupee(o.total)}</td>
        <td>${o.status}</td>
        <td>${new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
      </tr>`
      )
      .join('') || adminEmptyRow(6, 'No recent orders', 'New customer orders will appear here.');

    const paidTbody = document.querySelector('#recentPaidOrdersTable tbody');
    finishLoading(paidTbody);
    paidTbody.innerHTML = stats.recentPaidOrders
      .map(
        (o) => `
      <tr class="reveal-on-scroll">
        <td>${o.id}</td>
        <td>${o.customer.name}</td>
        <td>${rupee(o.total)}</td>
        <td>${o.paymentMethod}</td>
        <td>${new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
      </tr>`
      )
      .join('') || adminEmptyRow(5, 'No paid orders yet', 'Completed payments will appear here.');
    observeReveals(tbody);
    observeReveals(paidTbody);
  } catch (err) {
    ['revenueStatGrid', 'orderStatGrid', 'productStatGrid', 'paymentMethodBreakdown', 'paymentStatusBreakdown', 'bestSellingProducts', 'lowStockAlerts'].forEach((id) => {
      finishLoading(document.getElementById(id));
    });
    const tbody = document.querySelector('#recentOrdersTable tbody');
    const paidTbody = document.querySelector('#recentPaidOrdersTable tbody');
    finishLoading(tbody);
    finishLoading(paidTbody);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--ink-soft);">Could not load recent orders</td></tr>';
    paidTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--ink-soft);">Could not load paid orders</td></tr>';
    showToast(err.message);
  }
}

// ---------------- products ----------------
async function loadProducts() {
  setTableSkeleton('#productsTable', 7, 5);
  try {
    adminState.products = await apiFetch('/api/admin/products');
    const tbody = document.querySelector('#productsTable tbody');
    finishLoading(tbody);
    tbody.innerHTML = adminState.products
      .map(
        (p) => `
      <tr class="reveal-on-scroll" data-id="${p.id}">
        <td><img src="${p.images[0]}" alt="" loading="lazy" decoding="async" /></td>
        <td>${p.name}</td>
        <td>${categoryName(p.category)}</td>
        <td>${rupee(p.price)}</td>
        <td class="${p.stock <= 5 ? 'stock-low' : ''}">${p.stock}</td>
        <td>★ ${p.rating.toFixed(1)}</td>
        <td>
          <div class="row-actions">
            <button class="edit-btn">Edit</button>
            <button class="danger delete-btn">Delete</button>
          </div>
        </td>
      </tr>`
      )
      .join('') || adminEmptyRow(7, 'No products listed', 'Add your first product to begin building the catalogue.');
    tbody.querySelectorAll('tr').forEach((row) => {
      const id = row.dataset.id;
      if (!id) return;
      row.querySelector('.edit-btn').addEventListener('click', () => openProductForm(id));
      row.querySelector('.delete-btn').addEventListener('click', () => deleteProduct(id));
    });
    observeReveals(tbody);
  } catch (err) {
    const tbody = document.querySelector('#productsTable tbody');
    finishLoading(tbody);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--ink-soft);">Could not load products</td></tr>';
    showToast(err.message);
  }
}

function openProductForm(id) {
  document.getElementById('productFormError').hidden = true;
  const form = document.getElementById('productForm');
  form.reset();
  adminState.productImages = [];
  if (id) {
    const p = adminState.products.find((p) => p.id === id);
    document.getElementById('productFormTitle').textContent = 'Edit product';
    document.getElementById('pfId').value = p.id;
    document.getElementById('pfName').value = p.name;
    document.getElementById('pfCategory').value = p.category;
    document.getElementById('pfPrice').value = p.price;
    document.getElementById('pfMrp').value = p.mrp;
    document.getElementById('pfStock').value = p.stock;
    document.getElementById('pfImage').value = p.images[0] || '';
    adminState.productImages = [...(p.images || [])];
    document.getElementById('pfSizes').value = p.sizes.join(', ');
    document.getElementById('pfColors').value = p.colors.join(', ');
    document.getElementById('pfDescription').value = p.description;
  } else {
    document.getElementById('productFormTitle').textContent = 'Add product';
    document.getElementById('pfId').value = '';
  }
  renderProductImagePreview();
  toggleOverlay('productFormOverlay', true);
}

document.getElementById('addProductBtn').addEventListener('click', () => openProductForm(null));
document.getElementById('productFormClose').addEventListener('click', () => toggleOverlay('productFormOverlay', false));

function addProductImageUrl(url) {
  const cleanUrl = String(url || '').trim();
  if (!cleanUrl) return false;
  if (!adminState.productImages.includes(cleanUrl)) {
    adminState.productImages.push(cleanUrl);
    renderProductImagePreview();
  }
  return true;
}

function getProductImagesForSave() {
  const typedUrl = document.getElementById('pfImage').value;
  if (typedUrl) addProductImageUrl(typedUrl);
  return [...adminState.productImages];
}

function renderProductImagePreview() {
  const preview = document.getElementById('productImagePreview');
  preview.innerHTML = adminState.productImages.length
    ? adminState.productImages
        .map(
          (url, index) => `
            <div class="image-preview-item">
              <img src="${url}" alt="" decoding="async" />
              <button type="button" class="image-remove-btn" data-index="${index}" aria-label="Remove image">&times;</button>
            </div>
          `
        )
        .join('')
    : '<p class="image-preview-empty">No images selected</p>';

  preview.querySelectorAll('.image-remove-btn').forEach((button) => {
    button.addEventListener('click', () => {
      adminState.productImages.splice(Number(button.dataset.index), 1);
      renderProductImagePreview();
    });
  });
}

document.getElementById('addImageUrlBtn').addEventListener('click', () => {
  const input = document.getElementById('pfImage');
  if (addProductImageUrl(input.value)) input.value = '';
});

document.getElementById('uploadImageBtn').addEventListener('click', () => {
  document.getElementById('pfImageUpload').click();
});

document.getElementById('pfImageUpload').addEventListener('change', async (event) => {
  const input = event.target;
  const files = Array.from(input.files || []);
  const errorEl = document.getElementById('productFormError');
  errorEl.hidden = true;
  if (!files.length) return;

  try {
    for (const file of files) {
      if (!file.type.startsWith('image/')) throw new Error('Only image files are allowed');
      if (file.size > 5 * 1024 * 1024) throw new Error('Image must be 5MB or smaller');
    }

    document.getElementById('uploadImageBtn').disabled = true;
    for (const file of files) {
      const uploaded = await uploadProductImage(file);
      addProductImageUrl(uploaded.secure_url);
    }
    showToast(files.length === 1 ? 'Image uploaded' : 'Images uploaded');
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  } finally {
    document.getElementById('uploadImageBtn').disabled = false;
    input.value = '';
  }
});

document.getElementById('productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('productFormError');
  errorEl.hidden = true;
  const id = document.getElementById('pfId').value;
  const payload = {
    name: document.getElementById('pfName').value.trim(),
    category: document.getElementById('pfCategory').value,
    price: Number(document.getElementById('pfPrice').value),
    mrp: Number(document.getElementById('pfMrp').value || document.getElementById('pfPrice').value),
    stock: Number(document.getElementById('pfStock').value),
    images: getProductImagesForSave(),
    sizes: document.getElementById('pfSizes').value,
    colors: document.getElementById('pfColors').value,
    description: document.getElementById('pfDescription').value.trim()
  };
  try {
    if (id) {
      await apiFetch('/api/admin/products/' + id, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Product updated');
    } else {
      await apiFetch('/api/admin/products', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Product added');
    }
    toggleOverlay('productFormOverlay', false);
    loadProducts();
    loadOverview();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
});

async function deleteProduct(id) {
  if (!confirm('Delete this product? This cannot be undone.')) return;
  try {
    await apiFetch('/api/admin/products/' + id, { method: 'DELETE' });
    showToast('Product deleted');
    loadProducts();
    loadOverview();
  } catch (err) {
    showToast(err.message);
  }
}

// ---------------- orders ----------------
async function loadOrders() {
  setTableSkeleton('#ordersTable', 8, 5);
  try {
    const filter = document.getElementById('orderStatusFilter').value;
    adminState.orders = await apiFetch('/api/admin/orders?status=' + filter);
    const tbody = document.querySelector('#ordersTable tbody');
    const statuses = ['Placed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];
    finishLoading(tbody);
    tbody.innerHTML = adminState.orders
      .map(
        (o) => `
      <tr class="reveal-on-scroll" data-id="${o.id}">
        <td>${o.id}</td>
        <td>${o.customer.name}<br><span style="color:var(--ink-soft);font-size:0.78rem;">${o.customer.address}, ${o.customer.city} ${o.customer.pincode}</span></td>
        <td>${o.customer.phone}</td>
        <td>${o.items.map((i) => `${i.name} (${i.qty})`).join(', ')}</td>
        <td>${rupee(o.total)}</td>
        <td>${o.paymentMethod}</td>
        <td>
          <select class="status-select">
            ${statuses.map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
        <td>${new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
      </tr>`
      )
      .join('') || adminEmptyRow(8, 'No orders found', 'No orders match the selected status filter.');

    tbody.querySelectorAll('tr').forEach((row) => {
      const id = row.dataset.id;
      const select = row.querySelector('.status-select');
      if (select) {
        select.addEventListener('change', async () => {
          try {
            await apiFetch(`/api/admin/orders/${id}/status`, {
              method: 'PATCH',
              body: JSON.stringify({ status: select.value })
            });
            showToast(`Order ${id} marked as ${select.value}`);
            loadOverview();
          } catch (err) {
            showToast(err.message);
          }
        });
      }
    });
    observeReveals(tbody);
  } catch (err) {
    const tbody = document.querySelector('#ordersTable tbody');
    finishLoading(tbody);
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--ink-soft);">Could not load orders</td></tr>';
    showToast(err.message);
  }
}
document.getElementById('orderStatusFilter').addEventListener('change', loadOrders);

// ---------------- coupons ----------------
function couponValue(coupon) {
  return coupon.type === 'percentage' ? `${coupon.value}%` : rupee(coupon.value);
}

function couponDate(value) {
  return value ? new Date(value).toLocaleDateString('en-IN') : 'No expiry';
}

async function loadCoupons() {
  setTableSkeleton('#couponsTable', 9, 4);
  try {
    adminState.coupons = await apiFetch('/api/admin/coupons');
    const tbody = document.querySelector('#couponsTable tbody');
    finishLoading(tbody);
    tbody.innerHTML = adminState.coupons
      .map((coupon) => `
        <tr class="reveal-on-scroll" data-id="${coupon.id}">
          <td>${coupon.code}</td>
          <td>${coupon.type}</td>
          <td>${couponValue(coupon)}</td>
          <td>${rupee(coupon.minOrderAmount || 0)}</td>
          <td>${coupon.maxDiscount != null ? rupee(coupon.maxDiscount) : '-'}</td>
          <td>${coupon.usedCount || 0}${coupon.usageLimit != null ? ' / ' + coupon.usageLimit : ''}</td>
          <td>${couponDate(coupon.expiryDate)}</td>
          <td>${coupon.isActive ? 'Active' : 'Inactive'}</td>
          <td>
            <div class="row-actions">
              <button class="edit-coupon-btn">Edit</button>
              <button class="danger delete-coupon-btn">Delete</button>
            </div>
          </td>
        </tr>
      `).join('') || adminEmptyRow(9, 'No coupons found', 'Create a coupon when you are ready to run a promotion.');

    tbody.querySelectorAll('tr').forEach((row) => {
      const id = row.dataset.id;
      if (!id) return;
      row.querySelector('.edit-coupon-btn').addEventListener('click', () => openCouponForm(id));
      row.querySelector('.delete-coupon-btn').addEventListener('click', () => deleteCoupon(id));
    });
    observeReveals(tbody);
  } catch (err) {
    const tbody = document.querySelector('#couponsTable tbody');
    finishLoading(tbody);
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--ink-soft);">Could not load coupons</td></tr>';
    showToast(err.message);
  }
}

function openCouponForm(id) {
  document.getElementById('couponFormError').hidden = true;
  const form = document.getElementById('couponForm');
  form.reset();
  document.getElementById('cfIsActive').checked = true;

  if (id) {
    const coupon = adminState.coupons.find((item) => item.id === id);
    document.getElementById('couponFormTitle').textContent = 'Edit coupon';
    document.getElementById('cfId').value = coupon.id;
    document.getElementById('cfCode').value = coupon.code;
    document.getElementById('cfType').value = coupon.type;
    document.getElementById('cfValue').value = coupon.value;
    document.getElementById('cfMinOrder').value = coupon.minOrderAmount || 0;
    document.getElementById('cfMaxDiscount').value = coupon.maxDiscount ?? '';
    document.getElementById('cfUsageLimit').value = coupon.usageLimit ?? '';
    document.getElementById('cfExpiryDate').value = coupon.expiryDate ? coupon.expiryDate.slice(0, 10) : '';
    document.getElementById('cfIsActive').checked = !!coupon.isActive;
  } else {
    document.getElementById('couponFormTitle').textContent = 'Add coupon';
    document.getElementById('cfId').value = '';
  }

  toggleOverlay('couponFormOverlay', true);
}

document.getElementById('addCouponBtn').addEventListener('click', () => openCouponForm(null));
document.getElementById('couponFormClose').addEventListener('click', () => toggleOverlay('couponFormOverlay', false));

document.getElementById('couponForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const errorEl = document.getElementById('couponFormError');
  errorEl.hidden = true;
  const id = document.getElementById('cfId').value;
  const payload = {
    code: document.getElementById('cfCode').value.trim(),
    type: document.getElementById('cfType').value,
    value: Number(document.getElementById('cfValue').value),
    minOrderAmount: Number(document.getElementById('cfMinOrder').value || 0),
    maxDiscount: document.getElementById('cfMaxDiscount').value,
    usageLimit: document.getElementById('cfUsageLimit').value,
    expiryDate: document.getElementById('cfExpiryDate').value,
    isActive: document.getElementById('cfIsActive').checked
  };

  try {
    if (id) {
      await apiFetch('/api/admin/coupons/' + id, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Coupon updated');
    } else {
      await apiFetch('/api/admin/coupons', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Coupon created');
    }
    toggleOverlay('couponFormOverlay', false);
    loadCoupons();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
});

async function deleteCoupon(id) {
  if (!confirm('Delete this coupon?')) return;
  try {
    await apiFetch('/api/admin/coupons/' + id, { method: 'DELETE' });
    showToast('Coupon deleted');
    loadCoupons();
  } catch (err) {
    showToast(err.message);
  }
}

// ---------------- helpers ----------------
function toggleOverlay(id, open) {
  const el = document.getElementById(id);
  el.classList.toggle('open', open);
  el.setAttribute('aria-hidden', String(!open));
  document.body.style.overflow = open ? 'hidden' : '';
}
document.getElementById('productFormOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'productFormOverlay') toggleOverlay('productFormOverlay', false);
});
document.getElementById('couponFormOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'couponFormOverlay') toggleOverlay('couponFormOverlay', false);
});

function showToast(msg) {
  if (window.NehalAnimations) {
    window.NehalAnimations.showToast(msg, 'info');
    return;
  }

  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
}

// ---------------- init ----------------
window.NehalAnimations?.init();

if (adminState.token) {
  showDashboard().catch(() => logout());
} else {
  document.getElementById('loginScreen').style.display = 'flex';
}
