/**
 * CakeTalk Bakery Platform - Main Client Application Logic
 */

// -----------------------------------------------------------------------------
// 1. Toast & Modal UI Helper
// -----------------------------------------------------------------------------
const UI = {
  openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  },

  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      `;
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bg = type === 'success' ? 'rgba(34, 107, 65, 0.88)' : type === 'error' ? 'rgba(180, 45, 45, 0.88)' : 'rgba(32, 19, 12, 0.84)';
    const borderColor = type === 'success' ? 'rgba(120, 220, 160, 0.45)' : type === 'error' ? 'rgba(255, 140, 140, 0.45)' : 'rgba(255, 255, 255, 0.28)';
    toast.style.cssText = `
      background: ${bg};
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid ${borderColor};
      box-shadow: 0 12px 32px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.3);
      color: #fff;
      padding: 12px 22px;
      border-radius: 9999px;
      font-size: 0.9rem;
      font-weight: 600;
      opacity: 0;
      transform: translateY(12px);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 10px;
    `;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span> ${message}`;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px)';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }
};
window.UI = UI;

// -----------------------------------------------------------------------------
// 2. Cart Management
// -----------------------------------------------------------------------------
const Cart = {
  items: [],
  orderType: 'delivery', // 'pickup' or 'delivery'
  coupon: null,
  deliveryFee: 5.00,

  init() {
    try {
      const saved = localStorage.getItem('caketalk_cart');
      if (saved) {
        this.items = JSON.parse(saved);
      }
    } catch (e) {
      this.items = [];
    }
    this.render();
    this.attachEvents();
  },

  save() {
    localStorage.setItem('caketalk_cart', JSON.stringify(this.items));
  },

  addItem(product, qty = 1) {
    const existingIndex = this.items.findIndex(item => item.id === product.id && !product.isCustom);
    if (existingIndex > -1) {
      this.items[existingIndex].quantity += qty;
    } else {
      this.items.push({
        id: product.id,
        title: product.title,
        price: product.price,
        quantity: qty,
        image_url: product.image_url,
        category: product.category,
        custom_details: product.custom_details || null,
        isCustom: product.isCustom || false
      });
    }
    this.save();
    this.render();
    UI.showToast(`Added "${product.title}" to bag`, 'success');
  },

  removeItem(index) {
    this.items.splice(index, 1);
    this.save();
    this.render();
  },

  updateQty(index, delta) {
    if (this.items[index]) {
      this.items[index].quantity += delta;
      if (this.items[index].quantity <= 0) {
        this.removeItem(index);
        return;
      }
      this.save();
      this.render();
    }
  },

  getProductQty(productId) {
    const item = this.items.find(it => it.id === productId && !it.isCustom);
    return item ? item.quantity : 0;
  },

  addProductById(productId) {
    let prod = (window.productsMap && window.productsMap[productId]) || null;
    if (!prod) {
      const card = document.querySelector(`.product-card[data-product-id="${productId}"]`);
      if (card) {
        const title = card.querySelector('.card-title')?.textContent || 'Bakery Item';
        const priceText = card.querySelector('.card-price')?.textContent.replace(/[^0-9.]/g, '') || '0';
        const img = card.querySelector('.card-image-box img')?.src || '';
        const cat = card.querySelector('.card-category-meta')?.textContent || 'Bakery';
        prod = { id: productId, title, price: parseFloat(priceText), image_url: img, category: cat };
      }
    }
    if (prod) {
      if (prod.stock !== undefined && prod.stock <= 0) {
        UI.showToast(`"${prod.title}" is currently out of stock`, 'error');
        return;
      }
      this.addItem({
        id: prod.id,
        title: prod.title,
        price: prod.price,
        image_url: prod.image_url,
        category: prod.category
      }, 1);
    }
  },

  updateProductQty(productId, delta) {
    const index = this.items.findIndex(it => it.id === productId && !it.isCustom);
    if (index > -1) {
      const prod = (window.productsMap && window.productsMap[productId]) || null;
      if (delta > 0 && prod && prod.stock !== undefined && this.items[index].quantity >= prod.stock) {
        UI.showToast(`Only ${prod.stock} units available in stock`, 'info');
        return;
      }
      this.updateQty(index, delta);
    } else if (delta > 0) {
      this.addProductById(productId);
    }
  },

  syncProductCards() {
    document.querySelectorAll('.product-card[data-product-id]').forEach(card => {
      const pid = parseInt(card.getAttribute('data-product-id'), 10);
      const slot = card.querySelector('.card-action-slot');
      if (!slot) return;

      const qty = this.getProductQty(pid);
      const prod = window.productsMap && window.productsMap[pid];

      if (qty > 0) {
        slot.innerHTML = `
          <div class="card-qty-stepper" data-product-id="${pid}">
            <button type="button" class="card-qty-btn minus" onclick="event.stopPropagation(); Cart.updateProductQty(${pid}, -1)" title="Decrease quantity" aria-label="Decrease quantity">−</button>
            <span class="card-qty-value">${qty}</span>
            <button type="button" class="card-qty-btn plus" onclick="event.stopPropagation(); Cart.updateProductQty(${pid}, 1)" title="Increase quantity" aria-label="Increase quantity">+</button>
          </div>
        `;
      } else {
        const isOutOfStock = prod && prod.stock !== undefined && prod.stock <= 0;
        if (isOutOfStock) {
          slot.innerHTML = `
            <button type="button" class="btn-add-bag" disabled style="opacity: 0.6; cursor: not-allowed; background: var(--color-text-muted);">
              Sold Out
            </button>
          `;
        } else {
          slot.innerHTML = `
            <button type="button" class="btn-add-bag" onclick="event.stopPropagation(); Cart.addProductById(${pid})">
              <span>+</span> Add to Bag
            </button>
          `;
        }
      }
    });
  },

  setOrderType(type) {
    this.orderType = type;
    this.deliveryFee = type === 'pickup' ? 0.00 : 5.00;
    this.render();
  },

  async applyCoupon(code) {
    if (!code || !code.trim()) return;
    try {
      const subtotal = this.getSubtotal();
      const res = await API.validateCoupon(code.trim().toUpperCase(), subtotal);
      if (res.success) {
        this.coupon = res;
        UI.showToast(`Promo applied: -${res.discount_percent ? res.discount_percent + '%' : '$' + res.discount_amount}`, 'success');
        this.render();
      }
    } catch (err) {
      UI.showToast(err.message || 'Invalid coupon code', 'error');
    }
  },

  removeCoupon() {
    this.coupon = null;
    this.render();
  },

  getSubtotal() {
    return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  },

  getDiscount() {
    if (!this.coupon) return 0;
    const subtotal = this.getSubtotal();
    if (this.coupon.discount_percent > 0) {
      return Math.round(((this.coupon.discount_percent / 100) * subtotal) * 100) / 100;
    }
    return Math.min(subtotal, this.coupon.discount_amount || 0);
  },

  getDeliveryFee() {
    if (this.orderType === 'pickup') return 0;
    // Free delivery over $40 or FREESHIP coupon
    if (this.getSubtotal() >= 40 || (this.coupon && this.coupon.code === 'FREESHIP')) {
      return 0;
    }
    return this.deliveryFee;
  },

  getTotal() {
    const sub = this.getSubtotal();
    const disc = this.getDiscount();
    const fee = this.getDeliveryFee();
    return Math.max(0, Math.round((sub - disc + fee) * 100) / 100);
  },

  openDrawer() {
    document.getElementById('cartDrawerBackdrop')?.classList.add('active');
    document.getElementById('cartDrawer')?.classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  closeDrawer() {
    document.getElementById('cartDrawerBackdrop')?.classList.remove('active');
    document.getElementById('cartDrawer')?.classList.remove('active');
    document.body.style.overflow = '';
  },

  render() {
    const count = this.items.reduce((sum, it) => sum + it.quantity, 0);
    const subtotal = this.getSubtotal();
    const discount = this.getDiscount();
    const delivery = this.getDeliveryFee();
    const total = this.getTotal();

    // Update cart badges
    document.querySelectorAll('.cart-counter-badge').forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    });

    // Mobile sticky bar total
    const stickyTotalEl = document.getElementById('stickyCartTotal');
    if (stickyTotalEl) {
      stickyTotalEl.textContent = `$${total.toFixed(2)}`;
    }
    const stickyCountEl = document.getElementById('stickyCartCount');
    if (stickyCountEl) {
      stickyCountEl.textContent = `Bag (${count})`;
    }

    // Synchronize stepper controls on storefront product cards
    this.syncProductCards();

    // Render Drawer Items List
    const listEl = document.getElementById('cartDrawerItemsList');
    if (!listEl) return;

    if (this.items.length === 0) {
      listEl.innerHTML = `
        <div class="cart-empty-message">
          <div class="cart-empty-icon">🥐</div>
          <h4>Your bag is empty</h4>
          <p>Treat yourself to warm artisan sourdough or a custom celebration cake.</p>
          <button class="btn btn-primary btn-sm" style="margin-top: 1rem;" onclick="Cart.closeDrawer(); window.location.hash='#catalog';">Browse Daily Bakes</button>
        </div>
      `;
    } else {
      listEl.innerHTML = this.items.map((item, idx) => `
        <div class="cart-item-row">
          <img src="${item.image_url}" alt="${item.title}" class="cart-item-img">
          <div class="cart-item-details">
            <h5 class="cart-item-name">${item.title}</h5>
            ${item.custom_details ? `<div class="cart-item-meta" style="color: var(--color-terracotta);">${item.custom_details}</div>` : `<div class="cart-item-meta">${item.category}</div>`}
            <div class="cart-item-price">$${(item.price * item.quantity).toFixed(2)}</div>
            <div class="cart-item-qty-controls">
              <button class="qty-btn" onclick="Cart.updateQty(${idx}, -1)">−</button>
              <span style="font-weight: 700; font-size: 0.85rem; padding: 0 6px;">${item.quantity}</span>
              <button class="qty-btn" onclick="Cart.updateQty(${idx}, 1)">+</button>
              <button class="qty-btn" style="margin-left: 8px; color: var(--color-danger); border: none;" onclick="Cart.removeItem(${idx})" title="Remove">✕</button>
            </div>
          </div>
        </div>
      `).join('');
    }

    // Totals Table in Drawer
    const subtotalEl = document.getElementById('cartDrawerSubtotal');
    if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;

    const discountRowEl = document.getElementById('cartDrawerDiscountRow');
    const discountValEl = document.getElementById('cartDrawerDiscount');
    if (discountRowEl && discountValEl) {
      if (discount > 0) {
        discountRowEl.style.display = 'flex';
        discountValEl.textContent = `-$${discount.toFixed(2)}`;
      } else {
        discountRowEl.style.display = 'none';
      }
    }

    const deliveryValEl = document.getElementById('cartDrawerDelivery');
    if (deliveryValEl) {
      deliveryValEl.textContent = delivery === 0 ? 'FREE' : `$${delivery.toFixed(2)}`;
    }

    const grandTotalEl = document.getElementById('cartDrawerTotal');
    if (grandTotalEl) grandTotalEl.textContent = `$${total.toFixed(2)}`;
  },

  attachEvents() {
    // Open cart drawer
    document.querySelectorAll('.open-cart-btn').forEach(btn => {
      btn.addEventListener('click', () => this.openDrawer());
    });

    // Close cart drawer
    document.querySelectorAll('.close-cart-btn').forEach(btn => {
      btn.addEventListener('click', () => this.closeDrawer());
    });

    // Backdrop click
    document.getElementById('cartDrawerBackdrop')?.addEventListener('click', () => this.closeDrawer());

    // Switch pickup / delivery
    document.querySelectorAll('[data-order-type]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('[data-order-type]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.setOrderType(btn.dataset.orderType);
      });
    });

    // Coupon form
    const couponForm = document.getElementById('cartPromoForm');
    if (couponForm) {
      couponForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('cartPromoInput');
        if (input && input.value) {
          this.applyCoupon(input.value);
        }
      });
    }

    // Checkout Trigger
    document.getElementById('btnProceedToCheckout')?.addEventListener('click', () => {
      if (this.items.length === 0) {
        UI.showToast('Your bag is empty. Add a cake or pastry first!', 'error');
        return;
      }
      this.closeDrawer();
      Checkout.open();
    });
  }
};
window.Cart = Cart;

