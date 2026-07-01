// _meta key carrying the catalog from browse-products to the UI. Kept out of
// the tool's text content so the model doesn't re-render the list as a table.
export const CATALOG_META_KEY = "product-picker/catalog";

// _meta key carrying the current priced cart to the UI (app-only, out-of-band)
// so the model doesn't re-render it as text.
export const CART_META_KEY = "product-picker/cart";

// Loyalty members get this percentage off the whole cart when they present a
// valid loyalty credential. Whole-cart, mirrors a2ui_concierge.
export const LOYALTY_DISCOUNT_PCT = 10;

export interface Product {
  id: string;
  name: string;
  price: number;
  currency: string;
  image: string;
  category: string;
  description: string;
  // Minimum age required to purchase (e.g. 21 for alcohol). Absent = no age
  // restriction. Drives the age-verification threshold at checkout.
  minimumAge?: number;
}

export interface CartItemInput {
  productId: string;
  quantity: number;
}

export interface PricedCartLine {
  id: string;
  name: string;
  unitPrice: number;
  currency: string;
  quantity: number;
  lineTotal: number;
}

export interface PricedCart {
  lines: PricedCartLine[];
  itemCount: number;
  subtotal: number;
  discount: number;
  total: number;
  currency: string;
  unknownIds: string[];
  // True when any line is age-restricted (alcohol).
  hasAgeRestricted: boolean;
  // Reflects verificationStore at pricing time (false in pure/unit pricing).
  ageVerified: boolean;
  loyaltyApplied: boolean;
}

// Verification flags that influence pricing/gating. Passed by the server from
// verificationStore; defaults to all-false for pure pricing.
export interface PriceOpts {
  ageVerified?: boolean;
  loyaltyApplied?: boolean;
}

// NOTE: the product data lives in catalog-seed.ts (SEED_PRODUCTS) — the shared
// source of truth for both the Firestore seed and the static loader. Product
// lookup + age-threshold derivation live in catalog-store.ts (getProduct /
// requiredAgeForLines), which read the loaded catalog.

export interface Review {
  author: string;
  rating: number; // 1–5
  title: string;
  body: string;
}

