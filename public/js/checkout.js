// ============================================================================
// VAROSTYLE & VALEN SHOP — CHECKOUT MULTICANAL CON CUPONES Y ZONAS DE ENVÍO
// ============================================================================

const checkout = {
  state: {
    paymentMethod: 'nequi', // 'nequi' | 'pse_card' | 'contraentrega' | 'whatsapp'
    uploadedReceiptUrl: '',
    selectedZoneId: 0,
    appliedCoupon: null, // { code, discountAmount, freeShipping, coupon }
    couponMessage: '',
    couponError: false
  },

  openCheckoutModal() {
    if (!app.state.cart || app.state.cart.length === 0) {
      app.showToast('Tu bolsa de compras está vacía');
      return;
    }
    app.toggleCartDrawer(false);
    this.state.uploadedReceiptUrl = '';
    this.state.appliedCoupon = null;
    this.state.couponMessage = '';
    this.state.couponError = false;
    const zones = app.state.shippingZones || [];
    this.state.selectedZoneId = zones.length > 0 ? zones[0].id : 0;
    this.renderCheckoutModal();
    document.getElementById('checkoutModalBackdrop')?.classList.remove('hidden');
  },

  closeCheckoutModal() {
    document.getElementById('checkoutModalBackdrop')?.classList.add('hidden');
  },

  getCalculatedTotals() {
    const subtotal = app.state.cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const zones = app.state.shippingZones || [];
    const activeZone = zones.find(z => Number(z.id) === Number(this.state.selectedZoneId)) || zones[0];

    const threshold = activeZone
      ? Number(activeZone.freeThreshold || app.state.settings?.freeShippingThreshold || 200000)
      : Number(app.state.settings?.freeShippingThreshold || 200000);

    const baseShipping = activeZone
      ? Number(activeZone.price ?? 12000)
      : Number(app.state.settings?.defaultShippingCost || 12000);

    let discount = 0;
    let couponFreeShip = false;
    if (this.state.appliedCoupon) {
      discount = Number(this.state.appliedCoupon.discountAmount || 0);
      couponFreeShip = Boolean(this.state.appliedCoupon.freeShipping);
    }

    const afterDiscount = Math.max(0, subtotal - discount);
    const shipping = subtotal === 0 || afterDiscount >= threshold || couponFreeShip ? 0 : baseShipping;
    const total = Math.max(0, afterDiscount + shipping);

    return {
      subtotal,
      discount,
      shipping,
      total,
      threshold,
      activeZone
    };
  },

  handleZoneChange(zoneId) {
    this.state.selectedZoneId = Number(zoneId);
    this.updateSummaryTotalsUI();
    this.renderPaymentMethodDetails();
  },

  async applyCouponCode() {
    const input = document.getElementById('chkCouponInput');
    const code = (input?.value || '').trim().toUpperCase();
    if (!code) {
      this.state.couponError = true;
      this.state.couponMessage = 'Escribe un código de descuento primero';
      this.updateSummaryTotalsUI();
      return;
    }

    const subtotal = app.state.cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal, items: app.state.cart })
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        this.state.appliedCoupon = null;
        this.state.couponError = true;
        this.state.couponMessage = data.error || 'Cupón no válido';
      } else {
        this.state.appliedCoupon = {
          code: data.coupon.code,
          discountAmount: data.discountAmount,
          freeShipping: data.freeShipping,
          coupon: data.coupon
        };
        this.state.couponError = false;
        this.state.couponMessage = data.freeShipping
          ? `Cupón ${data.coupon.code} aplicado: Envío Gratis activado`
          : `Cupón ${data.coupon.code} aplicado (-${app.formatCOP(data.discountAmount)})`;
      }
    } catch (err) {
      this.state.couponError = true;
      this.state.couponMessage = 'Error validando el cupón';
    }

    this.updateSummaryTotalsUI();
    this.renderPaymentMethodDetails();
  },

  removeCoupon() {
    this.state.appliedCoupon = null;
    this.state.couponMessage = '';
    this.state.couponError = false;
    const input = document.getElementById('chkCouponInput');
    if (input) input.value = '';
    this.updateSummaryTotalsUI();
    this.renderPaymentMethodDetails();
  },

  updateSummaryTotalsUI() {
    const { subtotal, discount, shipping, total } = this.getCalculatedTotals();
    const subEl = document.getElementById('chkSummarySubtotal');
    const discRow = document.getElementById('chkSummaryDiscountRow');
    const discVal = document.getElementById('chkSummaryDiscount');
    const shipEl = document.getElementById('chkSummaryShipping');
    const totEl = document.getElementById('chkSummaryTotal');
    const msgEl = document.getElementById('chkCouponFeedback');

    if (subEl) subEl.textContent = app.formatCOP(subtotal);
    if (discRow && discVal) {
      discRow.style.display = discount > 0 ? 'flex' : 'none';
      discVal.textContent = `-${app.formatCOP(discount)}`;
    }
    if (shipEl) shipEl.textContent = shipping === 0 ? 'GRATIS' : app.formatCOP(shipping);
    if (totEl) totEl.textContent = app.formatCOP(total);

    if (msgEl) {
      if (!this.state.couponMessage) {
        msgEl.innerHTML = '';
      } else {
        msgEl.innerHTML = `
          <div style="margin-top:6px; font-size:0.78rem; font-weight:700; color:${this.state.couponError ? '#DC2626' : '#0E6F37'}; display:flex; align-items:center; justify-content:space-between;">
            <span>${this.state.couponMessage}</span>
            ${this.state.appliedCoupon ? `<button type="button" onclick="checkout.removeCoupon()" style="border:none; background:none; color:#DC2626; text-decoration:underline; font-size:0.74rem; cursor:pointer;">Quitar</button>` : ''}
          </div>
        `;
      }
    }
  },

  setPaymentMethod(method) {
    this.state.paymentMethod = method;
    document.querySelectorAll('.pay-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-pay-method') === method);
    });
    this.renderPaymentMethodDetails();
  },

  renderCheckoutModal() {
    const { subtotal, discount, shipping, total } = this.getCalculatedTotals();
    const zones = app.state.shippingZones || [];
    const container = document.getElementById('checkoutModalContent');
    if (!container) return;

    container.innerHTML = `
      <form id="checkoutForm" class="checkout-grid" onsubmit="checkout.submitOrder(event)">
        <!-- Columna Izquierda: Datos de Envío y Pago -->
        <div>
          <h4 style="margin-bottom:12px; font-family:var(--font-heading);">1. Datos de Entrega en Colombia</h4>
          <div class="form-grid-2">
            <div class="form-field">
              <label>Nombre Completo *</label>
              <input type="text" id="chkName" required placeholder="Ej: Juan Sebastián Pérez" />
            </div>
            <div class="form-field">
              <label>Cédula / NIT *</label>
              <input type="text" id="chkDoc" required placeholder="Ej: 1020304050" />
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-field">
              <label>WhatsApp / Celular *</label>
              <input type="tel" id="chkPhone" required placeholder="Ej: 314 792 3972" />
            </div>
            <div class="form-field">
              <label>Correo Electrónico (Opcional)</label>
              <input type="email" id="chkEmail" placeholder="tu@correo.com" />
            </div>
          </div>

          ${
            zones.length > 0
              ? `
            <div class="form-field">
              <label>Zona de Envío / Cobertura *</label>
              <select id="chkZoneSelect" onchange="checkout.handleZoneChange(this.value)">
                ${zones
                  .map(
                    z => `
                  <option value="${z.id}" ${Number(z.id) === Number(this.state.selectedZoneId) ? 'selected' : ''}>
                    ${z.name} — ${app.formatCOP(z.price)} (${z.estimatedDays || '2-4 días'})
                  </option>
                `
                  )
                  .join('')}
              </select>
            </div>
          `
              : ''
          }

          <div class="form-grid-2">
            <div class="form-field">
              <label>Departamento *</label>
              <input type="text" id="chkDept" required placeholder="Ej: Antioquia / Cundinamarca / Atlántico" />
            </div>
            <div class="form-field">
              <label>Ciudad / Municipio *</label>
              <input type="text" id="chkCity" required placeholder="Ej: Medellín / Bogotá / Barranquilla" />
            </div>
          </div>

          <div class="form-field">
            <label>Dirección Exacta (Barrio, Conjunto, Apto) *</label>
            <input type="text" id="chkAddress" required placeholder="Ej: Calle 45 # 12-34 Apto 502, Barrio El Poblado" />
          </div>

          <div class="form-field">
            <label>Notas adicionales del pedido (Opcional)</label>
            <input type="text" id="chkNotes" placeholder="Indicaciones para la transportadora o regalo" />
          </div>

          <h4 style="margin:18px 0 8px; font-family:var(--font-heading);">2. Elige tu Método de Pago</h4>
          <div class="payment-methods-tabs" style="grid-template-columns: repeat(2, 1fr);">
            <button
              type="button"
              class="pay-tab-btn ${this.state.paymentMethod === 'nequi' ? 'active' : ''}"
              data-pay-method="nequi"
              onclick="checkout.setPaymentMethod('nequi')"
            >
              <div class="pay-tab-icon"><i data-lucide="qr-code" class="icon-sm"></i></div>
              <span>Nequi / Llave</span><br/><small>QR + Comprobante</small>
            </button>
            <button
              type="button"
              class="pay-tab-btn ${this.state.paymentMethod === 'pse_card' ? 'active' : ''}"
              data-pay-method="pse_card"
              onclick="checkout.setPaymentMethod('pse_card')"
            >
              <div class="pay-tab-icon"><i data-lucide="credit-card" class="icon-sm"></i></div>
              <span>Tarjeta / PSE</span><br/><small>Pago en Línea</small>
            </button>
            <button
              type="button"
              class="pay-tab-btn ${this.state.paymentMethod === 'contraentrega' ? 'active' : ''}"
              data-pay-method="contraentrega"
              onclick="checkout.setPaymentMethod('contraentrega')"
            >
              <div class="pay-tab-icon"><i data-lucide="truck" class="icon-sm"></i></div>
              <span>Contraentrega</span><br/><small>Pagas al recibir</small>
            </button>
            <button
              type="button"
              class="pay-tab-btn ${this.state.paymentMethod === 'whatsapp' ? 'active' : ''}"
              data-pay-method="whatsapp"
              onclick="checkout.setPaymentMethod('whatsapp')"
            >
              <div class="pay-tab-icon"><i data-lucide="message-circle" class="icon-sm"></i></div>
              <span>Por WhatsApp</span><br/><small>Acordar con Asesor</small>
            </button>
          </div>

          <div id="paymentMethodDynamicBox"></div>
        </div>

        <!-- Columna Derecha: Resumen de Prendas + Cupón -->
        <div>
          <div style="background:#FAF9F6; padding:20px; border-radius:14px; border:1px solid var(--border-color);">
            <h4 style="margin-bottom:14px; font-family:var(--font-heading);">Resumen de tu Pedido</h4>
            <div style="max-height:240px; overflow-y:auto; margin-bottom:14px;">
              ${app.state.cart
                .map(
                  i => `
                <div style="display:flex; gap:10px; padding:8px 0; border-bottom:1px solid var(--border-color); font-size:0.82rem;">
                  <img src="${i.image}" alt="${i.name}" style="width:46px; height:58px; object-fit:cover; border-radius:6px;" />
                  <div style="flex:1;">
                    <strong>${i.name}</strong>
                    <div style="color:var(--text-muted); font-size:0.75rem;">
                      ${i.brand === 'valenshop' ? 'Valen Shop' : 'VaroStyle'} | Talla: ${i.size} | ${i.color} (x${i.quantity})
                    </div>
                  </div>
                  <strong>${app.formatCOP(i.price * i.quantity)}</strong>
                </div>
              `
                )
                .join('')}
            </div>

            <!-- Cupón de Descuento -->
            <div style="margin-bottom:14px; padding-bottom:14px; border-bottom:1px solid var(--border-color);">
              <label style="display:block; font-size:0.75rem; font-weight:800; margin-bottom:6px; text-transform:uppercase;">Código Promocional / Cupón</label>
              <div style="display:flex; gap:8px;">
                <input
                  type="text"
                  id="chkCouponInput"
                  placeholder="Ej: BIENVENIDA10"
                  style="flex:1; padding:8px 12px; border:1px solid var(--border-color); border-radius:8px; font-size:0.84rem; text-transform:uppercase;"
                />
                <button
                  type="button"
                  class="btn-outline-sm"
                  onclick="checkout.applyCouponCode()"
                  style="border-radius:8px; font-weight:800;"
                >
                  Aplicar
                </button>
              </div>
              <div id="chkCouponFeedback"></div>
            </div>

            <div class="cart-summary-row">
              <span>Subtotal prendas</span>
              <strong id="chkSummarySubtotal">${app.formatCOP(subtotal)}</strong>
            </div>
            <div class="cart-summary-row" id="chkSummaryDiscountRow" style="display:${discount > 0 ? 'flex' : 'none'}; color:#0E6F37;">
              <span>Descuento cupón</span>
              <strong id="chkSummaryDiscount">-${app.formatCOP(discount)}</strong>
            </div>
            <div class="cart-summary-row">
              <span>Envío nacional</span>
              <strong id="chkSummaryShipping">${shipping === 0 ? 'GRATIS' : app.formatCOP(shipping)}</strong>
            </div>
            <div class="cart-summary-row total">
              <span>Total a Pagar</span>
              <strong id="chkSummaryTotal" style="font-size:1.3rem;">${app.formatCOP(total)}</strong>
            </div>

            <button type="submit" class="btn-checkout-main inline-icon-btn justify-center" style="margin-top:10px;">
              <i data-lucide="check-circle-2" class="icon-xs"></i>
              <span>CONFIRMAR Y REGISTRAR PEDIDO</span>
            </button>
          </div>
        </div>
      </form>
    `;

    this.renderPaymentMethodDetails();
    app.refreshIcons();
  },

  renderPaymentMethodDetails() {
    const box = document.getElementById('paymentMethodDynamicBox');
    if (!box) return;

    const varo = app.state.settings?.stores?.varostyle || {};
    const nequiNumber = varo.nequiNumber || '3147923972';
    const holder = varo.accountHolder || 'Valentina Fuenmayor';
    const key = varo.nequiKey || nequiNumber;
    const { total } = this.getCalculatedTotals();

    if (this.state.paymentMethod === 'nequi') {
      box.innerHTML = `
        <div class="nequi-payment-card">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <span class="nequi-pill">PAGO CON NEQUI / LLAVE</span>
            <button type="button" class="btn-outline-sm inline-icon-btn" onclick="app.copyText('${nequiNumber}', 'Número Nequi copiado: ${nequiNumber}')">
              <i data-lucide="copy" class="icon-xs"></i>
              <span>Copiar Número: ${nequiNumber}</span>
            </button>
          </div>
          <p style="font-size:0.86rem; margin:6px 0;">
            Transfiere <strong>${app.formatCOP(total)}</strong> a nuestra cuenta oficial de Nequi:
          </p>
          <div style="background:#fff; padding:12px; border-radius:8px; border:1px solid var(--border-color); font-size:0.85rem;">
            <div><strong>Número de Nequi:</strong> <span style="font-size:1.05rem; font-weight:800; color:var(--accent-nequi);">${nequiNumber}</span></div>
            <div><strong>Titular de la cuenta:</strong> ${holder}</div>
            <div><strong>Llave Bre-B / Nequi:</strong> ${key}</div>
          </div>

          <div class="nequi-qr-display">${app.getQrHtml()}</div>

          <div class="form-field">
            <label>Número de Referencia Nequi (Opcional)</label>
            <input type="text" id="chkPaymentRef" placeholder="Ej: M12345678" />
          </div>

          <div class="form-field" style="margin-bottom:0;">
            <label>Subir captura del comprobante Nequi (Opcional, también puedes enviarlo por WhatsApp)</label>
            <input type="file" accept="image/*" onchange="checkout.handleReceiptUpload(this)" />
            <div id="receiptUploadStatus" style="font-size:0.78rem; color:#0E6F37; margin-top:4px;"></div>
          </div>
        </div>
      `;
    } else if (this.state.paymentMethod === 'pse_card') {
      box.innerHTML = `
        <div style="background:#F8FAFC; border:1px solid var(--border-color); padding:16px; border-radius:12px;">
          <div class="inline-icon-text" style="font-weight:800; font-size:0.88rem; margin-bottom:10px;">
            <i data-lucide="shield-check" class="icon-sm"></i>
            <span>Pasarela Segura PSE / Tarjeta de Crédito o Débito</span>
          </div>
          <div class="form-field">
            <label>Medio en Pasarela</label>
            <select id="chkGatewayType">
              <option value="PSE - Débito Bancario (Bancolombia, Davivienda, Nequi, Nu, BBVA...)">PSE - Transferencia Bancaria Inmediata</option>
              <option value="Tarjeta de Crédito / Débito (Visa, Mastercard, Amex)">Tarjeta de Crédito / Débito (Visa / Mastercard)</option>
            </select>
          </div>
          <div class="form-field" style="margin-bottom:0;">
            <label>Banco o Franquicia *</label>
            <select id="chkPaymentRef" required>
              <option value="Bancolombia">Bancolombia</option>
              <option value="Nequi PSE">Nequi por PSE</option>
              <option value="Davivienda / DaviPlata">Davivienda / DaviPlata</option>
              <option value="Nu Colombia">Nu Colombia</option>
              <option value="Banco de Bogotá">Banco de Bogotá</option>
              <option value="BBVA Colombia">BBVA Colombia</option>
              <option value="Tarjeta Visa / Mastercard">Tarjeta Visa / Mastercard</option>
            </select>
          </div>
        </div>
      `;
    } else if (this.state.paymentMethod === 'contraentrega') {
      box.innerHTML = `
        <div style="background:#FFFBEB; border:1px solid #FDE68A; padding:16px; border-radius:12px; font-size:0.86rem;">
          <strong class="inline-icon-text" style="color:#92400E;"><i data-lucide="truck" class="icon-sm"></i> Pago Contraentrega en Efectivo</strong>
          <p style="margin-top:6px; color:#78350F;">
            Pagas el valor total de <strong>${app.formatCOP(total)}</strong> al momento de recibir el paquete en tu dirección. Confirmaremos tu despacho vía WhatsApp antes de enviarlo.
          </p>
        </div>
      `;
    } else {
      box.innerHTML = `
        <div style="background:#EBF9F1; border:1px solid #A7F3D0; padding:16px; border-radius:12px; font-size:0.86rem;">
          <strong class="inline-icon-text"><i data-lucide="message-circle" class="icon-sm"></i> Finalizar directamente por WhatsApp (314 792 3972)</strong>
          <p style="margin-top:6px;">
            Al confirmar, registraremos tu pedido con un número de orden y se abrirá automáticamente nuestro WhatsApp oficial con el resumen completo de tus prendas, tallas, colores y dirección para coordinar el pago y el envío.
          </p>
        </div>
      `;
    }

    app.refreshIcons();
  },

  async handleReceiptUpload(input) {
    if (!input.files || !input.files[0]) return;
    const statusEl = document.getElementById('receiptUploadStatus');
    if (statusEl) statusEl.textContent = 'Subiendo comprobante...';

    const formData = new FormData();
    formData.append('files', input.files[0]);

    try {
      const res = await fetch('/api/upload?base64=1', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.urls && data.urls[0]) {
        this.state.uploadedReceiptUrl = data.urls[0];
        if (statusEl) statusEl.textContent = 'Comprobante cargado correctamente.';
      }
    } catch (err) {
      if (statusEl) statusEl.textContent = 'No se pudo adjuntar la imagen, puedes enviarla por WhatsApp.';
    }
  },

  buildWhatsAppOrderMessage(order) {
    const itemsLines = (order.items || [])
      .map(
        (i, idx) =>
          `${idx + 1}. *${i.name}* (${i.brand === 'valenshop' ? 'Valen Shop' : 'VaroStyle'}) - Talla: *${i.size}* | Color: *${i.color}* | Cant: ${i.quantity} | ${app.formatCOP(i.price * i.quantity)}`
      )
      .join('\n');

    const methodLabel =
      order.paymentMethod === 'nequi'
        ? 'Nequi (3147923972 - Valentina Fuenmayor)'
        : order.paymentMethod === 'pse_card'
        ? `PSE / Tarjeta (${order.paymentReference || 'Aprobado'})`
        : order.paymentMethod === 'contraentrega'
        ? 'Pago Contraentrega al recibir'
        : 'Coordinar por WhatsApp';

    const mainBrand = app.state.settings?.mainBrand || 'V&V Studio';

    return (
      `Hola *${mainBrand} (VaroStyle & Valen Shop)*\n` +
      `Acabo de realizar el pedido *#${order.orderNumber}* en la página web:\n\n` +
      `*Cliente:* ${order.customerName}\n` +
      `*Documento:* ${order.customerDoc}\n` +
      `*Teléfono:* ${order.customerPhone}\n` +
      `*Ciudad:* ${order.city}, ${order.department}\n` +
      `*Dirección:* ${order.address}\n\n` +
      `*PRENDAS DEL PEDIDO:*\n${itemsLines}\n\n` +
      (order.discount > 0 ? `*Descuento (${order.couponCode}):* -${app.formatCOP(order.discount)}\n` : '') +
      `*Envío:* ${order.shipping === 0 ? 'GRATIS' : app.formatCOP(order.shipping)}\n` +
      `*TOTAL A PAGAR:* *${app.formatCOP(order.total)}*\n` +
      `*Método de pago:* ${methodLabel}\n` +
      (order.paymentReference ? `*Referencia:* ${order.paymentReference}\n` : '') +
      `\nQuedo atento(a) para confirmar el despacho.`
    );
  },

  async submitOrder(event) {
    event.preventDefault();
    const { subtotal, discount, shipping, total } = this.getCalculatedTotals();

    const payload = {
      channel: 'WEB',
      customerName: document.getElementById('chkName')?.value.trim(),
      customerDoc: document.getElementById('chkDoc')?.value.trim(),
      customerPhone: document.getElementById('chkPhone')?.value.trim(),
      customerEmail: document.getElementById('chkEmail')?.value.trim(),
      department: document.getElementById('chkDept')?.value.trim(),
      city: document.getElementById('chkCity')?.value.trim(),
      address: document.getElementById('chkAddress')?.value.trim(),
      notes: document.getElementById('chkNotes')?.value.trim(),
      paymentMethod: this.state.paymentMethod,
      paymentReference: document.getElementById('chkPaymentRef')?.value || '',
      paymentReceipt: this.state.uploadedReceiptUrl || '',
      items: app.state.cart,
      subtotal,
      couponCode: this.state.appliedCoupon?.code || '',
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

      const createdOrder = await res.json();
      if (!res.ok) throw new Error(createdOrder.error || 'Error creando pedido');

      app.state.cart = [];
      app.saveCart();
      await app.loadBootstrapData();
      app.renderAll();

      const waNumber = (app.state.settings?.stores?.varostyle?.whatsapp || '3147923972').replace(/\D/g, '');
      const waMessage = encodeURIComponent(this.buildWhatsAppOrderMessage(createdOrder));
      const waUrl = `https://wa.me/57${waNumber}?text=${waMessage}`;
      const mainBrand = app.state.settings?.mainBrand || 'V&V Studio';

      const container = document.getElementById('checkoutModalContent');
      container.innerHTML = `
        <div style="text-align:center; padding:28px 16px;">
          <div style="margin-bottom:12px; display:flex; justify-content:center; color:#16A34A;">
            <i data-lucide="check-circle-2" style="width:52px; height:52px;"></i>
          </div>
          <span class="badge-pill badge-promo">PEDIDO REGISTRADO CON ÉXITO</span>
          <h2 style="font-family:var(--font-heading); font-size:1.8rem; margin:10px 0;">Orden #${createdOrder.orderNumber}</h2>
          <p style="color:var(--text-muted); max-width:520px; margin:0 auto 20px;">
            Gracias por tu compra, <strong>${createdOrder.customerName}</strong>. Hemos guardado tu pedido en el sistema oficial de <strong>${mainBrand} (VaroStyle & Valen Shop)</strong>.
          </p>

          <div style="max-width:460px; margin:0 auto 22px; background:#FAF9F6; padding:16px; border-radius:12px; border:1px solid var(--border-color); text-align:left; font-size:0.86rem;">
            <p><strong>Código de rastreo:</strong> ${createdOrder.orderNumber}</p>
            <p><strong>Estado actual:</strong> ${createdOrder.status}</p>
            ${createdOrder.discount > 0 ? `<p><strong>Descuento (${createdOrder.couponCode}):</strong> -${app.formatCOP(createdOrder.discount)}</p>` : ''}
            <p><strong>Total:</strong> ${app.formatCOP(createdOrder.total)}</p>
            <p><strong>Cuenta Nequi Oficial:</strong> 314 792 3972 (Valentina Fuenmayor)</p>
          </div>

          <div style="display:flex; flex-wrap:wrap; gap:12px; justify-content:center;">
            <a href="${waUrl}" target="_blank" rel="noopener" class="btn-checkout-main inline-icon-btn justify-center" style="max-width:360px; text-decoration:none; background:#1FAF5B;">
              <i data-lucide="message-circle" class="icon-xs"></i>
              <span>ENVIAR RESUMEN Y COMPROBANTE POR WHATSAPP</span>
            </a>
            <button class="btn-outline-sm" onclick="checkout.closeCheckoutModal()">
              Seguir viendo la tienda
            </button>
          </div>
        </div>
      `;

      app.refreshIcons();

      if (this.state.paymentMethod === 'whatsapp') {
        window.open(waUrl, '_blank');
      }
    } catch (err) {
      console.error(err);
      app.showToast('Hubo un error al registrar el pedido');
    }
  },

  quickOrderViaWhatsApp() {
    if (!app.state.cart.length) {
      app.showToast('Agrega al menos una prenda a tu bolsa primero');
      return;
    }
    const { total } = app.getCartTotals();
    const lines = app.state.cart
      .map(
        (i, idx) =>
          `${idx + 1}. *${i.name}* (${i.brand === 'valenshop' ? 'Sub-marca Valen Shop' : 'Sub-marca VaroStyle'}) - Talla: *${i.size}* | Color: *${i.color}* | Cant: ${i.quantity} (${app.formatCOP(i.price * i.quantity)})`
      )
      .join('\n');

    const mainBrand = app.state.settings?.mainBrand || 'V&V Studio';
    const msg = encodeURIComponent(
      `Hola *${mainBrand} (VaroStyle & Valen Shop)*\nQuiero pedir las siguientes prendas:\n\n${lines}\n\n*Subtotal:* ${app.formatCOP(total)}\n\n¿Me ayudas a confirmar disponibilidad y pago por Nequi (3147923972)?`
    );
    const waNumber = (app.state.settings?.stores?.varostyle?.whatsapp || '3147923972').replace(/\D/g, '');
    window.open(`https://wa.me/57${waNumber}?text=${msg}`, '_blank');
  }
};
