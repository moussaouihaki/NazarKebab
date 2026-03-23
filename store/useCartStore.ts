import { create } from 'zustand';
import { Platform } from 'react-native';
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
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from './useAuthStore';
import { sendPushNotification, registerForPushNotificationsAsync } from '../lib/pushNotifications';
import { useNotificationStore } from './useNotificationStore';



export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

export interface Product {
  id: string;
  name: string;
  price: number;
  image: any;
  description?: string;
  category?: string;
}

export interface CartItem extends Product {
  quantity: number;
  note?: string;
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
  estimatedTime: number;
  note?: string;
  isPaid: boolean;
  paymentMethod: string;
  subTotal: number;
  taxAmount: number;
  userId?: string;
  pushToken?: string;
}

interface CartState {
  items: CartItem[];
  total: number;
  deliveryFee: number;
  deliveryType: 'delivery' | 'pickup';
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  orderNote: string;
  orders: Order[];
  activeOrder: Order | null;
  isLoading: boolean;
  addItem: (product: Product, note?: string) => void;
  updateQuantity: (cartItemId: string, delta: number) => void;
  removeItem: (cartItemId: string) => void;
  removeAllOfItem: (cartItemId: string) => void;
  clearCart: () => void;
  setDeliveryType: (type: 'delivery' | 'pickup') => void;
  setDeliveryFee: (fee: number) => void;
  setCustomerInfo: (name: string, phone: string, address: string) => void;
  setOrderNote: (note: string) => void;
  listenToOrders: (userId?: string, isAdmin?: boolean, specificOrderId?: string) => () => void;
  placeOrder: (userId?: string) => Promise<Order>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;
  markAsPaid: (orderId: string, method: string) => Promise<void>;
  setActiveOrderById: (orderId: string) => Promise<void>;
}

const generateOrderId = () => `NZ-${Math.floor(Math.random() * 9000) + 1000}`;

const hashNote = (note: string) => {
  let hash = 0;
  for (let i = 0; i < note.length; i++) {
    hash = (hash << 5) - hash + note.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
};

const cleanForFirebase = (obj: any): any => {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date || obj instanceof Timestamp) return obj;
  const clean: any = Array.isArray(obj) ? [] : {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      clean[key] = cleanForFirebase(obj[key]);
    }
  }
  return clean;
};

