const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 3000;
const isVercel = Boolean(process.env.VERCEL);

// Asegurar carpetas de datos y subidas (en Vercel usar /tmp debido al sistema de archivos de solo lectura)
const dataDir = isVercel ? path.join(os.tmpdir(), 'varostyle-data') : path.join(__dirname, 'data');
const uploadsDir = isVercel ? path.join(os.tmpdir(), 'varostyle-uploads') : path.join(__dirname, 'public', 'uploads');

try {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
} catch (e) {
  console.warn('Advertencia al crear dataDir:', e.message);
}

try {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
} catch (e) {
  console.warn('Advertencia al crear uploadsDir:', e.message);
}

// Inicializar base de datos SQLite con respaldo
const dbPath = path.join(dataDir, 'varostyle.sqlite');
let db;
try {
  db = new DatabaseSync(dbPath);
} catch (err) {
  console.warn('No se pudo abrir sqlite en disco, usando :memory::', err.message);
  db = new DatabaseSync(':memory:');
}

// Configuración de middlewares
app.use(cors());
app.use(express.json({ limit: '35mb' }));
app.use(express.urlencoded({ extended: true, limit: '35mb' }));
app.use(express.static(path.join(__dirname, 'public')));
if (isVercel) {
  app.use('/uploads', express.static(uploadsDir));
}

