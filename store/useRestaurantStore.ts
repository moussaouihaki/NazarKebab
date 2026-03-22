import { create } from 'zustand';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PRODUCTS as INITIAL_PRODUCTS, CATEGORIES as INITIAL_CATEGORIES, Product } from '../constants/data';

export interface OpeningHours {
  day: string;
  isOpen: boolean;
  open: string;  // "11:00"
  close: string; // "23:00"
}

export interface Drink {
  name: string;
  price: number;
  size: string; // "33cl", "50cl", "1.5L"
  outOfStock?: boolean;
}

export interface RestaurantSettings {
  name: string;
  slogan: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  instagram: string;
  facebook: string;
  hours: OpeningHours[];
  acceptsDelivery: boolean;
  acceptsPickup: boolean;
  isOpen: boolean; // force open/close override
  openOverrideMessage: string;
  sauces: string[];
  drinks: Drink[];
}

interface RestaurantState {
  products: Product[];
  categories: string[];
  settings: RestaurantSettings;
  isLoading: boolean;

  // Actions
  fetchInitialData: () => Promise<void>;
  
  // Product actions
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  // Category actions
  addCategory: (name: string) => Promise<void>;
  deleteCategory: (name: string) => Promise<void>;

  // Settings actions
  updateSettings: (data: Partial<RestaurantSettings>) => Promise<void>;
  updateHours: (day: string, data: Partial<OpeningHours>) => Promise<void>;
  updateSauces: (sauces: string[]) => Promise<void>;
  updateDrinks: (drinks: Drink[]) => Promise<void>;
}

const DEFAULT_HOURS: OpeningHours[] = [
  { day: 'Lundi',    isOpen: true,  open: '11:00', close: '23:00' },
  { day: 'Mardi',    isOpen: true,  open: '11:00', close: '23:00' },
  { day: 'Mercredi', isOpen: true,  open: '11:00', close: '23:00' },
  { day: 'Jeudi',    isOpen: true,  open: '11:00', close: '23:00' },
  { day: 'Vendredi', isOpen: true,  open: '11:00', close: '00:00' },
  { day: 'Samedi',   isOpen: true,  open: '11:00', close: '00:00' },
  { day: 'Dimanche', isOpen: true,  open: '11:00', close: '00:00' },
];

const DEFAULT_SETTINGS: RestaurantSettings = {
  name: 'Nazar Kebab',
  slogan: 'Kebab | Pizza | Tacos',
  address: 'Grand-Rue 9, 2900 Porrentruy',
  phone: '032 757 44 44',
  email: 'contact@nazarkebab.ch',
  website: 'www.nazarkebab.ch',
  instagram: '@nazarkebab.ch',
  facebook: '@nazarkebab.ch',
  hours: DEFAULT_HOURS,
  acceptsDelivery: true,
  acceptsPickup: true,
  isOpen: true,
  openOverrideMessage: '',
  sauces: ['Sauce Blanche', 'Harissa', 'Andalouse', 'Ketchup', 'Mayonnaise', 'Samouraï', 'Algérienne', 'Sans Sauce'],
  drinks: [
    { name: 'Coca-Cola', price: 3.50, size: '33cl' },
    { name: 'Coca-Cola Zero', price: 3.50, size: '33cl' },
    { name: 'Fanta', price: 3.50, size: '33cl' },
    { name: 'Sprite', price: 3.50, size: '33cl' },
    { name: 'Ice Tea Pêche', price: 3.50, size: '33cl' },
    { name: 'Ice Tea Citron', price: 3.50, size: '33cl' },
    { name: 'Ayran', price: 2.50, size: '25cl' },
    { name: 'Eau Gazéifiée', price: 3.00, size: '50cl' },
    { name: 'Eau Plate', price: 3.00, size: '50cl' },
  ],
};

