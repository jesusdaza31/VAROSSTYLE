const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 3000;

// Asegurar carpetas de datos y subidas
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Inicializar base de datos SQLite
const dbPath = path.join(dataDir, 'varostyle.sqlite');
const db = new DatabaseSync(dbPath);

// Configuración de middlewares
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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
const upload = multer({ storage });

// Helper para eliminar cualquier emoji de cadenas existentes
function stripEmojis(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Crear tablas e inicializar datos semilla libres de emojis
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      brand TEXT NOT NULL, -- 'varostyle' (Hombre) | 'valenshop' (Mujer)
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      comparePrice INTEGER DEFAULT 0,
      description TEXT,
      sizes TEXT NOT NULL, -- JSON array e.g. ["S","M","L","XL"]
      colors TEXT NOT NULL, -- JSON array e.g. [{"name":"Negro","hex":"#111111"}]
      images TEXT NOT NULL, -- JSON array of URLs
      badge TEXT DEFAULT '', -- 'NUEVO', 'MÁS VENDIDO', 'SALE', ''
      stock INTEGER DEFAULT 15,
      featured INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
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
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderNumber TEXT NOT NULL UNIQUE,
      customerName TEXT NOT NULL,
      customerDoc TEXT,
      customerPhone TEXT NOT NULL,
      customerEmail TEXT,
      department TEXT,
      city TEXT NOT NULL,
      address TEXT NOT NULL,
      notes TEXT,
      paymentMethod TEXT NOT NULL, -- 'nequi', 'pse_card', 'whatsapp'
      paymentReference TEXT,
      paymentReceipt TEXT,
      items TEXT NOT NULL, -- JSON array of cart items
      subtotal INTEGER NOT NULL,
      shipping INTEGER NOT NULL,
      total INTEGER NOT NULL,
      status TEXT DEFAULT 'Pendiente', -- 'Pendiente', 'Pagado', 'Enviado', 'Entregado', 'Cancelado'
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const defaultSettings = {
    mainBrand: 'V&V STUDIO',
    mainTagline: 'VAROSTYLE • VALEN SHOP',
    mainLogoUrl: '',
    adminPin: '1234',
    topPromoBar: 'V&V STUDIO OFICIAL | ENVÍOS SEGUROS A TODA COLOMBIA | PAGA CON NEQUI, PSE, TARJETA O WHATSAPP | ENVÍO GRATIS DESDE $200.000',
    freeShippingThreshold: 200000,
    defaultShippingCost: 12000,
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

  // Verificar si ya existen banners o actualizarlos
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
        theme: 'dark'
      },
      {
        brand: 'varostyle',
        subtitle: 'SUB-MARCA HOMBRE • VAROSTYLE BY V&V STUDIO',
        title: 'TU ESTILO, TU ESENCIA.',
        description: 'Prendas modernas, versátiles y con actitud para destacar en cada ocasión. Inspiración urbana y elegante.',
        ctaText: 'EXPLORAR VAROSTYLE (HOMBRE)',
        ctaFilter: 'varostyle',
        image: 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?auto=format&fit=crop&w=1600&q=85',
        theme: 'dark'
      },
      {
        brand: 'valenshop',
        subtitle: 'SUB-MARCA MUJER • VALEN SHOP BY V&V STUDIO',
        title: 'ELEGANCIA SUTIL, BELLEZA NATURAL',
        description: 'Tendencias pensadas para hacerte sentir cómoda, auténtica y radiante en cada momento especial.',
        ctaText: 'EXPLORAR VALEN SHOP (MUJER)',
        ctaFilter: 'valenshop',
        image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=85',
        theme: 'light'
      }
    ];

    const insertBanner = db.prepare(`
      INSERT INTO banners (brand, subtitle, title, description, ctaText, ctaFilter, image, theme, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    for (const b of seedBanners) {
      insertBanner.run(b.brand, b.subtitle, b.title, b.description, b.ctaText, b.ctaFilter, b.image, b.theme);
    }
  } else {
    db.prepare(`
      UPDATE banners
      SET subtitle = 'CASA DE MODA OFICIAL • VAROSTYLE & VALEN SHOP',
          title = 'V&V STUDIO',
          description = 'Nuestra marca oficial que une dos líneas exclusivas: VaroStyle (Moda Masculina) y Valen Shop (Moda Femenina).'
      WHERE brand = 'all'
    `).run();
    const allBanners = db.prepare('SELECT * FROM banners').all();
    const updateBannerClean = db.prepare('UPDATE banners SET subtitle = ?, title = ?, description = ?, ctaText = ? WHERE id = ?');
    for (const b of allBanners) {
      updateBannerClean.run(
        stripEmojis(b.subtitle),
        stripEmojis(b.title),
        stripEmojis(b.description),
        stripEmojis(b.ctaText),
        b.id
      );
    }
  }

  // Verificar si ya existen productos
  const existingProducts = db.prepare('SELECT COUNT(*) as count FROM products').get();
  if (existingProducts.count === 0) {
    const seedProducts = [
      // ==================== VAROSTYLE (HOMBRE) ====================
      {
        name: 'Camisa Oxford Slim Fit Essential',
        brand: 'varostyle',
        category: 'Camisas',
        price: 115000,
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
        featured: 1
      },
      {
        name: 'Camiseta Oversize Heavyweight "Essence"',
        brand: 'varostyle',
        category: 'Camisetas',
        price: 78000,
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
        featured: 1
      },
      {
        name: 'Chaqueta Bomber Urban Noir',
        brand: 'varostyle',
        category: 'Chaquetas y Buzos',
        price: 165000,
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
        featured: 1
      },
      {
        name: 'Jean Cargo Relaxed Denim VaroStyle',
        brand: 'varostyle',
        category: 'Jeans y Pantalones',
        price: 138000,
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
        featured: 1
      },
      {
        name: 'Set Lino Verano (Camisa + Bermuda)',
        brand: 'varostyle',
        category: 'Conjuntos',
        price: 175000,
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
        featured: 1
      },
      {
        name: 'Polo Tejido Milano Elegance',
        brand: 'varostyle',
        category: 'Camisetas',
        price: 92000,
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
        featured: 0
      },

      // ==================== VALEN SHOP (MUJER) ====================
      {
        name: 'Vestido Midi Satinado "Aura"',
        brand: 'valenshop',
        category: 'Vestidos y Enterizos',
        price: 145000,
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
        featured: 1
      },
      {
        name: 'Conjunto Sastre Lino "Valen Studio" (Chaleco + Pantalón)',
        brand: 'valenshop',
        category: 'Conjuntos',
        price: 168000,
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
        featured: 1
      },
      {
        name: 'Blusa Romántica Manga Abullonada "Lumière"',
        brand: 'valenshop',
        category: 'Blusas y Tops',
        price: 89000,
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
        featured: 1
      },
      {
        name: 'Jean Wide Leg Tiro Alto "Sculpt"',
        brand: 'valenshop',
        category: 'Jeans y Pantalones',
        price: 135000,
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
        featured: 1
      },
      {
        name: 'Blazer Estructurado "Valen Chic"',
        brand: 'valenshop',
        category: 'Chaquetas y Blazers',
        price: 159000,
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
        featured: 1
      },
      {
        name: 'Vestido Corto Bohemio "Solsticio"',
        brand: 'valenshop',
        category: 'Vestidos y Enterizos',
        price: 122000,
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
        featured: 0
      }
    ];

    const insertProduct = db.prepare(`
      INSERT INTO products (name, brand, category, price, comparePrice, description, sizes, colors, images, badge, stock, featured, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    for (const p of seedProducts) {
      insertProduct.run(
        p.name,
        p.brand,
        p.category,
        p.price,
        p.comparePrice,
        p.description,
        JSON.stringify(p.sizes),
        JSON.stringify(p.colors),
        JSON.stringify(p.images),
        p.badge,
        p.stock,
        p.featured
      );
    }
  }
}

