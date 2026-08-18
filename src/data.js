export const categories = [
  { name: 'All', icon: '🏠', accent: 'orange' },
  { name: 'Phones & Tablets', icon: '📱', accent: 'orange' },
  { name: 'Appliances', icon: '🧺', accent: 'blue' },
  { name: 'Fashion', icon: '👗', accent: 'pink' },
  { name: 'Home & Office', icon: '🛋️', accent: 'green' },
  { name: 'Electronics', icon: '💻', accent: 'purple' },
  { name: 'Health & Beauty', icon: '🧴', accent: 'red' },
  { name: 'Groceries', icon: '🥬', accent: 'yellow' },
  { name: 'Drinks', icon: '🍹', accent: 'cyan' },
]

export const featuredProducts = [
  {
    id: 1,
    name: 'iPhone 15 Pro Max',
    price: 'KSh 1,340,000',
    oldPrice: 'KSh 1,550,000',
    image:
      'https://images.unsplash.com/photo-1695048133142-1f9d4d6d7cb5?auto=format&fit=crop&w=900&q=80',
    badge: 'Top Deal',
    category: 'Phones & Tablets',
  },
  {
    id: 2,
    name: 'Sony WH-1000XM5',
    price: 'KSh 67,000',
    oldPrice: 'KSh 82,000',
    image:
      'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=900&q=80',
    badge: 'New',
    category: 'Electronics',
  },
  {
    id: 3,
    name: 'Canon EOS R50',
    price: 'KSh 180,000',
    oldPrice: 'KSh 210,000',
    image:
      'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80',
    badge: 'Hot',
    category: 'Electronics',
  },
  {
    id: 4,
    name: 'Samsung 65" Smart TV',
    price: 'KSh 224,000',
    oldPrice: 'KSh 270,000',
    image:
      'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=900&q=80',
    badge: 'Save 17%',
    category: 'Electronics',
  },
]

