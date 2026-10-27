// ============================================================================
// V&V STUDIO (VAROSTYLE & VALEN SHOP) — SUITE ERP + CRM + POS DE PRODUCCIÓN
// ============================================================================

const admin = {
  state: {
    authenticated: sessionStorage.getItem('vv_admin_auth') === '1',
    activeTab: 'overview', // 'overview' | 'products' | 'categories' | 'orders' | 'customers' | 'promotions' | 'expenses' | 'banners' | 'settings'
    overviewData: null,
    products: [],
    categories: [],
    customers: [],
    orders: [],
    coupons: [],
    shippingZones: [],
    expenses: [],
    banners: [],
    movements: [],
    editingProductId: null,
    tempColors: [],
    tempImages: [],
    productSearch: '',
    productBrandFilter: 'all',
    productStockFilter: 'all',
    orderSearch: '',
    orderStatusFilter: 'all',
    customerSearch: '',
    customerSegmentFilter: 'all',
    editingCategoryId: null,
    editingCustomerId: null,
    editingCouponId: null,
    editingZoneId: null,
    editingExpenseId: null,
    editingBannerId: null,
    posItems: [],
    subModalHtml: ''
  },

  async openAdminPortal(initialAction = 'overview', targetId = null) {
    document.getElementById('adminModalBackdrop')?.classList.remove('hidden');

    if (!this.state.authenticated) {
      this.renderPinLogin(initialAction, targetId);
      return;
    }

    await this.loadAllAdminData();

    if (initialAction === 'new-product') {
      this.state.activeTab = 'products';
      this.prepareNewProduct();
    } else if (initialAction === 'edit-product' && targetId) {
      this.state.activeTab = 'products';
      this.prepareEditProduct(targetId);
    } else if (initialAction === 'settings') {
      this.state.activeTab = 'settings';
    } else {
      this.state.activeTab = initialAction || 'overview';
    }

    this.renderAdminPortal();
  },

  closeAdminPortal() {
    document.getElementById('adminModalBackdrop')?.classList.add('hidden');
  },

  renderPinLogin(nextAction = 'overview', targetId = null) {
    const body = document.getElementById('adminPortalBody');
    if (!body) return;
    body.innerHTML = `
      <div style="max-width:420px; margin:48px auto; background:#FFFFFF; padding:32px 26px; border-radius:16px; border:1px solid var(--border-color); text-align:center; box-shadow:var(--shadow-md);">
        <div style="width:52px; height:52px; border-radius:14px; background:#111115; color:var(--accent-gold); display:flex; align-items:center; justify-content:center; margin:0 auto 14px;">
          <i data-lucide="lock" class="icon-md"></i>
        </div>
        <span class="badge-pill badge-promo">ACCESO ADMINISTRATIVO</span>
        <h3 style="font-family:var(--font-heading); font-size:1.35rem; margin:10px 0 6px;">V&amp;V Studio ERP</h3>
        <p style="font-size:0.84rem; color:var(--text-muted); margin-bottom:18px;">
          Ingresa tu PIN de administrador para gestionar productos, inventario, clientes, pedidos y finanzas.
        </p>
        <form onsubmit="admin.submitPinLogin(event, '${nextAction}', ${targetId || 'null'})">
          <div class="form-field">
            <input
              type="password"
              id="adminPinInput"
              placeholder="PIN (por defecto: 1234)"
              required
              autofocus
              style="text-align:center; font-size:1.15rem; letter-spacing:0.25em; font-weight:800;"
            />
          </div>
          <button type="submit" class="btn-checkout-main inline-icon-btn justify-center">
            <i data-lucide="key-round" class="icon-xs"></i>
            <span>INGRESAR AL PANEL</span>
          </button>
        </form>
      </div>
    `;
    app.refreshIcons();
  },

  async submitPinLogin(event, nextAction, targetId) {
    event.preventDefault();
    const pin = document.getElementById('adminPinInput')?.value || '';
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      if (!res.ok) {
        app.showToast('PIN incorrecto. Verifica tu clave.');
        return;
      }
      sessionStorage.setItem('vv_admin_auth', '1');
      this.state.authenticated = true;
      await this.openAdminPortal(nextAction, targetId);
    } catch (e) {
      app.showToast('Error validando el acceso');
    }
  },

  logoutAdmin() {
    sessionStorage.removeItem('vv_admin_auth');
    this.state.authenticated = false;
    this.closeAdminPortal();
    app.showToast('Sesión de administrador cerrada');
  },

  async loadAllAdminData() {
    try {
      const res = await fetch('/api/admin/overview');
      const data = await res.json();
      this.state.overviewData = data;
      this.state.products = data.products || [];
      this.state.categories = data.categories || [];
      this.state.customers = data.customers || [];
      this.state.orders = data.orders || [];
      this.state.coupons = data.coupons || [];
      this.state.shippingZones = data.shippingZones || [];
      this.state.expenses = data.expenses || [];
      this.state.banners = data.banners || [];
      this.state.movements = data.recentMovements || [];
      if (data.settings) {
        app.state.settings = data.settings;
      }
    } catch (err) {
      console.error('Error cargando suite admin:', err);
      app.showToast('Error al sincronizar datos del panel');
    }
  },

  async switchTab(tab) {
    this.state.activeTab = tab;
    this.state.subModalHtml = '';
    await this.loadAllAdminData();
    if (tab === 'products' && !this.state.editingProductId && this.state.tempColors.length === 0) {
      this.prepareNewProduct();
    }
    this.renderAdminPortal();
  },

  openSubModal(html) {
    this.state.subModalHtml = html;
    const modalBox = document.getElementById('adminInternalSubModal');
    if (modalBox) {
      modalBox.innerHTML = `
        <div class="admin-submodal-backdrop" onclick="admin.closeSubModal()">
          <div class="admin-submodal-card" onclick="event.stopPropagation()">
            ${html}
          </div>
        </div>
      `;
      modalBox.classList.remove('hidden');
      app.refreshIcons();
    }
  },

  closeSubModal() {
    this.state.subModalHtml = '';
    const modalBox = document.getElementById('adminInternalSubModal');
    if (modalBox) {
      modalBox.innerHTML = '';
      modalBox.classList.add('hidden');
    }
  },

  downloadCSV(filename, headers, rows) {
    const escapeCell = val => {
      const s = String(val ?? '').replace(/"/g, '""');
      return `"${s}"`;
    };
    const csvContent =
      '\uFEFF' +
      [headers.map(escapeCell).join(','), ...rows.map(r => r.map(escapeCell).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  renderAdminPortal() {
    const body = document.getElementById('adminPortalBody');
    if (!body) return;

    const kpis = this.state.overviewData?.kpis || {};
    const pendingCount = kpis.pendingOrdersCount || 0;
    const lowStockCount = kpis.lowStockCount || 0;

    body.innerHTML = `
      <div class="admin-nav-tabs">
        <button class="admin-tab-btn inline-icon-btn ${this.state.activeTab === 'overview' ? 'active' : ''}" onclick="admin.switchTab('overview')">
          <i data-lucide="bar-chart-3" class="icon-xs"></i>
          <span>1. Resumen &amp; Finanzas</span>
        </button>
        <button class="admin-tab-btn inline-icon-btn ${this.state.activeTab === 'products' ? 'active' : ''}" onclick="admin.switchTab('products')">
          <i data-lucide="shirt" class="icon-xs"></i>
          <span>2. Productos &amp; Kardex (${this.state.products.length})</span>
          ${lowStockCount > 0 ? `<span class="admin-mini-alert">${lowStockCount}</span>` : ''}
        </button>
        <button class="admin-tab-btn inline-icon-btn ${this.state.activeTab === 'categories' ? 'active' : ''}" onclick="admin.switchTab('categories')">
          <i data-lucide="folders" class="icon-xs"></i>
          <span>3. Categorías (${this.state.categories.length})</span>
        </button>
        <button class="admin-tab-btn inline-icon-btn ${this.state.activeTab === 'orders' ? 'active' : ''}" onclick="admin.switchTab('orders')">
          <i data-lucide="package-check" class="icon-xs"></i>
          <span>4. Pedidos &amp; POS (${this.state.orders.length})</span>
          ${pendingCount > 0 ? `<span class="admin-mini-alert">${pendingCount}</span>` : ''}
        </button>
        <button class="admin-tab-btn inline-icon-btn ${this.state.activeTab === 'customers' ? 'active' : ''}" onclick="admin.switchTab('customers')">
          <i data-lucide="users" class="icon-xs"></i>
          <span>5. Clientes CRM (${this.state.customers.length})</span>
        </button>
        <button class="admin-tab-btn inline-icon-btn ${this.state.activeTab === 'promotions' ? 'active' : ''}" onclick="admin.switchTab('promotions')">
          <i data-lucide="ticket-percent" class="icon-xs"></i>
          <span>6. Cupones &amp; Envíos</span>
        </button>
        <button class="admin-tab-btn inline-icon-btn ${this.state.activeTab === 'expenses' ? 'active' : ''}" onclick="admin.switchTab('expenses')">
          <i data-lucide="wallet" class="icon-xs"></i>
          <span>7. Gastos &amp; Caja</span>
        </button>
        <button class="admin-tab-btn inline-icon-btn ${this.state.activeTab === 'banners' ? 'active' : ''}" onclick="admin.switchTab('banners')">
          <i data-lucide="image" class="icon-xs"></i>
          <span>8. Banners (${this.state.banners.length})</span>
        </button>
        <button class="admin-tab-btn inline-icon-btn ${this.state.activeTab === 'settings' ? 'active' : ''}" onclick="admin.switchTab('settings')">
          <i data-lucide="settings" class="icon-xs"></i>
          <span>9. Identidad, QR &amp; Backup</span>
        </button>
      </div>

      <div id="adminTabViewContainer">
        ${this.getActiveTabHtml()}
      </div>

      <div id="adminInternalSubModal" class="hidden"></div>
    `;

    app.refreshIcons();
  },

  getActiveTabHtml() {
    switch (this.state.activeTab) {
      case 'overview':
        return this.renderOverviewTab();
      case 'products':
        return this.renderProductsTab();
      case 'categories':
        return this.renderCategoriesTab();
      case 'orders':
        return this.renderOrdersTab();
      case 'customers':
        return this.renderCustomersTab();
      case 'promotions':
        return this.renderPromotionsTab();
      case 'expenses':
        return this.renderExpensesTab();
      case 'banners':
        return this.renderBannersTab();
      case 'settings':
        return this.renderSettingsTab();
      default:
        return this.renderOverviewTab();
    }
  },

  // ==========================================================================
  // TAB 1: RESUMEN EJECUTIVO & FINANZAS REALES
  // ==========================================================================
  renderOverviewTab() {
    const kpis = this.state.overviewData?.kpis || {};
    const totalBrandSales = (kpis.varoRevenue || 0) + (kpis.valenRevenue || 0);
    const varoPct = totalBrandSales > 0 ? Math.round(((kpis.varoRevenue || 0) / totalBrandSales) * 100) : 50;
    const valenPct = 100 - varoPct;
    const lowStock = this.state.products.filter(p => p.stock <= (p.minStockAlert || 3));

    return `
      <!-- KPIs Financieros Principales -->
      <div class="admin-stats-grid">
        <div class="stat-card">
          <span>INGRESOS BRUTOS (VENTAS)</span>
          <strong>${app.formatCOP(kpis.grossRevenue || 0)}</strong>
          <small style="color:var(--text-muted); font-size:0.75rem;">${kpis.validOrdersCount || 0} pedidos activos • Ticket prom: ${app.formatCOP(kpis.avgTicket || 0)}</small>
        </div>
        <div class="stat-card">
          <span>COSTO PRENDAS + GASTOS</span>
          <strong style="color:#B45309;">${app.formatCOP((kpis.totalCogs || 0) + (kpis.totalExpenses || 0))}</strong>
          <small style="color:var(--text-muted); font-size:0.75rem;">Costo prendas: ${app.formatCOP(kpis.totalCogs || 0)} | Gastos: ${app.formatCOP(kpis.totalExpenses || 0)}</small>
        </div>
        <div class="stat-card" style="border-color:#A7F3D0; background:#F0FDF4;">
          <span style="color:#065F46;">UTILIDAD NETA REAL</span>
          <strong style="color:${(kpis.netProfit || 0) >= 0 ? '#047857' : '#DC2626'};">${app.formatCOP(kpis.netProfit || 0)}</strong>
          <small style="color:#065F46; font-size:0.75rem;">Ganancia libre después de costos y gastos</small>
        </div>
        <div class="stat-card">
          <span>INVENTARIO EN BODEGA (${kpis.totalInventoryUnits || 0} UND)</span>
          <strong>${app.formatCOP(kpis.inventoryRetailValue || 0)}</strong>
          <small style="color:var(--text-muted); font-size:0.75rem;">Valor al costo: ${app.formatCOP(kpis.inventoryCostValue || 0)}</small>
        </div>
      </div>

      <!-- Acciones Rápidas de Operación Diaria -->
      <div class="admin-card" style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px;">
        <div>
          <h4 style="font-family:var(--font-heading);">Centro de Operación Rápida — V&amp;V Studio</h4>
          <p style="font-size:0.82rem; color:var(--text-muted);">Atajos directos para las tareas diarias de la tienda</p>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          <button class="btn-primary-gold inline-icon-btn" onclick="admin.switchTab('orders'); setTimeout(() => admin.openPosModal(), 80);">
            <i data-lucide="plus-circle" class="icon-xs"></i>
            <span>Nueva Venta Manual (POS / WhatsApp)</span>
          </button>
          <button class="btn-card-view inline-icon-btn" onclick="admin.prepareNewProduct(); admin.switchTab('products');">
            <i data-lucide="shirt" class="icon-xs"></i>
            <span>Crear Nuevo Producto</span>
          </button>
          <button class="btn-outline-sm inline-icon-btn" onclick="admin.switchTab('expenses')">
            <i data-lucide="wallet" class="icon-xs"></i>
            <span>Registrar Gasto</span>
          </button>
          <button class="btn-outline-sm inline-icon-btn" onclick="admin.downloadFullBackup()">
            <i data-lucide="download" class="icon-xs"></i>
            <span>Descargar Backup (.json)</span>
          </button>
        </div>
      </div>

      <div class="form-grid-2">
        <!-- Rendimiento por Marca -->
        <div class="admin-card">
          <h4 style="margin-bottom:12px; font-family:var(--font-heading);">Ventas por Sub-Marca Oficial</h4>
          <div style="display:flex; justify-content:space-between; font-size:0.84rem; font-weight:700; margin-bottom:6px;">
            <span>VaroStyle (Hombre): ${app.formatCOP(kpis.varoRevenue || 0)} (${varoPct}%)</span>
            <span>Valen Shop (Mujer): ${app.formatCOP(kpis.valenRevenue || 0)} (${valenPct}%)</span>
          </div>
          <div style="height:14px; border-radius:99px; background:#EBDAD3; overflow:hidden; display:flex; margin-bottom:18px;">
            <div style="width:${varoPct}%; background:#111115; transition:width 0.3s;"></div>
            <div style="width:${valenPct}%; background:#B87D6A; transition:width 0.3s;"></div>
          </div>

          <h5 style="font-size:0.82rem; text-transform:uppercase; color:var(--text-muted); margin-bottom:10px;">Top Prendas Más Vendidas</h5>
          ${
            (kpis.topProducts || []).length === 0
              ? `<p style="font-size:0.84rem; color:var(--text-muted);">Aún no hay ventas registradas para calcular el ranking.</p>`
              : (kpis.topProducts || [])
                  .map(
                    tp => `
                  <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-color); font-size:0.83rem;">
                    <div style="display:flex; align-items:center; gap:10px;">
                      ${tp.image ? `<img src="${tp.image}" style="width:34px; height:42px; object-fit:cover; border-radius:6px;" />` : ''}
                      <div>
                        <strong>${tp.name}</strong>
                        <div style="font-size:0.74rem; color:var(--text-muted);">${tp.brand === 'valenshop' ? 'Valen Shop' : 'VaroStyle'} • ${tp.unitsSold} und vendidas</div>
                      </div>
                    </div>
                    <strong>${app.formatCOP(tp.revenue)}</strong>
                  </div>
                `
                  )
                  .join('')
          }
        </div>

        <!-- Alertas de Inventario Bajo / Agotado -->
        <div class="admin-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h4 style="font-family:var(--font-heading);">Alertas de Stock Crítico (${lowStock.length})</h4>
            <button class="btn-outline-sm" onclick="admin.state.productStockFilter='low'; admin.switchTab('products')">Gestionar Stock</button>
          </div>
          ${
            lowStock.length === 0
              ? `<div style="padding:20px; background:#F0FDF4; color:#065F46; border-radius:10px; font-size:0.85rem;">Todas las prendas cuentan con buen nivel de stock disponible.</div>`
              : `<div style="max-height:280px; overflow-y:auto;">
                  ${lowStock
                    .map(
                      p => `
                    <div style="display:flex; align-items:center; justify-content:space-between; padding:9px 0; border-bottom:1px solid var(--border-color); font-size:0.83rem;">
                      <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${p.images?.[0] || ''}" style="width:36px; height:44px; object-fit:cover; border-radius:6px;" />
                        <div>
                          <strong>${p.name}</strong>
                          <div style="font-size:0.74rem; color:var(--text-muted);">SKU: ${p.sku || 'N/A'} • Min: ${p.minStockAlert || 3}</div>
                        </div>
                      </div>
                      <div style="display:flex; align-items:center; gap:8px;">
                        <span class="badge-pill badge-sale">${p.stock <= 0 ? 'AGOTADO (0)' : `Quedan ${p.stock}`}</span>
                        <button class="btn-card-edit" onclick="admin.quickAdjustStock(${p.id}, 5)" title="Sumar +5 unidades">+5</button>
                      </div>
                    </div>
                  `
                    )
                    .join('')}
                </div>`
          }
        </div>
      </div>
    `;
  },

  // ==========================================================================
  // TAB 2: CRUD DE PRODUCTOS, COSTOS & KARDEX DE INVENTARIO
  // ==========================================================================
  prepareNewProduct() {
    this.state.editingProductId = null;
    this.state.tempColors = [
      { name: 'Negro', hex: '#141416' },
      { name: 'Blanco', hex: '#F5F5F7' }
    ];
    this.state.tempImages = [];
  },

  prepareEditProduct(productId) {
    const p = this.state.products.find(x => x.id === Number(productId));
    if (!p) return;
    this.state.editingProductId = p.id;
    this.state.tempColors = Array.isArray(p.colors) && p.colors.length ? [...p.colors] : [{ name: 'Negro', hex: '#111111' }];
    this.state.tempImages = Array.isArray(p.images) ? [...p.images] : [];
  },

  renderProductsTab() {
    const editingProduct = this.state.editingProductId
      ? this.state.products.find(p => p.id === Number(this.state.editingProductId))
      : null;

    const sizesString = editingProduct ? (editingProduct.sizes || []).join(', ') : 'S, M, L, XL';
    const catOptions = [
      ...new Set([
        ...this.state.categories.map(c => c.name),
        ...this.state.products.map(p => p.category).filter(Boolean),
        'Camisas',
        'Camisetas',
        'Vestidos y Enterizos',
        'Blusas y Tops',
        'Conjuntos',
        'Jeans y Pantalones',
        'Chaquetas y Blazers',
        'Accesorios'
      ])
    ];

    // Filtrado de la tabla de productos
    let filteredProducts = [...this.state.products];
    if (this.state.productBrandFilter !== 'all') {
      filteredProducts = filteredProducts.filter(p => p.brand === this.state.productBrandFilter);
    }
    if (this.state.productStockFilter === 'low') {
      filteredProducts = filteredProducts.filter(p => p.stock > 0 && p.stock <= (p.minStockAlert || 3));
    } else if (this.state.productStockFilter === 'out') {
      filteredProducts = filteredProducts.filter(p => p.stock <= 0);
    } else if (this.state.productStockFilter === 'hidden') {
      filteredProducts = filteredProducts.filter(p => !p.active);
    }
    if (this.state.productSearch.trim()) {
      const q = this.state.productSearch.toLowerCase();
      filteredProducts = filteredProducts.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q)
      );
    }

    return `
      <div class="admin-card" id="productFormCard">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:16px;">
          <h4 class="inline-icon-text" style="font-family:var(--font-heading); font-size:1.1rem;">
            <i data-lucide="${editingProduct ? 'pencil' : 'plus-circle'}" class="icon-sm"></i>
            <span>${editingProduct ? `Editando Prenda: ${editingProduct.name} (${editingProduct.sku || '#' + editingProduct.id})` : 'Agregar Nueva Prenda al Catálogo'}</span>
          </h4>
          <div style="display:flex; gap:8px;">
            ${
              editingProduct
                ? `<button class="btn-outline-sm" onclick="admin.prepareNewProduct(); admin.renderAdminPortal()">+ Cancelar y Crear Nuevo</button>`
                : ''
            }
            <button class="btn-outline-sm inline-icon-btn" onclick="admin.openGlobalKardexModal()">
              <i data-lucide="history" class="icon-xs"></i>
              <span>Ver Kardex General</span>
            </button>
          </div>
        </div>

        <form onsubmit="admin.saveProduct(event)">
          <div class="form-grid-2">
            <div class="form-field">
              <label>Nombre de la Prenda *</label>
              <input type="text" id="prodName" required value="${editingProduct ? editingProduct.name.replace(/"/g, '&quot;') : ''}" placeholder="Ej: Camisa Lino Imperial / Vestido Gala Satinado" />
            </div>
            <div class="form-grid-2" style="margin-bottom:0;">
              <div class="form-field">
                <label>SKU / Código (Opcional)</label>
                <input type="text" id="prodSku" value="${editingProduct ? editingProduct.sku || '' : ''}" placeholder="Autogenerado si vacío" style="text-transform:uppercase;" />
              </div>
              <div class="form-field">
                <label>Sub-Marca Oficial *</label>
                <select id="prodBrand" required>
                  <option value="varostyle" ${editingProduct?.brand === 'varostyle' ? 'selected' : ''}>VaroStyle (Hombre)</option>
                  <option value="valenshop" ${editingProduct?.brand === 'valenshop' ? 'selected' : ''}>Valen Shop (Mujer)</option>
                </select>
              </div>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-field">
              <label>Categoría *</label>
              <input type="text" id="prodCategory" list="categorySuggestions" required value="${editingProduct ? editingProduct.category : 'Camisas'}" placeholder="Selecciona o escribe una categoría" />
              <datalist id="categorySuggestions">
                ${catOptions.map(c => `<option value="${c}"></option>`).join('')}
              </datalist>
            </div>
            <div class="form-grid-2" style="margin-bottom:0;">
              <div class="form-field">
                <label>Etiqueta Promocional</label>
                <select id="prodBadge">
                  <option value="" ${!editingProduct?.badge ? 'selected' : ''}>Sin etiqueta</option>
                  <option value="NUEVO" ${editingProduct?.badge === 'NUEVO' ? 'selected' : ''}>NUEVO</option>
                  <option value="MÁS VENDIDO" ${editingProduct?.badge === 'MÁS VENDIDO' ? 'selected' : ''}>MÁS VENDIDO</option>
                  <option value="SALE" ${editingProduct?.badge === 'SALE' ? 'selected' : ''}>SALE (En Oferta)</option>
                </select>
              </div>
              <div class="form-field">
                <label>Visibilidad en Tienda</label>
                <select id="prodActive">
                  <option value="1" ${editingProduct?.active !== false ? 'selected' : ''}>Visible / Activo</option>
                  <option value="0" ${editingProduct?.active === false ? 'selected' : ''}>Oculto (Borrador)</option>
                </select>
              </div>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-grid-2" style="margin-bottom:0;">
              <div class="form-field">
                <label>Precio de Venta (COP) *</label>
                <input type="number" id="prodPrice" required min="1000" step="500" value="${editingProduct ? editingProduct.price : 95000}" oninput="admin.updateLiveMargin()" />
              </div>
              <div class="form-field">
                <label>Costo Proveedor (COP) <small id="prodMarginBadge" style="color:#047857;"></small></label>
                <input type="number" id="prodCostPrice" min="0" step="500" value="${editingProduct ? editingProduct.costPrice || 0 : 45000}" oninput="admin.updateLiveMargin()" />
              </div>
            </div>
            <div class="form-grid-2" style="margin-bottom:0;">
              <div class="form-field">
                <label>Precio Antes / Tachado (COP)</label>
                <input type="number" id="prodComparePrice" min="0" step="500" value="${editingProduct ? editingProduct.comparePrice || 0 : 0}" />
              </div>
              <div class="form-field" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <div>
                  <label>Stock Actual *</label>
                  <input type="number" id="prodStock" min="0" value="${editingProduct ? editingProduct.stock : 15}" />
                </div>
                <div>
                  <label>Alerta Mín.</label>
                  <input type="number" id="prodMinStock" min="0" value="${editingProduct ? editingProduct.minStockAlert ?? 3 : 3}" />
                </div>
              </div>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-field">
              <label>Tallas Disponibles (separadas por coma) *</label>
              <input type="text" id="prodSizes" required value="${sizesString}" placeholder="Ej: XS, S, M, L, XL o 28, 30, 32, 34" />
            </div>
            <div class="form-field" style="display:flex; align-items:flex-end; padding-bottom:10px;">
              <label style="display:inline-flex; align-items:center; gap:8px; cursor:pointer; font-size:0.86rem;">
                <input type="checkbox" id="prodFeatured" ${editingProduct ? (editingProduct.featured ? 'checked' : '') : 'checked'} style="width:18px; height:18px;" />
                <span>Destacar esta prenda en los primeros lugares del catálogo</span>
              </label>
            </div>
          </div>

          <div class="form-field">
            <label>Descripción Comercial de la Prenda</label>
            <textarea id="prodDescription" rows="2" placeholder="Describe la tela, horma, caída y ocasión de uso...">${editingProduct ? editingProduct.description || '' : ''}</textarea>
          </div>

          <!-- Colores con selector visual -->
          <div class="form-field" style="background:#FAF9F6; padding:14px; border-radius:10px; border:1px solid var(--border-color);">
            <label>Colores de la Prenda</label>
            <div id="adminColorsList" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
              ${this.state.tempColors
                .map(
                  (c, idx) => `
                <span style="display:inline-flex; align-items:center; gap:6px; background:#fff; padding:5px 10px; border-radius:99px; border:1px solid var(--border-color); font-size:0.78rem;">
                  <span class="color-dot" style="background:${c.hex}"></span>
                  <strong>${c.name}</strong>
                  <button type="button" onclick="admin.removeTempColor(${idx})" style="border:none; background:none; color:#DC2626; font-weight:800; cursor:pointer;">×</button>
                </span>
              `
                )
                .join('')}
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
              <input type="text" id="newColorName" placeholder="Nombre color (ej: Champagne)" style="max-width:210px;" />
              <input type="color" id="newColorHex" value="#111111" style="width:46px; height:38px; padding:2px;" />
              <button type="button" class="btn-outline-sm" onclick="admin.addTempColor()">+ Agregar Color</button>
            </div>
          </div>

          <!-- Fotos del Producto -->
          <div class="form-field" style="background:#FAF9F6; padding:14px; border-radius:10px; border:1px solid var(--border-color);">
            <label>Fotos de la Prenda (Sube desde tu celular/PC o pega URL — Persistentes en la Nube)</label>
            <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
              ${this.state.tempImages
                .map(
                  (img, idx) => `
                <div style="position:relative; width:76px; height:96px; border-radius:8px; overflow:hidden; border:1px solid var(--border-color);">
                  <img src="${img}" style="width:100%; height:100%; object-fit:cover;" />
                  <button
                    type="button"
                    onclick="admin.removeTempImage(${idx})"
                    style="position:absolute; top:3px; right:3px; background:rgba(0,0,0,0.75); color:#fff; border:none; width:20px; height:20px; border-radius:50%; font-size:0.72rem; cursor:pointer;"
                  >×</button>
                </div>
              `
                )
                .join('')}
            </div>

            <div class="form-grid-2">
              <div>
                <label style="font-size:0.75rem;">Subir archivo(s) desde tu galería o computador:</label>
                <input type="file" accept="image/*" multiple onchange="admin.handleProductImagesUpload(this)" />
              </div>
              <div>
                <label style="font-size:0.75rem;">O pegar link directo de imagen (URL):</label>
                <div style="display:flex; gap:6px;">
                  <input type="url" id="newImageUrlInput" placeholder="https://..." />
                  <button type="button" class="btn-outline-sm" onclick="admin.addImageByUrl()">Agregar</button>
                </div>
              </div>
            </div>
          </div>

          <button type="submit" class="btn-checkout-main inline-icon-btn justify-center" style="max-width:340px;">
            <i data-lucide="save" class="icon-xs"></i>
            <span>${editingProduct ? 'GUARDAR CAMBIOS DEL PRODUCTO' : 'PUBLICAR PRENDA EN LA TIENDA'}</span>
          </button>
        </form>
      </div>

      <!-- Listado, Buscador, Filtros y Acciones Rápidas de Inventario -->
      <div class="admin-card">
        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:12px; margin-bottom:14px;">
          <h4 style="font-family:var(--font-heading);">Inventario General (${filteredProducts.length} de ${this.state.products.length} prendas)</h4>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            <input
              type="search"
              placeholder="Buscar por nombre o SKU..."
              value="${this.state.productSearch.replace(/"/g, '&quot;')}"
              oninput="admin.state.productSearch = this.value; admin.renderAdminPortal();"
              style="padding:7px 12px; border:1px solid var(--border-color); border-radius:8px; font-size:0.82rem;"
            />
            <select onchange="admin.state.productBrandFilter = this.value; admin.renderAdminPortal();" style="padding:7px 10px; border:1px solid var(--border-color); border-radius:8px; font-size:0.82rem;">
              <option value="all" ${this.state.productBrandFilter === 'all' ? 'selected' : ''}>Todas las Marcas</option>
              <option value="varostyle" ${this.state.productBrandFilter === 'varostyle' ? 'selected' : ''}>VaroStyle (Hombre)</option>
              <option value="valenshop" ${this.state.productBrandFilter === 'valenshop' ? 'selected' : ''}>Valen Shop (Mujer)</option>
            </select>
            <select onchange="admin.state.productStockFilter = this.value; admin.renderAdminPortal();" style="padding:7px 10px; border:1px solid var(--border-color); border-radius:8px; font-size:0.82rem;">
              <option value="all" ${this.state.productStockFilter === 'all' ? 'selected' : ''}>Todo el Stock</option>
              <option value="low" ${this.state.productStockFilter === 'low' ? 'selected' : ''}>Stock Bajo</option>
              <option value="out" ${this.state.productStockFilter === 'out' ? 'selected' : ''}>Agotados (0)</option>
              <option value="hidden" ${this.state.productStockFilter === 'hidden' ? 'selected' : ''}>Ocultos</option>
            </select>
            <button class="btn-outline-sm inline-icon-btn" onclick="admin.exportProductsCSV()">
              <i data-lucide="file-spreadsheet" class="icon-xs"></i>
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>

        <div style="overflow-x:auto;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Foto</th>
                <th>Prenda / SKU</th>
                <th>Sub-marca</th>
                <th>Precio / Costo</th>
                <th>Stock (Ajuste Rápido)</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${filteredProducts
                .map(p => {
                  const margin = p.price > 0 ? Math.round(((p.price - (p.costPrice || 0)) / p.price) * 100) : 0;
                  const isLow = p.stock <= (p.minStockAlert || 3);
                  return `
                <tr style="${!p.active ? 'opacity:0.6; background:#F9FAFB;' : ''}">
                  <td><img src="${p.images?.[0] || ''}" alt="${p.name}" /></td>
                  <td>
                    <strong>${p.name}</strong>
                    <div style="font-size:0.74rem; color:var(--text-muted);">SKU: ${p.sku || 'S/N'} • ${p.category}</div>
                    <div style="font-size:0.72rem; color:var(--text-muted);">Tallas: ${(p.sizes || []).join(', ')}</div>
                  </td>
                  <td>
                    <span class="badge-pill ${p.brand === 'valenshop' ? 'badge-brand-valen' : 'badge-brand-varo'}">
                      ${p.brand === 'valenshop' ? 'Valen Shop' : 'VaroStyle'}
                    </span>
                  </td>
                  <td>
                    <strong>${app.formatCOP(p.price)}</strong>
                    <div style="font-size:0.73rem; color:var(--text-muted);">Costo: ${app.formatCOP(p.costPrice || 0)} (${margin}%)</div>
                  </td>
                  <td>
                    <div style="display:inline-flex; align-items:center; gap:6px;">
                      <button class="btn-card-edit" onclick="admin.quickAdjustStock(${p.id}, -1)" title="Restar 1">−</button>
                      <strong style="min-width:28px; text-align:center; color:${isLow ? '#DC2626' : 'inherit'};">${p.stock}</strong>
                      <button class="btn-card-edit" onclick="admin.quickAdjustStock(${p.id}, 1)" title="Sumar 1">+</button>
                    </div>
                  </td>
                  <td>
                    <button
                      class="btn-card-edit"
                      style="font-size:0.72rem; font-weight:700; color:${p.active ? '#047857' : '#6B7280'};"
                      onclick="admin.toggleProductActive(${p.id}, ${!p.active})"
                    >
                      ${p.active ? 'Activo' : 'Oculto'}
                    </button>
                  </td>
                  <td>
                    <div style="display:flex; gap:5px; flex-wrap:wrap;">
                      <button class="btn-card-edit" onclick="admin.prepareEditProduct(${p.id}); admin.renderAdminPortal(); document.getElementById('productFormCard')?.scrollIntoView({behavior:'smooth'});" title="Editar">
                        <i data-lucide="pencil" class="icon-xs"></i>
                      </button>
                      <button class="btn-card-edit" onclick="admin.duplicateProduct(${p.id})" title="Duplicar Prenda">
                        <i data-lucide="copy" class="icon-xs"></i>
                      </button>
                      <button class="btn-card-edit" onclick="admin.openProductKardexModal(${p.id})" title="Ver Historial Kardex">
                        <i data-lucide="history" class="icon-xs"></i>
                      </button>
                      <button class="btn-card-edit" style="color:#DC2626;" onclick="admin.deleteProduct(${p.id})" title="Eliminar">
                        <i data-lucide="trash-2" class="icon-xs"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  updateLiveMargin() {
    const price = Number(document.getElementById('prodPrice')?.value || 0);
    const cost = Number(document.getElementById('prodCostPrice')?.value || 0);
    const badge = document.getElementById('prodMarginBadge');
    if (badge && price > 0) {
      const pct = Math.round(((price - cost) / price) * 100);
      badge.textContent = `(Margen: ${pct}%)`;
    }
  },

  addTempColor() {
    const nameEl = document.getElementById('newColorName');
    const hexEl = document.getElementById('newColorHex');
    const name = nameEl?.value.trim();
    const hex = hexEl?.value || '#111111';
    if (!name) {
      app.showToast('Escribe el nombre del color primero');
      return;
    }
    this.state.tempColors.push({ name, hex });
    nameEl.value = '';
    this.renderAdminPortal();
  },

  removeTempColor(idx) {
    this.state.tempColors.splice(idx, 1);
    this.renderAdminPortal();
  },

  async handleProductImagesUpload(input) {
    if (!input.files || !input.files.length) return;
    const formData = new FormData();
    Array.from(input.files).forEach(f => formData.append('files', f));

    try {
      app.showToast('Subiendo y optimizando imagen(es)...');
      const res = await fetch('/api/upload?base64=1', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.urls) {
        this.state.tempImages.push(...data.urls);
        this.renderAdminPortal();
        app.showToast('Fotos cargadas correctamente');
      }
    } catch (err) {
      app.showToast('Error subiendo fotos');
    }
  },

  addImageByUrl() {
    const input = document.getElementById('newImageUrlInput');
    const url = input?.value.trim();
    if (!url) return;
    this.state.tempImages.push(url);
    input.value = '';
    this.renderAdminPortal();
  },

  removeTempImage(idx) {
    this.state.tempImages.splice(idx, 1);
    this.renderAdminPortal();
  },

  async saveProduct(event) {
    event.preventDefault();
    const sizesRaw = document.getElementById('prodSizes')?.value || 'S, M, L';
    const sizes = sizesRaw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const payload = {
      sku: document.getElementById('prodSku')?.value.trim(),
      name: document.getElementById('prodName')?.value.trim(),
      brand: document.getElementById('prodBrand')?.value,
      category: document.getElementById('prodCategory')?.value.trim(),
      price: Number(document.getElementById('prodPrice')?.value || 0),
      costPrice: Number(document.getElementById('prodCostPrice')?.value || 0),
      comparePrice: Number(document.getElementById('prodComparePrice')?.value || 0),
      stock: Number(document.getElementById('prodStock')?.value || 10),
      minStockAlert: Number(document.getElementById('prodMinStock')?.value || 3),
      badge: document.getElementById('prodBadge')?.value || '',
      active: document.getElementById('prodActive')?.value === '1',
      featured: Boolean(document.getElementById('prodFeatured')?.checked),
      description: document.getElementById('prodDescription')?.value.trim(),
      sizes: sizes.length ? sizes : ['Única'],
      colors: this.state.tempColors.length ? this.state.tempColors : [{ name: 'Negro', hex: '#111111' }],
      images: this.state.tempImages.length
        ? this.state.tempImages
        : ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=85']
    };

    try {
      const isEditing = Boolean(this.state.editingProductId);
      const url = isEditing ? `/api/products/${this.state.editingProductId}` : '/api/products';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Error guardando producto');

      await app.loadBootstrapData();
      app.renderAll();
      await this.loadAllAdminData();
      this.prepareNewProduct();
      this.renderAdminPortal();
      app.showToast(isEditing ? 'Prenda actualizada con éxito' : 'Nueva prenda publicada en la tienda');
    } catch (err) {
      app.showToast('No se pudo guardar el producto');
    }
  },

  async quickAdjustStock(productId, delta) {
    try {
      const res = await fetch(`/api/products/${productId}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta, type: 'ADJUSTMENT', note: `Ajuste rápido (${delta > 0 ? '+' + delta : delta})` })
      });
      if (!res.ok) throw new Error();
      await app.loadBootstrapData();
      app.renderAll();
      await this.loadAllAdminData();
      this.renderAdminPortal();
    } catch (e) {
      app.showToast('Error ajustando inventario');
    }
  },

  async toggleProductActive(productId, nextActive) {
    try {
      await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: nextActive })
      });
      await app.loadBootstrapData();
      app.renderAll();
      await this.loadAllAdminData();
      this.renderAdminPortal();
      app.showToast(nextActive ? 'Prenda activada en tienda' : 'Prenda ocultada de la tienda');
    } catch (e) {
      app.showToast('Error cambiando estado');
    }
  },

  async duplicateProduct(productId) {
    try {
      const res = await fetch(`/api/products/${productId}/duplicate`, { method: 'POST' });
      if (!res.ok) throw new Error();
      await app.loadBootstrapData();
      app.renderAll();
      await this.loadAllAdminData();
      this.renderAdminPortal();
      app.showToast('Prenda duplicada correctamente');
    } catch (e) {
      app.showToast('No se pudo duplicar la prenda');
    }
  },

  async deleteProduct(productId) {
    if (!confirm('¿Estás seguro de eliminar esta prenda del catálogo y su kardex?')) return;
    try {
      await fetch(`/api/products/${productId}`, { method: 'DELETE' });
      await app.loadBootstrapData();
      app.renderAll();
      await this.loadAllAdminData();
      this.renderAdminPortal();
      app.showToast('Prenda eliminada');
    } catch (err) {
      app.showToast('Error eliminando prenda');
    }
  },

  async openProductKardexModal(productId) {
    const prod = this.state.products.find(p => p.id === Number(productId));
    if (!prod) return;
    try {
      const res = await fetch(`/api/products/${productId}/movements`);
      const rows = await res.json();
      this.openSubModal(`
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <div>
            <span class="badge-pill badge-promo">KARDEX DE INVENTARIO</span>
            <h4 style="font-family:var(--font-heading); margin-top:4px;">${prod.name} (${prod.sku || 'S/N'})</h4>
          </div>
          <button class="close-btn" onclick="admin.closeSubModal()">×</button>
        </div>
        <p style="font-size:0.84rem; margin-bottom:12px;">Stock actual disponible: <strong>${prod.stock} unidades</strong></p>
        <div style="max-height:360px; overflow-y:auto;">
          <table class="admin-table">
            <thead>
              <tr><th>Fecha</th><th>Tipo</th><th>Cant.</th><th>Stock Ant.</th><th>Stock Nuevo</th><th>Detalle</th></tr>
            </thead>
            <tbody>
              ${
                rows.length === 0
                  ? `<tr><td colspan="6">Sin movimientos registrados aún.</td></tr>`
                  : rows
                      .map(
                        m => `
                      <tr>
                        <td style="font-size:0.75rem;">${new Date(m.createdAt).toLocaleString('es-CO')}</td>
                        <td><span class="badge-pill">${m.type}</span></td>
                        <td style="font-weight:800; color:${m.quantity >= 0 ? '#047857' : '#DC2626'};">${m.quantity >= 0 ? '+' + m.quantity : m.quantity}</td>
                        <td>${m.previousStock}</td>
                        <td><strong>${m.newStock}</strong></td>
                        <td style="font-size:0.78rem;">${m.note || ''}</td>
                      </tr>
                    `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      `);
    } catch (e) {
      app.showToast('Error consultando Kardex');
    }
  },

  openGlobalKardexModal() {
    const rows = this.state.movements || [];
    this.openSubModal(`
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <div>
          <span class="badge-pill badge-promo">AUDITORÍA DE INVENTARIO</span>
          <h4 style="font-family:var(--font-heading); margin-top:4px;">Últimos Movimientos de Kardex</h4>
        </div>
        <button class="close-btn" onclick="admin.closeSubModal()">×</button>
      </div>
      <div style="max-height:420px; overflow-y:auto;">
        <table class="admin-table">
          <thead>
            <tr><th>Fecha</th><th>Prenda / SKU</th><th>Tipo</th><th>Variación</th><th>Stock Final</th><th>Motivo</th></tr>
          </thead>
          <tbody>
            ${
              rows.length === 0
                ? `<tr><td colspan="6">Sin movimientos registrados.</td></tr>`
                : rows
                    .map(
                      m => `
                    <tr>
                      <td style="font-size:0.74rem;">${new Date(m.createdAt).toLocaleString('es-CO')}</td>
                      <td><strong>${m.productName}</strong><br/><small>${m.sku || ''}</small></td>
                      <td><span class="badge-pill">${m.type}</span></td>
                      <td style="font-weight:800; color:${m.quantity >= 0 ? '#047857' : '#DC2626'};">${m.quantity >= 0 ? '+' + m.quantity : m.quantity}</td>
                      <td><strong>${m.newStock}</strong></td>
                      <td style="font-size:0.78rem;">${m.note || ''}</td>
                    </tr>
                  `
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
    `);
  },

  exportProductsCSV() {
    const headers = ['ID', 'SKU', 'Nombre', 'Marca', 'Categoria', 'Precio_Venta', 'Costo_Proveedor', 'Stock', 'Tallas', 'Estado'];
    const rows = this.state.products.map(p => [
      p.id,
      p.sku || '',
      p.name,
      p.brand === 'valenshop' ? 'Valen Shop' : 'VaroStyle',
      p.category,
      p.price,
      p.costPrice || 0,
      p.stock,
      (p.sizes || []).join(' / '),
      p.active ? 'Activo' : 'Oculto'
    ]);
    this.downloadCSV(`inventario-vvstudio-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  },

  // ==========================================================================
  // TAB 3: CRUD COMPLETO DE CATEGORÍAS Y COLECCIONES
  // ==========================================================================
  renderCategoriesTab() {
    const editingCat = this.state.editingCategoryId
      ? this.state.categories.find(c => c.id === Number(this.state.editingCategoryId))
      : null;

    return `
      <div class="form-grid-2">
        <div class="admin-card">
          <h4 style="margin-bottom:14px; font-family:var(--font-heading);">
            ${editingCat ? `Editar Categoría: ${editingCat.name}` : 'Crear Nueva Categoría'}
          </h4>
          <form onsubmit="admin.saveCategory(event)">
            <div class="form-field">
              <label>Nombre de la Categoría *</label>
              <input type="text" id="catName" required value="${editingCat ? editingCat.name : ''}" placeholder="Ej: Buzos & Hoodies, Vestidos de Fiesta..." />
            </div>
            <div class="form-grid-2">
              <div class="form-field">
                <label>Universo / Sub-Marca *</label>
                <select id="catBrand">
                  <option value="all" ${editingCat?.brand === 'all' ? 'selected' : ''}>Ambas Marcas (V&amp;V Studio)</option>
                  <option value="varostyle" ${editingCat?.brand === 'varostyle' ? 'selected' : ''}>Exclusiva VaroStyle (Hombre)</option>
                  <option value="valenshop" ${editingCat?.brand === 'valenshop' ? 'selected' : ''}>Exclusiva Valen Shop (Mujer)</option>
                </select>
              </div>
              <div class="form-field">
                <label>Orden de Aparición</label>
                <input type="number" id="catSortOrder" value="${editingCat ? editingCat.sortOrder : this.state.categories.length + 1}" />
              </div>
            </div>
            <div class="form-field">
              <label>Descripción Corta</label>
              <input type="text" id="catDesc" value="${editingCat ? editingCat.description || '' : ''}" placeholder="Descripción opcional de la colección" />
            </div>
            <div style="display:flex; gap:8px;">
              <button type="submit" class="btn-checkout-main inline-icon-btn justify-center">
                <i data-lucide="save" class="icon-xs"></i>
                <span>${editingCat ? 'ACTUALIZAR CATEGORÍA' : 'CREAR CATEGORÍA'}</span>
              </button>
              ${
                editingCat
                  ? `<button type="button" class="btn-outline-sm" onclick="admin.state.editingCategoryId=null; admin.renderAdminPortal()">Cancelar</button>`
                  : ''
              }
            </div>
          </form>
        </div>

        <div class="admin-card">
          <h4 style="margin-bottom:14px; font-family:var(--font-heading);">Categorías Activas (${this.state.categories.length})</h4>
          <div style="overflow-x:auto;">
            <table class="admin-table">
              <thead>
                <tr><th>Orden</th><th>Nombre</th><th>Marca</th><th>Prendas</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                ${this.state.categories
                  .map(c => {
                    const count = this.state.products.filter(p => p.category === c.name).length;
                    return `
                  <tr>
                    <td>#${c.sortOrder}</td>
                    <td>
                      <strong>${c.name}</strong>
                      <div style="font-size:0.73rem; color:var(--text-muted);">${c.description || ''}</div>
                    </td>
                    <td>
                      <span class="badge-pill ${c.brand === 'valenshop' ? 'badge-brand-valen' : c.brand === 'varostyle' ? 'badge-brand-varo' : 'badge-promo'}">
                        ${c.brand === 'valenshop' ? 'Valen Shop' : c.brand === 'varostyle' ? 'VaroStyle' : 'Ambas'}
                      </span>
                    </td>
                    <td><strong>${count}</strong></td>
                    <td>
                      <div style="display:flex; gap:6px;">
                        <button class="btn-card-edit" onclick="admin.state.editingCategoryId=${c.id}; admin.renderAdminPortal()">
                          <i data-lucide="pencil" class="icon-xs"></i>
                        </button>
                        <button class="btn-card-edit" style="color:#DC2626;" onclick="admin.deleteCategory(${c.id})">
                          <i data-lucide="trash-2" class="icon-xs"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  async saveCategory(event) {
    event.preventDefault();
    const payload = {
      name: document.getElementById('catName')?.value.trim(),
      brand: document.getElementById('catBrand')?.value || 'all',
      sortOrder: Number(document.getElementById('catSortOrder')?.value || 10),
      description: document.getElementById('catDesc')?.value.trim(),
      active: true
    };
    try {
      const id = this.state.editingCategoryId;
      const res = await fetch(id ? `/api/categories/${id}` : '/api/categories', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error();
      this.state.editingCategoryId = null;
      await app.loadBootstrapData();
      app.renderAll();
      await this.loadAllAdminData();
      this.renderAdminPortal();
      app.showToast('Categoría guardada correctamente');
    } catch (e) {
      app.showToast('Error guardando categoría');
    }
  },

  async deleteCategory(id) {
    if (!confirm('¿Eliminar esta categoría? Las prendas asociadas pasarán a "General".')) return;
    try {
      await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      await app.loadBootstrapData();
      app.renderAll();
      await this.loadAllAdminData();
      this.renderAdminPortal();
      app.showToast('Categoría eliminada');
    } catch (e) {
      app.showToast('Error eliminando categoría');
    }
  },

  // ==========================================================================
  // TAB 4: CRUD DE PEDIDOS, POS (VENTA MANUAL), GUÍAS Y FACTURA IMPRIMIBLE
  // ==========================================================================
  renderOrdersTab() {
    let list = [...this.state.orders];
    if (this.state.orderStatusFilter !== 'all') {
      list = list.filter(o => o.status === this.state.orderStatusFilter);
    }
    if (this.state.orderSearch.trim()) {
      const q = this.state.orderSearch.toLowerCase();
      list = list.filter(
        o =>
          (o.orderNumber || '').toLowerCase().includes(q) ||
          (o.customerName || '').toLowerCase().includes(q) ||
          (o.customerPhone || '').toLowerCase().includes(q) ||
          (o.city || '').toLowerCase().includes(q) ||
          (o.trackingNumber || '').toLowerCase().includes(q)
      );
    }

    return `
      <div class="admin-card">
        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:12px; margin-bottom:16px;">
          <div>
            <h4 style="font-family:var(--font-heading);">Gestión de Pedidos, Despachos y POS (${list.length})</h4>
            <p style="font-size:0.8rem; color:var(--text-muted);">Si pasas un pedido a "Cancelado", el sistema devuelve las prendas al stock automáticamente.</p>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            <button class="btn-primary-gold inline-icon-btn" onclick="admin.openPosModal()">
              <i data-lucide="plus-circle" class="icon-xs"></i>
              <span>+ Crear Venta Manual (POS)</span>
            </button>
            <button class="btn-outline-sm inline-icon-btn" onclick="admin.exportOrdersCSV()">
              <i data-lucide="file-spreadsheet" class="icon-xs"></i>
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>

        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px;">
          <input
            type="search"
            placeholder="Buscar # orden, cliente, guía, ciudad..."
            value="${this.state.orderSearch.replace(/"/g, '&quot;')}"
            oninput="admin.state.orderSearch = this.value; admin.renderAdminPortal();"
            style="flex:1; min-width:220px; padding:8px 12px; border:1px solid var(--border-color); border-radius:8px; font-size:0.84rem;"
          />
          <select onchange="admin.state.orderStatusFilter = this.value; admin.renderAdminPortal();" style="padding:8px 12px; border:1px solid var(--border-color); border-radius:8px; font-size:0.84rem;">
            <option value="all" ${this.state.orderStatusFilter === 'all' ? 'selected' : ''}>Todos los Estados</option>
            <option value="Pendiente" ${this.state.orderStatusFilter === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
            <option value="Pagado" ${this.state.orderStatusFilter === 'Pagado' ? 'selected' : ''}>Pagado / Confirmado</option>
            <option value="Empacado" ${this.state.orderStatusFilter === 'Empacado' ? 'selected' : ''}>Empacado</option>
            <option value="Enviado" ${this.state.orderStatusFilter === 'Enviado' ? 'selected' : ''}>Enviado</option>
            <option value="Entregado" ${this.state.orderStatusFilter === 'Entregado' ? 'selected' : ''}>Entregado</option>
            <option value="Cancelado" ${this.state.orderStatusFilter === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
          </select>
        </div>

        ${
          list.length === 0
            ? `<p style="padding:28px; text-align:center; color:var(--text-muted);">No hay pedidos que coincidan con los filtros seleccionados.</p>`
            : `<div style="overflow-x:auto;">
                <table class="admin-table">
                  <thead>
                    <tr>
                      <th>Orden / Canal</th>
                      <th>Cliente / Destino</th>
                      <th>Prendas</th>
                      <th>Total / Pago</th>
                      <th>Logística &amp; Guía</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${list
                      .map(
                        o => `
                      <tr style="${o.status === 'Cancelado' ? 'opacity:0.6; background:#FEF2F2;' : ''}">
                        <td>
                          <strong>${o.orderNumber}</strong>
                          <div style="font-size:0.72rem; color:var(--text-muted);">${new Date(o.createdAt).toLocaleDateString('es-CO')}</div>
                          <span class="badge-pill" style="background:#F3F4F6; font-size:0.62rem;">${o.channel || 'WEB'}</span>
                        </td>
                        <td>
                          <strong>${o.customerName}</strong>
                          <div style="font-size:0.75rem; color:var(--text-muted);">CC: ${o.customerDoc || 'N/A'} • Tel: ${o.customerPhone}</div>
                          <div style="font-size:0.75rem;">${o.city}${o.department ? ', ' + o.department : ''} — ${o.address}</div>
                        </td>
                        <td style="font-size:0.78rem; max-width:240px;">
                          ${(o.items || [])
                            .map(i => `<div>• ${i.name} (${i.size} / ${i.color}) <strong>x${i.quantity}</strong></div>`)
                            .join('')}
                        </td>
                        <td>
                          <strong>${app.formatCOP(o.total)}</strong>
                          <div style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase;">${o.paymentMethod}</div>
                          ${o.discount > 0 ? `<div style="font-size:0.7rem; color:#047857;">Desc: -${app.formatCOP(o.discount)}</div>` : ''}
                          ${o.paymentReceipt ? `<a href="${o.paymentReceipt}" target="_blank" style="font-size:0.72rem; color:#1D4ED8; text-decoration:underline;">Ver Comprobante</a>` : ''}
                        </td>
                        <td>
                          <div style="display:flex; flex-direction:column; gap:4px; min-width:155px;">
                            <select id="carrier_${o.id}" onchange="admin.saveOrderLogistics(${o.id})" style="padding:4px 6px; border:1px solid var(--border-color); border-radius:6px; font-size:0.74rem;">
                              <option value="" ${!o.carrier ? 'selected' : ''}>Transportadora...</option>
                              <option value="Interrapidísimo" ${o.carrier === 'Interrapidísimo' ? 'selected' : ''}>Interrapidísimo</option>
                              <option value="Servientrega" ${o.carrier === 'Servientrega' ? 'selected' : ''}>Servientrega</option>
                              <option value="Envía" ${o.carrier === 'Envía' ? 'selected' : ''}>Envía</option>
                              <option value="Coordinadora" ${o.carrier === 'Coordinadora' ? 'selected' : ''}>Coordinadora</option>
                              <option value="Domicilio Local" ${o.carrier === 'Domicilio Local' ? 'selected' : ''}>Domicilio Local</option>
                            </select>
                            <div style="display:flex; gap:4px;">
                              <input
                                type="text"
                                id="track_${o.id}"
                                value="${o.trackingNumber || ''}"
                                placeholder="# de Guía"
                                onchange="admin.saveOrderLogistics(${o.id})"
                                style="width:100%; padding:4px 6px; border:1px solid var(--border-color); border-radius:6px; font-size:0.74rem;"
                              />
                            </div>
                          </div>
                        </td>
                        <td>
                          <select
                            onchange="admin.updateOrderStatus(${o.id}, this.value)"
                            style="padding:6px 8px; border-radius:6px; border:1px solid var(--border-color); font-size:0.78rem; font-weight:700;"
                          >
                            ${['Pendiente', 'Pagado', 'Empacado', 'Enviado', 'Entregado', 'Cancelado']
                              .map(st => `<option value="${st}" ${o.status === st ? 'selected' : ''}>${st}</option>`)
                              .join('')}
                          </select>
                        </td>
                        <td>
                          <div style="display:flex; gap:5px; flex-wrap:wrap;">
                            <button class="btn-card-edit" onclick="admin.notifyOrderWhatsApp(${o.id})" title="Notificar Guía/Estado por WhatsApp" style="color:#0E6F37;">
                              <i data-lucide="message-circle" class="icon-xs"></i>
                            </button>
                            <button class="btn-card-edit" onclick="admin.printOrderInvoice(${o.id})" title="Imprimir Recibo / Rótulo de Despacho">
                              <i data-lucide="printer" class="icon-xs"></i>
                            </button>
                            <button class="btn-card-edit" onclick="admin.openEditOrderModal(${o.id})" title="Editar Pedido">
                              <i data-lucide="pencil" class="icon-xs"></i>
                            </button>
                            <button class="btn-card-edit" style="color:#DC2626;" onclick="admin.deleteOrder(${o.id})" title="Eliminar Pedido">
                              <i data-lucide="trash-2" class="icon-xs"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>`
        }
      </div>
    `;
  },

  async updateOrderStatus(orderId, status) {
    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      await app.loadBootstrapData();
      app.renderAll();
      await this.loadAllAdminData();
      this.renderAdminPortal();
      app.showToast(`Pedido actualizado a: ${status}`);
    } catch (err) {
      app.showToast('Error actualizando estado');
    }
  },

  async saveOrderLogistics(orderId) {
    const carrier = document.getElementById(`carrier_${orderId}`)?.value || '';
    const trackingNumber = document.getElementById(`track_${orderId}`)?.value.trim() || '';
    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrier, trackingNumber })
      });
      await this.loadAllAdminData();
      app.showToast('Datos de guía actualizados');
    } catch (e) {
      app.showToast('Error guardando guía');
    }
  },

  notifyOrderWhatsApp(orderId) {
    const o = this.state.orders.find(x => x.id === Number(orderId));
    if (!o) return;
    const phone = String(o.customerPhone || '').replace(/\D/g, '');
    if (!phone) {
      app.showToast('Este pedido no tiene teléfono válido');
      return;
    }
    const itemsText = (o.items || []).map(i => `• ${i.name} (Talla ${i.size}) x${i.quantity}`).join('\n');
    const guideInfo = o.trackingNumber
      ? `\n*Transportadora:* ${o.carrier || 'Nacional'}\n*Número de Guía:* ${o.trackingNumber}\n`
      : '';

    const msg = encodeURIComponent(
      `Hola *${o.customerName}*, te saludamos de *V&V Studio (VaroStyle & Valen Shop)*.\n\n` +
        `Te informamos que tu pedido *#${o.orderNumber}* se encuentra en estado: *${o.status}*.\n` +
        guideInfo +
        `\n*Prendas:*\n${itemsText}\n` +
        `*Destino:* ${o.city} (${o.address})\n` +
        `*Total:* ${app.formatCOP(o.total)}\n\n` +
        `¡Gracias por vestir con V&V Studio!`
    );
    window.open(`https://wa.me/57${phone.slice(-10)}?text=${msg}`, '_blank');
  },

  openEditOrderModal(orderId) {
    const o = this.state.orders.find(x => x.id === Number(orderId));
    if (!o) return;
    this.openSubModal(`
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <h4 style="font-family:var(--font-heading);">Editar Pedido #${o.orderNumber}</h4>
        <button class="close-btn" onclick="admin.closeSubModal()">×</button>
      </div>
      <form onsubmit="admin.saveEditedOrder(event, ${o.id})">
        <div class="form-grid-2">
          <div class="form-field">
            <label>Cliente *</label>
            <input type="text" id="editOrdName" required value="${o.customerName}" />
          </div>
          <div class="form-field">
            <label>Cédula / NIT</label>
            <input type="text" id="editOrdDoc" value="${o.customerDoc || ''}" />
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-field">
            <label>WhatsApp *</label>
            <input type="text" id="editOrdPhone" required value="${o.customerPhone}" />
          </div>
          <div class="form-field">
            <label>Ciudad / Departamento</label>
            <input type="text" id="editOrdCity" value="${o.city}" />
          </div>
        </div>
        <div class="form-field">
          <label>Dirección de Entrega</label>
          <input type="text" id="editOrdAddress" value="${o.address}" />
        </div>
        <div class="form-grid-2">
          <div class="form-field">
            <label>Transportadora</label>
            <input type="text" id="editOrdCarrier" value="${o.carrier || ''}" placeholder="Servientrega / Interrapidísimo..." />
          </div>
          <div class="form-field">
            <label>Número de Guía</label>
            <input type="text" id="editOrdTracking" value="${o.trackingNumber || ''}" />
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-field">
            <label>Costo Envío (COP)</label>
            <input type="number" id="editOrdShipping" value="${o.shipping || 0}" />
          </div>
          <div class="form-field">
            <label>Total Pedido (COP)</label>
            <input type="number" id="editOrdTotal" value="${o.total || 0}" />
          </div>
        </div>
        <div class="form-field">
          <label>Notas</label>
          <input type="text" id="editOrdNotes" value="${o.notes || ''}" />
        </div>
        <button type="submit" class="btn-checkout-main inline-icon-btn justify-center">
          <i data-lucide="save" class="icon-xs"></i>
          <span>GUARDAR CAMBIOS DEL PEDIDO</span>
        </button>
      </form>
    `);
  },

  async saveEditedOrder(event, orderId) {
    event.preventDefault();
    const payload = {
      customerName: document.getElementById('editOrdName')?.value.trim(),
      customerDoc: document.getElementById('editOrdDoc')?.value.trim(),
      customerPhone: document.getElementById('editOrdPhone')?.value.trim(),
      city: document.getElementById('editOrdCity')?.value.trim(),
      address: document.getElementById('editOrdAddress')?.value.trim(),
      carrier: document.getElementById('editOrdCarrier')?.value.trim(),
      trackingNumber: document.getElementById('editOrdTracking')?.value.trim(),
      shipping: Number(document.getElementById('editOrdShipping')?.value || 0),
      total: Number(document.getElementById('editOrdTotal')?.value || 0),
      notes: document.getElementById('editOrdNotes')?.value.trim()
    };
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      this.closeSubModal();
      await this.loadAllAdminData();
      this.renderAdminPortal();
      app.showToast('Pedido actualizado');
    } catch (e) {
      app.showToast('Error actualizando pedido');
    }
  },

  async deleteOrder(orderId) {
    if (!confirm('¿Eliminar este pedido? Si tenía unidades descontadas, serán devueltas al inventario.')) return;
    try {
      await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
      await app.loadBootstrapData();
      app.renderAll();
      await this.loadAllAdminData();
      this.renderAdminPortal();
      app.showToast('Pedido eliminado');
    } catch (e) {
      app.showToast('Error eliminando pedido');
    }
  },

  // Punto de Venta (POS Manual) para registrar ventas por WhatsApp / Instagram / Tienda Física
  openPosModal() {
    this.state.posItems = [];
    this.renderPosModalContent();
  },

  renderPosModalContent() {
    const subtotal = this.state.posItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const firstProd = this.state.products[0];

    this.openSubModal(`
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <div>
          <span class="badge-pill badge-promo">PUNTO DE VENTA (POS)</span>
          <h4 style="font-family:var(--font-heading); margin-top:4px;">Registrar Venta Manual (WhatsApp / Instagram / Presencial)</h4>
        </div>
        <button class="close-btn" onclick="admin.closeSubModal()">×</button>
      </div>

      <form onsubmit="admin.submitPosOrder(event)">
        <!-- Autocompletar Cliente existente -->
        <div class="form-grid-2">
          <div class="form-field">
            <label>Cargar Cliente del CRM (Opcional)</label>
            <select onchange="admin.fillPosCustomer(this.value)">
              <option value="">-- Nuevo cliente o escribir abajo --</option>
              ${this.state.customers
                .map(c => `<option value="${c.id}">${c.name} (${c.phone})</option>`)
                .join('')}
            </select>
          </div>
          <div class="form-field">
            <label>Canal de Venta *</label>
            <select id="posChannel">
              <option value="POS_WHATSAPP">WhatsApp Directo</option>
              <option value="POS_INSTAGRAM">Instagram DM</option>
              <option value="TIENDA_FISICA">Showroom / Venta Presencial</option>
            </select>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-field">
            <label>Nombre Cliente *</label>
            <input type="text" id="posName" required placeholder="Nombre completo" />
          </div>
          <div class="form-field">
            <label>WhatsApp / Celular *</label>
            <input type="text" id="posPhone" required placeholder="314 792 3972" />
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-field">
            <label>Cédula / NIT</label>
            <input type="text" id="posDoc" placeholder="Documento" />
          </div>
          <div class="form-field">
            <label>Ciudad y Dirección *</label>
            <input type="text" id="posAddress" required value="Entrega Local / Medellín" />
          </div>
        </div>

        <!-- Selector de Prendas para la Venta -->
        <div style="background:#FAF9F6; padding:12px; border-radius:10px; border:1px solid var(--border-color); margin-bottom:12px;">
          <label style="display:block; font-size:0.76rem; font-weight:800; margin-bottom:6px; text-transform:uppercase;">Agregar Prendas al Pedido</label>
          <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
            <select id="posProdSelect" onchange="admin.updatePosSizeColorOptions()" style="flex:2; min-width:200px; padding:8px; border-radius:8px; border:1px solid var(--border-color);">
              ${this.state.products
                .map(p => `<option value="${p.id}">${p.name} — ${app.formatCOP(p.price)} (Stock: ${p.stock})</option>`)
                .join('')}
            </select>
            <select id="posSizeSelect" style="padding:8px; border-radius:8px; border:1px solid var(--border-color);">
              ${(firstProd?.sizes || ['Única']).map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
            <input type="number" id="posQtyInput" value="1" min="1" style="width:65px; padding:8px; border-radius:8px; border:1px solid var(--border-color);" />
            <button type="button" class="btn-primary-gold" onclick="admin.addPosItem()">+ Añadir</button>
          </div>

          <div id="posItemsListContainer" style="margin-top:10px;">
            ${this.getPosItemsTableHtml()}
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-field">
            <label>Método de Pago</label>
            <select id="posPayMethod">
              <option value="nequi">Nequi / Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="contraentrega">Contraentrega</option>
              <option value="pse_card">PSE / Tarjeta</option>
            </select>
          </div>
          <div class="form-grid-2" style="margin-bottom:0;">
            <div class="form-field">
              <label>Envío (COP)</label>
              <input type="number" id="posShipping" value="0" min="0" step="1000" />
            </div>
            <div class="form-field">
              <label>Descuento (COP)</label>
              <input type="number" id="posDiscount" value="0" min="0" step="1000" />
            </div>
          </div>
        </div>

        <button type="submit" class="btn-checkout-main inline-icon-btn justify-center">
          <i data-lucide="check-circle-2" class="icon-xs"></i>
          <span>REGISTRAR VENTA Y DESCONTAR STOCK (Subtotal: ${app.formatCOP(subtotal)})</span>
        </button>
      </form>
    `);
  },

  getPosItemsTableHtml() {
    if (this.state.posItems.length === 0) {
      return `<p style="font-size:0.8rem; color:var(--text-muted);">Aún no has añadido prendas a esta venta.</p>`;
    }
    return this.state.posItems
      .map(
        (item, idx) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border-color); font-size:0.82rem;">
        <span><strong>${item.name}</strong> (Talla ${item.size}) x${item.quantity}</span>
        <div>
          <strong>${app.formatCOP(item.price * item.quantity)}</strong>
          <button type="button" onclick="admin.removePosItem(${idx})" style="margin-left:8px; border:none; background:none; color:#DC2626; font-weight:800; cursor:pointer;">×</button>
        </div>
      </div>
    `
      )
      .join('');
  },

  updatePosSizeColorOptions() {
    const prodId = Number(document.getElementById('posProdSelect')?.value);
    const prod = this.state.products.find(p => p.id === prodId);
    const sizeSelect = document.getElementById('posSizeSelect');
    if (prod && sizeSelect) {
      sizeSelect.innerHTML = (prod.sizes || ['Única']).map(s => `<option value="${s}">${s}</option>`).join('');
    }
  },

  fillPosCustomer(custId) {
    const c = this.state.customers.find(x => x.id === Number(custId));
    if (!c) return;
    const nameEl = document.getElementById('posName');
    const phoneEl = document.getElementById('posPhone');
    const docEl = document.getElementById('posDoc');
    const addrEl = document.getElementById('posAddress');
    if (nameEl) nameEl.value = c.name || '';
    if (phoneEl) phoneEl.value = c.phone || '';
    if (docEl) docEl.value = c.doc || '';
    if (addrEl) addrEl.value = `${c.city || ''} ${c.address || ''}`.trim() || 'Entrega Local';
  },

  addPosItem() {
    const prodId = Number(document.getElementById('posProdSelect')?.value);
    const size = document.getElementById('posSizeSelect')?.value || 'Única';
    const qty = Math.max(1, Number(document.getElementById('posQtyInput')?.value || 1));
    const prod = this.state.products.find(p => p.id === prodId);
    if (!prod) return;

    this.state.posItems.push({
      productId: prod.id,
      sku: prod.sku,
      name: prod.name,
      brand: prod.brand,
      price: prod.price,
      costPrice: prod.costPrice || 0,
      image: prod.images?.[0] || '',
      size,
      color: prod.colors?.[0]?.name || 'Único',
      quantity: qty
    });

    const box = document.getElementById('posItemsListContainer');
    if (box) box.innerHTML = this.getPosItemsTableHtml();
  },

  removePosItem(idx) {
    this.state.posItems.splice(idx, 1);
    const box = document.getElementById('posItemsListContainer');
    if (box) box.innerHTML = this.getPosItemsTableHtml();
  },

  async submitPosOrder(event) {
    event.preventDefault();
    if (this.state.posItems.length === 0) {
      app.showToast('Añade al menos una prenda a la venta');
      return;
    }

    const subtotal = this.state.posItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const shipping = Number(document.getElementById('posShipping')?.value || 0);
    const discount = Number(document.getElementById('posDiscount')?.value || 0);
    const total = Math.max(0, subtotal - discount + shipping);

    const payload = {
      channel: document.getElementById('posChannel')?.value || 'POS_WHATSAPP',
      customerName: document.getElementById('posName')?.value.trim(),
      customerPhone: document.getElementById('posPhone')?.value.trim(),
      customerDoc: document.getElementById('posDoc')?.value.trim(),
      city: 'Colombia',
      address: document.getElementById('posAddress')?.value.trim(),
      paymentMethod: document.getElementById('posPayMethod')?.value || 'nequi',
      status: 'Pagado',
      items: this.state.posItems,
      subtotal,
      discount,
      shipping,
      total
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error();
      this.closeSubModal();
      await app.loadBootstrapData();
      app.renderAll();
      await this.loadAllAdminData();
      this.renderAdminPortal();
      app.showToast('Venta POS registrada e inventario descontado');
    } catch (e) {
      app.showToast('Error registrando venta POS');
    }
  },

  // Generador de Comprobante / Rótulo de Envío Imprimible
  printOrderInvoice(orderId) {
    const o = this.state.orders.find(x => x.id === Number(orderId));
    if (!o) return;
    const s = app.state.settings || {};
    const mainBrand = s.mainBrand || 'V&V STUDIO';
    const nequi = s.stores?.varostyle?.nequiNumber || '314 792 3972';
    const holder = s.stores?.varostyle?.accountHolder || 'Valentina Fuenmayor';

    const win = window.open('', '_blank', 'width=820,height=900');
    if (!win) {
      app.showToast('Permite las ventanas emergentes para imprimir el comprobante');
      return;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Orden ${o.orderNumber} — ${mainBrand}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; margin: 24px; }
          .box { border: 2px solid #111; border-radius: 10px; padding: 20px; margin-bottom: 22px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 14px; }
          h1 { margin: 0; font-size: 22px; letter-spacing: 2px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background: #f4f4f4; }
          .cut-line { border-top: 2px dashed #666; margin: 24px 0; text-align: center; font-size: 11px; color: #555; padding-top: 6px; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom:16px; text-align:right;">
          <button onclick="window.print()" style="padding:10px 20px; background:#111; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">IMPRIMIR COMPROBANTE Y RÓTULO</button>
        </div>

        <!-- 1. RÓTULO DE ENVÍO PARA PEGAR EN EL PAQUETE -->
        <div class="box">
          <div class="header">
            <div>
              <h1>${mainBrand}</h1>
              <small>VAROSTYLE &amp; VALEN SHOP • WhatsApp: ${nequi}</small>
            </div>
            <div style="text-align:right;">
              <strong>ORDEN #${o.orderNumber}</strong><br/>
              <small>${new Date(o.createdAt).toLocaleDateString('es-CO')}</small>
            </div>
          </div>
          <div style="font-size:15px; line-height:1.5;">
            <strong>DESTINATARIO:</strong> ${o.customerName}<br/>
            <strong>CC / NIT:</strong> ${o.customerDoc || 'N/A'} &nbsp;|&nbsp; <strong>TELÉFONO:</strong> ${o.customerPhone}<br/>
            <strong>DESTINO:</strong> ${o.city}${o.department ? ' (' + o.department + ')' : ''}<br/>
            <strong>DIRECCIÓN:</strong> ${o.address}<br/>
            ${o.carrier ? `<strong>TRANSPORTADORA:</strong> ${o.carrier} ${o.trackingNumber ? '• GUÍA: ' + o.trackingNumber : ''}<br/>` : ''}
            ${o.paymentMethod === 'contraentrega' ? `<div style="margin-top:8px; padding:6px 10px; border:2px solid #000; display:inline-block; font-weight:bold;">RECAUDO CONTRAENTREGA: ${app.formatCOP(o.total)}</div>` : ''}
          </div>
        </div>

        <div class="cut-line">✂ CORTAR AQUÍ — RÓTULO SUPERIOR PARA EL PAQUETE / RECIBO INFERIOR PARA EL CLIENTE</div>

        <!-- 2. DETALLE DE COMPRA / FACTURA DE VENTA -->
        <div class="box">
          <div class="header">
            <div>
              <h1>${mainBrand}</h1>
              <small>Comprobante Oficial de Compra • Titular: ${holder}</small>
            </div>
            <div style="text-align:right;">
              <strong>Orden #${o.orderNumber}</strong><br/>
              <span>Estado: ${o.status}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr><th>Prenda</th><th>Marca</th><th>Talla / Color</th><th>Cant.</th><th>Subtotal</th></tr>
            </thead>
            <tbody>
              ${(o.items || [])
                .map(
                  i => `
                <tr>
                  <td>${i.name}</td>
                  <td>${i.brand === 'valenshop' ? 'Valen Shop' : 'VaroStyle'}</td>
                  <td>${i.size} / ${i.color}</td>
                  <td>${i.quantity}</td>
                  <td>${app.formatCOP(i.price * i.quantity)}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>

          <div style="margin-top:14px; text-align:right; font-size:14px; line-height:1.6;">
            <div>Subtotal: <strong>${app.formatCOP(o.subtotal)}</strong></div>
            ${o.discount > 0 ? `<div>Descuento (${o.couponCode || 'Cupón'}): <strong>-${app.formatCOP(o.discount)}</strong></div>` : ''}
            <div>Envío: <strong>${o.shipping === 0 ? 'GRATIS' : app.formatCOP(o.shipping)}</strong></div>
            <div style="font-size:18px;">TOTAL: <strong>${app.formatCOP(o.total)}</strong></div>
          </div>

          <p style="font-size:11px; color:#555; margin-top:16px; border-top:1px solid #ddd; padding-top:8px;">
            ${s.returnPolicy || 'Gracias por tu compra en V&V Studio (VaroStyle & Valen Shop).'}
          </p>
        </div>
      </body>
      </html>
    `);
    win.document.close();
  },

  exportOrdersCSV() {
    const headers = ['Orden', 'Fecha', 'Canal', 'Cliente', 'Documento', 'Telefono', 'Ciudad', 'Direccion', 'Metodo_Pago', 'Subtotal', 'Descuento', 'Envio', 'Total', 'Estado', 'Transportadora', 'Guia'];
    const rows = this.state.orders.map(o => [
      o.orderNumber,
      o.createdAt,
      o.channel || 'WEB',
      o.customerName,
      o.customerDoc || '',
      o.customerPhone,
      o.city,
      o.address,
      o.paymentMethod,
      o.subtotal,
      o.discount || 0,
      o.shipping,
      o.total,
      o.status,
      o.carrier || '',
      o.trackingNumber || ''
    ]);
    this.downloadCSV(`pedidos-vvstudio-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  },

  // ==========================================================================
  // TAB 5: CRUD COMPLETO DE CLIENTES — CRM 360°
  // ==========================================================================
  renderCustomersTab() {
    const editingCust = this.state.editingCustomerId
      ? this.state.customers.find(c => c.id === Number(this.state.editingCustomerId))
      : null;

    let list = [...this.state.customers];
    if (this.state.customerSegmentFilter !== 'all') {
      list = list.filter(c => c.segment === this.state.customerSegmentFilter);
    }
    if (this.state.customerSearch.trim()) {
      const q = this.state.customerSearch.toLowerCase();
      list = list.filter(
        c =>
          (c.name || '').toLowerCase().includes(q) ||
          (c.phone || '').toLowerCase().includes(q) ||
          (c.doc || '').toLowerCase().includes(q) ||
          (c.city || '').toLowerCase().includes(q)
      );
    }

    return `
      <div class="admin-card">
        <h4 style="margin-bottom:14px; font-family:var(--font-heading);">
          ${editingCust ? `Editando Cliente: ${editingCust.name}` : 'Registrar Cliente en el CRM'}
        </h4>
        <form onsubmit="admin.saveCustomer(event)">
          <div class="form-grid-2">
            <div class="form-field">
              <label>Nombre Completo *</label>
              <input type="text" id="custName" required value="${editingCust ? editingCust.name : ''}" placeholder="Nombre y Apellido" />
            </div>
            <div class="form-grid-2" style="margin-bottom:0;">
              <div class="form-field">
                <label>WhatsApp / Celular *</label>
                <input type="text" id="custPhone" required value="${editingCust ? editingCust.phone : ''}" placeholder="314 792 3972" />
              </div>
              <div class="form-field">
                <label>Cédula / NIT</label>
                <input type="text" id="custDoc" value="${editingCust ? editingCust.doc || '' : ''}" />
              </div>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-grid-2" style="margin-bottom:0;">
              <div class="form-field">
                <label>Ciudad / Municipio</label>
                <input type="text" id="custCity" value="${editingCust ? editingCust.city || '' : ''}" placeholder="Medellín / Bogotá..." />
              </div>
              <div class="form-field">
                <label>Segmento CRM</label>
                <select id="custSegment">
                  ${['Nuevo', 'Frecuente', 'VIP', 'Mayorista']
                    .map(s => `<option value="${s}" ${editingCust?.segment === s ? 'selected' : ''}>${s}</option>`)
                    .join('')}
                </select>
              </div>
            </div>
            <div class="form-field">
              <label>Dirección Exacta</label>
              <input type="text" id="custAddress" value="${editingCust ? editingCust.address || '' : ''}" />
            </div>
          </div>

          <div class="form-field">
            <label>Notas de Tallas / Preferencias del Cliente</label>
            <input type="text" id="custNotes" value="${editingCust ? editingCust.notes || '' : ''}" placeholder="Ej: Usa talla M en VaroStyle, prefiere pagos por Nequi..." />
          </div>

          <div style="display:flex; gap:8px;">
            <button type="submit" class="btn-checkout-main inline-icon-btn justify-center" style="max-width:280px;">
              <i data-lucide="save" class="icon-xs"></i>
              <span>${editingCust ? 'ACTUALIZAR CLIENTE' : 'GUARDAR CLIENTE'}</span>
            </button>
            ${
              editingCust
                ? `<button type="button" class="btn-outline-sm" onclick="admin.state.editingCustomerId=null; admin.renderAdminPortal()">Cancelar</button>`
                : ''
            }
          </div>
        </form>
      </div>

      <div class="admin-card">
        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px; margin-bottom:14px;">
          <h4 style="font-family:var(--font-heading);">Directorio de Clientes CRM (${list.length})</h4>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            <input
              type="search"
              placeholder="Buscar cliente, teléfono, cédula..."
              value="${this.state.customerSearch.replace(/"/g, '&quot;')}"
              oninput="admin.state.customerSearch = this.value; admin.renderAdminPortal();"
              style="padding:7px 12px; border:1px solid var(--border-color); border-radius:8px; font-size:0.82rem;"
            />
            <select onchange="admin.state.customerSegmentFilter = this.value; admin.renderAdminPortal();" style="padding:7px 10px; border:1px solid var(--border-color); border-radius:8px; font-size:0.82rem;">
              <option value="all" ${this.state.customerSegmentFilter === 'all' ? 'selected' : ''}>Todos los Segmentos</option>
              <option value="VIP" ${this.state.customerSegmentFilter === 'VIP' ? 'selected' : ''}>Clientes VIP</option>
              <option value="Frecuente" ${this.state.customerSegmentFilter === 'Frecuente' ? 'selected' : ''}>Frecuentes</option>
              <option value="Mayorista" ${this.state.customerSegmentFilter === 'Mayorista' ? 'selected' : ''}>Mayoristas</option>
              <option value="Nuevo" ${this.state.customerSegmentFilter === 'Nuevo' ? 'selected' : ''}>Nuevos</option>
            </select>
            <button class="btn-outline-sm inline-icon-btn" onclick="admin.exportCustomersCSV()">
              <i data-lucide="file-spreadsheet" class="icon-xs"></i>
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>

        <div style="overflow-x:auto;">
          <table class="admin-table">
            <thead>
              <tr><th>Cliente</th><th>Contacto</th><th>Ubicación</th><th>Segmento</th><th>Pedidos</th><th>Total Comprado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              ${
                list.length === 0
                  ? `<tr><td colspan="7" style="text-align:center; padding:24px;">No hay clientes registrados aún. Se crean automáticamente con cada pedido o manualmente arriba.</td></tr>`
                  : list
                      .map(
                        c => `
                      <tr>
                        <td>
                          <strong>${c.name}</strong>
                          <div style="font-size:0.73rem; color:var(--text-muted);">CC: ${c.doc || 'N/A'}</div>
                        </td>
                        <td>${c.phone}</td>
                        <td>${c.city || 'N/A'}<br/><small style="color:var(--text-muted);">${c.address || ''}</small></td>
                        <td><span class="badge-pill ${c.segment === 'VIP' ? 'badge-promo' : ''}">${c.segment || 'Nuevo'}</span></td>
                        <td><strong>${c.totalOrders || 0}</strong></td>
                        <td><strong>${app.formatCOP(c.totalSpent || 0)}</strong></td>
                        <td>
                          <div style="display:flex; gap:5px;">
                            <button class="btn-card-edit" onclick="admin.openCustomer360Modal(${c.id})" title="Ver Expediente 360°">
                              <i data-lucide="eye" class="icon-xs"></i>
                            </button>
                            <button class="btn-card-edit" onclick="admin.state.editingCustomerId=${c.id}; admin.renderAdminPortal();" title="Editar">
                              <i data-lucide="pencil" class="icon-xs"></i>
                            </button>
                            <a href="https://wa.me/57${String(c.phone || '').replace(/\D/g, '').slice(-10)}" target="_blank" class="btn-card-edit" style="color:#0E6F37;" title="Chatear por WhatsApp">
                              <i data-lucide="message-circle" class="icon-xs"></i>
                            </a>
                            <button class="btn-card-edit" style="color:#DC2626;" onclick="admin.deleteCustomer(${c.id})" title="Eliminar">
                              <i data-lucide="trash-2" class="icon-xs"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async saveCustomer(event) {
    event.preventDefault();
    const payload = {
      name: document.getElementById('custName')?.value.trim(),
      phone: document.getElementById('custPhone')?.value.trim(),
      doc: document.getElementById('custDoc')?.value.trim(),
      city: document.getElementById('custCity')?.value.trim(),
      segment: document.getElementById('custSegment')?.value || 'Nuevo',
      address: document.getElementById('custAddress')?.value.trim(),
      notes: document.getElementById('custNotes')?.value.trim()
    };
    try {
      const id = this.state.editingCustomerId;
      const res = await fetch(id ? `/api/customers/${id}` : '/api/customers', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error();
      this.state.editingCustomerId = null;
      await this.loadAllAdminData();
      this.renderAdminPortal();
      app.showToast('Cliente guardado en el CRM');
    } catch (e) {
      app.showToast('Error guardando cliente');
    }
  },

  async deleteCustomer(id) {
    if (!confirm('¿Eliminar este cliente del directorio CRM?')) return;
    try {
      await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      await this.loadAllAdminData();
      this.renderAdminPortal();
      app.showToast('Cliente eliminado');
    } catch (e) {
      app.showToast('Error eliminando cliente');
    }
  },

  async openCustomer360Modal(custId) {
    try {
      const res = await fetch(`/api/customers/${custId}`);
      const c = await res.json();
      this.openSubModal(`
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <div>
            <span class="badge-pill badge-promo">EXPEDIENTE 360° DEL CLIENTE</span>
            <h4 style="font-family:var(--font-heading); margin-top:4px;">${c.name} (${c.segment || 'Nuevo'})</h4>
          </div>
          <button class="close-btn" onclick="admin.closeSubModal()">×</button>
        </div>
        <div style="background:#FAF9F6; padding:14px; border-radius:10px; border:1px solid var(--border-color); margin-bottom:14px; font-size:0.84rem;">
          <div><strong>WhatsApp:</strong> ${c.phone} | <strong>Cédula:</strong> ${c.doc || 'N/A'}</div>
          <div><strong>Ubicación:</strong> ${c.city || ''} — ${c.address || ''}</div>
          <div><strong>Valor Histórico (LTV):</strong> ${app.formatCOP(c.totalSpent || 0)} en ${c.totalOrders || 0} pedido(s)</div>
          ${c.notes ? `<div style="margin-top:4px; color:#B45309;"><strong>Notas:</strong> ${c.notes}</div>` : ''}
        </div>
        <h5 style="font-size:0.82rem; text-transform:uppercase; margin-bottom:8px;">Historial de Pedidos</h5>
        <div style="max-height:280px; overflow-y:auto;">
          <table class="admin-table">
            <thead><tr><th>Orden</th><th>Fecha</th><th>Prendas</th><th>Total</th><th>Estado</th></tr></thead>
            <tbody>
              ${
                (c.orders || []).length === 0
                  ? `<tr><td colspan="5">Este cliente aún no registra pedidos asociados.</td></tr>`
                  : (c.orders || [])
                      .map(
                        o => `
                      <tr>
                        <td><strong>${o.orderNumber}</strong></td>
                        <td>${new Date(o.createdAt).toLocaleDateString('es-CO')}</td>
                        <td>${(o.items || []).map(i => `${i.name} x${i.quantity}`).join(', ')}</td>
                        <td><strong>${app.formatCOP(o.total)}</strong></td>
                        <td><span class="badge-pill">${o.status}</span></td>
                      </tr>
                    `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      `);
    } catch (e) {
      app.showToast('Error cargando expediente del cliente');
    }
  },

  exportCustomersCSV() {
    const headers = ['ID', 'Nombre', 'Cedula', 'WhatsApp', 'Ciudad', 'Direccion', 'Segmento', 'Total_Pedidos', 'Total_Comprado', 'Notas'];
    const rows = this.state.customers.map(c => [
      c.id,
      c.name,
      c.doc || '',
      c.phone,
      c.city || '',
      c.address || '',
      c.segment || 'Nuevo',
      c.totalOrders || 0,
      c.totalSpent || 0,
      c.notes || ''
    ]);
    this.downloadCSV(`clientes-crm-vvstudio-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  },

  // ==========================================================================
  // TAB 6: CRUD DE CUPONES DE DESCUENTO & TARIFAS DE ENVÍO
  // ==========================================================================
  renderPromotionsTab() {
    const editingCoupon = this.state.editingCouponId
      ? this.state.coupons.find(c => c.id === Number(this.state.editingCouponId))
      : null;

    const editingZone = this.state.editingZoneId
      ? this.state.shippingZones.find(z => z.id === Number(this.state.editingZoneId))
      : null;

    return `
      <div class="form-grid-2">
        <!-- CRUD de Cupones -->
        <div class="admin-card">
          <h4 style="margin-bottom:12px; font-family:var(--font-heading);">
            ${editingCoupon ? `Editar Cupón: ${editingCoupon.code}` : 'Crear Código Promocional / Cupón'}
          </h4>
          <form onsubmit="admin.saveCoupon(event)" style="margin-bottom:18px;">
            <div class="form-grid-2">
              <div class="form-field">
                <label>Código (Sin espacios) *</label>
                <input type="text" id="cpnCode" required value="${editingCoupon ? editingCoupon.code : ''}" placeholder="Ej: VARO15" style="text-transform:uppercase;" />
              </div>
              <div class="form-field">
                <label>Tipo de Beneficio *</label>
                <select id="cpnType">
                  <option value="PERCENT" ${editingCoupon?.type === 'PERCENT' ? 'selected' : ''}>Porcentaje (% Descuento)</option>
                  <option value="FIXED" ${editingCoupon?.type === 'FIXED' ? 'selected' : ''}>Valor Fijo ($ COP)</option>
                  <option value="FREE_SHIPPING" ${editingCoupon?.type === 'FREE_SHIPPING' ? 'selected' : ''}>Envío Gratis</option>
                </select>
              </div>
            </div>
            <div class="form-grid-2">
              <div class="form-field">
                <label>Valor (% o COP)</label>
                <input type="number" id="cpnValue" value="${editingCoupon ? editingCoupon.value : 10}" min="0" />
              </div>
              <div class="form-field">
                <label>Compra Mínima (COP)</label>
                <input type="number" id="cpnMin" value="${editingCoupon ? editingCoupon.minPurchase : 80000}" min="0" step="5000" />
              </div>
            </div>
            <div class="form-grid-2">
              <div class="form-field">
                <label>Marca Aplicable</label>
                <select id="cpnBrand">
                  <option value="all" ${editingCoupon?.brand === 'all' ? 'selected' : ''}>Toda la Tienda</option>
                  <option value="varostyle" ${editingCoupon?.brand === 'varostyle' ? 'selected' : ''}>Solo VaroStyle</option>
                  <option value="valenshop" ${editingCoupon?.brand === 'valenshop' ? 'selected' : ''}>Solo Valen Shop</option>
                </select>
              </div>
              <div class="form-field">
                <label>Vence el (Opcional)</label>
                <input type="date" id="cpnExpires" value="${editingCoupon ? editingCoupon.expiresAt || '' : '2027-12-31'}" />
              </div>
            </div>
            <button type="submit" class="btn-checkout-main inline-icon-btn justify-center">
              <i data-lucide="ticket-percent" class="icon-xs"></i>
              <span>${editingCoupon ? 'ACTUALIZAR CUPÓN' : 'GUARDAR CUPÓN'}</span>
            </button>
          </form>

          <table class="admin-table">
            <thead><tr><th>Código</th><th>Beneficio</th><th>Mínimo</th><th>Usos</th><th>Acciones</th></tr></thead>
            <tbody>
              ${this.state.coupons
                .map(
                  c => `
                <tr>
                  <td><strong>${c.code}</strong></td>
                  <td>${c.type === 'PERCENT' ? `${c.value}% OFF` : c.type === 'FIXED' ? `-${app.formatCOP(c.value)}` : 'Envío Gratis'}</td>
                  <td>${app.formatCOP(c.minPurchase || 0)}</td>
                  <td>${c.usedCount || 0}</td>
                  <td>
                    <div style="display:flex; gap:5px;">
                      <button class="btn-card-edit" onclick="admin.state.editingCouponId=${c.id}; admin.renderAdminPortal()"><i data-lucide="pencil" class="icon-xs"></i></button>
                      <button class="btn-card-edit" style="color:#DC2626;" onclick="admin.deleteCoupon(${c.id})"><i data-lucide="trash-2" class="icon-xs"></i></button>
                    </div>
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>

        <!-- CRUD de Zonas y Tarifas de Envío -->
        <div class="admin-card">
          <h4 style="margin-bottom:12px; font-family:var(--font-heading);">
            ${editingZone ? `Editar Zona: ${editingZone.name}` : 'Configurar Zona / Tarifa de Envío'}
          </h4>
          <form onsubmit="admin.saveShippingZone(event)" style="margin-bottom:18px;">
            <div class="form-field">
              <label>Nombre de la Zona *</label>
              <input type="text" id="zoneName" required value="${editingZone ? editingZone.name : ''}" placeholder="Ej: Ciudades Principales / Medellín Express" />
            </div>
            <div class="form-grid-2">
              <div class="form-field">
                <label>Costo de Envío (COP) *</label>
                <input type="number" id="zonePrice" required value="${editingZone ? editingZone.price : 12000}" min="0" step="1000" />
              </div>
              <div class="form-field">
                <label>Envío Gratis Desde (COP)</label>
                <input type="number" id="zoneFree" value="${editingZone ? editingZone.freeThreshold : 200000}" min="0" step="10000" />
              </div>
            </div>
            <div class="form-field">
              <label>Tiempo Estimado de Entrega</label>
              <input type="text" id="zoneDays" value="${editingZone ? editingZone.estimatedDays : '2 a 4 días hábiles'}" />
            </div>
            <button type="submit" class="btn-checkout-main inline-icon-btn justify-center">
              <i data-lucide="truck" class="icon-xs"></i>
              <span>${editingZone ? 'ACTUALIZAR ZONA DE ENVÍO' : 'AGREGAR ZONA DE ENVÍO'}</span>
            </button>
          </form>

          <table class="admin-table">
            <thead><tr><th>Zona</th><th>Tarifa</th><th>Gratis desde</th><th>Acciones</th></tr></thead>
            <tbody>
              ${this.state.shippingZones
                .map(
                  z => `
                <tr>
                  <td><strong>${z.name}</strong><br/><small style="color:var(--text-muted);">${z.estimatedDays || ''}</small></td>
                  <td><strong>${app.formatCOP(z.price)}</strong></td>
                  <td>${app.formatCOP(z.freeThreshold)}</td>
                  <td>
                    <div style="display:flex; gap:5px;">
                      <button class="btn-card-edit" onclick="admin.state.editingZoneId=${z.id}; admin.renderAdminPortal()"><i data-lucide="pencil" class="icon-xs"></i></button>
                      <button class="btn-card-edit" style="color:#DC2626;" onclick="admin.deleteShippingZone(${z.id})"><i data-lucide="trash-2" class="icon-xs"></i></button>
                    </div>
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async saveCoupon(event) {
    event.preventDefault();
    const payload = {
      code: document.getElementById('cpnCode')?.value.trim(),
      type: document.getElementById('cpnType')?.value,
      value: Number(document.getElementById('cpnValue')?.value || 0),
      minPurchase: Number(document.getElementById('cpnMin')?.value || 0),
      brand: document.getElementById('cpnBrand')?.value || 'all',
      expiresAt: document.getElementById('cpnExpires')?.value || '',
      active: true
    };
    try {
      const id = this.state.editingCouponId;
      const res = await fetch(id ? `/api/coupons/${id}` : '/api/coupons', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error();
      this.state.editingCouponId = null;
      await this.loadAllAdminData();
      this.renderAdminPortal();
      app.showToast('Cupón guardado');
    } catch (e) {
      app.showToast('Error guardando cupón');
    }
  },

  async deleteCoupon(id) {
    if (!confirm('¿Eliminar este cupón promocional?')) return;
    await fetch(`/api/coupons/${id}`, { method: 'DELETE' });
    await this.loadAllAdminData();
    this.renderAdminPortal();
    app.showToast('Cupón eliminado');
  },

  async saveShippingZone(event) {
    event.preventDefault();
    const payload = {
      name: document.getElementById('zoneName')?.value.trim(),
      price: Number(document.getElementById('zonePrice')?.value || 12000),
      freeThreshold: Number(document.getElementById('zoneFree')?.value || 200000),
      estimatedDays: document.getElementById('zoneDays')?.value.trim(),
      active: true
    };
    try {
      const id = this.state.editingZoneId;
      await fetch(id ? `/api/shipping-zones/${id}` : '/api/shipping-zones', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      this.state.editingZoneId = null;
      await app.loadBootstrapData();
      await this.loadAllAdminData();
      this.renderAdminPortal();
      app.showToast('Zona de envío guardada');
    } catch (e) {
      app.showToast('Error guardando zona');
    }
  },

  async deleteShippingZone(id) {
    if (!confirm('¿Eliminar esta tarifa de envío?')) return;
    await fetch(`/api/shipping-zones/${id}`, { method: 'DELETE' });
    await app.loadBootstrapData();
    await this.loadAllAdminData();
    this.renderAdminPortal();
    app.showToast('Zona eliminada');
  },

  // ==========================================================================
  // TAB 7: CRUD COMPLETO DE GASTOS OPERATIVOS & FLUJO DE CAJA
  // ==========================================================================
  renderExpensesTab() {
    const editingExp = this.state.editingExpenseId
      ? this.state.expenses.find(e => e.id === Number(this.state.editingExpenseId))
      : null;

    const totalExp = this.state.expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    return `
      <div class="form-grid-2">
        <div class="admin-card">
          <h4 style="margin-bottom:14px; font-family:var(--font-heading);">
            ${editingExp ? `Editar Gasto: ${editingExp.title}` : 'Registrar Egreso / Gasto Operativo'}
          </h4>
          <form onsubmit="admin.saveExpense(event)">
            <div class="form-field">
              <label>Concepto del Gasto *</label>
              <input type="text" id="expTitle" required value="${editingExp ? editingExp.title : ''}" placeholder="Ej: Compra lote blusas proveedor / Pauta Instagram Ads / Bolsas..." />
            </div>
            <div class="form-grid-2">
              <div class="form-field">
                <label>Categoría de Egreso</label>
                <select id="expCategory">
                  <option value="MERCANCIA" ${editingExp?.category === 'MERCANCIA' ? 'selected' : ''}>Compra de Mercancía / Proveedores</option>
                  <option value="PUBLICIDAD" ${editingExp?.category === 'PUBLICIDAD' ? 'selected' : ''}>Publicidad (Instagram / Meta Ads)</option>
                  <option value="EMPAQUES" ${editingExp?.category === 'EMPAQUES' ? 'selected' : ''}>Empaques, Bolsas y Etiquetas</option>
                  <option value="ENVIOS" ${editingExp?.category === 'ENVIOS' ? 'selected' : ''}>Envíos Asumidos / Domicilios</option>
                  <option value="OPERACION" ${editingExp?.category === 'OPERACION' ? 'selected' : ''}>Operación / Servicios</option>
                  <option value="OTROS" ${editingExp?.category === 'OTROS' ? 'selected' : ''}>Otros Gastos</option>
                </select>
              </div>
              <div class="form-field">
                <label>Valor (COP) *</label>
                <input type="number" id="expAmount" required min="100" step="500" value="${editingExp ? editingExp.amount : ''}" placeholder="Ej: 150000" />
              </div>
            </div>
            <div class="form-grid-2">
              <div class="form-field">
                <label>Marca Asociada</label>
                <select id="expBrand">
                  <option value="all" ${editingExp?.brand === 'all' ? 'selected' : ''}>General V&amp;V Studio</option>
                  <option value="varostyle" ${editingExp?.brand === 'varostyle' ? 'selected' : ''}>VaroStyle</option>
                  <option value="valenshop" ${editingExp?.brand === 'valenshop' ? 'selected' : ''}>Valen Shop</option>
                </select>
              </div>
              <div class="form-field">
                <label>Fecha</label>
                <input type="date" id="expDate" value="${editingExp ? editingExp.date : new Date().toISOString().slice(0, 10)}" />
              </div>
            </div>
            <div class="form-field">
              <label>Notas / Proveedor</label>
              <input type="text" id="expNotes" value="${editingExp ? editingExp.notes || '' : ''}" placeholder="Factura o referencia..." />
            </div>
            <button type="submit" class="btn-checkout-main inline-icon-btn justify-center">
              <i data-lucide="save" class="icon-xs"></i>
              <span>${editingExp ? 'ACTUALIZAR GASTO' : 'REGISTRAR GASTO EN CAJA'}</span>
            </button>
          </form>
        </div>

        <div class="admin-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <div>
              <h4 style="font-family:var(--font-heading);">Historial de Gastos</h4>
              <small style="color:var(--text-muted);">Total egresos registrados: <strong>${app.formatCOP(totalExp)}</strong></small>
            </div>
          </div>
          <div style="max-height:380px; overflow-y:auto;">
            <table class="admin-table">
              <thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Valor</th><th>Acciones</th></tr></thead>
              <tbody>
                ${
                  this.state.expenses.length === 0
                    ? `<tr><td colspan="5" style="text-align:center; padding:24px;">No hay gastos registrados.</td></tr>`
                    : this.state.expenses
                        .map(
                          e => `
                        <tr>
                          <td>${e.date || ''}</td>
                          <td><strong>${e.title}</strong><br/><small style="color:var(--text-muted);">${e.notes || ''}</small></td>
                          <td><span class="badge-pill">${e.category}</span></td>
                          <td style="color:#DC2626; font-weight:800;">-${app.formatCOP(e.amount)}</td>
                          <td>
                            <div style="display:flex; gap:5px;">
                              <button class="btn-card-edit" onclick="admin.state.editingExpenseId=${e.id}; admin.renderAdminPortal()"><i data-lucide="pencil" class="icon-xs"></i></button>
                              <button class="btn-card-edit" style="color:#DC2626;" onclick="admin.deleteExpense(${e.id})"><i data-lucide="trash-2" class="icon-xs"></i></button>
                            </div>
                          </td>
                        </tr>
                      `
                        )
                        .join('')
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  async saveExpense(event) {
    event.preventDefault();
    const payload = {
      title: document.getElementById('expTitle')?.value.trim(),
      category: document.getElementById('expCategory')?.value,
      amount: Number(document.getElementById('expAmount')?.value || 0),
      brand: document.getElementById('expBrand')?.value || 'all',
      date: document.getElementById('expDate')?.value,
      notes: document.getElementById('expNotes')?.value.trim()
    };
    try {
      const id = this.state.editingExpenseId;
      await fetch(id ? `/api/expenses/${id}` : '/api/expenses', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      this.state.editingExpenseId = null;
      await this.loadAllAdminData();
      this.renderAdminPortal();
      app.showToast('Gasto registrado en flujo de caja');
    } catch (e) {
      app.showToast('Error registrando gasto');
    }
  },

  async deleteExpense(id) {
    if (!confirm('¿Eliminar este registro de gasto?')) return;
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    await this.loadAllAdminData();
    this.renderAdminPortal();
    app.showToast('Gasto eliminado');
  },

  // ==========================================================================
  // TAB 8: CRUD COMPLETO DE BANNERS PROMOCIONALES
  // ==========================================================================
  renderBannersTab() {
    return `
      <div class="admin-card">
        <h4 style="margin-bottom:12px; font-family:var(--font-heading);">Crear Nuevo Banner para el Carrusel Principal</h4>
        <form onsubmit="admin.createNewBanner(event)">
          <div class="form-grid-2">
            <div class="form-field">
              <label>Título Principal *</label>
              <input type="text" id="newBanTitle" required placeholder="Ej: NUEVA COLECCIÓN DE VERANO" />
            </div>
            <div class="form-field">
              <label>Subtítulo Superior</label>
              <input type="text" id="newBanSub" placeholder="Ej: V&V STUDIO • EDICIÓN LIMITADA" />
            </div>
          </div>
          <div class="form-grid-2">
            <div class="form-field">
              <label>URL de Imagen o Subir Foto *</label>
              <div style="display:flex; gap:8px;">
                <input type="text" id="newBanImg" required placeholder="https://... o sube archivo al lado" />
                <input type="file" accept="image/*" onchange="admin.uploadNewBannerImg(this)" style="max-width:190px;" />
              </div>
            </div>
            <div class="form-grid-2" style="margin-bottom:0;">
              <div class="form-field">
                <label>Destino del Botón</label>
                <select id="newBanFilter">
                  <option value="all">Catálogo General</option>
                  <option value="varostyle">VaroStyle (Hombre)</option>
                  <option value="valenshop">Valen Shop (Mujer)</option>
                </select>
              </div>
              <div class="form-field">
                <label>Texto del Botón</label>
                <input type="text" id="newBanCta" value="VER COLECCIÓN" />
              </div>
            </div>
          </div>
          <div class="form-field">
            <label>Descripción</label>
            <input type="text" id="newBanDesc" placeholder="Texto descriptivo del banner..." />
          </div>
          <button type="submit" class="btn-primary-gold inline-icon-btn">
            <i data-lucide="plus-circle" class="icon-xs"></i>
            <span>Publicar Nuevo Banner</span>
          </button>
        </form>
      </div>

      ${this.state.banners
        .map(
          b => `
        <div class="admin-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span class="badge-pill badge-promo">BANNER #${b.id} (${b.brand.toUpperCase()})</span>
            <button class="btn-card-edit" style="color:#DC2626;" onclick="admin.deleteBanner(${b.id})">Eliminar Banner</button>
          </div>
          <div class="form-grid-2">
            <div>
              <div class="form-field">
                <label>Subtítulo</label>
                <input type="text" id="ban_sub_${b.id}" value="${b.subtitle || ''}" />
              </div>
              <div class="form-field">
                <label>Título Principal</label>
                <input type="text" id="ban_title_${b.id}" value="${b.title || ''}" />
              </div>
              <div class="form-field">
                <label>Descripción</label>
                <textarea id="ban_desc_${b.id}" rows="2">${b.description || ''}</textarea>
              </div>
              <div class="form-grid-2">
                <div class="form-field">
                  <label>Texto Botón</label>
                  <input type="text" id="ban_cta_${b.id}" value="${b.ctaText || 'VER COLECCIÓN'}" />
                </div>
                <div class="form-field">
                  <label>Imagen (URL)</label>
                  <input type="text" id="ban_img_${b.id}" value="${b.image || ''}" />
                </div>
              </div>
              <button class="btn-primary-gold inline-icon-btn" onclick="admin.saveBanner(${b.id}, '${b.brand}', '${b.ctaFilter}')">
                <i data-lucide="save" class="icon-xs"></i>
                <span>Guardar Cambios del Banner</span>
              </button>
            </div>
            <div>
              <img src="${b.image}" alt="${b.title}" style="width:100%; height:210px; object-fit:cover; border-radius:12px; border:1px solid var(--border-color);" />
            </div>
          </div>
        </div>
      `
        )
        .join('')}
    `;
  },

  async uploadNewBannerImg(input) {
    if (!input.files || !input.files[0]) return;
    const fd = new FormData();
    fd.append('files', input.files[0]);
    const res = await fetch('/api/upload?base64=1', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.urls?.[0]) {
      const el = document.getElementById('newBanImg');
      if (el) el.value = data.urls[0];
      app.showToast('Imagen lista para el banner');
    }
  },

  async createNewBanner(event) {
    event.preventDefault();
    const filter = document.getElementById('newBanFilter')?.value || 'all';
    const payload = {
      brand: filter,
      subtitle: document.getElementById('newBanSub')?.value.trim(),
      title: document.getElementById('newBanTitle')?.value.trim(),
      description: document.getElementById('newBanDesc')?.value.trim(),
      ctaText: document.getElementById('newBanCta')?.value.trim() || 'VER COLECCIÓN',
      ctaFilter: filter,
      image: document.getElementById('newBanImg')?.value.trim()
    };
    await fetch('/api/banners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    await app.loadBootstrapData();
    app.renderAll();
    await this.loadAllAdminData();
    this.renderAdminPortal();
    app.showToast('Nuevo banner publicado');
  },

  async saveBanner(id, brand, ctaFilter) {
    const payload = {
      brand,
      ctaFilter,
      subtitle: document.getElementById(`ban_sub_${id}`)?.value || '',
      title: document.getElementById(`ban_title_${id}`)?.value || '',
      description: document.getElementById(`ban_desc_${id}`)?.value || '',
      ctaText: document.getElementById(`ban_cta_${id}`)?.value || 'VER COLECCIÓN',
      image: document.getElementById(`ban_img_${id}`)?.value || ''
    };
    await fetch(`/api/banners/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    await app.loadBootstrapData();
    app.renderAll();
    await this.loadAllAdminData();
    this.renderAdminPortal();
    app.showToast('Banner actualizado');
  },

  async deleteBanner(id) {
    if (!confirm('¿Eliminar este banner del carrusel?')) return;
    await fetch(`/api/banners/${id}`, { method: 'DELETE' });
    await app.loadBootstrapData();
    app.renderAll();
    await this.loadAllAdminData();
    this.renderAdminPortal();
    app.showToast('Banner eliminado');
  },

  // ==========================================================================
  // TAB 9: IDENTIDAD V&V STUDIO, QR NEQUI, SEGURIDAD PIN & BACKUP / RESTORE JSON
  // ==========================================================================
  renderSettingsTab() {
    const s = app.state.settings || {};
    const varo = s.stores?.varostyle || {};
    const valen = s.stores?.valenshop || {};

    return `
      <!-- Respaldo y Restauración de Base de Datos (Producción) -->
      <div class="admin-card" style="background:#111115; color:#FFFFFF; display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:16px;">
        <div>
          <span class="badge-pill badge-promo">SEGURIDAD Y RESPALDO DE PRODUCCIÓN</span>
          <h4 style="font-family:var(--font-heading); margin-top:6px;">Copia de Seguridad Total (Base de Datos JSON)</h4>
          <p style="font-size:0.82rem; opacity:0.85;">Descarga un respaldo completo con todos tus productos, fotos, clientes, pedidos y finanzas, o restaura un archivo previo en 1 clic.</p>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
          <button type="button" class="btn-primary-gold inline-icon-btn" onclick="admin.downloadFullBackup()">
            <i data-lucide="download" class="icon-xs"></i>
            <span>Exportar Backup (.json)</span>
          </button>
          <label class="btn-outline-light inline-icon-btn" style="cursor:pointer;">
            <i data-lucide="upload" class="icon-xs"></i>
            <span>Restaurar Backup (.json)</span>
            <input type="file" accept=".json,application/json" onchange="admin.restoreFullBackup(this)" style="display:none;" />
          </label>
          <button type="button" class="btn-outline-light inline-icon-btn" onclick="admin.logoutAdmin()">
            <i data-lucide="log-out" class="icon-xs"></i>
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>

      <form onsubmit="admin.saveStoreSettings(event)">
        <div class="admin-card">
          <span class="badge-pill badge-promo">MARCA OFICIAL PRINCIPAL</span>
          <h4 style="margin:8px 0 14px; font-family:var(--font-heading);">Identidad Corporativa, Pagos Nequi &amp; PIN de Acceso</h4>
          <div class="form-grid-2">
            <div class="form-field">
              <label>Nombre de la Marca Principal</label>
              <input type="text" id="setMainBrand" value="${s.mainBrand || 'V&V STUDIO'}" />
            </div>
            <div class="form-field">
              <label>Subtítulo de Sub-marcas</label>
              <input type="text" id="setMainTagline" value="${s.mainTagline || 'VAROSTYLE • VALEN SHOP'}" />
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-field">
              <label>Texto Barra Superior Promocional</label>
              <input type="text" id="setTopPromo" value="${s.topPromoBar || ''}" />
            </div>
            <div class="form-grid-2" style="margin-bottom:0;">
              <div class="form-field">
                <label>Tope Envío Gratis (COP)</label>
                <input type="number" id="setFreeThreshold" value="${s.freeShippingThreshold || 200000}" />
              </div>
              <div class="form-field">
                <label>PIN de Administrador *</label>
                <input type="text" id="setAdminPin" required value="${s.adminPin || '1234'}" />
              </div>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-field">
              <label>Número Oficial de Nequi y WhatsApp</label>
              <input type="text" id="setNequiNumber" value="${varo.nequiNumber || '3147923972'}" />
            </div>
            <div class="form-field">
              <label>Titular de la Cuenta Nequi</label>
              <input type="text" id="setAccountHolder" value="${varo.accountHolder || 'Valentina Fuenmayor'}" />
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-field">
              <label>Llave Nequi / Bre-B</label>
              <input type="text" id="setNequiKey" value="${varo.nequiKey || '3147923972'}" />
            </div>
            <div class="form-field">
              <label>Subir Imagen del Código QR de Nequi</label>
              <input type="file" accept="image/*" onchange="admin.uploadQrImage(this)" />
              <input type="hidden" id="setQrUrlHidden" value="${varo.nequiQrUrl || ''}" />
            </div>
          </div>

          <div class="form-field">
            <label>Política de Cambios y Garantías (Aparece en los recibos impresos)</label>
            <input type="text" id="setReturnPolicy" value="${s.returnPolicy || ''}" />
          </div>
        </div>

        <div class="form-grid-2">
          <!-- Sub-marca 1: VaroStyle -->
          <div class="admin-card">
            <span class="badge-pill badge-brand-varo">SUB-MARCA 1 • HOMBRE</span>
            <h4 style="margin:8px 0 12px;">VaroStyle</h4>
            <div class="form-field">
              <label>Nombre Sub-marca</label>
              <input type="text" id="setVaroName" value="${varo.name || 'VaroStyle'}" />
            </div>
            <div class="form-field">
              <label>Descripción Corta</label>
              <input type="text" id="setVaroShort" value="${varo.shortDescription || 'Ropa masculina con estilo'}" />
            </div>
            <div class="form-field">
              <label>Instagram (sin @)</label>
              <input type="text" id="setVaroIg" value="${varo.instagram || 'varostyle.co'}" />
            </div>
            <div class="form-field">
              <label>Quiénes Somos (VaroStyle)</label>
              <textarea id="setVaroAbout" rows="5">${varo.aboutUs || ''}</textarea>
            </div>
          </div>

          <!-- Sub-marca 2: Valen Shop -->
          <div class="admin-card">
            <span class="badge-pill badge-brand-valen">SUB-MARCA 2 • MUJER</span>
            <h4 style="margin:8px 0 12px;">Valen Shop</h4>
            <div class="form-field">
              <label>Nombre Sub-marca</label>
              <input type="text" id="setValenName" value="${valen.name || 'Valen Shop'}" />
            </div>
            <div class="form-field">
              <label>Descripción Corta</label>
              <input type="text" id="setValenShort" value="${valen.shortDescription || 'Elegancia sutil, belleza natural'}" />
            </div>
            <div class="form-field">
              <label>Instagram (sin @)</label>
              <input type="text" id="setValenIg" value="${valen.instagram || 'valenshop.co'}" />
            </div>
            <div class="form-field">
              <label>Quiénes Somos (Valen Shop)</label>
              <textarea id="setValenAbout" rows="5">${valen.aboutUs || ''}</textarea>
            </div>
          </div>
        </div>

        <button type="submit" class="btn-checkout-main inline-icon-btn justify-center" style="max-width:420px;">
          <i data-lucide="save" class="icon-xs"></i>
          <span>GUARDAR TODA LA CONFIGURACIÓN OFICIAL</span>
        </button>
      </form>
    `;
  },

  async uploadQrImage(input) {
    if (!input.files || !input.files[0]) return;
    const formData = new FormData();
    formData.append('files', input.files[0]);
    try {
      const res = await fetch('/api/upload?base64=1', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.urls?.[0]) {
        document.getElementById('setQrUrlHidden').value = data.urls[0];
        app.showToast('QR cargado. Pulsa Guardar Configuración abajo.');
      }
    } catch (err) {
      app.showToast('Error subiendo QR');
    }
  },

  async saveStoreSettings(event) {
    event.preventDefault();
    const s = app.state.settings || {};
    const nequiNumber = document.getElementById('setNequiNumber')?.value.trim() || '3147923972';
    const holder = document.getElementById('setAccountHolder')?.value.trim() || 'Valentina Fuenmayor';
    const nequiKey = document.getElementById('setNequiKey')?.value.trim() || nequiNumber;
    const qrUrl = document.getElementById('setQrUrlHidden')?.value || '';

    const updatedSettings = {
      ...s,
      mainBrand: document.getElementById('setMainBrand')?.value.trim() || 'V&V STUDIO',
      mainTagline: document.getElementById('setMainTagline')?.value.trim() || 'VAROSTYLE • VALEN SHOP',
      topPromoBar: document.getElementById('setTopPromo')?.value || '',
      freeShippingThreshold: Number(document.getElementById('setFreeThreshold')?.value || 200000),
      adminPin: document.getElementById('setAdminPin')?.value.trim() || '1234',
      returnPolicy: document.getElementById('setReturnPolicy')?.value.trim() || '',
      stores: {
        varostyle: {
          ...(s.stores?.varostyle || {}),
          id: 'varostyle',
          name: document.getElementById('setVaroName')?.value.trim() || 'VaroStyle',
          shortDescription: document.getElementById('setVaroShort')?.value.trim() || '',
          instagram: document.getElementById('setVaroIg')?.value.trim() || 'varostyle.co',
          aboutUs: document.getElementById('setVaroAbout')?.value || '',
          whatsapp: nequiNumber,
          nequiNumber,
          accountHolder: holder,
          nequiKey,
          nequiQrUrl: qrUrl
        },
        valenshop: {
          ...(s.stores?.valenshop || {}),
          id: 'valenshop',
          name: document.getElementById('setValenName')?.value.trim() || 'Valen Shop',
          shortDescription: document.getElementById('setValenShort')?.value.trim() || '',
          instagram: document.getElementById('setValenIg')?.value.trim() || 'valenshop.co',
          aboutUs: document.getElementById('setValenAbout')?.value || '',
          whatsapp: nequiNumber,
          nequiNumber,
          accountHolder: holder,
          nequiKey,
          nequiQrUrl: qrUrl
        }
      }
    };

    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
      await app.loadBootstrapData();
      app.renderAll();
      await this.loadAllAdminData();
      this.renderAdminPortal();
      app.showToast('Configuración oficial guardada con éxito');
    } catch (err) {
      app.showToast('Error guardando configuración');
    }
  },

  async downloadFullBackup() {
    try {
      const res = await fetch('/api/backup');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-vvstudio-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      app.showToast('Copia de seguridad descargada (.json)');
    } catch (e) {
      app.showToast('Error generando copia de seguridad');
    }
  },

  async restoreFullBackup(input) {
    if (!input.files || !input.files[0]) return;
    if (!confirm('¿Restaurar toda la tienda desde este archivo .json? Reemplazará los datos actuales.')) {
      input.value = '';
      return;
    }
    try {
      const text = await input.files[0].text();
      const parsed = JSON.parse(text);
      const res = await fetch('/api/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed)
      });
      if (!res.ok) throw new Error();
      await app.loadBootstrapData();
      app.renderAll();
      await this.loadAllAdminData();
      this.renderAdminPortal();
      app.showToast('Base de datos restaurada con éxito');
    } catch (e) {
      app.showToast('Archivo de respaldo inválido o corrupto');
    }
  }
};
