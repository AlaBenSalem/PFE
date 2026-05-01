import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL, apiFetch } from '@api/client';

export default function CitySearchInput({ onSelectCity, placeholder = 'Rechercher une ville...' }) {
  const [query,       setQuery]       = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [open,        setOpen]        = useState(false);
  const debounceRef = useRef(null);

  const search = useCallback(async (text) => {
    if (text.trim().length < 2) { setSuggestions([]); setOpen(false); return; }
    try {
      setLoading(true);
      const res  = await apiFetch(`${API_BASE_URL}/weather/geocode?q=${encodeURIComponent(text.trim())}&limit=6`);
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        setSuggestions(data.data);
        setOpen(true);
      } else {
        setSuggestions([]);
        setOpen(false);
      }
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (text) => {
    setQuery(text);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 350);
  };

  const handleSelect = (item) => {
    setQuery(item.label);
    setSuggestions([]);
    setOpen(false);
    onSelectCity(item.name, item.lat, item.lon);
  };

  const handleSubmit = async () => {
    const q = query.trim();
    if (!q) return;
    setSuggestions([]);
    setOpen(false);
    try {
      setLoading(true);
      const res  = await apiFetch(`${API_BASE_URL}/weather/geocode?q=${encodeURIComponent(q)}&limit=1`);
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        const best = data.data[0];
        setQuery(best.label);
        onSelectCity(best.name, best.lat, best.lon);
      } else {
        onSelectCity(q);
      }
    } catch {
      onSelectCity(q);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.wrapper}>
      <View style={s.row}>
        <TextInput
          style={s.input}
          placeholder={placeholder}
          value={query}
          onChangeText={handleChange}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
          autoCapitalize="words"
        />
        {loading
          ? <View style={s.btn}><ActivityIndicator size="small" color="#fff" /></View>
          : <TouchableOpacity style={s.btn} onPress={handleSubmit}>
              <Ionicons name="search" size={18} color="#fff" />
            </TouchableOpacity>
        }
      </View>

      {open && suggestions.length > 0 && (
        <View style={s.dropdown}>
          <FlatList
            data={suggestions}
            keyExtractor={(_, i) => String(i)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={s.item} onPress={() => handleSelect(item)}>
                <Ionicons name="location-outline" size={14} color="#6b7280" style={{ marginRight: 8 }} />
                <Text style={s.itemText}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper:   { marginHorizontal: 16, marginTop: 12, zIndex: 9999 },
  row:       { flexDirection: 'row' },
  input: {
    flex: 1, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 9,
    borderTopLeftRadius: 8, borderBottomLeftRadius: 8,
    borderWidth: 1, borderColor: '#e5e7eb', fontSize: 13,
  },
  btn: {
    backgroundColor: '#22c55e', paddingHorizontal: 14,
    borderTopRightRadius: 8, borderBottomRightRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  dropdown: {
    position: 'absolute', top: 42, left: 0, right: 0,
    backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb',
    maxHeight: 220, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 20, zIndex: 9999,
  },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  itemText: { fontSize: 13, color: '#374151', flex: 1 },
});
