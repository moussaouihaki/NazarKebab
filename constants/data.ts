import { ImageSourcePropType } from 'react-native';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: any;
  category: string;
  highlighted?: boolean;
  outOfStock?: boolean;
  hasSauces?: boolean;
  hasDrinkSelection?: boolean;
}

export const IMAGES_MAP: Record<string, any> = {
  kebab: require('../assets/images/kebab.png'),
  durum: require('../assets/images/durum.png'),
  tacos: require('../assets/images/tacos.png'),
  burger: require('../assets/images/burger.png'),
  sandwich: require('../assets/images/sandwich.png'),
  lahmacun: require('../assets/images/lahmacun.png'),
  pide: require('../assets/images/pide.png'),
  assiette: require('../assets/images/assiette.png'),
  menu_etudiant: require('../assets/images/menu_etudiant.png'),
  pizza: require('../assets/images/pizza.png'),
  dessert: require('../assets/images/baklava.png'),
  tiramisu: require('../assets/images/tiramisu.png'),
  falafel: require('../assets/images/falafel.png'),
  falafels_only: require('../assets/images/falafels_only.png'),
  kebab_box: require('../assets/images/kebab_box.png'),
  sandwich_indien: require('../assets/images/sandwich_indien.png'),
  sandwich_parisien: require('../assets/images/sandwich_parisien.png'),
  pizza_kebab: require('../assets/images/pizza_kebab.png'),
  pizza_fruits_de_mer: require('../assets/images/pizza_fruits_de_mer.png'),
  pizza_4_fromages: require('../assets/images/pizza_4_fromages.png'),
  drink_33cl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=800&q=80',
  drink_50cl: require('../assets/images/bottle_50cl.png'),
  drink_15l: 'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=800&q=80',
  drink_coffee: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80',
};

export const getImageSource = (image: any): any => {
  if (!image) return IMAGES_MAP.kebab;
  if (typeof image === 'string' && image.startsWith('http')) return { uri: image };
  if (typeof image === 'string' && IMAGES_MAP[image]) return IMAGES_MAP[image];
  return image; // Fallback for local require IDs if they happen to work
};

export const CATEGORIES = ['MENUS ÉTUDIANTS', 'MENUS MIDI', 'KEBABS', 'TACOS', 'BURGERS', 'SANDWICHS', 'SPÉCIALITÉS', 'ASSIETTES', 'PIZZAS', 'BOISSONS', 'DESSERTS'];