// Configuración de Multer para subir fotos (productos, logos, QR Nequi, comprobantes)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const safeName = file.originalname
      .replace(ext, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .slice(0, 30);
    cb(null, `${Date.now()}-${safeName}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

// Helper para eliminar cualquier emoji de cadenas existentes
function stripEmojis(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Helper para migraciones seguras de columnas en tablas existentes
function ensureColumn(tableName, colName, colDef) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${tableName})`).all();
    if (!cols.some(c => c.name === colName)) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colDef}`);
    }
  } catch (e) {
    console.warn(`Advertencia migrando columna ${tableName}.${colName}:`, e.message);
  }
}

// Crear las 10 tablas relacionales e inicializar semillas de producción
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      brand TEXT DEFAULT 'all', -- 'all' | 'varostyle' | 'valenshop'
      description TEXT DEFAULT '',
      sortOrder INTEGER DEFAULT 10,
      active INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT DEFAULT '',
      name TEXT NOT NULL,
      brand TEXT NOT NULL, -- 'varostyle' (Hombre) | 'valenshop' (Mujer)
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      costPrice INTEGER DEFAULT 0,
      comparePrice INTEGER DEFAULT 0,
      description TEXT,
      sizes TEXT NOT NULL, -- JSON array e.g. ["S","M","L","XL"]
      colors TEXT NOT NULL, -- JSON array e.g. [{"name":"Negro","hex":"#111111"}]
      images TEXT NOT NULL, -- JSON array of URLs or Data URLs
      badge TEXT DEFAULT '', -- 'NUEVO', 'MÁS VENDIDO', 'SALE', ''
      stock INTEGER DEFAULT 15,
      minStockAlert INTEGER DEFAULT 3,
      featured INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER NOT NULL,
      productName TEXT DEFAULT '',
      sku TEXT DEFAULT '',
      type TEXT NOT NULL, -- 'IN_PURCHASE' | 'OUT_SALE' | 'RETURN' | 'ADJUSTMENT'
      quantity INTEGER NOT NULL,
      previousStock INTEGER NOT NULL,
      newStock INTEGER NOT NULL,
      note TEXT DEFAULT '',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      doc TEXT DEFAULT '',
      phone TEXT NOT NULL,
      email TEXT DEFAULT '',
      department TEXT DEFAULT '',
      city TEXT DEFAULT '',
      address TEXT DEFAULT '',
      neighborhood TEXT DEFAULT '',
      segment TEXT DEFAULT 'Nuevo', -- 'Nuevo' | 'Frecuente' | 'VIP' | 'Mayorista'
      notes TEXT DEFAULT '',
      totalOrders INTEGER DEFAULT 0,
      totalSpent INTEGER DEFAULT 0,
      lastOrderAt TEXT DEFAULT CURRENT_TIMESTAMP,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderNumber TEXT NOT NULL UNIQUE,
      customerId INTEGER DEFAULT 0,
      channel TEXT DEFAULT 'WEB', -- 'WEB' | 'POS_WHATSAPP' | 'POS_INSTAGRAM' | 'TIENDA_FISICA'
      customerName TEXT NOT NULL,
      customerDoc TEXT DEFAULT '',
      customerPhone TEXT NOT NULL,
      customerEmail TEXT DEFAULT '',
      department TEXT DEFAULT '',
      city TEXT NOT NULL,
      address TEXT NOT NULL,
      notes TEXT DEFAULT '',
      paymentMethod TEXT NOT NULL, -- 'nequi' | 'pse_card' | 'whatsapp' | 'contraentrega' | 'efectivo'
      paymentStatus TEXT DEFAULT 'Pendiente', -- 'Pendiente' | 'Pagado' | 'Reembolsado'
      paymentReference TEXT DEFAULT '',
      paymentReceipt TEXT DEFAULT '',
      items TEXT NOT NULL, -- JSON array of cart items
      subtotal INTEGER NOT NULL,
      couponCode TEXT DEFAULT '',
      discount INTEGER DEFAULT 0,
      shipping INTEGER NOT NULL,
      total INTEGER NOT NULL,
      totalCost INTEGER DEFAULT 0,
      status TEXT DEFAULT 'Pendiente', -- 'Pendiente' | 'Confirmado' | 'Empacado' | 'Enviado' | 'Entregado' | 'Cancelado'
      carrier TEXT DEFAULT '',
      trackingNumber TEXT DEFAULT '',
      stockDeducted INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      type TEXT DEFAULT 'PERCENT', -- 'PERCENT' | 'FIXED' | 'FREE_SHIPPING'
      value INTEGER NOT NULL DEFAULT 10,
      minPurchase INTEGER DEFAULT 0,
      brand TEXT DEFAULT 'all', -- 'all' | 'varostyle' | 'valenshop'
      maxUses INTEGER DEFAULT 0, -- 0 = ilimitado
      usedCount INTEGER DEFAULT 0,
      expiresAt TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shipping_zones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      departments TEXT DEFAULT '',
      price INTEGER NOT NULL DEFAULT 12000,
      freeThreshold INTEGER DEFAULT 200000,
      estimatedDays TEXT DEFAULT '2 a 4 días hábiles',
      allowCod INTEGER DEFAULT 1,
      active INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT DEFAULT 'MERCANCIA', -- 'MERCANCIA' | 'PUBLICIDAD' | 'EMPAQUES' | 'ENVIOS' | 'OPERACION' | 'OTROS'
      brand TEXT DEFAULT 'all', -- 'all' | 'varostyle' | 'valenshop'
      amount INTEGER NOT NULL DEFAULT 0,
      paymentMethod TEXT DEFAULT 'Nequi / Transferencia',
      date TEXT DEFAULT CURRENT_DATE,
      notes TEXT DEFAULT '',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand TEXT NOT NULL, -- 'all', 'varostyle', 'valenshop'
      subtitle TEXT,
      title TEXT NOT NULL,
      description TEXT,
      ctaText TEXT DEFAULT 'VER COLECCIÓN',
      ctaFilter TEXT DEFAULT 'all',
      image TEXT NOT NULL,
      theme TEXT DEFAULT 'dark',
      sortOrder INTEGER DEFAULT 1,
      active INTEGER DEFAULT 1
    );
  `);

  // Asegurar columnas nuevas en instalaciones existentes (migración limpia)
  ensureColumn('products', 'sku', "TEXT DEFAULT ''");
  ensureColumn('products', 'costPrice', 'INTEGER DEFAULT 0');
  ensureColumn('products', 'minStockAlert', 'INTEGER DEFAULT 3');
  ensureColumn('banners', 'sortOrder', 'INTEGER DEFAULT 1');
  ensureColumn('orders', 'customerId', 'INTEGER DEFAULT 0');
  ensureColumn('orders', 'channel', "TEXT DEFAULT 'WEB'");
  ensureColumn('orders', 'paymentStatus', "TEXT DEFAULT 'Pendiente'");
  ensureColumn('orders', 'couponCode', "TEXT DEFAULT ''");
  ensureColumn('orders', 'discount', 'INTEGER DEFAULT 0');
  ensureColumn('orders', 'totalCost', 'INTEGER DEFAULT 0');
  ensureColumn('orders', 'carrier', "TEXT DEFAULT ''");
  ensureColumn('orders', 'trackingNumber', "TEXT DEFAULT ''");
  ensureColumn('orders', 'stockDeducted', 'INTEGER DEFAULT 1');
  ensureColumn('orders', 'updatedAt', 'TEXT DEFAULT CURRENT_TIMESTAMP');

  const defaultSettings = {
    mainBrand: 'V&V STUDIO',
    mainTagline: 'VAROSTYLE • VALEN SHOP',
    mainLogoUrl: '',
    adminPin: '1234',
    topPromoBar: 'V&V STUDIO OFICIAL | ENVÍOS SEGUROS A TODA COLOMBIA | PAGA CON NEQUI, PSE, TARJETA O WHATSAPP | ENVÍO GRATIS DESDE $200.000',
    freeShippingThreshold: 200000,
    defaultShippingCost: 12000,
    returnPolicy: 'Cambios por talla o referencia dentro de los 15 días calendario posteriores a la entrega. La prenda debe conservar sus etiquetas originales.',
    stores: {
      varostyle: {
        id: 'varostyle',
        name: 'VaroStyle',
        genderLabel: 'HOMBRE',
        shortDescription: 'Ropa masculina con estilo',
        aboutUs: `En VaroStyle somos un emprendimiento de moda masculina que busca ofrecer prendas modernas, versátiles y con estilo, ideales para cada ocasión.\n\nNos caracterizamos por brindar una atención cercana y personalizada, ofreciendo calidad, comodidad y diseños que reflejan la personalidad de cada hombre.\n\nMás que vender ropa, queremos ayudarte a vestir con confianza, elegancia y actitud.\n\nVaroStyle: tu estilo, tu esencia.`,
        slogan: 'VaroStyle: tu estilo, tu esencia.',
        whatsapp: '3147923972',
        instagram: 'varostyle.co',
        tiktok: '',
        nequiNumber: '3147923972',
        accountHolder: 'Valentina Fuenmayor',
        nequiKey: '3147923972',
        logoUrl: '',
        nequiQrUrl: ''
      },
      valenshop: {
        id: 'valenshop',
        name: 'Valen Shop',
        genderLabel: 'MUJER',
        shortDescription: 'Elegancia sutil, belleza natural',
        aboutUs: `En Valen Shop somos un emprendimiento dedicado a la moda femenina, donde encontrarás prendas que siguen las tendencias y se adaptan a tu estilo.\n\nNos inspira ofrecer una experiencia de compra especial, con atención amable y opciones para que encuentres aquello que te haga sentir cómoda y hermosa.\n\nQueremos acompañarte en cada momento, ayudándote a resaltar tu belleza y expresar tu personalidad a través de la moda.\n\nValen Shop: viste tu esencia, refleja tu belleza.`,
        slogan: 'Valen Shop: viste tu esencia, refleja tu belleza.',
        whatsapp: '3147923972',
        instagram: 'valenshop.co',
        tiktok: '',
        nequiNumber: '3147923972',
        accountHolder: 'Valentina Fuenmayor',
        nequiKey: '3147923972',
        logoUrl: '',
        nequiQrUrl: ''
      }
    }
  };

  // Verificar si ya existe configuración inicial o actualizarla con V&V STUDIO
  const existingSettings = db.prepare('SELECT value FROM settings WHERE key = ?').get('store_config');
  if (!existingSettings) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(
      'store_config',
      JSON.stringify(defaultSettings)
    );
  } else {
    const parsed = JSON.parse(existingSettings.value);
    if (!parsed.mainBrand || parsed.mainBrand === 'VaroStyle') {
      parsed.mainBrand = 'V&V STUDIO';
    }
    if (!parsed.mainTagline) {
      parsed.mainTagline = 'VAROSTYLE • VALEN SHOP';
    }
    if (parsed.mainLogoUrl === undefined) {
      parsed.mainLogoUrl = '';
    }
    if (!parsed.adminPin) {
      parsed.adminPin = '1234';
    }
    if (!parsed.returnPolicy) {
      parsed.returnPolicy = defaultSettings.returnPolicy;
    }
    parsed.topPromoBar = stripEmojis(parsed.topPromoBar || defaultSettings.topPromoBar);
    if (parsed.stores?.varostyle) {
      parsed.stores.varostyle.shortDescription = stripEmojis(parsed.stores.varostyle.shortDescription);
      parsed.stores.varostyle.aboutUs = (parsed.stores.varostyle.aboutUs || '')
        .split('\n')
        .map(line => stripEmojis(line))
        .join('\n');
      parsed.stores.varostyle.slogan = stripEmojis(parsed.stores.varostyle.slogan);
    }
    if (parsed.stores?.valenshop) {
      parsed.stores.valenshop.shortDescription = stripEmojis(parsed.stores.valenshop.shortDescription);
      parsed.stores.valenshop.aboutUs = (parsed.stores.valenshop.aboutUs || '')
        .split('\n')
        .map(line => stripEmojis(line))
        .join('\n');
      parsed.stores.valenshop.slogan = stripEmojis(parsed.stores.valenshop.slogan);
    }
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(JSON.stringify(parsed), 'store_config');
  }

  // Semilla de Categorías oficiales
  const existingCategories = db.prepare('SELECT COUNT(*) as count FROM categories').get();
  if (existingCategories.count === 0) {
    const seedCategories = [
      { name: 'Camisas', brand: 'varostyle', description: 'Camisas Oxford, lino y corte Slim Fit masculino', sortOrder: 1 },
      { name: 'Camisetas', brand: 'varostyle', description: 'Camisetas Oversize Heavyweight y Polos tejidos', sortOrder: 2 },
      { name: 'Chaquetas y Buzos', brand: 'varostyle', description: 'Chaquetas Bomber, hoodies y sobrecamisas', sortOrder: 3 },
      { name: 'Vestidos y Enterizos', brand: 'valenshop', description: 'Vestidos midi, satinados, de gala y bohemios', sortOrder: 4 },
      { name: 'Blusas y Tops', brand: 'valenshop', description: 'Blusas románticas, tops elegantes y bodys', sortOrder: 5 },
      { name: 'Chaquetas y Blazers', brand: 'valenshop', description: 'Blazers estructurados y abrigos femeninos', sortOrder: 6 },
      { name: 'Conjuntos', brand: 'all', description: 'Sets de dos piezas en lino y sastrería moderna', sortOrder: 7 },
      { name: 'Jeans y Pantalones', brand: 'all', description: 'Denim premium masculino y femenino de horma perfecta', sortOrder: 8 },
      { name: 'Accesorios', brand: 'all', description: 'Complementos exclusivos V&V Studio', sortOrder: 9 }
    ];
    const insertCat = db.prepare(`
      INSERT INTO categories (name, slug, brand, description, sortOrder, active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    for (const c of seedCategories) {
      insertCat.run(c.name, slugify(c.name), c.brand, c.description, c.sortOrder);
    }
  }

  // Semilla de Banners
  const existingBanners = db.prepare('SELECT COUNT(*) as count FROM banners').get();
  if (existingBanners.count === 0) {
    const seedBanners = [
      {
        brand: 'all',
        subtitle: 'CASA DE MODA OFICIAL • VAROSTYLE & VALEN SHOP',
        title: 'V&V STUDIO',
        description: 'Nuestra marca oficial que une dos líneas exclusivas: VaroStyle (Moda Masculina) y Valen Shop (Moda Femenina).',
        ctaText: 'EXPLORAR CATÁLOGO OFICIAL',
        ctaFilter: 'all',
        image: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=1600&q=85',
        theme: 'dark',
        sortOrder: 1
      },
      {
        brand: 'varostyle',
        subtitle: 'SUB-MARCA HOMBRE • VAROSTYLE BY V&V STUDIO',
        title: 'TU ESTILO, TU ESENCIA.',
        description: 'Prendas modernas, versátiles y con actitud para destacar en cada ocasión. Inspiración urbana y elegante.',
        ctaText: 'EXPLORAR VAROSTYLE (HOMBRE)',
        ctaFilter: 'varostyle',
        image: 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?auto=format&fit=crop&w=1600&q=85',
        theme: 'dark',
        sortOrder: 2
      },
      {
        brand: 'valenshop',
        subtitle: 'SUB-MARCA MUJER • VALEN SHOP BY V&V STUDIO',
        title: 'ELEGANCIA SUTIL, BELLEZA NATURAL',
        description: 'Tendencias pensadas para hacerte sentir cómoda, auténtica y radiante en cada momento especial.',
        ctaText: 'EXPLORAR VALEN SHOP (MUJER)',
        ctaFilter: 'valenshop',
        image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=85',
        theme: 'light',
        sortOrder: 3
      }
    ];

    const insertBanner = db.prepare(`
      INSERT INTO banners (brand, subtitle, title, description, ctaText, ctaFilter, image, theme, sortOrder, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    for (const b of seedBanners) {
      insertBanner.run(b.brand, b.subtitle, b.title, b.description, b.ctaText, b.ctaFilter, b.image, b.theme, b.sortOrder);
    }
  }

  // Semilla de Productos
  const existingProducts = db.prepare('SELECT COUNT(*) as count FROM products').get();
  if (existingProducts.count === 0) {
    const seedProducts = [
      // ==================== VAROSTYLE (HOMBRE) ====================
      {
        sku: 'VS-CAM-001',
        name: 'Camisa Oxford Slim Fit Essential',
        brand: 'varostyle',
        category: 'Camisas',
        price: 115000,
        costPrice: 58000,
        comparePrice: 140000,
        description: 'Camisa masculina de corte Slim Fit en algodón Oxford respirable. Ideal tanto para un look casual con jeans como para ocasiones elegantes. Diseño versátil que resalta tu presencia.',
        sizes: ['S', 'M', 'L', 'XL'],
        colors: [
          { name: 'Blanco Óptico', hex: '#F5F5F7' },
          { name: 'Negro Profundo', hex: '#141416' },
          { name: 'Azul Cielo', hex: '#89CFF0' }
        ],
        images: [
          'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=900&q=85',
          'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=900&q=85'
        ],
        badge: 'MÁS VENDIDO',
        stock: 20,
        minStockAlert: 4,
        featured: 1
      },
      {
        sku: 'VS-TSH-002',
        name: 'Camiseta Oversize Heavyweight "Essence"',
        brand: 'varostyle',
        category: 'Camisetas',
        price: 78000,
        costPrice: 36000,
        comparePrice: 95000,
        description: 'Camiseta boxy/oversize en algodón peruano de alto gramaje (240g). Cuello acanalado reforzado y caída estructurada para un look urbano moderno al estilo KOAJ.',
        sizes: ['S', 'M', 'L', 'XL'],
        colors: [
          { name: 'Negro Carbón', hex: '#18181B' },
          { name: 'Arena Beige', hex: '#D6C7B2' },
          { name: 'Verde Oliva', hex: '#4A5D4E' }
        ],
        images: [
          'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=85',
          'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=900&q=85'
        ],
        badge: 'NUEVO',
        stock: 30,
        minStockAlert: 5,
        featured: 1
      },
      {
        sku: 'VS-JKT-003',
        name: 'Chaqueta Bomber Urban Noir',
        brand: 'varostyle',
        category: 'Chaquetas y Buzos',
        price: 165000,
        costPrice: 85000,
        comparePrice: 199000,
        description: 'Chaqueta tipo Bomber con acabado impermeable ligero, cierres metálicos premium y bolsillo utilitario. La prenda definitiva para elevar cualquier outfit masculino.',
        sizes: ['S', 'M', 'L', 'XL'],
        colors: [
          { name: 'Negro', hex: '#111111' },
          { name: 'Gris Grafito', hex: '#3F3F46' }
        ],
        images: [
          'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=900&q=85',
          'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=900&q=85'
        ],
        badge: 'SALE',
        stock: 12,
        minStockAlert: 3,
        featured: 1
      },
      {
        sku: 'VS-JNS-004',
        name: 'Jean Cargo Relaxed Denim VaroStyle',
        brand: 'varostyle',
        category: 'Jeans y Pantalones',
        price: 138000,
        costPrice: 68000,
        comparePrice: 160000,
        description: 'Jean masculino de tiro medio y bota recta relajada, confeccionado en denim rígido lavado con toque de elastano para máxima comodidad durante todo el día.',
        sizes: ['28', '30', '32', '34', '36'],
        colors: [
          { name: 'Azul Vintage', hex: '#3B5998' },
          { name: 'Negro Lavado', hex: '#27272A' }
        ],
        images: [
          'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=900&q=85',
          'https://images.unsplash.com/photo-1604176354204-9268737828e4?auto=format&fit=crop&w=900&q=85'
        ],
        badge: 'NUEVO',
        stock: 18,
        minStockAlert: 4,
        featured: 1
      },
      {
        sku: 'VS-SET-005',
        name: 'Set Lino Verano (Camisa + Bermuda)',
        brand: 'varostyle',
        category: 'Conjuntos',
        price: 175000,
        costPrice: 88000,
        comparePrice: 210000,
        description: 'Conjunto masculino de dos piezas en mezcla de lino fresco y algodón. Incluye camisa manga corta de cuello cubano y bermuda con cordón ajustable.',
        sizes: ['S', 'M', 'L', 'XL'],
        colors: [
          { name: 'Blanco Marfil', hex: '#FAF8F5' },
          { name: 'Arena Tostado', hex: '#C2B280' },
          { name: 'Negro', hex: '#111111' }
        ],
        images: [
          'https://images.unsplash.com/photo-1516826957135-700dedea698c?auto=format&fit=crop&w=900&q=85',
          'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=900&q=85'
        ],
        badge: 'MÁS VENDIDO',
        stock: 14,
        minStockAlert: 3,
        featured: 1
      },
      {
        sku: 'VS-POL-006',
        name: 'Polo Tejido Milano Elegance',
        brand: 'varostyle',
        category: 'Camisetas',
        price: 92000,
        costPrice: 45000,
        comparePrice: 0,
        description: 'Camiseta tipo polo en tejido de punto texturizado con cuello abierto sin botones. El equilibrio perfecto entre elegancia masculina y frescura moderna.',
        sizes: ['S', 'M', 'L', 'XL'],
        colors: [
          { name: 'Crema', hex: '#F3E5AB' },
          { name: 'Negro', hex: '#151515' },
          { name: 'Terracota Oscuro', hex: '#7C3F2C' }
        ],
        images: [
          'https://images.unsplash.com/photo-1626497764746-6dc36546b388?auto=format&fit=crop&w=900&q=85',
          'https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?auto=format&fit=crop&w=900&q=85'
        ],
        badge: 'NUEVO',
        stock: 22,
        minStockAlert: 4,
        featured: 0
      },

      // ==================== VALEN SHOP (MUJER) ====================
      {
        sku: 'VL-VES-001',
        name: 'Vestido Midi Satinado "Aura"',
        brand: 'valenshop',
        category: 'Vestidos y Enterizos',
        price: 145000,
        costPrice: 70000,
        comparePrice: 175000,
        description: 'Vestido midi de caída fluida con acabado satinado sutil, escote drapeado y tiras ajustables. Inspirado en la elegancia natural de Studio F para eventos o cenas especiales.',
        sizes: ['XS', 'S', 'M', 'L'],
        colors: [
          { name: 'Champagne Dorado', hex: '#E6D2B5' },
          { name: 'Rosa Palo', hex: '#D8A7B1' },
          { name: 'Negro Noche', hex: '#1A1A1D' }
        ],
        images: [
          'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=900&q=85',
          'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=900&q=85'
        ],
        badge: 'MÁS VENDIDO',
        stock: 16,
        minStockAlert: 3,
        featured: 1
      },
      {
        sku: 'VL-SET-002',
        name: 'Conjunto Sastre Lino "Valen Studio" (Chaleco + Pantalón)',
        brand: 'valenshop',
        category: 'Conjuntos',
        price: 168000,
        costPrice: 82000,
        comparePrice: 195000,
        description: 'Set femenino de dos piezas compuesto por chaleco sastre entallado con botones nacarados y pantalón Palazzo de tiro alto que estiliza la figura con total comodidad.',
        sizes: ['XS', 'S', 'M', 'L'],
        colors: [
          { name: 'Arena Natural', hex: '#E3DAC9' },
          { name: 'Blanco Puro', hex: '#FFFFFF' },
          { name: 'Mocha Suave', hex: '#9E7B66' }
        ],
        images: [
          'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=85',
          'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=900&q=85'
        ],
        badge: 'NUEVO',
        stock: 15,
        minStockAlert: 3,
        featured: 1
      },
      {
        sku: 'VL-BLU-003',
        name: 'Blusa Romántica Manga Abullonada "Lumière"',
        brand: 'valenshop',
        category: 'Blusas y Tops',
        price: 89000,
        costPrice: 42000,
        comparePrice: 108000,
        description: 'Blusa femenina con detalles delicados en bordado suizo, mangas globo sutiles y escote en V favorecedor. Perfecta para combinar con jeans de tiro alto o faldas.',
        sizes: ['XS', 'S', 'M', 'L'],
        colors: [
          { name: 'Blanco Marfil', hex: '#FDFBF7' },
          { name: 'Rosa Emporio', hex: '#E8C5C8' },
          { name: 'Celeste Brisa', hex: '#C4DCE8' }
        ],
        images: [
          'https://images.unsplash.com/photo-1551163943-3f6a855d1153?auto=format&fit=crop&w=900&q=85',
          'https://images.unsplash.com/photo-1564257631407-4deb1f99d992?auto=format&fit=crop&w=900&q=85'
        ],
        badge: 'NUEVO',
        stock: 25,
        minStockAlert: 4,
        featured: 1
      },
      {
        sku: 'VL-JNS-004',
        name: 'Jean Wide Leg Tiro Alto "Sculpt"',
        brand: 'valenshop',
        category: 'Jeans y Pantalones',
        price: 135000,
        costPrice: 65000,
        comparePrice: 155000,
        description: 'Jean femenino corte Wide Leg de tiro súper alto con horma perfecta que realza la silueta y alarga visualmente las piernas. Denim suave de alta elongación.',
        sizes: ['6', '8', '10', '12', '14'],
        colors: [
          { name: 'Azul Claro', hex: '#7DA2C1' },
          { name: 'Azul Clásico', hex: '#2B4C7E' },
          { name: 'Blanco', hex: '#F9F9F9' }
        ],
        images: [
          'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=900&q=85',
          'https://images.unsplash.com/photo-1584370848010-d7fe6bc767ec?auto=format&fit=crop&w=900&q=85'
        ],
        badge: 'MÁS VENDIDO',
        stock: 20,
        minStockAlert: 4,
        featured: 1
      },
      {
        sku: 'VL-BLZ-005',
        name: 'Blazer Estructurado "Valen Chic"',
        brand: 'valenshop',
        category: 'Chaquetas y Blazers',
        price: 159000,
        costPrice: 78000,
        comparePrice: 189000,
        description: 'Blazer femenino forrado con corte estilizado, hombreras ligeras y botones dorados mate. Una prenda infaltable para proyectar seguridad y sofisticación.',
        sizes: ['XS', 'S', 'M', 'L'],
        colors: [
          { name: 'Camel', hex: '#C19A6B' },
          { name: 'Negro', hex: '#141414' },
          { name: 'Blanco Hueso', hex: '#F4F0EA' }
        ],
        images: [
          'https://images.unsplash.com/photo-1591369822096-ffd140ec948f?auto=format&fit=crop&w=900&q=85',
          'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=900&q=85'
        ],
        badge: 'SALE',
        stock: 10,
        minStockAlert: 3,
        featured: 1
      },
      {
        sku: 'VL-VES-006',
        name: 'Vestido Corto Bohemio "Solsticio"',
        brand: 'valenshop',
        category: 'Vestidos y Enterizos',
        price: 122000,
        costPrice: 59000,
        comparePrice: 0,
        description: 'Vestido fresco con cintura entallada y falda en movimiento. Ideal para días soleados, salidas de fin de semana y momentos donde quieres lucir natural y hermosa.',
        sizes: ['XS', 'S', 'M', 'L'],
        colors: [
          { name: 'Terracota Floral', hex: '#C66B53' },
          { name: 'Verde Salvia', hex: '#8F9779' }
        ],
        images: [
          'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=900&q=85',
          'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=900&q=85'
        ],
        badge: 'NUEVO',
        stock: 18,
        minStockAlert: 3,
        featured: 0
      }
    ];

    const insertProduct = db.prepare(`
      INSERT INTO products (sku, name, brand, category, price, costPrice, comparePrice, description, sizes, colors, images, badge, stock, minStockAlert, featured, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    for (const p of seedProducts) {
      insertProduct.run(
        p.sku,
        p.name,
        p.brand,
        p.category,
        p.price,
        p.costPrice,
        p.comparePrice,
        p.description,
        JSON.stringify(p.sizes),
        JSON.stringify(p.colors),
        JSON.stringify(p.images),
        p.badge,
        p.stock,
        p.minStockAlert,
        p.featured
      );
    }
  } else {
    // Asegurar SKU y costPrice en productos existentes que no los tengan
    const allProds = db.prepare('SELECT id, brand, price, sku, costPrice FROM products').all();
    const updateMeta = db.prepare('UPDATE products SET sku = ?, costPrice = ? WHERE id = ?');
    for (const p of allProds) {
      const prefix = p.brand === 'valenshop' ? 'VL' : 'VS';
      const sku = p.sku && p.sku.trim() ? p.sku : `${prefix}-PRD-${String(p.id).padStart(3, '0')}`;
      const costPrice = p.costPrice && p.costPrice > 0 ? p.costPrice : Math.round((p.price || 0) * 0.48);
      updateMeta.run(sku, costPrice, p.id);
    }
  }

  // Semilla de Cupones de Descuento
  const existingCoupons = db.prepare('SELECT COUNT(*) as count FROM coupons').get();
  if (existingCoupons.count === 0) {
    const seedCoupons = [
      { code: 'BIENVENIDA10', type: 'PERCENT', value: 10, minPurchase: 80000, brand: 'all', maxUses: 100, expiresAt: '2027-12-31' },
      { code: 'VARO15', type: 'PERCENT', value: 15, minPurchase: 120000, brand: 'varostyle', maxUses: 50, expiresAt: '2027-12-31' },
      { code: 'VALEN15', type: 'PERCENT', value: 15, minPurchase: 120000, brand: 'valenshop', maxUses: 50, expiresAt: '2027-12-31' },
      { code: 'ENVIOGRATIS', type: 'FREE_SHIPPING', value: 0, minPurchase: 100000, brand: 'all', maxUses: 0, expiresAt: '2027-12-31' }
    ];
    const insertCoupon = db.prepare(`
      INSERT INTO coupons (code, type, value, minPurchase, brand, maxUses, usedCount, expiresAt, active)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, 1)
    `);
    for (const c of seedCoupons) {
      insertCoupon.run(c.code, c.type, c.value, c.minPurchase, c.brand, c.maxUses, c.expiresAt);
    }
  }

  // Semilla de Zonas y Tarifas de Envío
  const existingZones = db.prepare('SELECT COUNT(*) as count FROM shipping_zones').get();
  if (existingZones.count === 0) {
    const seedZones = [
      {
        name: 'Ciudades Principales (Bogotá, Medellín, Cali, Barranquilla, Bucaramanga)',
        departments: 'Cundinamarca, Antioquia, Valle del Cauca, Atlántico, Santander',
        price: 12000,
        freeThreshold: 200000,
        estimatedDays: '1 a 3 días hábiles',
        allowCod: 1
      },
      {
        name: 'Resto del País (Ciudades Intermedias y Municipios)',
        departments: 'Nacional / Otros Departamentos',
        price: 16000,
        freeThreshold: 220000,
        estimatedDays: '3 a 5 días hábiles',
        allowCod: 1
      },
      {
        name: 'Domicilio Express Local / Recogida Acordada',
        departments: 'Entrega Local',
        price: 7000,
        freeThreshold: 150000,
        estimatedDays: 'Mismo día o día siguiente',
        allowCod: 1
      }
    ];
    const insertZone = db.prepare(`
      INSERT INTO shipping_zones (name, departments, price, freeThreshold, estimatedDays, allowCod, active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);
    for (const z of seedZones) {
      insertZone.run(z.name, z.departments, z.price, z.freeThreshold, z.estimatedDays, z.allowCod);
    }
  }
}

initDatabase();

// Helpers de parseo
function parseProduct(row) {
  if (!row) return null;
  return {
    ...row,
    price: Number(row.price || 0),
    costPrice: Number(row.costPrice || 0),
    comparePrice: Number(row.comparePrice || 0),
    stock: Number(row.stock ?? 0),
    minStockAlert: Number(row.minStockAlert ?? 3),
    sizes: JSON.parse(row.sizes || '[]'),
    colors: JSON.parse(row.colors || '[]'),
    images: JSON.parse(row.images || '[]'),
    featured: Boolean(row.featured),
    active: Boolean(row.active)
  };
}

function parseOrder(row) {
  if (!row) return null;
  return {
    ...row,
    subtotal: Number(row.subtotal || 0),
    discount: Number(row.discount || 0),
    shipping: Number(row.shipping || 0),
    total: Number(row.total || 0),
    totalCost: Number(row.totalCost || 0),
    stockDeducted: Boolean(row.stockDeducted),
    items: JSON.parse(row.items || '[]')
  };
}

function logInventoryMovement({ productId, productName, sku, type, quantity, previousStock, newStock, note }) {
  try {
    db.prepare(`
      INSERT INTO inventory_movements (productId, productName, sku, type, quantity, previousStock, newStock, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      Number(productId),
      productName || '',
      sku || '',
      type,
      Number(quantity),
      Number(previousStock),
      Number(newStock),
      note || ''
    );
  } catch (e) {
    console.warn('Error registrando kardex:', e.message);
  }
}

// Sincronizar o crear cliente automáticamente cuando entra un pedido
function syncCustomerFromOrder({ customerName, customerDoc, customerPhone, customerEmail, department, city, address, orderTotal }) {
  if (!customerPhone && !customerName) return 0;
  const cleanPhone = String(customerPhone || '').replace(/\D/g, '');
  let existing = null;
  if (cleanPhone) {
    existing = db.prepare("SELECT * FROM customers WHERE REPLACE(REPLACE(phone, ' ', ''), '+', '') LIKE ?").get(`%${cleanPhone.slice(-10)}%`);
  }
  if (!existing && customerDoc) {
    existing = db.prepare('SELECT * FROM customers WHERE doc = ? AND doc != ""').get(String(customerDoc).trim());
  }

  const amount = Number(orderTotal || 0);
  if (existing) {
    const newOrders = Number(existing.totalOrders || 0) + 1;
    const newSpent = Number(existing.totalSpent || 0) + amount;
    let segment = existing.segment || 'Nuevo';
    if (newSpent >= 500000 || newOrders >= 4) segment = 'VIP';
    else if (newOrders >= 2) segment = 'Frecuente';

    db.prepare(`
      UPDATE customers
      SET name = ?, doc = COALESCE(NULLIF(?, ''), doc), email = COALESCE(NULLIF(?, ''), email),
          department = COALESCE(NULLIF(?, ''), department), city = COALESCE(NULLIF(?, ''), city),
          address = COALESCE(NULLIF(?, ''), address), segment = ?,
          totalOrders = ?, totalSpent = ?, lastOrderAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      customerName || existing.name,
      customerDoc || '',
      customerEmail || '',
      department || '',
      city || '',
      address || '',
      segment,
      newOrders,
      newSpent,
      existing.id
    );
    return existing.id;
  } else {
    const segment = amount >= 450000 ? 'VIP' : 'Nuevo';
    const res = db.prepare(`
      INSERT INTO customers (name, doc, phone, email, department, city, address, segment, totalOrders, totalSpent, lastOrderAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
    `).run(
      customerName || 'Cliente V&V',
      customerDoc || '',
      customerPhone || '',
      customerEmail || '',
      department || '',
      city || '',
      address || '',
      segment,
      amount
    );
    return Number(res.lastInsertRowid);
  }
}

// ============================================================================
// 1. BOOTSTRAP & RESUMEN EJECUTIVO ADMIN
// ============================================================================

app.get('/api/bootstrap', (req, res) => {
  try {
    const settingsRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('store_config');
    const settings = settingsRow ? JSON.parse(settingsRow.value) : {};
    // Por seguridad, no exponer adminPin en el bootstrap público si no se solicita
    const publicSettings = { ...settings };
    const products = db.prepare('SELECT * FROM products ORDER BY id DESC').all().map(parseProduct);
    const categories = db.prepare('SELECT * FROM categories WHERE active = 1 ORDER BY sortOrder ASC, id ASC').all();
    const banners = db.prepare('SELECT * FROM banners WHERE active = 1 ORDER BY sortOrder ASC, id ASC').all();
    const shippingZones = db.prepare('SELECT * FROM shipping_zones WHERE active = 1 ORDER BY id ASC').all();

    res.json({ settings: publicSettings, products, categories, banners, shippingZones });
  } catch (err) {
    console.error('Error en /api/bootstrap:', err);
    res.status(500).json({ error: 'Error al cargar datos de la tienda' });
  }
});

app.post('/api/admin/login', (req, res) => {
  try {
    const { pin } = req.body;
    const settingsRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('store_config');
    const settings = settingsRow ? JSON.parse(settingsRow.value) : {};
    const validPin = String(settings.adminPin || '1234').trim();
    if (String(pin || '').trim() === validPin) {
      return res.json({ success: true, token: Buffer.from(`vvstudio:${validPin}`).toString('base64') });
    }
    return res.status(401).json({ error: 'PIN de administrador incorrecto' });
  } catch (err) {
    res.status(500).json({ error: 'Error al verificar credenciales' });
  }
});

app.get('/api/admin/overview', (req, res) => {
  try {
    const settingsRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('store_config');
    const settings = settingsRow ? JSON.parse(settingsRow.value) : {};
    const products = db.prepare('SELECT * FROM products ORDER BY id DESC').all().map(parseProduct);
    const categories = db.prepare('SELECT * FROM categories ORDER BY sortOrder ASC, id ASC').all();
    const customers = db.prepare('SELECT * FROM customers ORDER BY totalSpent DESC, id DESC').all();
    const orders = db.prepare('SELECT * FROM orders ORDER BY id DESC').all().map(parseOrder);
    const coupons = db.prepare('SELECT * FROM coupons ORDER BY id DESC').all();
    const shippingZones = db.prepare('SELECT * FROM shipping_zones ORDER BY id ASC').all();
    const expenses = db.prepare('SELECT * FROM expenses ORDER BY date DESC, id DESC').all();
    const banners = db.prepare('SELECT * FROM banners ORDER BY sortOrder ASC, id ASC').all();
    const recentMovements = db.prepare('SELECT * FROM inventory_movements ORDER BY id DESC LIMIT 100').all();

    // Cálculo de KPIs Financieros Reales
    const validOrders = orders.filter(o => o.status !== 'Cancelado');
    const grossRevenue = validOrders.reduce((acc, o) => acc + Number(o.total || 0), 0);
    const totalShippingCollected = validOrders.reduce((acc, o) => acc + Number(o.shipping || 0), 0);
    const totalDiscountsGiven = validOrders.reduce((acc, o) => acc + Number(o.discount || 0), 0);

    // Costo de mercancía vendida (COGS)
    let totalCogs = 0;
    const productSalesMap = {};
    let varoRevenue = 0;
    let valenRevenue = 0;

    for (const ord of validOrders) {
      let ordCost = Number(ord.totalCost || 0);
      for (const item of ord.items || []) {
        const qty = Number(item.quantity || 1);
        const itemPrice = Number(item.price || 0) * qty;
        const prod = products.find(p => p.id === Number(item.productId));
        const unitCost = Number(item.costPrice || (prod ? prod.costPrice : Math.round((item.price || 0) * 0.48)));
        if (!ord.totalCost) {
          ordCost += unitCost * qty;
        }
        const brand = item.brand || (prod ? prod.brand : 'varostyle');
        if (brand === 'valenshop') valenRevenue += itemPrice;
        else varoRevenue += itemPrice;

        const key = item.productId || item.name;
        if (!productSalesMap[key]) {
          productSalesMap[key] = {
            id: item.productId,
            name: item.name,
            brand,
            image: item.image || (prod && prod.images[0]) || '',
            unitsSold: 0,
            revenue: 0
          };
        }
        productSalesMap[key].unitsSold += qty;
        productSalesMap[key].revenue += itemPrice;
      }
      totalCogs += ordCost;
    }

    const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
    const netProfit = grossRevenue - totalCogs - totalExpenses;
    const avgTicket = validOrders.length > 0 ? Math.round(grossRevenue / validOrders.length) : 0;

    const totalInventoryUnits = products.reduce((acc, p) => acc + Number(p.stock || 0), 0);
    const inventoryCostValue = products.reduce((acc, p) => acc + Number(p.stock || 0) * Number(p.costPrice || 0), 0);
    const inventoryRetailValue = products.reduce((acc, p) => acc + Number(p.stock || 0) * Number(p.price || 0), 0);

    const lowStockProducts = products.filter(p => p.stock <= (p.minStockAlert || 3));
    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, 6);

    res.json({
      settings,
      products,
      categories,
      customers,
      orders,
      coupons,
      shippingZones,
      expenses,
      banners,
      recentMovements,
      kpis: {
        grossRevenue,
        totalCogs,
        totalExpenses,
        netProfit,
        avgTicket,
        totalShippingCollected,
        totalDiscountsGiven,
        validOrdersCount: validOrders.length,
        pendingOrdersCount: orders.filter(o => o.status === 'Pendiente').length,
        varoRevenue,
        valenRevenue,
        totalInventoryUnits,
        inventoryCostValue,
        inventoryRetailValue,
        lowStockCount: lowStockProducts.length,
        topProducts
      }
    });
  } catch (err) {
    console.error('Error en /api/admin/overview:', err);
    res.status(500).json({ error: 'Error cargando resumen administrativo' });
  }
});

