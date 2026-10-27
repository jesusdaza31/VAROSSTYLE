# V&V STUDIO — E-Commerce, PWA, ERP, CRM & POS Platform

Plataforma integral de comercio electrónico, Progressive Web App (PWA) instalable y sistema empresarial **ERP + CRM + POS** lista para producción, diseñada para operar la casa oficial de moda **V&V STUDIO** y sus dos sub-marcas especializadas:

- **VaroStyle (Hombre)**: Moda masculina con estilo, versatilidad y presencia contemporánea.
- **Valen Shop (Mujer)**: Moda femenina enfocada en la elegancia sutil y tendencias de temporada.

---

## Módulos de Producción Incluidos (10 Módulos CRUD)

1. **Dashboard Ejecutivo & Finanzas Reales**: Cálculo en tiempo real de Ingresos Brutos, Costo de Mercancía Vendida (`COGS`), Gastos Operativos, **Utilidad Neta Real**, Ticket Promedio, Valorización de Inventario en Bodega, comparativa de ventas `VaroStyle` vs `Valen Shop`, Top Prendas Más Vendidas y Alertas de Stock Crítico.
2. **CRUD de Productos, Costos y Kardex de Inventario**: Gestión de SKU, precio de venta, costo de proveedor con margen (`%`) en vivo, tallas, colores, galería de imágenes persistente (Local + Base64 para Serverless/Vercel), duplicación en 1 clic, activación/ocultación rápida, ajuste `+`/`-` en tabla, auditoría completa de **Kardex (`inventory_movements`)** y exportación CSV.
3. **CRUD de Categorías y Colecciones**: Creación, edición, ordenamiento y eliminación de categorías dinámicas por marca sincronizadas automáticamente con el catálogo público.
4. **CRUD de Clientes — CRM 360°**: Creación automática de clientes en cada pedido web o POS + gestión manual, segmentación (`Nuevo`, `Frecuente`, `VIP`, `Mayorista`), **Expediente 360°** con historial de compras, contacto directo a WhatsApp y exportación CSV.
5. **CRUD de Pedidos, Punto de Venta (POS), Guías y Factura Imprimible**:
   - **Venta Manual POS**: Registro de ventas por WhatsApp, Instagram DM o Tienda Física descontando inventario automáticamente.
   - **Logística y Guías**: Asignación de transportadora (`Interrapidísimo`, `Servientrega`, `Envía`, `Coordinadora`, `Domicilio Local`), número de guía y notificación automática por WhatsApp al cliente.
   - **Reversión Automática de Stock**: Al cancelar un pedido, las unidades regresan automáticamente al inventario y se registran en el Kardex.
   - **Comprobante y Rótulo de Despacho Imprimible**: Generación de rótulo de envío para el paquete y factura/recibo para el cliente.
6. **CRUD de Cupones y Promociones**: Códigos de descuento por porcentaje (`%`), monto fijo (`$ COP`) o envío gratis (`BIENVENIDA10`, `VARO15`, `VALEN15`, `ENVIOGRATIS`) validados en tiempo real en el Checkout.
7. **CRUD de Zonas y Tarifas de Envío**: Configuración de tarifas por región/ciudad, tiempos de entrega y topes de envío gratis.
8. **CRUD de Gastos y Flujo de Caja**: Registro de compras a proveedores, publicidad (Meta/Instagram Ads), empaques y operación para el cálculo exacto de la ganancia neta.
9. **CRUD de Banners e Identidad Visual**: Gestión del carrusel principal, logos, cuenta Nequi, QR oficial, llaves y políticas de cambio.
10. **Seguridad por PIN & Backup / Restore Total (`.json`)**: Protección de acceso administrativo y descarga/restauración completa de la base de datos en 1 clic.

---

## Tecnologías Utilizadas

- **Backend**: Node.js (`>=22.x`), Express, `node:sqlite` (SQLite relacional de 10 tablas), Multer, CORS.
- **Frontend**: HTML5 Semántico, CSS3 Responsive Mobile-First + Print Styles, JavaScript ES6+ Modular (`app.js`, `checkout.js`, `admin.js`).
- **Iconografía**: Lucide Vector Icons (0 emojis).
- **Despliegue**: Configurado para servidor Node tradicional y **Vercel Serverless** (`vercel.json` + `api/index.js`).

---

## Instalación y Ejecución Local

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/jesusdaza31/VAROSSTYLE.git
   cd VAROSSTYLE
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Iniciar el servidor**:
   ```bash
   npm start
   ```

4. **Abrir en el navegador**:
   - Tienda pública: [http://localhost:3000](http://localhost:3000)
   - Panel de Administración ERP/CRM/POS: Botón **Panel Admin** (PIN por defecto: `1234`).

---

## Contacto Institucional

- **WhatsApp Oficial**: +57 314 792 3972
- **Instagram VaroStyle**: [@varostyle.co](https://instagram.com/varostyle.co)
- **Instagram Valen Shop**: [@valenshop.co](https://instagram.com/valenshop.co)