// -----------------------------------------------------------------------------
// 3. Checkout Controller
// -----------------------------------------------------------------------------
const Checkout = {
  open() {
    this.renderSummary();
    UI.openModal('checkoutModal');
  },

  renderSummary() {
    const subtotal = Cart.getSubtotal();
    const discount = Cart.getDiscount();
    const delivery = Cart.getDeliveryFee();
    const total = Cart.getTotal();

    const sumEl = document.getElementById('checkoutOrderSummaryList');
    if (sumEl) {
      sumEl.innerHTML = Cart.items.map(it => `
        <div style="display: flex; justify-content: space-between; font-size: 0.88rem; margin-bottom: 6px;">
          <span>${it.quantity}x ${it.title}</span>
          <span style="font-weight: 600;">$${(it.price * it.quantity).toFixed(2)}</span>
        </div>
      `).join('');
    }

    const totalEl = document.getElementById('checkoutFinalTotal');
    if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;

    // Set default scheduled date to today
    const dateInput = document.getElementById('checkoutDate');
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
  },

  async submitOrder(formData) {
    try {
      const orderData = {
        customer_name: formData.name,
        customer_email: formData.email,
        customer_phone: formData.phone,
        order_type: Cart.orderType,
        scheduled_date: formData.date,
        scheduled_time: formData.timeSlot,
        delivery_address: Cart.orderType === 'delivery' ? formData.address : 'Store Counter Pickup',
        items: Cart.items,
        subtotal: Cart.getSubtotal(),
        discount: Cart.getDiscount(),
        delivery_fee: Cart.getDeliveryFee(),
        total_amount: Cart.getTotal(),
        payment_method: formData.paymentMethod,
        chef_notes: formData.notes || ''
      };

      const res = await API.createOrder(orderData);
      if (res.success) {
        // Clear Cart
        Cart.items = [];
        Cart.coupon = null;
        Cart.save();
        Cart.render();

        UI.closeModal('checkoutModal');
        OrderTracker.showConfirmation(res.order_number, res.total_amount, res.points_earned);
      }
    } catch (err) {
      UI.showToast(err.message || 'Failed to complete order', 'error');
    }
  }
};
window.Checkout = Checkout;

