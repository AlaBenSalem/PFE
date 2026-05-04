// C:\Users\HAMA\OneDrive\Desktop\SmartIrrig2\frontend\hooks\useNotifications.js
import { useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const stableId = (...parts) => parts.join('|');

const MOIS = {
  fr: ['Janv','Févr','Mars','Avr','Mai','Juin','Juil','Août','Sept','Oct','Nov','Déc'],
  en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  ar: ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],
  tr: ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'],
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Notifications FERTILISATION
// ─────────────────────────────────────────────────────────────────────────────
export function useFertilisationNotifications(cultures, getFertData, lang = 'fr') {
  const [readIds, setReadIds] = useState({});
  const months = MOIS[lang] || MOIS.fr;

  const todayRef = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const notifications = useMemo(() => {
    // ✅ Guard : si cultures pas encore chargées
    const safeCultures = Array.isArray(cultures) ? cultures : [];
    if (!safeCultures.length) return [];

    const year = todayRef.getFullYear();
    const list = [];

    safeCultures.forEach((culture) => {
      if (!culture) return;
      const plan = getFertData ? getFertData(culture.nom) : [];
      if (!Array.isArray(plan)) return;

      plan.forEach((ev) => {
        const evDate = new Date(year, ev.mois - 1, ev.jour);
        const diff   = Math.round((evDate - todayRef) / 86400000);
        const dateLabel = `${ev.jour} ${months[ev.mois - 1]}`;
        const id = stableId(culture._id || culture.nom, ev.mois, ev.jour, ev.produit);

        if (diff === 0) {
          list.push({
            id, type: 'urgent',
            title: { fr:`⚠️ Aujourd'hui — ${culture.nom}`, en:`⚠️ Today — ${culture.nom}`, ar:`⚠️ اليوم — ${culture.nom}`, tr:`⚠️ Bugün — ${culture.nom}` }[lang],
            message: { fr:`Appliquer ${ev.produit} · ${ev.dose}`, en:`Apply ${ev.produit} · ${ev.dose}`, ar:`${ev.produit} — ${ev.dose}`, tr:`${ev.produit} uygula · ${ev.dose}` }[lang],
            time: dateLabel,
          });
        } else if (diff > 0 && diff <= 7) {
          list.push({
            id, type: 'warning',
            title: { fr:`📅 ${culture.nom} — dans ${diff} jour${diff>1?'s':''}`, en:`📅 ${culture.nom} — in ${diff} day${diff>1?'s':''}`, ar:`📅 ${culture.nom} — خلال ${diff} أيام`, tr:`📅 ${culture.nom} — ${diff} gün kaldı` }[lang],
            message: `${ev.produit} · ${ev.dose}`,
            time: dateLabel,
          });
        } else if (diff < 0 && diff >= -3) {
          const ago = Math.abs(diff);
          list.push({
            id, type: 'info',
            title: { fr:`🔔 Rappel — ${culture.nom}`, en:`🔔 Reminder — ${culture.nom}`, ar:`🔔 تذكير — ${culture.nom}`, tr:`🔔 Hatırlatma — ${culture.nom}` }[lang],
            message: { fr:`${ev.produit} — il y a ${ago} jour${ago>1?'s':''}`, en:`${ev.produit} — ${ago} day${ago>1?'s':''} ago`, ar:`${ev.produit} — منذ ${ago} أيام`, tr:`${ev.produit} — ${ago} gün önce` }[lang],
            time: dateLabel,
          });
        }
      });
    });

    const ORDER = { urgent:0, warning:1, info:2, done:3 };
    list.sort((a, b) => (ORDER[a.type]||3) - (ORDER[b.type]||3));
    return list.map((n) => ({ ...n, read: !!readIds[n.id] }));
  }, [cultures, getFertData, lang, todayRef, readIds, months]);

  const markRead = useCallback((id) => {
    setReadIds((r) => ({ ...r, [id]: true }));
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = { ...prev };
      notifications.forEach((n) => { next[n.id] = true; });
      return next;
    });
  }, [notifications]);

  return { notifications, markRead, markAllRead };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Notifications IRRIGATION
// ─────────────────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'smartirrig_irrig_notif_read';