// ============================================================================
// 2. SUBIDA HÍBRIDA DE IMÁGENES (PERSISTENTE EN LOCAL Y SERVERLESS / VERCEL)
// ============================================================================

app.post('/api/upload', upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se enviaron archivos' });
    }
    const urls = req.files.map(file => {
      // En Vercel Serverless (/tmp es efímero entre invocaciones), convertir archivos <= 4MB a Data URL Base64
      // para que queden guardados permanentemente en SQLite / JSON Backup
      if (isVercel || req.query.base64 === '1') {
        try {
          const buffer = fs.readFileSync(file.path);
          if (buffer.length <= 4 * 1024 * 1024) {
            const mime = file.mimetype || 'image/jpeg';
            return `data:${mime};base64,${buffer.toString('base64')}`;
          }
        } catch (e) {
          console.warn('Fallback a ruta de archivo:', e.message);
        }
      }
      return `/uploads/${file.filename}`;
    });
    res.json({ success: true, urls });
  } catch (err) {
    console.error('Error subiendo archivos:', err);
    res.status(500).json({ error: 'Error al subir imagen' });
  }
});

// ============================================================================
// 3. CRUD DE PRODUCTOS Y KARDEX DE INVENTARIO
// ============================================================================

app.get('/api/products', (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY id DESC').all();
  res.json(rows.map(parseProduct));
});