export const useRestaurantStore = create<RestaurantState>((set, get) => ({
  products: [],
  categories: [],
  settings: DEFAULT_SETTINGS,
  isLoading: false,

  fetchInitialData: async () => {
    set({ isLoading: true });
    try {
      // 1. Fetch Settings
      const settingsDoc = await getDoc(doc(db, 'settings', 'restaurant'));
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        set({ settings: { ...DEFAULT_SETTINGS, ...data } as RestaurantSettings });
      } else {
        // First initialization
        await setDoc(doc(db, 'settings', 'restaurant'), DEFAULT_SETTINGS);
      }

      // 2. Fetch Categories
      const categoriesDoc = await getDoc(doc(db, 'settings', 'categories'));
      if (categoriesDoc.exists()) {
        set({ categories: categoriesDoc.data().list });
      } else {
        await setDoc(doc(db, 'settings', 'categories'), { list: INITIAL_CATEGORIES });
        set({ categories: INITIAL_CATEGORIES });
      }

      // 3. Listen to Products in real-time
      onSnapshot(collection(db, 'products'), (snapshot) => {
        const prodList: Product[] = [];
        snapshot.forEach(async (docSnap) => {
          const data = docSnap.data();
          let image = data.image;

          // Auto-repair: If image is a number (old require mode), sync it to a key
          if (typeof image === 'number') {
            // Find a match in INITIAL_PRODUCTS to get the original key
            const initial = INITIAL_PRODUCTS.find(p => p.id === docSnap.id);
            if (initial) {
              // We need to find which key in IMAGES_MAP this number belongs to
              // but since we don't have the map here easily, we can just use the name as fallback
              // Better: For seeding, see below.
              // For now, let's just make sure we don't crash and try to use it.
            }
          }
          
          prodList.push({ id: docSnap.id, ...data } as Product);
        });
        
        // Seed initial products if collection is empty or force sync for images
        if (prodList.length === 0 && INITIAL_PRODUCTS.length > 0) {
          INITIAL_PRODUCTS.forEach(async (p) => {
            const { id, image, ...rest } = p;
            // Find the key name in IMAGES_MAP for this image
            // We'll update constants/data.ts to use strings primarily
            await setDoc(doc(db, 'products', id), { ...rest, image: p.id.split('-')[0] }); 
          });
        } else {
          set({ products: prodList });
        }
      });

    } catch (err) {
      console.error('Erreur chargement données restaurant:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  addProduct: async (productData) => {
    try {
      const newDocRef = doc(collection(db, 'products'));
      await setDoc(newDocRef, productData);
    } catch (err) {
      console.error('Erreur ajout produit:', err);
    }
  },

  updateProduct: async (id, data) => {
    try {
      await updateDoc(doc(db, 'products', id), data);
    } catch (err) {
      console.error('Erreur MAJ produit:', err);
    }
  },

  deleteProduct: async (id) => {
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (err) {
      console.error('Erreur suppression produit:', err);
    }
  },

  addCategory: async (name) => {
    const trimmed = name.toUpperCase().trim();
    if (!get().categories.includes(trimmed)) {
      const newList = [...get().categories, trimmed];
      try {
        await setDoc(doc(db, 'settings', 'categories'), { list: newList });
        set({ categories: newList });
      } catch (err) {
        console.error('Erreur ajout catégorie:', err);
      }
    }
  },

  deleteCategory: async (name) => {
    try {
      const newList = get().categories.filter(c => c !== name);
      await setDoc(doc(db, 'settings', 'categories'), { list: newList });
      
      // Note: We might want to keep products but remove their category link, 
      // or delete them. For now, let's just update categories.
      set({ categories: newList });
    } catch (err) {
      console.error('Erreur suppression catégorie:', err);
    }
  },

  updateSettings: async (data) => {
    try {
      const updated = { ...get().settings, ...data };
      await setDoc(doc(db, 'settings', 'restaurant'), updated);
      set({ settings: updated });
    } catch (err) {
      console.error('Erreur MAJ réglages:', err);
    }
  },

  updateHours: async (day, data) => {
    try {
      const newHours = get().settings.hours.map(h => h.day === day ? { ...h, ...data } : h);
      const updatedSettings = { ...get().settings, hours: newHours };
      await setDoc(doc(db, 'settings', 'restaurant'), updatedSettings);
      set({ settings: updatedSettings });
    } catch (err) {
      console.error('Erreur MAJ horaires:', err);
    }
  },

  updateSauces: async (sauces: string[]) => {
    try {
      const updatedSettings = { ...get().settings, sauces };
      await setDoc(doc(db, 'settings', 'restaurant'), updatedSettings);
      set({ settings: updatedSettings });
    } catch (err) {
      console.error('Erreur MAJ sauces:', err);
    }
  },

  updateDrinks: async (drinks: Drink[]) => {
    try {
      const updatedSettings = { ...get().settings, drinks };
      await setDoc(doc(db, 'settings', 'restaurant'), updatedSettings);
      set({ settings: updatedSettings });
    } catch (err) {
      console.error('Erreur MAJ boissons:', err);
    }
  },
}));

export const checkIsRestaurantOpen = (settings: RestaurantSettings): boolean => {
  if (!settings.isOpen) return false; // Master override

  const now = new Date();
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const todayName = days[now.getDay()];

  const todayHours = settings.hours.find(h => h.day === todayName);
  if (!todayHours || !todayHours.isOpen) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const parseTime = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const openMinutes = parseTime(todayHours.open);
  let closeMinutes = parseTime(todayHours.close);

  if (closeMinutes <= openMinutes) {
    // Closes past midnight (e.g., "00:00" or "02:00")
    closeMinutes += 24 * 60;
  }

  let currentCompare = currentMinutes;
  // If it's early morning (e.g. 01:00) and the store closed past midnight
  if (currentMinutes < openMinutes && closeMinutes > 24 * 60) {
    currentCompare += 24 * 60;
  }

  return currentCompare >= openMinutes && currentCompare < closeMinutes;
};