export const catalogProducts = [
  {
    id: 101,
    name: 'Apple MacBook Air M3',
    category: 'Electronics',
    price: 'KSh 260,000',
    oldPrice: 'KSh 320,000',
    seller: 'Apex Tech Hub',
    rating: 4.9,
    image:
      'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80',
    description:
      'Ultra-light laptop with all-day battery life, perfect for work, creative tasks, and streaming.',
    specs: ['13.6-inch Retina', '16GB RAM', '512GB SSD', 'Battery 18h'],
  },
  {
    id: 102,
    name: 'Samsung Galaxy S24',
    category: 'Phones & Tablets',
    price: 'KSh 126,000',
    oldPrice: 'KSh 152,000',
    seller: 'Digital World',
    rating: 4.8,
    image:
      'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80',
    description:
      'Flagship smartphone with AI features, crystal-clear camera capabilities, and a premium design.',
    specs: ['6.2-inch AMOLED', '8GB RAM', '128GB', 'Triple camera'],
  },
  {
    id: 103,
    name: 'LG Front Load Washer',
    category: 'Appliances',
    price: 'KSh 96,000',
    oldPrice: 'KSh 120,000',
    seller: 'HomeCare Store',
    rating: 4.7,
    image:
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80',
    description:
      'Energy-efficient washer with quiet operation and multiple smart programs for busy homes.',
    specs: ['8kg capacity', 'Quick wash', 'Steam care', 'Silent mode'],
  },
  {
    id: 104,
    name: 'Leather Executive Chair',
    category: 'Home & Office',
    price: 'KSh 32,000',
    oldPrice: 'KSh 42,500',
    seller: 'OfficeNest',
    rating: 4.9,
    image:
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
    description:
      'Ergonomic seating with lumbar support, smooth motion, and premium synthetic leather finish.',
    specs: ['Tilt lock', 'Height adjustable', '360° swivel', 'Durable base'],
  },
  {
    id: 105,
    name: 'Nike Air Max Trainers',
    category: 'Fashion',
    price: 'KSh 9,500',
    oldPrice: 'KSh 13,500',
    seller: 'Stride Avenue',
    rating: 4.6,
    image:
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
    description:
      'Lightweight everyday trainers built for comfort, city walks, and casual style.',
    specs: ['Mesh upper', 'Air cushioning', 'Unisex fit', 'Fresh colors'],
  },
  {
    id: 106,
    name: 'Philips Hair Dryer',
    category: 'Health & Beauty',
    price: 'KSh 7,200',
    oldPrice: 'KSh 9,900',
    seller: 'Glow Essentials',
    rating: 4.8,
    image:
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80',
    description:
      'High-speed, low-noise styling tool with multiple heat settings for fast salon-style results.',
    specs: ['1600W', 'Ionic care', 'Cool shot', 'Travel ready'],
  },
  {
    id: 107,
    name: 'Portable Blender',
    category: 'Groceries',
    price: 'KSh 4,900',
    oldPrice: 'KSh 6,600',
    seller: 'FreshDaily',
    rating: 4.5,
    image:
      'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=900&q=80',
    description:
      'Compact smoothie maker for quick shakes, protein drinks, and healthy routines at home.',
    specs: ['500ml jar', 'USB charged', 'Easy clean', 'Lightweight'],
  },
  {
    id: 108,
    name: 'Coca-Cola Original',
    category: 'Drinks',
    brand: 'Coca-Cola',
    price: 'KSh 150',
    oldPrice: 'KSh 200',
    seller: 'DrinksHub',
    rating: 4.9,
    image: '/drinks/cococola1.jpeg',
    description:
      'Classic Coca-Cola with the iconic taste. Refreshing carbonated drink perfect for any occasion.',
    specs: ['330ml bottle', 'Ice cold served best', 'Iconic taste', 'Carbonated'],
  },
  {
    id: 109,
    name: 'Coca-Cola Zero Sugar',
    category: 'Drinks',
    brand: 'Coca-Cola',
    price: 'KSh 150',
    oldPrice: 'KSh 200',
    seller: 'DrinksHub',
    rating: 4.8,
    image: '/drinks/Zero sugars Coke1.jpeg',
    description:
      'Same great taste of Coca-Cola with zero sugar. Perfect for health-conscious consumers.',
    specs: ['330ml bottle', 'Zero sugar', 'No calories', 'Great taste'],
  },
  {
    id: 110,
    name: 'Fanta Orange',
    category: 'Drinks',
    brand: 'Fanta',
    price: 'KSh 120',
    oldPrice: 'KSh 160',
    seller: 'DrinksHub',
    rating: 4.6,
    image: '/drinks/fantaorange1.jpeg',
    description:
      'Vibrant orange flavored drink with a fun, fruity taste.',
    specs: ['330ml bottle', 'Bright orange flavor', 'Refreshing', 'Carbonated'],
  },
  {
    id: 111,
    name: 'Fanta Pineapple',
    category: 'Drinks',
    brand: 'Fanta',
    price: 'KSh 120',
    oldPrice: 'KSh 160',
    seller: 'DrinksHub',
    rating: 4.7,
    image: '/drinks/FantaPineapple1.jpeg',
    description:
      'Tropical pineapple flavored drink with a sweet, refreshing taste.',
    specs: ['330ml bottle', 'Pineapple flavor', 'Tropical taste', 'Carbonated'],
  },
  {
    id: 112,
    name: 'Fanta Passion Fruit',
    category: 'Drinks',
    brand: 'Fanta',
    price: 'KSh 120',
    oldPrice: 'KSh 160',
    seller: 'DrinksHub',
    rating: 4.7,
    image: '/drinks/fantapassion1.jpeg',
    description:
      'Exotic passion fruit flavored drink with an exciting, fruity taste.',
    specs: ['330ml bottle', 'Passion fruit flavor', 'Exotic taste', 'Carbonated'],
  },
  {
    id: 113,
    name: 'Sprite',
    category: 'Drinks',
    brand: 'Sprite',
    price: 'KSh 120',
    oldPrice: 'KSh 160',
    seller: 'DrinksHub',
    rating: 4.8,
    image: '/drinks/sprite1.jpeg',
    description:
      'Crisp lemon-lime flavored drink with a clean, refreshing taste.',
    specs: ['330ml bottle', 'Lemon-lime flavor', 'Crisp & clean', 'Carbonated'],
  },
  {
    id: 114,
    name: 'Red Bull',
    category: 'Drinks',
    brand: 'Red Bull',
    price: 'KSh 350',
    oldPrice: 'KSh 450',
    seller: 'DrinksHub',
    rating: 4.9,
    image: '/drinks/redbull1.jpeg',
    description:
      'Energy drink that gives you wings. Perfect for active lifestyle.',
    specs: ['250ml can', 'Energy boost', 'Vegan ingredients', 'Taurine & B vitamins'],
  },
  {
    id: 115,
    name: 'Monster Energy',
    category: 'Drinks',
    brand: 'Monster',
    price: 'KSh 400',
    oldPrice: 'KSh 500',
    seller: 'DrinksHub',
    rating: 4.7,
    image: '/drinks/monster1.jpeg',
    description:
      'Unleash the beast energy drink for your extreme lifestyle.',
    specs: ['500ml can', 'High energy', 'Bold flavor', 'Powerful boost'],
  },
  {
    id: 116,
    name: 'Fanta Blackcurrant',
    category: 'Drinks',
    brand: 'Fanta',
    price: 'KSh 120',
    oldPrice: 'KSh 160',
    seller: 'DrinksHub',
    rating: 4.6,
    image: '/drinks/Fanta Blackcurrant1.jpeg',
    description:
      'Rich blackcurrant flavored drink with a deep, fruity taste.',
    specs: ['330ml bottle', 'Blackcurrant flavor', 'Rich taste', 'Carbonated'],
  },
  {
    id: 117,
    name: 'Stoney Tangawizi',
    category: 'Drinks',
    brand: 'Stoney',
    price: 'KSh 100',
    oldPrice: 'KSh 150',
    seller: 'DrinksHub',
    rating: 4.5,
    image: '/drinks/StoneyTangawizi1.jpeg',
    description:
      'Traditional ginger flavored drink with a spicy, warming taste.',
    specs: ['330ml bottle', 'Ginger flavor', 'Warm spice', 'Carbonated'],
  },
  {
    id: 118,
    name: 'Afia Mango Juice',
    category: 'Drinks',
    brand: 'Afia',
    price: 'KSh 100',
    oldPrice: 'KSh 140',
    seller: 'FreshDaily',
    rating: 4.6,
    image: '/fruit-drinks/Afia Mango1.webp',
    description:
      'Sweet, pulpy mango juice made from ripe Kenyan mangoes. Refreshing and full of flavour.',
    specs: ['400ml bottle', 'Real mango pulp', 'Vitamin C', 'No preservatives'],
  },
  {
    id: 119,
    name: 'Afia Mixed Fruit Juice',
    category: 'Drinks',
    brand: 'Afia',
    price: 'KSh 100',
    oldPrice: 'KSh 140',
    seller: 'FreshDaily',
    rating: 4.7,
    image: '/fruit-drinks/Afia Mixed fruit1.jpg',
    description:
      'A tropical blend of mixed fruit flavours for a naturally sweet, refreshing drink.',
    specs: ['400ml bottle', 'Mixed fruit blend', 'Refreshing', 'No preservatives'],
  },
  {
    id: 120,
    name: 'Afia Apple Juice',
    category: 'Drinks',
    brand: 'Afia',
    price: 'KSh 100',
    oldPrice: 'KSh 140',
    seller: 'FreshDaily',
    rating: 4.5,
    image: '/fruit-drinks/af1 Apple1.webp',
    description:
      'Crisp and naturally sweet apple juice made from quality apples.',
    specs: ['400ml bottle', 'Apple flavour', 'Naturally sweet', 'No preservatives'],
  },
  {
    id: 121,
    name: 'Del Monte Apple Juice',
    category: 'Drinks',
    brand: 'Del Monte',
    price: 'KSh 230',
    oldPrice: 'KSh 280',
    seller: 'JuiceBox',
    rating: 4.8,
    image: '/fruit-drinks/Del Monte Apple juice1.jpg',
    description:
      '100% pure apple juice with a crisp, clean taste. Great for the whole family.',
    specs: ['1L bottle', '100% juice', 'No added sugar', 'Family size'],
  },
  {
    id: 122,
    name: 'Del Monte Mango Juice',
    category: 'Drinks',
    brand: 'Del Monte',
    price: 'KSh 230',
    oldPrice: 'KSh 280',
    seller: 'JuiceBox',
    rating: 4.9,
    image: '/fruit-drinks/Del Monte Mango Juice 1.webp',
    description:
      'Rich and creamy mango juice made from sun-ripened mangoes.',
    specs: ['1L bottle', '100% juice', 'Sun-ripened mangoes', 'No added sugar'],
  },
  {
    id: 123,
    name: 'Del Monte Mixed Berries Juice',
    category: 'Drinks',
    brand: 'Del Monte',
    price: 'KSh 240',
    oldPrice: 'KSh 290',
    seller: 'JuiceBox',
    rating: 4.8,
    image: '/fruit-drinks/Del Monte Mixed beries1.jpg',
    description:
      'A delicious blend of berries packed with antioxidants and flavour.',
    specs: ['1L bottle', 'Berries blend', 'Rich in antioxidants', 'No added sugar'],
  },
  {
    id: 124,
    name: 'Del Monte Orange Juice',
    category: 'Drinks',
    brand: 'Del Monte',
    price: 'KSh 230',
    oldPrice: 'KSh 280',
    seller: 'JuiceBox',
    rating: 4.8,
    image: '/fruit-drinks/Del Monte Orange Juice1.jpg',
    description:
      'Bright, citrusy orange juice loaded with vitamin C for a fresh start.',
    specs: ['1L bottle', 'Vitamin C', '100% juice', 'No added sugar'],
  },
  {
    id: 125,
    name: 'Del Monte Passion Fruit Juice',
    category: 'Drinks',
    brand: 'Del Monte',
    price: 'KSh 240',
    oldPrice: 'KSh 290',
    seller: 'JuiceBox',
    rating: 4.9,
    image: '/fruit-drinks/Del Monte Passion Fruit1.jpg',
    description:
      'Exotic passion fruit juice with a tangy, tropical taste.',
    specs: ['1L bottle', 'Passion fruit', 'Tropical tang', 'No added sugar'],
  },
  {
    id: 126,
    name: 'Del Monte Pineapple Juice',
    category: 'Drinks',
    brand: 'Del Monte',
    price: 'KSh 230',
    oldPrice: 'KSh 280',
    seller: 'JuiceBox',
    rating: 4.7,
    image: '/fruit-drinks/Del Monte Pinaple Juice 1.webp',
    description:
      'Sweet and refreshing pineapple juice with a sunny tropical flavour.',
    specs: ['1L bottle', 'Pineapple', 'Sunny flavour', 'No added sugar'],
  },
  {
    id: 127,
    name: 'Minute Maid Apple Juice',
    category: 'Drinks',
    brand: 'Minute Maid',
    price: 'KSh 150',
    oldPrice: 'KSh 190',
    seller: 'FreshDaily',
    rating: 4.6,
    image: '/fruit-drinks/Minute Maid Apple1.jpg',
    description:
      'Crisp apple juice with the clean, fresh taste of real apples.',
    specs: ['400ml bottle', 'Apple flavour', 'Refreshing', 'Real fruit'],
  },
  {
    id: 128,
    name: 'Minute Maid Delight Tropical',
    category: 'Drinks',
    brand: 'Minute Maid',
    price: 'KSh 150',
    oldPrice: 'KSh 190',
    seller: 'FreshDaily',
    rating: 4.7,
    image: '/fruit-drinks/Minute Maid Delight tropical1.webp',
    description:
      'A tropical delight blending exotic fruit flavours for a sweet escape.',
    specs: ['400ml bottle', 'Tropical blend', 'Exotic taste', 'Real fruit'],
  },
  {
    id: 129,
    name: 'Minute Maid Pulpy Orange',
    category: 'Drinks',
    brand: 'Minute Maid',
    price: 'KSh 160',
    oldPrice: 'KSh 200',
    seller: 'FreshDaily',
    rating: 4.8,
    image: '/fruit-drinks/Minute Maid Pulpy Orange.png',
    description:
      'Orange juice with real fruit pulp for a thick, satisfying sip.',
    specs: ['400ml bottle', 'Real pulp', 'Vitamin C', 'Squeezed oranges'],
  },
  {
    id: 130,
    name: 'Minute Maid Mango Juice',
    category: 'Drinks',
    brand: 'Minute Maid',
    price: 'KSh 150',
    oldPrice: 'KSh 190',
    seller: 'FreshDaily',
    rating: 4.7,
    image: '/fruit-drinks/Minute Maid mango1.jpg',
    description:
      'Sweet mango juice made with real mango puree for a rich taste.',
    specs: ['400ml bottle', 'Mango puree', 'Rich taste', 'Real fruit'],
  },
]

