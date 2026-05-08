// app/(tabs)/irrigation.jsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, Modal, FlatList, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BrandHeader } from '@components/BrandHeader';
import { Platform } from 'react-native';
import NotificationBell from '@components/NotificationBell';
import { useIrrigationNotifications } from '@hooks/useNotifications';
import { API_ENDPOINTS, apiFetch } from '@api/client';
import { useLanguage } from '@context/LanguageContext';
import ETcHistory from '@components/ETcHistory';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// ─── Constantes ────────────────────────────────────────────────────────────────

const PERTE_PAR_MODE = {
  'goutte-à-goutte': 0.10,
  'aspersion':       0.30,
  'gravitaire':      0.40,
};
const EFF_PAR_MODE = {
  'goutte-à-goutte': 0.90,
  'aspersion':       0.70,
  'gravitaire':      0.60,
};
const MODE_EMOJI = {
  'goutte-à-goutte': '💧',
  'aspersion':       '💦',
  'gravitaire':      '🌊',
};
const SOL_LABELS = {
  sableux:        'Sableux 🏖️',
  limono_sableux: 'Limono-sableux 🌾',
  limoneux:       'Limoneux 🌱',
  argilo_limoneux:'Argilo-limoneux 🏔️',
  argileux:       'Argileux 🪨',
};
const DEFAULT_BESOINS = {
  eauMm: '0.0', eauTheoriqueMm: '0.0', perteMm: '0.0',
  pourcentagePerte: 0, temps: 0, debitMmh: '0.0',
  eta: 90, et0: '0.00', kc: '0.65', etc: '0.00',
  volumeLitres: null, litresParArbre: null, mmParArbre: null, surface: 0,
};
const TAB_LABELS = {
  needs:   { fr: 'Besoins',    en: 'Needs',   ar: 'الاحتياجات', tr: 'İhtiyaçlar' },
  history: { fr: 'Historique', en: 'History', ar: 'السجل',      tr: 'Geçmiş'     },
};
const ALERT_TXT = {
  fr: { count: 'alerte(s) en cours', tap: 'Appuyez sur 🔔 pour les détails' },
  en: { count: 'active alert(s)',    tap: 'Tap 🔔 for details' },
  ar: { count: 'تنبيهات نشطة',       tap: 'اضغط على 🔔 للتفاصيل' },
  tr: { count: 'aktif uyarı',        tap: 'Detaylar için 🔔 ye dokunun' },
};

