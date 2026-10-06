/**
 * CakeTalk - Interactive Custom Cake Studio Engine
 * Dynamic SVG visualizer and step-by-step custom cake builder.
 */

class CakeStudio {
  constructor() {
    this.state = {
      sponge: {
        id: 'vanilla',
        name: 'Madagascar Vanilla Bean',
        color: '#F9E8B8',
        priceAdd: 0
      },
      size: {
        id: '8-inch',
        name: '8" Classic Celebration (10-14 Servings)',
        tiers: 1,
        multiplier: 1.0,
        basePrice: 48.00
      },
      frosting: {
        id: 'vanilla-meringue',
        name: 'Silky Vanilla Swiss Meringue',
        color: '#FFFBF2',
        priceAdd: 0
      },
      design: {
        id: 'lambeth',
        name: 'Vintage Lambeth Piping',
        priceAdd: 8.00
      },
      topper: {
        id: 'macarons',
        name: 'Parisian Macarons Crown',
        priceAdd: 8.00
      },
      inscription: 'Happy Birthday!'
    };

    this.svgContainer = null;
    this.priceElement = null;
    this.specsElement = null;
  }

  init(containerId = 'cakeStudioModal') {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.svgContainer = document.getElementById('cakeVisualizerSvg');
    this.priceElement = document.getElementById('builderCalcPrice');
    this.specsElement = document.getElementById('builderSpecsTitle');
    this.specsSubtitle = document.getElementById('builderSpecsSubtitle');

    this.attachEvents();
    this.render();
  }

  setOption(category, value) {
    if (this.state[category] !== undefined) {
      this.state[category] = value;
      this.render();
    }
  }

  setInscription(text) {
    this.state.inscription = text.slice(0, 32);
    this.render();
  }

  calculatePrice() {
    const base = this.state.size.basePrice * (this.state.size.multiplier || 1.0);
    const addons = (this.state.sponge.priceAdd || 0) +
                   (this.state.frosting.priceAdd || 0) +
                   (this.state.design.priceAdd || 0) +
                   (this.state.topper.priceAdd || 0);
    return Math.round((base + addons) * 100) / 100;
  }

  render() {
    this.renderSvg();
    this.renderSummary();
  }

  renderSummary() {
    const total = this.calculatePrice();
    if (this.priceElement) {
      this.priceElement.textContent = `$${total.toFixed(2)}`;
    }
    if (this.specsElement) {
      this.specsElement.textContent = `${this.state.size.name.split(' (')[0]} • ${this.state.sponge.name}`;
    }
    if (this.specsSubtitle) {
      this.specsSubtitle.textContent = `Design: ${this.state.design.name} | Topper: ${this.state.topper.name}`;
    }
  }