export const PRODUCTS: Product[] = [
  // --- MENUS ÉTUDIANTS ---
//... skipping unchanged content conceptually ...

  {
    id: 'menu-kebab-tacos',
    category: 'MENUS ÉTUDIANTS',
    name: 'KEBAB OU TACOS',
    description: '+ frites + boisson 33cl',
    price: 15.00,
    image: images.menu_etudiant,
    highlighted: true,
    hasSauces: true,
    hasDrinkSelection: true,
  },
  {
    id: 'menu-hamburger',
    category: 'MENUS ÉTUDIANTS',
    name: 'HAMBURGER',
    description: '+ frites + boisson 33cl',
    price: 15.00,
    image: images.menu_etudiant,
    hasDrinkSelection: true,
  },
  {
    id: 'menu-sandwich',
    category: 'MENUS ÉTUDIANTS',
    name: 'SANDWICH CHAUD',
    description: '+ frites + boisson 33cl',
    price: 15.00,
    image: images.menu_etudiant,
    hasSauces: true,
    hasDrinkSelection: true,
  },

  // --- MENUS MIDI ---
  {
    id: 'midi-tacos',
    category: 'MENUS MIDI',
    name: 'MENU TACOS MIDI',
    description: 'Tacos au choix + boisson 33cl',
    price: 13.00,
    image: images.tacos,
    hasSauces: true,
    hasDrinkSelection: true,
  },
  {
    id: 'midi-kebab',
    category: 'MENUS MIDI',
    name: 'MENU KEBAB MIDI',
    description: 'Kebab au choix + boisson 33cl',
    price: 12.00,
    image: images.kebab,
    hasSauces: true,
    hasDrinkSelection: true,
  },

  // --- KEBABS ---
  {
    id: 'kebab-doner',
    category: 'KEBABS',
    name: 'DÖNER KEBAB',
    description: 'Veau ou poulet. Pain maison, viande grillée, salade, tomates, oignons, sauce.',
    price: 9.00,
    image: images.kebab,
    hasSauces: true,
  },
  {
    id: 'kebab-durum',
    category: 'KEBABS',
    name: 'DÜRÜM KEBAB',
    description: 'Galette roulée, veau ou poulet.',
    price: 10.00,
    image: images.durum,
    highlighted: true,
    hasSauces: true,
  },
  {
    id: 'kebab-chicken',
    category: 'KEBABS',
    name: 'CHICKEN CHIKA',
    description: 'Pain maison ou galette, poulet chika.',
    price: 10.00,
    image: images.kebab,
  },
  {
    id: 'kebab-falafel',
    category: 'KEBABS',
    name: 'FALAFEL VEGI',
    description: 'Végétarien.',
    price: 10.00,
    image: images.falafels_only,
  },
  {
    id: 'kebab-grec',
    category: 'KEBABS',
    name: 'GREC',
    description: 'Veau ou poulet avec fromage.',
    price: 10.00,
    image: images.kebab,
  },
  {
    id: 'kebab-box',
    category: 'KEBABS',
    name: 'BOX KEBAB',
    description: 'Veau ou poulet, avec frites.',
    price: 10.00,
    image: images.kebab_box,
  },
  {
    id: 'kebab-lahmacun',
    category: 'KEBABS',
    name: 'LAHMACUN KEBAB',
    description: 'Pizza turque roulée avec viande kebab à l\'intérieur.',
    price: 15.00,
    image: images.lahmacun,
  },

  // --- TACOS ---
  ...[
    { name: 'LOS POLLOS', desc: 'Poulet mexicain, s. algérienne, salade, tomate, s. fromagère, frites.', price: 10.00 },
    { name: 'COLOMBO', desc: 'Poulet curry, s. fromagère, salade, tomate, s. au choix, frites.', price: 10.00 },
    { name: 'CORDON BLEU', desc: '2 cordons bleus, salade, tomate, s. au choix, raclette, frites.', price: 10.00 },
    { name: 'FRENCHY', desc: 'Steak haché, salade, tomate, s. fromagère, s. au choix, frites.', price: 10.00 },
    { name: 'KEBAB', desc: 'Viande de kebab, salade, tomate, sauce blanche, frites.', price: 10.00 },
    { name: 'VÉGÉTARIEN', desc: 'Galettes de légumes, salade, tomate, oignons, maïs, olives, s. fromagère.', price: 10.00 },
    { name: 'NAZAR MIXTE', desc: '2 viandes au choix, salade, tomate, frites, s. fromagère.', price: 12.00, highlighted: true },
  ].map((t, idx) => ({
    id: `tacos-${idx}`, category: 'TACOS', name: t.name, description: t.desc, price: t.price, image: images.tacos, highlighted: t.highlighted, hasSauces: true
  })),

  // --- BURGERS ---
  { id: 'burger-1', category: 'BURGERS', name: 'HAMBURGER', description: '', price: 9.00, image: images.burger },
  { id: 'burger-2', category: 'BURGERS', name: 'CHEESEBURGER', description: '', price: 10.00, image: images.burger },
  { id: 'burger-3', category: 'BURGERS', name: 'NAZARBURGER', description: 'Double steak, gourmand.', price: 12.00, image: images.burger, highlighted: true },

  // --- SANDWICHS CHAUDS ---
  { id: 'sandwich-1', category: 'SANDWICHS', name: 'AMÉRICAIN', description: 'Steaks hachés, cheddar, salade, tomate, oignons, frites.', price: 10.00, image: images.sandwich, hasSauces: true },
  { id: 'sandwich-2', category: 'SANDWICHS', name: 'INDIEN', description: 'Poulet, ananas, salade, tomates, oignon, sauce curry.', price: 10.00, image: images.sandwich_indien, hasSauces: true },
  { id: 'sandwich-3', category: 'SANDWICHS', name: 'PARISIEN', description: 'Escalope, gruyère, sauce crème aux champignons.', price: 10.00, image: images.sandwich_parisien, hasSauces: true },
  { id: 'sandwich-4', category: 'SANDWICHS', name: 'NAZAR MIXTE', description: 'Poulet, steak haché, cheddar, salade, tomate, oignons, sauce.', price: 10.00, image: 'https://images.unsplash.com/photo-1612871632598-c116de0d1cc2?w=800&q=80', highlighted: true, hasSauces: true },

  // --- SPÉCIALITÉS ---
  ...[
    { name: 'PIDE épinards & oeuf', price: 14.00 },
    { name: 'PIDE fromage & oeuf', price: 14.00 },
    { name: 'PIDE sucuk', price: 14.00 },
    { name: 'PIDE viande hachée & oeuf', price: 14.00, highlighted: true },
    { name: 'LAHMACUN', price: 14.00 }
  ].map((p, idx) => ({
    id: `spec-${idx}`, category: 'SPÉCIALITÉS', name: p.name, description: 'Spécialité turque.', price: p.price, image: p.name === 'LAHMACUN' ? images.lahmacun : images.pide, highlighted: p.highlighted
  })),

  // --- ASSIETTES ---
  ...[
    { name: 'KEBAB (veau ou poulet)', price: 18.00, highlighted: true },
    { name: 'STEAK HACHÉ', price: 16.00 },
    { name: 'CHICKEN CHIKA', price: 16.00 },
    { name: 'FALAFEL VEGI', price: 16.00 },
  ].map((a, idx) => ({
    id: `assiette-${idx}`, category: 'ASSIETTES', name: a.name, description: 'Servie avec accompagnements.', price: a.price, image: a.name === 'FALAFEL VEGI' ? images.falafels_only : images.assiette, highlighted: a.highlighted, hasSauces: true
  })),

  // --- PIZZAS ---
  ...[
    { name: 'MARGHERITA', desc: 'Sauce tomate, mozzarella', price: 11.00 },
    { name: 'CHAMPIGNONS', desc: '', price: 13.00 },
    { name: 'SALAMI', desc: '', price: 13.00 },
    { name: 'JAMBON', desc: '', price: 13.00 },
    { name: 'GORGONZOLA', desc: 'Avec oeuf', price: 14.00 },
    { name: 'JAMBON & CHAMPIGNONS', desc: '', price: 14.00 },
    { name: 'HAWAÏ', desc: 'Jambon & ananas', price: 14.00 },
    { name: 'NAPOLI', desc: 'Anchois et câpres', price: 14.00 },
    { name: '4 FROMAGES', desc: '', price: 15.00, imageType: images.pizza_4_fromages },
    { name: 'THON', desc: 'Thon, câpres, olives et oignons', price: 15.00 },
    { name: 'PAYSANNE', desc: 'Lard, poivrons et oignons', price: 16.00 },
    { name: 'CARBONARA', desc: 'Crème, jambon, lard, oeuf et parmesan', price: 16.00 },
    { name: 'SUCUK', desc: 'Sucuk, oeuf, champignons, piment et oignons', price: 16.00, imageType: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=800&q=80', highlighted: true },
    { name: 'CALZONE (fermée)', desc: 'Jambon, champignons, épinards, oeuf et pesto', price: 16.00 },
    { name: 'ROMA', desc: 'Salami, jambon et lard', price: 16.00 },
    { name: 'AMÉRICAINE', desc: 'Viande hachée, oignons, poivrons et oeuf', price: 16.00 },
    { name: 'INDIENNE', desc: 'Poulet, ananas et maïs', price: 16.00 },
    { name: 'CREVETTES', desc: '', price: 16.00, imageType: images.pizza_fruits_de_mer },
    { name: '4 SAISONS', desc: 'Jambon, champignons, artichauts, poivrons, olives', price: 16.00 },
    { name: 'FRUITS DE MER', desc: 'Mélange de fruits de mer et ail', price: 16.00, imageType: images.pizza_fruits_de_mer },
    { name: 'KEBAB', desc: '', price: 17.00, imageType: images.pizza_kebab },
    { name: 'AU CHOIX', desc: '4 ingrédients au choix', price: 18.00 },
  ].map((p, idx) => ({
    id: `pizza-${idx}`, category: 'PIZZAS', name: p.name, description: p.desc || 'Pizza artisanale pâte fraîche 30cm', price: p.price, image: (p as any).imageType || images.pizza, highlighted: p.highlighted
  })),

  // --- BOISSONS ---
  { id: 'boisson-1', category: 'BOISSONS', name: 'BOISSON EN CANNETTE 33CL', description: 'Coca, Fanta, Sprite...', price: 3.00, image: images.drink_33cl, hasDrinkSelection: true },
  { id: 'boisson-2', category: 'BOISSONS', name: 'BOISSON EN BOUTEILLE 50CL', description: 'Selectionnez votre boisson.', price: 3.50, image: images.drink_50cl, hasDrinkSelection: true },
  { id: 'boisson-3', category: 'BOISSONS', name: 'BOISSON EN BOUTEILLE 1.5L', description: 'Selectionnez votre boisson.', price: 6.00, image: images.drink_15l, hasDrinkSelection: true },
  { id: 'boisson-4', category: 'BOISSONS', name: 'CAFÉ ET THÉ', description: '', price: 3.00, image: images.drink_coffee },

  // --- DESSERTS ---
  { id: 'dessert-1', category: 'DESSERTS', name: 'BAKLAVA 3 pièces', description: '', price: 6.00, image: images.dessert },
  { id: 'dessert-2', category: 'DESSERTS', name: 'TIRAMISU', description: '', price: 6.00, image: images.tiramisu },
];