export function useIrrigationNotifications(cultures, irrigations, weather, lang = 'fr') {
  const [readIds, setReadIds] = useState({});

  // Charger les IDs lus depuis AsyncStorage au montage
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) {
        try { setReadIds(JSON.parse(val)); } catch {}
      }
    });
  }, []);

  const todayRef = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const et0 = weather?.et0 ?? null;

  const notifications = useMemo(() => {
    // ✅ Guards : données pas encore chargées → retourner liste vide
    const safeCultures   = Array.isArray(cultures)   ? cultures   : [];
    const safeIrrigations = Array.isArray(irrigations) ? irrigations : [];

    if (!safeCultures.length) return [];

    const list = [];

    safeCultures.forEach((culture) => {
      if (!culture) return;
      const cid = culture._id;

      const cultIrrs = safeIrrigations
        .filter((i) => i && (i.cultureId?._id || i.cultureId) === cid)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      const last = cultIrrs[0];
      const lastDay = last
        ? (() => { const d = new Date(last.date); d.setHours(0,0,0,0); return d; })()
        : null;
      const daysSince = lastDay
        ? Math.round((todayRef - lastDay) / 86400000)
        : 99;

      const kc  = culture.kcActuel || 0.65;
      const etc = et0 != null ? parseFloat((et0 * kc).toFixed(1)) : null;

      const dateKey   = todayRef.toISOString().slice(0, 10);
      const idDone    = stableId(cid, 'done',    dateKey);
      const idUrgent  = stableId(cid, 'urgent',  dateKey);
      const idWarning = stableId(cid, 'warning', dateKey);
      const idInfo    = stableId(cid, 'info',    dateKey);

      if (daysSince === 0) {
        list.push({
          id: idDone, type: 'done',
          title: { fr:`✅ Irrigué — ${culture.nom}`, en:`✅ Irrigated — ${culture.nom}`, ar:`✅ تم الري — ${culture.nom}`, tr:`✅ Sulandı — ${culture.nom}` }[lang],
          message: last ? `${Math.round(last.volume)} L · ${last.mode} · ${last.duree} min` : '—',
          time: culture.parcelle || '',
        });
      } else if (etc !== null && etc > 5) {
        list.push({
          id: idUrgent, type: 'urgent',
          title: { fr:`🚨 Besoin élevé — ${culture.nom}`, en:`🚨 High need — ${culture.nom}`, ar:`🚨 احتياج عالي — ${culture.nom}`, tr:`🚨 Yüksek ihtiyaç — ${culture.nom}` }[lang],
          message: { fr:`ETc ${etc} mm/j · non irrigué depuis ${daysSince} j`, en:`ETc ${etc} mm/d · not irrigated for ${daysSince}d`, ar:`ETc ${etc} mm/j · لم يُروَ منذ ${daysSince} أيام`, tr:`ETc ${etc} mm/g · ${daysSince} gündür sulanmadı` }[lang],
          time: culture.parcelle || '',
        });
      } else if (etc !== null && etc > 3 && daysSince >= 2) {
        list.push({
          id: idWarning, type: 'warning',
          title: { fr:`💧 À vérifier — ${culture.nom}`, en:`💧 Check — ${culture.nom}`, ar:`💧 تحقق — ${culture.nom}`, tr:`💧 Kontrol et — ${culture.nom}` }[lang],
          message: { fr:`ETc ${etc} mm/j · ${daysSince} jours sans irrigation`, en:`ETc ${etc} mm/d · ${daysSince} days without`, ar:`ETc ${etc} mm/j · ${daysSince} أيام بدون ري`, tr:`ETc ${etc} mm/g · ${daysSince} gün sulama yok` }[lang],
          time: culture.parcelle || '',
        });
      } else if (et0 === null) {
        list.push({
          id: idInfo, type: 'info',
          title: { fr:`ℹ️ ${culture.nom} — météo indisponible`, en:`ℹ️ ${culture.nom} — no weather data`, ar:`ℹ️ ${culture.nom} — الطقس غير متوفر`, tr:`ℹ️ ${culture.nom} — hava durumu yok` }[lang],
          message: { fr:`Kc: ${kc} · Dernier: ${daysSince===99?'jamais':`il y a ${daysSince}j`}`, en:`Kc: ${kc} · Last: ${daysSince===99?'never':`${daysSince}d ago`}`, ar:`Kc: ${kc}`, tr:`Kc: ${kc}` }[lang],
          time: culture.parcelle || '',
        });
      }
    });

    const ORDER = { urgent:0, warning:1, info:2, done:3 };
    list.sort((a, b) => (ORDER[a.type]||3) - (ORDER[b.type]||3));
    return list.map((n) => ({ ...n, read: !!readIds[n.id] }));
  }, [cultures, irrigations, lang, todayRef, et0, readIds]);

  const markRead = useCallback((id) => {
    setReadIds((r) => {
      const next = { ...r, [id]: true };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = { ...prev };
      notifications.forEach((n) => { next[n.id] = true; });
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, [notifications]);

  return { notifications, markRead, markAllRead };
}