// Initial seed data for Nehal Express.
// Prices are in INR (whole rupees).
const bcrypt = require('bcryptjs');

const categories = [
  { id: 'women-ethnic', name: 'Women · Ethnic Wear' },
  { id: 'women-western', name: 'Women · Western Wear' },
  { id: 'men-shirts', name: 'Men · Shirts' },
  { id: 'men-ethnic', name: 'Men · Ethnic Wear' },
  { id: 'accessories', name: 'Accessories' },
  { id: 'footwear', name: 'Footwear' }
];

const products = [
  {
    id: 'p001',
    name: 'Handloom Cotton Saree — Indigo Weave',
    category: 'women-ethnic',
    price: 2499,
    mrp: 3299,
    stock: 18,
    sizes: ['Free Size'],
    colors: ['Indigo'],
    rating: 4.6,
    reviews: 128,
    description: 'Pure handloom cotton saree with a contrast zari border, woven by artisans in Maheshwar. Comes with an unstitched blouse piece.',
    images: ['https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&q=80'],
    tags: ['new', 'handloom']
  },
  {
    id: 'p002',
    name: 'Chanderi Silk Anarkali Kurta',
    category: 'women-ethnic',
    price: 3199,
    mrp: 4499,
    stock: 12,
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['Maroon', 'Emerald'],
    rating: 4.8,
    reviews: 94,
    description: 'Floor-length Anarkali kurta in Chanderi silk with hand block printing and gota patti work on the yoke.',
    images: ['https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=800&q=80'],
    tags: ['bestseller']
  },
  {
    id: 'p003',
    name: 'Tailored Linen Blazer — Sand',
    category: 'women-western',
    price: 4599,
    mrp: 5999,
    stock: 9,
    sizes: ['XS', 'S', 'M', 'L'],
    colors: ['Sand'],
    rating: 4.4,
    reviews: 41,
    description: 'A breathable linen-blend blazer with a relaxed shoulder and single-button close, cut for warm-weather layering.',
    images: ['https://images.unsplash.com/photo-1591369822096-ffd140ec948f?w=800&q=80'],
    tags: ['new']
  },
  {
    id: 'p004',
    name: 'High-Rise Wide Leg Trousers',
    category: 'women-western',
    price: 1899,
    mrp: 2399,
    stock: 25,
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    colors: ['Black', 'Beige'],
    rating: 4.3,
    reviews: 67,
    description: 'Structured wide-leg trousers with a fluid drape, hidden side-zip and a comfortable high waistband.',
    images: ['https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&q=80'],
    tags: []
  },
  {
    id: 'p005',
    name: 'Oxford Cotton Formal Shirt',
    category: 'men-shirts',
    price: 1399,
    mrp: 1899,
    stock: 30,
    sizes: ['38', '40', '42', '44'],
    colors: ['White', 'Sky Blue'],
    rating: 4.5,
    reviews: 210,
    description: 'Crisp Oxford cotton shirt with a spread collar and single-needle stitching for a sharper finish.',
    images: ['https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&q=80'],
    tags: ['bestseller']
  },
  {
    id: 'p006',
    name: 'Slim Fit Linen Shirt — Olive',
    category: 'men-shirts',
    price: 1699,
    mrp: 2199,
    stock: 22,
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['Olive', 'Stone'],
    rating: 4.2,
    reviews: 58,
    description: 'Slim fit shirt in a textured linen blend, breathable enough for daily wear and humid afternoons.',
    images: ['https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&q=80'],
    tags: []
  },
  {
    id: 'p007',
    name: 'Bandhgala Nehru Jacket — Charcoal',
    category: 'men-ethnic',
    price: 3899,
    mrp: 4999,
    stock: 14,
    sizes: ['38', '40', '42', '44', '46'],
    colors: ['Charcoal'],
    rating: 4.7,
    reviews: 76,
    description: 'A tailored Bandhgala jacket in charcoal wool-blend, finished with fabric-covered buttons — built for weddings and festive evenings.',
    images: ['https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?w=800&q=80'],
    tags: ['festive']
  },
  {
    id: 'p008',
    name: 'Chikankari Kurta — Ivory',
    category: 'men-ethnic',
    price: 2199,
    mrp: 2799,
    stock: 20,
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: ['Ivory'],
    rating: 4.6,
    reviews: 103,
    description: 'Lucknowi Chikankari hand-embroidery on soft cotton — a lightweight kurta for daytime festivities.',
    images: ['https://images.unsplash.com/photo-1622470953794-aa9c70b0fb9a?w=800&q=80'],
    tags: []
  },
  {
    id: 'p009',
    name: 'Oxidised Silver Jhumka Earrings',
    category: 'accessories',
    price: 799,
    mrp: 1099,
    stock: 40,
    sizes: ['One Size'],
    colors: ['Silver'],
    rating: 4.5,
    reviews: 152,
    description: 'Handcrafted oxidised jhumkas with a temple-inspired motif — pairs well with both ethnic and Indo-western fits.',
    images: ['https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=80'],
    tags: ['bestseller']
  },
  {
    id: 'p010',
    name: 'Genuine Leather Belt — Tan',
    category: 'accessories',
    price: 999,
    mrp: 1399,
    stock: 35,
    sizes: ['32', '34', '36', '38'],
    colors: ['Tan', 'Black'],
    rating: 4.3,
    reviews: 88,
    description: 'Full-grain leather belt with a brushed nickel buckle — cut and stitched to order.',
    images: ['https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=800&q=80'],
    tags: []
  },
  {
    id: 'p011',
    name: 'Canvas Structured Tote Bag',
    category: 'accessories',
    price: 1299,
    mrp: 1699,
    stock: 27,
    sizes: ['One Size'],
    colors: ['Beige', 'Rust'],
    rating: 4.4,
    reviews: 63,
    description: 'A heavy-canvas tote with a leather base and reinforced handles, roomy enough for a laptop and a day of errands.',
    images: ['https://images.unsplash.com/photo-1591561954557-26941169b49e?w=800&q=80'],
    tags: ['new']
  },
  {
    id: 'p012',
    name: 'Woven Juttis — Rose Gold',
    category: 'footwear',
    price: 1599,
    mrp: 1999,
    stock: 16,
    sizes: ['36', '37', '38', '39', '40', '41'],
    colors: ['Rose Gold'],
    rating: 4.5,
    reviews: 71,
    description: 'Hand-embroidered juttis with a cushioned footbed — comfortable enough for a full day of festivities.',
    images: ['https://images.unsplash.com/photo-1595341888016-a392ef81b7de?w=800&q=80'],
    tags: []
  },
  {
    id: 'p013',
    name: 'Leather Derby Shoes — Espresso',
    category: 'footwear',
    price: 3299,
    mrp: 4199,
    stock: 11,
    sizes: ['7', '8', '9', '10', '11'],
    colors: ['Espresso'],
    rating: 4.6,
    reviews: 49,
    description: 'Classic Derby shoes in burnished leather with a Goodyear-welted sole built to be resoled, not replaced.',
    images: ['https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=800&q=80'],
    tags: ['bestseller']
  },
  {
    id: 'p014',
    name: 'Printed Georgette Dupatta',
    category: 'accessories',
    price: 699,
    mrp: 999,
    stock: 33,
    sizes: ['One Size'],
    colors: ['Coral'],
    rating: 4.1,
    reviews: 37,
    description: 'Lightweight georgette dupatta with a hand block print and delicate tassel edging.',
    images: ['https://images.unsplash.com/photo-1610030181087-9f925cbb27b5?w=800&q=80'],
    tags: []
  },
  {
    id: 'p015',
    name: 'Denim Jacket — Washed Blue',
    category: 'women-western',
    price: 2199,
    mrp: 2899,
    stock: 19,
    sizes: ['XS', 'S', 'M', 'L'],
    colors: ['Washed Blue'],
    rating: 4.3,
    reviews: 55,
    description: 'A cropped denim jacket in a soft washed finish with corozo buttons and dual chest pockets.',
    images: ['https://images.unsplash.com/photo-1551537482-f2075a1d41f2?w=800&q=80'],
    tags: ['new']
  },
  {
    id: 'p016',
    name: 'Chronograph Watch — Steel',
    category: 'accessories',
    price: 4999,
    mrp: 6499,
    stock: 8,
    sizes: ['One Size'],
    colors: ['Steel'],
    rating: 4.7,
    reviews: 29,
    description: 'A stainless steel chronograph with sapphire-coated glass and a quick-release strap.',
    images: ['https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&q=80'],
    tags: ['festive']
  }
];

function buildInitialData() {
  const passwordHash = bcrypt.hashSync('admin123', 10);
  return {
    categories,
    products,
    orders: [],
    admins: [
      { id: 'admin-1', username: 'admin', passwordHash, name: 'Store Admin' }
    ],
    meta: {
      nextOrderNumber: 1001
    }
  };
}

module.exports = { buildInitialData, categories, products };