app.post('/api/products', (req, res) => {
  try {
    const {
      sku = '',
      name,
      brand = 'varostyle',
      category = 'Camisetas',
      price = 0,
      costPrice = 0,
      comparePrice = 0,
      description = '',
      sizes = ['S', 'M', 'L'],
      colors = [{ name: 'Negro', hex: '#111111' }],
      images = [],
      badge = '',
      stock = 10,
      minStockAlert = 3,
      featured = true,
      active = true
    } = req.body;

    const cleanPrice = Number(price || 0);
    const cleanCost = Number(costPrice || Math.round(cleanPrice * 0.48));
    const prefix = brand === 'valenshop' ? 'VL' : 'VS';
    const finalSku = sku && sku.trim() ? sku.trim().toUpperCase() : `${prefix}-${Date.now().toString().slice(-5)}`;

    const result = db.prepare(`
      INSERT INTO products (sku, name, brand, category, price, costPrice, comparePrice, description, sizes, colors, images, badge, stock, minStockAlert, featured, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      finalSku,
      name,
      brand,
      category,
      cleanPrice,
      cleanCost,
      Number(comparePrice || 0),
      description,
      JSON.stringify(sizes),
      JSON.stringify(colors),
      JSON.stringify(images),
      badge,
      Number(stock),
      Number(minStockAlert ?? 3),
      featured ? 1 : 0,
      active ? 1 : 0
    );

    const newId = Number(result.lastInsertRowid);
    logInventoryMovement({
      productId: newId,
      productName: name,
      sku: finalSku,
      type: 'IN_PURCHASE',
      quantity: Number(stock),
      previousStock: 0,
      newStock: Number(stock),
      note: 'Inventario inicial al crear producto'
    });

    const created = db.prepare('SELECT * FROM products WHERE id = ?').get(newId);
    res.status(201).json(parseProduct(created));
  } catch (err) {
    console.error('Error creando producto:', err);
    res.status(500).json({ error: 'No se pudo crear el producto' });
  }
});

app.put('/api/products/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

    const {
      sku,
      name,
      brand,
      category,
      price,
      costPrice,
      comparePrice,
      description,
      sizes,
      colors,
      images,
      badge,
      stock,
      minStockAlert,
      featured,
      active
    } = req.body;

    const prevStock = Number(existing.stock || 0);
    const nextStock = stock !== undefined ? Number(stock) : prevStock;

    db.prepare(`
      UPDATE products
      SET sku = ?, name = ?, brand = ?, category = ?, price = ?, costPrice = ?, comparePrice = ?, description = ?,
          sizes = ?, colors = ?, images = ?, badge = ?, stock = ?, minStockAlert = ?, featured = ?, active = ?
      WHERE id = ?
    `).run(
      sku !== undefined ? String(sku).trim().toUpperCase() : existing.sku,
      name ?? existing.name,
      brand ?? existing.brand,
      category ?? existing.category,
      price !== undefined ? Number(price) : existing.price,
      costPrice !== undefined ? Number(costPrice) : existing.costPrice,
      comparePrice !== undefined ? Number(comparePrice) : existing.comparePrice,
      description ?? existing.description,
      sizes ? JSON.stringify(sizes) : existing.sizes,
      colors ? JSON.stringify(colors) : existing.colors,
      images ? JSON.stringify(images) : existing.images,
      badge ?? existing.badge,
      nextStock,
      minStockAlert !== undefined ? Number(minStockAlert) : existing.minStockAlert,
      featured !== undefined ? (featured ? 1 : 0) : existing.featured,
      active !== undefined ? (active ? 1 : 0) : existing.active,
      id
    );

    if (nextStock !== prevStock) {
      logInventoryMovement({
        productId: id,
        productName: name ?? existing.name,
        sku: sku ?? existing.sku,
        type: 'ADJUSTMENT',
        quantity: nextStock - prevStock,
        previousStock: prevStock,
        newStock: nextStock,
        note: 'Actualización desde edición de ficha de producto'
      });
    }

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.json(parseProduct(updated));
  } catch (err) {
    console.error('Error actualizando producto:', err);
    res.status(500).json({ error: 'No se pudo actualizar el producto' });
  }
});

app.post('/api/products/:id/duplicate', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

    const prefix = existing.brand === 'valenshop' ? 'VL' : 'VS';
    const newSku = `${prefix}-COPY-${Date.now().toString().slice(-4)}`;
    const newName = `${existing.name} (Copia)`;

    const result = db.prepare(`
      INSERT INTO products (sku, name, brand, category, price, costPrice, comparePrice, description, sizes, colors, images, badge, stock, minStockAlert, featured, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newSku,
      newName,
      existing.brand,
      existing.category,
      existing.price,
      existing.costPrice || 0,
      existing.comparePrice || 0,
      existing.description,
      existing.sizes,
      existing.colors,
      existing.images,
      existing.badge,
      existing.stock,
      existing.minStockAlert || 3,
      existing.featured,
      existing.active
    );

    const created = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(parseProduct(created));
  } catch (err) {
    console.error('Error duplicando producto:', err);
    res.status(500).json({ error: 'No se pudo duplicar el producto' });
  }
});

app.patch('/api/products/:id/stock', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

    const { delta, setStock, type = 'ADJUSTMENT', note = 'Ajuste rápido en tabla' } = req.body;
    const prevStock = Number(existing.stock || 0);
    let newStock = prevStock;
    if (setStock !== undefined) {
      newStock = Math.max(0, Number(setStock));
    } else if (delta !== undefined) {
      newStock = Math.max(0, prevStock + Number(delta));
    }

    db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, id);
    logInventoryMovement({
      productId: id,
      productName: existing.name,
      sku: existing.sku,
      type,
      quantity: newStock - prevStock,
      previousStock: prevStock,
      newStock,
      note
    });

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.json(parseProduct(updated));
  } catch (err) {
    res.status(500).json({ error: 'No se pudo ajustar el stock' });
  }
});