  renderSvg() {
    if (!this.svgContainer) return;

    const { sponge, size, frosting, design, topper, inscription } = this.state;
    const isTwoTier = size.tiers === 2;

    // Dimensions
    const standY = 270;
    const bottomTierY = isTwoTier ? 175 : 160;
    const bottomTierH = 85;
    const bottomTierW = 220;
    const bottomTierX = (320 - bottomTierW) / 2;

    const topTierY = 100;
    const topTierH = 75;
    const topTierW = 140;
    const topTierX = (320 - topTierW) / 2;

    let svgHtml = `
      <svg viewBox="0 0 320 340" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="cakeShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#20130C" flood-opacity="0.25"/>
          </filter>
          <linearGradient id="standGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#E2D8CC"/>
            <stop offset="50%" stop-color="#FFFFFF"/>
            <stop offset="100%" stop-color="#D0C4B4"/>
          </linearGradient>
          <linearGradient id="frostingGradBottom" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="${this.shadeColor(frosting.color, -10)}"/>
            <stop offset="35%" stop-color="${frosting.color}"/>
            <stop offset="70%" stop-color="${frosting.color}"/>
            <stop offset="100%" stop-color="${this.shadeColor(frosting.color, -15)}"/>
          </linearGradient>
          <linearGradient id="frostingGradTop" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="${this.shadeColor(frosting.color, -8)}"/>
            <stop offset="40%" stop-color="${frosting.color}"/>
            <stop offset="100%" stop-color="${this.shadeColor(frosting.color, -12)}"/>
          </linearGradient>
          <linearGradient id="goldPlate" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#C28D3F"/>
            <stop offset="50%" stop-color="#FFDF73"/>
            <stop offset="100%" stop-color="#A6732B"/>
          </linearGradient>
          <linearGradient id="dripGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#2D170B"/>
            <stop offset="100%" stop-color="#462413"/>
          </linearGradient>
        </defs>

        <!-- Pedestal Cake Stand -->
        <g id="cakeStand" filter="url(#cakeShadow)">
          <!-- Base plate -->
          <ellipse cx="160" cy="${standY + 38}" rx="80" ry="12" fill="url(#standGrad)" stroke="#C8BCAE" stroke-width="1.5"/>
          <!-- Pedestal Column -->
          <path d="M148 ${standY + 38} Q160 ${standY + 20} 154 ${standY + 12} L166 ${standY + 12} Q160 ${standY + 20} 172 ${standY + 38} Z" fill="url(#standGrad)"/>
          <!-- Top Platter -->
          <ellipse cx="160" cy="${standY + 10}" rx="135" ry="18" fill="url(#standGrad)" stroke="#B8A998" stroke-width="2"/>
          <ellipse cx="160" cy="${standY + 8}" rx="130" ry="15" fill="#FAF6EE"/>
          <!-- Gold Rim Accent -->
          <ellipse cx="160" cy="${standY + 9}" rx="132" ry="16" fill="none" stroke="url(#goldPlate)" stroke-width="2.5"/>
        </g>
    `;

    // Bottom Tier
    svgHtml += `
      <!-- Bottom Tier -->
      <g id="bottomTier" filter="url(#cakeShadow)">
        <!-- Tier Body -->
        <rect x="${bottomTierX}" y="${bottomTierY}" width="${bottomTierW}" height="${bottomTierH}" rx="10" fill="url(#frostingGradBottom)"/>
        <!-- Top Oval -->
        <ellipse cx="160" cy="${bottomTierY}" rx="${bottomTierW / 2}" ry="18" fill="${frosting.color}" stroke="${this.shadeColor(frosting.color, -10)}" stroke-width="1"/>
        <!-- Bottom Base Shadow Rim -->
        <ellipse cx="160" cy="${bottomTierY + bottomTierH}" rx="${bottomTierW / 2}" ry="12" fill="${this.shadeColor(frosting.color, -15)}" opacity="0.6"/>
    `;

    // Design: Semi-Naked Rustic Sponge peek-through
    if (design.id === 'rustic') {
      svgHtml += `
        <!-- Rustic Sponge Bands -->
        <rect x="${bottomTierX + 8}" y="${bottomTierY + 22}" width="${bottomTierW - 16}" height="8" rx="4" fill="${sponge.color}" opacity="0.85"/>
        <rect x="${bottomTierX + 12}" y="${bottomTierY + 48}" width="${bottomTierW - 24}" height="7" rx="3" fill="${sponge.color}" opacity="0.85"/>
      `;
    }

    // Design: Chocolate Drip
    if (design.id === 'drip') {
      svgHtml += `
        <!-- Chocolate Drip Bottom Tier -->
        <path d="M${bottomTierX} ${bottomTierY}
                 C${bottomTierX + 15} ${bottomTierY + 28}, ${bottomTierX + 25} ${bottomTierY + 28}, ${bottomTierX + 35} ${bottomTierY}
                 C${bottomTierX + 45} ${bottomTierY + 36}, ${bottomTierX + 55} ${bottomTierY + 36}, ${bottomTierX + 70} ${bottomTierY}
                 C${bottomTierX + 85} ${bottomTierY + 24}, ${bottomTierX + 95} ${bottomTierY + 24}, ${bottomTierX + 110} ${bottomTierY}
                 C${bottomTierX + 125} ${bottomTierY + 40}, ${bottomTierX + 138} ${bottomTierY + 40}, ${bottomTierX + 150} ${bottomTierY}
                 C${bottomTierX + 165} ${bottomTierY + 25}, ${bottomTierX + 178} ${bottomTierY + 25}, ${bottomTierX + 190} ${bottomTierY}
                 C${bottomTierX + 205} ${bottomTierY + 32}, ${bottomTierX + 215} ${bottomTierY + 32}, ${bottomTierX + bottomTierW} ${bottomTierY}
                 Z" fill="url(#dripGrad)"/>
      `;
    }

    // Design: Vintage Lambeth Piping Scallops
    if (design.id === 'lambeth') {
      svgHtml += `
        <!-- Lambeth Scallop Swags -->
        <path d="M${bottomTierX + 10} ${bottomTierY + 15} Q${bottomTierX + 45} ${bottomTierY + 35} ${bottomTierX + 80} ${bottomTierY + 15}
                 Q${bottomTierX + 115} ${bottomTierY + 35} ${bottomTierX + 150} ${bottomTierY + 15}
                 Q${bottomTierX + 185} ${bottomTierY + 35} ${bottomTierX + 210} ${bottomTierY + 15}"
                 fill="none" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round"/>
        <path d="M${bottomTierX + 10} ${bottomTierY + 25} Q${bottomTierX + 45} ${bottomTierY + 45} ${bottomTierX + 80} ${bottomTierY + 25}
                 Q${bottomTierX + 115} ${bottomTierY + 45} ${bottomTierX + 150} ${bottomTierY + 25}
                 Q${bottomTierX + 185} ${bottomTierY + 45} ${bottomTierX + 210} ${bottomTierY + 25}"
                 fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-dasharray="3,3"/>
      `;
    }

    // Design: Gold Leaf & Botanicals
    if (design.id === 'botanical') {
      svgHtml += `
        <!-- Gold Flakes -->
        <polygon points="${bottomTierX + 30},${bottomTierY + 30} ${bottomTierX + 38},${bottomTierY + 36} ${bottomTierX + 32},${bottomTierY + 42} ${bottomTierX + 25},${bottomTierY + 36}" fill="url(#goldPlate)"/>
        <polygon points="${bottomTierX + 175},${bottomTierY + 25} ${bottomTierX + 182},${bottomTierY + 32} ${bottomTierX + 178},${bottomTierY + 38}" fill="url(#goldPlate)"/>
        <polygon points="${bottomTierX + 90},${bottomTierY + 55} ${bottomTierX + 96},${bottomTierY + 60} ${bottomTierX + 92},${bottomTierY + 64}" fill="url(#goldPlate)"/>
        <!-- Blossom -->
        <circle cx="${bottomTierX + 45}" cy="${bottomTierY + 50}" r="8" fill="#F8BBD0"/>
        <circle cx="${bottomTierX + 45}" cy="${bottomTierY + 50}" r="3" fill="#FFE082"/>
      `;
    }

    svgHtml += `</g>`;

    // If 2-Tier Grand Celebration
    if (isTwoTier) {
      svgHtml += `
        <!-- Top Tier -->
        <g id="topTier" filter="url(#cakeShadow)">
          <rect x="${topTierX}" y="${topTierY}" width="${topTierW}" height="${topTierH}" rx="8" fill="url(#frostingGradTop)"/>
          <ellipse cx="160" cy="${topTierY}" rx="${topTierW / 2}" ry="14" fill="${frosting.color}" stroke="${this.shadeColor(frosting.color, -10)}" stroke-width="1"/>
      `;

      if (design.id === 'drip') {
        svgHtml += `
          <!-- Top Tier Drip -->
          <path d="M${topTierX} ${topTierY}
                   C${topTierX + 15} ${topTierY + 22}, ${topTierX + 25} ${topTierY + 22}, ${topTierX + 35} ${topTierY}
                   C${topTierX + 50} ${topTierY + 28}, ${topTierX + 60} ${topTierY + 28}, ${topTierX + 75} ${topTierY}
                   C${topTierX + 90} ${topTierY + 20}, ${topTierX + 105} ${topTierY + 20}, ${topTierX + 120} ${topTierY}
                   C${topTierX + 130} ${topTierY + 26}, ${topTierX + 135} ${topTierY + 26}, ${topTierX + topTierW} ${topTierY}
                   Z" fill="url(#dripGrad)"/>
        `;
      }

      if (design.id === 'lambeth') {
        svgHtml += `
          <path d="M${topTierX + 8} ${topTierY + 12} Q${topTierX + 40} ${topTierY + 26} ${topTierX + 70} ${topTierY + 12}
                   Q${topTierX + 100} ${topTierY + 26} ${topTierX + 132} ${topTierY + 12}"
                   fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round"/>
        `;
      }

      svgHtml += `</g>`;
    }

    // Top Toppers
    const topperApexY = isTwoTier ? topTierY : bottomTierY;

    if (topper.id === 'macarons') {
      svgHtml += `
        <!-- Macarons on crown -->
        <g id="macaronsGroup">
          <ellipse cx="130" cy="${topperApexY - 4}" rx="14" ry="9" fill="#F8BBD0" stroke="#C2185B" stroke-width="0.8"/>
          <ellipse cx="160" cy="${topperApexY - 6}" rx="15" ry="9.5" fill="#C8E6C9" stroke="#388E3C" stroke-width="0.8"/>
          <ellipse cx="190" cy="${topperApexY - 4}" rx="14" ry="9" fill="#FFF59D" stroke="#FBC02D" stroke-width="0.8"/>
        </g>
      `;
    } else if (topper.id === 'candle') {
      svgHtml += `
        <!-- Gold Sparkler Candle -->
        <g id="candleGroup">
          <rect x="157" y="${topperApexY - 40}" width="6" height="40" rx="2" fill="url(#goldPlate)"/>
          <!-- Flame -->
          <path d="M160 ${topperApexY - 55} Q166 ${topperApexY - 45} 160 ${topperApexY - 40} Q154 ${topperApexY - 45} 160 ${topperApexY - 55} Z" fill="#FFA000"/>
          <circle cx="160" cy="${topperApexY - 46}" r="3" fill="#FFF9C4"/>
        </g>
      `;
    } else if (topper.id === 'berries') {
      svgHtml += `
        <!-- Raspberry Medley -->
        <g id="berriesGroup">
          <circle cx="145" cy="${topperApexY - 5}" r="8" fill="#C2185B"/>
          <circle cx="160" cy="${topperApexY - 7}" r="9" fill="#880E4F"/>
          <circle cx="175" cy="${topperApexY - 5}" r="8" fill="#C2185B"/>
          <!-- Mint leaf -->
          <ellipse cx="185" cy="${topperApexY - 8}" rx="8" ry="4" transform="rotate(-25 185 ${topperApexY - 8})" fill="#4CAF50"/>
        </g>
      `;
    }

    // Inscription Plaque (Placed neatly at base of bottom tier)
    if (inscription && inscription.trim().length > 0) {
      svgHtml += `
        <!-- Edible Inscription Plaque -->
        <g id="inscriptionPlaque" filter="url(#cakeShadow)">
          <rect x="55" y="${standY - 14}" width="210" height="26" rx="6" fill="#FFFDF8" stroke="url(#goldPlate)" stroke-width="1.5"/>
          <text x="160" y="${standY + 3}" text-anchor="middle" font-family="'Playfair Display', serif" font-size="11" font-weight="700" fill="#20130C" letter-spacing="0.03em">
            ${this.escapeXml(inscription)}
          </text>
        </g>
      `;
    }

    svgHtml += `</svg>`;
    this.svgContainer.innerHTML = svgHtml;
  }

