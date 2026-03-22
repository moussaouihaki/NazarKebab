import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, TextInput, Switch, Platform, Alert, Modal, ActivityIndicator, Linking, useWindowDimensions
} from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Theme } from '../constants/theme';
import { useAuthStore } from '../store/useAuthStore';
import { useCartStore } from '../store/useCartStore';
import { useRestaurantStore, checkIsRestaurantOpen } from '../store/useRestaurantStore';
import { useDeliveryZoneStore, DeliveryZone } from '../store/useDeliveryZoneStore';
import { Product, PRODUCTS, IMAGES_MAP, getImageSource } from '../constants/data';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sendPushNotification } from '../lib/pushNotifications';

type Tab = 'dashboard' | 'orders' | 'kitchen' | 'crm' | 'menu' | 'settings';

// ──────────────────────────────────
// ORDER STATUS CONFIG
// ──────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  preparing: 'En préparation',
  ready: 'Prête / En route',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};
const STATUS_COLORS: Record<string, string> = {
  pending: '#FF9800',
  confirmed: '#4CAF50',
  preparing: '#2196F3',
  ready: Theme.colors.success,
  delivered: '#888',
  cancelled: Theme.colors.danger,
};
const NEXT_STATUS: Record<string, string | null> = {
  pending: 'confirmed', confirmed: 'preparing',
  preparing: 'ready', ready: 'delivered',
  delivered: null, cancelled: null,
};

