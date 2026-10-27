// ============================================================================
// VAROSTYLE & VALEN SHOP — LÓGICA PRINCIPAL DE TIENDA Y PWA (app.js)
// ============================================================================

const app = {
  state: {
    settings: null,
    products: [],
    categories: [],
    shippingZones: [],
    banners: [],
    universe: 'all', // 'all' | 'varostyle' | 'valenshop'
    category: 'Todas',
    sizeFilter: 'all',
    badgeFilter: 'all',
    maxPrice: 350000,
    sortBy: 'featured',
    searchQuery: '',
    currentSlide: 0,
    slideTimer: null,
    cart: JSON.parse(localStorage.getItem('vs_cart') || '[]'),
    wishlist: JSON.parse(localStorage.getItem('vs_wishlist') || '[]'),
    deferredPwaPrompt: null,
    activeProductModal: null,
    selectedSizeModal: '',
    selectedColorModal: ''
  },

  refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  },

  formatCOP(amount) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(Number(amount || 0));
  },

  async init() {
    this.registerServiceWorker();
    this.setupPwaListeners();
    await this.loadBootstrapData();
    this.renderAll();
    this.startHeroSlider();

    // Cerrar buscador al hacer clic fuera
    document.addEventListener('click', e => {
      const box = document.getElementById('searchBox');
      const dropdown = document.getElementById('searchDropdown');
      if (box && dropdown && !box.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  },

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.warn('SW registration warning:', err);
      });
    }
  },

  setupPwaListeners() {
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      this.state.deferredPwaPrompt = e;
    });
  },

  async triggerInstallPWA() {
    if (this.state.deferredPwaPrompt) {
      this.state.deferredPwaPrompt.prompt();
      const { outcome } = await this.state.deferredPwaPrompt.userChoice;
      if (outcome === 'accepted') {
        this.showToast('VaroStyle se está instalando en tu dispositivo');
      }
      this.state.deferredPwaPrompt = null;
    } else {
      this.openPwaInstructionsModal();
    }
  },

  async loadBootstrapData() {
    try {
      const res = await fetch('/api/bootstrap');
      const data = await res.json();
      this.state.settings = data.settings || {};
      this.state.products = data.products || [];
      this.state.categories = data.categories || [];
      this.state.shippingZones = data.shippingZones || [];
      this.state.banners = data.banners || [];
    } catch (err) {
      console.error('Error cargando datos iniciales:', err);
      this.showToast('Error conectando con el servidor');
    }
  },

  renderAll() {
    this.renderBrandIdentity();
    this.renderHeroSlider();
    this.renderCategoryChips();
    this.renderSizeFilters();
    this.renderProductsGrid();
    this.renderAboutSection();
    this.renderCartDrawer();
    this.renderWishlistDrawer();
    this.refreshIcons();
  },

  // Genera un código QR estilizado SVG si el usuario aún no ha subido la foto del QR de Nequi
  getFallbackQrSvg(nequiNumber = '3147923972') {
    return `
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" rx="12" fill="#FFFFFF"/>
        <rect x="14" y="14" width="52" height="52" fill="none" stroke="#3E1251" stroke-width="8"/>
        <rect x="28" y="28" width="24" height="24" fill="#DA0081"/>
        <rect x="134" y="14" width="52" height="52" fill="none" stroke="#3E1251" stroke-width="8"/>
        <rect x="148" y="28" width="24" height="24" fill="#DA0081"/>
        <rect x="14" y="134" width="52" height="52" fill="none" stroke="#3E1251" stroke-width="8"/>
        <rect x="28" y="148" width="24" height="24" fill="#DA0081"/>
        <g fill="#200A29">
          <rect x="78" y="18" width="10" height="10"/><rect x="98" y="18" width="10" height="22"/>
          <rect x="78" y="40" width="14" height="14"/><rect x="114" y="36" width="10" height="18"/>
          <rect x="18" y="78" width="20" height="10"/><rect x="48" y="78" width="14" height="14"/>
          <rect x="78" y="78" width="44" height="44" rx="6" fill="#3E1251"/>
          <rect x="134" y="80" width="14" height="14"/><rect x="158" y="78" width="24" height="10"/>
          <rect x="134" y="108" width="20" height="12"/><rect x="166" y="102" width="16" height="20"/>
          <rect x="78" y="136" width="14" height="20"/><rect x="104" y="134" width="20" height="12"/>
          <rect x="136" y="136" width="22" height="22"/><rect x="168" y="142" width="14" height="38"/>
          <rect x="82" y="168" width="32" height="14"/><rect x="126" y="168" width="28" height="14"/>
        </g>
        <text x="100" y="104" font-family="Montserrat, sans-serif" font-size="11" font-weight="800" fill="#FFFFFF" text-anchor="middle">NEQUI</text>
        <text x="100" y="196" font-family="Montserrat, sans-serif" font-size="9" font-weight="700" fill="#3E1251" text-anchor="middle">${nequiNumber}</text>
      </svg>
    `;
  },

  getQrHtml() {
    const stores = this.state.settings?.stores || {};
    const activeStore = this.state.universe === 'valenshop' ? stores.valenshop : stores.varostyle;
    const qrUrl = activeStore?.nequiQrUrl || stores.varostyle?.nequiQrUrl || stores.valenshop?.nequiQrUrl || '';
    const nequiNum = activeStore?.nequiNumber || '3147923972';
    if (qrUrl) {
      return `<img src="${qrUrl}" alt="Código QR Nequi ${nequiNum}" />`;
    }
    return this.getFallbackQrSvg(nequiNum);
  },

  renderBrandIdentity() {
    const s = this.state.settings || {};
    const mainBrand = s.mainBrand || 'V&V STUDIO';
    const mainTagline = s.mainTagline || 'VAROSTYLE • VALEN SHOP';
    const mainLogo = s.mainLogoUrl || '';
    const stores = s.stores || {};
    const varo = stores.varostyle || {};
    const valen = stores.valenshop || {};

    const promoEl = document.getElementById('promoTextContent');
    if (promoEl && s.topPromoBar) promoEl.textContent = s.topPromoBar;

    const dualEyebrow = document.getElementById('dualSectionEyebrow');
    if (dualEyebrow) dualEyebrow.textContent = `${mainBrand.toUpperCase()} • NUESTRAS SUB-MARCAS OFICIALES`;

    const dualMainName = document.getElementById('dualSectionMainName');
    if (dualMainName) dualMainName.textContent = mainBrand;

    const footerMainBrand = document.getElementById('footerMainBrandTitle');
    if (footerMainBrand) {
      footerMainBrand.innerHTML = `${mainBrand.toUpperCase()} <span>${(varo.name || 'VAROSTYLE').toUpperCase()} & ${
        (valen.name || 'VALEN SHOP').toUpperCase()
      }</span>`;
    }

    const titleEl = document.getElementById('headerBrandTitle');
    const subEl = document.getElementById('headerBrandSubtitle');
    const logoImg = document.getElementById('headerBrandLogoImg');

    if (this.state.universe === 'valenshop') {
      titleEl.textContent = (valen.name || 'VALEN SHOP').toUpperCase();
      subEl.textContent = `SUB-MARCA MUJER • BY ${mainBrand.toUpperCase()}`;
      const chosenLogo = valen.logoUrl || mainLogo;
      if (chosenLogo) {
        logoImg.src = chosenLogo;
        logoImg.classList.remove('hidden');
      } else {
        logoImg.classList.add('hidden');
      }
    } else if (this.state.universe === 'varostyle') {
      titleEl.textContent = (varo.name || 'VAROSTYLE').toUpperCase();
      subEl.textContent = `SUB-MARCA HOMBRE • BY ${mainBrand.toUpperCase()}`;
      const chosenLogo = varo.logoUrl || mainLogo;
      if (chosenLogo) {
        logoImg.src = chosenLogo;
        logoImg.classList.remove('hidden');
      } else {
        logoImg.classList.add('hidden');
      }
    } else {
      titleEl.textContent = mainBrand.toUpperCase();
      subEl.textContent = mainTagline.toUpperCase();
      const chosenLogo = mainLogo || varo.logoUrl;
      if (chosenLogo) {
        logoImg.src = chosenLogo;
        logoImg.classList.remove('hidden');
      } else {
        logoImg.classList.add('hidden');
      }
    }

    const cardVaroTitle = document.getElementById('cardVaroTitle');
    const cardVaroDesc = document.getElementById('cardVaroDesc');
    const cardValenTitle = document.getElementById('cardValenTitle');
    const cardValenDesc = document.getElementById('cardValenDesc');

    if (cardVaroTitle) cardVaroTitle.textContent = varo.name || 'VaroStyle';
    if (cardVaroDesc) cardVaroDesc.textContent = varo.shortDescription || 'Ropa masculina con estilo';
    if (cardValenTitle) cardValenTitle.textContent = valen.name || 'Valen Shop';
    if (cardValenDesc) cardValenDesc.textContent = valen.shortDescription || 'Elegancia sutil, belleza natural';

    const banner = document.getElementById('activeUniverseBanner');
    const pill = document.getElementById('activeUniversePill');
    const uTitle = document.getElementById('activeUniverseTitle');
    const uSub = document.getElementById('activeUniverseSubtitle');

    if (banner) {
      banner.classList.toggle('theme-valenshop', this.state.universe === 'valenshop');
      if (this.state.universe === 'varostyle') {
        pill.textContent = `SUB-MARCA MASCULINA • BY ${mainBrand.toUpperCase()}`;
        uTitle.textContent = `${varo.name || 'VaroStyle'} — ${varo.shortDescription || 'Ropa masculina con estilo'}`;
        uSub.textContent = 'VaroStyle: tu estilo, tu esencia. | Instagram: @varostyle.co';
      } else if (this.state.universe === 'valenshop') {
        pill.textContent = `SUB-MARCA FEMENINA • BY ${mainBrand.toUpperCase()}`;
        uTitle.textContent = `${valen.name || 'Valen Shop'} — ${valen.shortDescription || 'Elegancia sutil, belleza natural'}`;
        uSub.textContent = 'Valen Shop: viste tu esencia, refleja tu belleza. | Instagram: @valenshop.co';
      } else {
        pill.textContent = `${mainBrand.toUpperCase()} • CASA DE MODA OFICIAL`;
        uTitle.textContent = `${mainBrand.toUpperCase()} — ${varo.name || 'VaroStyle'} & ${valen.name || 'Valen Shop'}`;
        uSub.textContent = 'Explora el catálogo oficial o filtra por cualquiera de nuestras dos sub-marcas.';
      }
    }
  },

  renderHeroSlider() {
    const sliderEl = document.getElementById('heroSlider');
    const dotsEl = document.getElementById('heroDots');
    if (!sliderEl || !dotsEl) return;

    const banners = this.state.banners.length
      ? this.state.banners
      : [
          {
            brand: 'varostyle',
            subtitle: 'VAROSTYLE • MODA MASCULINA',
            title: 'TU ESTILO, TU ESENCIA.',
            description: 'Prendas modernas, versátiles y con estilo para cada ocasión.',
            ctaText: 'VER HOMBRE (VAROSTYLE)',
            ctaFilter: 'varostyle',
            image: 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?auto=format&fit=crop&w=1600&q=85'
          }
        ];

    sliderEl.innerHTML = banners
      .map(
        (b, idx) => `
      <div class="hero-slide ${idx === this.state.currentSlide ? 'active' : ''}">
        <img class="hero-slide-bg" src="${b.image}" alt="${b.title}" />
        <div class="hero-slide-overlay"></div>
        <div class="container hero-content">
          <span class="hero-subtitle">${b.subtitle || ''}</span>
          <h1 class="hero-title">${b.title}</h1>
          <p class="hero-description">${b.description || ''}</p>
          <div class="hero-cta-group">
            <button class="btn-editorial btn-light inline-icon-btn" onclick="app.selectStoreAndScroll('${b.ctaFilter || 'all'}')">
              <span>${b.ctaText || 'VER COLECCIÓN'}</span>
              <i data-lucide="arrow-right" class="icon-xs"></i>
            </button>
            <button class="btn-editorial btn-champagne inline-icon-btn" onclick="app.selectStoreAndScroll('${b.ctaFilter === 'varostyle' ? 'valenshop' : 'varostyle'}')">
              <span>${b.ctaFilter === 'varostyle' ? 'IR A VALEN SHOP (MUJER)' : 'IR A VAROSTYLE (HOMBRE)'}</span>
              <i data-lucide="arrow-up-right" class="icon-xs"></i>
            </button>
          </div>
        </div>
      </div>
    `
      )
      .join('');

    dotsEl.innerHTML = banners
      .map(
        (_, idx) => `
      <button class="hero-dot ${idx === this.state.currentSlide ? 'active' : ''}" onclick="app.goToSlide(${idx})" aria-label="Slide ${idx + 1}"></button>
    `
      )
      .join('');

    this.refreshIcons();
  },

  startHeroSlider() {
    if (this.state.slideTimer) clearInterval(this.state.slideTimer);
    this.state.slideTimer = setInterval(() => {
      this.nextSlide();
    }, 6000);
  },

  nextSlide() {
    if (!this.state.banners.length) return;
    this.state.currentSlide = (this.state.currentSlide + 1) % this.state.banners.length;
    this.renderHeroSlider();
  },

  prevSlide() {
    if (!this.state.banners.length) return;
    this.state.currentSlide =
      (this.state.currentSlide - 1 + this.state.banners.length) % this.state.banners.length;
    this.renderHeroSlider();
  },

  goToSlide(idx) {
    this.state.currentSlide = idx;
    this.renderHeroSlider();
    this.startHeroSlider();
  },

  setUniverse(universe) {
    this.state.universe = universe;
    this.state.category = 'Todas';
    document.documentElement.setAttribute('data-universe', universe);

    document.querySelectorAll('[data-universe-btn]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-universe-btn') === universe);
    });
    document.querySelectorAll('[data-switch]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-switch') === universe);
    });
    document.querySelectorAll('.nav-link[data-nav]').forEach(link => {
      link.classList.toggle('active', link.getAttribute('data-nav') === universe);
    });

    this.renderBrandIdentity();
    this.renderCategoryChips();
    this.renderSizeFilters();
    this.renderProductsGrid();
  },

  selectStoreAndScroll(universe) {
    this.setUniverse(universe);
    const catEl = document.getElementById('catalogo');
    if (catEl) catEl.scrollIntoView({ behavior: 'smooth' });
  },

  filterFromNav(type, event) {
    if (event) event.preventDefault();
    if (type === 'varostyle' || type === 'valenshop' || type === 'all') {
      this.state.badgeFilter = 'all';
      this.setUniverse(type);
    } else if (type === 'new') {
      this.state.badgeFilter = 'NUEVO';
      this.renderProductsGrid();
    } else if (type === 'sale') {
      this.state.badgeFilter = 'SALE';
      this.renderProductsGrid();
    }
    const catEl = document.getElementById('catalogo');
    if (catEl) catEl.scrollIntoView({ behavior: 'smooth' });
  },

  scrollToSection(id, event) {
    if (event) event.preventDefault();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  },

  navigateHome(event) {
    if (event) event.preventDefault();
    this.setUniverse('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  renderCategoryChips() {
    const container = document.getElementById('categoryChips');
    if (!container) return;

    const activeProducts = this.state.products.filter(p => {
      if (!p.active) return false;
      if (this.state.universe !== 'all' && p.brand !== this.state.universe) return false;
      return true;
    });

    const dbCats = (this.state.categories || [])
      .filter(c => c.active !== 0 && (this.state.universe === 'all' || c.brand === 'all' || c.brand === this.state.universe))
      .map(c => c.name);

    const prodCats = activeProducts.map(p => p.category).filter(Boolean);
    const categories = ['Todas', ...new Set([...dbCats, ...prodCats])];

    container.innerHTML = categories
      .map(
        cat => `
      <button class="category-chip ${this.state.category === cat ? 'active' : ''}" onclick="app.setCategory('${cat.replace(/'/g, "\\'")}')">
        ${cat}
      </button>
    `
      )
      .join('');
  },

  setCategory(cat) {
    this.state.category = cat;
    this.renderCategoryChips();
    this.renderProductsGrid();
  },

  renderSizeFilters() {
    const container = document.getElementById('sizeFilterList');
    if (!container) return;

    const allSizes = new Set();
    this.state.products.forEach(p => {
      if (this.state.universe === 'all' || p.brand === this.state.universe) {
        (p.sizes || []).forEach(s => allSizes.add(s));
      }
    });

    const sizes = ['all', ...Array.from(allSizes)];
    container.innerHTML = sizes
      .map(
        sz => `
      <button class="chip-sm ${this.state.sizeFilter === sz ? 'active' : ''}" onclick="app.setSizeFilter('${sz}')">
        ${sz === 'all' ? 'Todas' : sz}
      </button>
    `
      )
      .join('');
  },

  setSizeFilter(sz) {
    this.state.sizeFilter = sz;
    this.renderSizeFilters();
    this.renderProductsGrid();
  },

  setBadgeFilter(badge) {
    this.state.badgeFilter = badge;
    document.querySelectorAll('[data-badge-filter]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-badge-filter') === badge);
    });
    this.renderProductsGrid();
  },

  setMaxPrice(val) {
    this.state.maxPrice = Number(val);
    const lbl = document.getElementById('priceRangeLabel');
    if (lbl) lbl.textContent = this.formatCOP(val);
    this.renderProductsGrid();
  },

  setSort(sortValue) {
    this.state.sortBy = sortValue;
    this.renderProductsGrid();
  },

  toggleAdvancedFilters() {
    const panel = document.getElementById('advancedFiltersPanel');
    if (panel) panel.classList.toggle('hidden');
  },

  resetFilters() {
    this.state.category = 'Todas';
    this.state.sizeFilter = 'all';
    this.state.badgeFilter = 'all';
    this.state.maxPrice = 350000;
    this.state.searchQuery = '';
    const rangeInput = document.getElementById('priceRangeInput');
    if (rangeInput) rangeInput.value = 350000;
    const lbl = document.getElementById('priceRangeLabel');
    if (lbl) lbl.textContent = this.formatCOP(350000);
    this.renderCategoryChips();
    this.renderSizeFilters();
    this.renderProductsGrid();
  },

  getFilteredProducts() {
    let list = this.state.products.filter(p => p.active !== false);

    if (this.state.universe !== 'all') {
      list = list.filter(p => p.brand === this.state.universe);
    }

    if (this.state.category !== 'Todas') {
      list = list.filter(p => p.category === this.state.category);
    }

    if (this.state.sizeFilter !== 'all') {
      list = list.filter(p => (p.sizes || []).includes(this.state.sizeFilter));
    }

    if (this.state.badgeFilter !== 'all') {
      if (this.state.badgeFilter === 'SALE') {
        list = list.filter(p => p.badge === 'SALE' || (p.comparePrice && p.comparePrice > p.price));
      } else {
        list = list.filter(p => p.badge === this.state.badgeFilter);
      }
    }

    if (this.state.maxPrice) {
      list = list.filter(p => Number(p.price) <= this.state.maxPrice);
    }

    if (this.state.searchQuery.trim() !== '') {
      const q = this.state.searchQuery.toLowerCase();
      list = list.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
      );
    }

    if (this.state.sortBy === 'price-asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (this.state.sortBy === 'price-desc') {
      list.sort((a, b) => b.price - a.price);
    } else if (this.state.sortBy === 'newest') {
      list.sort((a, b) => b.id - a.id);
    } else if (this.state.sortBy === 'discount') {
      list.sort((a, b) => (b.comparePrice - b.price) - (a.comparePrice - a.price));
    } else {
      list.sort((a, b) => Number(b.featured) - Number(a.featured) || b.id - a.id);
    }

    return list;
  },

  renderProductsGrid() {
    const grid = document.getElementById('productsGrid');
    const countText = document.getElementById('resultsCountText');
    if (!grid) return;

    const filtered = this.getFilteredProducts();
    if (countText) {
      countText.textContent = `Mostrando ${filtered.length} ${filtered.length === 1 ? 'prenda disponible' : 'prendas disponibles'}`;
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; background: #fff; border-radius: 14px; border: 1px solid var(--border-color);">
          <h3 style="margin-bottom: 8px;">No encontramos prendas con esos filtros</h3>
          <p style="color: var(--text-muted); margin-bottom: 16px;">Prueba limpiando los filtros o cambiando de colección.</p>
          <button class="btn-primary-gold" onclick="app.resetFilters()">Ver Todas las Prendas</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered
      .map(p => {
        const img1 = p.images?.[0] || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80';
        const img2 = p.images?.[1] || img1;
        const isFav = this.state.wishlist.includes(p.id);
        const discountPct =
          p.comparePrice && p.comparePrice > p.price
            ? Math.round(((p.comparePrice - p.price) / p.comparePrice) * 100)
            : 0;
        const defaultColor = p.colors?.[0]?.name || 'Único';

        return `
        <article class="product-card">
          <div class="product-media" onclick="app.openProductModal(${p.id})">
            <img class="product-img-primary" src="${img1}" alt="${p.name}" loading="lazy" />
            <img class="product-img-secondary" src="${img2}" alt="${p.name}" loading="lazy" />

            <div class="product-badges">
              <span class="badge-pill ${p.brand === 'valenshop' ? 'badge-brand-valen' : 'badge-brand-varo'}">
                ${p.brand === 'valenshop' ? 'Valen Shop' : 'VaroStyle'}
              </span>
              ${p.badge ? `<span class="badge-pill ${p.badge === 'SALE' ? 'badge-sale' : 'badge-promo'}">${p.badge}</span>` : ''}
              ${discountPct > 0 ? `<span class="badge-pill badge-sale">-${discountPct}%</span>` : ''}
            </div>

            <button
              class="wishlist-btn-card ${isFav ? 'active' : ''}"
              onclick="event.stopPropagation(); app.toggleWishlist(${p.id})"
              title="Agregar a Favoritos"
              aria-label="Favorito"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? '#E11D48' : 'none'}" stroke="${isFav ? '#E11D48' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </button>

            <div class="quick-add-overlay" onclick="event.stopPropagation()">
              <div class="quick-add-title">Agregar rápido (Talla):</div>
              <div class="quick-sizes-row">
                ${(p.sizes || ['Única'])
                  .map(
                    sz => `
                  <button class="quick-size-btn" onclick="app.addToCart(${p.id}, '${sz}', '${defaultColor}', 1)">
                    ${sz}
                  </button>
                `
                  )
                  .join('')}
              </div>
            </div>
          </div>

          <div class="product-info">
            <span class="product-category-label">${p.category || 'Colección'}</span>
            <h3 class="product-title" onclick="app.openProductModal(${p.id})">${p.name}</h3>
            <div class="product-price-row">
              <span class="price-current">${this.formatCOP(p.price)}</span>
              ${p.comparePrice > p.price ? `<span class="price-compare">${this.formatCOP(p.comparePrice)}</span>` : ''}
            </div>

            <div class="product-swatches">
              ${(p.colors || [])
                .map(
                  c => `<span class="color-dot" style="background:${c.hex || '#111'}" title="${c.name}"></span>`
                )
                .join('')}
              <span style="font-size:0.72rem; color:var(--text-muted); margin-left:4px;">
                ${(p.sizes || []).join(' · ')}
              </span>
            </div>

            <div class="product-card-actions">
              <button class="btn-card-view" onclick="app.openProductModal(${p.id})">Ver / Comprar</button>
              <button class="btn-card-edit" onclick="admin.openAdminPortal('edit-product', ${p.id})" title="Editar este producto" aria-label="Editar">
                <i data-lucide="pencil" class="icon-xs"></i>
              </button>
            </div>
          </div>
        </article>
      `;
      })
      .join('');

    this.refreshIcons();
  },

  handleSearchInput(query) {
    this.state.searchQuery = query;
    this.renderProductsGrid();

    const dropdown = document.getElementById('searchDropdown');
    if (!dropdown) return;

    if (!query.trim()) {
      dropdown.classList.add('hidden');
      return;
    }

    const matches = this.state.products
      .filter(
        p =>
          p.active !== false &&
          (p.name.toLowerCase().includes(query.toLowerCase()) ||
            (p.category || '').toLowerCase().includes(query.toLowerCase()))
      )
      .slice(0, 6);

    if (matches.length === 0) {
      dropdown.innerHTML = `<div style="padding:12px; font-size:0.82rem; color:var(--text-muted);">Sin resultados para "${query}"</div>`;
    } else {
      dropdown.innerHTML = matches
        .map(
          p => `
        <div class="search-item" onclick="app.openProductModal(${p.id}); document.getElementById('searchDropdown').classList.add('hidden')">
          <img src="${p.images?.[0] || ''}" alt="${p.name}" />
          <div>
            <div style="font-size:0.84rem; font-weight:700;">${p.name}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${p.brand === 'valenshop' ? 'Valen Shop' : 'VaroStyle'} • ${this.formatCOP(p.price)}</div>
          </div>
        </div>
      `
        )
        .join('');
    }
    dropdown.classList.remove('hidden');
  },

  handleSearchFocus() {
    const q = document.getElementById('searchInput')?.value || '';
    if (q.trim()) this.handleSearchInput(q);
  },

  renderAboutSection() {
    const stores = this.state.settings?.stores || {};
    const varo = stores.varostyle || {};
    const valen = stores.valenshop || {};

    const formatParagraphs = text =>
      (text || '')
        .split('\n\n')
        .map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
        .join('');

    const aboutVaroName = document.getElementById('aboutVaroName');
    const aboutVaroShort = document.getElementById('aboutVaroShort');
    const aboutVaroBody = document.getElementById('aboutVaroBody');
    const aboutVaroLogoWrap = document.getElementById('aboutVaroLogoWrap');
    const aboutVaroIg = document.getElementById('aboutVaroIg');
    const aboutVaroWa = document.getElementById('aboutVaroWa');

    if (aboutVaroName) aboutVaroName.textContent = varo.name || 'VaroStyle';
    if (aboutVaroShort) aboutVaroShort.textContent = varo.shortDescription || 'Ropa masculina con estilo';
    if (aboutVaroBody) aboutVaroBody.innerHTML = formatParagraphs(varo.aboutUs);
    if (aboutVaroLogoWrap) {
      aboutVaroLogoWrap.innerHTML = varo.logoUrl ? `<img src="${varo.logoUrl}" alt="VaroStyle" />` : 'VS';
    }
    if (aboutVaroIg) {
      const ig = (varo.instagram || 'varostyle.co').replace('@', '');
      aboutVaroIg.href = `https://instagram.com/${ig}`;
      aboutVaroIg.innerHTML = `<i data-lucide="instagram" class="icon-xs"></i> <span>@${ig}</span>`;
    }
    if (aboutVaroWa) {
      const wa = (varo.whatsapp || '3147923972').replace(/\D/g, '');
      aboutVaroWa.href = `https://wa.me/57${wa}`;
      aboutVaroWa.innerHTML = `<i data-lucide="message-circle" class="icon-xs"></i> <span>WhatsApp: ${wa}</span>`;
    }

    const aboutValenName = document.getElementById('aboutValenName');
    const aboutValenShort = document.getElementById('aboutValenShort');
    const aboutValenBody = document.getElementById('aboutValenBody');
    const aboutValenLogoWrap = document.getElementById('aboutValenLogoWrap');
    const aboutValenIg = document.getElementById('aboutValenIg');
    const aboutValenWa = document.getElementById('aboutValenWa');

    if (aboutValenName) aboutValenName.textContent = valen.name || 'Valen Shop';
    if (aboutValenShort) aboutValenShort.textContent = valen.shortDescription || 'Elegancia sutil, belleza natural';
    if (aboutValenBody) aboutValenBody.innerHTML = formatParagraphs(valen.aboutUs);
    if (aboutValenLogoWrap) {
      aboutValenLogoWrap.innerHTML = valen.logoUrl ? `<img src="${valen.logoUrl}" alt="Valen Shop" />` : 'VS';
    }
    if (aboutValenIg) {
      const ig = (valen.instagram || 'valenshop.co').replace('@', '');
      aboutValenIg.href = `https://instagram.com/${ig}`;
      aboutValenIg.innerHTML = `<i data-lucide="instagram" class="icon-xs"></i> <span>@${ig}</span>`;
    }
    if (aboutValenWa) {
      const wa = (valen.whatsapp || '3147923972').replace(/\D/g, '');
      aboutValenWa.href = `https://wa.me/57${wa}`;
      aboutValenWa.innerHTML = `<i data-lucide="message-circle" class="icon-xs"></i> <span>WhatsApp: ${wa}</span>`;
    }

    const nequiNumEl = document.getElementById('bannerNequiNumber');
    const holderEl = document.getElementById('bannerAccountHolder');
    const qrPreview = document.getElementById('bannerQrPreview');

    if (nequiNumEl) nequiNumEl.textContent = varo.nequiNumber || '3147923972';
    if (holderEl) holderEl.textContent = varo.accountHolder || 'Valentina Fuenmayor';
    if (qrPreview) qrPreview.innerHTML = this.getQrHtml();

    this.refreshIcons();
  },

  // ============================================================================
  // MODAL DE DETALLE DE PRODUCTO (VISTA RÁPIDA COMPLETA)
  // ============================================================================
  openProductModal(productId) {
    const product = this.state.products.find(p => p.id === Number(productId));
    if (!product) return;

    this.state.activeProductModal = product;
    this.state.selectedSizeModal = product.sizes?.[0] || 'Única';
    this.state.selectedColorModal = product.colors?.[0]?.name || 'Único';

    this.renderProductModalContent();
    document.getElementById('productModalBackdrop')?.classList.remove('hidden');
  },

  renderProductModalContent(activeImgUrl) {
    const p = this.state.activeProductModal;
    if (!p) return;

    const images = p.images?.length
      ? p.images
      : ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80'];
    const mainImg = activeImgUrl || images[0];
    const waNumber = this.state.settings?.stores?.[p.brand]?.whatsapp || '3147923972';
    const waMsg = encodeURIComponent(
      `Hola, me interesa la prenda *${p.name}* (${p.brand === 'valenshop' ? 'Valen Shop' : 'VaroStyle'}) en Talla *${this.state.selectedSizeModal}* y Color *${this.state.selectedColorModal}* (${this.formatCOP(p.price)}). ¿Está disponible?`
    );

    const container = document.getElementById('productModalContent');
    container.innerHTML = `
      <div class="pdp-grid">
        <div class="pdp-gallery">
          <img class="pdp-main-img" id="pdpMainImage" src="${mainImg}" alt="${p.name}" />
          <div class="pdp-thumbs">
            ${images
              .map(
                img => `
              <img
                class="pdp-thumb ${img === mainImg ? 'active' : ''}"
                src="${img}"
                alt="${p.name}"
                onclick="app.renderProductModalContent('${img}')"
              />
            `
              )
              .join('')}
          </div>
        </div>

        <div class="pdp-details">
          <div>
            <span class="badge-pill ${p.brand === 'valenshop' ? 'badge-brand-valen' : 'badge-brand-varo'}">
              ${p.brand === 'valenshop' ? 'VALEN SHOP (MUJER)' : 'VAROSTYLE (HOMBRE)'}
            </span>
            <h2 style="font-family:var(--font-heading); font-size:1.5rem; margin-top:8px;">${p.name}</h2>
          </div>

          <div class="product-price-row">
            <span class="price-current" style="font-size:1.5rem;">${this.formatCOP(p.price)}</span>
            ${p.comparePrice > p.price ? `<span class="price-compare" style="font-size:1rem;">${this.formatCOP(p.comparePrice)}</span>` : ''}
          </div>

          <p style="font-size:0.92rem; color:#444;">${p.description || ''}</p>

          <div>
            <div class="pdp-option-title">
              <span>Color seleccionado: <strong>${this.state.selectedColorModal}</strong></span>
            </div>
            <div class="pdp-options-row">
              ${(p.colors || [])
                .map(
                  c => `
                <button
                  class="pdp-color-btn ${this.state.selectedColorModal === c.name ? 'active' : ''}"
                  onclick="app.selectModalColor('${c.name}')"
                >
                  <span class="color-dot" style="background:${c.hex || '#111'}"></span>
                  ${c.name}
                </button>
              `
                )
                .join('')}
            </div>
          </div>

          <div>
            <div class="pdp-option-title">
              <span>Talla seleccionada: <strong>${this.state.selectedSizeModal}</strong></span>
              <a href="javascript:void(0)" onclick="app.openSizeGuideModal()" class="inline-icon-text" style="text-decoration:underline; color:var(--accent-gold);">
                <i data-lucide="ruler" class="icon-xs"></i> <span>Ver Guía de Tallas</span>
              </a>
            </div>
            <div class="pdp-options-row">
              ${(p.sizes || ['Única'])
                .map(
                  sz => `
                <button
                  class="pdp-size-btn ${this.state.selectedSizeModal === sz ? 'active' : ''}"
                  onclick="app.selectModalSize('${sz}')"
                >
                  ${sz}
                </button>
              `
                )
                .join('')}
            </div>
          </div>

          <div class="inline-icon-text" style="font-size:0.8rem; color:var(--text-muted);">
            <i data-lucide="check-circle-2" class="icon-xs" style="color:#16A34A;"></i>
            <span>Disponible en stock (${p.stock || 10} unidades) • Despacho inmediato a toda Colombia</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:10px; margin-top:6px;">
            <button
              class="btn-checkout-main inline-icon-btn justify-center"
              onclick="app.addToCart(${p.id}, '${this.state.selectedSizeModal}', '${this.state.selectedColorModal}', 1); app.closeProductModal();"
            >
              <i data-lucide="shopping-bag" class="icon-xs"></i>
              <span>AGREGAR A MI BOLSA DE COMPRAS</span>
            </button>

            <a
              href="https://wa.me/57${waNumber.replace(/\D/g, '')}?text=${waMsg}"
              target="_blank"
              rel="noopener"
              class="btn-whatsapp-direct inline-icon-btn justify-center"
              style="text-align:center;"
            >
              <i data-lucide="message-circle" class="icon-xs"></i>
              <span>Preguntar o pedir esta prenda por WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    `;
    this.refreshIcons();
  },

  selectModalSize(size) {
    this.state.selectedSizeModal = size;
    this.renderProductModalContent();
  },

  selectModalColor(color) {
    this.state.selectedColorModal = color;
    this.renderProductModalContent();
  },

  closeProductModal() {
    document.getElementById('productModalBackdrop')?.classList.add('hidden');
  },

  // ============================================================================
  // CARRITO DE COMPRAS Y FAVORITOS (WISHLIST)
  // ============================================================================
  addToCart(productId, size, color, quantity = 1) {
    const product = this.state.products.find(p => p.id === Number(productId));
    if (!product) return;

    const chosenSize = size || product.sizes?.[0] || 'Única';
    const chosenColor = color || product.colors?.[0]?.name || 'Único';
    const key = `${product.id}-${chosenSize}-${chosenColor}`;

    const existing = this.state.cart.find(item => item.key === key);
    if (existing) {
      existing.quantity += Number(quantity);
    } else {
      this.state.cart.push({
        key,
        productId: product.id,
        name: product.name,
        brand: product.brand,
        price: product.price,
        image: product.images?.[0] || '',
        size: chosenSize,
        color: chosenColor,
        quantity: Number(quantity)
      });
    }

    this.saveCart();
    this.renderCartDrawer();
    this.showToast(`"${product.name}" (Talla ${chosenSize}) agregado a tu bolsa`);
    this.toggleCartDrawer(true);
  },

  updateCartQuantity(key, delta) {
    const item = this.state.cart.find(i => i.key === key);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) {
      this.state.cart = this.state.cart.filter(i => i.key !== key);
    }
    this.saveCart();
    this.renderCartDrawer();
  },

  saveCart() {
    localStorage.setItem('vs_cart', JSON.stringify(this.state.cart));
  },

  getCartTotals() {
    const subtotal = this.state.cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const threshold = this.state.settings?.freeShippingThreshold || 200000;
    const baseShipping = this.state.settings?.defaultShippingCost || 12000;
    const shipping = subtotal === 0 || subtotal >= threshold ? 0 : baseShipping;
    return {
      subtotal,
      shipping,
      total: subtotal + shipping,
      threshold
    };
  },

  renderCartDrawer() {
    const count = this.state.cart.reduce((sum, i) => sum + i.quantity, 0);
    const badge = document.getElementById('cartCount');
    const mobBadge = document.getElementById('mobileCartCount');
    const headerCount = document.getElementById('cartHeaderCount');

    if (badge) badge.textContent = count;
    if (mobBadge) mobBadge.textContent = count;
    if (headerCount) headerCount.textContent = `(${count} ${count === 1 ? 'prenda' : 'prendas'})`;

    const { subtotal, shipping, total, threshold } = this.getCartTotals();

    const progressEl = document.getElementById('freeShippingProgress');
    const textEl = document.getElementById('freeShippingText');
    if (progressEl && textEl) {
      const pct = Math.min(100, Math.round((subtotal / threshold) * 100));
      progressEl.style.width = `${pct}%`;
      if (subtotal >= threshold) {
        textEl.innerHTML = '<strong>Tienes ENVÍO GRATIS activado en tu pedido</strong>';
      } else {
        textEl.innerHTML = `Te faltan <strong>${this.formatCOP(threshold - subtotal)}</strong> para tener <strong>ENVÍO GRATIS</strong>`;
      }
    }

    const container = document.getElementById('cartItemsContainer');
    if (!container) return;

    if (this.state.cart.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:48px 16px; color:var(--text-muted);">
          <div style="margin-bottom:10px; display:flex; justify-content:center;"><i data-lucide="shopping-bag" class="icon-lg"></i></div>
          <strong>Tu bolsa de compras está vacía</strong>
          <p style="font-size:0.84rem; margin-top:6px;">Explora las colecciones de VaroStyle y Valen Shop.</p>
        </div>
      `;
    } else {
      container.innerHTML = this.state.cart
        .map(
          item => `
        <div class="cart-item">
          <img src="${item.image}" alt="${item.name}" />
          <div class="cart-item-info">
            <div class="cart-item-title">${item.name}</div>
            <div class="cart-item-meta">
              ${item.brand === 'valenshop' ? 'Valen Shop' : 'VaroStyle'} • Talla: <strong>${item.size}</strong> • Color: ${item.color}
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <div class="qty-control">
                <button onclick="app.updateCartQuantity('${item.key}', -1)">−</button>
                <span>${item.quantity}</span>
                <button onclick="app.updateCartQuantity('${item.key}', 1)">+</button>
              </div>
              <strong>${this.formatCOP(item.price * item.quantity)}</strong>
            </div>
          </div>
        </div>
      `
        )
        .join('');
    }

    const subEl = document.getElementById('cartSubtotalValue');
    const shipEl = document.getElementById('cartShippingValue');
    const totEl = document.getElementById('cartTotalValue');

    if (subEl) subEl.textContent = this.formatCOP(subtotal);
    if (shipEl) shipEl.textContent = shipping === 0 ? 'GRATIS' : this.formatCOP(shipping);
    if (totEl) totEl.textContent = this.formatCOP(total);

    this.refreshIcons();
  },

  toggleCartDrawer(forceState) {
    const drawer = document.getElementById('cartDrawer');
    const backdrop = document.getElementById('cartBackdrop');
    if (!drawer || !backdrop) return;
    const isHidden = drawer.classList.contains('hidden');
    const show = forceState !== undefined ? forceState : isHidden;
    drawer.classList.toggle('hidden', !show);
    backdrop.classList.toggle('hidden', !show);
  },

  toggleWishlist(productId) {
    const id = Number(productId);
    if (this.state.wishlist.includes(id)) {
      this.state.wishlist = this.state.wishlist.filter(x => x !== id);
      this.showToast('Eliminado de tus favoritos');
    } else {
      this.state.wishlist.push(id);
      this.showToast('Guardado en tus favoritos');
    }
    localStorage.setItem('vs_wishlist', JSON.stringify(this.state.wishlist));
    this.renderProductsGrid();
    this.renderWishlistDrawer();
  },

  renderWishlistDrawer() {
    const badge = document.getElementById('wishlistCount');
    if (badge) badge.textContent = this.state.wishlist.length;

    const container = document.getElementById('wishlistItemsContainer');
    if (!container) return;

    const favProducts = this.state.products.filter(p => this.state.wishlist.includes(p.id));
    if (favProducts.length === 0) {
      container.innerHTML = `<p style="text-align:center; padding:40px 10px; color:var(--text-muted);">Aún no tienes prendas favoritas guardadas.</p>`;
      return;
    }

    container.innerHTML = favProducts
      .map(
        p => `
      <div class="cart-item">
        <img src="${p.images?.[0] || ''}" alt="${p.name}" />
        <div class="cart-item-info">
          <div class="cart-item-title">${p.name}</div>
          <div class="cart-item-meta">${this.formatCOP(p.price)}</div>
          <button class="btn-card-view" onclick="app.toggleWishlistDrawer(false); app.openProductModal(${p.id})">Ver Prenda</button>
        </div>
      </div>
    `
      )
      .join('');
  },

  toggleWishlistDrawer(forceState) {
    const drawer = document.getElementById('wishlistDrawer');
    const backdrop = document.getElementById('wishlistBackdrop');
    if (!drawer || !backdrop) return;
    const show = forceState !== undefined ? forceState : drawer.classList.contains('hidden');
    drawer.classList.toggle('hidden', !show);
    backdrop.classList.toggle('hidden', !show);
  },

  toggleMobileMenu(forceState) {
    const drawer = document.getElementById('mobileMenuDrawer');
    const backdrop = document.getElementById('mobileMenuBackdrop');
    if (!drawer || !backdrop) return;
    const show = forceState !== undefined ? forceState : drawer.classList.contains('hidden');
    drawer.classList.toggle('hidden', !show);
    backdrop.classList.toggle('hidden', !show);
  },

  // ============================================================================
  // MODALES INFORMATIVOS (GUÍA TALLAS, QR NEQUI, RASTREO DE PEDIDO, PWA)
  // ============================================================================
  openSizeGuideModal() {
    document.getElementById('sizeGuideModalBackdrop')?.classList.remove('hidden');
  },
  closeSizeGuideModal() {
    document.getElementById('sizeGuideModalBackdrop')?.classList.add('hidden');
  },

  openNequiQrModal() {
    const varo = this.state.settings?.stores?.varostyle || {};
    const nequiNumber = varo.nequiNumber || '3147923972';
    const holder = varo.accountHolder || 'Valentina Fuenmayor';
    const key = varo.nequiKey || nequiNumber;

    const body = document.getElementById('nequiQrModalBody');
    if (body) {
      body.innerHTML = `
        <div class="nequi-payment-card" style="text-align:center;">
          <span class="nequi-pill">CUENTA OFICIAL VERIFICADA</span>
          <h4 style="font-size:1.25rem; margin-bottom:4px;">VaroStyle & Valen Shop</h4>
          <p style="font-size:0.9rem; color:var(--text-muted);">Escanea el código QR desde tu App Nequi o transfiere al número:</p>
          <div class="nequi-qr-display">${this.getQrHtml()}</div>
          <div style="background:#fff; padding:14px; border-radius:10px; border:1px solid var(--border-color); margin-bottom:14px;">
            <p><strong>Número Nequi:</strong> <span style="font-size:1.15rem; color:var(--accent-nequi); font-weight:800;">${nequiNumber}</span></p>
            <p><strong>Titular de la cuenta:</strong> ${holder}</p>
            <p><strong>Llave Nequi:</strong> ${key}</p>
          </div>
          <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
            <button class="btn-primary-gold inline-icon-btn" onclick="app.copyText('${nequiNumber}', 'Número Nequi copiado')">
              <i data-lucide="copy" class="icon-xs"></i>
              <span>Copiar Número</span>
            </button>
            <button class="btn-card-edit inline-icon-btn" onclick="admin.openAdminPortal('settings')">
              <i data-lucide="upload" class="icon-xs"></i>
              <span>Subir / Cambiar imagen QR en Admin</span>
            </button>
          </div>
        </div>
      `;
    }
    document.getElementById('nequiQrModalBackdrop')?.classList.remove('hidden');
    this.refreshIcons();
  },
  closeNequiQrModal() {
    document.getElementById('nequiQrModalBackdrop')?.classList.add('hidden');
  },

  openOrderTrackerModal() {
    document.getElementById('orderTrackerBackdrop')?.classList.remove('hidden');
  },
  closeOrderTrackerModal() {
    document.getElementById('orderTrackerBackdrop')?.classList.add('hidden');
  },

  async searchOrderTracking() {
    const code = document.getElementById('trackerInputCode')?.value || '';
    const box = document.getElementById('trackerResultBox');
    if (!code.trim() || !box) return;

    try {
      const res = await fetch(`/api/orders/track/${encodeURIComponent(code.trim())}`);
      if (!res.ok) {
        box.innerHTML = `<div style="padding:14px; background:#FEF2F2; color:#991B1B; border-radius:8px;">No encontramos ningún pedido con el código <strong>${code}</strong>.</div>`;
        return;
      }
      const order = await res.json();
      box.innerHTML = `
        <div style="padding:16px; background:#F8FAFC; border:1px solid var(--border-color); border-radius:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong>Pedido ${order.orderNumber}</strong>
            <span class="badge-pill badge-promo">${order.status}</span>
          </div>
          <p style="font-size:0.85rem;"><strong>Cliente:</strong> ${order.customerName}</p>
          <p style="font-size:0.85rem;"><strong>Destino:</strong> ${order.city}${order.department ? ', ' + order.department : ''} (${order.address})</p>
          ${order.carrier ? `<p style="font-size:0.85rem;"><strong>Transportadora:</strong> ${order.carrier}</p>` : ''}
          ${order.trackingNumber ? `<p style="font-size:0.85rem;"><strong>Número de Guía:</strong> <span style="background:#FEF3C7; padding:2px 8px; border-radius:4px; font-weight:800;">${order.trackingNumber}</span></p>` : ''}
          <p style="font-size:0.85rem; margin-top:4px;"><strong>Total:</strong> ${this.formatCOP(order.total)}</p>
        </div>
      `;
    } catch (err) {
      box.innerHTML = `<p>Error consultando el pedido.</p>`;
    }
  },

  openPwaInstructionsModal() {
    document.getElementById('pwaInfoModalBackdrop')?.classList.remove('hidden');
  },
  closePwaInstructionsModal() {
    document.getElementById('pwaInfoModalBackdrop')?.classList.add('hidden');
  },

  copyText(text, msg = 'Copiado al portapapeles') {
    navigator.clipboard?.writeText(text);
    this.showToast(msg);
  },

  showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3400);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
