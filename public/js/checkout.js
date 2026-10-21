// ============================================================================
// VAROSTYLE & VALEN SHOP — CHECKOUT MULTICANAL (NEQUI, PSE/TARJETA, WHATSAPP)
// ============================================================================

const checkout = {
  state: {
    paymentMethod: 'nequi', // 'nequi' | 'pse_card' | 'whatsapp'
    uploadedReceiptUrl: ''
  },

  openCheckoutModal() {
    if (!app.state.cart || app.state.cart.length === 0) {
      app.showToast('Tu bolsa de compras está vacía');
      return;
    }
    app.toggleCartDrawer(false);
    this.state.uploadedReceiptUrl = '';
    this.renderCheckoutModal();
    document.getElementById('checkoutModalBackdrop')?.classList.remove('hidden');
  },

  closeCheckoutModal() {
    document.getElementById('checkoutModalBackdrop')?.classList.add('hidden');
  },

  setPaymentMethod(method) {
    this.state.paymentMethod = method;
    document.querySelectorAll('.pay-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-pay-method') === method);
    });
    this.renderPaymentMethodDetails();
  },

  renderCheckoutModal() {
    const { subtotal, shipping, total } = app.getCartTotals();
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
          <div class="payment-methods-tabs">
            <button
              type="button"
              class="pay-tab-btn ${this.state.paymentMethod === 'nequi' ? 'active' : ''}"
              data-pay-method="nequi"
              onclick="checkout.setPaymentMethod('nequi')"
            >
              <div class="pay-tab-icon"><i data-lucide="qr-code" class="icon-sm"></i></div>
              <span>Nequi Oficial</span><br/><small>QR + Comprobante</small>
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

        <!-- Columna Derecha: Resumen de Prendas -->
        <div>
          <div style="background:#FAF9F6; padding:20px; border-radius:14px; border:1px solid var(--border-color);">
            <h4 style="margin-bottom:14px; font-family:var(--font-heading);">Resumen de tu Pedido</h4>
            <div style="max-height:260px; overflow-y:auto; margin-bottom:14px;">
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

            <div class="cart-summary-row">
              <span>Subtotal prendas</span>
              <strong>${app.formatCOP(subtotal)}</strong>
            </div>
            <div class="cart-summary-row">
              <span>Envío nacional</span>
              <strong>${shipping === 0 ? 'GRATIS' : app.formatCOP(shipping)}</strong>
            </div>
            <div class="cart-summary-row total">
              <span>Total a Pagar</span>
              <strong style="font-size:1.3rem;">${app.formatCOP(total)}</strong>
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
    const { total } = app.getCartTotals();

    if (this.state.paymentMethod === 'nequi') {
      box.innerHTML = `
        <div class="nequi-payment-card">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <span class="nequi-pill">PAGO CON NEQUI</span>
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
            <div><strong>Llave Nequi:</strong> ${key}</div>
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
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
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
      `*Envío:* ${order.shipping === 0 ? 'GRATIS' : app.formatCOP(order.shipping)}\n` +
      `*TOTAL A PAGAR:* *${app.formatCOP(order.total)}*\n` +
      `*Método de pago:* ${methodLabel}\n` +
      (order.paymentReference ? `*Referencia:* ${order.paymentReference}\n` : '') +
      `\nQuedo atento(a) para confirmar el despacho.`
    );
  },

  async submitOrder(event) {
    event.preventDefault();
    const { subtotal, shipping, total } = app.getCartTotals();

    const payload = {
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