// -----------------------------------------------------------------------------
// 4. Order Tracker
// -----------------------------------------------------------------------------
const OrderTracker = {
  showConfirmation(orderNumber, total, points) {
    const modal = document.getElementById('orderConfirmationModal');
    if (!modal) return;

    document.getElementById('confOrderNumber').textContent = orderNumber;
    document.getElementById('confTotal').textContent = `$${total.toFixed(2)}`;
    document.getElementById('confPoints').textContent = `+${points} Crumb Points Earned!`;

    UI.openModal('orderConfirmationModal');
  },

  async track(orderNumber) {
    if (!orderNumber || !orderNumber.trim()) {
      UI.showToast('Please provide an order number (e.g. CT-89241)', 'error');
      return;
    }

    try {
      const res = await API.getOrderByNumber(orderNumber.trim().toUpperCase());
      if (res.success && res.order) {
        this.renderTrackingModal(res.order);
        UI.openModal('orderTrackingModal');
      }
    } catch (err) {
      UI.showToast(err.message || 'Order not found. Please double check the ID.', 'error');
    }
  },

  renderTrackingModal(order) {
    document.getElementById('trackOrderCode').textContent = order.order_number;
    document.getElementById('trackCustomerName').textContent = order.customer_name;
    document.getElementById('trackSchedule').textContent = `${order.scheduled_date} (${order.scheduled_time})`;
    document.getElementById('trackTotal').textContent = `$${order.total_amount.toFixed(2)}`;
    document.getElementById('trackChefNotes').textContent = order.chef_notes || 'All ingredients weighed & prepared with European butter.';

    // Progress Stepper Status
    const steps = ['Pending', 'In Baking', 'Decorating', 'Ready', 'Delivered'];
    const currentIdx = steps.indexOf(order.status);

    const stepEls = document.querySelectorAll('.tracking-stepper .step-item');
    stepEls.forEach((el, idx) => {
      el.classList.remove('completed', 'active');
      if (idx < currentIdx) {
        el.classList.add('completed');
      } else if (idx === currentIdx) {
        el.classList.add('active');
      }
    });

    // Render items list inside tracker
    const itemsEl = document.getElementById('trackOrderItemsList');
    if (itemsEl && order.items) {
      itemsEl.innerHTML = order.items.map(it => `
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 4px 0;">
          <span>${it.quantity}x ${it.title} ${it.custom_details ? `(${it.custom_details})` : ''}</span>
          <span style="font-weight: 600;">$${(it.price * it.quantity).toFixed(2)}</span>
        </div>
      `).join('');
    }
  }
};
window.OrderTracker = OrderTracker;