// ──────────────────────────────────────────────
// MAIN ADMIN SCREEN
// ──────────────────────────────────────────────
export default function AdminScreen() {
  const { user, logout } = useAuthStore();
  const [tab, setTab] = useState<Tab>('dashboard');
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  // Auth guard
  if (!user || user.role !== 'admin') {
    return (
      <View style={styles.container}>
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="lock-closed" size={48} color={Theme.colors.danger} />
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Accès refusé</Text>
          <TouchableOpacity style={styles.goldBtn} onPress={() => router.replace('/')}>
            <Text style={styles.goldBtnText}>Retour à l'accueil</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  const TABS = [
    { key: 'dashboard', icon: 'stats-chart-outline', label: 'Dashboard' },
    { key: 'orders',    icon: 'receipt-outline',     label: 'Commandes' },
    { key: 'kitchen',   icon: 'flame-outline',       label: 'Cuisine' },
    { key: 'crm',       icon: 'people-outline',      label: 'Clients CRM' },
    { key: 'menu',      icon: 'restaurant-outline',  label: 'Menu & Stock' },
    { key: 'settings',  icon: 'settings-outline',    label: 'Réglages' },
  ] as { key: Tab; icon: any; label: string }[];

  const renderContent = () => {
    if (tab === 'dashboard') return <DashboardTab />;
    if (tab === 'orders') return <OrdersTab />;
    if (tab === 'kitchen') return <KitchenTab />;
    if (tab === 'crm') return <CrmTab />;
    if (tab === 'menu') return <MenuTab />;
    if (tab === 'settings') return <SettingsTab />;
    return null;
  };

  if (isDesktop) {
    return (
      <View style={[styles.container, { flexDirection: 'row' }]}>
        {/* SAAS SIDEBAR */}
        <View style={styles.saasSidebar}>
          <View style={styles.saasSidebarHeader}>
            <Text style={styles.saasLogo}>NAZAR</Text>
            <Text style={styles.saasLogoSub}>WORKSPACE</Text>
          </View>
          
          <ScrollView style={styles.saasSidebarNav}>
            {TABS.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[styles.saasSidebarNavItem, tab === t.key && styles.saasSidebarNavItemActive]}
                onPress={() => setTab(t.key)}
              >
                <Ionicons name={t.icon} size={20} color={tab === t.key ? Theme.colors.success : Theme.colors.textSecondary} />
                <Text style={[styles.saasSidebarNavLabel, tab === t.key && styles.saasSidebarNavLabelActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.saasSidebarExit} onPress={() => { logout(); router.replace('/'); }}>
            <Ionicons name="log-out-outline" size={20} color={Theme.colors.danger} />
            <Text style={[styles.saasSidebarExitText, { color: Theme.colors.danger }]}>Déconnexion</Text>
          </TouchableOpacity>
        </View>

        {/* SAAS MAIN CONTENT */}
        <View style={styles.saasMainContent}>
          <View style={styles.saasTopBar}>
            <Text style={styles.saasTopBarTitle}>Administration</Text>
            <View style={styles.saasAdminBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#000" />
              <Text style={styles.saasAdminBadgeText}>ADMIN</Text>
            </View>
          </View>
          <View style={{ flex: 1, backgroundColor: Theme.colors.background }}>
             {renderContent()}
          </View>
        </View>
      </View>
    );
  }

  // MOBILE LAYOUT
  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* TOP HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/')} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color={Theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>PANEL ADMIN</Text>
          <TouchableOpacity onPress={() => { logout(); router.replace('/'); }} style={styles.iconBtn}>
            <Ionicons name="log-out-outline" size={24} color={Theme.colors.danger} />
          </TouchableOpacity>
        </View>

        {/* TAB BAR (Scrollable in Mobile) */}
        <View style={styles.tabBarWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabBarScroll}
          >
            {TABS.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
                onPress={() => setTab(t.key)}
              >
                <Ionicons name={t.icon} size={20} color={tab === t.key ? Theme.colors.success : Theme.colors.textSecondary} />
                <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* TAB CONTENT */}
        <View style={{ flex: 1, backgroundColor: Theme.colors.background }}>
          {renderContent()}
        </View>
      </SafeAreaView>
    </View>
  );
}

// ──────────────────────────────────
// TAB: DASHBOARD
// ──────────────────────────────────
function DashboardTab() {
  const { orders } = useCartStore();
  const { settings } = useRestaurantStore();
  const { updateSettings } = useRestaurantStore();

  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  const active  = orders.filter(o => !['delivered','cancelled'].includes(o.status));
  const today   = orders.filter(o => o.status !== 'cancelled');
  const revenue = today.reduce((s, o) => s + o.total, 0);
  const avgOrder = today.length ? revenue / today.length : 0;

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={[isDesktop && { flexDirection: 'row', gap: 24 }]}>
        <View style={{ flex: isDesktop ? 2 : 1 }}>
          {/* NEW PREMIUM HEADER FOR DASHBOARD */}
          <View style={{ marginBottom: 24 }}>
             <Text style={{ fontFamily: Theme.fonts.title, fontSize: 32, color: Theme.colors.text }}>Tableau de bord</Text>
             <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: checkIsRestaurantOpen(settings) ? Theme.colors.success : Theme.colors.danger, marginRight: 8, shadowColor: checkIsRestaurantOpen(settings) ? Theme.colors.success : Theme.colors.danger, shadowOpacity: 0.8, shadowRadius: 6 }} />
                <Text style={{ fontFamily: Theme.fonts.bodyMedium, fontSize: 13, color: Theme.colors.textSecondary }}>
                   Restaurant {checkIsRestaurantOpen(settings) ? 'ouvert' : 'fermé'}
                </Text>
             </View>
          </View>

          {/* STATS GRID */}
          <View style={styles.statsGrid}>
            <StatCard label="Commandes en cours" value={String(active.length)} icon="time" color={Theme.colors.primary} />
            <StatCard label="Chiffre d'Affaires" value={`${revenue.toFixed(0)} CHF`} icon="cash" color={Theme.colors.success} />
            <StatCard label="Commandes totales" value={String(orders.length)} icon="receipt" color="#2196F3" />
            <StatCard label="Panier Moyen" value={`${avgOrder.toFixed(0)} CHF`} icon="cart" color="#FF9800" />
          </View>

          {/* PREMIUM CHART SECTION */}
          {isDesktop && (
            <View style={styles.chartCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 }}>
                <View>
                  <Text style={{ fontFamily: Theme.fonts.bodyBold, fontSize: 16, color: Theme.colors.text }}>Aperçu des Ventes</Text>
                  <Text style={{ fontFamily: Theme.fonts.body, fontSize: 12, color: Theme.colors.textSecondary, marginTop: 4 }}>Derniers 7 jours</Text>
                </View>
                <Text style={{ fontFamily: Theme.fonts.title, fontSize: 24, color: Theme.colors.success }}>420 CHF</Text>
              </View>

              <View style={styles.fakeChart}>
                 <View style={styles.chartGridLines}>
                   <View style={styles.chartGridLine} />
                   <View style={styles.chartGridLine} />
                   <View style={styles.chartGridLine} />
                 </View>
                 {[40, 60, 45, 80, 50, 90, 100].map((h, i) => (
                   <View key={i} style={styles.chartBarWrapper}>
                     <View style={[styles.chartBar, { height: `${h}%` }]} />
                     <Text style={styles.chartLabel}>J-{6-i}</Text>
                   </View>
                 ))}
              </View>
            </View>
          )}
        </View>

        {/* RIGHT SIDEBAR ON DESKTOP */}
        <View style={{ flex: isDesktop ? 1 : 1, marginTop: isDesktop ? 0 : 20 }}>
          <View style={styles.recentActivityCard}>
            <Text style={styles.sectionHeader}>ACTIVITÉ RÉCENTE</Text>
            {orders.slice(0, 5).map(o => (
              <View key={o.id} style={styles.activityRow}>
                <View style={styles.activityDotWrapper}>
                  <View style={styles.activityDot} />
                </View>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityTitle}>Commande <Text style={{color: Theme.colors.success}}>#{o.id}</Text></Text>
                  <Text style={styles.activityDesc}>{o.customerName}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.activityAmount}>{o.total.toFixed(2)} CHF</Text>
                  <Text style={{ fontFamily: Theme.fonts.body, fontSize: 10, color: Theme.colors.textSecondary, marginTop: 4 }}>{STATUS_LABELS[o.status]}</Text>
                </View>
              </View>
            ))}
            {orders.length === 0 && (
               <View style={{ alignItems: 'center', paddingVertical: 40, opacity: 0.5 }}>
                 <Ionicons name="notifications-off-outline" size={32} color={Theme.colors.textSecondary} />
                 <Text style={[styles.activityTitle, { marginTop: 12 }]}>Aucune activité</Text>
               </View>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <View style={styles.statCard}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Ionicons name="trending-up" size={16} color={Theme.colors.textSecondary} style={{ opacity: 0.3 }} />
      </View>
      <Text style={[styles.statValue, { color: Theme.colors.text }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ──────────────────────────────────
// TAB: ORDERS
// ──────────────────────────────────
function OrdersTab() {
  const { orders, updateOrderStatus, cancelOrder, markAsPaid } = useCartStore();
  const [filter, setFilter] = useState<'active' | 'history'>('active');
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  const active  = orders.filter(o => !['delivered','cancelled'].includes(o.status));
  const history = orders.filter(o => ['delivered','cancelled'].includes(o.status));
  const displayed = filter === 'active' ? active : history;

  const handleAdvance = (orderId: string, status: string) => {
    const next = NEXT_STATUS[status];
    if (next) updateOrderStatus(orderId, next as any);
  };

  const handleCancel = (orderId: string) => {
    Alert.alert('Annuler', "Confirmer l'annulation de cette commande ?", [
      { text: 'Non', style: 'cancel' },
      { text: 'Oui', style: 'destructive', onPress: () => cancelOrder(orderId) },
    ]);
  };

  const handlePay = (orderId: string) => {
    Alert.alert('Encaisser', 'Sélectionnez la méthode de paiement', [
      { text: 'Espèces', onPress: () => markAsPaid(orderId, 'Espèces') },
      { text: 'Carte / Twint', onPress: () => markAsPaid(orderId, 'Carte') },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.filterRow}>
        <TouchableOpacity style={[styles.filterBtn, filter === 'active' && styles.filterBtnActive]} onPress={() => setFilter('active')}>
          <Text style={[styles.filterText, filter === 'active' && styles.filterTextActive]}>Actives ({active.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterBtn, filter === 'history' && styles.filterBtnActive]} onPress={() => setFilter('history')}>
          <Text style={[styles.filterText, filter === 'history' && styles.filterTextActive]}>Historique ({history.length})</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {displayed.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Aucune commande</Text>
          </View>
        )}

        {/* WEB DESKTOP TABLE */}
        {isDesktop && displayed.length > 0 && (
          <View style={styles.dataTableWrapper}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, { flex: 0.5 }]}>ID</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>CLIENT</Text>
              <Text style={[styles.th, { flex: 1 }]}>TYPE</Text>
              <Text style={[styles.th, { flex: 2 }]}>CONTENU</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>TOTAL / STATUT</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>ACTIONS</Text>
            </View>
            {displayed.map(order => (
              <View key={order.id} style={styles.tableRow}>
                <View style={{ flex: 0.5 }}>
                  <Text style={styles.tdId}>#{order.id}</Text>
                  <Text style={styles.tdTime}>~{order.estimatedTime}m</Text>
                </View>
                <View style={{ flex: 1.5 }}>
                  <Text style={styles.tdTitle}>{order.customerName}</Text>
                  <Text style={styles.tdSub}>{order.customerPhone}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tdTitle}>{order.deliveryType === 'delivery' ? '🛵 Livr.' : '🥡 Emp.'}</Text>
                  {order.deliveryType === 'delivery' && <Text style={styles.tdSub}>{order.customerAddress}</Text>}
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={styles.tdSub}>{order.items.map(i => `${i.quantity}× ${i.name}`).join(', ')}</Text>
                </View>
                <View style={{ flex: 1.5 }}>
                   <Text style={[styles.tdTitle, { color: Theme.colors.success }]}>{order.total.toFixed(2)} CHF</Text>
                   <View style={[styles.statusPill, { backgroundColor: STATUS_COLORS[order.status] + '22', borderColor: STATUS_COLORS[order.status], alignSelf: 'flex-start', marginTop: 4 }]}>
                     <Text style={[styles.statusPillText, { color: STATUS_COLORS[order.status] }]}>{STATUS_LABELS[order.status]}</Text>
                   </View>
                </View>
                <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => router.push({ pathname: '/receipt', params: { id: order.id } })} style={styles.iconCircleBtn}>
                      <Ionicons name="receipt-outline" size={16} color={Theme.colors.textSecondary} />
                    </TouchableOpacity>
                    {filter === 'active' && NEXT_STATUS[order.status] && (
                      <TouchableOpacity onPress={() => handleAdvance(order.id, order.status)} style={[styles.iconCircleBtn, { borderColor: Theme.colors.success }]}>
                        <Ionicons name="checkmark-outline" size={16} color={Theme.colors.success} />
                      </TouchableOpacity>
                    )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* MOBILE CARDS */}
        {!isDesktop && displayed.map(order => (
          <View key={order.id} style={styles.orderCard}>
            <View style={styles.orderCardRow}>
              <Text style={styles.orderId}>#{order.id}</Text>
              <View style={[styles.statusPill, { backgroundColor: STATUS_COLORS[order.status] + '22', borderColor: STATUS_COLORS[order.status] }]}>
                <Text style={[styles.statusPillText, { color: STATUS_COLORS[order.status] }]}>{STATUS_LABELS[order.status]}</Text>
              </View>
            </View>

            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6}}>
              <View>
                <Text style={styles.orderCustomer}>{order.customerName}</Text>
                <Text style={[styles.orderMeta, {marginBottom: 0}]}>
                  {order.deliveryType === 'delivery' ? `🛵  📍 ${order.customerAddress}` : '🥡 À emporter'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => Linking.openURL(`tel:${order.customerPhone}`)} style={styles.callBtnLg}>
                <Ionicons name="call" size={16} color="#000" />
                <Text style={styles.callBtnText}>{order.customerPhone}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.orderItemsList}>
              {order.items.map(i => `${i.quantity}× ${i.name}`).join(', ')}
            </Text>

            {order.note && <Text style={styles.orderNote}>📝 {order.note}</Text>}

            <View style={styles.orderCardFooter}>
              <View>
                <Text style={styles.orderTotal}>{order.total.toFixed(2)} CHF</Text>
                <Text style={styles.orderTime}>~{order.estimatedTime} min</Text>
              </View>
              <TouchableOpacity onPress={() => router.push({ pathname: '/receipt', params: { id: order.id } })} style={styles.receiptIconBtn}>
                <Ionicons name="receipt-outline" size={20} color={Theme.colors.textSecondary} />
                <Text style={styles.receiptIconText}>{order.isPaid ? 'Ticket' : 'B. Cde'}</Text>
              </TouchableOpacity>
            </View>

            {filter === 'active' && (
              <View style={styles.orderActions}>
                {NEXT_STATUS[order.status] && (
                  <TouchableOpacity style={styles.advanceBtn} onPress={() => handleAdvance(order.id, order.status)}>
                    <Text style={styles.advanceBtnText}>→ {STATUS_LABELS[NEXT_STATUS[order.status]!]}</Text>
                  </TouchableOpacity>
                )}
                {!order.isPaid && (
                  <TouchableOpacity style={styles.payBtn} onPress={() => handlePay(order.id)}>
                    <Ionicons name="card-outline" size={16} color="#000" />
                    <Text style={styles.payBtnText}>Encaisser</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.cancelOrderBtn} onPress={() => handleCancel(order.id)}>
                  <Ionicons name="close" size={16} color={Theme.colors.danger} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ──────────────────────────────────
// TAB: VUE CUISINE (KDS - Kitchen Display System)
// ──────────────────────────────────
function KitchenTab() {
  const { orders, updateOrderStatus } = useCartStore();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  // Tabs for mobile Kitchen View
  const [activeKTab, setActiveKTab] = useState<'pending' | 'preparing' | 'ready'>('pending');
  
  // Filter active orders (not delivered or cancelled)
  const activeOrders = orders.filter(o => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status));

  const pending = activeOrders.filter(o => o.status === 'pending' || o.status === 'confirmed');
  const preparing = activeOrders.filter(o => o.status === 'preparing');
  const ready = activeOrders.filter(o => o.status === 'ready');

  const KanbanColumn = ({ title, data, color, nextStatus, nextLabel }: { title: string, data: any[], color: string, nextStatus?: string, nextLabel?: string }) => (
    <View style={[styles.kanbanCol, !isDesktop && { flex: 1, borderWidth: 0 }]}>
      <View style={[styles.kanbanHeader, { borderBottomColor: color }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
           <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
           <Text style={styles.kanbanTitle}>{title}</Text>
        </View>
        <View style={[styles.kanbanCount, { backgroundColor: color + '22' }]}><Text style={[styles.kanbanCountText, { color }]}>{data.length}</Text></View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 10, paddingBottom: 100 }}>
        {data.map(o => (
           <View key={o.id} style={styles.kTicket}>
             {/* Header Ticket */}
             <View style={styles.kTop}>
               <View>
                 <Text style={styles.kId}>N° {o.id}</Text>
                 <Text style={styles.kTime}>{new Date(o.createdAt).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}</Text>
               </View>
               <View style={[styles.kTypeBadge, { backgroundColor: o.deliveryType === 'delivery' ? '#007AFF22' : '#FF950022' }]}>
                 <Text style={[styles.kTypeText, { color: o.deliveryType === 'delivery' ? '#007AFF' : '#FF9500' }]}>
                   {o.deliveryType === 'delivery' ? 'LIVRAISON' : 'À EMPORTER'}
                 </Text>
               </View>
             </View>

             <View style={styles.kDivider} />

             {/* Items */}
             <View style={styles.kItems}>
               {o.items.map((it: any, i: number) => (
                 <View key={i} style={{ marginBottom: 6 }}>
                   <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={styles.kItem}><Text style={styles.kItemQty}>{it.quantity}x</Text> {it.name}</Text>
                   </View>
                   {it.note && <Text style={styles.kItemNote}>↳ {it.note}</Text>}
                 </View>
               ))}
             </View>

             {/* Global Order Note */}
             {o.note ? (
               <View style={styles.kNoteContainer}>
                 <Text style={styles.kNoteLabel}>MESSAGE CLIENT :</Text>
                 <Text style={styles.kNoteText}>{o.note}</Text>
               </View>
             ) : null}

             {/* Customer Minimal Info */}
             <View style={{ marginTop: 12, padding: 8, backgroundColor: Theme.colors.background, borderRadius: 8 }}>
                <Text style={{ fontFamily: Theme.fonts.bodyBold, fontSize: 12, color: Theme.colors.text }}>{o.customerName}</Text>
                {o.deliveryType === 'delivery' && <Text style={{ fontFamily: Theme.fonts.body, fontSize: 11, color: Theme.colors.textSecondary }}>{o.customerAddress}</Text>}
             </View>

             {/* Action Button */}
             {nextStatus && (
                <TouchableOpacity 
                  onPress={() => updateOrderStatus(o.id, nextStatus as any)} 
                  style={[styles.kBtn, { backgroundColor: color }]}
                  activeOpacity={0.8}
                >
                  <Text style={styles.kBtnText}>{nextLabel || 'VALIDER'}</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </TouchableOpacity>
             )}

             {/* Complete Button (if finished) */}
             {o.status === 'ready' && (
                <TouchableOpacity 
                  onPress={() => updateOrderStatus(o.id, 'delivered')} 
                  style={[styles.kBtn, { backgroundColor: Theme.colors.success }]}
                  activeOpacity={0.8}
                >
                  <Text style={styles.kBtnText}>TERMINÉ / LIVRÉ</Text>
                  <Ionicons name="checkmark-done" size={18} color="#fff" />
                </TouchableOpacity>
             )}
           </View>
        ))}
        {data.length === 0 && (
           <View style={{ alignItems: 'center', marginTop: 100, opacity: 0.3 }}>
             <Ionicons name="restaurant-outline" size={48} color={Theme.colors.textSecondary} />
             <Text style={{ fontFamily: Theme.fonts.bodyMedium, marginTop: 16 }}>Aucune commande</Text>
           </View>
        )}
      </ScrollView>
    </View>
  );

  if (!isDesktop) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', backgroundColor: Theme.colors.background, borderBottomWidth: 1, borderBottomColor: Theme.colors.border }}>
           <TouchableOpacity 
             style={[{ flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' }, activeKTab === 'pending' && { borderBottomColor: Theme.colors.danger }]} 
             onPress={() => setActiveKTab('pending')}
           >
              <Text style={{ fontFamily: Theme.fonts.bodyBold, fontSize: 11, color: activeKTab === 'pending' ? Theme.colors.danger : Theme.colors.textSecondary }}>À VALIDER ({pending.length})</Text>
           </TouchableOpacity>
           <TouchableOpacity 
             style={[{ flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' }, activeKTab === 'preparing' && { borderBottomColor: Theme.colors.primary }]} 
             onPress={() => setActiveKTab('preparing')}
           >
              <Text style={{ fontFamily: Theme.fonts.bodyBold, fontSize: 11, color: activeKTab === 'preparing' ? Theme.colors.primary : Theme.colors.textSecondary }}>CUISINE ({preparing.length})</Text>
           </TouchableOpacity>
           <TouchableOpacity 
             style={[{ flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' }, activeKTab === 'ready' && { borderBottomColor: Theme.colors.success }]} 
             onPress={() => setActiveKTab('ready')}
           >
              <Text style={{ fontFamily: Theme.fonts.bodyBold, fontSize: 11, color: activeKTab === 'ready' ? Theme.colors.success : Theme.colors.textSecondary }}>EXPÉDITION ({ready.length})</Text>
           </TouchableOpacity>
        </View>
        
        {activeKTab === 'pending' && (
          <KanbanColumn 
            title="À VALIDER" 
            data={pending} 
            color={Theme.colors.danger} 
            nextStatus={pending.some(o => o.status === 'pending') ? 'confirmed' : 'preparing'}
            nextLabel={pending.some(o => o.status === 'pending') ? 'CONFIRMER' : 'CUISINER'}
          />
        )}
        {activeKTab === 'preparing' && (
          <KanbanColumn 
            title="EN CUISINE" 
            data={preparing} 
            color={Theme.colors.primary} 
            nextStatus="ready"
            nextLabel="TERMINER"
          />
        )}
        {activeKTab === 'ready' && (
          <KanbanColumn 
            title="EXPÉDITION" 
            data={ready} 
            color={Theme.colors.success} 
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.kanbanBoard}>
      <KanbanColumn 
        title="À CONFIRMER" 
        data={pending} 
        color={Theme.colors.danger} 
        nextStatus={pending.some(o => o.status === 'pending') ? 'confirmed' : 'preparing'}
        nextLabel={pending.some(o => o.status === 'pending') ? 'CONFIRMER COMMANDE' : 'LANCER PRÉPARATION'}
      />
      <KanbanColumn 
        title="EN CUISINE" 
        data={preparing} 
        color={Theme.colors.primary} 
        nextStatus="ready"
        nextLabel="MARQUER COMME PRÊT"
      />
      <KanbanColumn 
        title="PRÊT / EN ROUTE" 
        data={ready} 
        color={Theme.colors.success} 
      />
    </View>
  );
}

// ──────────────────────────────────
// TAB: CLIENTS (CRM)
// ──────────────────────────────────
function CrmTab() {
  const { orders } = useCartStore();
  const [promoText, setPromoText] = useState('');
  const [isSendingPromo, setIsSendingPromo] = useState(false);

  // Basic aggregation logic for CRM from orders history
  const uniqueNames = Array.from(new Set(orders.map(o => o.customerName)));
  
  const crmData = uniqueNames.map((name: string) => {
    const userOrders = orders.filter(o => o.customerName === name && o.status !== 'cancelled');
    const spent = userOrders.reduce((acc, curr) => acc + curr.total, 0);
    const phone = userOrders.length > 0 ? userOrders[0].customerPhone : '-';
    return { name, phone, orderCount: userOrders.length, totalSpent: spent };
  }).filter(c => c.orderCount > 0).sort((a: any, b: any) => b.totalSpent - a.totalSpent); // Sort by highest spender

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {/* MARKETING CAMPAIGN */}
      <Text style={styles.sectionHeader}>CAMPAGNE MARKETING (PUSH)</Text>
      <View style={{ backgroundColor: Theme.colors.primary + '11', padding: 20, borderRadius: 16, marginBottom: 32, borderWidth: 1, borderColor: Theme.colors.primary + '44' }}>
        <Text style={{ fontFamily: Theme.fonts.bodyBold, color: Theme.colors.text, fontSize: 16, marginBottom: 8 }}>
          Envoyer une notification Push à tous les clients
        </Text>
        <Text style={{ fontFamily: Theme.fonts.body, color: Theme.colors.textSecondary, fontSize: 13, marginBottom: 16 }}>
          Prévenez instantanément vos {crmData.length} clients d'une promotion ou d'une nouveauté par notification push.
        </Text>
        <TextInput
          style={{ backgroundColor: Theme.colors.surface, borderRadius: 8, padding: 16, fontFamily: Theme.fonts.body, fontSize: 15, color: Theme.colors.text, minHeight: 80, borderColor: Theme.colors.border, borderWidth: 1, marginBottom: 16 }}
          placeholder="Ex: 🎁 1 Assiette achetée = 1 Boisson offerte ce soir chez Nazar Kebab !"
          placeholderTextColor="#999"
          multiline
          value={promoText}
          onChangeText={setPromoText}
        />
        <TouchableOpacity 
          style={[{ backgroundColor: Theme.colors.primary, paddingVertical: 14, borderRadius: 8, alignItems: 'center' }, (isSendingPromo || !promoText) && { opacity: 0.5 }]}
          disabled={isSendingPromo || !promoText}
          onPress={async () => {
            if (!promoText) return;
            setIsSendingPromo(true);
            try {
              // Récupère tous les utilisateurs qui pourraient avoir activé 'notifPromos'
              const usersQuery = query(collection(db, 'users'));
              const snap = await getDocs(usersQuery);
              let sentCount = 0;
              snap.forEach(d => {
                const userData = d.data();
                if (userData.pushToken && userData.notifPromos) {
                  sendPushNotification(userData.pushToken, "🎁 Nouvelle Offre !", promoText);
                  sentCount++;
                }
              });
              Alert.alert('Campagne envoyée ✅', `Votre notification a été envoyée à ${sentCount} client(s) ayant activé les offres.`);
              setPromoText('');
            } catch (e) {
              console.warn(e);
              Alert.alert('Erreur', "Echec de l'envoi");
            } finally {
              setIsSendingPromo(false);
            }
          }}
        >
          {isSendingPromo ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ fontFamily: Theme.fonts.bodyBold, color: '#fff', fontSize: 15 }}>ENVOYER AUX CLIENTS (OPTE-IN)</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionHeader}>BASE CLIENTS CRM ({crmData.length})</Text>
      <View style={styles.dataTableWrapper}>
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.th, { flex: 2 }]}>CLIENT</Text>
          <Text style={[styles.th, { flex: 2 }]}>CONTACT</Text>
          <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>COMMANDES</Text>
          <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>C.A. GÉNÉRÉ</Text>
        </View>
        
        {crmData.map((client: any, i: number) => (
          <View key={client.name} style={[styles.tableRow, { backgroundColor: i === 0 ? Theme.colors.success + '1A' : 'transparent' }]}>
            <View style={{ flex: 2 }}>
              <Text style={styles.tdTitle}>{client.name} {i === 0 && '👑'}</Text>
            </View>
            <View style={{ flex: 2 }}>
              <Text style={styles.tdTitle}>{client.phone || '-'}</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <View style={[styles.statusPill, { backgroundColor: Theme.colors.surface, borderColor: Theme.colors.border }]}>
                 <Text style={[styles.statusPillText, { color: Theme.colors.textSecondary }]}>{client.orderCount}</Text>
              </View>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={[styles.tdTitle, { color: Theme.colors.success, fontFamily: Theme.fonts.logo }]}>
                {client.totalSpent.toFixed(2)} CHF
              </Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}



// ──────────────────────────────────
// TAB: MENU MANAGEMENT
// ──────────────────────────────────
function MenuTab() {
  const { products, categories, addProduct, updateProduct, deleteProduct, addCategory, deleteCategory } = useRestaurantStore();
  const [selectedCategory, setSelectedCategory] = useState(categories[0]);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const filtered = products.filter(p => p.category === selectedCategory);

  const openAdd = () => { setEditingProduct(null); setShowModal(true); };
  const openEdit = (p: Product) => { setEditingProduct(p); setShowModal(true); };

  const handleDelete = (p: Product) => {
    Alert.alert('Supprimer', `Supprimer "${p.name}" du menu ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteProduct(p.id) },
    ]);
  };

  const handleDeleteCat = (cat: string) => {
    Alert.alert('Supprimer catégorie', `Supprimer "${cat}" et tous ses produits ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => {
        deleteCategory(cat);
        setSelectedCategory(categories.find(c => c !== cat) || categories[0]);
      }},
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* CATEGORY FILTER + ADD */}
      <View style={styles.menuCategoryBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.catPill, selectedCategory === cat && styles.catPillActive]}
              onLongPress={() => handleDeleteCat(cat)}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.catPillText, selectedCategory === cat && styles.catPillTextActive]} numberOfLines={1}>{cat}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.addCatBtn} onPress={() => setShowCatModal(true)}>
            <Ionicons name="add" size={18} color={Theme.colors.success} />
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {filtered.length === 0 && (
          <Text style={styles.emptySubtitle}>Aucun produit dans cette catégorie.</Text>
        )}
        {filtered.map(product => (
          <View key={product.id} style={styles.menuItem}>
            <Image
              source={getImageSource(product.image)}
              style={styles.menuItemImage}
              contentFit="cover"
            />
            <View style={[styles.menuItemInfo, product.outOfStock && {opacity: 0.5}]}>
              <Text style={styles.menuItemName}>{product.name}</Text>
              <Text style={styles.menuItemDesc} numberOfLines={1}>{product.description}</Text>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                <Text style={styles.menuItemPrice}>{product.price.toFixed(2)} CHF</Text>
                {product.outOfStock && <Text style={{color: Theme.colors.danger, fontSize: 10, fontFamily: Theme.fonts.bodyBold}}>RUPTURE</Text>}
              </View>
            </View>
            <View style={[styles.menuItemActions, {flexDirection: 'row'}]}>
              <TouchableOpacity onPress={() => updateProduct(product.id, { outOfStock: !product.outOfStock })} style={styles.stockBtn}>
                <Ionicons name={product.outOfStock ? 'eye-off' : 'eye'} size={20} color={product.outOfStock ? Theme.colors.danger : Theme.colors.success} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(product)}>
                <Ionicons name="pencil" size={16} color={Theme.colors.success} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(product)}>
                <Ionicons name="trash-outline" size={16} color={Theme.colors.danger} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* FAB ADD PRODUCT */}
      <TouchableOpacity style={styles.fab} onPress={openAdd}>
        <Ionicons name="add" size={28} color="#000" />
      </TouchableOpacity>

      {/* PRODUCT MODAL */}
      <ProductModal
        visible={showModal}
        product={editingProduct}
        categories={categories}
        defaultCategory={selectedCategory}
        onClose={() => setShowModal(false)}
        onSave={(data) => {
          if (editingProduct) {
            updateProduct(editingProduct.id, data);
          } else {
            addProduct(data as any);
          }
          setShowModal(false);
        }}
      />

      {/* CATEGORY MODAL */}
      <Modal visible={showCatModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>NOUVELLE CATÉGORIE</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: SALADES"
              placeholderTextColor={Theme.colors.textSecondary}
              value={newCatName}
              onChangeText={setNewCatName}
              autoCapitalize="characters"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setShowCatModal(false); setNewCatName(''); }}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.goldBtn} onPress={() => {
                if (newCatName.trim()) { addCategory(newCatName); setShowCatModal(false); setNewCatName(''); }
              }}>
                <Text style={styles.goldBtnText}>Ajouter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ──────────────────────────────────────────────
// PRODUCT MODAL (Add / Edit)
// ──────────────────────────────────────────────
function ProductModal({ visible, product, categories, defaultCategory, onClose, onSave }: {
  visible: boolean;
  product: Product | null;
  categories: string[];
  defaultCategory: string;
  onClose: () => void;
  onSave: (data: Partial<Product>) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [imageUri, setImageUri] = useState('');
  const [highlighted, setHighlighted] = useState(false);
  const [hasSauces, setHasSauces] = useState(false);
  const [hasDrinkSelection, setHasDrinkSelection] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setName(product?.name || '');
      setDescription(product?.description || '');
      setPrice(product?.price?.toString() || '');
      setCategory(product?.category || defaultCategory);
      setImageUri(typeof product?.image === 'string' ? product.image : '');
      setHighlighted(product?.highlighted || false);
      setHasSauces(product?.hasSauces || false);
      setHasDrinkSelection(product?.hasDrinkSelection || false);
    }
  }, [visible, product]);

  const pickImage = async () => {
    setPickingImage(true);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission refusée', 'Autorisez l\'accès à votre galerie dans les paramètres.');
      setPickingImage(false);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    setPickingImage(false);
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSave = () => {
    if (!name.trim() || !price.trim()) {
      Alert.alert('Erreur', 'Le nom et le prix sont obligatoires.');
      return;
    }
    onSave({
      name: name.toUpperCase().trim(),
      description: description.trim(),
      price: parseFloat(price),
      category,
      image: imageUri || 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80',
      highlighted,
      hasSauces,
      hasDrinkSelection,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
              <Ionicons name="close" size={24} color={Theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{product ? 'MODIFIER' : 'AJOUTER'}</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={{ fontFamily: Theme.fonts.bodyBold, color: Theme.colors.success, fontSize: 15 }}>Sauver</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {/* IMAGE TICKER (CHOOSE FROM LOCAL ASSETS) */}
            <Text style={styles.fieldLabel}>CHOISIR UNE PHOTO CI-DESSOUS (BIBLIOTHÈQUE)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              {Object.keys(IMAGES_MAP).map((key) => {
                const isSelected = imageUri === key;
                return (
                  <TouchableOpacity 
                    key={key} 
                    style={[{ marginRight: 12, borderWidth: 2, borderColor: isSelected ? Theme.colors.success : 'transparent', borderRadius: 12, overflow: 'hidden' }]}
                    onPress={() => setImageUri(key)}
                  >
                    <Image source={IMAGES_MAP[key as keyof typeof IMAGES_MAP]} style={{ width: 80, height: 80 }} contentFit="cover" />
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', padding: 2 }}>
                       <Text style={{ color: '#fff', fontSize: 8, textAlign: 'center', fontFamily: Theme.fonts.body }}>{key.toUpperCase()}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={{ fontFamily: Theme.fonts.body, fontSize: 13, color: Theme.colors.textSecondary, marginBottom: 8 }}>Ou mettre un lien internet (URL) :</Text>
            <TextInput style={styles.input} value={imageUri} onChangeText={setImageUri} placeholder="https://..." placeholderTextColor={Theme.colors.textSecondary} />



            <Text style={styles.fieldLabel}>NOM DU PRODUIT *</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ex: DÖNER KEBAB" placeholderTextColor={Theme.colors.textSecondary} />

            <Text style={styles.fieldLabel}>DESCRIPTION</Text>
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={description} onChangeText={setDescription} placeholder="Ingrédients, options..." placeholderTextColor={Theme.colors.textSecondary} multiline />

            <Text style={styles.fieldLabel}>PRIX (CHF) *</Text>
            <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="9.00" placeholderTextColor={Theme.colors.textSecondary} keyboardType="decimal-pad" />

            <Text style={styles.fieldLabel}>CATÉGORIE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {categories.map(cat => (
                  <TouchableOpacity key={cat} style={[styles.catPill, category === cat && styles.catPillActive]} onPress={() => setCategory(cat)}>
                    <Text style={[styles.catPillText, category === cat && styles.catPillTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.switchRow}>
              <View>
                <Text style={styles.switchLabel}>Article signature / populaire</Text>
                <Text style={styles.switchSubtitle}>Mis en avant sur l'accueil</Text>
              </View>
              <Switch
                value={highlighted}
                onValueChange={setHighlighted}
                trackColor={{ false: Theme.colors.surface, true: Theme.colors.success + '88' }}
                thumbColor={highlighted ? Theme.colors.success : Theme.colors.textSecondary}
              />
            </View>

            <View style={[styles.switchRow, { borderTopWidth: StyleSheet.hairlineWidth, borderColor: Theme.colors.border, paddingTop: 16 }]}>
              <View>
                <Text style={styles.switchLabel}>Choix de sauces (max 2)</Text>
                <Text style={styles.switchSubtitle}>Affiche la liste des sauces au client</Text>
              </View>
              <Switch
                value={hasSauces}
                onValueChange={setHasSauces}
                trackColor={{ false: Theme.colors.surface, true: Theme.colors.success + '88' }}
                thumbColor={hasSauces ? Theme.colors.success : Theme.colors.textSecondary}
              />
            </View>

            <View style={[styles.switchRow, { borderTopWidth: StyleSheet.hairlineWidth, borderColor: Theme.colors.border, paddingTop: 16 }]}>
              <View>
                <Text style={styles.switchLabel}>Sélection de boisson</Text>
                <Text style={styles.switchSubtitle}>Affiche la liste des boissons (pour menus)</Text>
              </View>
              <Switch
                value={hasDrinkSelection}
                onValueChange={setHasDrinkSelection}
                trackColor={{ false: Theme.colors.surface, true: Theme.colors.success + '88' }}
                thumbColor={hasDrinkSelection ? Theme.colors.success : Theme.colors.textSecondary}
              />
            </View>

            <View style={{ height: 80 }} />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ──────────────────────────────────
// TAB: SETTINGS
// ──────────────────────────────────
function SettingsTab() {
  const { settings, updateSettings, updateHours } = useRestaurantStore();
  const [localName, setLocalName] = useState(settings.name);
  const [localPhone, setLocalPhone] = useState(settings.phone);
  const [localAddress, setLocalAddress] = useState(settings.address);
  const [localEmail, setLocalEmail] = useState(settings.email);
  const [localWeb, setLocalWeb] = useState(settings.website);
  const [localInsta, setLocalInsta] = useState(settings.instagram);
  const [localDelivery, setLocalDelivery] = useState(settings.deliveryTime);
  const [localTakeaway, setLocalTakeaway] = useState(settings.takeAwayTime);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    updateSettings({
      name: localName, phone: localPhone, address: localAddress,
      email: localEmail, website: localWeb, instagram: localInsta,
      deliveryTime: localDelivery, takeAwayTime: localTakeaway,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}>

      {/* TEMPS ESTIMÉS */}
      <Text style={[styles.sectionHeader, { color: Theme.colors.success }]}>TEMPS ESTIMÉS RÉELS (AFFICHÉS CLIENT)</Text>
      <View style={styles.settingsCard}>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Livraison</Text>
          <TextInput 
            style={[styles.timeInput, { width: 100, backgroundColor: Theme.colors.surface }]} 
            value={localDelivery} 
            onChangeText={setLocalDelivery}
            placeholder="30-45"
            placeholderTextColor="#666"
          />
        </View>
        <View style={[styles.switchRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Theme.colors.border, paddingTop: 14, marginTop: 4 }]}>
          <Text style={styles.switchLabel}>À emporter / Take Away</Text>
          <TextInput 
            style={[styles.timeInput, { width: 100, backgroundColor: Theme.colors.surface }]} 
            value={localTakeaway} 
            onChangeText={setLocalTakeaway}
            placeholder="15-20"
            placeholderTextColor="#666"
          />
        </View>
        <TouchableOpacity style={{ backgroundColor: Theme.colors.success, padding: 12, borderRadius: 8, marginTop: 12, alignItems: 'center' }} onPress={handleSave}>
           <Text style={{ fontFamily: Theme.fonts.bodyBold, color: '#000' }}>{saved ? '● ENREGISTRÉ !' : 'SAUVEGARDER TEMPS'}</Text>
        </TouchableOpacity>
      </View>

      {/* INFO GÉNÉRALES */}
      <Text style={styles.sectionHeader}>INFORMATIONS GÉNÉRALES</Text>
      <View style={styles.settingsCard}>
        <SettingField label="Nom du restaurant" value={localName} onChange={setLocalName} />
        <SettingField label="Téléphone" value={localPhone} onChange={setLocalPhone} keyboard="phone-pad" />
        <SettingField label="Adresse" value={localAddress} onChange={setLocalAddress} />
        <SettingField label="Email" value={localEmail} onChange={setLocalEmail} keyboard="email-address" />
        <SettingField label="Site web" value={localWeb} onChange={setLocalWeb} keyboard="url" last />
      </View>

      {/* RÉSEAUX SOCIAUX */}
      <Text style={styles.sectionHeader}>RÉSEAUX SOCIAUX</Text>
      <View style={styles.settingsCard}>
        <SettingField label="Instagram" value={localInsta} onChange={setLocalInsta} />
        <SettingField label="Facebook" value={settings.facebook} onChange={v => updateSettings({ facebook: v })} last />
      </View>

      {/* MARKETING & PROMOS */}
      <Text style={styles.sectionHeader}>MARKETING & CODES PROMOS</Text>
      <View style={styles.settingsCard}>
        <View style={styles.settingFieldRow}>
           <Text style={styles.fieldLabel}>CODE: "BIENVENUE10"</Text>
           <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
             <Text style={styles.switchSubtitle}>Offre -10% sur toute la carte</Text>
             <Switch value={true} trackColor={{ true: Theme.colors.success + '88' }} thumbColor={Theme.colors.success} />
           </View>
        </View>
        <TouchableOpacity style={{ paddingVertical: 14, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderColor: Theme.colors.border }}>
          <Text style={{ fontFamily: Theme.fonts.bodyBold, color: Theme.colors.primary, fontSize: 13 }}>+ Générer un nouveau code promo</Text>
        </TouchableOpacity>
      </View>

      {/* MATÉRIEL & CAISSE */}
      <Text style={styles.sectionHeader}>MATÉRIEL & IMPRESSION TICKETS</Text>
      <View style={styles.settingsCard}>
        <View style={styles.settingFieldRow}>
           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
             <Ionicons name="print-outline" size={32} color={Theme.colors.textSecondary} />
             <View>
               <Text style={styles.fieldLabel}>IMPRIMANTE THERMIQUE</Text>
               <Text style={styles.switchSubtitle}>Aucun appareil Bluetooth détecté</Text>
             </View>
           </View>
        </View>
        <TouchableOpacity style={{ paddingVertical: 14, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderColor: Theme.colors.border }}>
          <Text style={{ fontFamily: Theme.fonts.bodyBold, color: Theme.colors.primary, fontSize: 13 }}>Rechercher une imprimante</Text>
        </TouchableOpacity>
      </View>

      {/* EMERGENCY STATUS */}
      <Text style={styles.sectionHeader}>STATUT ÉTABLISSEMENT</Text>
      <View style={styles.settingsCard}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Restaurant Ouvert</Text>
            <Text style={{ fontFamily: Theme.fonts.body, fontSize: 12, color: Theme.colors.textSecondary, marginTop: 4 }}>Désactiver uniquement en cas de problème grave.</Text>
          </View>
          <Switch value={settings.isOpen} onValueChange={v => updateSettings({ isOpen: v })}
            trackColor={{ false: Theme.colors.danger + '44', true: Theme.colors.success + '44' }}
            thumbColor={settings.isOpen ? Theme.colors.success : Theme.colors.danger} />
        </View>
      </View>

      {/* OPTIONS */}
      <Text style={styles.sectionHeader}>OPTIONS</Text>
      <View style={styles.settingsCard}>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Accepter les livraisons</Text>
          <Switch value={settings.acceptsDelivery} onValueChange={v => updateSettings({ acceptsDelivery: v })}
            trackColor={{ false: Theme.colors.surface, true: Theme.colors.success + '88' }}
            thumbColor={settings.acceptsDelivery ? Theme.colors.success : Theme.colors.textSecondary} />
        </View>
        <View style={[styles.switchRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Theme.colors.border, paddingTop: 14, marginTop: 4 }]}>
          <Text style={styles.switchLabel}>Accepter les commandes à emporter</Text>
          <Switch value={settings.acceptsPickup} onValueChange={v => updateSettings({ acceptsPickup: v })}
            trackColor={{ false: Theme.colors.surface, true: Theme.colors.success + '88' }}
            thumbColor={settings.acceptsPickup ? Theme.colors.success : Theme.colors.textSecondary} />
        </View>
      </View>



      {/* HORAIRES */}
      <Text style={styles.sectionHeader}>HORAIRES D'OUVERTURE</Text>
      <View style={styles.settingsCard}>
        {settings.hours.map((h, i) => (
          <View key={h.day} style={[styles.hourRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Theme.colors.border, marginTop: 12, paddingTop: 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dayLabel}>{h.day}</Text>
              {h.isOpen && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  <TextInput
                    style={styles.timeInput}
                    value={h.open}
                    onChangeText={v => updateHours(h.day, { open: v })}
                    placeholder="11:00"
                    placeholderTextColor={Theme.colors.textSecondary}
                  />
                  <Text style={{ color: Theme.colors.textSecondary, lineHeight: 36 }}>→</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={h.close}
                    onChangeText={v => updateHours(h.day, { close: v })}
                    placeholder="23:00"
                    placeholderTextColor={Theme.colors.textSecondary}
                  />
                </View>
              )}
              {!h.isOpen && <Text style={styles.closedText}>Fermé</Text>}
            </View>
            <Switch
              value={h.isOpen}
              onValueChange={v => updateHours(h.day, { isOpen: v })}
              trackColor={{ false: Theme.colors.surface, true: Theme.colors.success + '88' }}
              thumbColor={h.isOpen ? Theme.colors.success : Theme.colors.textSecondary}
            />
          </View>
        ))}
      </View>

      {/* ZONES DE LIVRAISON */}
      <Text style={styles.sectionHeader}>ZONES DE LIVRAISON</Text>
      <DeliveryZonesPanel />

      {/* SAUCES & BOISSONS */}
      <Text style={styles.sectionHeader}>SAUCES & BOISSONS (LISTE GLOBALE)</Text>
      <SaucesDrinksPanel />

      {/* SAVE BUTTON */}
      <TouchableOpacity style={[styles.goldBtn, { marginTop: 24 }]} onPress={handleSave}>
        <Text style={styles.goldBtnText}>{saved ? '✓ SAUVEGARDÉ !' : 'SAUVEGARDER LES MODIFICATIONS'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ──────────────────────────────────
// DELIVERY ZONES PANEL
// ──────────────────────────────────
function DeliveryZonesPanel() {
  const { zones, updateZone, fetchZones } = useDeliveryZoneStore();

  React.useEffect(() => {
    fetchZones();
  }, []);

  const styles = StyleSheet.create({
    card: { backgroundColor: Theme.colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Theme.colors.border, overflow: 'hidden', marginBottom: 8 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Theme.colors.border },
    zoneName: { fontFamily: Theme.fonts.bodyBold, fontSize: 14, color: Theme.colors.text },
    zoneMeta: { fontFamily: Theme.fonts.body, fontSize: 11, color: Theme.colors.textSecondary, marginTop: 2 },
    badge: { fontFamily: Theme.fonts.bodyBold, fontSize: 12, color: Theme.colors.primary, backgroundColor: Theme.colors.primary + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  });

  if (zones.length === 0) return (
    <Text style={{ color: Theme.colors.textSecondary, fontFamily: Theme.fonts.body, fontSize: 13, padding: 12 }}>
      Chargement des zones...
    </Text>
  );

  return (
    <View style={styles.card}>
      {zones.map((zone, i) => (
        <View key={zone.id} style={[styles.row, i === zones.length - 1 && { borderBottomWidth: 0 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.zoneName}>{zone.name}</Text>
            <Text style={styles.zoneMeta}>
              Min. {zone.minOrder} CHF • {zone.deliveryFee === 0 ? 'Livraison offerte' : `${zone.deliveryFee} CHF`} • ~{zone.estimatedTime} min
            </Text>
            <Text style={styles.zoneMeta} numberOfLines={1}>
              CP: {zone.postalCodes.join(', ')}
            </Text>
          </View>
          <Switch
            value={zone.active}
            onValueChange={(v) => updateZone(zone.id, { active: v })}
            trackColor={{ false: Theme.colors.surface, true: Theme.colors.success + '88' }}
            thumbColor={zone.active ? Theme.colors.success : Theme.colors.textSecondary}
          />
        </View>
      ))}
    </View>
  );
}

// ──────────────────────────────────
// SAUCES & BOISSONS PANEL
// ──────────────────────────────────
function SaucesDrinksPanel() {
  const { settings, updateSauces, updateDrinks } = useRestaurantStore();
  const [newSauce, setNewSauce] = useState('');
  const [newDrinkName, setNewDrinkName] = useState('');
  const [newDrinkPrice, setNewDrinkPrice] = useState('3.50');
  const [newDrinkSize, setNewDrinkSize] = useState('33cl');

  const addSauce = () => {
    if (!newSauce.trim()) return;
    updateSauces([...settings.sauces, newSauce.trim()]);
    setNewSauce('');
  };

  const removeSauce = (name: string) => {
    updateSauces(settings.sauces.filter(s => s !== name));
  };

  const addDrink = () => {
    if (!newDrinkName.trim()) return;
    const newDrink = {
      name: newDrinkName.trim(),
      price: parseFloat(newDrinkPrice) || 0,
      size: newDrinkSize.trim()
    };
    updateDrinks([...settings.drinks, newDrink]);
    setNewDrinkName('');
  };

  const removeDrink = (name: string) => {
    updateDrinks(settings.drinks.filter(d => d.name !== name));
  };

  const toggleDrinkStock = (name: string) => {
    const updated = settings.drinks.map(d => d.name === name ? { ...d, outOfStock: !d.outOfStock } : d);
    updateDrinks(updated);
  };

  const panels = StyleSheet.create({
    card: { backgroundColor: Theme.colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Theme.colors.border },
    label: { fontFamily: Theme.fonts.bodyBold, fontSize: 13, color: Theme.colors.text, marginBottom: 12, letterSpacing: 1 },
    inputRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    input: { flex: 1, backgroundColor: Theme.colors.background, borderRadius: 8, padding: 10, color: Theme.colors.text, fontFamily: Theme.fonts.body, fontSize: 13, borderWidth: 1, borderColor: Theme.colors.border },
    addBtn: { backgroundColor: Theme.colors.success, width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Theme.colors.background, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Theme.colors.border },
    chipText: { fontFamily: Theme.fonts.body, fontSize: 12, color: Theme.colors.text },
  });

  return (
    <View>
      <View style={panels.card}>
        <Text style={panels.label}>SAUCES DISPONIBLES</Text>
        <View style={panels.inputRow}>
          <TextInput 
            style={panels.input} 
            value={newSauce} 
            onChangeText={setNewSauce} 
            placeholder="Ajouter une sauce..." 
            placeholderTextColor={Theme.colors.textSecondary} 
          />
          <TouchableOpacity style={panels.addBtn} onPress={addSauce}>
            <Ionicons name="add" size={24} color="#000" />
          </TouchableOpacity>
        </View>
        <View style={panels.chipContainer}>
          {settings.sauces.map(s => (
            <View key={s} style={panels.chip}>
              <Text style={panels.chipText}>{s}</Text>
              <TouchableOpacity onPress={() => removeSauce(s)}>
                <Ionicons name="close-circle" size={16} color={Theme.colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>

      <View style={panels.card}>
        <Text style={panels.label}>BOISSONS (SÉLECTION MENU)</Text>
        <View style={{ gap: 10, marginBottom: 16 }}>
          <TextInput 
            style={panels.input} 
            value={newDrinkName} 
            onChangeText={setNewDrinkName} 
            placeholder="Nom (ex: Coca-Cola)" 
            placeholderTextColor={Theme.colors.textSecondary} 
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput 
              style={[panels.input, { flex: 1 }]} 
              value={newDrinkPrice} 
              onChangeText={setNewDrinkPrice} 
              placeholder="Prix (ex: 3.50)" 
              placeholderTextColor={Theme.colors.textSecondary} 
              keyboardType="numeric"
            />
            <TextInput 
              style={[panels.input, { flex: 1 }]} 
              value={newDrinkSize} 
              onChangeText={setNewDrinkSize} 
              placeholder="Taille (ex: 33cl)" 
              placeholderTextColor={Theme.colors.textSecondary} 
            />
            <TouchableOpacity style={panels.addBtn} onPress={addDrink}>
              <Ionicons name="add" size={24} color="#000" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={panels.chipContainer}>
          {settings.drinks.map(d => (
            <View key={d.name} style={[panels.chip, d.outOfStock && { opacity: 0.5, borderColor: Theme.colors.danger }]}>
              <View style={{ flex: 1 }}>
                <Text style={[panels.chipText, d.outOfStock && { textDecorationLine: 'line-through' }]}>{d.name}</Text>
                <Text style={{ fontSize: 9, color: Theme.colors.textSecondary }}>{d.price} CHF • {d.size}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, marginLeft: 8 }}>
                <TouchableOpacity onPress={() => toggleDrinkStock(d.name)}>
                  <Ionicons name={d.outOfStock ? 'eye-off' : 'eye'} size={16} color={d.outOfStock ? Theme.colors.danger : Theme.colors.success} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeDrink(d.name)}>
                  <Ionicons name="close-circle" size={16} color={Theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function SettingField({ label, value, onChange, keyboard, last }: {
  label: string; value: string; onChange: (v: string) => void; keyboard?: any; last?: boolean;
}) {
  return (
    <View style={[styles.settingFieldRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Theme.colors.border, marginBottom: 14, paddingBottom: 14 }]}>
      <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
      <TextInput
        style={styles.settingInput}
        value={value}
        onChangeText={onChange}
        placeholderTextColor={Theme.colors.textSecondary}
        keyboardType={keyboard}
      />
    </View>
  );
}

// ──────────────────────────────────
// STYLES
// ──────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },

  // SaaS Desktop
  saasSidebar: { width: 260, backgroundColor: Theme.colors.surface, borderRightWidth: 1, borderColor: Theme.colors.border, paddingTop: 32 },
  saasSidebarHeader: { paddingHorizontal: 24, marginBottom: 40 },
  saasLogo: { fontFamily: Theme.fonts.logo, fontSize: 32, color: Theme.colors.text, letterSpacing: 4 },
  saasLogoSub: { fontFamily: Theme.fonts.bodyBold, fontSize: 10, color: Theme.colors.success, letterSpacing: 6, marginTop: -4 },
  saasSidebarNav: { flex: 1, paddingHorizontal: 16 },
  saasSidebarNavItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8 },
  saasSidebarNavItemActive: { backgroundColor: Theme.colors.success + '1A', borderWidth: 1, borderColor: Theme.colors.success + '33' },
  saasSidebarNavLabel: { fontFamily: Theme.fonts.bodyMedium, fontSize: 14, color: Theme.colors.textSecondary },
  saasSidebarNavLabelActive: { color: Theme.colors.success, fontFamily: Theme.fonts.bodyBold },
  saasSidebarExit: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 24, paddingBottom: 40, borderTopWidth: 1, borderColor: Theme.colors.border },
  saasSidebarExitText: { fontFamily: Theme.fonts.bodyMedium, fontSize: 14, color: Theme.colors.textSecondary },
  
  saasMainContent: { flex: 1, backgroundColor: Theme.colors.background },
  saasTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, paddingVertical: 20, backgroundColor: Theme.colors.surface, borderBottomWidth: 1, borderColor: Theme.colors.border },
  saasTopBarTitle: { fontFamily: Theme.fonts.title, fontSize: 24, color: Theme.colors.text },
  saasAdminBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Theme.colors.success, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  saasAdminBadgeText: { fontFamily: Theme.fonts.bodyBold, fontSize: 10, color: '#000', letterSpacing: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Theme.colors.border },
  headerTitle: { fontFamily: Theme.fonts.logo, fontSize: 20, color: Theme.colors.text, letterSpacing: 4 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  // TAB BAR
  tabBarWrapper: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Theme.colors.border, backgroundColor: Theme.colors.background },
  tabBarScroll: { paddingHorizontal: 12 },
  tabBtn: { alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 4, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: Theme.colors.success },
  tabLabel: { fontFamily: Theme.fonts.bodyMedium, fontSize: 11, color: Theme.colors.textSecondary },
  tabLabelActive: { color: Theme.colors.success, fontFamily: Theme.fonts.bodyBold },

  scrollContent: { padding: Platform.OS === 'web' ? 32 : 16 },

  // COMMON ADMIN STYLES
  sectionHeader: { fontFamily: Theme.fonts.bodyMedium, fontSize: 10, color: Theme.colors.textSecondary, letterSpacing: 2, marginBottom: 12, marginTop: 16 },
  statusPill: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusPillText: { fontFamily: Theme.fonts.bodyMedium, fontSize: 11 },

  // DASHBOARD PREMIUM OVERRIDE
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 },
  statCard: { flex: 1, minWidth: Platform.OS === 'web' ? 200 : '47%', backgroundColor: Theme.colors.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: Theme.colors.border },
  statValue: { fontFamily: Theme.fonts.title, fontSize: 24, marginBottom: 4 },
  statLabel: { fontFamily: Theme.fonts.bodyMedium, fontSize: 12, color: Theme.colors.textSecondary },
  
  chartCard: { backgroundColor: Theme.colors.surface, borderRadius: 16, padding: 32, borderWidth: 1, borderColor: Theme.colors.border },
  fakeChart: { height: 200, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 20, position: 'relative' },
  chartGridLines: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', borderBottomWidth: 1, borderColor: Theme.colors.border, paddingBottom: 24 },
  chartGridLine: { height: 1, backgroundColor: Theme.colors.border, opacity: 0.5 },
  chartBarWrapper: { alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end', zIndex: 2 },
  chartBar: { width: 32, backgroundColor: Theme.colors.primary, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  chartLabel: { fontFamily: Theme.fonts.bodyMedium, fontSize: 12, color: Theme.colors.textSecondary, marginTop: 12 },
  
  recentActivityCard: { backgroundColor: Theme.colors.surface, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Theme.colors.border, minHeight: 400 },
  activityRow: { flexDirection: 'row', gap: 16, paddingVertical: 16, borderBottomWidth: 1, borderColor: Theme.colors.border + '55', alignItems: 'center' },
  activityDotWrapper: { width: 32, height: 32, borderRadius: 16, backgroundColor: Theme.colors.success + '1A', alignItems: 'center', justifyContent: 'center' },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Theme.colors.success },
  activityInfo: { flex: 1 },
  activityTitle: { fontFamily: Theme.fonts.bodyBold, fontSize: 14, color: Theme.colors.text },
  activityDesc: { fontFamily: Theme.fonts.body, fontSize: 13, color: Theme.colors.textSecondary, marginTop: 4 },
  activityAmount: { fontFamily: Theme.fonts.bodyBold, fontSize: 14, color: Theme.colors.text },
  
  // ORDERS TAB
  orderCard: { backgroundColor: Theme.colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: Theme.colors.border },
  orderCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderId: { fontFamily: Theme.fonts.bodyBold, fontSize: 15, color: Theme.colors.text },
  orderCustomer: { fontFamily: Theme.fonts.bodyMedium, fontSize: 14, color: Theme.colors.text, marginBottom: 4 },
  orderMeta: { fontFamily: Theme.fonts.body, fontSize: 12, color: Theme.colors.textSecondary, marginBottom: 6 },
  orderItemsList: { fontFamily: Theme.fonts.body, fontSize: 13, color: Theme.colors.textSecondary, marginBottom: 8 },
  orderNote: { fontFamily: Theme.fonts.body, fontSize: 12, color: Theme.colors.success, marginBottom: 8 },
  orderCardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  orderTotal: { fontFamily: Theme.fonts.bodyBold, fontSize: 15, color: Theme.colors.success },
  orderTime: { fontFamily: Theme.fonts.body, fontSize: 12, color: Theme.colors.textSecondary },
  orderActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  advanceBtn: { flex: 1, backgroundColor: Theme.colors.success, paddingVertical: 10, borderRadius: 100, alignItems: 'center' },
  advanceBtnText: { fontFamily: Theme.fonts.bodyBold, fontSize: 13, color: '#000' },
  cancelOrderBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Theme.colors.danger, borderRadius: 20 },
  payBtn: { flex: 1, backgroundColor: '#E0E0E0', paddingVertical: 10, borderRadius: 100, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  payBtnText: { fontFamily: Theme.fonts.bodyBold, fontSize: 13, color: '#000' },
  receiptIconBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Theme.colors.background, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Theme.colors.border },
  receiptIconText: { fontFamily: Theme.fonts.bodyMedium, fontSize: 12, color: Theme.colors.textSecondary },

  // DATA TABLE CLASSES
  dataTableWrapper: { backgroundColor: Theme.colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Theme.colors.border, overflow: 'hidden' },
  tableHeaderRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Theme.colors.background, borderBottomWidth: 1, borderColor: Theme.colors.border },
  th: { fontFamily: Theme.fonts.bodyBold, fontSize: 11, color: Theme.colors.textSecondary, letterSpacing: 1 },
  tableRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderColor: Theme.colors.border, alignItems: 'center' },
  tdId: { fontFamily: Theme.fonts.bodyBold, fontSize: 13, color: Theme.colors.text },
  tdTime: { fontFamily: Theme.fonts.body, fontSize: 11, color: Theme.colors.textSecondary, marginTop: 2 },
  tdTitle: { fontFamily: Theme.fonts.bodyMedium, fontSize: 13, color: Theme.colors.text },
  tdSub: { fontFamily: Theme.fonts.body, fontSize: 12, color: Theme.colors.textSecondary, marginTop: 2 },
  iconCircleBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: Theme.colors.border, alignItems: 'center', justifyContent: 'center' },

  filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  filterBtn: { flex: 1, paddingVertical: 10, borderRadius: 100, backgroundColor: Theme.colors.surface, alignItems: 'center', borderWidth: 1, borderColor: Theme.colors.border },
  filterBtnActive: { backgroundColor: Theme.colors.success, borderColor: Theme.colors.success },
  filterText: { fontFamily: Theme.fonts.bodyMedium, fontSize: 13, color: Theme.colors.textSecondary },
  filterTextActive: { color: '#000' },
  callBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Theme.colors.success + '22', borderWidth: 1, borderColor: Theme.colors.success + '44', alignItems: 'center', justifyContent: 'center' },
  callBtnLg: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: Theme.colors.success, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100 },
  callBtnText: { fontFamily: Theme.fonts.bodyBold, fontSize: 12, color: '#000' },

  // MENU
  menuCategoryBar: { backgroundColor: Theme.colors.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Theme.colors.border },
  catPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1, borderColor: Theme.colors.border, backgroundColor: 'transparent' },
  catPillActive: { backgroundColor: Theme.colors.success, borderColor: Theme.colors.success },
  catPillText: { fontFamily: Theme.fonts.bodyMedium, fontSize: 12, color: Theme.colors.textSecondary },
  catPillTextActive: { color: '#000' },
  addCatBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: Theme.colors.success, alignItems: 'center', justifyContent: 'center' },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Theme.colors.surface, borderRadius: 12, padding: 12, marginBottom: 10, gap: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: Theme.colors.border },
  menuItemImage: { width: 64, height: 64, borderRadius: 10, backgroundColor: Theme.colors.background },
  menuItemInfo: { flex: 1 },
  menuItemName: { fontFamily: Theme.fonts.title, fontSize: 16, color: Theme.colors.text, marginBottom: 2 },
  menuItemDesc: { fontFamily: Theme.fonts.body, fontSize: 12, color: Theme.colors.textSecondary, marginBottom: 4 },
  menuItemPrice: { fontFamily: Theme.fonts.bodyBold, fontSize: 14, color: Theme.colors.success },
  menuItemActions: { gap: 8 },
  editBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Theme.colors.success + '22', borderWidth: 1, borderColor: Theme.colors.success + '44', alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Theme.colors.danger + '22', borderWidth: 1, borderColor: Theme.colors.danger + '44', alignItems: 'center', justifyContent: 'center' },
  stockBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Theme.colors.surface, borderWidth: 1, borderColor: Theme.colors.border, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  fab: { position: 'absolute', bottom: 32, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Theme.colors.success, alignItems: 'center', justifyContent: 'center', shadowColor: Theme.colors.success, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10 },

  // MODAL
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  modalBox: { backgroundColor: Theme.colors.surface, borderRadius: 20, padding: 24, width: '85%', gap: 16 },
  modalTitle: { fontFamily: Theme.fonts.logo, fontSize: 20, color: Theme.colors.text, letterSpacing: 3 },
  modalInput: { backgroundColor: Theme.colors.background, borderRadius: 10, padding: 14, fontFamily: Theme.fonts.body, color: Theme.colors.text, borderWidth: StyleSheet.hairlineWidth, borderColor: Theme.colors.border },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 100, borderWidth: 1, borderColor: Theme.colors.border },
  modalCancelText: { fontFamily: Theme.fonts.bodyMedium, color: Theme.colors.textSecondary },

  // SETTINGS
  settingsCard: { backgroundColor: Theme.colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: Theme.colors.border },
  settingFieldRow: {},
  settingInput: { fontFamily: Theme.fonts.bodyMedium, fontSize: 15, color: Theme.colors.text, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Theme.colors.border },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontFamily: Theme.fonts.bodyMedium, fontSize: 15, color: Theme.colors.text, flex: 1 },
  switchSubtitle: { fontFamily: Theme.fonts.body, fontSize: 12, color: Theme.colors.textSecondary, marginTop: 2 },
  hourRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  dayLabel: { fontFamily: Theme.fonts.bodyMedium, fontSize: 15, color: Theme.colors.text },
  closedText: { fontFamily: Theme.fonts.body, fontSize: 13, color: Theme.colors.textSecondary, marginTop: 4 },
  timeInput: { backgroundColor: Theme.colors.background, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, fontFamily: Theme.fonts.body, color: Theme.colors.text, width: 70, textAlign: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: Theme.colors.border },

  // PRODUCT FORM
  imagePicker: { width: '100%', height: 180, backgroundColor: Theme.colors.surface, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: Theme.colors.border, borderStyle: 'dashed' },
  imagePickerText: { fontFamily: Theme.fonts.body, fontSize: 13, color: Theme.colors.textSecondary, marginTop: 8 },
  fieldLabel: { fontFamily: Theme.fonts.bodyMedium, fontSize: 10, color: Theme.colors.textSecondary, letterSpacing: 2, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: Theme.colors.surface, padding: 14, fontFamily: Theme.fonts.body, fontSize: 14, color: Theme.colors.text, borderWidth: StyleSheet.hairlineWidth, borderColor: Theme.colors.border, borderRadius: 12 },

  // SHARED
  goldBtn: { backgroundColor: Theme.colors.success, paddingVertical: 16, paddingHorizontal: 24, borderRadius: 100, alignItems: 'center', shadowColor: Theme.colors.success, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  goldBtnText: { fontFamily: Theme.fonts.bodyBold, fontSize: 15, color: '#000', letterSpacing: 0.5 },
  sectionTitle: { fontFamily: Theme.fonts.title, fontSize: 24, color: Theme.colors.text, letterSpacing: 2 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontFamily: Theme.fonts.title, fontSize: 24, color: Theme.colors.text, letterSpacing: 2 },
  emptySubtitle: { fontFamily: Theme.fonts.body, fontSize: 13, color: Theme.colors.textSecondary, textAlign: 'center', marginTop: 16 },
  // Kanban KDS Styles
  kanbanBoard: { flex: 1, flexDirection: 'row', padding: 20, gap: 20 },
  kanbanCol: { flex: 1, backgroundColor: Theme.colors.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: Theme.colors.border },
  kanbanHeader: { padding: 16, borderBottomWidth: 3, backgroundColor: Theme.colors.background, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kanbanTitle: { fontFamily: Theme.fonts.logo, fontSize: 13, color: Theme.colors.text, letterSpacing: 1.5 },
  kanbanCount: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  kanbanCountText: { fontFamily: Theme.fonts.bodyBold, fontSize: 12 },
  
  kTicket: { backgroundColor: Theme.colors.surface, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Theme.colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  kTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  kId: { fontFamily: Theme.fonts.bodyBold, fontSize: 16, color: Theme.colors.text },
  kTime: { fontFamily: Theme.fonts.body, fontSize: 11, color: Theme.colors.textSecondary },
  kTypeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  kTypeText: { fontFamily: Theme.fonts.bodyBold, fontSize: 9, letterSpacing: 0.5 },
  kDivider: { height: 1, backgroundColor: Theme.colors.border, marginVertical: 10, borderStyle: 'dashed' },
  kItems: { gap: 4 },
  kItem: { fontFamily: Theme.fonts.bodyMedium, fontSize: 14, color: Theme.colors.text },
  kItemQty: { color: Theme.colors.success, fontFamily: Theme.fonts.bodyBold },
  kItemNote: { fontFamily: Theme.fonts.body, fontSize: 12, color: Theme.colors.textSecondary, marginLeft: 24, fontStyle: 'italic' },
  kNoteContainer: { marginTop: 12, padding: 10, backgroundColor: Theme.colors.primary + '11', borderRadius: 8, borderWidth: 1, borderColor: Theme.colors.primary + '33' },
  kNoteLabel: { fontFamily: Theme.fonts.bodyBold, fontSize: 9, color: Theme.colors.primary, letterSpacing: 1, marginBottom: 4 },
  kNoteText: { fontFamily: Theme.fonts.body, fontSize: 12, color: Theme.colors.text },
  kBtn: { marginTop: 16, paddingVertical: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  kBtnText: { fontFamily: Theme.fonts.bodyBold, fontSize: 13, color: '#fff', letterSpacing: 0.5 },
});
