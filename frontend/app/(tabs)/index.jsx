import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator,
  RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { API_ENDPOINTS, apiFetch } from '@api/client';
import { BrandHeader } from '@components/BrandHeader';
import { useLanguage } from '@context/LanguageContext';
import { useSession } from '@hooks/useSession';
import { translateCropName } from '@utils/cropNames';
import CitySearchInput from '@components/CitySearchInput';
import { useIrrigationData } from '@hooks/useIrrigationData';

// Identique à fmtTemps dans irrigation.jsx
const fmtTemps = (minutes) =>
  minutes >= 60
    ? `${Math.floor(minutes / 60)}h${minutes % 60 > 0 ? String(minutes % 60).padStart(2, '0') : ''}`
    : `${minutes} min`;

export default function HomeScreen() {
  const router          = useRouter();
  const { t, language } = useLanguage();
  const { user, role }  = useSession();

  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [currentCity, setCurrentCity] = useState('Tunis');

  // ─── useIrrigationData ────────────────────────────────────────────────────
  // calculateNeedsForCulture(culture, mode) est une fonction PURE :
  // elle appelle _calculateNeeds(culture, mode) directement, sans toucher
  // à selectedCulture → aucun setState pendant le render → aucune boucle.
  const {
    cultures,
    fetchCultures,
    calculateNeedsForCulture,
    weatherData: hookWeatherData,
    historyItems,
    kcDynamique,
  } = useIrrigationData();

  // ─── Météo ────────────────────────────────────────────────────────────────
  const fetchWeatherForCity = async (cityName, lat, lon) => {
    if (!cityName || cityName.trim() === '') return;
    try {
      setLoading(true);
      let url;
      if (lat && lon) {
        url = `${API_ENDPOINTS.weather.current}?lat=${lat}&lon=${lon}`;
      } else {
        url = `${API_ENDPOINTS.weather.current}?city=${encodeURIComponent(cityName.trim())}`;
      }
      const response = await apiFetch(url);
      const result   = await response.json();
      if (result.success) {
        setWeatherData(result.data);
        setCurrentCity(result.data.location?.city || cityName);
      } else {
        Alert.alert(t('common.error'), result.error || t('common.error'));
      }
    } catch (error) {
      console.log('Erreur meteo:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWeatherForCity('Tunis');
    fetchCultures();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchWeatherForCity(currentCity);
    fetchCultures();
  };

  // ─── Calcul des besoins pour les 3 premières cultures ─────────────────────
  // useMemo : recalcule uniquement quand la liste des cultures change.
  // calculateNeedsForCulture est pure (pas de setState) → sûr dans useMemo.
  const cultureNeeds = useMemo(() => {
    return cultures.slice(0, 3).map((culture) => ({
      culture,
      needs: calculateNeedsForCulture(
        culture,
        culture.irrigation?.mode || culture.modeIrrigation || 'goutte-à-goutte'
      ),
    }));
  }, [cultures, hookWeatherData, historyItems, kcDynamique]);

  if (loading && !weatherData) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F6F8' }}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  const tempMin         = weatherData?.temperature?.min?.toFixed(0) || '--';
  const tempMax         = weatherData?.temperature?.max?.toFixed(0) || '--';
  const humidity        = weatherData?.humidity?.current || '--';
  const windSpeed       = weatherData?.wind?.speed?.toFixed(1) || '--';
  const et0Display      = weatherData?.et0?.toFixed(2) || '0.00';
  const locationCity    = weatherData?.location?.city || currentCity;
  const locationCountry = weatherData?.location?.country || '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F4F6F8' }}>
      <BrandHeader variant="transparent" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Recherche */}
        <CitySearchInput
          placeholder={t('common.search')}
          onSelectCity={fetchWeatherForCity}
        />

        {/* Météo */}
        <View style={{ backgroundColor: '#EDEFF1', marginHorizontal: 16, padding: 16, borderRadius: 16, marginTop: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="sunny" size={20} color="#F4B400" />
              <Text style={{ fontSize: 15, fontWeight: '600', marginLeft: 8, color: '#111827' }}>{t('home.weather')}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
                <Ionicons name="location" size={13} color={'#666'} />
                <Text style={{ fontSize: 11, color: '#666', marginLeft: 3 }}>
                  {locationCity}{locationCountry ? ` - ${locationCountry}` : ''}
                </Text>
              </View>
              <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99 }}>
                <Text style={{ color: '#15803d', fontWeight: '600', fontSize: 11 }}>
                  {t('home.et0')}: {et0Display} mm/j
                </Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {[
              { name: 'thermometer',   lib: 'MC', color: '#ff5252', val: `${tempMin}/${tempMax}°`, lbl: `${t('home.min')}/${t('home.max')}` },
              { name: 'water',         lib: 'IO', color: '#03a9f4', val: `${humidity}%`,           lbl: t('home.humidity') },
              { name: 'weather-windy', lib: 'MC', color: '#5f6368', val: `${windSpeed} km/h`,      lbl: t('home.wind') },
            ].map((item, i) => (
              <View key={i} style={{ backgroundColor: '#ffffff', flex: 1, marginHorizontal: 4, padding: 12, borderRadius: 12, alignItems: 'center' }}>
                {item.lib === 'IO'
                  ? <Ionicons name={item.name} size={22} color={item.color} />
                  : <MaterialCommunityIcons name={item.name} size={22} color={item.color} />
                }
                <Text style={{ fontSize: 13, fontWeight: '700', marginTop: 6, color: '#111827' }}>{item.val}</Text>
                <Text style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{item.lbl}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Compteurs */}
        <View style={{ flexDirection: 'row', marginHorizontal: 16, marginTop: 12 }}>
          <TouchableOpacity
            style={{ backgroundColor: '#ffffff', flex: 1, marginRight: 8, padding: 16, borderRadius: 12, alignItems: 'center' }}
            onPress={() => router.push('/(tabs)/cultures')}
          >
            <MaterialCommunityIcons name="sprout" size={28} color="#4CAF50" style={{ marginBottom: 8 }} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>{cultures.length}</Text>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>{t('home.crops')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ backgroundColor: '#ffffff', flex: 1, marginLeft: 8, padding: 16, borderRadius: 12, alignItems: 'center' }}
            onPress={() => router.push('/(tabs)/irrigation')}
          >
            <MaterialCommunityIcons name="water" size={28} color="#2196f3" style={{ marginBottom: 8 }} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
              {cultures.filter(c => c.historiqueIrrigation?.length > 0).length}
            </Text>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>{t('home.irrigations')}</Text>
          </TouchableOpacity>
        </View>

        {/* Cultures */}
        <View style={{ marginHorizontal: 16, marginTop: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>
              {cultures.length === 0 ? t('home.noCrops') : t('home.yourCrops')}
            </Text>
            {cultures.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/(tabs)/cultures')}>
                <Text style={{ color: '#22c55e', fontSize: 13 }}>{t('common.seeAll')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {cultures.length === 0 ? (
            <View style={{ backgroundColor: '#ffffff', padding: 24, borderRadius: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16, textAlign: 'center' }}>
                {t('home.addFirstCrop')}
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/cultures')}
                style={{ backgroundColor: '#22c55e', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 99 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>{t('home.addCrop')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              {cultureNeeds.map(({ culture, needs }) => (
                <TouchableOpacity
                  key={culture._id}
                  onPress={() => router.push('/(tabs)/irrigation')}
                  style={{
                    backgroundColor: '#ffffff', padding: 16, borderRadius: 12,
                    marginBottom: 8, borderWidth: 1, borderColor: '#f3f4f6',
                  }}
                >
                  <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
                    {translateCropName(culture.nom, language)}
                  </Text>
                  <Text style={{ fontSize: 26, fontWeight: '700', color: '#16a34a', marginBottom: 8 }}>
                    {needs.eauM3} m³
                  </Text>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: '#2563eb' }}>
                    {fmtTemps(needs.temps)}
                  </Text>
                </TouchableOpacity>
              ))}
              {cultures.length > 3 && (
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/cultures')}
                  style={{ paddingVertical: 8 }}
                >
                  <Text style={{ textAlign: 'center', color: '#22c55e', fontWeight: '600' }}>
                    + {cultures.length - 3} {t('home.otherCrops')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}