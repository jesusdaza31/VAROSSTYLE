# V&V STUDIO — E-Commerce & PWA Platform

Plataforma de comercio electrónico moderna, responsiva y Progressive Web App (PWA) instalable en dispositivos móviles, diseñada para integrar y potenciar dos marcas de moda bajo una misma identidad:

- **VaroStyle**: Moda masculina con estilo, versatilidad y presencia contemporánea.
- **Valen Shop**: Moda femenina enfocada en la elegancia sutil y tendencias de temporada.

---

## Características Principales

- **Arquitectura de Doble Tienda**: Navegación fluida entre colecciones de hombre (VaroStyle) y mujer (Valen Shop), con banner institucional y filtros rápidos por categoría, precio y ordenación.
- **Progressive Web App (PWA)**: Compatible para instalación como app nativa en dispositivos móviles y de escritorio (con Service Worker, manifest y soporte offline).
- **Checkout Inteligente Multicanal**: Integración de pasarelas y transferencias directas (Nequi con QR dinámico, PSE y confirmación directa a WhatsApp con resumen de pedido formateado).
- **Panel Administrativo (CMS)**: Gestión completa de productos (crear, editar, eliminar, cambiar estado, ajustar precios, tallas y colores) y configuración de tiendas.
- **Diseño 100% Profesional**: Interfaz limpia, optimizada para celular y escritorio, con iconos vectoriales Lucide.
- **Base de Datos SQLite Integrada**: Persistencia local ultraligera mediante `node:sqlite` sin necesidad de servidores de bases de datos externos.

---

## Tecnologías Utilizadas

- **Backend**: Node.js, Express, `node:sqlite` (SQLite nativo de Node), Multer, Cors.
- **Frontend**: HTML5 Semántico, CSS3 Vanilla con variables y diseño mobile-first, JavaScript ES6+.
- **Iconografía**: Lucide Icons (CDN oficial).
- **PWA**: Web App Manifest y Service Worker Cache First / Network First.

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
   - Panel de Administración: Acceso desde el menú o modal de gestión.

---

## Contacto Institucional

- **WhatsApp**: +57 314 792 3972
- **Instagram VaroStyle**: [@varostyle.co](https://instagram.com/varostyle.co)
- **Instagram Valen Shop**: [@valenshop.co](https://instagram.com/valenshop.co)