initDatabase();

// Helper para parsear productos desde SQLite
function parseProduct(row) {
  if (!row) return null;
  return {
    ...row,
    sizes: JSON.parse(row.sizes || '[]'),
    colors: JSON.parse(row.colors || '[]'),
    images: JSON.parse(row.images || '[]'),
    featured: Boolean(row.featured),
    active: Boolean(row.active)
  };
}

// ============================================================================
// ENDPOINTS DE API
// ============================================================================

app.get('/api/bootstrap', (req, res) => {
  try {
    const settingsRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('store_config');
    const settings = settingsRow ? JSON.parse(settingsRow.value) : {};
    const products = db.prepare('SELECT * FROM products ORDER BY id DESC').all().map(parseProduct);
    const banners = db.prepare('SELECT * FROM banners WHERE active = 1 ORDER BY id ASC').all();

    res.json({ settings, products, banners });
  } catch (err) {
    console.error('Error en /api/bootstrap:', err);
    res.status(500).json({ error: 'Error al cargar datos de la tienda' });
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

app.post('/api/upload', upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se enviaron archivos' });
    }
    const urls = req.files.map(file => `/uploads/${file.filename}`);
    res.json({ success: true, urls });
  } catch (err) {
    console.error('Error subiendo archivos:', err);
    res.status(500).json({ error: 'Error al subir imagen' });
  }
});

app.get('/api/products', (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY id DESC').all();
  res.json(rows.map(parseProduct));
});

