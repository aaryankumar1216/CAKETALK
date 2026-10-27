/**
 * CakeTalk Bakery Platform - Authenticated User & Access Control System
 * Manages Customer and Bakery Owner sign in, new customer registration,
 * role-based route protection, and user profile widgets.
 */

const AuthApp = {
  currentUser: null,

  init() {
    this.currentUser = API.getCurrentUser();
    this.updateUI();
    this.updateSessionBanner();
    this.attachEvents();
  },

  updateSessionBanner() {
    const banner = document.getElementById('loginActiveSessionBanner');
    const nameEl = document.getElementById('sessionUserName');
    const roleEl = document.getElementById('sessionUserRole');
    const resumeBtn = document.getElementById('btnResumeSession');

    if (!banner) return;

    if (this.currentUser && this.currentUser.name) {
      const isOwner = this.currentUser.role === 'admin' || this.currentUser.role === 'owner';
      banner.style.display = 'flex';
      if (nameEl) nameEl.textContent = this.currentUser.name;
      if (roleEl) {
        roleEl.textContent = isOwner 
          ? '👑 Bakery Owner Suite (Active Staff Session)' 
          : `🛍️ Customer Account • ${this.currentUser.loyalty_points || 50} Crumb Points`;
      }
      if (resumeBtn) {
        resumeBtn.textContent = isOwner ? 'Enter Owner Suite 👑' : 'Resume Storefront 🛍️';
      }
    } else {
      banner.style.display = 'none';
    }
  },

  updateUI() {
    const user = this.currentUser;

    const btnLogin = document.getElementById('btnHeaderLogin');
    const userWidget = document.getElementById('userProfileWidget');
    const drawerLoggedOut = document.getElementById('mobileDrawerLoggedOut');
    const drawerLoggedIn = document.getElementById('mobileDrawerLoggedIn');
    const drawerOwnerLink = document.getElementById('drawerOwnerLinkWrapper');
    const ownerDropdownLink = document.getElementById('ownerSuiteLinkWrapper');
    const stickyAccountLabel = document.getElementById('stickyTabAccountLabel');

    if (user && user.name) {
      const isOwner = user.role === 'admin' || user.role === 'owner';

      // Header widget
      if (btnLogin) btnLogin.style.display = 'none';
      if (userWidget) userWidget.style.display = 'block';

      const navName = document.getElementById('userNameLabel');
      if (navName) navName.textContent = user.name.split(' ')[0];

      const navBadge = document.getElementById('userRolePill');
      if (navBadge) {
        navBadge.textContent = isOwner ? 'Owner' : 'Customer';
        navBadge.className = isOwner ? 'user-role-pill owner' : 'user-role-pill';
      }

      const dropName = document.getElementById('dropdownUserName');
      if (dropName) dropName.textContent = user.name;

      const dropEmail = document.getElementById('dropdownUserEmail');
      if (dropEmail) dropEmail.textContent = user.email || user.phone || '';

      const dropPoints = document.getElementById('dropdownUserPoints');
      if (dropPoints) {
        dropPoints.textContent = isOwner ? '👑 Master Bakery Staff' : `🏅 ${user.loyalty_points || 50} Crumb Points`;
      }

      if (ownerDropdownLink) {
        ownerDropdownLink.style.display = isOwner ? 'block' : 'none';
      }

      // Mobile Drawer
      if (drawerLoggedOut) drawerLoggedOut.style.display = 'none';
      if (drawerLoggedIn) drawerLoggedIn.style.display = 'block';

      const drawerName = document.getElementById('drawerUserName');
      if (drawerName) drawerName.textContent = user.name;

      const drawerRole = document.getElementById('drawerUserRole');
      if (drawerRole) {
        drawerRole.textContent = isOwner ? '👑 Bakery Owner Suite' : `🛍️ Customer • ${user.loyalty_points || 50} Crumb Pts`;
      }

      if (drawerOwnerLink) {
        drawerOwnerLink.style.display = isOwner ? 'block' : 'none';
      }

      if (stickyAccountLabel) {
        stickyAccountLabel.textContent = isOwner ? 'Owner' : 'Account';
      }
    } else {
      // Logged out state
      if (btnLogin) btnLogin.style.display = 'inline-flex';
      if (userWidget) userWidget.style.display = 'none';
      if (drawerLoggedOut) drawerLoggedOut.style.display = 'block';
      if (drawerLoggedIn) drawerLoggedIn.style.display = 'none';
      if (drawerOwnerLink) drawerOwnerLink.style.display = 'none';
      if (ownerDropdownLink) ownerDropdownLink.style.display = 'none';

      if (stickyAccountLabel) {
        stickyAccountLabel.textContent = 'Login';
      }
    }
  },

  attachEvents() {
    // Close user dropdown on outside click
    document.addEventListener('click', (e) => {
      const widget = document.getElementById('userProfileWidget');
      const menu = document.getElementById('userMenuDropdown');
      if (menu && widget && !widget.contains(e.target)) {
        menu.style.display = 'none';
      }
    });
  },

  toggleMenu() {
    const menu = document.getElementById('userMenuDropdown');
    if (!menu) return;
    menu.style.display = menu.style.display === 'none' || !menu.style.display ? 'block' : 'none';
  },

  closeMenu() {
    const menu = document.getElementById('userMenuDropdown');
    if (menu) menu.style.display = 'none';
  },

  openModal(tab = 'customer-login') {
    this.clearError();
    this.switchTab(tab);
    if (window.switchWebsiteMode) {
      switchWebsiteMode('login', tab);
    } else if (window.UI) {
      UI.openModal('authModal');
    }
  },

  switchTab(tabId) {
    this.clearError();

    const panes = ['customer-login', 'owner-login', 'customer-register', 'owner-register'];
    panes.forEach(p => {
      const paneEl = document.getElementById(`authPane${this.capitalize(p)}`);
      if (paneEl) paneEl.classList.remove('active');
    });

    const tabBtns = [
      { id: 'tabBtnCustomerLogin', target: 'customer-login' },
      { id: 'tabBtnOwnerLogin', target: 'owner-login' },
      { id: 'tabBtnRegister', target: 'customer-register' }
    ];

    tabBtns.forEach(t => {
      const btn = document.getElementById(t.id);
      if (btn) {
        if (t.target === tabId || (tabId === 'owner-register' && t.target === 'owner-login')) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
    });

    const activePane = document.getElementById(`authPane${this.capitalize(tabId)}`);
    if (activePane) {
      activePane.classList.add('active');
    }
  },

  capitalize(str) {
    return str.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
  },

  showError(message) {
    const banner = document.getElementById('authErrorBanner');
    if (banner) {
      banner.textContent = message;
      banner.style.display = 'block';
    }
  },

  clearError() {
    const banner = document.getElementById('authErrorBanner');
    if (banner) {
      banner.textContent = '';
      banner.style.display = 'none';
    }
  },

  autofillCustomer() {
    const idEl = document.getElementById('custLoginIdentifier');
    const pwEl = document.getElementById('custLoginPassword');
    if (idEl) idEl.value = 'customer@caketalk.com';
    if (pwEl) pwEl.value = 'customer123';
    this.clearError();
  },

  autofillOwner() {
    const idEl = document.getElementById('ownerLoginIdentifier');
    const pwEl = document.getElementById('ownerLoginPassword');
    const pinEl = document.getElementById('ownerLoginPin');
    if (idEl) idEl.value = 'owner@caketalk.com';
    if (pwEl) pwEl.value = 'owner123';
    if (pinEl) pinEl.value = '1216';
    this.clearError();
  },

  async submitCustomerLogin(e) {
    e.preventDefault();
    this.clearError();

    const id = document.getElementById('custLoginIdentifier').value.trim();
    const pw = document.getElementById('custLoginPassword').value;

    try {
      const res = await API.login(id, pw, 'customer');
      if (res.success && res.user) {
        this.currentUser = res.user;
        this.updateUI();
        this.updateSessionBanner();
        if (window.UI) {
          UI.closeModal('authModal');
          UI.showToast(`Welcome back, ${res.user.name}!`, 'success');
        }
        if (window.switchWebsiteMode) {
          switchWebsiteMode('customer');
        }
      }
    } catch (err) {
      this.showError(err.message || 'Customer sign in failed. Please check credentials.');
    }
  },

  async submitOwnerLogin(e) {
    e.preventDefault();
    this.clearError();

    const id = document.getElementById('ownerLoginIdentifier').value.trim();
    const pw = document.getElementById('ownerLoginPassword').value;

    try {
      const res = await API.login(id, pw, 'owner');
      if (res.success && res.user) {
        this.currentUser = res.user;
        this.updateUI();
        this.updateSessionBanner();
        if (window.UI) {
          UI.closeModal('authModal');
          UI.showToast(`Owner verified. Welcome to Management Suite, ${res.user.name}!`, 'success');
        }
        // Transition directly to Owner Suite
        if (window.switchWebsiteMode) {
          switchWebsiteMode('admin');
        }
      }
    } catch (err) {
      this.showError(err.message || 'Owner authentication failed. Please check Owner ID and password.');
    }
  },

  async submitCustomerRegister(e) {
    e.preventDefault();
    this.clearError();

    const name = document.getElementById('custRegName').value.trim();
    const email = document.getElementById('custRegEmail').value.trim();
    const phone = document.getElementById('custRegPhone').value.trim();
    const address = document.getElementById('custRegAddress')?.value.trim() || '';
    const password = document.getElementById('custRegPassword').value;
    const confirmPw = document.getElementById('custRegConfirmPassword').value;

    if (password !== confirmPw) {
      this.showError('Passwords do not match. Please re-enter.');
      return;
    }

    if (phone.replace(/\D/g, '').length < 10) {
      this.showError('Please enter a valid 10-digit mobile phone number.');
      return;
    }

    try {
      const res = await API.register({
        name,
        email,
        phone,
        address,
        password,
        role: 'customer'
      });

      if (res.success && res.user) {
        this.currentUser = res.user;
        this.updateUI();
        this.updateSessionBanner();
        if (window.UI) {
          UI.closeModal('authModal');
          UI.showToast(`Welcome to CakeTalk Crumb Club, ${res.user.name}! 50 Welcome Points added.`, 'success');
        }
        if (window.switchWebsiteMode) {
          switchWebsiteMode('customer');
        }
      }
    } catch (err) {
      this.showError(err.message || 'Customer registration failed. Please try again.');
    }
  },

  async submitOwnerRegister(e) {
    e.preventDefault();
    this.clearError();

    const name = document.getElementById('ownerRegName').value.trim();
    const email = document.getElementById('ownerRegEmail').value.trim();
    const phone = document.getElementById('ownerRegPhone').value.trim();
    const role = document.getElementById('ownerRegRole').value;
    const key = document.getElementById('ownerRegKey').value.trim();
    const password = document.getElementById('ownerRegPassword').value;
    const confirmPw = document.getElementById('ownerRegConfirmPassword').value;

    if (password !== confirmPw) {
      this.showError('Passwords do not match.');
      return;
    }

    try {
      const res = await API.register({
        name,
        email,
        phone,
        role: 'owner',
        store_key: key,
        password
      });

      if (res.success && res.user) {
        this.currentUser = res.user;
        this.updateUI();
        this.updateSessionBanner();
        if (window.UI) {
          UI.closeModal('authModal');
          UI.showToast(`Owner account activated for ${res.user.name}!`, 'success');
        }
        if (window.switchWebsiteMode) {
          switchWebsiteMode('admin');
        }
      }
    } catch (err) {
      this.showError(err.message || 'Staff key verification failed.');
    }
  },

  logout() {
    API.logout();
    this.currentUser = null;
    this.updateUI();
    this.updateSessionBanner();

    if (window.UI) {
      UI.showToast('You have been signed out successfully.', 'info');
    }

    // Return to the login entry page
    if (window.switchWebsiteMode) {
      switchWebsiteMode('login');
    }
  },

  resumeSession() {
    if (this.currentUser) {
      const isOwner = this.currentUser.role === 'admin' || this.currentUser.role === 'owner';
      if (window.switchWebsiteMode) {
        switchWebsiteMode(isOwner ? 'admin' : 'customer');
      }
    }
  },

  handleLogoClick() {
    if (this.currentUser) {
      const isOwner = this.currentUser.role === 'admin' || this.currentUser.role === 'owner';
      if (window.switchWebsiteMode) {
        switchWebsiteMode(isOwner ? 'admin' : 'customer');
      }
    } else {
      if (window.switchWebsiteMode) {
        switchWebsiteMode('login');
      }
    }
  },

  openOwnerSuite() {
    const user = this.currentUser;
    if (user && (user.role === 'admin' || user.role === 'owner')) {
      if (window.switchWebsiteMode) {
        switchWebsiteMode('admin');
      }
    } else {
      if (window.UI) {
        UI.showToast('Owner / Staff credentials required to enter Owner Suite.', 'info');
      }
      if (window.switchWebsiteMode) {
        switchWebsiteMode('login', 'owner-login');
      } else {
        this.openModal('owner-login');
      }
    }
  },

  handleAccountClick() {
    const user = this.currentUser;
    if (!user) {
      if (window.switchWebsiteMode) {
        switchWebsiteMode('login', 'customer-login');
      } else {
        this.openModal('customer-login');
      }
    } else if (user.role === 'admin' || user.role === 'owner') {
      this.openOwnerSuite();
    } else {
      if (window.CustomerOrders) {
        CustomerOrders.openOrdersModal();
      }
    }
  }
};

window.AuthApp = AuthApp;

// Auto-initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => AuthApp.init());
} else {
  AuthApp.init();
}
