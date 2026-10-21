// ============================================================================
// VAROSTYLE & VALEN SHOP — PANEL DE ADMINISTRACIÓN COMPLETO (admin.js)
// ============================================================================

const admin = {
  state: {
    activeTab: 'products', // 'products' | 'form-product' | 'orders' | 'settings' | 'banners'
    editingProductId: null,
    tempImages: [],
    tempColors: [],
    orders: []
  },

  async openAdminPortal(mode = 'products', productId = null) {
    document.getElementById('adminModalBackdrop')?.classList.remove('hidden');

    if (mode === 'new-product') {
      this.openProductForm(null);
    } else if (mode === 'edit-product' && productId) {
      this.openProductForm(productId);
    } else if (mode === 'settings') {
      this.switchTab('settings');
    } else {
      this.switchTab(mode);
    }
  },

  closeAdminPortal() {
    document.getElementById('adminModalBackdrop')?.classList.add('hidden');
  },

  async switchTab(tab) {
    this.state.activeTab = tab;
    if (tab === 'orders') {
      await this.fetchOrders();
    }
    this.renderAdminPortal();
  },

  async fetchOrders() {
    try {
      const res = await fetch('/api/orders');
      this.state.orders = await res.json();
    } catch (err) {
      this.state.orders = [];
    }
  },

  renderAdminPortal() {
    const body = document.getElementById('adminPortalBody');
    if (!body) return;

    const totalProducts = app.state.products.length;
    const varoCount = app.state.products.filter(p => p.brand === 'varostyle').length;
    const valenCount = app.state.products.filter(p => p.brand === 'valenshop').length;

    body.innerHTML = `
      <div class="admin-stats-grid">
        <div class="stat-card">
          <span>TOTAL PRENDAS</span>
          <strong>${totalProducts}</strong>
        </div>
        <div class="stat-card">
          <span>VAROSTYLE (HOMBRE)</span>
          <strong>${varoCount} prendas</strong>
        </div>
        <div class="stat-card">
          <span>VALEN SHOP (MUJER)</span>
          <strong>${valenCount} prendas</strong>
        </div>
        <div class="stat-card">
          <span>NEQUI OFICIAL</span>
          <strong style="font-size:1.15rem; color:var(--accent-nequi);">314 792 3972</strong>
          <small style="display:block; color:var(--text-muted);">Valentina Fuenmayor</small>
        </div>
      </div>

      <div class="admin-nav-tabs">
        <button class="admin-tab-btn inline-icon-btn ${this.state.activeTab === 'products' ? 'active' : ''}" onclick="admin.switchTab('products')">
          <i data-lucide="shirt" class="icon-xs"></i>
          <span>Catálogo de Productos (${totalProducts})</span>
        </button>
        <button class="admin-tab-btn inline-icon-btn ${this.state.activeTab === 'form-product' ? 'active' : ''}" onclick="admin.openProductForm(null)">
          <i data-lucide="plus-circle" class="icon-xs"></i>
          <span>Agregar Nuevo Producto</span>
        </button>
        <button class="admin-tab-btn inline-icon-btn ${this.state.activeTab === 'orders' ? 'active' : ''}" onclick="admin.switchTab('orders')">
          <i data-lucide="package" class="icon-xs"></i>
          <span>Pedidos de Clientes</span>
        </button>
        <button class="admin-tab-btn inline-icon-btn ${this.state.activeTab === 'settings' ? 'active' : ''}" onclick="admin.switchTab('settings')">
          <i data-lucide="store" class="icon-xs"></i>
          <span>Datos de Tiendas, Logos y QR Nequi</span>
        </button>
        <button class="admin-tab-btn inline-icon-btn ${this.state.activeTab === 'banners' ? 'active' : ''}" onclick="admin.switchTab('banners')">
          <i data-lucide="image" class="icon-xs"></i>
          <span>Banners de Inicio</span>
        </button>
      </div>

      <div id="adminTabSection"></div>
    `;

    if (this.state.activeTab === 'products') this.renderProductsTable();
    else if (this.state.activeTab === 'form-product') this.renderProductForm();
    else if (this.state.activeTab === 'orders') this.renderOrdersTable();
    else if (this.state.activeTab === 'settings') this.renderSettingsForm();
    else if (this.state.activeTab === 'banners') this.renderBannersForm();

    app.refreshIcons();
  },

  // ============================================================================
  // 1. TABLA DE PRODUCTOS (CREAR, EDITAR, DUPLICAR, ELIMINAR)
  // ============================================================================
  renderProductsTable() {
    const sec = document.getElementById('adminTabSection');
    if (!sec) return;

    sec.innerHTML = `
      <div class="admin-card">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
          <div>
            <h3>Inventario de Productos (VaroStyle & Valen Shop)</h3>
            <p style="font-size:0.84rem; color:var(--text-muted);">Edita precios, fotos, tallas, colores o agrega nuevas prendas en segundos.</p>
          </div>
          <button class="btn-primary-gold inline-icon-btn" onclick="admin.openProductForm(null)">
            <i data-lucide="plus" class="icon-xs"></i>
            <span>Crear Nuevo Producto</span>
          </button>
        </div>

        <div style="overflow-x:auto;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Foto</th>
                <th>Nombre de la Prenda</th>
                <th>Tienda / Universo</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Tallas & Colores</th>
                <th>Stock</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${app.state.products
                .map(
                  p => `
                <tr>
                  <td><img src="${p.images?.[0] || ''}" alt="${p.name}" /></td>
                  <td>
                    <strong>${p.name}</strong>
                    ${p.badge ? `<br/><span class="badge-pill badge-promo" style="font-size:0.6rem;">${p.badge}</span>` : ''}
                  </td>
                  <td>
                    <span class="badge-pill ${p.brand === 'valenshop' ? 'badge-brand-valen' : 'badge-brand-varo'}">
                      ${p.brand === 'valenshop' ? 'Valen Shop' : 'VaroStyle'}
                    </span>
                  </td>
                  <td>${p.category}</td>
                  <td>
                    <strong>${app.formatCOP(p.price)}</strong>
                    ${p.comparePrice > p.price ? `<br/><small style="text-decoration:line-through; color:var(--text-muted);">${app.formatCOP(p.comparePrice)}</small>` : ''}
                  </td>
                  <td>
                    <div style="font-size:0.78rem;"><strong>Tallas:</strong> ${(p.sizes || []).join(', ')}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);"><strong>Colores:</strong> ${(p.colors || []).map(c => c.name).join(', ')}</div>
                  </td>
                  <td>${p.stock} uds</td>
                  <td>
                    <div style="display:flex; gap:6px;">
                      <button class="btn-card-edit inline-icon-btn" onclick="admin.openProductForm(${p.id})">
                        <i data-lucide="pencil" class="icon-xs"></i>
                        <span>Editar</span>
                      </button>
                      <button class="btn-card-edit inline-icon-btn" style="color:#B91C1C;" onclick="admin.deleteProduct(${p.id})" title="Eliminar">
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
        </div>
      </div>
    `;
  },

  // ============================================================================
  // 2. FORMULARIO CREAR / EDITAR PRODUCTO CON SUBIDA DE FOTOS REALES
  // ============================================================================
  openProductForm(productId = null) {
    this.state.activeTab = 'form-product';
    this.state.editingProductId = productId;

    const existing = productId ? app.state.products.find(p => p.id === Number(productId)) : null;
    this.state.tempImages = existing ? [...(existing.images || [])] : [];
    this.state.tempColors = existing
      ? [...(existing.colors || [])]
      : [
          { name: 'Negro', hex: '#141416' },
          { name: 'Blanco', hex: '#F9F9F9' }
        ];

    this.renderAdminPortal();
  },

  renderProductForm() {
    const sec = document.getElementById('adminTabSection');
    if (!sec) return;

    const existing = this.state.editingProductId
      ? app.state.products.find(p => p.id === Number(this.state.editingProductId))
      : null;

    sec.innerHTML = `
      <div class="admin-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
          <h3>${existing ? `Editando: ${existing.name}` : 'Crear Nueva Prenda'}</h3>
          <button class="btn-outline-sm inline-icon-btn" onclick="admin.switchTab('products')">
            <i data-lucide="arrow-left" class="icon-xs"></i>
            <span>Volver al listado</span>
          </button>
        </div>

        <form onsubmit="admin.saveProductForm(event)">
          <div class="form-grid-2">
            <div class="form-field">
              <label>Nombre del Producto *</label>
              <input type="text" id="prodName" required value="${existing ? existing.name : ''}" placeholder="Ej: Camisa Lino Imperial / Vestido Gala" />
            </div>

            <div class="form-field">
              <label>Tienda / Universo *</label>
              <select id="prodBrand" required>
                <option value="varostyle" ${existing?.brand === 'varostyle' ? 'selected' : ''}>Tienda 1: VaroStyle (Moda Masculina)</option>
                <option value="valenshop" ${existing?.brand === 'valenshop' ? 'selected' : ''}>Tienda 2: Valen Shop (Moda Femenina)</option>
              </select>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-field">
              <label>Categoría *</label>
              <input
                type="text"
                id="prodCategory"
                list="categorySuggestions"
                required
                value="${existing ? existing.category : 'Camisetas'}"
                placeholder="Ej: Camisas, Vestidos, Jeans, Conjuntos..."
              />
              <datalist id="categorySuggestions">
                <option value="Camisetas"></option>
                <option value="Camisas"></option>
                <option value="Jeans y Pantalones"></option>
                <option value="Chaquetas y Buzos"></option>
                <option value="Conjuntos"></option>
                <option value="Vestidos y Enterizos"></option>
                <option value="Blusas y Tops"></option>
                <option value="Chaquetas y Blazers"></option>
                <option value="Faldas y Shorts"></option>
                <option value="Accesorios"></option>
              </datalist>
            </div>

            <div class="form-field">
              <label>Etiqueta Especial (Badge)</label>
              <select id="prodBadge">
                <option value="" ${!existing?.badge ? 'selected' : ''}>Sin etiqueta</option>
                <option value="NUEVO" ${existing?.badge === 'NUEVO' ? 'selected' : ''}>NUEVO</option>
                <option value="MÁS VENDIDO" ${existing?.badge === 'MÁS VENDIDO' ? 'selected' : ''}>MÁS VENDIDO</option>
                <option value="SALE" ${existing?.badge === 'SALE' ? 'selected' : ''}>SALE / OFERTA</option>
              </select>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-field">
              <label>Precio de Venta (COP) *</label>
              <input type="number" id="prodPrice" required min="1000" step="500" value="${existing ? existing.price : 95000}" />
            </div>
            <div class="form-field">
              <label>Precio Anterior / Sin Descuento (0 si no aplica)</label>
              <input type="number" id="prodComparePrice" min="0" step="500" value="${existing ? existing.comparePrice || 0 : 0}" />
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-field">
              <label>Tallas Disponibles (separadas por coma) *</label>
              <input
                type="text"
                id="prodSizes"
                required
                value="${existing ? (existing.sizes || []).join(', ') : 'S, M, L, XL'}"
                placeholder="Ej: XS, S, M, L, XL o 28, 30, 32, 34"
              />
            </div>
            <div class="form-field">
              <label>Cantidad en Stock *</label>
              <input type="number" id="prodStock" required min="0" value="${existing ? existing.stock : 15}" />
            </div>
          </div>

          <!-- GESTIÓN DE COLORES -->
          <div class="form-field">
            <label>Colores Disponibles</label>
            <div id="adminColorsContainer" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:8px;"></div>
            <div style="display:flex; gap:8px; align-items:center; max-width:440px;">
              <input type="text" id="newColorName" placeholder="Nombre color (ej: Beige Arena)" />
              <input type="color" id="newColorHex" value="#111115" style="width:52px; height:38px; padding:2px;" />
              <button type="button" class="btn-outline-sm" onclick="admin.addColorToProduct()">+ Añadir Color</button>
            </div>
          </div>

          <div class="form-field">
            <label>Descripción de la Prenda</label>
            <textarea id="prodDesc" rows="3" placeholder="Describe la tela, horma y estilo de la prenda...">${existing ? existing.description || '' : ''}</textarea>
          </div>

          <!-- FOTOS DEL PRODUCTO -->
          <div class="form-field">
            <label>Fotos del Producto (Sube desde tu celular/PC o pega un enlace)</label>
            <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:10px;" id="adminImagesPreview"></div>

            <div class="form-grid-2" style="background:#FAF9F6; padding:14px; border-radius:10px; border:1px dashed var(--border-color);">
              <div>
                <label style="font-size:0.76rem;">Opción A: Subir fotos desde tu galería / computador</label>
                <input type="file" accept="image/*" multiple onchange="admin.uploadProductPhotos(this)" />
              </div>
              <div>
                <label style="font-size:0.76rem;">Opción B: Pegar enlace URL de imagen</label>
                <div style="display:flex; gap:6px;">
                  <input type="url" id="newImageUrlInput" placeholder="https://..." />
                  <button type="button" class="btn-outline-sm" onclick="admin.addImageUrl()">Añadir</button>
                </div>
              </div>
            </div>
          </div>

          <div style="margin-top:20px; display:flex; gap:12px;">
            <button type="submit" class="btn-primary-gold inline-icon-btn" style="padding:14px 28px; font-size:0.95rem;">
              <i data-lucide="save" class="icon-xs"></i>
              <span>GUARDAR PRODUCTO EN LA TIENDA</span>
            </button>
            <button type="button" class="btn-outline-sm" onclick="admin.switchTab('products')">Cancelar</button>
          </div>
        </form>
      </div>
    `;

    this.renderTempColors();
    this.renderTempImages();
  },

  renderTempColors() {
    const container = document.getElementById('adminColorsContainer');
    if (!container) return;
    container.innerHTML = this.state.tempColors
      .map(
        (c, idx) => `
      <span style="display:inline-flex; align-items:center; gap:6px; padding:5px 10px; background:#F4F3EF; border-radius:99px; font-size:0.78rem; font-weight:700;">
        <span class="color-dot" style="background:${c.hex}"></span>
        ${c.name}
        <button type="button" style="border:none; background:transparent; font-weight:900;" onclick="admin.removeTempColor(${idx})">×</button>
      </span>
    `
      )
      .join('');
  },

  addColorToProduct() {
    const nameInput = document.getElementById('newColorName');
    const hexInput = document.getElementById('newColorHex');
    const name = nameInput?.value.trim();
    const hex = hexInput?.value || '#111115';
    if (!name) {
      app.showToast('Escribe el nombre del color');
      return;
    }
    this.state.tempColors.push({ name, hex });
    nameInput.value = '';
    this.renderTempColors();
  },

  removeTempColor(idx) {
    this.state.tempColors.splice(idx, 1);
    this.renderTempColors();
  },

  renderTempImages() {
    const container = document.getElementById('adminImagesPreview');
    if (!container) return;
    if (this.state.tempImages.length === 0) {
      container.innerHTML = `<span style="font-size:0.8rem; color:var(--text-muted);">Aún no has cargado fotos para esta prenda.</span>`;
      return;
    }
    container.innerHTML = this.state.tempImages
      .map(
        (url, idx) => `
      <div style="position:relative; width:86px; height:106px; border-radius:8px; overflow:hidden; border:1px solid var(--border-color);">
        <img src="${url}" alt="Foto" style="width:100%; height:100%; object-fit:cover;" />
        <button
          type="button"
          onclick="admin.removeTempImage(${idx})"
          style="position:absolute; top:3px; right:3px; background:rgba(0,0,0,0.75); color:#fff; border:none; width:22px; height:22px; border-radius:50%; font-size:0.75rem;"
        >×</button>
      </div>
    `
      )
      .join('');
  },

  async uploadProductPhotos(input) {
    if (!input.files || input.files.length === 0) return;
    const formData = new FormData();
    Array.from(input.files).forEach(f => formData.append('files', f));

    try {
      app.showToast('Subiendo fotos...');
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.urls) {
        this.state.tempImages.push(...data.urls);
        this.renderTempImages();
        app.showToast('Fotos subidas con éxito');
      }
    } catch (err) {
      app.showToast('Error subiendo fotos');
    }
  },

  addImageUrl() {
    const input = document.getElementById('newImageUrlInput');
    const url = input?.value.trim();
    if (!url) return;
    this.state.tempImages.push(url);
    input.value = '';
    this.renderTempImages();
  },

  removeTempImage(idx) {
    this.state.tempImages.splice(idx, 1);
    this.renderTempImages();
  },

  async saveProductForm(event) {
    event.preventDefault();

    const sizesRaw = document.getElementById('prodSizes')?.value || 'Única';
    const sizes = sizesRaw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const payload = {
      name: document.getElementById('prodName')?.value.trim(),
      brand: document.getElementById('prodBrand')?.value,
      category: document.getElementById('prodCategory')?.value.trim(),
      badge: document.getElementById('prodBadge')?.value,
      price: Number(document.getElementById('prodPrice')?.value || 0),
      comparePrice: Number(document.getElementById('prodComparePrice')?.value || 0),
      sizes: sizes.length ? sizes : ['Única'],
      colors: this.state.tempColors.length ? this.state.tempColors : [{ name: 'Único', hex: '#111115' }],
      stock: Number(document.getElementById('prodStock')?.value || 10),
      description: document.getElementById('prodDesc')?.value.trim(),
      images: this.state.tempImages.length
        ? this.state.tempImages
        : ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=85'],
      featured: true,
      active: true
    };

    try {
      const isEdit = Boolean(this.state.editingProductId);
      const url = isEdit ? `/api/products/${this.state.editingProductId}` : '/api/products';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Error guardando producto');

      await app.loadBootstrapData();
      app.renderAll();
      app.showToast(isEdit ? 'Producto actualizado correctamente' : 'Nuevo producto agregado al catálogo');
      this.switchTab('products');
    } catch (err) {
      app.showToast('Error al guardar el producto');
    }
  },

  async deleteProduct(productId) {
    if (!confirm('¿Estás seguro de eliminar esta prenda del catálogo?')) return;
    try {
      await fetch(`/api/products/${productId}`, { method: 'DELETE' });
      await app.loadBootstrapData();
      app.renderAll();
      this.renderAdminPortal();
      app.showToast('Producto eliminado');
    } catch (err) {
      app.showToast('No se pudo eliminar el producto');
    }
  },

  // ============================================================================
  // 3. GESTIÓN DE PEDIDOS (VER COMPROBANTE NEQUI, CAMBIAR ESTADO, WHATSAPP)
  // ============================================================================
  renderOrdersTable() {
    const sec = document.getElementById('adminTabSection');
    if (!sec) return;

    if (this.state.orders.length === 0) {
      sec.innerHTML = `
        <div class="admin-card" style="text-align:center; padding:40px;">
          <h3>Aún no hay pedidos registrados</h3>
          <p style="color:var(--text-muted); margin-top:6px;">Cuando un cliente compre en la tienda, el pedido aparecerá aquí con sus prendas y comprobante Nequi.</p>
        </div>
      `;
      return;
    }

    sec.innerHTML = `
      <div class="admin-card">
        <h3 style="margin-bottom:14px;">Pedidos Recibidos (${this.state.orders.length})</h3>
        <div style="overflow-x:auto;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Cliente & Contacto</th>
                <th>Destino</th>
                <th>Prendas</th>
                <th>Pago & Comprobante</th>
                <th>Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${this.state.orders
                .map(
                  o => `
                <tr>
                  <td><strong>${o.orderNumber}</strong><br/><small>${new Date(o.createdAt).toLocaleDateString('es-CO')}</small></td>
                  <td>
                    <strong>${o.customerName}</strong><br/>
                    <a href="https://wa.me/57${(o.customerPhone || '').replace(/\D/g, '')}" target="_blank" style="color:#0E6F37; font-weight:700;">
                      WhatsApp: ${o.customerPhone}
                    </a>
                  </td>
                  <td>${o.city}, ${o.department || ''}<br/><small>${o.address}</small></td>
                  <td>
                    ${(o.items || [])
                      .map(i => `<div style="font-size:0.76rem;">• ${i.name} (Talla ${i.size}, ${i.color}) x${i.quantity}</div>`)
                      .join('')}
                  </td>
                  <td>
                    <strong>${o.paymentMethod.toUpperCase()}</strong>
                    ${o.paymentReference ? `<br/><small>Ref: ${o.paymentReference}</small>` : ''}
                    ${o.paymentReceipt ? `<br/><a href="${o.paymentReceipt}" target="_blank" style="color:var(--accent-nequi); font-weight:700;">Ver Comprobante</a>` : ''}
                  </td>
                  <td><strong>${app.formatCOP(o.total)}</strong></td>
                  <td>
                    <select onchange="admin.updateOrderStatus(${o.id}, this.value)" style="padding:6px; border-radius:6px;">
                      ${['Pendiente', 'Pagado', 'Enviado', 'Entregado', 'Cancelado']
                        .map(st => `<option value="${st}" ${o.status === st ? 'selected' : ''}>${st}</option>`)
                        .join('')}
                    </select>
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

  async updateOrderStatus(orderId, status) {
    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      app.showToast(`Estado del pedido actualizado a: ${status}`);
      await this.fetchOrders();
      this.renderOrdersTable();
    } catch (err) {
      app.showToast('Error actualizando pedido');
    }
  },

  // ============================================================================
  // 4. CONFIGURACIÓN DE LAS DOS TIENDAS, LOGOS Y QR DE NEQUI
  // ============================================================================
  renderSettingsForm() {
    const sec = document.getElementById('adminTabSection');
    if (!sec) return;

    const s = app.state.settings || {};
    const varo = s.stores?.varostyle || {};
    const valen = s.stores?.valenshop || {};

    sec.innerHTML = `
      <form onsubmit="admin.saveSettingsForm(event)">
        <div class="admin-card">
          <span class="badge-pill badge-promo">MARCA OFICIAL PRINCIPAL (PARAGUAS)</span>
          <h3 style="margin:8px 0 12px;">Identidad General de la Casa de Moda</h3>
          <div class="form-grid-2">
            <div class="form-field">
              <label>Nombre Oficial Principal (Marca Paraguas)</label>
              <input type="text" id="setMainBrand" value="${s.mainBrand || 'V&V STUDIO'}" placeholder="Ej: V&V STUDIO" />
            </div>
            <div class="form-field">
              <label>Subtítulo / Sub-marcas bajo el nombre oficial</label>
              <input type="text" id="setMainTagline" value="${s.mainTagline || 'VAROSTYLE • VALEN SHOP'}" placeholder="Ej: VAROSTYLE • VALEN SHOP" />
            </div>
          </div>
          <div class="form-field">
            <label>Logo Oficial Principal (Opcional - se muestra en la vista general)</label>
            <input type="file" accept="image/*" onchange="admin.uploadAssetFile(this, 'setMainLogoUrl')" />
            <input type="text" id="setMainLogoUrl" value="${s.mainLogoUrl || ''}" placeholder="URL del logo principal de V&V Studio" style="margin-top:6px;" />
          </div>
          <div class="form-field">
            <label>Texto Barra Promocional Superior</label>
            <input type="text" id="setTopPromo" value="${s.topPromoBar || ''}" />
          </div>
          <div class="form-grid-2">
            <div class="form-field">
              <label>Envío Gratis a partir de (COP)</label>
              <input type="number" id="setFreeShip" value="${s.freeShippingThreshold || 200000}" />
            </div>
            <div class="form-field">
              <label>Costo de Envío Estándar (COP)</label>
              <input type="number" id="setShipCost" value="${s.defaultShippingCost || 12000}" />
            </div>
          </div>
        </div>

        <div class="form-grid-2">
          <!-- SUB-MARCA 1: VAROSTYLE -->
          <div class="admin-card">
            <span class="badge-pill badge-brand-varo">SUB-MARCA 1 (LÍNEA HOMBRE)</span>
            <h3 style="margin:8px 0 14px;">Datos de Sub-marca: VaroStyle</h3>

            <div class="form-field">
              <label>Nombre de la Sub-marca 1</label>
              <input type="text" id="varoName" value="${varo.name || 'VaroStyle'}" />
            </div>
            <div class="form-field">
              <label>Descripción Corta (1 párrafo)</label>
              <input type="text" id="varoShort" value="${varo.shortDescription || 'Ropa masculina con estilo'}" />
            </div>
            <div class="form-field">
              <label>Quiénes Somos (VaroStyle)</label>
              <textarea id="varoAbout" rows="5">${varo.aboutUs || ''}</textarea>
            </div>
            <div class="form-grid-2">
              <div class="form-field">
                <label>WhatsApp / Teléfono</label>
                <input type="text" id="varoWa" value="${varo.whatsapp || '3147923972'}" />
              </div>
              <div class="form-field">
                <label>Instagram</label>
                <input type="text" id="varoIg" value="${varo.instagram || 'varostyle.co'}" />
              </div>
            </div>
            <div class="form-grid-2">
              <div class="form-field">
                <label>Número de Nequi</label>
                <input type="text" id="varoNequi" value="${varo.nequiNumber || '3147923972'}" />
              </div>
              <div class="form-field">
                <label>Titular de la Cuenta</label>
                <input type="text" id="varoHolder" value="${varo.accountHolder || 'Valentina Fuenmayor'}" />
              </div>
            </div>
            <div class="form-field">
              <label>Llave Nequi</label>
              <input type="text" id="varoKey" value="${varo.nequiKey || '3147923972'}" />
            </div>
            <div class="form-field">
              <label>Subir Logo de VaroStyle</label>
              <input type="file" accept="image/*" onchange="admin.uploadAssetFile(this, 'varoLogoUrl')" />
              <input type="text" id="varoLogoUrl" value="${varo.logoUrl || ''}" placeholder="URL del logo" style="margin-top:6px;" />
            </div>
            <div class="form-field">
              <label>Subir Imagen del Código QR de Nequi</label>
              <input type="file" accept="image/*" onchange="admin.uploadAssetFile(this, 'varoQrUrl')" />
              <input type="text" id="varoQrUrl" value="${varo.nequiQrUrl || ''}" placeholder="URL del QR de Nequi" style="margin-top:6px;" />
            </div>
          </div>

          <!-- SUB-MARCA 2: VALEN SHOP -->
          <div class="admin-card">
            <span class="badge-pill badge-brand-valen">SUB-MARCA 2 (LÍNEA MUJER)</span>
            <h3 style="margin:8px 0 14px;">Datos de Sub-marca: Valen Shop</h3>

            <div class="form-field">
              <label>Nombre de la Sub-marca 2</label>
              <input type="text" id="valenName" value="${valen.name || 'Valen Shop'}" />
            </div>
            <div class="form-field">
              <label>Descripción Corta (1 párrafo)</label>
              <input type="text" id="valenShort" value="${valen.shortDescription || 'Elegancia sutil, belleza natural'}" />
            </div>
            <div class="form-field">
              <label>Quiénes Somos (Valen Shop)</label>
              <textarea id="valenAbout" rows="5">${valen.aboutUs || ''}</textarea>
            </div>
            <div class="form-grid-2">
              <div class="form-field">
                <label>WhatsApp / Teléfono</label>
                <input type="text" id="valenWa" value="${valen.whatsapp || '3147923972'}" />
              </div>
              <div class="form-field">
                <label>Instagram</label>
                <input type="text" id="valenIg" value="${valen.instagram || 'valenshop.co'}" />
              </div>
            </div>
            <div class="form-grid-2">
              <div class="form-field">
                <label>Número de Nequi</label>
                <input type="text" id="valenNequi" value="${valen.nequiNumber || '3147923972'}" />
              </div>
              <div class="form-field">
                <label>Titular de la Cuenta</label>
                <input type="text" id="valenHolder" value="${valen.accountHolder || 'Valentina Fuenmayor'}" />
              </div>
            </div>
            <div class="form-field">
              <label>Llave Nequi</label>
              <input type="text" id="valenKey" value="${valen.nequiKey || '3147923972'}" />
            </div>
            <div class="form-field">
              <label>Subir Logo de Valen Shop</label>
              <input type="file" accept="image/*" onchange="admin.uploadAssetFile(this, 'valenLogoUrl')" />
              <input type="text" id="valenLogoUrl" value="${valen.logoUrl || ''}" placeholder="URL del logo" style="margin-top:6px;" />
            </div>
            <div class="form-field">
              <label>Subir Imagen del Código QR de Nequi</label>
              <input type="file" accept="image/*" onchange="admin.uploadAssetFile(this, 'valenQrUrl')" />
              <input type="text" id="valenQrUrl" value="${valen.nequiQrUrl || ''}" placeholder="URL del QR de Nequi" style="margin-top:6px;" />
            </div>
          </div>
        </div>

        <button type="submit" class="btn-primary-gold inline-icon-btn" style="padding:14px 30px; font-size:0.95rem;">
          <i data-lucide="save" class="icon-xs"></i>
          <span>GUARDAR CONFIGURACIÓN DE MARCA OFICIAL Y SUB-MARCAS</span>
        </button>
      </form>
    `;
  },

  async uploadAssetFile(input, targetInputId) {
    if (!input.files || !input.files[0]) return;
    const formData = new FormData();
    formData.append('files', input.files[0]);

    try {
      app.showToast('Subiendo imagen...');
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.urls && data.urls[0]) {
        const target = document.getElementById(targetInputId);
        if (target) target.value = data.urls[0];
        app.showToast('Imagen cargada, recuerda pulsar Guardar Configuración');
      }
    } catch (err) {
      app.showToast('Error subiendo imagen');
    }
  },

  async saveSettingsForm(event) {
    event.preventDefault();
    const updatedSettings = {
      ...app.state.settings,
      mainBrand: document.getElementById('setMainBrand')?.value.trim() || 'V&V STUDIO',
      mainTagline: document.getElementById('setMainTagline')?.value.trim() || 'VAROSTYLE • VALEN SHOP',
      mainLogoUrl: document.getElementById('setMainLogoUrl')?.value.trim() || '',
      topPromoBar: document.getElementById('setTopPromo')?.value,
      freeShippingThreshold: Number(document.getElementById('setFreeShip')?.value || 200000),
      defaultShippingCost: Number(document.getElementById('setShipCost')?.value || 12000),
      stores: {
        varostyle: {
          id: 'varostyle',
          name: document.getElementById('varoName')?.value,
          genderLabel: 'HOMBRE',
          shortDescription: document.getElementById('varoShort')?.value,
          aboutUs: document.getElementById('varoAbout')?.value,
          whatsapp: document.getElementById('varoWa')?.value,
          instagram: document.getElementById('varoIg')?.value,
          nequiNumber: document.getElementById('varoNequi')?.value,
          accountHolder: document.getElementById('varoHolder')?.value,
          nequiKey: document.getElementById('varoKey')?.value,
          logoUrl: document.getElementById('varoLogoUrl')?.value,
          nequiQrUrl: document.getElementById('varoQrUrl')?.value
        },
        valenshop: {
          id: 'valenshop',
          name: document.getElementById('valenName')?.value,
          genderLabel: 'MUJER',
          shortDescription: document.getElementById('valenShort')?.value,
          aboutUs: document.getElementById('valenAbout')?.value,
          whatsapp: document.getElementById('valenWa')?.value,
          instagram: document.getElementById('valenIg')?.value,
          nequiNumber: document.getElementById('valenNequi')?.value,
          accountHolder: document.getElementById('valenHolder')?.value,
          nequiKey: document.getElementById('valenKey')?.value,
          logoUrl: document.getElementById('valenLogoUrl')?.value,
          nequiQrUrl: document.getElementById('valenQrUrl')?.value
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
      app.showToast('Datos de V&V Studio y sub-marcas actualizados');
    } catch (err) {
      app.showToast('Error guardando configuración');
    }
  },

  // ============================================================================
  // 5. GESTIÓN DE BANNERS DEL CARRUSEL PRINCIPAL
  // ============================================================================
  renderBannersForm() {
    const sec = document.getElementById('adminTabSection');
    if (!sec) return;

    sec.innerHTML = app.state.banners
      .map(
        b => `
      <div class="admin-card">
        <h4>Banner #${b.id} (${b.brand.toUpperCase()})</h4>
        <div class="form-grid-2" style="margin-top:10px;">
          <div class="form-field">
            <label>Subtítulo superior</label>
            <input type="text" id="banSub_${b.id}" value="${b.subtitle || ''}" />
          </div>
          <div class="form-field">
            <label>Título Principal</label>
            <input type="text" id="banTitle_${b.id}" value="${b.title || ''}" />
          </div>
        </div>
        <div class="form-field">
          <label>Descripción</label>
          <input type="text" id="banDesc_${b.id}" value="${b.description || ''}" />
        </div>
        <div class="form-grid-2">
          <div class="form-field">
            <label>Imagen del Banner (URL o subir archivo)</label>
            <input type="text" id="banImg_${b.id}" value="${b.image || ''}" />
            <input type="file" accept="image/*" style="margin-top:4px;" onchange="admin.uploadAssetFile(this, 'banImg_${b.id}')" />
          </div>
          <div class="form-field">
            <label>Texto del Botón</label>
            <input type="text" id="banCta_${b.id}" value="${b.ctaText || 'VER COLECCIÓN'}" />
          </div>
        </div>
        <button class="btn-primary-gold inline-icon-btn" onclick="admin.saveBanner(${b.id}, '${b.brand}', '${b.ctaFilter}')">
          <i data-lucide="save" class="icon-xs"></i>
          <span>Guardar Cambios en Banner #${b.id}</span>
        </button>
      </div>
    `
      )
      .join('');
  },

  async saveBanner(id, brand, ctaFilter) {
    const payload = {
      brand,
      ctaFilter,
      subtitle: document.getElementById(`banSub_${id}`)?.value,
      title: document.getElementById(`banTitle_${id}`)?.value,
      description: document.getElementById(`banDesc_${id}`)?.value,
      image: document.getElementById(`banImg_${id}`)?.value,
      ctaText: document.getElementById(`banCta_${id}`)?.value
    };

    try {
      await fetch(`/api/banners/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      await app.loadBootstrapData();
      app.renderHeroSlider();
      app.showToast('Banner actualizado');
    } catch (err) {
      app.showToast('Error actualizando banner');
    }
  }
};
