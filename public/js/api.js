/**
 * CakeTalk Bakery Platform - Centralized API Service Client
 */

const API = {
  baseUrl: '/api',

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };

    const token = localStorage.getItem('caketalk_token');
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...(options.headers || {})
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP error ${response.status}`);
      }
      return data;
    } catch (error) {
      console.error(`API Error on [${options.method || 'GET'}] ${endpoint}:`, error);
      throw error;
    }
  },

  // 1. Products
  async getProducts(params = {}) {
    const query = new URLSearchParams();
    if (params.category) query.append('category', params.category);
    if (params.dietary) query.append('dietary', params.dietary);
    if (params.search) query.append('search', params.search);
    if (params.sort) query.append('sort', params.sort);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/products${qs}`);
  },

  async getProductById(id) {
    return this.request(`/products/${id}`);
  },

  async createProduct(productData) {
    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(productData)
    });
  },

  async updateProduct(id, productData) {
    return this.request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData)
    });
  },

  async updateProductImage(id, imageUrl) {
    return this.request(`/products/${id}/image`, {
      method: 'PUT',
      body: JSON.stringify({ image_url: imageUrl })
    });
  },

  async updateBatchProductImages(updates) {
    return this.request('/products/batch-images', {
      method: 'PUT',
      body: JSON.stringify({ updates })
    });
  },

  async deleteProduct(id) {
    return this.request(`/products/${id}`, {
      method: 'DELETE'
    });
  },

  // 2. Orders
  async getOrders(params = {}) {
    const query = new URLSearchParams();
    if (params.email) query.append('email', params.email);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/orders${qs}`);
  },

  async getOrderByNumber(orderNumber) {
    return this.request(`/orders/${orderNumber}`);
  },

  async createOrder(orderData) {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
  },

  async updateOrderStatus(orderNumber, status, chefNotes = null) {
    return this.request(`/orders/${orderNumber}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, chef_notes: chefNotes })
    });
  },

  // 3. Analytics (Admin)
  async getAnalytics() {
    return this.request('/analytics');
  },

  // 4. Inventory (Admin)
  async getInventory() {
    return this.request('/inventory');
  },

  async updateInventoryStock(id, quantity) {
    return this.request(`/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity })
    });
  },

  async addInventoryItem(itemData) {
    return this.request('/inventory', {
      method: 'POST',
      body: JSON.stringify(itemData)
    });
  },

  // 5. Reviews
  async getReviews(params = {}) {
    const query = new URLSearchParams();
    if (params.productId) query.append('product_id', params.productId);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/reviews${qs}`);
  },

  async submitReview(reviewData) {
    return this.request('/reviews', {
      method: 'POST',
      body: JSON.stringify(reviewData)
    });
  },

  // 6. Coupons
  async validateCoupon(code, orderAmount) {
    return this.request('/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ code, order_amount: orderAmount })
    });
  },

  async getCoupons() {
    return this.request('/coupons');
  },

  async createCoupon(data) {
    return this.request('/coupons', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async toggleCoupon(id) {
    return this.request(`/coupons/${id}/toggle`, {
      method: 'PUT'
    });
  },

  // 7. Event Inquiries
  async submitInquiry(inquiryData) {
    return this.request('/inquiries', {
      method: 'POST',
      body: JSON.stringify(inquiryData)
    });
  },

  async getInquiries() {
    return this.request('/inquiries');
  },

  async updateInquiryStatus(id, status) {
    return this.request(`/inquiries/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  // 8. Authentication
  async login(identifier, password, role = null) {
    const payload = {
      identifier: identifier,
      email: identifier,
      password: password
    };
    if (role) payload.role = role;

    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.success && res.token) {
      localStorage.setItem('caketalk_token', res.token);
      localStorage.setItem('caketalk_user', JSON.stringify(res.user));
    }
    return res;
  },

  async sendOTP(phone) {
    return this.request('/auth/otp/send', {
      method: 'POST',
      body: JSON.stringify({ phone })
    });
  },

  async verifyOTP(phone, otp, name = '') {
    const payload = { phone, otp };
    if (name) payload.name = name;
    const res = await this.request('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.success && res.token) {
      localStorage.setItem('caketalk_token', res.token);
      localStorage.setItem('caketalk_user', JSON.stringify(res.user));
    }
    return res;
  },

  async register(data) {
    const res = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (res.success && res.token) {
      localStorage.setItem('caketalk_token', res.token);
      localStorage.setItem('caketalk_user', JSON.stringify(res.user));
    }
    return res;
  },

  logout() {
    localStorage.removeItem('caketalk_token');
    localStorage.removeItem('caketalk_user');
  },

  getCurrentUser() {
    try {
      const saved = localStorage.getItem('caketalk_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  },

  // 9. Customers (Admin)
  async getCustomers() {
    return this.request('/customers');
  },

  async deleteCustomer(id) {
    return this.request(`/customers/${id}`, {
      method: 'DELETE'
    });
  },

  // 10. Delivery Pincodes & Service Zones (Customer verification & Owner management)
  async checkPincode(pincode) {
    const cleanPin = String(pincode).trim();
    return this.request(`/pincodes?pincode=${encodeURIComponent(cleanPin)}`);
  },

  async getPincodes() {
    return this.request('/pincodes');
  },

  async getAdminPincodes() {
    return this.request('/admin/pincodes');
  },

  async addPincode(pincodeData) {
    return this.request('/admin/pincodes', {
      method: 'POST',
      body: JSON.stringify(pincodeData)
    });
  },

  async togglePincode(id) {
    return this.request(`/admin/pincodes/${id}/toggle`, {
      method: 'PUT'
    });
  },

  async deletePincode(id) {
    return this.request(`/admin/pincodes/${id}`, {
      method: 'DELETE'
    });
  }
};
window.API = API;

// -----------------------------------------------------------------------------
// 10. Theme Manager (Dark & Light Mode Switcher)
// -----------------------------------------------------------------------------
const ThemeManager = {
  THEME_KEY: 'caketalk_theme',

  init() {
    const saved = localStorage.getItem(this.THEME_KEY);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    this.setTheme(theme, false);
  },

  getTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  },

  setTheme(theme, notify = true) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(this.THEME_KEY, theme);
    this.updateToggleIcons(theme);
    if (notify && window.UI && typeof window.UI.showToast === 'function') {
      window.UI.showToast(`Switched to ${theme === 'dark' ? 'Dark Mode 🌙' : 'Light Mode ☀️'}`, 'info');
    }
  },

  toggleTheme() {
    const next = this.getTheme() === 'dark' ? 'light' : 'dark';
    this.setTheme(next, true);
  },

  updateToggleIcons(theme) {
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      btn.setAttribute('title', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
    });
    document.querySelectorAll('.theme-toggle-icon').forEach(icon => {
      icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    });
  }
};
window.ThemeManager = ThemeManager;

// Auto-initialize theme on DOM load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ThemeManager.init());
} else {
  ThemeManager.init();
}
