/**
 * CakeTalk Bakery Platform - Owner / Admin Dashboard Logic
 */

const AdminApp = {
  currentTab: 'analytics',
  currentUser: null,

  async init() {
    this.checkAuth();
    this.attachNavEvents();
    this.updateHeaderActions();
  },

  updateHeaderActions() {
    // Only display "+ Add Product" button in the header if it exists
    const addProductBtn = document.getElementById('adminHeaderAddProductBtn');
    if (addProductBtn) {
      addProductBtn.style.display = (this.currentTab === 'products') ? 'inline-flex' : 'none';
    }
  },

  updateUserSidebarProfile() {
    if (!this.currentUser) return;
    const nameEl = document.getElementById('sidebarAdminName') || document.querySelector('.admin-name');
    const roleEl = document.getElementById('sidebarAdminRole') || document.querySelector('.admin-role');
    const avatarEl = document.getElementById('sidebarAvatarCircle') || document.querySelector('.avatar-circle');
    
    if (nameEl && this.currentUser.name) {
      nameEl.textContent = this.currentUser.name;
    }
    if (roleEl) {
      roleEl.textContent = (this.currentUser.role === 'admin' || this.currentUser.role === 'owner')
        ? 'Owner • The Harsha Cake Talk'
        : 'Bakery Staff';
    }
    if (avatarEl && this.currentUser.name) {
      const parts = this.currentUser.name.split(' ').filter(Boolean);
      const initials = parts.map(p => p[0]).join('').slice(0, 2).toUpperCase();
      avatarEl.textContent = initials || 'HG';
    }
  },

  checkAuth() {
    const savedUser = localStorage.getItem('caketalk_user');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        if (u.role === 'admin' || u.role === 'owner') {
          this.currentUser = u;
          this.hideLoginOverlay();
          this.updateUserSidebarProfile();
          this.updateHeaderActions();
          this.loadCurrentTab();
          return;
        }
      } catch (e) {}
    }
    this.showLoginOverlay();
  },

  showLoginOverlay() {
    const overlay = document.getElementById('adminLoginOverlay');
    if (overlay) overlay.style.display = 'flex';
  },

  hideLoginOverlay() {
    const overlay = document.getElementById('adminLoginOverlay');
    if (overlay) overlay.style.display = 'none';
  },

  navEventsAttached: false,

  attachNavEvents() {
    if (this.navEventsAttached) return;
    this.navEventsAttached = true;

    // Tab switching
    document.querySelectorAll('[data-admin-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tabBtn = btn.closest('[data-admin-tab]');
        if (!tabBtn) return;
        document.querySelectorAll('.sidebar-nav-item').forEach(i => i.classList.remove('active'));
        const navItem = tabBtn.closest('.sidebar-nav-item');
        if (navItem) navItem.classList.add('active');
        this.currentTab = tabBtn.dataset.adminTab;
        this.switchTab(this.currentTab);
      });
    });

    // Admin Login Form
    const loginForm = document.getElementById('adminLoginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('adminEmailInput').value.trim();
        const password = document.getElementById('adminPasswordInput').value;
        const errorEl = document.getElementById('adminLoginError');

        try {
          const res = await API.login(email, password);
          if (res.success && (res.user.role === 'admin' || res.user.role === 'owner')) {
            this.currentUser = res.user;
            this.hideLoginOverlay();
            this.updateHeaderActions();
            this.loadCurrentTab();
          } else {
            if (errorEl) errorEl.textContent = 'Access denied: Admin credentials required.';
          }
        } catch (err) {
          if (errorEl) errorEl.textContent = err.message || 'Invalid credentials';
        }
      });
    }

    // Admin Logout
    document.getElementById('btnAdminLogout')?.addEventListener('click', () => {
      localStorage.removeItem('caketalk_token');
      localStorage.removeItem('caketalk_user');
      window.location.reload();
    });
  },

  switchTab(tabName) {
    document.querySelectorAll('.tab-content-panel').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`tab-${tabName}`);
    if (target) {
      target.classList.add('active');
      const titleEl = document.getElementById('adminHeaderTitle');
      if (titleEl) {
        const labels = {
          analytics: 'Analytics Overview',
          orders: 'Order Management',
          products: 'Products & Menu',
          inventory: 'Inventory & Pantry',
          customers: 'Customer Directory',
          coupons: 'Promotions & Deals',
          inquiries: 'Event Inquiries',
          pincodes: 'Delivery Pincodes & Service Zones'
        };
        titleEl.textContent = labels[tabName] || (tabName.charAt(0).toUpperCase() + tabName.slice(1));
      }
      this.updateHeaderActions();
      this.loadCurrentTab();
    }
  },

  async loadCurrentTab() {
    if (this.currentTab === 'analytics') {
      await this.loadAnalytics();
    } else if (this.currentTab === 'orders') {
      await this.loadOrders();
    } else if (this.currentTab === 'products') {
      await this.loadProducts();
    } else if (this.currentTab === 'inventory') {
      await this.loadInventory();
    } else if (this.currentTab === 'customers') {
      await this.loadCustomers();
    } else if (this.currentTab === 'coupons') {
      await this.loadCoupons();
    } else if (this.currentTab === 'inquiries') {
      await this.loadInquiries();
    } else if (this.currentTab === 'pincodes') {
      await this.loadPincodes();
    }
  },

  // 1. Analytics Tab
  async loadAnalytics() {
    try {
      const res = await API.getAnalytics();
      if (!res.success) return;
      const data = res.analytics;

      document.getElementById('kpiRevenue').textContent = `₹${data.total_revenue.toLocaleString('en-IN')}`;
      document.getElementById('kpiOrders').textContent = data.total_orders;
      const aovEl = document.getElementById('kpiAOV');
      if (aovEl) aovEl.textContent = `₹${data.avg_order_value.toFixed(0)}`;
      const custEl = document.getElementById('kpiCustomers');
      if (custEl) custEl.textContent = data.total_customers;

      // Status pill counts
      const statusContainer = document.getElementById('kpiOrderStatusStrip');
      if (statusContainer && data.status_counts) {
        statusContainer.innerHTML = Object.entries(data.status_counts).map(([st, cnt]) => `
          <div style="background: #fff; padding: 12px 18px; border-radius: 8px; border: 1px solid #E2E8F0; text-align: center;">
            <div style="font-size: 0.75rem; color: #718096; text-transform: uppercase; font-weight: 700;">${st}</div>
            <div style="font-size: 1.4rem; font-weight: 800; color: #1A202C;">${cnt}</div>
          </div>
        `).join('');
      }

      // Category breakdown
      const catList = document.getElementById('analyticsCategoryList');
      if (catList && data.categories) {
        catList.innerHTML = data.categories.map(c => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #EDF2F7; font-size: 0.88rem;">
            <span style="font-weight: 600;">${c.category}</span>
            <span style="color: #718096;">${c.count} items • Avg ₹${c.avg_price.toFixed(0)}</span>
          </div>
        `).join('');
      }

      // Recent orders preview
      const recentTbody = document.getElementById('analyticsRecentOrdersTbody');
      if (recentTbody && data.recent_orders) {
        recentTbody.innerHTML = data.recent_orders.map(o => `
          <tr>
            <td style="font-weight: 700;">${o.order_number}</td>
            <td>${o.customer_name}</td>
            <td style="text-transform: capitalize;">${o.order_type}</td>
            <td style="font-weight: 700;">₹${o.total_amount.toFixed(0)}</td>
            <td><span class="status-pill ${o.status.toLowerCase().replace(' ', '-')}">${o.status}</span></td>
          </tr>
        `).join('');
      }
    } catch (e) {
      console.error('Analytics load error:', e);
    }
  },

  // 2. Orders Tab
  async loadOrders() {
    const tbody = document.getElementById('ordersTableTbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Loading bakery orders...</td></tr>';

    try {
      const res = await API.getOrders();
      if (!res.success) return;

      tbody.innerHTML = res.orders.map(o => `
        <tr>
          <td>
            <div style="font-weight: 700; color: var(--color-espresso);">${o.order_number}</div>
            <div style="font-size: 0.75rem; color: #718096;">${o.created_at}</div>
          </td>
          <td>
            <div style="font-weight: 600;">${o.customer_name}</div>
            <div style="font-size: 0.75rem; color: #718096;">${o.customer_email} • ${o.customer_phone}</div>
          </td>
          <td>
            <span style="font-weight: 600; text-transform: capitalize;">${o.order_type}</span>
            <div style="font-size: 0.75rem; color: #718096;">${o.scheduled_date} (${o.scheduled_time})</div>
          </td>
          <td>
            <div style="max-width: 260px; font-size: 0.82rem;">
              ${o.items.map(it => `<div>• <strong>${it.quantity}x</strong> ${it.title} ${it.custom_details ? `<span style="color: var(--color-terracotta);">(${it.custom_details})</span>` : ''}</div>`).join('')}
            </div>
          </td>
          <td style="font-weight: 800; font-size: 0.95rem;">₹${o.total_amount.toFixed(0)}</td>
          <td>
            <select class="status-select-dropdown" onchange="AdminApp.handleStatusChange('${o.order_number}', this.value)">
              <option value="Pending" ${o.status === 'Pending' ? 'selected' : ''}>Pending</option>
              <option value="In Baking" ${o.status === 'In Baking' ? 'selected' : ''}>In Baking</option>
              <option value="Decorating" ${o.status === 'Decorating' ? 'selected' : ''}>Decorating</option>
              <option value="Ready" ${o.status === 'Ready' ? 'selected' : ''}>Ready for Pickup</option>
              <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
            </select>
          </td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="AdminApp.viewOrderNotes('${o.order_number}', '${encodeURIComponent(o.chef_notes || '')}')">Chef Note</button>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7" style="color: red; text-align: center;">Error: ${e.message}</td></tr>`;
    }
  },

  async handleStatusChange(orderNumber, newStatus) {
    try {
      const res = await API.updateOrderStatus(orderNumber, newStatus);
      if (res.success) {
        UI.showToast(`Order ${orderNumber} updated to ${newStatus}`, 'success');
      }
    } catch (e) {
      UI.showToast(`Failed to update status: ${e.message}`, 'error');
    }
  },

  viewOrderNotes(orderNumber, encodedNotes) {
    const notes = decodeURIComponent(encodedNotes);
    const updated = prompt(`Chef's baking & decoration notes for ${orderNumber}:`, notes);
    if (updated !== null && updated !== notes) {
      API.updateOrderStatus(orderNumber, null, updated)
        .then(() => {
          UI.showToast('Chef notes saved', 'success');
          this.loadOrders();
        })
        .catch(err => UI.showToast(err.message, 'error'));
    }
  },

  // 3. Products Tab
  products: [],
  productsMap: {},
  batchModified: {}, // map of { [productId]: newUrl }

  async loadProducts() {
    const tbody = document.getElementById('productsTableTbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Loading catalog...</td></tr>';

    try {
      const res = await API.getProducts({ sort: 'featured' });
      if (!res.success) return;

      this.products = res.products;
      this.productsMap = {};
      res.products.forEach(p => {
        this.productsMap[p.id] = p;
      });

      tbody.innerHTML = res.products.map(p => `
        <tr>
          <td>
            <div class="table-img-cell" onclick="AdminApp.openQuickImageModal(${p.id})" title="Click to change photo URL" style="position: relative; display: inline-block; cursor: pointer;">
              <img src="${p.image_url}" id="tableProdImg-${p.id}" style="width: 46px; height: 46px; border-radius: 8px; object-fit: cover; border: 1px solid rgba(0,0,0,0.1); transition: transform 0.2s;" onerror="this.src='https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80'">
              <span style="position: absolute; bottom: -3px; right: -3px; background: var(--color-espresso); color: #fff; font-size: 0.65rem; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">📷</span>
            </div>
          </td>
          <td>
            <div style="font-weight: 700;">${p.title}</div>
            <div style="font-size: 0.75rem; color: #718096;">${p.badge || ''}</div>
          </td>
          <td>${p.category}</td>
          <td style="font-weight: 700;">₹${p.price.toFixed(0)}</td>
          <td>
            <span style="font-weight: 600; color: ${p.stock <= 5 ? '#E53E3E' : '#2D3748'};">${p.stock} units</span>
          </td>
          <td>★ ${p.rating.toFixed(1)} (${p.review_count})</td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary btn-sm" onclick="AdminApp.openQuickImageModal(${p.id})" title="Change photo URL">📷 Photo</button>
              <button class="btn btn-secondary btn-sm" onclick="AdminApp.openEditProductModalById(${p.id})">Edit</button>
              <button class="btn btn-secondary btn-sm" style="color: var(--color-danger);" onclick="AdminApp.deleteProduct(${p.id})">Delete</button>
            </div>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7" style="color: red; text-align: center;">Error: ${e.message}</td></tr>`;
    }
  },

  openAddProductModal() {
    document.getElementById('productFormModalTitle').textContent = 'Add New Bakery Product';
    document.getElementById('productEditId').value = '';
    document.getElementById('productForm').reset();
    UI.openModal('productFormModal');
  },

  openEditProductModalById(id) {
    const p = this.productsMap && this.productsMap[id];
    if (p) {
      this.openEditProductModal(p);
    } else {
      API.getProductById(id).then(res => {
        if (res.success && res.product) this.openEditProductModal(res.product);
      }).catch(err => UI.showToast(err.message, 'error'));
    }
  },

  openEditProductModal(p) {
    if (typeof p === 'number' || typeof p === 'string') {
      p = this.productsMap && this.productsMap[p];
    }
    if (!p) return;

    document.getElementById('productFormModalTitle').textContent = 'Edit Bakery Product';
    document.getElementById('productEditId').value = p.id;
    document.getElementById('prodTitleInput').value = p.title;
    document.getElementById('prodCategorySelect').value = p.category;
    document.getElementById('prodPriceInput').value = p.price;
    document.getElementById('prodDescInput').value = p.description;
    document.getElementById('prodImageUrlInput').value = p.image_url;
    document.getElementById('prodBadgeInput').value = p.badge || '';
    document.getElementById('prodDietaryInput').value = p.dietary_tags || '';
    document.getElementById('prodStockInput').value = p.stock;
    document.getElementById('prodFeaturedCheckbox').checked = p.is_featured === 1;
    UI.openModal('productFormModal');
  },

  // Quick Single Image Editor
  openQuickImageModal(productId) {
    const p = this.productsMap && this.productsMap[productId];
    if (!p) return;

    const idEl = document.getElementById('quickImgProdId');
    const titleEl = document.getElementById('quickImgProdTitle');
    const inputEl = document.getElementById('quickImgUrlInput');
    const prevEl = document.getElementById('quickImgPreview');
    const statusEl = document.getElementById('quickImgFileStatus');
    const fileInput = document.getElementById('quickImgFileInput');

    if (idEl) idEl.value = p.id;
    if (titleEl) titleEl.textContent = `${p.title} (${p.category} • ₹${p.price.toFixed(0)})`;
    if (inputEl) inputEl.value = p.image_url;
    if (prevEl) prevEl.src = p.image_url;
    if (statusEl) statusEl.textContent = '';
    if (fileInput) fileInput.value = '';

    UI.openModal('quickImageModal');
  },

  selectStorePhoto(url) {
    const inputEl = document.getElementById('quickImgUrlInput');
    const prevEl = document.getElementById('quickImgPreview');
    const statusEl = document.getElementById('quickImgFileStatus');
    if (inputEl) inputEl.value = url;
    if (prevEl) prevEl.src = url;
    if (statusEl) statusEl.textContent = '✓ Store photo selected';
  },

  async handleQuickImageFileUpload(inputEl) {
    if (!inputEl || !inputEl.files || !inputEl.files[0]) return;
    const file = inputEl.files[0];
    const statusEl = document.getElementById('quickImgFileStatus');
    const inputUrlEl = document.getElementById('quickImgUrlInput');
    const prevEl = document.getElementById('quickImgPreview');

    if (statusEl) statusEl.textContent = `Uploading ${file.name}...`;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target.result;
      if (prevEl) prevEl.src = base64Data;

      try {
        const uploadRes = await API.uploadImage(base64Data, file.name);
        if (uploadRes.success && uploadRes.image_url) {
          if (inputUrlEl) inputUrlEl.value = uploadRes.image_url;
          if (statusEl) statusEl.textContent = `✓ Uploaded: ${file.name} (Ready to save)`;
          UI.showToast('Photo uploaded from device! Click "Save Product Photo" to apply.', 'success');
        } else {
          if (inputUrlEl) inputUrlEl.value = base64Data;
          if (statusEl) statusEl.textContent = `✓ Loaded: ${file.name}`;
        }
      } catch (err) {
        if (inputUrlEl) inputUrlEl.value = base64Data;
        if (statusEl) statusEl.textContent = `✓ Loaded: ${file.name}`;
      }
    };
    reader.readAsDataURL(file);
  },

  async handleQuickImageSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('quickImgProdId').value;
    const newUrl = document.getElementById('quickImgUrlInput').value.trim();
    const saveBtn = document.getElementById('btnSaveQuickPhoto');

    if (!id || !newUrl) return;

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving photo...';
    }

    try {
      const res = await API.updateProductImage(id, newUrl);
      if (res.success) {
        UI.showToast(res.message || 'Product photo updated successfully!', 'success');
        UI.closeModal('quickImageModal');

        // Update local cache
        if (this.productsMap[id]) {
          this.productsMap[id].image_url = newUrl;
        }

        // Update thumbnail in table immediately without reloading
        const imgEl = document.getElementById(`tableProdImg-${id}`);
        if (imgEl) imgEl.src = newUrl;

        // Update storefront cards if visible
        document.querySelectorAll(`.product-card[data-product-id="${id}"] img`).forEach(img => {
          img.src = newUrl;
        });

        // Fully refresh products table from backend to guarantee sync
        await this.loadProducts();

        // If customer storefront renderProducts exists, refresh it too
        if (typeof window.renderProducts === 'function') {
          window.renderProducts();
        }
      }
    } catch (err) {
      UI.showToast(err.message || 'Failed to update image', 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Product Photo ✓';
      }
    }
  },

  // Batch Image Studio
  openBatchImageModal() {
    this.batchModified = {};
    const countBadge = document.getElementById('batchModifiedCountBadge');
    const saveBtn = document.getElementById('btnSaveAllBatchImages');
    if (countBadge) countBadge.textContent = '0 images modified';
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.style.opacity = '0.6';
    }

    this.renderBatchImageRows();
    UI.openModal('batchImageModal');
  },

  renderBatchImageRows() {
    const container = document.getElementById('batchImageListContainer');
    if (!container) return;

    const search = (document.getElementById('batchImgSearchInput')?.value || '').toLowerCase().trim();
    const category = document.getElementById('batchImgCategorySelect')?.value || 'All';

    let list = this.products || [];
    if (category !== 'All') {
      list = list.filter(p => p.category === category);
    }
    if (search) {
      list = list.filter(p => p.title.toLowerCase().includes(search) || p.category.toLowerCase().includes(search));
    }

    if (list.length === 0) {
      container.innerHTML = '<div style="text-align: center; padding: 2.5rem; color: var(--color-text-muted);">No products match filter.</div>';
      return;
    }

    container.innerHTML = list.map(p => {
      const currentVal = this.batchModified[p.id] !== undefined ? this.batchModified[p.id] : p.image_url;
      const isModified = this.batchModified[p.id] !== undefined && this.batchModified[p.id] !== p.image_url;

      return `
        <div class="batch-product-row ${isModified ? 'modified' : ''}" id="batchRow-${p.id}">
          <div class="batch-thumb-wrap">
            <img src="${currentVal}" id="batchImgPreview-${p.id}" alt="${p.title}" onerror="this.src='https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80'">
          </div>
          <div class="batch-info-col">
            <div class="batch-info-title" title="${p.title}">${p.title}</div>
            <div class="batch-info-meta">${p.category} • ₹${p.price.toFixed(0)}</div>
            <span class="batch-status-badge ${isModified ? 'pending' : 'saved'}" id="batchBadge-${p.id}">
              ${isModified ? 'Modified ⚠️' : 'Current ✓'}
            </span>
          </div>
          <div class="batch-input-col">
            <input type="url" class="form-control batch-url-input" id="batchInput-${p.id}" value="${currentVal}" placeholder="https://images.unsplash.com/..." oninput="AdminApp.handleBatchInput(${p.id}, this.value)">
          </div>
          <div class="batch-action-col">
            <button type="button" class="btn btn-secondary btn-sm" onclick="AdminApp.saveSingleBatchImage(${p.id})">
              Save
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  handleBatchInput(productId, newUrl) {
    const p = this.productsMap && this.productsMap[productId];
    if (!p) return;

    const trimmed = newUrl.trim();
    if (trimmed !== p.image_url) {
      this.batchModified[productId] = trimmed;
    } else {
      delete this.batchModified[productId];
    }

    // Update live preview image
    const previewEl = document.getElementById(`batchImgPreview-${productId}`);
    if (previewEl && trimmed) {
      previewEl.src = trimmed;
    }

    // Update row highlight & badge
    const rowEl = document.getElementById(`batchRow-${productId}`);
    const badgeEl = document.getElementById(`batchBadge-${productId}`);
    const isModified = this.batchModified[productId] !== undefined;

    if (rowEl) {
      if (isModified) rowEl.classList.add('modified');
      else rowEl.classList.remove('modified');
    }
    if (badgeEl) {
      badgeEl.className = isModified ? 'batch-status-badge pending' : 'batch-status-badge saved';
      badgeEl.textContent = isModified ? 'Modified ⚠️' : 'Current ✓';
    }

    // Update save button and count
    const modCount = Object.keys(this.batchModified).length;
    const countBadge = document.getElementById('batchModifiedCountBadge');
    const saveBtn = document.getElementById('btnSaveAllBatchImages');

    if (countBadge) {
      countBadge.textContent = `${modCount} ${modCount === 1 ? 'image' : 'images'} modified`;
      countBadge.style.color = modCount > 0 ? 'var(--color-terracotta)' : 'var(--color-espresso)';
    }

    if (saveBtn) {
      saveBtn.disabled = modCount === 0;
      saveBtn.style.opacity = modCount > 0 ? '1' : '0.6';
      saveBtn.textContent = modCount > 0 ? `Save All Changed Images (${modCount})` : 'Save All Changed Images';
    }
  },

  async saveSingleBatchImage(productId) {
    const inputEl = document.getElementById(`batchInput-${productId}`);
    if (!inputEl) return;
    const newUrl = inputEl.value.trim();
    if (!newUrl) {
      UI.showToast('Please provide a valid image URL', 'error');
      return;
    }

    try {
      const res = await API.updateProductImage(productId, newUrl);
      if (res.success) {
        UI.showToast(`Updated image for ${this.productsMap[productId]?.title}!`, 'success');
        if (this.productsMap[productId]) {
          this.productsMap[productId].image_url = newUrl;
        }
        delete this.batchModified[productId];

        const rowEl = document.getElementById(`batchRow-${productId}`);
        const badgeEl = document.getElementById(`batchBadge-${productId}`);
        if (rowEl) rowEl.classList.remove('modified');
        if (badgeEl) {
          badgeEl.className = 'batch-status-badge saved';
          badgeEl.textContent = 'Saved ✓';
        }

        // Update table image
        const imgEl = document.getElementById(`tableProdImg-${productId}`);
        if (imgEl) imgEl.src = newUrl;

        // Update count
        const modCount = Object.keys(this.batchModified).length;
        const countBadge = document.getElementById('batchModifiedCountBadge');
        const saveBtn = document.getElementById('btnSaveAllBatchImages');
        if (countBadge) countBadge.textContent = `${modCount} images modified`;
        if (saveBtn) {
          saveBtn.disabled = modCount === 0;
          saveBtn.style.opacity = modCount > 0 ? '1' : '0.6';
        }
      }
    } catch (err) {
      UI.showToast(err.message || 'Failed to save image', 'error');
    }
  },

  async saveAllBatchImages() {
    const updates = Object.entries(this.batchModified).map(([id, url]) => ({
      id: parseInt(id),
      image_url: url
    }));

    if (updates.length === 0) {
      UI.showToast('No image changes to save', 'info');
      return;
    }

    const saveBtn = document.getElementById('btnSaveAllBatchImages');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving images...';
    }

    try {
      const res = await API.updateBatchProductImages(updates);
      if (res.success) {
        UI.showToast(res.message || `Successfully updated ${updates.length} product images!`, 'success');

        // Apply to local cache
        updates.forEach(u => {
          if (this.productsMap[u.id]) {
            this.productsMap[u.id].image_url = u.image_url;
          }
          const imgEl = document.getElementById(`tableProdImg-${u.id}`);
          if (imgEl) imgEl.src = u.image_url;
        });

        this.batchModified = {};
        UI.closeModal('batchImageModal');
        this.loadProducts();
      }
    } catch (err) {
      UI.showToast(err.message || 'Batch update failed', 'error');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = `Save All Changed Images (${updates.length})`;
      }
    }
  },

  resetBatchChanges() {
    this.batchModified = {};
    this.renderBatchImageRows();
    const countBadge = document.getElementById('batchModifiedCountBadge');
    const saveBtn = document.getElementById('btnSaveAllBatchImages');
    if (countBadge) countBadge.textContent = '0 images modified';
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.style.opacity = '0.6';
      saveBtn.textContent = 'Save All Changed Images';
    }
    UI.showToast('Reset all pending image changes', 'info');
  },

  async handleProductFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('productEditId').value;
    const payload = {
      title: document.getElementById('prodTitleInput').value.trim(),
      category: document.getElementById('prodCategorySelect').value,
      price: parseFloat(document.getElementById('prodPriceInput').value || 0),
      description: document.getElementById('prodDescInput').value.trim(),
      image_url: document.getElementById('prodImageUrlInput').value.trim(),
      badge: document.getElementById('prodBadgeInput').value.trim(),
      dietary_tags: document.getElementById('prodDietaryInput').value.trim(),
      stock: parseInt(document.getElementById('prodStockInput').value || 0),
      is_featured: document.getElementById('prodFeaturedCheckbox').checked ? 1 : 0
    };

    try {
      if (id) {
        await API.updateProduct(id, payload);
        UI.showToast('Product updated successfully', 'success');
      } else {
        await API.createProduct(payload);
        UI.showToast('New product added to catalog', 'success');
      }
      UI.closeModal('productFormModal');
      this.loadProducts();
    } catch (err) {
      UI.showToast(err.message, 'error');
    }
  },

  async deleteProduct(id) {
    if (confirm('Are you sure you want to delete this bakery item from the catalog?')) {
      try {
        await API.deleteProduct(id);
        UI.showToast('Product removed', 'success');
        this.loadProducts();
      } catch (err) {
        UI.showToast(err.message, 'error');
      }
    }
  },

  // 4. Inventory Tab
  async loadInventory() {
    const tbody = document.getElementById('inventoryTableTbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Checking pantry stocks...</td></tr>';

    try {
      const res = await API.getInventory();
      if (!res.success) return;

      tbody.innerHTML = res.inventory.map(item => {
        const isLow = item.quantity <= item.min_threshold;
        return `
          <tr>
            <td>
              <div style="font-weight: 700;">${item.item_name}</div>
              <div style="font-size: 0.75rem; color: #718096;">Supplier: ${item.supplier || 'Direct'}</div>
            </td>
            <td>${item.category}</td>
            <td>
              <strong style="font-size: 1rem; color: ${isLow ? '#E53E3E' : '#2D3748'};">${item.quantity} ${item.unit}</strong>
            </td>
            <td>${item.min_threshold} ${item.unit}</td>
            <td>
              ${isLow ? `<span class="low-stock-alert-tag">LOW STOCK REORDER</span>` : `<span style="color: #38A169; font-size: 0.8rem; font-weight: 700;">✓ In Stock</span>`}
            </td>
            <td>
              <div style="display: flex; gap: 6px;">
                <button class="btn btn-secondary btn-sm" onclick="AdminApp.quickRestock(${item.id}, ${item.quantity + 20})">+20 ${item.unit}</button>
                <button class="btn btn-secondary btn-sm" onclick="AdminApp.promptStockEdit(${item.id}, ${item.quantity})">Set</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">Error: ${e.message}</td></tr>`;
    }
  },

  async quickRestock(id, newQty) {
    try {
      await API.updateInventoryStock(id, newQty);
      UI.showToast(`Stock updated to ${newQty}`, 'success');
      this.loadInventory();
    } catch (e) {
      UI.showToast(e.message, 'error');
    }
  },

  promptStockEdit(id, currentQty) {
    const val = prompt('Enter new stock quantity:', currentQty);
    if (val !== null && !isNaN(val)) {
      this.quickRestock(id, parseFloat(val));
    }
  },

  // 5. Customers Tab
  async loadCustomers() {
    const tbody = document.getElementById('customersTableTbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">Loading customer directory...</td></tr>';

    try {
      const res = await API.getCustomers();
      if (!res.success) return;

      tbody.innerHTML = res.customers.map(c => {
        const pinBadge = c.pincode 
          ? `<span style="font-family: monospace; font-weight: 700; background: #EDF2F7; padding: 2px 7px; border-radius: 4px; color: var(--color-espresso);">📍 ${c.pincode}</span>`
          : '<span style="color: #A0AEC0;">—</span>';

        return `
        <tr>
          <td>
            <div style="font-weight: 700;">${c.name}</div>
            <div style="font-size: 0.75rem; color: #718096;">Member since ${c.created_at.split(' ')[0]}</div>
          </td>
          <td>${c.email}</td>
          <td>${c.phone || '—'}</td>
          <td>${pinBadge}</td>
          <td>
            <span class="badge badge-honey">${c.loyalty_points} Crumb Pts</span>
            <div style="font-size: 0.72rem; color: #718096; margin-top: 2px;">Tier: ${c.tier}</div>
          </td>
          <td>${c.order_count} orders</td>
          <td style="font-weight: 800;">₹${c.total_spent.toFixed(0)}</td>
          <td>
            <button class="btn btn-sm btn-secondary" style="color: #E53E3E; border-color: rgba(229, 62, 62, 0.35); font-weight: 600;" onclick="AdminApp.deleteCustomer(${c.id}, '${c.name.replace(/'/g, "\\'")}')" title="Remove Customer Account">
              🗑️ Remove
            </button>
          </td>
        </tr>
      `;
      }).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="8" style="color: red; text-align: center;">Error: ${e.message}</td></tr>`;
    }
  },

  async deleteCustomer(id, name) {
    if (!confirm(`Are you sure you want to remove customer "${name}" from CakeTalk? This will delete their customer account and loyalty points.`)) {
      return;
    }

    try {
      const res = await API.deleteCustomer(id);
      UI.showToast(res.message || `Customer "${name}" removed successfully`, 'success');
      await this.loadCustomers();
    } catch (err) {
      UI.showToast(err.message || 'Failed to remove customer', 'error');
    }
  },

  // 6. Coupons Tab
  async loadCoupons() {
    const tbody = document.getElementById('couponsTableTbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Loading promo codes...</td></tr>';

    try {
      const res = await API.getCoupons();
      if (!res.success) return;

      tbody.innerHTML = res.coupons.map(cp => `
        <tr>
          <td style="font-weight: 800; font-family: monospace; font-size: 1rem; color: var(--color-espresso);">${cp.code}</td>
          <td>${cp.description || '—'}</td>
          <td style="font-weight: 700;">${cp.discount_percent > 0 ? `${cp.discount_percent}% OFF` : `₹${cp.flat_discount} OFF`}</td>
          <td>₹${cp.min_order.toFixed(0)}</td>
          <td>${cp.usage_count} uses</td>
          <td>
            <button class="btn btn-sm ${cp.active ? 'btn-secondary' : 'btn-dark'}" onclick="AdminApp.toggleCoupon(${cp.id})">
              ${cp.active ? 'Active (Click to Pause)' : 'Paused (Click to Activate)'}
            </button>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">Error: ${e.message}</td></tr>`;
    }
  },

  async toggleCoupon(id) {
    try {
      await API.toggleCoupon(id);
      UI.showToast('Coupon state toggled', 'success');
      this.loadCoupons();
    } catch (e) {
      UI.showToast(e.message, 'error');
    }
  },

  // 7. Event Inquiries Tab
  async loadInquiries() {
    const tbody = document.getElementById('inquiriesTableTbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Loading wedding & event inquiries...</td></tr>';

    try {
      const res = await API.getInquiries();
      if (!res.success) return;

      tbody.innerHTML = res.inquiries.map(inq => `
        <tr>
          <td>
            <div style="font-weight: 700;">${inq.name}</div>
            <div style="font-size: 0.75rem; color: #718096;">${inq.email} • ${inq.phone}</div>
          </td>
          <td><strong>${inq.event_date}</strong></td>
          <td>${inq.guest_count} guests</td>
          <td>${inq.cake_theme || '—'}</td>
          <td style="font-weight: 700;">${inq.budget_range || '—'}</td>
          <td>
            <select class="status-select-dropdown" onchange="AdminApp.updateInquiryStatus(${inq.id}, this.value)">
              <option value="New" ${inq.status === 'New' ? 'selected' : ''}>New</option>
              <option value="In Review" ${inq.status === 'In Review' ? 'selected' : ''}>In Review</option>
              <option value="Quoted" ${inq.status === 'Quoted' ? 'selected' : ''}>Quoted</option>
              <option value="Confirmed" ${inq.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
            </select>
          </td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="alert('Client Notes: ${encodeURIComponent(inq.notes || 'None').replace(/'/g, "\\'")}')">View Details</button>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7" style="color: red; text-align: center;">Error: ${e.message}</td></tr>`;
    }
  },

  async updateInquiryStatus(id, newStatus) {
    try {
      await API.updateInquiryStatus(id, newStatus);
      UI.showToast(`Inquiry marked as ${newStatus}`, 'success');
    } catch (e) {
      UI.showToast(e.message, 'error');
    }
  },

  // 8. Delivery Pincodes & Service Zones (Owner Management)
  allPincodes: [],

  async loadPincodes() {
    const tbody = document.getElementById('pincodesTableTbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Loading delivery pincodes & dispatch zones...</td></tr>';

    try {
      const res = await API.getAdminPincodes();
      if (!res.success) return;

      this.allPincodes = res.pincodes || [];

      // Update KPI widgets
      const totalEl = document.getElementById('kpiPincodesTotal');
      const activeEl = document.getElementById('kpiPincodesActive');
      const freeEl = document.getElementById('kpiPincodesFree');
      if (totalEl) totalEl.textContent = res.total || this.allPincodes.length;
      if (activeEl) activeEl.textContent = res.active_count || this.allPincodes.filter(p => p.is_active).length;
      if (freeEl) freeEl.textContent = res.free_count || this.allPincodes.filter(p => p.is_active && p.delivery_fee === 0).length;

      this.renderPincodesTable(this.allPincodes);
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7" style="color: red; text-align: center; padding: 1.5rem;">Error loading pincodes: ${e.message}</td></tr>`;
    }
  },

  renderPincodesTable(list) {
    const tbody = document.getElementById('pincodesTableTbody');
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #718096;">No delivery pincodes found. Add your first delivery zone above!</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(pin => {
      const feeLabel = pin.delivery_fee === 0 ? '<span style="color: #2F855A; font-weight: 700;">FREE</span>' : `₹${pin.delivery_fee.toFixed(0)}`;
      const statusBadge = pin.is_active 
        ? '<span style="background: rgba(56, 161, 105, 0.15); color: #22543D; padding: 3px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 700;">● Active Zone</span>'
        : '<span style="background: rgba(229, 62, 62, 0.15); color: #9B2C2C; padding: 3px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 700;">○ Delivery Paused</span>';
      
      const toggleBtnClass = pin.is_active ? 'btn-secondary' : 'btn-primary';
      const toggleBtnText = pin.is_active ? '⏸ Pause Service' : '▶ Enable Service';

      return `
        <tr>
          <td>
            <span style="font-family: monospace; font-size: 1.05rem; font-weight: 800; color: var(--color-espresso); background: #EDF2F7; padding: 3px 8px; border-radius: 4px;">
              ${pin.pincode}
            </span>
          </td>
          <td><strong>${pin.area_name}</strong></td>
          <td style="color: #4A5568;">${pin.city}</td>
          <td><span style="font-size: 0.85rem; color: #4A5568;">⏱ ${pin.estimated_time || '35-45 mins'}</span></td>
          <td>${feeLabel}</td>
          <td>${statusBadge}</td>
          <td>
            <div style="display: flex; gap: 6px; align-items: center;">
              <button class="btn btn-sm ${toggleBtnClass}" onclick="AdminApp.togglePincode(${pin.id})">
                ${toggleBtnText}
              </button>
              <button class="btn btn-sm btn-secondary" style="color: #E53E3E; border-color: rgba(229, 62, 62, 0.3);" onclick="AdminApp.deletePincode(${pin.id}, '${pin.pincode}')" title="Delete Pincode">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  filterPincodes(term) {
    const q = (term || '').toLowerCase().trim();
    if (!q) {
      this.renderPincodesTable(this.allPincodes);
      return;
    }
    const filtered = this.allPincodes.filter(p => 
      p.pincode.toLowerCase().includes(q) || 
      p.area_name.toLowerCase().includes(q) || 
      (p.city && p.city.toLowerCase().includes(q))
    );
    this.renderPincodesTable(filtered);
  },

  async submitAddPincode(e) {
    e.preventDefault();
    const pincode = document.getElementById('adminNewPincode').value.trim();
    const area_name = document.getElementById('adminNewArea').value.trim();
    const city = document.getElementById('adminNewCity').value.trim() || 'Bangalore';
    const estimated_time = document.getElementById('adminNewTime').value.trim() || '35-45 mins';
    const delivery_fee = parseFloat(document.getElementById('adminNewFee').value || '0');

    if (!pincode || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
      UI.showToast('Please enter a valid 6-digit Indian postal pincode.', 'error');
      return;
    }

    if (!area_name) {
      UI.showToast('Please enter the locality or area name.', 'error');
      return;
    }

    try {
      const res = await API.addPincode({
        pincode,
        area_name,
        city,
        estimated_time,
        delivery_fee,
        is_active: 1
      });

      if (res.success) {
        UI.showToast(res.message || `Pincode ${pincode} saved successfully!`, 'success');
        document.getElementById('addPincodeForm').reset();
        document.getElementById('adminNewCity').value = 'Bangalore';
        document.getElementById('adminNewTime').value = '35-45 mins';
        document.getElementById('adminNewFee').value = '0';
        await this.loadPincodes();
      }
    } catch (err) {
      UI.showToast(err.message || 'Failed to save delivery pincode.', 'error');
    }
  },

  async togglePincode(id) {
    try {
      const res = await API.togglePincode(id);
      UI.showToast(res.message || 'Pincode delivery status updated', 'success');
      await this.loadPincodes();
    } catch (err) {
      UI.showToast(err.message || 'Failed to toggle pincode', 'error');
    }
  },

  async deletePincode(id, pincode) {
    if (!confirm(`Are you sure you want to remove pincode ${pincode} from your delivery zones?`)) {
      return;
    }

    try {
      const res = await API.deletePincode(id);
      UI.showToast(res.message || `Pincode ${pincode} removed`, 'success');
      await this.loadPincodes();
    } catch (err) {
      UI.showToast(err.message || 'Failed to remove pincode', 'error');
    }
  }
};

window.AdminApp = AdminApp;
document.addEventListener('DOMContentLoaded', () => {
  AdminApp.init();

  // Product form submission listener
  document.getElementById('productForm')?.addEventListener('submit', (e) => {
    AdminApp.handleProductFormSubmit(e);
  });
});