app.post('/api/products', (req, res) => {
  try {
    const {
      name,
      brand = 'varostyle',
      category = 'Camisetas',
      price = 0,
      comparePrice = 0,
      description = '',
      sizes = ['S', 'M', 'L'],
      colors = [{ name: 'Negro', hex: '#111111' }],
      images = [],
      badge = '',
      stock = 10,
      featured = true,
      active = true
    } = req.body;

    const result = db.prepare(`
      INSERT INTO products (name, brand, category, price, comparePrice, description, sizes, colors, images, badge, stock, featured, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      brand,
      category,
      Number(price),
      Number(comparePrice || 0),
      description,
      JSON.stringify(sizes),
      JSON.stringify(colors),
      JSON.stringify(images),
      badge,
      Number(stock),
      featured ? 1 : 0,
      active ? 1 : 0
    );

    const created = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
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
      name,
      brand,
      category,
      price,
      comparePrice,
      description,
      sizes,
      colors,
      images,
      badge,
      stock,
      featured,
      active
    } = req.body;

    db.prepare(`
      UPDATE products
      SET name = ?, brand = ?, category = ?, price = ?, comparePrice = ?, description = ?,
          sizes = ?, colors = ?, images = ?, badge = ?, stock = ?, featured = ?, active = ?
      WHERE id = ?
    `).run(
      name ?? existing.name,
      brand ?? existing.brand,
      category ?? existing.category,
      price !== undefined ? Number(price) : existing.price,
      comparePrice !== undefined ? Number(comparePrice) : existing.comparePrice,
      description ?? existing.description,
      sizes ? JSON.stringify(sizes) : existing.sizes,
      colors ? JSON.stringify(colors) : existing.colors,
      images ? JSON.stringify(images) : existing.images,
      badge ?? existing.badge,
      stock !== undefined ? Number(stock) : existing.stock,
      featured !== undefined ? (featured ? 1 : 0) : existing.featured,
      active !== undefined ? (active ? 1 : 0) : existing.active,
      id
    );

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.json(parseProduct(updated));
  } catch (err) {
    console.error('Error actualizando producto:', err);
    res.status(500).json({ error: 'No se pudo actualizar el producto' });
  }
});

app.delete('/api/products/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error eliminando producto:', err);
    res.status(500).json({ error: 'No se pudo eliminar el producto' });
  }
});

app.put('/api/banners/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const { brand, subtitle, title, description, ctaText, ctaFilter, image, theme } = req.body;
    db.prepare(`
      UPDATE banners
      SET brand = ?, subtitle = ?, title = ?, description = ?, ctaText = ?, ctaFilter = ?, image = ?, theme = ?
      WHERE id = ?
    `).run(brand, subtitle, title, description, ctaText, ctaFilter, image, theme || 'dark', id);
    const banners = db.prepare('SELECT * FROM banners WHERE active = 1 ORDER BY id ASC').all();
    res.json({ success: true, banners });
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando banner' });
  }
});

app.get('/api/orders', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
    const orders = rows.map(r => ({
      ...r,
      items: JSON.parse(r.items || '[]')
    }));
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo pedidos' });
  }
});

app.get('/api/orders/track/:orderNumber', (req, res) => {
  try {
    const code = req.params.orderNumber.trim().toUpperCase();
    const row = db.prepare('SELECT * FROM orders WHERE UPPER(orderNumber) = ?').get(code);
    if (!row) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json({
      ...row,
      items: JSON.parse(row.items || '[]')
    });
  } catch (err) {
    res.status(500).json({ error: 'Error buscando el pedido' });
  }
});

app.post('/api/orders', (req, res) => {
  try {
    const {
      customerName,
      customerDoc = '',
      customerPhone,
      customerEmail = '',
      department = '',
      city,
      address,
      notes = '',
      paymentMethod,
      paymentReference = '',
      paymentReceipt = '',
      items = [],
      subtotal = 0,
      shipping = 0,
      total = 0
    } = req.body;

    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `VS-${randomDigits}`;

    const initialStatus = paymentMethod === 'pse_card' ? 'Pagado' : 'Pendiente';

    const result = db.prepare(`
      INSERT INTO orders (
        orderNumber, customerName, customerDoc, customerPhone, customerEmail,
        department, city, address, notes, paymentMethod, paymentReference,
        paymentReceipt, items, subtotal, shipping, total, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderNumber,
      customerName,
      customerDoc,
      customerPhone,
      customerEmail,
      department,
      city,
      address,
      notes,
      paymentMethod,
      paymentReference,
      paymentReceipt,
      JSON.stringify(items),
      Number(subtotal),
      Number(shipping),
      Number(total),
      initialStatus
    );

    const updateStock = db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?');
    for (const item of items) {
      if (item.productId) {
        updateStock.run(Number(item.quantity || 1), Number(item.productId));
      }
    }

    const created = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({
      ...created,
      items: JSON.parse(created.items || '[]')
    });
  } catch (err) {
    console.error('Error creando pedido:', err);
    res.status(500).json({ error: 'Error al registrar el pedido' });
  }
});

app.put('/api/orders/:id/status', (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    res.json({
      ...updated,
      items: JSON.parse(updated.items || '[]')
    });
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando estado del pedido' });
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

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`VAROSTYLE & VALEN SHOP E-COMMERCE + PWA ACTIVO`);
  console.log(`Tienda Web & App: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
