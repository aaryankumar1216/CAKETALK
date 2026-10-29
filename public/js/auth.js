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
    this.attachEvents();
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
      { id: 'tabBtnOwnerLogin', target: 'owner-login' }
    ];

    tabBtns.forEach(t => {
      const btn = document.getElementById(t.id);
      if (btn) {
        if (
          t.target === tabId ||
          (tabId === 'customer-register' && t.target === 'customer-login') ||
          (tabId === 'owner-register' && t.target === 'owner-login')
        ) {
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

  autofillPhone() {
    const phoneEl = document.getElementById('custOtpPhone');
    if (phoneEl) phoneEl.value = '9876543210';
    this.clearError();
  },

  setCustLoginMethod(method) {
    this.clearError();
    const btnOtp = document.getElementById('btnMethodOtp');
    const btnPass = document.getElementById('btnMethodPassword');
    const secOtp = document.getElementById('custOtpSection');
    const secPass = document.getElementById('custPasswordSection');

    if (method === 'otp') {
      if (btnOtp) btnOtp.classList.add('active');
      if (btnPass) btnPass.classList.remove('active');
      if (secOtp) secOtp.style.display = 'block';
      if (secPass) secPass.style.display = 'none';
    } else {
      if (btnPass) btnPass.classList.add('active');
      if (btnOtp) btnOtp.classList.remove('active');
      if (secPass) secPass.style.display = 'block';
      if (secOtp) secOtp.style.display = 'none';
    }
  },

  async requestOTP() {
    this.clearError();
    const phoneEl = document.getElementById('custOtpPhone');
    const phone = phoneEl ? phoneEl.value.replace(/\D/g, '') : '';

    if (!phone || phone.length < 10) {
      this.showError('Please enter a valid 10-digit mobile number to receive your OTP.');
      return;
    }

    const btnSend = document.getElementById('btnSendOtp');
    if (btnSend) {
      btnSend.disabled = true;
      btnSend.textContent = 'Sending OTP...';
    }

    try {
      const res = await API.sendOTP(phone);
      if (res.success) {
        // Show verification section
        const verSec = document.getElementById('custOtpVerificationSection');
        if (verSec) verSec.style.display = 'block';

        const demoPill = document.getElementById('demoOtpPill');
        if (demoPill) demoPill.textContent = `Demo Code: ${res.otp}`;

        // Pre-fill OTP input for instant testing
        const codeInput = document.getElementById('custOtpCode');
        if (codeInput) {
          codeInput.value = res.otp;
          codeInput.focus();
        }

        if (window.UI) {
          UI.showToast(`📲 Simulated SMS: Your CakeTalk verification code is ${res.otp}`, 'success');
        }

        // Start countdown timer
        this.startOtpCountdown(30);

        if (btnSend) {
          btnSend.textContent = 'OTP Sent ✓';
          btnSend.style.background = '#28a745';
        }
      }
    } catch (err) {
      this.showError(err.message || 'Failed to send OTP. Please try again.');
      if (btnSend) {
        btnSend.disabled = false;
        btnSend.textContent = 'Send Login OTP 📲';
      }
    }
  },

  startOtpCountdown(seconds = 30) {
    if (this.otpCountdownInterval) {
      clearInterval(this.otpCountdownInterval);
    }

    let timeLeft = seconds;
    const timerLabel = document.getElementById('otpCountdownLabel');
    const timerSec = document.getElementById('otpTimerSec');
    const resendBtn = document.getElementById('btnResendOtp');

    if (timerLabel) timerLabel.style.display = 'inline';
    if (resendBtn) resendBtn.style.display = 'none';

    this.otpCountdownInterval = setInterval(() => {
      timeLeft--;
      if (timerSec) timerSec.textContent = timeLeft;

      if (timeLeft <= 0) {
        clearInterval(this.otpCountdownInterval);
        if (timerLabel) timerLabel.style.display = 'none';
        if (resendBtn) resendBtn.style.display = 'inline';
        const btnSend = document.getElementById('btnSendOtp');
        if (btnSend) {
          btnSend.disabled = false;
          btnSend.textContent = 'Resend OTP 📲';
          btnSend.style.background = '';
        }
      }
    }, 1000);
  },

  async verifyOTP() {
    this.clearError();
    const phoneEl = document.getElementById('custOtpPhone');
    const codeEl = document.getElementById('custOtpCode');

    const phone = phoneEl ? phoneEl.value.replace(/\D/g, '') : '';
    const code = codeEl ? codeEl.value.trim() : '';

    if (!phone || phone.length < 10) {
      this.showError('Please enter your 10-digit mobile number.');
      return;
    }

    if (!code || code.length !== 6) {
      this.showError('Please enter the 6-digit verification code.');
      return;
    }

    const btnVerify = document.getElementById('btnVerifyOtp');
    if (btnVerify) {
      btnVerify.disabled = true;
      btnVerify.textContent = 'Verifying code...';
    }

    try {
      const res = await API.verifyOTP(phone, code);
      if (res.success && res.user) {
        this.currentUser = res.user;
        this.updateUI();

        if (this.otpCountdownInterval) {
          clearInterval(this.otpCountdownInterval);
        }

        if (window.UI) {
          UI.showToast(res.message || `Welcome to CakeTalk, ${res.user.name}!`, 'success');
        }

        if (window.switchWebsiteMode) {
          switchWebsiteMode('customer');
        }
      }
    } catch (err) {
      this.showError(err.message || 'OTP verification failed. Please check the code.');
      if (btnVerify) {
        btnVerify.disabled = false;
        btnVerify.textContent = 'Verify Code & Sign In 🛍️';
      }
    }
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

    if (window.UI) {
      UI.showToast('You have been signed out successfully.', 'info');
    }

    // Return to the login entry page
    if (window.switchWebsiteMode) {
      switchWebsiteMode('login');
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