  attachEvents() {
    // Sponge Flavor Cards
    document.querySelectorAll('[data-sponge]').forEach(card => {
      card.addEventListener('click', (e) => {
        document.querySelectorAll('[data-sponge]').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.setOption('sponge', {
          id: card.dataset.sponge,
          name: card.dataset.name,
          color: card.dataset.color,
          priceAdd: parseFloat(card.dataset.price || 0)
        });
      });
    });

    // Size / Tiers Cards
    document.querySelectorAll('[data-size]').forEach(card => {
      card.addEventListener('click', (e) => {
        document.querySelectorAll('[data-size]').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.setOption('size', {
          id: card.dataset.size,
          name: card.dataset.name,
          tiers: parseInt(card.dataset.tiers || 1),
          multiplier: parseFloat(card.dataset.multiplier || 1.0),
          basePrice: parseFloat(card.dataset.baseprice || 48.00)
        });
      });
    });

    // Frosting Cards
    document.querySelectorAll('[data-frosting]').forEach(card => {
      card.addEventListener('click', (e) => {
        document.querySelectorAll('[data-frosting]').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.setOption('frosting', {
          id: card.dataset.frosting,
          name: card.dataset.name,
          color: card.dataset.color,
          priceAdd: parseFloat(card.dataset.price || 0)
        });
      });
    });

    // Design Style Cards
    document.querySelectorAll('[data-design]').forEach(card => {
      card.addEventListener('click', (e) => {
        document.querySelectorAll('[data-design]').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.setOption('design', {
          id: card.dataset.design,
          name: card.dataset.name,
          priceAdd: parseFloat(card.dataset.price || 0)
        });
      });
    });

    // Topper Cards
    document.querySelectorAll('[data-topper]').forEach(card => {
      card.addEventListener('click', (e) => {
        document.querySelectorAll('[data-topper]').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.setOption('topper', {
          id: card.dataset.topper,
          name: card.dataset.name,
          priceAdd: parseFloat(card.dataset.price || 0)
        });
      });
    });

    // Inscription Input
    const inscriptInput = document.getElementById('customCakeInscription');
    if (inscriptInput) {
      inscriptInput.addEventListener('input', (e) => {
        this.setInscription(e.target.value);
        const countEl = document.getElementById('inscriptionCharCount');
        if (countEl) countEl.textContent = `${e.target.value.length}/32`;
      });
    }

    // Add to Cart Button
    const addCustomBtn = document.getElementById('btnAddCustomCakeToBag');
    if (addCustomBtn) {
      addCustomBtn.addEventListener('click', () => {
        const customItem = this.generateCartItem();
        if (window.Cart) {
          window.Cart.addItem(customItem);
          window.UI.closeModal('cakeStudioModal');
          window.Cart.openDrawer();
        }
      });
    }
  }