// Sample reviews keyed by product id. Lets the model answer "what do people say
// about X?" without a real backend.
export const REVIEWS: Record<string, Review[]> = {
  "aurora-headphones": [
    { author: "Mia R.", rating: 5, title: "ANC is the real deal", body: "Cancels the office hum completely. Battery easily lasts a work week." },
    { author: "Devin K.", rating: 4, title: "Great, slightly tight", body: "Sound is rich and balanced. Clamp force is a bit strong on day one but loosens up." },
  ],
  "nimbus-keyboard": [
    { author: "Priya S.", rating: 5, title: "Hot-swap heaven", body: "Swapped to tactile switches in minutes, no soldering. PBT caps feel premium." },
    { author: "Tom B.", rating: 4, title: "Love it, wanted backlight", body: "Typing feel is excellent. Wish it had per-key RGB at this price." },
  ],
  "lumen-monitor": [
    { author: "Carlos M.", rating: 5, title: "USB-C one-cable setup", body: "Drives my laptop and charges it over one cable. Text is razor sharp at 4K." },
    { author: "Anna L.", rating: 4, title: "Beautiful panel", body: "Colors are great out of the box. Stand wobbles slightly if you bump the desk." },
  ],
  "drift-mouse": [
    { author: "Jordan P.", rating: 5, title: "Silent and light", body: "Clicks are nearly inaudible on calls. Glides effortlessly." },
    { author: "Sam W.", rating: 4, title: "Comfy for long days", body: "No wrist fatigue after 8 hours. Scroll wheel could be a touch grippier." },
  ],
  "pulse-webcam": [
    { author: "Lena F.", rating: 4, title: "Sharp 1080p60", body: "Smooth motion and the light correction handles my backlit window well." },
    { author: "Raj N.", rating: 4, title: "Solid upgrade", body: "Big step up from my laptop cam. Mic is okay; I still use a headset." },
  ],
  "harbor-dock": [
    { author: "Grace H.", rating: 5, title: "Replaced four adapters", body: "Dual HDMI, ethernet, and 100W passthrough all work flawlessly with my laptop." },
    { author: "Owen T.", rating: 4, title: "Runs a bit warm", body: "Does everything advertised. Gets warm under heavy load but never throttled." },
  ],
  "ember-desk-lamp": [
    { author: "Yuki A.", rating: 5, title: "Charges my phone too", body: "Tunable white is great for evenings and the Qi base is a clever touch." },
    { author: "Beth C.", rating: 4, title: "Nice and bright", body: "Plenty of light for reading. App could be simpler but the lamp is lovely." },
  ],
  "atlas-stand": [
    { author: "Marcus D.", rating: 5, title: "Rock solid", body: "No wobble even while typing hard. Folds flat for travel." },
    { author: "Iris V.", rating: 4, title: "Better posture instantly", body: "Raised my screen to eye level. Wish it went just a bit higher." },
  ],
  "celebration-champagne": [
    { author: "Nadia P.", rating: 5, title: "Perfect gift", body: "Beautiful set, flutes felt premium and the champagne was crisp." },
    { author: "Leo M.", rating: 4, title: "Lovely", body: "Great for a toast. Packaging was elegant." },
  ],
  "oak-whiskey": [
    { author: "Quinn R.", rating: 5, title: "Smooth trio", body: "Each bottle has a distinct character. The aged one is exceptional." },
    { author: "Dana S.", rating: 4, title: "Solid collection", body: "Good range. Pours are generous for a sampler." },
  ],
  "craft-beer-sampler": [
    { author: "Theo K.", rating: 5, title: "Great variety", body: "Twelve different cans, all fresh. Found two new favorites." },
    { author: "Mara V.", rating: 4, title: "Fun sampler", body: "Nice mix of styles. A couple were too hoppy for me but that's taste." },
  ],
};

export function getReviews(productId: string): Review[] {
  return REVIEWS[productId] ?? [];
}

export function priceCart(items: CartItemInput[], catalog: Product[], opts: PriceOpts = {}): PricedCart {
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const lines: PricedCartLine[] = [];
  const unknownIds: string[] = [];
  let hasAgeRestricted = false;
  for (const { productId, quantity } of items) {
    const product = byId.get(productId);
    if (!product) {
      unknownIds.push(productId);
      continue;
    }
    if (quantity <= 0) continue;
    if (product.minimumAge != null) hasAgeRestricted = true;
    lines.push({
      id: product.id,
      name: product.name,
      unitPrice: product.price,
      currency: product.currency,
      quantity,
      lineTotal: product.price * quantity,
    });
  }
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const loyaltyApplied = !!opts.loyaltyApplied;
  const discount = loyaltyApplied
    ? Math.round(subtotal * (LOYALTY_DISCOUNT_PCT / 100) * 100) / 100
    : 0;
  const total = Math.round((subtotal - discount) * 100) / 100;
  const currency = lines[0]?.currency ?? "USD";
  return {
    lines,
    itemCount,
    subtotal,
    discount,
    total,
    currency,
    unknownIds,
    hasAgeRestricted,
    ageVerified: !!opts.ageVerified,
    loyaltyApplied,
  };
}

// An order is a snapshot of the priced cart at checkout time. The demo does not
// take payment in chat: checkout hands off to an external (mock) merchant page,
// where the user completes the purchase with their own account.
export interface Order {
  id: string;
  lines: PricedCartLine[];
  itemCount: number;
  subtotal: number;
  discount: number;
  total: number;
  currency: string;
  createdAt: string;
}

// Snapshots cart items into an order. Unknown product ids are dropped (not
// validated).
export function createOrder(items: CartItemInput[], id: string, catalog: Product[], opts: PriceOpts = {}): Order {
  const { lines, itemCount, subtotal, discount, total, currency } = priceCart(items, catalog, opts);
  return { id, lines, itemCount, subtotal, discount, total, currency, createdAt: new Date().toISOString() };
}
