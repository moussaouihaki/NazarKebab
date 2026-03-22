import { create } from 'zustand';
import * as Notifications from 'expo-notifications';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from './useAuthStore';
import { sendPushNotification } from '../lib/pushNotifications';
import { useNotificationStore } from './useNotificationStore';

export type OrderStatus =
  | 'pending'       // En attente de confirmation
  | 'confirmed'     // Confirmée par le restaurant
  | 'preparing'     // En préparation
  | 'ready'         // Prête / En route
  | 'delivered'     // Livrée
  | 'cancelled';    // Annulée

export interface Product {
  id: string;
  name: string;
  price: number;
  image: any;
  description?: string;
  category?: string;
  highlighted?: boolean;
}

export interface CartItem extends Product {
  quantity: number;
  note?: string; // Note individuelle (ex: sans oignons)
}

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  status: OrderStatus;
  createdAt: any;
  updatedAt: any;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  deliveryType: 'delivery' | 'pickup';
  estimatedTime: number; // minutes
  note?: string; // Note générale
  isPaid: boolean;
  paymentMethod: string;
  subTotal: number;
  taxAmount: number;
  userId?: string;
  pushToken?: string;
}

interface CartState {
  // Cart
  items: CartItem[];
  total: number;
  deliveryFee: number;
  deliveryType: 'delivery' | 'pickup';
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  orderNote: string;

  // Orders history
  orders: Order[];
  activeOrder: Order | null;
  isLoading: boolean;

  // Actions
  listenToOrders: (userId?: string, isAdmin?: boolean, specificOrderId?: string) => () => void;
  addItem: (product: Product, note?: string) => void;
  removeItem: (cartItemId: string) => void;
  removeAllOfItem: (cartItemId: string) => void;
  clearCart: () => void;
  setDeliveryType: (type: 'delivery' | 'pickup') => void;
  setDeliveryFee: (fee: number) => void;
  setCustomerInfo: (name: string, phone: string, address: string) => void;
  setOrderNote: (note: string) => void;

  // Order Actions
  placeOrder: (userId?: string) => Promise<Order>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;
  markAsPaid: (orderId: string, method: string) => Promise<void>;
}

const generateOrderId = () => {
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `NZ-${num}`;
};

const hashNote = (note: string) => {
  let hash = 0;
  for (let i = 0; i < note.length; i++) {
    hash = (hash << 5) - hash + note.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
};

// Nettoyage récursif pour éviter les erreurs "undefined" de Firebase
const cleanForFirebase = (obj: any): any => {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date || obj instanceof Timestamp) return obj;

  const clean: any = Array.isArray(obj) ? [] : {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key];
      clean[key] = val === undefined ? null : cleanForFirebase(val);
    }
  }
  return clean;
};