export const useCartStore = create<CartState>((set, get) => ({
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

  addItem: (product, note) => {
    const currentItems = get().items;
    const uniqueId = note ? `${product.id}-${hashNote(note)}` : product.id;
    const existingItem = currentItems.find((item) => item.id === uniqueId);
    let newItems;
    if (existingItem) {
      newItems = currentItems.map((item) =>
        item.id === uniqueId ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      newItems = [...currentItems, { ...product, id: uniqueId, quantity: 1, note }];
    }
    set({ items: newItems, total: newItems.reduce((acc, item) => acc + item.price * item.quantity, 0) });
  },

  updateQuantity: (cartItemId: string, delta: number) => {
    const currentItems = get().items;
    const newItems = currentItems.map((item) => {
      if (item.id === cartItemId) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0);
    
    set({ items: newItems, total: newItems.reduce((acc, item) => acc + item.price * item.quantity, 0) });
  },

  removeItem: (cartItemId) => {
    const currentItems = get().items;
    const existingItem = currentItems.find((item) => item.id === cartItemId);
    let newItems;
    if (existingItem && existingItem.quantity > 1) {
      newItems = currentItems.map((item) =>
        item.id === cartItemId ? { ...item, quantity: item.quantity - 1 } : item
      );
    } else {
      newItems = currentItems.filter((item) => item.id !== cartItemId);
    }
    set({ items: newItems, total: newItems.reduce((acc, item) => acc + item.price * item.quantity, 0) });
  },

  removeAllOfItem: (cartItemId) => {
    const newItems = get().items.filter((item) => item.id !== cartItemId);
    set({ items: newItems, total: newItems.reduce((acc, item) => acc + item.price * item.quantity, 0) });
  },

  clearCart: () => set({ items: [], total: 0, orderNote: '' }),
  setDeliveryType: (type) => set({ deliveryType: type }),
  setDeliveryFee: (fee) => set({ deliveryFee: fee }),
  setCustomerInfo: (name, phone, address) => set({ customerName: name, customerPhone: phone, customerAddress: address }),
  setOrderNote: (note) => set({ orderNote: note }),

  setActiveOrderById: async (orderId) => {
    try {
      const docSnap = await getDoc(doc(db, 'orders', orderId));
      if (docSnap.exists()) {
        const data = docSnap.data();
        set({
          activeOrder: {
            ...data,
            id: docSnap.id,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
          } as Order
        });
      }
    } catch (err) { console.error('Error loading active order:', err); }
  },

  listenToOrders: (userId, isAdmin, specificOrderId) => {
    let q;
    if (isAdmin) {
      q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    } else if (userId) {
      q = query(collection(db, 'orders'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
    } else if (specificOrderId) {
      q = query(collection(db, 'orders'), where('__name__', '==', specificOrderId));
    } else { return () => {}; }

    let isFirstLoad = true;

    return onSnapshot(q, (snapshot) => {
      if (isAdmin && !isFirstLoad) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const orderId = change.doc.id;
            useNotificationStore.getState().addNotification(
              "🔔 Nouvelle Commande !",
              `N° ${orderId} de ${data.customerName || 'Client'} (${data.total?.toFixed(2)} CHF)`
            );
            if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
              if (Notification.permission === 'granted') {
                new Notification("NAZAR KEBAB 🗞️", {
                  body: `Nouvelle commande #${orderId} - ${data.total} CHF`,
                  icon: '/favicon.ico'
                });
              }
            }
          }
        });
      }

      // CLIENT: detect status changes and add to notification bell
      if (!isAdmin) {
        const clientStatusMessages: Record<string, { title: string; body: string }> = {
          confirmed: { title: "Commande Confirmée ✅", body: "Le restaurant a validé votre commande !" },
          preparing: { title: "En Préparation 👨‍🍳", body: "Votre repas est en cours de préparation." },
          ready:     { title: "Prête / En livraison 🛵", body: "Votre commande est prête / en route !" },
          delivered: { title: "Livraison terminée 🎉", body: "Bon appétit ! Votre commande a été livrée." },
          cancelled: { title: "Commande Annulée ❌", body: "Désolé, votre commande a été annulée." },
        };

        if (!isFirstLoad) {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'modified') {
              const after = change.doc.data();
              const msg = clientStatusMessages[after.status];
              if (msg) {
                // 1. Bell notification (always works)
                useNotificationStore.getState().addNotification(msg.title, msg.body);
                
                // 2. Local push notification (works on mobile when app is open/background)
                if (Platform.OS !== 'web') {
                  Notifications.scheduleNotificationAsync({
                    content: {
                      title: msg.title,
                      body: msg.body,
                      sound: 'default',
                    },
                    trigger: null, // immédiatement
                  }).catch(() => {});
                }
              }
            }
          });
        }
      }

      isFirstLoad = false;

      const orderList: Order[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        orderList.push({
          ...data,
          id: docSnap.id,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
        } as Order);
      });
      set({ orders: orderList });

      const currentActiveId = get().activeOrder?.id || specificOrderId;
      if (currentActiveId) {
        const matching = orderList.find(o => o.id === currentActiveId);
        if (matching) {
          set({ activeOrder: matching });
        }
      }
    });
  },

  placeOrder: async (userId) => {
    const state = get();
    const orderId = generateOrderId();
    const grandTotal = state.total + state.deliveryFee;
    const taxRate = 0.026;
    const subTotal = grandTotal / (1 + taxRate);
    const taxAmount = grandTotal - subTotal;

    let freshPushToken = useAuthStore.getState().user?.pushToken || null;
    try {
      const token = await registerForPushNotificationsAsync();
      if (token) freshPushToken = token;
    } catch (e) {
      console.log('Error getting fresh token during order', e);
    }

    const orderData = {
      items: state.items.map(item => ({ ...item, image: null })),
      total: grandTotal,
      status: 'pending',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      customerName: state.customerName,
      customerPhone: state.customerPhone,
      customerAddress: state.customerAddress,
      deliveryType: state.deliveryType,
      estimatedTime: state.deliveryType === 'delivery' ? 30 : 15,
      note: state.orderNote || null,
      isPaid: false,
      paymentMethod: 'À la livraison',
      subTotal,
      taxAmount,
      userId: userId || useAuthStore.getState().user?.id || null,
      pushToken: freshPushToken
    };

    await setDoc(doc(db, 'orders', orderId), cleanForFirebase(orderData));
    const order = { ...orderData, id: orderId, createdAt: new Date(), updatedAt: new Date() } as Order;
    set({ activeOrder: order, items: [], total: 0, orderNote: '' });
    return order;
  },

  updateOrderStatus: async (orderId, status) => {
    try {
      const orderDoc = await getDoc(doc(db, 'orders', orderId));
      if (!orderDoc.exists()) return;
      const orderData = orderDoc.data();
      let clientPushToken = orderData.pushToken;

      // Backup: si pas de token dans l'ordre, on va voir chez l'utilisateur
      if (!clientPushToken && orderData.userId) {
        const userDoc = await getDoc(doc(db, 'users', orderData.userId));
        if (userDoc.exists()) {
          clientPushToken = userDoc.data().pushToken;
        }
      }

      const updateData: any = { status, updatedAt: Timestamp.now() };
      if (status === 'delivered') updateData.isPaid = true;
      await updateDoc(doc(db, 'orders', orderId), updateData);
      
      const adminMessages: Record<string, string> = {
        confirmed: "Commande Confirmée ✅",
        preparing: "En Préparation 👨‍🍳",
        ready: "Prête / En livraison 🛍️",
        delivered: "Terminée 🎉",
        cancelled: "Annulée ❌"
      };

      const clientMessages: Record<string, string> = {
        confirmed: "Le restaurant a validé votre commande !",
        preparing: "Votre repas est en préparation 👨‍🍳",
        ready: "Votre commande est prête / en route ! 🛍️",
        delivered: "Bon appétit ! Votre commande a été livrée. 🎉",
        cancelled: "Désolé, votre commande a été annulée. ❌"
      };
      
      // Notification visuelle pour l'admin
      if (adminMessages[status]) {
        useNotificationStore.getState().addNotification(
          adminMessages[status],
          `Statut mis à jour pour #${orderId}`
        );
      }

      //Notification push pour le client (envoyée directement par le client admin vers Expo)
      if (clientPushToken && clientMessages[status]) {
        try {
          await sendPushNotification(
            clientPushToken,
            adminMessages[status] || "Nazar Kebab 🗞️",
            clientMessages[status]
          );
        } catch (e) {
          console.error('Erreur lors de l\'envoi push manuel:', e);
        }
      }

      // NOUVEAU : Points de fidélité lors de la livraison
      if (status === 'delivered' && orderData.userId) {
        const userDoc = await getDoc(doc(db, 'users', orderData.userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const currentPoints = userData.loyaltyPoints || 0;
          await updateDoc(doc(db, 'users', orderData.userId), { 
            loyaltyPoints: currentPoints + 1 
          });
        }
      }
    } catch (err) { console.error('Error updating order:', err); }
  },

  cancelOrder: async (orderId) => {
    await updateDoc(doc(db, 'orders', orderId), { status: 'cancelled', updatedAt: Timestamp.now() });
  },

  markAsPaid: async (orderId, method) => {
    await updateDoc(doc(db, 'orders', orderId), { isPaid: true, paymentMethod: method });
  },
}));
