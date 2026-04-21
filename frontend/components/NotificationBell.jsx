// C:\Users\HAMA\OneDrive\Desktop\SmartIrrig2\frontend\components\NotificationBell.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal,
  ScrollView, Animated, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const TYPE = {
  urgent:  { bg: '#FEF2F2', border: '#FECACA', dot: '#EF4444', icon: 'alert-circle',      color: '#EF4444' },
  warning: { bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B', icon: 'warning-outline',    color: '#F59E0B' },
  info:    { bg: '#F0FDF4', border: '#BBF7D0', dot: '#16A34A', icon: 'information-circle', color: '#16A34A' },
  done:    { bg: '#F8FAFC', border: '#E2E8F0', dot: '#94A3B8', icon: 'checkmark-circle',   color: '#94A3B8' },
};

const LABELS = {
  fr: { title: 'Notifications', new: 'nouvelle(s)', empty: 'Aucune notification', markAll: 'Tout marquer comme lu' },
  en: { title: 'Notifications', new: 'new',         empty: 'No notifications',    markAll: 'Mark all as read'      },
  ar: { title: 'الإشعارات',     new: 'جديد',         empty: 'لا توجد إشعارات',     markAll: 'تحديد الكل كمقروء'    },
  tr: { title: 'Bildirimler',   new: 'yeni',         empty: 'Bildirim yok',        markAll: 'Tümünü okundu işaretle'},
};

export default function NotificationBell({ notifications = [], onMarkRead, onMarkAllRead, lang = 'fr' }) {
  const [open, setOpen] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const L = LABELS[lang] || LABELS.fr;
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (unread > 0) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.25, useNativeDriver: true, friction: 4 }),
        Animated.spring(scale, { toValue: 1,    useNativeDriver: true, friction: 4 }),
        Animated.timing(shake, { toValue: 7,  duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -7, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 4,  duration: 45, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0,  duration: 45, useNativeDriver: true }),
      ]).start();
    }
  }, [unread]);

  const handleClose = () => { setOpen(false); onMarkAllRead?.(); };

  return (
    <>
      {/* ── Cloche ── */}
      <TouchableOpacity onPress={() => setOpen(true)} hitSlop={{ top:10, bottom:10, left:10, right:10 }} style={{ padding: 4 }}>
        <Animated.View style={{ transform: [{ translateX: shake }, { scale }] }}>
          <Ionicons name="notifications-outline" size={24} color="#374151" />
        </Animated.View>
        {unread > 0 && (
          <View style={{
            position:'absolute', top:2, right:2, minWidth:16, height:16,
            borderRadius:8, backgroundColor:'#EF4444',
            alignItems:'center', justifyContent:'center', paddingHorizontal:3,
          }}>
            <Text style={{ color:'#fff', fontSize:9, fontWeight:'800' }}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* ── Modal ── */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={handleClose}>
        <TouchableOpacity style={{ flex:1, backgroundColor:'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={handleClose}>
          <SafeAreaView
            edges={['top', 'left', 'right']}
            style={{
              position:'absolute', top:0, left:0, right:0,
              backgroundColor:'#fff',
              borderBottomLeftRadius:24, borderBottomRightRadius:24,
              shadowColor:'#000', shadowOffset:{width:0,height:6},
              shadowOpacity:0.12, shadowRadius:16, elevation:10,
            }}
            onStartShouldSetResponder={() => true}
          >
            {/* Header */}
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingVertical:16, borderBottomWidth:1, borderBottomColor:'#F1F5F9' }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                <Ionicons name="notifications" size={20} color="#16A34A" />
                <Text style={{ fontSize:16, fontWeight:'700', color:'#1F2937' }}>{L.title}</Text>
                {unread > 0 && (
                  <View style={{ backgroundColor:'#FEE2E2', paddingHorizontal:8, paddingVertical:2, borderRadius:99 }}>
                    <Text style={{ color:'#EF4444', fontSize:11, fontWeight:'700' }}>{unread} {L.new}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={handleClose}>
                <Ionicons name="close" size={22} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Liste */}
            <ScrollView style={{ maxHeight:460 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:12 }}>
              {notifications.length === 0 ? (
                <View style={{ paddingVertical:48, alignItems:'center' }}>
                  <Text style={{ fontSize:40, marginBottom:10 }}>🔔</Text>
                  <Text style={{ color:'#9CA3AF', fontSize:14 }}>{L.empty}</Text>
                </View>
              ) : (
                notifications.map((n) => {
                  const s = TYPE[n.type] || TYPE.info;
                  return (
                    <TouchableOpacity
                      key={n.id}
                      onPress={() => onMarkRead?.(n.id)}
                      activeOpacity={0.7}
                      style={{
                        flexDirection:'row', alignItems:'flex-start',
                        backgroundColor: n.read ? '#F8FAFC' : s.bg,
                        borderWidth:1, borderColor: n.read ? '#F1F5F9' : s.border,
                        borderRadius:14, padding:14, marginBottom:8,
                      }}
                    >
                      <Ionicons name={s.icon} size={20} color={n.read ? '#CBD5E1' : s.color} style={{ marginRight:10, marginTop:1 }} />
                      <View style={{ flex:1 }}>
                        <Text style={{ fontSize:13, fontWeight:'600', color: n.read ? '#94A3B8' : '#1F2937', marginBottom:3 }}>{n.title}</Text>
                        <Text style={{ fontSize:12, color: n.read ? '#CBD5E1' : '#6B7280', lineHeight:17 }} numberOfLines={2}>{n.message}</Text>
                        {n.time ? <Text style={{ fontSize:11, color:'#D1D5DB', marginTop:4 }}>{n.time}</Text> : null}
                      </View>
                      {!n.read && <View style={{ width:8, height:8, borderRadius:4, backgroundColor:s.dot, marginLeft:8, marginTop:4 }} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {/* Footer */}
            {notifications.length > 0 && (
              <TouchableOpacity
                onPress={() => onMarkAllRead?.()}
                style={{ marginHorizontal:16, marginBottom:16, marginTop:4, paddingVertical:12, borderRadius:12, borderWidth:1, borderColor:'#E2E8F0', alignItems:'center' }}
              >
                <Text style={{ fontSize:13, fontWeight:'600', color:'#6B7280' }}>{L.markAll}</Text>
              </TouchableOpacity>
            )}
            <View style={{ height: Platform.OS === 'ios' ? 12 : 4 }} />
          </SafeAreaView>
        </TouchableOpacity>
      </Modal>
    </>
  );
}