// -----------------------------------------------------------------------------
// 5. Main App Startup & Catalog Filters
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  Cart.init();

  // Load Products Catalog
  let currentCategory = 'All';
  let currentDietary = 'All';
  let currentSort = 'featured';
  let currentSearch = '';

  const renderProducts = async () => {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
        <div style="font-size: 1.8rem; margin-bottom: 0.5rem;">🥐</div>
        <p>Baking fresh selections...</p>
      </div>
    `;

    try {
      const res = await API.getProducts({
        category: currentCategory,
        dietary: currentDietary,
        sort: currentSort,
        search: currentSearch
      });

      if (!res.success || res.products.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 3.5rem;">
            <h3>No bakes found matching criteria</h3>
            <p style="color: var(--color-text-muted); margin-top: 0.5rem;">Try choosing a different category or clearing search filters.</p>
            <button class="btn btn-secondary btn-sm" style="margin-top: 1rem;" onclick="document.querySelector('[data-category=\\'All\\']').click();">Reset Filters</button>
          </div>
        `;
        return;
      }

      window.productsMap = window.productsMap || {};
      res.products.forEach(p => {
        window.productsMap[p.id] = p;
      });

      grid.innerHTML = res.products.map(p => {
        const qty = Cart.getProductQty(p.id);
        const isOutOfStock = p.stock !== undefined && p.stock <= 0;
        return `
        <div class="product-card" data-product-id="${p.id}">
          <div class="card-image-box">
            <img src="${p.image_url}" alt="${p.title}" loading="lazy">
            ${p.badge ? `<span class="card-tag-pill">${p.badge}</span>` : ''}
            ${p.dietary_tags ? `<span class="card-dietary-badge">${p.dietary_tags.split(',')[0]}</span>` : ''}
          </div>
          <div class="card-body">
            <div class="card-category-meta">${p.category}</div>
            <h4 class="card-title">${p.title}</h4>
            <p class="card-description">${p.description}</p>
            <div class="card-rating-row">
              <span class="rating-stars">★ ${p.rating.toFixed(1)}</span>
              <span>(${p.review_count} reviews)</span>
            </div>
            <div class="card-footer">
              <div class="card-price">$${p.price.toFixed(2)}</div>
              <div class="card-action-slot" data-product-id="${p.id}">
                ${qty > 0 ? `
                  <div class="card-qty-stepper" data-product-id="${p.id}">
                    <button type="button" class="card-qty-btn minus" onclick="event.stopPropagation(); Cart.updateProductQty(${p.id}, -1)" title="Decrease quantity" aria-label="Decrease quantity">−</button>
                    <span class="card-qty-value">${qty}</span>
                    <button type="button" class="card-qty-btn plus" onclick="event.stopPropagation(); Cart.updateProductQty(${p.id}, 1)" title="Increase quantity" aria-label="Increase quantity">+</button>
                  </div>
                ` : isOutOfStock ? `
                  <button type="button" class="btn-add-bag" disabled style="opacity: 0.6; cursor: not-allowed; background: var(--color-text-muted);">
                    Sold Out
                  </button>
                ` : `
                  <button type="button" class="btn-add-bag" onclick="event.stopPropagation(); Cart.addProductById(${p.id})">
                    <span>+</span> Add to Bag
                  </button>
                `}
              </div>
            </div>
          </div>
        </div>
      `;
      }).join('');
    } catch (err) {
      grid.innerHTML = `<div style="grid-column: 1 / -1; color: var(--color-danger); text-align: center;">Error loading products: ${err.message}</div>`;
    }
  };

  // Category Pills
  document.querySelectorAll('[data-category]').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('[data-category]').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentCategory = pill.dataset.category;
      renderProducts();
    });
  });

  // Dietary Dropdown
  document.getElementById('dietaryFilterSelect')?.addEventListener('change', (e) => {
    currentDietary = e.target.value;
    renderProducts();
  });

  // Sort Dropdown
  document.getElementById('sortFilterSelect')?.addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderProducts();
  });

  // Search Input with Debounce
  let searchTimeout;
  document.getElementById('catalogSearchInput')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentSearch = e.target.value.trim();
      renderProducts();
    }, 280);
  });

  // Initial render
  renderProducts();

  // Initialize Custom Cake Studio Engine
  if (window.CakeStudio) {
    window.CakeStudio.init();
  }

  // Open Custom Cake Studio Modal
  document.querySelectorAll('.btn-launch-cake-studio').forEach(btn => {
    btn.addEventListener('click', () => {
      UI.openModal('cakeStudioModal');
    });
  });

  // Logistics Zip Checker
  const zipInput = document.getElementById('deliveryZipInput');
  const zipBtn = document.getElementById('btnCheckZip');
  const zipResult = document.getElementById('zipCheckResult');

  if (zipBtn && zipInput && zipResult) {
    zipBtn.addEventListener('click', () => {
      const code = zipInput.value.trim();
      if (!code || code.length < 5) {
        zipResult.innerHTML = '<span class="status-unavailable">Please enter a valid 5-digit ZIP code.</span>';
        return;
      }
      // Demo validation: Covered zones
      zipResult.innerHTML = `
        <span class="status-available">
          ✓ Delivery Available for ${code}! Same-Day Hand-Delivery via Chilled Van (Orders placed before 2:00 PM).
        </span>
      `;
    });
  }

  // Checkout Form Submission
  const checkoutForm = document.getElementById('checkoutForm');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = {
        name: document.getElementById('checkoutName').value.trim(),
        email: document.getElementById('checkoutEmail').value.trim(),
        phone: document.getElementById('checkoutPhone').value.trim(),
        date: document.getElementById('checkoutDate').value,
        timeSlot: document.getElementById('checkoutTimeSlot').value,
        address: document.getElementById('checkoutAddress')?.value.trim() || '',
        paymentMethod: document.querySelector('input[name="paymentMethod"]:checked')?.value || 'Credit Card',
        notes: document.getElementById('checkoutNotes')?.value.trim() || ''
      };
      Checkout.submitOrder(formData);
    });
  }

  // Quick Order Lookup (In Header or Footer)
  document.getElementById('orderTrackForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = document.getElementById('orderTrackInput')?.value;
    OrderTracker.track(code);
  });

  // Custom Event Inquiry Form
  const inquiryForm = document.getElementById('customInquiryForm');
  if (inquiryForm) {
    inquiryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const payload = {
          name: document.getElementById('inqName').value.trim(),
          email: document.getElementById('inqEmail').value.trim(),
          phone: document.getElementById('inqPhone').value.trim(),
          event_date: document.getElementById('inqDate').value,
          guest_count: parseInt(document.getElementById('inqGuests').value || 50),
          cake_theme: document.getElementById('inqTheme').value.trim(),
          budget_range: document.getElementById('inqBudget').value,
          notes: document.getElementById('inqNotes').value.trim()
        };

        const res = await API.submitInquiry(payload);
        if (res.success) {
          UI.showToast(res.message, 'success');
          inquiryForm.reset();
        }
      } catch (err) {
        UI.showToast(err.message || 'Error sending inquiry', 'error');
      }
    });
  }

  // FAQ Accordion Handlers
  document.querySelectorAll('.faq-accordion-item .faq-header').forEach(header => {
    header.addEventListener('click', () => {
      const item = header.parentElement;
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-accordion-item').forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });

  // Modal Close Handlers (Buttons & Backdrop click)
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = btn.closest('.modal-backdrop');
      if (modal) modal.classList.remove('active');
      document.body.style.overflow = '';
    });
  });

  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  });

  // Review Submission Modal
  const reviewForm = document.getElementById('reviewSubmitForm');
  if (reviewForm) {
    reviewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const payload = {
          product_id: parseInt(document.getElementById('revProductId').value || 8),
          customer_name: document.getElementById('revName').value.trim(),
          rating: parseInt(document.querySelector('input[name="revRating"]:checked')?.value || 5),
          comment: document.getElementById('revComment').value.trim()
        };
        const res = await API.submitReview(payload);
        if (res.success) {
          UI.showToast(res.message, 'success');
          UI.closeModal('writeReviewModal');
          reviewForm.reset();
        }
      } catch (err) {
        UI.showToast(err.message || 'Error submitting review', 'error');
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 6. Header Color Change & Dynamic Red Active Scrollspy Indicator
  // ---------------------------------------------------------------------------
  initScrollspy();
});