const MOIS_LABELS_FR = [
  'Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmtTemps = (minutes) =>
  minutes >= 60
    ? `${Math.floor(minutes / 60)}h${minutes % 60 > 0 ? String(minutes % 60).padStart(2, '0') : ''}`
    : `${minutes} min`;

const fmtDate = (date) => {
  try {
    const diff = (Date.now() - new Date(date).getTime()) / 60000;
    if (diff < 1)    return "À l'instant";
    if (diff < 60)   return `${Math.floor(diff)} min`;
    if (diff < 1440) return `${Math.floor(diff / 60)} h`;
    return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  } catch { return 'Date inconnue'; }
};

const fmtProchaine = (frequenceJours) => {
  const d = new Date();
  d.setDate(d.getDate() + (frequenceJours || 1));
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
};

// ─── Composant principal ───────────────────────────────────────────────────────

export default function IrrigationPage() {
  const { t, language } = useLanguage();
  const lang = language || 'fr';

  const [cultures,             setCultures]             = useState([]);
  const [selectedCulture,      setSelectedCulture]      = useState(null);
  const [selectedMode,         setSelectedMode]         = useState('goutte-à-goutte');
  const [loading,              setLoading]              = useState(true);
  const [weatherData,          setWeatherData]          = useState(null);
  const [weatherByRegion,      setWeatherByRegion]      = useState({});
  const [loadingWeatherRegion, setLoadingWeatherRegion] = useState(false);
  const [historyItems,         setHistoryItems]         = useState([]);
  const [isCompleted,          setIsCompleted]          = useState(false);
  const [etcHistoryKey,        setEtcHistoryKey]        = useState(0);
  const [cultureModalVisible,  setCultureModalVisible]  = useState(false);
  const [activeTab,            setActiveTab]            = useState('needs');
  const [error,                setError]                = useState(null);
  const [exporting,            setExporting]            = useState(false);

  // ── Kc dynamique saisonnier FAO-56 ──────────────────────────────────────────
  const [kcDynamique, setKcDynamique] = useState(null);
  const [kcStade,     setKcStade]     = useState('');
  const [kcSource,    setKcSource]    = useState('');
  const [loadingKc,   setLoadingKc]   = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await Promise.all([fetchCultures(), fetchWeather(), fetchHistory()]);
      } catch (err) {
        console.error('Irrigation.init:', err.message);
        setError('Erreur lors du chargement initial');
      }
    };
    init();
  }, []);

  // ── Fetchers ────────────────────────────────────────────────────────────────

  const fetchCultures = async () => {
    try {
      const res = await apiFetch(API_ENDPOINTS.cultures.base);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.success) {
        setCultures(result.data ?? []);
        if (result.data?.length > 0) {
          setSelectedCulture(result.data[0]);
          fetchKcDynamique(result.data[0]);
        }
      } else throw new Error(result.message || 'Réponse API invalide');
    } catch (err) {
      console.error('Irrigation.fetchCultures:', err.message);
      setError('Impossible de charger les cultures.');
      Alert.alert(t('common.error'), t('irrigation.cannotLoad'));
    } finally {
      setLoading(false);
    }
  };

  const fetchWeather = async (city = 'Tunis') => {
    try {
      const res = await apiFetch(`${API_ENDPOINTS.weather.current}?city=${encodeURIComponent(city)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.success && result.data) { setWeatherData(result.data); return result.data; }
      throw new Error('Données météo invalides');
    } catch (err) {
      console.error('Irrigation.fetchWeather:', err.message);
      const fallback = { et0: 4.48, temperature: { avg: 20 }, humidity: { avg: 60 } };
      setWeatherData(fallback);
      return fallback;
    }
  };

  const fetchWeatherForRegion = async (region) => {
    if (!region) return;
    const key = region.trim().toLowerCase();
    if (weatherByRegion[key]) return;
    setLoadingWeatherRegion(true);
    try {
      const res = await apiFetch(`${API_ENDPOINTS.weather.current}?city=${encodeURIComponent(region)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.success && result.data)
        setWeatherByRegion(prev => ({ ...prev, [key]: result.data }));
    } catch (err) {
      console.error('fetchWeatherForRegion:', err.message);
    } finally {
      setLoadingWeatherRegion(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await apiFetch(API_ENDPOINTS.irrigations.base);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.success) setHistoryItems(result.data ?? []);
      else throw new Error('Données historiques invalides');
    } catch (err) {
      console.error('Irrigation.fetchHistory:', err.message);
      setHistoryItems([]);
    }
  };

  const fetchKcDynamique = async (culture) => {
    if (!culture?.nom) return;
    setLoadingKc(true);
    try {
      const moisCourant = new Date().getMonth() + 1;
      const endpoint = API_ENDPOINTS.kc.current(culture.nom, moisCourant);
      const res = await apiFetch(endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.success && result.data) {
        const kc    = parseFloat(result.data.kc);
        const stade = result.data.stade  || '';
        const src   = result.data.source || culture.nom;
        setKcDynamique(kc >= 0.1 && kc <= 2.0 ? kc : 0.65);
        setKcStade(stade);
        setKcSource(src);
      } else {
        throw new Error(result.error || 'Réponse invalide');
      }
    } catch (err) {
      console.warn(`⚠️ fetchKcDynamique fallback pour "${culture.nom}":`, err.message);
      setKcDynamique(parseFloat(culture.kcActuel) || 0.65);
      setKcStade('');
      setKcSource('');
    } finally {
      setLoadingKc(false);
    }
  };

  // ── Calcul besoins ──────────────────────────────────────────────────────────

  const calculateNeeds = () => {
    if (!selectedCulture || !weatherData) return { ...DEFAULT_BESOINS };
    try {
      const regionKey     = selectedCulture.region?.trim().toLowerCase();
      const activeWeather = (regionKey && weatherByRegion[regionKey]) || weatherData;

      const et0      = parseFloat(activeWeather.et0)                   || 4.48;
      const kc       = kcDynamique ?? parseFloat(selectedCulture.kcActuel) ?? 0.65;
      const surface  = parseFloat(selectedCulture.surface)             || 100;
      const debitLH  = parseFloat(selectedCulture.irrigation?.debit)   || 1000;
      const nbArbres = selectedCulture.nombreArbres                    || null;

      const etc          = et0 * kc;
      const perte        = PERTE_PAR_MODE[selectedMode] || 0.10;
      const eta          = 1 - perte;
      const eauMm        = etc / eta;
      const perteMm      = eauMm - etc;
      const debitMmh     = debitLH / surface;
      const tempsMinutes = Math.round((eauMm / debitMmh) * 60);
      const volumeLitres = Math.round(eauMm * surface);
      const litresParArbre = nbArbres ? Math.round((eauMm * surface) / nbArbres) : null;
      const mmParArbre     = nbArbres ? ((eauMm * surface) / nbArbres).toFixed(1) : null;

      const typeSol   = selectedCulture.typeSol || 'limoneux';
      const typeCult  = selectedCulture.type    || 'legume';
      const RU_MM_PAR_M = { sableux:60, limono_sableux:90, limoneux:120, argilo_limoneux:140, argileux:150 };
      const P_BASE      = { agrume:0.50, fruit:0.50, legume:0.40, cereale:0.55 };
      const Z_DEFAUT    = { agrume:0.90, fruit:1.00, legume:0.50, cereale:1.00 };
      const z    = selectedCulture.profondeurRacinaire || Z_DEFAUT[typeCult] || 0.60;
      const pAdj = Math.min(0.8, Math.max(0.1, (P_BASE[typeCult] || 0.50) + 0.04 * (5 - etc)));
      const ru   = parseFloat(((RU_MM_PAR_M[typeSol] || 120) * z).toFixed(1));
      const rfu  = parseFloat((pAdj * ru).toFixed(1));

      return {
        eauMm:           eauMm.toFixed(1),
        eauTheoriqueMm:  etc.toFixed(1),
        perteMm:         perteMm.toFixed(1),
        pourcentagePerte: Math.round(perte * 100),
        temps:           tempsMinutes,
        debitMmh:        debitMmh.toFixed(1),
        eta:             Math.round(eta * 100),
        et0:             et0.toFixed(2),
        kc:              kc.toFixed(2),
        etc:             etc.toFixed(2),
        mmParArbre,
        litresParArbre,
        volumeLitres,
        surface,
        typeSol,
        ru, rfu,
        pAdj:           pAdj.toFixed(2),
        z,
        frequenceJours: etc > 0 ? Math.max(1, Math.round(rfu / etc)) : 7,
        sourceRegion:   (regionKey && weatherByRegion[regionKey]) ? selectedCulture.region : null,
      };
    } catch (err) {
      console.error('Irrigation.calculateNeeds:', err.message);
      return { ...DEFAULT_BESOINS };
    }
  };

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleFaitPress = async () => {
    if (!selectedCulture) { Alert.alert(t('common.error'), t('irrigation.selectCulture')); return; }
    if (isCompleted) return;
    try {
      const needs = calculateNeeds();
      const res = await apiFetch(API_ENDPOINTS.irrigations.base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cultureId:  selectedCulture._id,
          mode:       selectedMode,
          duree:      needs.temps,
          volume:     needs.volumeLitres,
          debit:      selectedCulture.irrigation?.debit || 1000,
          et0:        parseFloat(needs.et0),
          etc:        parseFloat(needs.etc),
          kc:         parseFloat(needs.kc),
          surface:    needs.surface,
          efficacite: EFF_PAR_MODE[selectedMode],
          eauMm:      parseFloat(needs.eauMm),
          debitMmh:   parseFloat(needs.debitMmh),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.success) {
        setIsCompleted(true);
        await fetchHistory();
        setEtcHistoryKey(p => p + 1);
        Alert.alert(t('common.success'), t('irrigation.saveSuccess'));
      } else throw new Error(result.message || "Échec de l'enregistrement");
    } catch (err) {
      console.error('Irrigation.handleFaitPress:', err.message);
      Alert.alert(t('common.error'), t('irrigation.saveFailed'));
    }
  };

  const handleSelectCulture = (culture) => {
    setSelectedCulture(culture);
    setKcDynamique(null);
    setKcStade('');
    setKcSource('');
    setIsCompleted(false);
    setEtcHistoryKey(p => p + 1);
    setCultureModalVisible(false);
    if (culture.region) fetchWeatherForRegion(culture.region);
    fetchKcDynamique(culture);
  };

  const getModeLabel = (mode) => {
    if (mode === 'goutte-à-goutte') return t('irrigation.drip')      || 'Goutte-à-goutte';
    if (mode === 'aspersion')       return t('irrigation.sprinkler') || 'Aspersion';
    return t('irrigation.gravity') || 'Gravitaire';
  };

  const exportIrrigation = async () => {
    try {
      setExporting(true);
      if (!historyItems?.length) { Alert.alert(t('common.information'), t('irrigation.noDataToExport')); return; }
      const headers = ['Date','Culture','Parcelle','Mode','Eau (mm)','Durée (min)','Débit (mm/h)','ET₀ (mm/j)','ETc (mm/j)','Kc','Surface (m²)','Efficacité (%)'];
      const rows = historyItems.map(item => {
        const culture = cultures.find(c => c._id === (item.cultureId?._id || item.cultureId));
        return [
          new Date(item.date).toLocaleDateString('fr-FR'),
          item.nom || culture?.nom || item.cultureId?.nom || '—',
          culture?.parcelle || '—',
          item.mode || '—',
          item.eauMm != null ? Number(item.eauMm).toFixed(1) : (item.volume / (item.surface || 100)).toFixed(1),
          item.duree || item.temps || '—',
          item.debitMmh || (item.debit / (item.surface || 100)).toFixed(1),
          item.et0  != null ? Number(item.et0).toFixed(2)  : '—',
          item.etc  != null ? Number(item.etc).toFixed(2)  : '—',
          item.kc   != null ? Number(item.kc).toFixed(2)   : '—',
          item.surface || culture?.surface || '—',
          item.efficacite != null ? Math.round(item.efficacite * 100) : '—',
        ];
      });
      const escape = (v) => {
        const s = v == null ? '' : String(v);
        return (s.includes(',') || s.includes('"') || s.includes('\n'))
          ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      const csv = '\uFEFF' + [
        headers.map(escape).join(','),
        ...rows.map(r => r.map(escape).join(',')),
      ].join('\r\n');
      const filename = `SmartIrrig_Irrigation_${new Date().toISOString().split('T')[0]}.csv`;

      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = Object.assign(document.createElement('a'), { href: url, download: filename, style: 'display:none' });
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      } else {
        const fileUri = FileSystem.documentDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: t('irrigation.exporter') || "Exporter l'irrigation", UTI: 'public.comma-separated-values-text' });
        } else {
          Alert.alert(t('common.error'), t('irrigation.shareNotAvailable'));
        }
      }
    } catch (err) {
      console.error('Irrigation.exportIrrigation:', err.message);
      Alert.alert(t('common.error'), t('irrigation.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  // ── Hooks dérivés ────────────────────────────────────────────────────────────

  const { notifications, markRead, markAllRead } = useIrrigationNotifications(
    cultures ?? [], historyItems ?? [], weatherData ?? null, lang
  );
  const urgentCount = (notifications ?? []).filter(n => !n.read && (n.type === 'urgent' || n.type === 'warning')).length;

  // ── Render guards ────────────────────────────────────────────────────────────

  if (loading) return (
    <SafeAreaView style={{ flex:1, backgroundColor:'#f3f4f6', alignItems:'center', justifyContent:'center' }}>
      <ActivityIndicator size="large" color="#4CAF50" />
    </SafeAreaView>
  );

  if (error && cultures.length === 0) return (
    <SafeAreaView style={{ flex:1, backgroundColor:'#f3f4f6', alignItems:'center', justifyContent:'center', padding:20 }}>
      <Ionicons name="alert-circle" size={48} color="#ef4444" />
      <Text style={{ marginTop:16, fontSize:16, color:'#6b7280', textAlign:'center' }}>{error}</Text>
      <TouchableOpacity
        style={{ marginTop:20, backgroundColor:'#4CAF50', paddingHorizontal:20, paddingVertical:12, borderRadius:10 }}
        onPress={() => { setError(null); setLoading(true); Promise.all([fetchCultures(), fetchWeather(), fetchHistory()]).finally(() => setLoading(false)); }}
      >
        <Text style={{ color:'#fff', fontWeight:'600' }}>Réessayer</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );

  const besoins  = selectedCulture ? calculateNeeds() : DEFAULT_BESOINS;
  const alertTxt = ALERT_TXT[lang] || ALERT_TXT.fr;
  const hasData  = selectedCulture && besoins.eauMm !== '0.0';
  const moisActuel = MOIS_LABELS_FR[new Date().getMonth()];

  // ── JSX ──────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:'#f3f4f6' }}>
      <BrandHeader
        title={t('irrigation.title')}
        right={
          <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
            {historyItems.length > 0 && (
              <TouchableOpacity style={s.exportBtn} onPress={exportIrrigation} activeOpacity={0.8} disabled={exporting}>
                {exporting
                  ? <ActivityIndicator size="small" color="#16a34a" />
                  : <><Ionicons name="download-outline" size={15} color="#16a34a" /><Text style={s.exportBtnText}>{t('irrigation.exporter')}</Text></>
                }
              </TouchableOpacity>
            )}
            <NotificationBell notifications={notifications ?? []} onMarkRead={markRead} onMarkAllRead={markAllRead} lang={lang} />
          </View>
        }
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal:20, paddingBottom:90, paddingTop:12 }} showsVerticalScrollIndicator={false}>

        {/* Alerte urgente */}
        {urgentCount > 0 && (
          <View style={s.alertBanner}>
            <Ionicons name="alert-circle" size={16} color="#dc2626" />
            <View style={{ flex:1 }}>
              <Text style={s.alertTitle}>{urgentCount} {alertTxt.count}</Text>
              <Text style={s.alertSub}>{alertTxt.tap}</Text>
            </View>
          </View>
        )}

        {/* Culture picker */}
        <TouchableOpacity style={s.culturePicker} onPress={() => setCultureModalVisible(true)}>
          <View style={{ flex:1 }}>
            <Text style={s.culturePickerLabel}>Culture</Text>
            {selectedCulture ? (
              <>
                <Text style={s.culturePickerName}>{selectedCulture.nom}</Text>
                <Text style={s.culturePickerSub}>
                  {selectedCulture.parcelle} · {selectedCulture.surface} m²
                  {selectedCulture.nombreArbres ? ` · ${selectedCulture.nombreArbres} arbres` : ''}
                  {selectedCulture.region ? ` · 🌍 ${selectedCulture.region}` : ''}
                </Text>
              </>
            ) : (
              <Text style={[s.culturePickerName, { color:'#9ca3af', fontStyle:'italic', fontWeight:'400' }]}>
                {cultures.length === 0 ? 'Aucune culture disponible' : 'Sélectionner une culture'}
              </Text>
            )}
          </View>
          <Ionicons name={cultureModalVisible ? 'chevron-up' : 'chevron-down'} size={24} color="#4CAF50" />
        </TouchableOpacity>

        {/* Tabs */}
        <View style={s.tabRow}>
          {['needs', 'history'].map(tab => (
            <TouchableOpacity key={tab} style={[s.tab, activeTab === tab && s.tabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
                {(TAB_LABELS[tab] || {})[lang] || TAB_LABELS[tab].fr}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ════ TAB BESOINS ════ */}
        {activeTab === 'needs' && (
          <>
            <Text style={s.sectionTitle}>{t('irrigation.mode') || "Mode d'irrigation"}</Text>
            <View style={s.modesRow}>
              {['goutte-à-goutte', 'aspersion', 'gravitaire'].map(mode => {
                const active = selectedMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[s.modeCard, active && s.modeCardActive]}
                    onPress={() => { setSelectedMode(mode); setIsCompleted(false); }}
                  >
                    <Text style={s.modeEmoji}>{MODE_EMOJI[mode]}</Text>
                    <Text style={[s.modeLabel, active && s.modeLabelActive]}>{getModeLabel(mode)}</Text>
                    <Text style={s.modePct}>η = {Math.round((1 - PERTE_PAR_MODE[mode]) * 100)}%</Text>
                    <Text style={[s.modePct, { color:'#ef4444' }]}>+{Math.round(PERTE_PAR_MODE[mode] * 100)}%</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ════ CARTE PRINCIPALE ════ */}
            {hasData && !isCompleted && (
              <View style={s.mainCard}>

                {/* En-tête FAO-56 */}
                <View style={s.conseilHeader}>
                  <Ionicons name="information-circle" size={18} color="#0369a1" />
                  <Text style={s.conseilTitle}>Conseil d'irrigation FAO-56</Text>
                  {loadingWeatherRegion && <ActivityIndicator size="small" color="#0369a1" style={{ marginLeft:8 }} />}
                </View>
                <Text style={s.conseilText}>
                  Culture <Text style={s.bold}>{selectedCulture.nom} ({selectedCulture.variete})</Text>
                  {' · '}{SOL_LABELS[besoins.typeSol] || besoins.typeSol}
                  {selectedCulture.region ? ` · 🌍 ${selectedCulture.region}` : ''}
                </Text>

                {/* Stats ET₀ / Kc / ETc / RFU */}
                <View style={s.statsRow}>
                  <View style={s.statItem}>
                    <Text style={s.statLabel}>ET₀{besoins.sourceRegion ? ` (${selectedCulture.region})` : ''}</Text>
                    <Text style={[s.statVal, { color:'#2563eb' }]}>{besoins.et0}</Text>
                    <Text style={s.statUnit}>mm/j</Text>
                  </View>
                  <View style={s.statSep} />
                  <View style={s.statItem}>
                    <Text style={s.statLabel}>Kc (FAO-56)</Text>
                    {loadingKc
                      ? <ActivityIndicator size="small" color="#7c3aed" style={{ marginVertical:4 }} />
                      : <Text style={[s.statVal, { color:'#7c3aed' }]}>{besoins.kc}</Text>
                    }
                    {kcStade
                      ? <Text style={[s.statUnit, { color:'#7c3aed', fontSize:9 }]}>{kcStade}</Text>
                      : <Text style={s.statUnit}>{moisActuel}</Text>
                    }
                  </View>
                  <View style={s.statSep} />
                  <View style={s.statItem}>
                    <Text style={s.statLabel}>ETc</Text>
                    <Text style={[s.statVal, { color:'#16a34a' }]}>{besoins.etc}</Text>
                    <Text style={s.statUnit}>mm/j</Text>
                  </View>
                  <View style={s.statSep} />
                  <View style={s.statItem}>
                    <Text style={s.statLabel}>RFU sol</Text>
                    <Text style={[s.statVal, { color:'#7c3aed' }]}>{besoins.rfu}</Text>
                    <Text style={s.statUnit}>mm</Text>
                  </View>
                </View>

                {/* Dosage principal + débit */}
                <View style={s.dosageRow}>
                  <View style={{ flex:1 }}>
                    <Text style={s.dosageLabel}>Eau à apporter</Text>
                    <Text style={s.dosageBig}>{besoins.eauMm} <Text style={s.dosageUnit}>mm</Text></Text>
                    <Text style={s.dosageSub}>
                      théorique: {besoins.eauTheoriqueMm} mm · pertes: {besoins.perteMm} mm ({besoins.pourcentagePerte}%)
                    </Text>
                    {besoins.litresParArbre && (
                      <Text style={[s.dosageSub, { color:'#16a34a', marginTop:3 }]}>
                        ≈ {besoins.litresParArbre} L/arbre
                        {besoins.volumeLitres ? ` · ${besoins.volumeLitres.toLocaleString('fr-FR')} L sur ${besoins.surface} m²` : ''}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems:'flex-end' }}>
                    <Text style={s.debitLabel}>Débit</Text>
                    <Text style={s.debitVal}>{besoins.debitMmh} mm/h</Text>
                    <Text style={s.debitVal}>{fmtTemps(besoins.temps)}</Text>
                    <Text style={[s.debitVal, { color:'#16a34a' }]}>{besoins.eta}% eff.</Text>
                  </View>
                </View>

                {/* Banners contextuels */}
                <View style={[s.banner, { backgroundColor:'#eff6ff', borderColor:'#93c5fd' }]}>
                  <Ionicons name="time-outline" size={15} color="#2563eb" />
                  <Text style={[s.bannerText, { color:'#1d4ed8' }]}>
                    Ouvrez la vanne pendant <Text style={s.bold}>{fmtTemps(besoins.temps)}</Text> à{' '}
                    <Text style={s.bold}>{besoins.debitMmh} mm/h</Text> (efficacité {besoins.eta}%).
                  </Text>
                </View>

                <View style={[s.banner, { backgroundColor:'#faf5ff', borderColor:'#c4b5fd' }]}>
                  <Ionicons name="calendar-outline" size={15} color="#7c3aed" />
                  <Text style={[s.bannerText, { color:'#6d28d9' }]}>
                    RU = {besoins.ru} mm · RFU = {besoins.rfu} mm (p={besoins.pAdj}, z={besoins.z} m).
                    {' '}Fréquence : <Text style={s.bold}>tous les {besoins.frequenceJours} jours</Text>.
                    {' '}Prochaine : <Text style={s.bold}>{fmtProchaine(besoins.frequenceJours)}</Text>.
                  </Text>
                </View>

                {/* Bouton Fait */}
                <TouchableOpacity style={s.doneBtn} onPress={handleFaitPress}>
                  <Text style={s.doneBtnText}>{t('irrigation.done') || 'Fait'} ✓</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Carte completed */}
            {isCompleted && selectedCulture && (
              <View style={s.completedCard}>
                <MaterialCommunityIcons name="check-circle" size={50} color="#4CAF50" />
                <Text style={s.completedTitle}>{t('irrigation.completed') || 'Irrigation enregistrée !'}</Text>
                <Text style={s.completedName}>{selectedCulture.nom}</Text>
                <Text style={[s.dosageBig, { marginTop:8 }]}>{besoins.eauMm} <Text style={s.dosageUnit}>mm</Text></Text>
                <Text style={s.completedSub}>sur {selectedCulture.surface} m²</Text>
                {besoins.litresParArbre && <Text style={s.completedSub}>≈ {besoins.litresParArbre} L/arbre</Text>}
                <Text style={s.completedSub}>{besoins.debitMmh} mm/h · {fmtTemps(besoins.temps)}</Text>
                <Text style={s.completedMeta}>ETc = {besoins.etc} mm · ET₀ {besoins.et0} × Kc {besoins.kc} · η = {besoins.eta}%</Text>
              </View>
            )}

            {selectedCulture && (
              <View style={{ marginBottom:24 }}>
                <ETcHistory
                  key={etcHistoryKey}
                  cultureId={selectedCulture._id}
                  cultureName={selectedCulture.nom}
                  todayEtc={parseFloat(besoins.etc)}
                  todayEt0={parseFloat(besoins.et0)}
                  todayKc={parseFloat(besoins.kc)}
                />
              </View>
            )}
          </>
        )}

        {/* ════ TAB HISTORIQUE ════ */}
        {activeTab === 'history' && (
          <View style={s.histWrap}>
            {historyItems.length === 0 ? (
              <View style={s.emptyWrap}>
                <Text style={{ fontSize:48, marginBottom:12 }}>📋</Text>
                <Text style={s.emptyText}>{t('irrigation.noHistory') || 'Aucune irrigation enregistrée'}</Text>
              </View>
            ) : (
              historyItems.map((item, idx) => {
                const eauMm    = item.eauMm != null ? Number(item.eauMm).toFixed(1) : (item.volume / (item.surface || 100)).toFixed(1);
                const debitMmh = item.debitMmh || (item.debit / (item.surface || 100)).toFixed(1);
                return (
                  <View key={item._id}>
                    <View style={s.histRow}>
                      <Text style={s.histCulture}>{item.nom || item.cultureId?.nom}</Text>
                      <Text style={s.histTime}>{fmtDate(item.date)}</Text>
                    </View>
                    <View style={s.histModeBadge}>
                      <Text style={s.histModeText}>{MODE_EMOJI[item.mode]} {getModeLabel(item.mode)}</Text>
                    </View>
                    <View style={{ flexDirection:'row', alignItems:'center', marginTop:4, flexWrap:'wrap', gap:4 }}>
                      <Text style={[s.histVol, { color:'#16a34a' }]}>{eauMm} mm</Text>
                      <Text style={s.histSep}>·</Text>
                      <Text style={s.histDur}>{debitMmh} mm/h</Text>
                      <Text style={s.histSep}>·</Text>
                      <Text style={s.histDur}>{item.duree || item.temps} min</Text>
                    </View>
                    {item.et0 != null && item.etc != null && (
                      <View style={{ flexDirection:'row', marginTop:4, gap:12, flexWrap:'wrap' }}>
                        <Text style={s.histMeta}>ET₀: {Number(item.et0).toFixed(2)} mm/j</Text>
                        <Text style={[s.histMeta, { color:'#16a34a' }]}>ETc: {Number(item.etc).toFixed(2)} mm/j</Text>
                        <Text style={[s.histMeta, { color:'#7c3aed' }]}>Kc: {Number(item.kc).toFixed(2)}</Text>
                      </View>
                    )}
                    {idx < historyItems.length - 1 && <View style={s.histDivider} />}
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal culture */}
      <Modal visible={cultureModalVisible} transparent animationType="slide" onRequestClose={() => setCultureModalVisible(false)}>
        <TouchableOpacity style={{ flex:1, backgroundColor:'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={() => setCultureModalVisible(false)}>
          <SafeAreaView edges={['bottom','left','right']} style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Choisir une culture</Text>
              <TouchableOpacity onPress={() => setCultureModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            {cultures.length === 0 ? (
              <View style={s.emptyWrap}>
                <Text style={{ fontSize:40, marginBottom:8 }}>🌱</Text>
                <Text style={s.emptyText}>Aucune culture disponible</Text>
              </View>
            ) : (
              <FlatList
                data={cultures}
                keyExtractor={item => item._id}
                style={{ maxHeight:380 }}
                contentContainerStyle={{ paddingVertical:8 }}
                renderItem={({ item }) => {
                  const isSelected = selectedCulture?._id === item._id;
                  const kcAffichéModal = isSelected
                    ? (kcDynamique?.toFixed(2) ?? parseFloat(item.kcActuel || 0.65).toFixed(2))
                    : parseFloat(item.kcActuel || 0.65).toFixed(2);
                  return (
                    <TouchableOpacity
                      style={[s.cultureItem, isSelected && s.cultureItemActive]}
                      onPress={() => handleSelectCulture(item)}
                    >
                      <View style={{ flex:1 }}>
                        <Text style={[s.cultureItemName, isSelected && { color:'#15803d' }]}>{item.nom}</Text>
                        <Text style={s.cultureItemSub}>{item.parcelle} · {item.variete}</Text>
                        <View style={{ flexDirection:'row', flexWrap:'wrap', marginTop:6, gap:6 }}>
                          <View style={s.chipWrap}><Text style={s.chipText}>{item.surface} m²</Text></View>
                          {item.nombreArbres && <View style={s.chipWrap}><Text style={s.chipText}>{item.nombreArbres} arbres</Text></View>}
                          <View style={s.chipWrap}>
                            <Text style={[s.chipText, { color:'#7c3aed', fontWeight:'600' }]}>
                              Kc: {kcAffichéModal}
                              {isSelected && kcStade ? ` · ${kcStade}` : ''}
                            </Text>
                          </View>
                        </View>
                      </View>
                      {isSelected && <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            <View style={{ height:24 }} />
          </SafeAreaView>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  alertBanner: { flexDirection:'row', alignItems:'flex-start', gap:8, backgroundColor:'#fee2e2', borderWidth:1, borderColor:'#fecaca', borderRadius:14, paddingHorizontal:14, paddingVertical:12, marginBottom:16 },
  alertTitle:  { fontSize:13, fontWeight:'700', color:'#dc2626' },
  alertSub:    { fontSize:11, color:'#ef4444', marginTop:2 },
  culturePicker:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:'#fff', borderRadius:16, padding:16, marginBottom:16, shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.06, shadowRadius:4, elevation:2 },
  culturePickerLabel: { fontSize:13, color:'#6b7280', marginBottom:4 },
  culturePickerName:  { fontSize:20, fontWeight:'600', color:'#1f2937' },
  culturePickerSub:   { fontSize:13, color:'#6b7280', marginTop:4 },
  mainCard:     { backgroundColor:'#fff', borderRadius:16, padding:16, marginBottom:16, shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.08, shadowRadius:6, elevation:3, borderLeftWidth:4, borderLeftColor:'#0ea5e9' },
  conseilHeader:{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:8 },
  conseilTitle: { fontSize:14, fontWeight:'700', color:'#0369a1', flex:1 },
  conseilText:  { fontSize:13, color:'#374151', lineHeight:20, marginBottom:12 },
  bold:         { fontWeight:'700', color:'#111827' },
  statsRow: { flexDirection:'row', alignItems:'center', backgroundColor:'#f8fafc', borderRadius:12, padding:10, marginBottom:14 },
  statItem: { flex:1, alignItems:'center' },
  statSep:  { width:1, height:36, backgroundColor:'#e5e7eb' },
  statLabel:{ fontSize:10, color:'#6b7280', marginBottom:3, textAlign:'center' },
  statVal:  { fontSize:18, fontWeight:'700' },
  statUnit: { fontSize:10, color:'#9ca3af', marginTop:2 },
  dosageRow:  { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 },
  dosageLabel:{ fontSize:13, color:'#6b7280', marginBottom:4 },
  dosageBig:  { fontSize:42, fontWeight:'700', color:'#16a34a', lineHeight:46 },
  dosageUnit: { fontSize:20, fontWeight:'600', color:'#16a34a' },
  dosageSub:  { fontSize:11, color:'#9ca3af', marginTop:4 },
  debitLabel: { fontSize:12, color:'#6b7280', marginBottom:4 },
  debitVal:   { fontSize:14, fontWeight:'600', color:'#374151', marginTop:2 },
  banner:     { flexDirection:'row', alignItems:'flex-start', gap:8, padding:10, borderRadius:10, borderWidth:1, marginBottom:8 },
  bannerText: { flex:1, fontSize:13, lineHeight:19 },
  doneBtn:     { backgroundColor:'#f0fdf4', borderWidth:2, borderColor:'#15803d', borderRadius:50, paddingVertical:14, alignItems:'center', marginTop:4 },
  doneBtnText: { fontSize:17, fontWeight:'600', color:'#166534' },
  completedCard:  { backgroundColor:'#f0fdf4', borderWidth:2, borderColor:'#bbf7d0', borderRadius:16, padding:24, marginBottom:16, alignItems:'center' },
  completedTitle: { fontSize:20, fontWeight:'600', color:'#166634', marginTop:8 },
  completedName:  { fontSize:22, fontWeight:'700', color:'#1f2937', marginTop:6 },
  completedSub:   { fontSize:15, color:'#16a34a', marginTop:4 },
  completedMeta:  { fontSize:13, color:'#6b7280', marginTop:4, textAlign:'center' },
  tabRow:        { flexDirection:'row', backgroundColor:'#f1f5f9', borderRadius:14, padding:4, marginBottom:20 },
  tab:           { flex:1, paddingVertical:10, borderRadius:11, alignItems:'center' },
  tabActive:     { backgroundColor:'#fff', shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.06, shadowRadius:3, elevation:2 },
  tabText:       { fontSize:14, fontWeight:'500', color:'#9ca3af' },
  tabTextActive: { fontWeight:'700', color:'#111827' },
  sectionTitle:  { fontSize:16, fontWeight:'600', color:'#4b5563', marginBottom:12 },
  modesRow:       { flexDirection:'row', backgroundColor:'#fff', borderRadius:16, padding:12, marginBottom:16, shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.06, shadowRadius:4, elevation:2, gap:4 },
  modeCard:       { flex:1, alignItems:'center', paddingVertical:12, paddingHorizontal:4, borderRadius:12, borderWidth:1.5, borderColor:'transparent' },
  modeCardActive: { backgroundColor:'#f0fdf4', borderColor:'#86efac' },
  modeEmoji:      { fontSize:24, marginBottom:4 },
  modeLabel:      { fontSize:11, fontWeight:'500', color:'#4b5563', textAlign:'center' },
  modeLabelActive:{ color:'#166534', fontWeight:'700' },
  modePct:        { fontSize:10, color:'#9ca3af', marginTop:2 },
  histWrap:     { backgroundColor:'#fff', borderRadius:16, padding:20, shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.06, shadowRadius:4, elevation:2, marginBottom:16 },
  histRow:      { flexDirection:'row', justifyContent:'space-between', marginBottom:4 },
  histCulture:  { fontSize:14, fontWeight:'600', color:'#f97316' },
  histTime:     { fontSize:13, color:'#9ca3af' },
  histModeBadge:{ backgroundColor:'#f3f4f6', paddingHorizontal:12, paddingVertical:4, borderRadius:50, alignSelf:'flex-start', marginBottom:4 },
  histModeText: { fontSize:12, color:'#4b5563' },
  histVol:      { fontSize:18, fontWeight:'700' },
  histSep:      { fontSize:14, color:'#6b7280', marginHorizontal:8 },
  histDur:      { fontSize:14, color:'#4b5563' },
  histMeta:     { fontSize:11, color:'#6b7280' },
  histDivider:  { height:1, backgroundColor:'#e5e7eb', marginVertical:12 },
  exportBtn:     { flexDirection:'row', alignItems:'center', gap:5, backgroundColor:'#f0fdf4', borderWidth:1, borderColor:'#86efac', paddingHorizontal:10, paddingVertical:6, borderRadius:20 },
  exportBtnText: { fontSize:12, fontWeight:'700', color:'#16a34a' },
  emptyWrap: { alignItems:'center', paddingVertical:40 },
  emptyText: { fontSize:15, color:'#9ca3af', fontStyle:'italic' },
  sheet:       { position:'absolute', bottom:0, left:0, right:0, backgroundColor:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24 },
  sheetHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:20, paddingVertical:16, borderBottomWidth:1, borderBottomColor:'#f3f4f6' },
  sheetTitle:  { fontSize:17, fontWeight:'700', color:'#1f2937' },
  cultureItem:       { flexDirection:'row', alignItems:'center', marginHorizontal:16, marginVertical:4, padding:16, borderRadius:12, backgroundColor:'#f9fafb', borderWidth:1, borderColor:'#f3f4f6' },
  cultureItemActive: { backgroundColor:'#f0fdf4', borderColor:'#bbf7d0' },
  cultureItemName:   { fontSize:15, fontWeight:'600', color:'#1f2937' },
  cultureItemSub:    { fontSize:13, color:'#6b7280', marginTop:2 },
  chipWrap: { backgroundColor:'#fff', borderWidth:1, borderColor:'#e5e7eb', borderRadius:50, paddingHorizontal:8, paddingVertical:3 },
  chipText: { fontSize:11, color:'#4b5563' },
});