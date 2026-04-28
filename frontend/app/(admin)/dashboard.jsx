import { useEffect, useMemo, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { AdminShell } from "@components/AdminShell";
import { API_ENDPOINTS, apiFetch } from "@api/client";
import { useLanguage } from "@context/LanguageContext";
import { router } from "expo-router";

const COLORS = {
  greenDark: "#16a34a",
  blue: "#3b82f6",
  orange: "#f59e0b",
  text: "#111827",
  muted: "#6b7280",
};

function formatNumber(value) {
  if (value == null) return "0";
  const number = Number(value);
  if (Number.isNaN(number)) return "0";
  return number.toLocaleString();
}

export default function AdminDashboard() {
  const { t, isRTL } = useLanguage();
  const [stats, setStats] = useState(null);
  const [volumeByDay, setVolumeByDay] = useState([]);
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const dynStyles = useMemo(
    () => ({
      statLabel: isRTL
        ? { textAlign: "right" }
        : { textTransform: "uppercase", letterSpacing: 0.6 },
      legendRow: { marginTop: 8, alignItems: isRTL ? "flex-start" : "flex-end" },
      panelSubtitle: {
        fontSize: 13,
        color: COLORS.muted,
        marginTop: 2,
        textAlign: isRTL ? "right" : "left",
      },
      panelTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: COLORS.text,
        textAlign: isRTL ? "right" : "left",
      },
    }),
    [isRTL],
  );

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [statsRes, volumeRes, usersRes] = await Promise.all([
        apiFetch(API_ENDPOINTS.admin.stats),
        apiFetch(API_ENDPOINTS.admin.volumeByDay(14)),
        apiFetch(API_ENDPOINTS.admin.users),
      ]);

      const statsJson = await statsRes.json();
      const volumeJson = await volumeRes.json();
      const usersJson = await usersRes.json().catch(() => ({}));

      if (statsRes.ok && statsJson.success) setStats(statsJson.data);
      if (volumeRes.ok && volumeJson.success) setVolumeByDay(volumeJson.data || []);
      if (usersRes.ok && Array.isArray(usersJson.users)) {
        setUsers(usersJson.users);
      }
    } catch (error) {
      console.error("Dashboard load error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, []);

  useEffect(() => {
    if (!selectedUser) return;
    const fetchUserVolume = async () => {
      setChartLoading(true);
      try {
        const res = await apiFetch(API_ENDPOINTS.admin.volumeByDay(14, selectedUser._id || selectedUser.id));
        const json = await res.json();
        if (res.ok && json.success) setVolumeByDay(json.data || []);
      } catch {}
      finally { setChartLoading(false); }
    };
    fetchUserVolume();
  }, [selectedUser]);

  const todayCount = stats?.todayIrrigations ?? 0;
  const totalUsers = stats?.totalUsers ?? 0;

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      `${u.firstName || ""} ${u.lastName || ""} ${u.email || ""}`.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const chartSeries = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(today.getDate() - 13);
    const map = new Map();
    volumeByDay.forEach((item) => {
      map.set(item._id, item.volume || 0);
    });

    return Array.from({ length: 14 }).map((_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = date.toISOString().slice(0, 10);
      return {
        label: String(date.getDate()).padStart(2, "0"),
        value: map.get(key) || 0,
      };
    });
  }, [volumeByDay]);

  const maxChartValue = Math.max(1, ...chartSeries.map((item) => item.value));

  return (
    <AdminShell
      activeKey="dashboard"
      title={t("admin.navDashboard")}
      onRefresh={loadDashboard}
      loading={loading}
    >
      {/* ── 2 stat cards: Cultures (KC total) + Users ── */}
      <View className="mb-4 flex-row gap-2.5">
        <View className="min-w-0 flex-1 rounded-2xl border border-[#edf1f0] bg-white p-3">
          <View className={`mb-3 min-h-[42px] flex-row items-center gap-2.5 ${isRTL ? "flex-row-reverse" : ""}`}>
            <View className="h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-[#e9f7ef]">
              <MaterialCommunityIcons name="sprout" size={20} color={COLORS.greenDark} />
            </View>
            <Text className="flex-1 text-[11px] font-bold leading-[14px] text-slate-500" style={dynStyles.statLabel} numberOfLines={2}>
              {t("admin.cardCultures")}
            </Text>
          </View>
          <Text className="pl-0.5 text-xl font-bold text-slate-900" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            {formatNumber(stats?.totalCulturesAll ?? 0)}
          </Text>
          <View className="mt-1.5 gap-0.5">
            <View className="flex-row items-center gap-1">
              <View className="h-1.5 w-1.5 rounded-full bg-green-400" />
              <Text className="text-[10px] text-slate-500">
                {stats?.kcDataCount ?? 0} types FAO-56
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <View className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              <Text className="text-[10px] text-slate-500">
                {stats?.culturesByAdmin ?? 0} ajoutées par l'admin
              </Text>
            </View>
          </View>
        </View>

        <View className="min-w-0 flex-1 rounded-2xl border border-[#edf1f0] bg-white p-3">
          <View className={`mb-3 min-h-[42px] flex-row items-center gap-2.5 ${isRTL ? "flex-row-reverse" : ""}`}>
            <View className="h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-violet-100">
              <Ionicons name="people-outline" size={20} color="#7c3aed" />
            </View>
            <Text className="flex-1 text-[11px] font-bold leading-[14px] text-slate-500" style={dynStyles.statLabel} numberOfLines={2}>
              {t("admin.cardTotalUsers")}
            </Text>
          </View>
          <Text className="pl-0.5 text-xl font-bold text-slate-900">
            {formatNumber(totalUsers)}
          </Text>
        </View>
      </View>

      <View className="mb-4 rounded-2xl border border-[#edf1f0] bg-white p-4">
        <View className={`flex-row items-center justify-between mb-1 ${isRTL ? "flex-row-reverse" : ""}`}>
          <Text style={dynStyles.panelTitle}>{t("admin.recentIrrigations")}</Text>
          <View className="flex-row items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1">
            <Ionicons name="today-outline" size={13} color="#3b82f6" />
            <Text className="text-[12px] font-bold text-blue-600">{t("common.today")}</Text>
          </View>
        </View>
        <Text style={dynStyles.panelSubtitle}>
          {todayCount} {t("admin.irrigationsCount")}
        </Text>

        {todayCount === 0 ? (
          <View className="mt-3 h-[80px] items-center justify-center rounded-xl bg-slate-50">
            <Ionicons name="water-outline" size={28} color="#cbd5e1" />
            <Text className="mt-1.5 text-[13px] text-slate-400">
              {t("admin.noIrrigationsToday")}
            </Text>
          </View>
        ) : (
          <View className="mt-3 flex-row items-center gap-3">
            <View className="flex-1 rounded-xl bg-blue-50 p-3 items-center">
              <Text className="text-2xl font-bold text-blue-600">{todayCount}</Text>
              <Text className="text-[11px] text-blue-400 mt-0.5">{t("admin.irrigationsCount")}</Text>
            </View>
            <View className="flex-1 rounded-xl bg-green-50 p-3 items-center">
              <Text className="text-2xl font-bold text-green-600">
                {((stats?.totalVolume ?? 0) / 1000).toFixed(1)}
              </Text>
              <Text className="text-[11px] text-green-400 mt-0.5">m³ {t("common.today")}</Text>
            </View>
          </View>
        )}
      </View>

      <View className="mb-4 rounded-2xl border border-[#edf1f0] bg-white p-4">
        <View className={`flex-row items-start justify-between mb-3 ${isRTL ? "flex-row-reverse" : ""}`}>
          <View>
            <Text style={dynStyles.panelTitle}>{t("admin.chartVolumeTitle")}</Text>
            <Text style={dynStyles.panelSubtitle}>
              14 {t("admin.lastDays")} (L){selectedUser ? ` · ${selectedUser.firstName || ""} ${selectedUser.lastName || ""}`.trim() : ""}
            </Text>
          </View>
          {selectedUser && (
            <TouchableOpacity
              onPress={() => { setSelectedUser(null); loadDashboard(); }}
              className="flex-row items-center gap-1 rounded-full bg-slate-100 px-3 py-1"
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={13} color="#64748b" />
              <Text className="text-[11px] font-semibold text-slate-500">{t("admin.userTotal")}</Text>
            </TouchableOpacity>
          )}
        </View>
        {chartLoading && <View className="items-center py-3"><Text className="text-[12px] text-slate-400">...</Text></View>}

        {/* Valeur max mise en avant */}
        <View className={`flex-row items-center gap-2 mb-3 ${isRTL ? "flex-row-reverse" : ""}`}>
          <View className="rounded-lg bg-green-50 px-3 py-1.5 flex-row items-center gap-1.5">
            <Ionicons name="analytics-outline" size={14} color="#16a34a" />
            <Text className="text-[13px] font-bold text-green-700">
              {(stats?.totalVolume ?? 0).toLocaleString()} L
            </Text>
          </View>
          <Text className="text-[11px] text-slate-400">{t("admin.totalVolume")}</Text>
        </View>

        {/* Barres du graphique */}
        <View className="mt-1 flex-row items-end justify-between" style={{ height: 88 }}>
          {chartSeries.map((item, index) => {
            const height = 8 + (item.value / maxChartValue) * 72;
            const isToday = index === chartSeries.length - 1;
            return (
              <View key={`${item.label}-${index}`} className="flex-1 items-center justify-end">
                <View
                  className="w-2 rounded-t-[4px]"
                  style={{
                    height,
                    backgroundColor: isToday ? "#16a34a" : item.value > 0 ? "#86efac" : "#e5e7eb",
                  }}
                />
                <Text
                  className="mt-1 text-[9px]"
                  style={{ color: isToday ? "#16a34a" : "#94a3b8" }}
                >
                  {index % 3 === 0 || isToday ? item.label : ""}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Légende */}
        <View className="mt-2 flex-row items-center gap-3">
          <View className="flex-row items-center gap-1">
            <View className="h-2.5 w-2.5 rounded-full bg-green-500" />
            <Text className="text-[10px] text-slate-500">{t("common.today")}</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <View className="h-2.5 w-2.5 rounded-full bg-green-200" />
            <Text className="text-[10px] text-slate-500">{t("admin.lastDays")}</Text>
          </View>
        </View>
      </View>
      {/* ── User search section ── */}
      <View className="mb-4 rounded-2xl border border-[#edf1f0] bg-white p-4">
        <View className={`flex-row items-center justify-between mb-3 ${isRTL ? "flex-row-reverse" : ""}`}>
          <Text style={dynStyles.panelTitle}>{t("admin.cardTotalUsers")}</Text>
          <TouchableOpacity
            onPress={() => router.push("/(admin)/utilisateurs")}
            className="flex-row items-center gap-1 rounded-full bg-violet-50 px-3 py-1"
            activeOpacity={0.8}
          >
            <Text className="text-[12px] font-bold text-violet-600">{t("admin.userNew")}</Text>
            <Ionicons name="chevron-forward" size={12} color="#7c3aed" />
          </TouchableOpacity>
        </View>

        {/* Search input */}
        <View className="flex-row items-center gap-2 bg-slate-50 rounded-xl border border-[#edf1f0] px-3 py-2 mb-3">
          <Ionicons name="search" size={15} color="#94a3b8" />
          <TextInput
            placeholder={t("admin.userSearch")}
            placeholderTextColor="#94a3b8"
            value={userSearch}
            onChangeText={setUserSearch}
            style={{ flex: 1, fontSize: 13, color: "#111827" }}
          />
          {userSearch.length > 0 && (
            <TouchableOpacity onPress={() => setUserSearch("")} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name="close-circle" size={15} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* User list */}
        {filteredUsers.length === 0 ? (
          <View className="items-center py-6">
            <Ionicons name="people-outline" size={36} color="#e2e8f0" />
            <Text className="text-[13px] text-slate-400 mt-2">{t("admin.userNone")}</Text>
          </View>
        ) : (
          filteredUsers.slice(0, 8).map((u, i) => {
            const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim();
            const isActive = u.isActive !== false;
            const initials = ((u.firstName?.[0] || "") + (u.lastName?.[0] || "")).toUpperCase() || "?";
            return (
              <TouchableOpacity
                key={u._id || u.id || i}
                className="flex-row items-center gap-3 py-2.5 border-b border-[#f1f5f9]"
                onPress={() => setSelectedUser(selectedUser?._id === u._id ? null : u)}
                activeOpacity={0.7}
                style={selectedUser?._id === u._id ? { backgroundColor: "#f0fdf4", borderRadius: 10, paddingHorizontal: 6 } : {}}
              >
                <View className="w-9 h-9 rounded-xl bg-[#e8f8ed] items-center justify-center shrink-0">
                  <Text className="text-[13px] font-bold text-green-700">{initials}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[13px] font-bold text-slate-800" numberOfLines={1}>{fullName || "—"}</Text>
                  <Text className="text-[11px] text-slate-400" numberOfLines={1}>{u.email}</Text>
                </View>
                <View style={{ backgroundColor: isActive ? "#e8f8ed" : "#fee2e2", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: isActive ? "#16a34a" : "#ef4444" }}>
                    {isActive ? t("admin.userActive_label") : t("admin.userInactive_label")}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
        {filteredUsers.length > 8 && (
          <TouchableOpacity
            className="mt-2 items-center py-2"
            onPress={() => router.push("/(admin)/utilisateurs")}
            activeOpacity={0.7}
          >
            <Text className="text-[12px] font-semibold text-violet-600">
              +{filteredUsers.length - 8} {t("admin.userCount")}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </AdminShell>
  );
}