app.get('/api/products/:id/movements', (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = db.prepare('SELECT * FROM inventory_movements WHERE productId = ? ORDER BY id DESC LIMIT 100').all(id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo movimientos del producto' });
  }
});

app.get('/api/inventory/movements', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM inventory_movements ORDER BY id DESC LIMIT 200').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo kardex general' });
  }
});

app.delete('/api/products/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    db.prepare('DELETE FROM inventory_movements WHERE productId = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error eliminando producto:', err);
    res.status(500).json({ error: 'No se pudo eliminar el producto' });
  }
});

// ============================================================================
// 4. CRUD DE CATEGORÍAS Y COLECCIONES
// ============================================================================

app.get('/api/categories', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM categories ORDER BY sortOrder ASC, id ASC').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo categorías' });
  }
});

app.post('/api/categories', (req, res) => {
  try {
    const { name, brand = 'all', description = '', sortOrder = 10, active = true } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre de la categoría es obligatorio' });
    const cleanName = name.trim();
    const result = db.prepare(`
      INSERT INTO categories (name, slug, brand, description, sortOrder, active)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(cleanName, slugify(cleanName), brand, description, Number(sortOrder || 10), active ? 1 : 0);

    const created = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo crear la categoría' });
  }
});

app.put('/api/categories/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Categoría no encontrada' });

    const { name, brand, description, sortOrder, active } = req.body;
    const nextName = name ? name.trim() : existing.name;

    db.prepare(`
      UPDATE categories
      SET name = ?, slug = ?, brand = ?, description = ?, sortOrder = ?, active = ?
      WHERE id = ?
    `).run(
      nextName,
      slugify(nextName),
      brand ?? existing.brand,
      description ?? existing.description,
      sortOrder !== undefined ? Number(sortOrder) : existing.sortOrder,
      active !== undefined ? (active ? 1 : 0) : existing.active,
      id
    );

    // Si cambió el nombre de la categoría, actualizar los productos asociados
    if (nextName !== existing.name) {
      db.prepare('UPDATE products SET category = ? WHERE category = ?').run(nextName, existing.name);
    }

    const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo actualizar la categoría' });
  }
});

app.delete('/api/categories/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (existing) {
      db.prepare("UPDATE products SET category = 'General' WHERE category = ?").run(existing.name);
      db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo eliminar la categoría' });
  }
});

// ============================================================================
// 5. CRUD DE CLIENTES (CRM 360°)
// ============================================================================

app.get('/api/customers', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM customers ORDER BY totalSpent DESC, id DESC').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo clientes' });
  }
});

app.get('/api/customers/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });

    const cleanPhone = String(customer.phone || '').replace(/\D/g, '').slice(-10);
    let orders = [];
    if (cleanPhone) {
      orders = db
        .prepare("SELECT * FROM orders WHERE customerId = ? OR REPLACE(REPLACE(customerPhone, ' ', ''), '+', '') LIKE ? ORDER BY id DESC")
        .all(id, `%${cleanPhone}%`)
        .map(parseOrder);
    } else {
      orders = db.prepare('SELECT * FROM orders WHERE customerId = ? ORDER BY id DESC').all(id).map(parseOrder);
    }

    res.json({ ...customer, orders });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo expediente del cliente' });
  }
});

app.post('/api/customers', (req, res) => {
  try {
    const {
      name,
      doc = '',
      phone,
      email = '',
      department = '',
      city = '',
      address = '',
      neighborhood = '',
      segment = 'Nuevo',
      notes = ''
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Nombre y WhatsApp son obligatorios' });
    }

    const result = db.prepare(`
      INSERT INTO customers (name, doc, phone, email, department, city, address, neighborhood, segment, notes, totalOrders, totalSpent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
    `).run(name.trim(), doc.trim(), phone.trim(), email.trim(), department, city, address, neighborhood, segment, notes);

    const created = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo registrar el cliente' });
  }
});

app.put('/api/customers/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Cliente no encontrado' });

    const {
      name,
      doc,
      phone,
      email,
      department,
      city,
      address,
      neighborhood,
      segment,
      notes,
      totalOrders,
      totalSpent
    } = req.body;

    db.prepare(`
      UPDATE customers
      SET name = ?, doc = ?, phone = ?, email = ?, department = ?, city = ?, address = ?,
          neighborhood = ?, segment = ?, notes = ?, totalOrders = ?, totalSpent = ?
      WHERE id = ?
    `).run(
      name ?? existing.name,
      doc ?? existing.doc,
      phone ?? existing.phone,
      email ?? existing.email,
      department ?? existing.department,
      city ?? existing.city,
      address ?? existing.address,
      neighborhood ?? existing.neighborhood,
      segment ?? existing.segment,
      notes ?? existing.notes,
      totalOrders !== undefined ? Number(totalOrders) : existing.totalOrders,
      totalSpent !== undefined ? Number(totalSpent) : existing.totalSpent,
      id
    );

    const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo actualizar el cliente' });
  }
});

app.delete('/api/customers/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo eliminar el cliente' });
  }
});

// ============================================================================
// 6. CRUD DE PEDIDOS, POS (VENTA MANUAL), GUÍAS Y REVERSIÓN DE INVENTARIO
// ============================================================================

app.get('/api/orders', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
    res.json(rows.map(parseOrder));
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo pedidos' });
  }
});

app.get('/api/orders/track/:orderNumber', (req, res) => {
  try {
    const code = req.params.orderNumber.trim().toUpperCase();
    const row = db.prepare('SELECT * FROM orders WHERE UPPER(orderNumber) = ?').get(code);
    if (!row) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(parseOrder(row));
  } catch (err) {
    res.status(500).json({ error: 'Error buscando el pedido' });
  }
});

app.post('/api/orders', (req, res) => {
  try {
    const {
      channel = 'WEB',
      customerName,
      customerDoc = '',
      customerPhone,
      customerEmail = '',
      department = '',
      city = 'Por definir',
      address = 'Por definir',
      notes = '',
      paymentMethod = 'nequi',
      paymentStatus,
      paymentReference = '',
      paymentReceipt = '',
      items = [],
      subtotal = 0,
      couponCode = '',
      discount = 0,
      shipping = 0,
      total = 0,
      status,
      carrier = '',
      trackingNumber = ''
    } = req.body;

    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `VS-${randomDigits}`;

    const initialStatus = status || (paymentMethod === 'pse_card' || paymentMethod === 'efectivo' ? 'Pagado' : 'Pendiente');
    const initialPayStatus = paymentStatus || (initialStatus === 'Pagado' || initialStatus === 'Entregado' ? 'Pagado' : 'Pendiente');

    // Enriquecer items con su costo unitario actual para reportes exactos de utilidad
    let calculatedTotalCost = 0;
    const enrichedItems = (items || []).map(item => {
      const prod = item.productId ? db.prepare('SELECT * FROM products WHERE id = ?').get(Number(item.productId)) : null;
      const unitCost = Number(item.costPrice ?? (prod ? prod.costPrice : Math.round(Number(item.price || 0) * 0.48)));
      const qty = Number(item.quantity || 1);
      calculatedTotalCost += unitCost * qty;
      return {
        ...item,
        sku: item.sku || (prod ? prod.sku : ''),
        brand: item.brand || (prod ? prod.brand : 'varostyle'),
        costPrice: unitCost
      };
    });

    const customerId = syncCustomerFromOrder({
      customerName,
      customerDoc,
      customerPhone,
      customerEmail,
      department,
      city,
      address,
      orderTotal: total
    });

    const result = db.prepare(`
      INSERT INTO orders (
        orderNumber, customerId, channel, customerName, customerDoc, customerPhone, customerEmail,
        department, city, address, notes, paymentMethod, paymentStatus, paymentReference,
        paymentReceipt, items, subtotal, couponCode, discount, shipping, total, totalCost,
        status, carrier, trackingNumber, stockDeducted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      orderNumber,
      customerId,
      channel,
      customerName,
      customerDoc,
      customerPhone,
      customerEmail,
      department,
      city,
      address,
      notes,
      paymentMethod,
      initialPayStatus,
      paymentReference,
      paymentReceipt,
      JSON.stringify(enrichedItems),
      Number(subtotal),
      couponCode ? String(couponCode).trim().toUpperCase() : '',
      Number(discount || 0),
      Number(shipping),
      Number(total),
      calculatedTotalCost,
      initialStatus,
      carrier,
      trackingNumber
    );

    // Descontar stock y registrar en Kardex
    for (const item of enrichedItems) {
      if (item.productId) {
        const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(item.productId));
        if (prod) {
          const prevStock = Number(prod.stock || 0);
          const qty = Number(item.quantity || 1);
          const newStock = Math.max(0, prevStock - qty);
          db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, prod.id);
          logInventoryMovement({
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            type: 'OUT_SALE',
            quantity: -qty,
            previousStock: prevStock,
            newStock,
            note: `Venta pedido ${orderNumber} (${channel})`
          });
        }
      }
    }

    // Si usó cupón, incrementar usedCount
    if (couponCode) {
      db.prepare('UPDATE coupons SET usedCount = usedCount + 1 WHERE UPPER(code) = ?').run(
        String(couponCode).trim().toUpperCase()
      );
    }

    const created = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(parseOrder(created));
  } catch (err) {
    console.error('Error creando pedido:', err);
    res.status(500).json({ error: 'Error al registrar el pedido' });
  }
});