function initScrollspy() {
  const header = document.querySelector('.site-header');
  const navContainer = document.querySelector('.main-nav');
  const indicator = document.getElementById('navIndicatorBar');
  const navLinks = Array.from(document.querySelectorAll('.main-nav .nav-link'));

  if (!navContainer || navLinks.length === 0) return;

  const sectionMap = [];
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.startsWith('#')) {
      const target = document.querySelector(href);
      if (target) {
        sectionMap.push({ id: href, section: target, link: link });
      }
    }
  });

  if (sectionMap.length === 0) return;

  function moveIndicatorToLink(link) {
    if (!indicator || !link) return;
    navContainer.classList.add('has-indicator');

    // Use link's offsetLeft and offsetWidth relative to navContainer
    const linkLeft = link.offsetLeft;
    const linkWidth = link.offsetWidth;

    indicator.style.left = `${linkLeft}px`;
    indicator.style.width = `${linkWidth}px`;
    indicator.style.opacity = '1';

    // Auto-scroll nav container on small screens so active tab stays centered & in view
    if (navContainer.scrollWidth > navContainer.clientWidth) {
      const targetScroll = linkLeft - (navContainer.clientWidth / 2) + (linkWidth / 2);
      navContainer.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' });
    }
  }

  function setActiveLink(activeLink) {
    if (!activeLink) return;
    navLinks.forEach(l => l.classList.remove('active'));
    activeLink.classList.add('active');
    moveIndicatorToLink(activeLink);
  }

  let ticking = false;

  function onScroll() {
    const scrollY = window.scrollY;

    // 1. Header background color & shadow transition on scroll
    if (header) {
      if (scrollY > 15) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }

    // 2. Identify active section dynamically based on current scroll position
    let activeItem = null;

    // A. At top of page (Hero banner) -> Always highlight first section (Daily Bakes)
    if (scrollY < 200) {
      activeItem = sectionMap[0];
    }
    // B. At or near bottom of page -> Always highlight last section (Inquiries)
    else if ((window.innerHeight + scrollY) >= (document.documentElement.scrollHeight - 60)) {
      activeItem = sectionMap[sectionMap.length - 1];
    }
    // C. Intermediate sections: find which section currently bounds the scroll trigger line
    else {
      // Trigger line positioned 160px from top of viewport (clearance below header)
      const triggerY = scrollY + 160;

      for (let i = sectionMap.length - 1; i >= 0; i--) {
        const item = sectionMap[i];
        const sectionTop = item.section.getBoundingClientRect().top + scrollY;
        if (triggerY >= sectionTop - 15) {
          activeItem = item;
          break;
        }
      }

      if (!activeItem) {
        activeItem = sectionMap[0];
      }
    }

    if (activeItem && !activeItem.link.classList.contains('active')) {
      setActiveLink(activeItem.link);
    }
  }

  function requestScrollUpdate() {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        onScroll();
        ticking = false;
      });
      ticking = true;
    }
  }

  // Smooth click navigation
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          setActiveLink(link);
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });

  window.addEventListener('scroll', requestScrollUpdate, { passive: true });
  window.addEventListener('resize', () => {
    const active = document.querySelector('.main-nav .nav-link.active') || navLinks[0];
    if (active) moveIndicatorToLink(active);
  }, { passive: true });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      const active = document.querySelector('.main-nav .nav-link.active') || navLinks[0];
      if (active) moveIndicatorToLink(active);
    });
  }

  // Initial trigger after layout paint
  setTimeout(() => {
    onScroll();
    const active = document.querySelector('.main-nav .nav-link.active') || navLinks[0];
    if (active) {
      setActiveLink(active);
    }
  }, 60);

  setTimeout(() => {
    const active = document.querySelector('.main-nav .nav-link.active') || navLinks[0];
    if (active) moveIndicatorToLink(active);
  }, 350);

  // Global helper to refresh indicator (e.g. after mode switches)
  window.refreshScrollspy = () => {
    onScroll();
    const active = document.querySelector('.main-nav .nav-link.active') || navLinks[0];
    if (active) moveIndicatorToLink(active);
  };
}

