// Bring your own catalog — the same storefront, your products.
//
//   npm run build:packages         # build the two @openmobilehub/attesto-* packages
//   node examples/byo-catalog.mjs  # → http://localhost:3006/mcp
//
// Where storefront.mjs ships the package's SAMPLE_CATALOG, this one hands
// createStorefront() a CUSTOM catalog + reviews map. Own-the-code: the catalog is
// injected, not configured — edit the array below and the tools, widget, and gate
// all follow. `minimumAge` is the one field that arms the age gate.

import { createStorefront } from "@openmobilehub/attesto-storefront/server";
import { Attesto, age, membership, payment, required, optional } from "@openmobilehub/attesto-gate";

// Your catalog — three products, one of them 21+ (note `minimumAge`).
const catalog = [
  {
    id: "single-origin-coffee",
    name: "Ethiopia Yirgacheffe — Single-Origin Beans",
    price: 22.0,
    currency: "USD",
    image: "https://picsum.photos/seed/coffee/600",
    category: "Coffee",
    description: "Whole-bean light roast, floral and citrus. 340g bag.",
  },
  {
    id: "natural-wine",
    name: "Pét-Nat Natural Wine",
    price: 38.0,
    currency: "USD",
    image: "https://picsum.photos/seed/wine/600",
    category: "Beverages",
    description: "Cloudy, low-intervention sparkling wine. 21+ only.",
    minimumAge: 21,                                 // ← arms the age gate for this line
  },
  {
    id: "ceramic-pour-over",
    name: "Stoneware Pour-Over Dripper",
    price: 34.0,
    currency: "USD",
    image: "https://picsum.photos/seed/dripper/600",
    category: "Homewares",
    description: "Hand-glazed ceramic cone, fits a standard #2 filter.",
  },
];

// Reviews map — keyed by product id, backs the `get-product-reviews` tool.
const reviews = {
  "single-origin-coffee": [
    { author: "Mara", rating: 5, text: "Bright and jammy — best pour-over beans I've had." },
    { author: "Devin", rating: 4, text: "Lovely florals, a touch pricey." },
  ],
  "natural-wine": [{ author: "Sasha", rating: 5, text: "Funky in the best way. Crowd-pleaser." }],
  "ceramic-pour-over": [{ author: "Lee", rating: 5, text: "Even extraction, gorgeous on the counter." }],
};

const store = createStorefront({ catalog, reviews });   // your products, the whole storefront
const attesto = new Attesto();
attesto.mount(store.app);                                // Attesto mounts onto it

const hasAlcohol = (order) => order.lines.some((l) => l.minimumAge != null);
store.gate((order) =>                                    // …and gates the checkout tool
  attesto.requirements(order, [
    required(age.over(21).when(hasAlcohol)),              // 21+ — only when the cart has the wine
    optional(membership.discount(10)),                   // 10% off with a loyalty credential
    required(payment.in("usd")),                         // amount derived from the order; settles last
  ]),
);

const { url } = await store.listen(Number(process.env.PORT ?? 3006));
console.log(`\n  ✓ Bring-your-own-catalog storefront running → ${url}`);
console.log(`  Add it to Goose as a Streamable HTTP connector, then ask it to buy the wine.\n`);