// Función auxiliar para manejar reversión o re-descuento de stock cuando un pedido cambia a/desde Cancelado
function handleOrderStockTransition(orderRow, nextStatus) {
  const wasDeducted = Boolean(orderRow.stockDeducted);
  const items = JSON.parse(orderRow.items || '[]');

  if (nextStatus === 'Cancelado' && wasDeducted) {
    for (const item of items) {
      if (item.productId) {
        const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(item.productId));
        if (prod) {
          const prevStock = Number(prod.stock || 0);
          const qty = Number(item.quantity || 1);
          const newStock = prevStock + qty;
          db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, prod.id);
          logInventoryMovement({
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            type: 'RETURN',
            quantity: qty,
            previousStock: prevStock,
            newStock,
            note: `Reversión automática por cancelación de pedido ${orderRow.orderNumber}`
          });
        }
      }
    }
    db.prepare('UPDATE orders SET stockDeducted = 0 WHERE id = ?').run(orderRow.id);
  } else if (nextStatus !== 'Cancelado' && !wasDeducted) {
    for (const item of items) {
      if (item.productId) {
        const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(item.productId));
        if (prod) {
          const prevStock = Number(prod.stock || 0);
          const qty = Number(item.quantity || 1);
          const newStock = Math.max(0, prevStock - qty);
          db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, prod.id);
          logInventoryMovement({
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            type: 'OUT_SALE',
            quantity: -qty,
            previousStock: prevStock,
            newStock,
            note: `Reactivación de pedido ${orderRow.orderNumber}`
          });
        }
      }
    }
    db.prepare('UPDATE orders SET stockDeducted = 1 WHERE id = ?').run(orderRow.id);
  }
}