export const deals = [
  { title: 'Flash Sale', subtitle: 'Up to 60% off' },
  { title: 'Free Delivery', subtitle: 'On orders above KSh 10,000' },
  { title: 'Pay on Delivery', subtitle: 'Available in major cities' },
]

export const trendingProducts = [
  {
    name: 'Air Fryer XL',
    price: 'KSh 19,500',
    image:
      'https://images.unsplash.com/photo-1585518419759-7fe2e0fbf8a6?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Leather Office Chair',
    price: 'KSh 28,000',
    image:
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Ninja Blender',
    price: 'KSh 14,900',
    image:
      'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Women\'s Sneakers',
    price: 'KSh 6,800',
    image:
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Fitness Smartwatch',
    price: 'KSh 9,500',
    image:
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: '4K Streaming Stick',
    price: 'KSh 12,800',
    image:
      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80',
  },
]

export const benefits = ['Secure checkout', 'Fast delivery', 'Verified sellers', 'Customer support']

// Dropdown subcategory menus shown on category pages.
// Each entry: { category: <exact category name>, groups: [{ name, items: [{ name, brands: [] }] }] }
export const categoryMenus = [
  {
    category: 'Drinks',
    groups: [
      {
        name: 'Softdrinks',
        items: [
          { name: 'All Drinks', brands: ['Coca-Cola', 'Fanta', 'Sprite', 'Red Bull', 'Monster', 'Stoney'] },
          { name: 'Coca-Cola', brands: ['Coca-Cola'] },
          { name: 'Fanta', brands: ['Fanta'] },
          { name: 'Sprite', brands: ['Sprite'] },
          { name: 'Red Bull', brands: ['Red Bull'] },
          { name: 'Monster', brands: ['Monster'] },
          { name: 'Stoney', brands: ['Stoney'] },
        ],
      },
      {
        name: 'Fruit Drinks',
        items: [
          { name: 'All Fruit Drinks', brands: ['Afia', 'Del Monte', 'Minute Maid'] },
          { name: 'Afia', brands: ['Afia'] },
          { name: 'Del Monte', brands: ['Del Monte'] },
          { name: 'Minute Maid', brands: ['Minute Maid'] },
        ],
      },
    ],
  },
]

export const siteContent = {
  hero: {
    eyebrow: 'Shop smarter in Kenya',
    title: 'Everything you need, from trusted sellers.',
    text: 'Compare deals, discover local stores, and buy with confidence across electronics, fashion, home essentials, and more.',
    stats: [
      { value: '120k+', label: 'Products' },
      { value: '4.8/5', label: 'Ratings' },
      { value: '24/7', label: 'Support' },
    ],
  },
  promo: ['⚡ New deals every day', 'Free delivery over KSh 10,000', 'Pay on delivery available'],
}
