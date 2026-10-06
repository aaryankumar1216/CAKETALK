/**
 * CakeTalk Bakery Platform - Owner / Admin Dashboard Logic
 */

const AdminApp = {
  currentTab: 'analytics',
  currentUser: null,

  async init() {
    this.checkAuth();
    this.attachNavEvents();
  },

  checkAuth() {
    const savedUser = localStorage.getItem('caketalk_user');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        if (u.role === 'admin') {
          this.currentUser = u;
          this.hideLoginOverlay();
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

  attachNavEvents() {
    // Tab switching
    document.querySelectorAll('[data-admin-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sidebar-nav-item').forEach(i => i.classList.remove('active'));
        btn.parentElement.classList.add('active');
        this.currentTab = btn.dataset.adminTab;
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
          if (res.success && res.user.role === 'admin') {
            this.currentUser = res.user;
            this.hideLoginOverlay();
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
        titleEl.textContent = tabName.charAt(0).toUpperCase() + tabName.slice(1);
      }
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
    }
  },

  // 1. Analytics Tab
  async loadAnalytics() {
    try {
      const res = await API.getAnalytics();
      if (!res.success) return;
      const data = res.analytics;

      document.getElementById('kpiRevenue').textContent = `$${data.total_revenue.toFixed(2)}`;
      document.getElementById('kpiOrders').textContent = data.total_orders;
      document.getElementById('kpiAOV').textContent = `$${data.avg_order_value.toFixed(2)}`;
      document.getElementById('kpiCustomers').textContent = data.total_customers;

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
            <span style="color: #718096;">${c.count} items • Avg $${c.avg_price.toFixed(2)}</span>
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
            <td style="font-weight: 700;">$${o.total_amount.toFixed(2)}</td>
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
          <td style="font-weight: 800; font-size: 0.95rem;">$${o.total_amount.toFixed(2)}</td>
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
  async loadProducts() {
    const tbody = document.getElementById('productsTableTbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Loading catalog...</td></tr>';

    try {
      const res = await API.getProducts({ sort: 'featured' });
      if (!res.success) return;

      tbody.innerHTML = res.products.map(p => `
        <tr>
          <td>
            <img src="${p.image_url}" style="width: 44px; height: 44px; border-radius: 6px; object-fit: cover;">
          </td>
          <td>
            <div style="font-weight: 700;">${p.title}</div>
            <div style="font-size: 0.75rem; color: #718096;">${p.badge || ''}</div>
          </td>
          <td>${p.category}</td>
          <td style="font-weight: 700;">$${p.price.toFixed(2)}</td>
          <td>
            <span style="font-weight: 600; color: ${p.stock <= 5 ? '#E53E3E' : '#2D3748'};">${p.stock} units</span>
          </td>
          <td>★ ${p.rating.toFixed(1)} (${p.review_count})</td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary btn-sm" onclick='AdminApp.openEditProductModal(${JSON.stringify(p)})'>Edit</button>
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

  openEditProductModal(p) {
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
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Loading customer directory...</td></tr>';

    try {
      const res = await API.getCustomers();
      if (!res.success) return;

      tbody.innerHTML = res.customers.map(c => `
        <tr>
          <td>
            <div style="font-weight: 700;">${c.name}</div>
            <div style="font-size: 0.75rem; color: #718096;">Member since ${c.created_at.split(' ')[0]}</div>
          </td>
          <td>${c.email}</td>
          <td>${c.phone || '—'}</td>
          <td>
            <span class="badge badge-honey">${c.loyalty_points} Crumb Pts</span>
            <div style="font-size: 0.72rem; color: #718096; margin-top: 2px;">Tier: ${c.tier}</div>
          </td>
          <td>${c.order_count} orders</td>
          <td style="font-weight: 800;">$${c.total_spent.toFixed(2)}</td>
        </tr>
      `).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">Error: ${e.message}</td></tr>`;
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
          <td style="font-weight: 700;">${cp.discount_percent > 0 ? `${cp.discount_percent}% OFF` : `$${cp.flat_discount} OFF`}</td>
          <td>$${cp.min_order.toFixed(2)}</td>
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