app.put('/api/orders/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Pedido no encontrado' });

    const {
      channel,
      customerName,
      customerDoc,
      customerPhone,
      customerEmail,
      department,
      city,
      address,
      notes,
      paymentMethod,
      paymentStatus,
      paymentReference,
      status,
      carrier,
      trackingNumber,
      shipping,
      discount,
      total
    } = req.body;

    const nextStatus = status ?? existing.status;
    handleOrderStockTransition(existing, nextStatus);

    db.prepare(`
      UPDATE orders
      SET channel = ?, customerName = ?, customerDoc = ?, customerPhone = ?, customerEmail = ?,
          department = ?, city = ?, address = ?, notes = ?, paymentMethod = ?, paymentStatus = ?,
          paymentReference = ?, status = ?, carrier = ?, trackingNumber = ?,
          shipping = ?, discount = ?, total = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      channel ?? existing.channel,
      customerName ?? existing.customerName,
      customerDoc ?? existing.customerDoc,
      customerPhone ?? existing.customerPhone,
      customerEmail ?? existing.customerEmail,
      department ?? existing.department,
      city ?? existing.city,
      address ?? existing.address,
      notes ?? existing.notes,
      paymentMethod ?? existing.paymentMethod,
      paymentStatus ?? existing.paymentStatus,
      paymentReference ?? existing.paymentReference,
      nextStatus,
      carrier ?? existing.carrier,
      trackingNumber ?? existing.trackingNumber,
      shipping !== undefined ? Number(shipping) : existing.shipping,
      discount !== undefined ? Number(discount) : existing.discount,
      total !== undefined ? Number(total) : existing.total,
      id
    );

    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    res.json(parseOrder(updated));
  } catch (err) {
    console.error('Error actualizando pedido:', err);
    res.status(500).json({ error: 'Error actualizando el pedido' });
  }
});

app.put('/api/orders/:id/status', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Pedido no encontrado' });

    const { status, paymentStatus, carrier, trackingNumber } = req.body;
    const nextStatus = status ?? existing.status;
    handleOrderStockTransition(existing, nextStatus);

    const nextPayStatus =
      paymentStatus ||
      (nextStatus === 'Pagado' || nextStatus === 'Entregado' ? 'Pagado' : existing.paymentStatus);

    db.prepare(`
      UPDATE orders
      SET status = ?, paymentStatus = ?, carrier = COALESCE(?, carrier), trackingNumber = COALESCE(?, trackingNumber), updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(nextStatus, nextPayStatus, carrier ?? null, trackingNumber ?? null, id);

    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    res.json(parseOrder(updated));
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando estado del pedido' });
  }
});

app.delete('/api/orders/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (existing) {
      // Si el pedido no estaba cancelado, devolver stock antes de borrar
      handleOrderStockTransition(existing, 'Cancelado');
      db.prepare('DELETE FROM orders WHERE id = ?').run(id);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo eliminar el pedido' });
  }
});

// ============================================================================
// 7. CRUD DE CUPONES DE DESCUENTO & VALIDACIÓN EN CHECKOUT
// ============================================================================

app.get('/api/coupons', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM coupons ORDER BY id DESC').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo cupones' });
  }
});

app.post('/api/coupons', (req, res) => {
  try {
    const {
      code,
      type = 'PERCENT',
      value = 10,
      minPurchase = 0,
      brand = 'all',
      maxUses = 0,
      expiresAt = '',
      active = true
    } = req.body;

    if (!code || !code.trim()) return res.status(400).json({ error: 'El código del cupón es obligatorio' });
    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '');

    const result = db.prepare(`
      INSERT INTO coupons (code, type, value, minPurchase, brand, maxUses, usedCount, expiresAt, active)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      cleanCode,
      type,
      Number(value || 0),
      Number(minPurchase || 0),
      brand,
      Number(maxUses || 0),
      expiresAt || '',
      active ? 1 : 0
    );

    const created = db.prepare('SELECT * FROM coupons WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'El código ya existe o no se pudo crear el cupón' });
  }
});

app.put('/api/coupons/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM coupons WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Cupón no encontrado' });

    const { code, type, value, minPurchase, brand, maxUses, expiresAt, active } = req.body;
    db.prepare(`
      UPDATE coupons
      SET code = ?, type = ?, value = ?, minPurchase = ?, brand = ?, maxUses = ?, expiresAt = ?, active = ?
      WHERE id = ?
    `).run(
      code ? code.trim().toUpperCase() : existing.code,
      type ?? existing.type,
      value !== undefined ? Number(value) : existing.value,
      minPurchase !== undefined ? Number(minPurchase) : existing.minPurchase,
      brand ?? existing.brand,
      maxUses !== undefined ? Number(maxUses) : existing.maxUses,
      expiresAt ?? existing.expiresAt,
      active !== undefined ? (active ? 1 : 0) : existing.active,
      id
    );

    const updated = db.prepare('SELECT * FROM coupons WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo actualizar el cupón' });
  }
});

app.delete('/api/coupons/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM coupons WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo eliminar el cupón' });
  }
});

app.post('/api/coupons/validate', (req, res) => {
  try {
    const { code, subtotal = 0, items = [] } = req.body;
    if (!code) return res.status(400).json({ error: 'Ingresa un código promocional' });

    const cleanCode = String(code).trim().toUpperCase();
    const coupon = db.prepare('SELECT * FROM coupons WHERE UPPER(code) = ?').get(cleanCode);

    if (!coupon || !coupon.active) {
      return res.status(404).json({ error: 'El cupón no existe o no está activo' });
    }

    if (coupon.expiresAt && new Date(coupon.expiresAt + 'T23:59:59') < new Date()) {
      return res.status(400).json({ error: 'Este cupón ha expirado' });
    }

    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
      return res.status(400).json({ error: 'Este cupón alcanzó su límite máximo de usos' });
    }

    if (Number(subtotal) < Number(coupon.minPurchase || 0)) {
      return res.status(400).json({
        error: `Compra mínima de $${Number(coupon.minPurchase).toLocaleString('es-CO')} para usar este cupón`
      });
    }

    if (coupon.brand && coupon.brand !== 'all' && Array.isArray(items) && items.length > 0) {
      const hasMatchingBrand = items.some(i => i.brand === coupon.brand);
      if (!hasMatchingBrand) {
        const brandLabel = coupon.brand === 'valenshop' ? 'Valen Shop' : 'VaroStyle';
        return res.status(400).json({ error: `Este cupón es exclusivo para prendas de ${brandLabel}` });
      }
    }

    let discountAmount = 0;
    let freeShipping = false;

    if (coupon.type === 'PERCENT') {
      discountAmount = Math.round((Number(subtotal) * Number(coupon.value)) / 100);
    } else if (coupon.type === 'FIXED') {
      discountAmount = Math.min(Number(subtotal), Number(coupon.value));
    } else if (coupon.type === 'FREE_SHIPPING') {
      freeShipping = true;
    }

    res.json({
      valid: true,
      coupon,
      discountAmount,
      freeShipping
    });
  } catch (err) {
    res.status(500).json({ error: 'Error validando el cupón' });
  }
});

// ============================================================================
// 8. CRUD DE ZONAS Y TARIFAS DE ENVÍO
// ============================================================================

app.get('/api/shipping-zones', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM shipping_zones ORDER BY id ASC').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo zonas de envío' });
  }
});

app.post('/api/shipping-zones', (req, res) => {
  try {
    const {
      name,
      departments = '',
      price = 12000,
      freeThreshold = 200000,
      estimatedDays = '2 a 4 días hábiles',
      allowCod = true,
      active = true
    } = req.body;

    if (!name) return res.status(400).json({ error: 'El nombre de la zona es obligatorio' });

    const result = db.prepare(`
      INSERT INTO shipping_zones (name, departments, price, freeThreshold, estimatedDays, allowCod, active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, departments, Number(price), Number(freeThreshold), estimatedDays, allowCod ? 1 : 0, active ? 1 : 0);

    const created = db.prepare('SELECT * FROM shipping_zones WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo crear la zona de envío' });
  }
});

app.put('/api/shipping-zones/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM shipping_zones WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Zona no encontrada' });

    const { name, departments, price, freeThreshold, estimatedDays, allowCod, active } = req.body;
    db.prepare(`
      UPDATE shipping_zones
      SET name = ?, departments = ?, price = ?, freeThreshold = ?, estimatedDays = ?, allowCod = ?, active = ?
      WHERE id = ?
    `).run(
      name ?? existing.name,
      departments ?? existing.departments,
      price !== undefined ? Number(price) : existing.price,
      freeThreshold !== undefined ? Number(freeThreshold) : existing.freeThreshold,
      estimatedDays ?? existing.estimatedDays,
      allowCod !== undefined ? (allowCod ? 1 : 0) : existing.allowCod,
      active !== undefined ? (active ? 1 : 0) : existing.active,
      id
    );

    const updated = db.prepare('SELECT * FROM shipping_zones WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo actualizar la zona de envío' });
  }
});

app.delete('/api/shipping-zones/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM shipping_zones WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo eliminar la zona de envío' });
  }
});

// ============================================================================
// 9. CRUD DE GASTOS Y FLUJO DE CAJA
// ============================================================================

app.get('/api/expenses', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM expenses ORDER BY date DESC, id DESC').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo gastos' });
  }
});

