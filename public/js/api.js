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
  async login(email, password) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
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

  // 9. Customers (Admin)
  async getCustomers() {
    return this.request('/customers');
  }
};