  generateCartItem() {
    const price = this.calculatePrice();
    const desc = `${this.state.size.name} • ${this.state.sponge.name} with ${this.state.frosting.name}. Style: ${this.state.design.name}, Topper: ${this.state.topper.name}. Plaque: "${this.state.inscription}"`;
    return {
      id: `custom_${Date.now()}`,
      title: `Bespoke Celebration Cake (${this.state.size.tiers}-Tier)`,
      price: price,
      quantity: 1,
      image_url: 'https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&w=800&q=80',
      category: 'Custom Cakes',
      isCustom: true,
      custom_details: desc,
      custom_config: this.state
    };
  }

  shadeColor(color, percent) {
    let R = parseInt(color.substring(1,3), 16);
    let G = parseInt(color.substring(3,5), 16);
    let B = parseInt(color.substring(5,7), 16);

    R = parseInt(R * (100 + percent) / 100);
    G = parseInt(G * (100 + percent) / 100);
    B = parseInt(B * (100 + percent) / 100);

    R = (R<255)?R:255;
    G = (G<255)?G:255;
    B = (B<255)?B:255;

    const RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16));
    const GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16));
    const BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));

    return "#"+RR+GG+BB;
  }

  escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, function (c) {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
      }
    });
  }
}

window.CakeStudio = new CakeStudio();