import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ... (keep previous interfaces)

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      total: 0,
      deliveryFee: 0,
      deliveryType: 'delivery',
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      orderNote: '',
      orders: [],
      activeOrder: null,
      isLoading: false,

  listenToOrders: (userId?: string, isAdmin?: boolean, specificOrderId?: string) => {
    let q;
    if (isAdmin) {
      q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    } else if (userId) {
      q = query(collection(db, 'orders'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
    } else if (specificOrderId) {
      // Pour les comptes invités, on écoute spécifiquement l'ID de la commande
      q = query(collection(db, 'orders'), where('__name__', '==', specificOrderId));
    } else {
      return () => {};
    }

    return onSnapshot(q, (snapshot) => {
      const orderList: Order[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        orderList.push({
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
        } as Order);
      });
      set({ orders: orderList });
 
      // Update active order if it is in the list
      const currentActiveId = get().activeOrder?.id || specificOrderId;
      if (currentActiveId) {
        const matching = orderList.find(o => o.id === currentActiveId);
        if (matching) {
          const currentActive = get().activeOrder;
          // If status changed, notify the user
          if (currentActive && matching.status !== currentActive.status) {
            const statusMessages: any = {
              confirmed: "Le restaurant a validé votre commande !",
              preparing: "Votre repas est en préparation 👨‍🍳",
              ready: "Votre commande est prête / en route ! 🛵",
              delivered: "Bon appétit ! Votre commande a été livrée.",
              cancelled: "Désolé, votre commande a été annulée."
            };
            if (statusMessages[matching.status]) {
              Notifications.scheduleNotificationAsync({
                content: { title: "Nazar Kebab 🗞️", body: statusMessages[matching.status], sound: true },
                trigger: null
              });
            }
          }
          set({ activeOrder: matching });
        }
      }
    });
  },

  addItem: (product, note) => {
    const currentItems = get().items;
    const uniqueId = note ? `${product.id}-${hashNote(note)}` : product.id;
    const existingItem = currentItems.find((item) => item.id === uniqueId);
    let newItems: CartItem[];
    if (existingItem) {
      newItems = currentItems.map((item) =>
        item.id === uniqueId ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      newItems = [...currentItems, { ...product, id: uniqueId, quantity: 1, note }];
    }
    const total = newItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
    set({ items: newItems, total });
  },

  removeItem: (cartItemId) => {
    const currentItems = get().items;
    const existingItem = currentItems.find((item) => item.id === cartItemId);
    let newItems: CartItem[];
    if (existingItem && existingItem.quantity > 1) {
      newItems = currentItems.map((item) =>
        item.id === cartItemId ? { ...item, quantity: item.quantity - 1 } : item
      );
    } else {
      newItems = currentItems.filter((item) => item.id !== cartItemId);
    }
    const total = newItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
    set({ items: newItems, total });
  },

  removeAllOfItem: (cartItemId) => {
    const newItems = get().items.filter((item) => item.id !== cartItemId);
    const total = newItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
    set({ items: newItems, total });
  },

  clearCart: () => set({ items: [], total: 0, orderNote: '' }),

  setDeliveryType: (type) => set({ deliveryType: type, deliveryFee: 0 }),
  setDeliveryFee: (fee) => set({ deliveryFee: fee }),

  setCustomerInfo: (name, phone, address) => {
    set({ customerName: name, customerPhone: phone, customerAddress: address });
  },

  setOrderNote: (note) => set({ orderNote: note }),

  placeOrder: async (userId) => {
    const state = get();
    const grandTotal = state.total + state.deliveryFee;
    const taxRate = 0.026;
    const subTotal = grandTotal / (1 + taxRate);
    const taxAmount = grandTotal - subTotal;

    const currentUser = useAuthStore.getState().user;
    const pushToken = currentUser?.pushToken || null;

    const orderId = generateOrderId();
    const safeItems = state.items.map(item => ({
      id: item.id || null,
      name: item.name || "",
      price: item.price || 0,
      quantity: item.quantity || 1,
      image: item.image || null,
      description: item.description || null,
      category: item.category || null,
      note: item.note || null,
    }));

    const orderData: any = {
      items: safeItems,
      total: grandTotal,
      status: 'pending',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      customerName: state.customerName || 'Client',
      customerPhone: state.customerPhone || '---',
      customerAddress: state.customerAddress || 'Sur place',
      deliveryType: state.deliveryType,
      estimatedTime: state.deliveryType === 'delivery' ? 30 : 15,
      note: state.orderNote || null,
      isPaid: false,
      paymentMethod: 'À la livraison',
      subTotal: subTotal || grandTotal,
      taxAmount: taxAmount || 0,
      userId: userId || null,
      pushToken: pushToken || null // Jamais undefined pour Firestore
    };

    try {
      await setDoc(doc(db, 'orders', orderId), cleanForFirebase(orderData));

      const order = { ...orderData, id: orderId, createdAt: new Date(), updatedAt: new Date() };
      set(s => ({ activeOrder: order, items: [], total: 0, orderNote: '' }));

      // Send local push
      Notifications.scheduleNotificationAsync({
        content: {
          title: "🔔 Nouvelle Commande",
          body: `🛒 Merci ! Votre commande #${orderId} a été envoyée au restaurant.`,
          sound: true,
        },
        trigger: null,
      });

      useNotificationStore.getState().addNotification(
        "📦 Commande Envoyée",
        `Votre commande #${orderId} est en attente de confirmation.`
      );

      // --- SERVERLESS REMOTE PUSH (to Admins) ---
      try {
        const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
        const adminDocs = await getDocs(adminQuery);
        adminDocs.forEach(d => {
          const adm = d.data();
          if (adm.pushToken) {
            sendPushNotification(
              adm.pushToken,
              "🚨 Nouvelle Commande",
              `Commande #${orderId} passée par ${orderData.customerName} (${orderData.total.toFixed(2)} CHF)`
            );
          }
        });
      } catch(e) {
        console.warn('Erreur notification admin', e);
      }

      return order;
    } catch (err) {
      console.error('Erreur placement commande:', err);
      throw err;
    }
  },

  updateOrderStatus: async (orderId, status) => {
    try {
      const updateData: any = {
        status,
        updatedAt: Timestamp.now()
      };

      // Automatically mark as paid when delivered (Common for takeaway/delivery businesses)
      if (status === 'delivered') {
        updateData.isPaid = true;
      }

      await updateDoc(doc(db, 'orders', orderId), updateData);

      const statusMessages: Record<string, { title: string, body: string }> = {
        confirmed: { title: "✅ Commande Confirmée", body: `Votre commande #${orderId} a été confirmée.` },
        preparing: { title: "👨‍🍳 En Préparation", body: `Votre commande #${orderId} est en préparation.` },
        ready: { title: "🛍️ Commande Prête", body: `Votre commande #${orderId} est prête !` },
        delivered: { title: "🎉 Commande Terminée", body: `Votre commande #${orderId} a été livrée. Merci !` },
        cancelled: { title: "❌ Commande Annulée", body: `Votre commande #${orderId} a été annulée.` }
      };

      if (statusMessages[status]) {
        const { title, body } = statusMessages[status];
        useNotificationStore.getState().addNotification(
          title,
          body
        );

        const orderInState = get().orders.find(o => o.id === orderId);
        if (orderInState?.pushToken) {
          sendPushNotification(orderInState.pushToken, title, body);
        }
      }
    } catch (err) {
      console.error('Erreur MAJ statut commande:', err);
    }
  },

  cancelOrder: async (orderId) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { 
        status: 'cancelled', 
        updatedAt: Timestamp.now() 
      });
    } catch (err) {
      console.error('Erreur annulation commande:', err);
    }
  },

  markAsPaid: async (orderId, method) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { 
        isPaid: true, 
        paymentMethod: method 
      });
    } catch (err) {
      console.error('Erreur paiement commande:', err);
    }
  },
}),
{
  name: 'nazar-cart-storage',
  storage: createJSONStorage(() => AsyncStorage),
  partialize: (state) => ({ 
    items: state.items, 
    total: state.total,
    customerName: state.customerName,
    customerPhone: state.customerPhone,
    customerAddress: state.customerAddress,
    activeOrder: state.activeOrder,
  }),
}
)
);