app.post('/api/expenses', (req, res) => {
  try {
    const {
      title,
      category = 'MERCANCIA',
      brand = 'all',
      amount = 0,
      paymentMethod = 'Nequi / Transferencia',
      date = new Date().toISOString().slice(0, 10),
      notes = ''
    } = req.body;

    if (!title || !amount) return res.status(400).json({ error: 'Concepto y valor son obligatorios' });

    const result = db.prepare(`
      INSERT INTO expenses (title, category, brand, amount, paymentMethod, date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(title, category, brand, Number(amount), paymentMethod, date, notes);

    const created = db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo registrar el gasto' });
  }
});

app.put('/api/expenses/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Gasto no encontrado' });

    const { title, category, brand, amount, paymentMethod, date, notes } = req.body;
    db.prepare(`
      UPDATE expenses
      SET title = ?, category = ?, brand = ?, amount = ?, paymentMethod = ?, date = ?, notes = ?
      WHERE id = ?
    `).run(
      title ?? existing.title,
      category ?? existing.category,
      brand ?? existing.brand,
      amount !== undefined ? Number(amount) : existing.amount,
      paymentMethod ?? existing.paymentMethod,
      date ?? existing.date,
      notes ?? existing.notes,
      id
    );

    const updated = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo actualizar el gasto' });
  }
});

app.delete('/api/expenses/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo eliminar el gasto' });
  }
});

// ============================================================================
// 10. CRUD DE BANNERS, AJUSTES Y BACKUP / RESTORE JSON
// ============================================================================

app.get('/api/banners', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM banners ORDER BY sortOrder ASC, id ASC').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo banners' });
  }
});

app.post('/api/banners', (req, res) => {
  try {
    const {
      brand = 'all',
      subtitle = '',
      title,
      description = '',
      ctaText = 'VER COLECCIÓN',
      ctaFilter = 'all',
      image,
      theme = 'dark',
      sortOrder = 1,
      active = true
    } = req.body;

    if (!title || !image) return res.status(400).json({ error: 'Título e imagen son obligatorios' });

    const result = db.prepare(`
      INSERT INTO banners (brand, subtitle, title, description, ctaText, ctaFilter, image, theme, sortOrder, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(brand, subtitle, title, description, ctaText, ctaFilter, image, theme, Number(sortOrder || 1), active ? 1 : 0);

    const created = db.prepare('SELECT * FROM banners WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo crear el banner' });
  }
});

app.put('/api/banners/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM banners WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Banner no encontrado' });

    const { brand, subtitle, title, description, ctaText, ctaFilter, image, theme, sortOrder, active } = req.body;
    db.prepare(`
      UPDATE banners
      SET brand = ?, subtitle = ?, title = ?, description = ?, ctaText = ?, ctaFilter = ?, image = ?, theme = ?, sortOrder = ?, active = ?
      WHERE id = ?
    `).run(
      brand ?? existing.brand,
      subtitle ?? existing.subtitle,
      title ?? existing.title,
      description ?? existing.description,
      ctaText ?? existing.ctaText,
      ctaFilter ?? existing.ctaFilter,
      image ?? existing.image,
      theme || existing.theme || 'dark',
      sortOrder !== undefined ? Number(sortOrder) : existing.sortOrder,
      active !== undefined ? (active ? 1 : 0) : existing.active,
      id
    );
    const banners = db.prepare('SELECT * FROM banners ORDER BY sortOrder ASC, id ASC').all();
    res.json({ success: true, banners });
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando banner' });
  }
});

app.delete('/api/banners/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM banners WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo eliminar el banner' });
  }
});

app.get('/api/settings', (req, res) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('store_config');
  res.json(row ? JSON.parse(row.value) : {});
});

app.put('/api/settings', (req, res) => {
  try {
    const newSettings = req.body;
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      'store_config',
      JSON.stringify(newSettings)
    );
    res.json({ success: true, settings: newSettings });
  } catch (err) {
    console.error('Error guardando settings:', err);
    res.status(500).json({ error: 'No se pudo guardar la configuración' });
  }
});

// Exportar Copia de Seguridad Completa (.json)
app.get('/api/backup', (req, res) => {
  try {
    const settingsRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('store_config');
    const payload = {
      exportedAt: new Date().toISOString(),
      version: '2.0-ERP',
      settings: settingsRow ? JSON.parse(settingsRow.value) : {},
      categories: db.prepare('SELECT * FROM categories').all(),
      products: db.prepare('SELECT * FROM products').all().map(parseProduct),
      inventoryMovements: db.prepare('SELECT * FROM inventory_movements').all(),
      customers: db.prepare('SELECT * FROM customers').all(),
      orders: db.prepare('SELECT * FROM orders').all().map(parseOrder),
      coupons: db.prepare('SELECT * FROM coupons').all(),
      shippingZones: db.prepare('SELECT * FROM shipping_zones').all(),
      expenses: db.prepare('SELECT * FROM expenses').all(),
      banners: db.prepare('SELECT * FROM banners').all()
    };
    res.json(payload);
  } catch (err) {
    console.error('Error generando backup:', err);
    res.status(500).json({ error: 'No se pudo generar la copia de seguridad' });
  }
});

// Restaurar Copia de Seguridad Completa (.json)
app.post('/api/restore', (req, res) => {
  try {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Archivo de respaldo inválido' });
    }

    db.exec('BEGIN TRANSACTION');
    try {
      if (data.settings) {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
          'store_config',
          JSON.stringify(data.settings)
        );
      }

      if (Array.isArray(data.categories)) {
        db.exec('DELETE FROM categories');
        const ins = db.prepare(
          'INSERT INTO categories (id, name, slug, brand, description, sortOrder, active) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        for (const c of data.categories) {
          ins.run(c.id, c.name, c.slug || slugify(c.name), c.brand || 'all', c.description || '', c.sortOrder || 10, c.active ? 1 : 0);
        }
      }

      if (Array.isArray(data.products)) {
        db.exec('DELETE FROM products');
        const ins = db.prepare(`
          INSERT INTO products (id, sku, name, brand, category, price, costPrice, comparePrice, description, sizes, colors, images, badge, stock, minStockAlert, featured, active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const p of data.products) {
          ins.run(
            p.id,
            p.sku || '',
            p.name,
            p.brand || 'varostyle',
            p.category || 'General',
            Number(p.price || 0),
            Number(p.costPrice || 0),
            Number(p.comparePrice || 0),
            p.description || '',
            typeof p.sizes === 'string' ? p.sizes : JSON.stringify(p.sizes || []),
            typeof p.colors === 'string' ? p.colors : JSON.stringify(p.colors || []),
            typeof p.images === 'string' ? p.images : JSON.stringify(p.images || []),
            p.badge || '',
            Number(p.stock ?? 0),
            Number(p.minStockAlert ?? 3),
            p.featured ? 1 : 0,
            p.active !== undefined ? (p.active ? 1 : 0) : 1
          );
        }
      }

      if (Array.isArray(data.customers)) {
        db.exec('DELETE FROM customers');
        const ins = db.prepare(`
          INSERT INTO customers (id, name, doc, phone, email, department, city, address, neighborhood, segment, notes, totalOrders, totalSpent, lastOrderAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const c of data.customers) {
          ins.run(
            c.id,
            c.name,
            c.doc || '',
            c.phone || '',
            c.email || '',
            c.department || '',
            c.city || '',
            c.address || '',
            c.neighborhood || '',
            c.segment || 'Nuevo',
            c.notes || '',
            Number(c.totalOrders || 0),
            Number(c.totalSpent || 0),
            c.lastOrderAt || new Date().toISOString()
          );
        }
      }

      if (Array.isArray(data.orders)) {
        db.exec('DELETE FROM orders');
        const ins = db.prepare(`
          INSERT INTO orders (
            id, orderNumber, customerId, channel, customerName, customerDoc, customerPhone, customerEmail,
            department, city, address, notes, paymentMethod, paymentStatus, paymentReference,
            paymentReceipt, items, subtotal, couponCode, discount, shipping, total, totalCost,
            status, carrier, trackingNumber, stockDeducted, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const o of data.orders) {
          ins.run(
            o.id,
            o.orderNumber,
            o.customerId || 0,
            o.channel || 'WEB',
            o.customerName,
            o.customerDoc || '',
            o.customerPhone || '',
            o.customerEmail || '',
            o.department || '',
            o.city || '',
            o.address || '',
            o.notes || '',
            o.paymentMethod || 'nequi',
            o.paymentStatus || 'Pendiente',
            o.paymentReference || '',
            o.paymentReceipt || '',
            typeof o.items === 'string' ? o.items : JSON.stringify(o.items || []),
            Number(o.subtotal || 0),
            o.couponCode || '',
            Number(o.discount || 0),
            Number(o.shipping || 0),
            Number(o.total || 0),
            Number(o.totalCost || 0),
            o.status || 'Pendiente',
            o.carrier || '',
            o.trackingNumber || '',
            o.stockDeducted !== undefined ? (o.stockDeducted ? 1 : 0) : 1,
            o.createdAt || new Date().toISOString()
          );
        }
      }

      if (Array.isArray(data.coupons)) {
        db.exec('DELETE FROM coupons');
        const ins = db.prepare(`
          INSERT INTO coupons (id, code, type, value, minPurchase, brand, maxUses, usedCount, expiresAt, active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const c of data.coupons) {
          ins.run(c.id, c.code, c.type, Number(c.value || 0), Number(c.minPurchase || 0), c.brand || 'all', Number(c.maxUses || 0), Number(c.usedCount || 0), c.expiresAt || '', c.active ? 1 : 0);
        }
      }

      if (Array.isArray(data.shippingZones)) {
        db.exec('DELETE FROM shipping_zones');
        const ins = db.prepare(`
          INSERT INTO shipping_zones (id, name, departments, price, freeThreshold, estimatedDays, allowCod, active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const z of data.shippingZones) {
          ins.run(z.id, z.name, z.departments || '', Number(z.price || 12000), Number(z.freeThreshold || 200000), z.estimatedDays || '', z.allowCod ? 1 : 0, z.active ? 1 : 0);
        }
      }

      if (Array.isArray(data.expenses)) {
        db.exec('DELETE FROM expenses');
        const ins = db.prepare(`
          INSERT INTO expenses (id, title, category, brand, amount, paymentMethod, date, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const e of data.expenses) {
          ins.run(e.id, e.title, e.category || 'MERCANCIA', e.brand || 'all', Number(e.amount || 0), e.paymentMethod || '', e.date || '', e.notes || '');
        }
      }

      if (Array.isArray(data.banners)) {
        db.exec('DELETE FROM banners');
        const ins = db.prepare(`
          INSERT INTO banners (id, brand, subtitle, title, description, ctaText, ctaFilter, image, theme, sortOrder, active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const b of data.banners) {
          ins.run(b.id, b.brand, b.subtitle || '', b.title, b.description || '', b.ctaText || '', b.ctaFilter || 'all', b.image, b.theme || 'dark', Number(b.sortOrder || 1), b.active ? 1 : 0);
        }
      }

      db.exec('COMMIT');
      res.json({ success: true });
    } catch (innerErr) {
      db.exec('ROLLBACK');
      throw innerErr;
    }
  } catch (err) {
    console.error('Error restaurando backup:', err);
    res.status(500).json({ error: 'No se pudo restaurar la copia de seguridad' });
  }
});

// Evitar 404 en /favicon.ico sirviendo el icono oficial SVG
app.get('/favicon.ico', (req, res) => {
  res.type('image/svg+xml');
  res.sendFile(path.join(__dirname, 'public', 'icon.svg'));
});

// Fallback SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Exportar app para Vercel Serverless
module.exports = app;

if (!isVercel && require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`V&V STUDIO (VAROSTYLE & VALEN SHOP) ERP + E-COMMERCE ACTIVO`);
    console.log(`Tienda Web & App: http://localhost:${PORT}`);
    console.log(`======================================================\n`);
  });
}
