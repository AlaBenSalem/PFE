import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { AdminShell } from "@components/AdminShell";
import { API_ENDPOINTS, apiFetch } from "@api/client";
import { useLanguage } from "@context/LanguageContext";

const COLORS = {
  green: "#22c55e",
  greenDark: "#16a34a",
  blue: "#3b82f6",
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  surface: "#ffffff",
  chip: "#f1f5f9",
  danger: "#ef4444",
  bg: "#F4F6F8",
};

const LOCALE_MAP = {
  fr: "fr-FR",
  en: "en-GB",
  ar: "ar-TN",
  tr: "tr-TR",
};

function formatDateTime(value, language) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const locale = LOCALE_MAP[language] || "fr-FR";
  try {
    return date.toLocaleString(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return date.toString();
  }
}

export default function AdminMessages() {
  const { t, language, isRTL } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [items, setItems] = useState([]);

  const [selected, setSelected] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const loadMessages = async ({ showSpinner } = { showSpinner: true }) => {
    if (showSpinner) setLoading(true);
    try {
      const url = API_ENDPOINTS.admin.messagesList({
        limit: 50,
        skip: 0,
        unreadOnly,
      });
      const res = await apiFetch(url);
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.success) {
        setItems(json.data || []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMessages({ showSpinner: true });
  }, [unreadOnly]);

  const sendReply = async () => {
    if (!replyText.trim() || !selected) return;
    setSendingReply(true);
    try {
      const res = await apiFetch(API_ENDPOINTS.admin.messageReply(selected._id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyBody: replyText.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.success) {
        const now = new Date().toISOString();
        setSelected((prev) => prev ? { ...prev, repliedAt: now, replyBody: replyText.trim() } : prev);
        setItems((prev) =>
          prev.map((item) =>
            item._id === selected._id ? { ...item, repliedAt: now } : item,
          ),
        );
        setReplyText("");
        Alert.alert(t("common.success"), t("admin.replySuccess"));
      } else {
        Alert.alert(t("common.error"), json?.message || t("admin.replyError"));
      }
    } catch {
      Alert.alert(t("common.error"), t("admin.replyError"));
    } finally {
      setSendingReply(false);
    }
  };

  const openMessage = async (message) => {
    setSelected(message);
    setReplyText("");
    setDetailVisible(true);

    if (message?.readAt) return;

    setMarkingRead(true);
    try {
      const res = await apiFetch(
        API_ENDPOINTS.admin.messageMarkRead(message._id),
        {
          method: "PATCH",
        },
      );
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.success) {
        setItems((prev) =>
          prev.map((item) =>
            item._id === message._id
              ? {
                  ...item,
                  readAt: json?.data?.readAt || new Date().toISOString(),
                }
              : item,
          ),
        );
        setSelected((prev) =>
          prev && prev._id === message._id
            ? {
                ...prev,
                readAt: json?.data?.readAt || new Date().toISOString(),
              }
            : prev,
        );
      }
    } catch {
      // no-op
    } finally {
      setMarkingRead(false);
    }
  };

  const headerSubtitle = useMemo(() => {
    if (unreadOnly) return t("admin.messagesUnreadSubtitle");
    return t("admin.messagesAllSubtitle");
  }, [t, unreadOnly]);

  return (
    <AdminShell
      activeKey="messages"
      title={t("admin.messagesTitle")}
      subtitle={headerSubtitle}
      loading={loading}
      onRefresh={() => {
        setRefreshing(true);
        loadMessages({ showSpinner: false });
      }}
    >
      {/* Segment Tabs */}
      <View className="flex-row gap-2.5 px-4 pt-0.5 pb-3.5">
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setUnreadOnly(false)}
          className={`flex-1 h-[42px] rounded-xl border items-center justify-center flex-row gap-2 ${
            !unreadOnly
              ? "bg-green-600 border-green-600"
              : "bg-white border-gray-200"
          } ${isRTL ? "flex-row-reverse" : ""}`}
        >
          <Ionicons
            name="mail-open-outline"
            size={16}
            color={!unreadOnly ? "#fff" : COLORS.muted}
          />
          <Text
            className={`font-extrabold text-xs ${!unreadOnly ? "text-white" : "text-gray-500"}`}
          >
            {t("admin.messagesAll")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setUnreadOnly(true)}
          className={`flex-1 h-[42px] rounded-xl border items-center justify-center flex-row gap-2 ${
            unreadOnly
              ? "bg-green-600 border-green-600"
              : "bg-white border-gray-200"
          } ${isRTL ? "flex-row-reverse" : ""}`}
        >
          <MaterialCommunityIcons
            name="email-alert-outline"
            size={16}
            color={unreadOnly ? "#fff" : COLORS.muted}
          />
          <Text
            className={`font-extrabold text-xs ${unreadOnly ? "text-white" : "text-gray-500"}`}
          >
            {t("admin.messagesUnread")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Refreshing Indicator */}
      {refreshing ? (
        <View className="px-4 pb-2 flex-row items-center gap-2.5">
          <ActivityIndicator size="small" color={COLORS.muted} />
          <Text className="text-xs text-gray-500">{t("common.loading")}</Text>
        </View>
      ) : null}

      {/* Empty State */}
      {items.length === 0 && !loading ? (
        <View className="px-4 py-8 items-center gap-1.5">
          <MaterialCommunityIcons
            name="email-outline"
            size={38}
            color={COLORS.muted}
          />
          <Text
            className={`mt-1.5 font-extrabold text-base text-gray-900 ${isRTL ? "text-right" : "text-center"}`}
          >
            {t("admin.messagesEmptyTitle")}
          </Text>
          <Text
            className={`text-xs text-gray-500 leading-5 ${isRTL ? "text-right" : "text-center"}`}
          >
            {t("admin.messagesEmptySubtitle")}
          </Text>
        </View>
      ) : null}

      {/* Messages List */}
      {items.map((m) => {
        const unread   = !m.readAt;
        const replied  = !!m.repliedAt;
        return (
          <TouchableOpacity
            key={m._id}
            activeOpacity={0.9}
            onPress={() => openMessage(m)}
            className={`mx-4 mb-3 p-3.5 border rounded-2xl shadow-sm ${
              unread
                ? "border-green-200 bg-green-50"
                : "border-gray-100 bg-white"
            }`}
            style={{
              shadowColor: "#000",
              shadowOpacity: 0.05,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 6 },
              elevation: 2,
            }}
          >
            <View className="flex-row items-center justify-between gap-2.5">
              <View className="flex-1 min-w-0 flex-row items-center gap-2.5">
                <View
                  className={`w-2.5 h-2.5 rounded-full ${unread ? "bg-green-500" : "bg-gray-300"}`}
                />
                <Text
                  className="flex-1 min-w-0 font-extrabold text-gray-900 text-sm"
                  numberOfLines={1}
                >
                  {m.senderName || m.senderEmail || t("messages.unknownUser")}
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5 flex-shrink-0">
                {replied && (
                  <View className="bg-blue-100 rounded-full px-2 py-0.5">
                    <Text className="text-[10px] font-bold text-blue-600">
                      ↩ {t("admin.repliedBadge")}
                    </Text>
                  </View>
                )}
                <Text className="text-gray-500 text-[11px]" numberOfLines={1}>
                  {formatDateTime(m.createdAt, language)}
                </Text>
              </View>
            </View>

            {m.subject ? (
              <Text
                className="mt-2 font-extrabold text-gray-900 text-xs"
                numberOfLines={1}
              >
                {m.subject}
              </Text>
            ) : null}

            <Text
              className="mt-1.5 text-gray-500 text-xs leading-4"
              numberOfLines={2}
            >
              {m.body}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Message Detail Modal */}
      <Modal
        visible={detailVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailVisible(false)}
      >
        <Pressable
          className="absolute inset-0 bg-black/35"
          onPress={() => setDetailVisible(false)}
        />
        <View className="flex-1 justify-center p-[18px]">
          <View className="bg-white rounded-2xl border border-gray-100" style={{ maxHeight: "90%" }}>
            <ScrollView
              contentContainerStyle={{ padding: 16 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Header */}
              <View className="flex-row items-center justify-between mb-2.5">
                <Text className="text-base font-black text-gray-900">
                  {t("admin.messageDetails")}
                </Text>
                <TouchableOpacity
                  onPress={() => setDetailVisible(false)}
                  className="w-9 h-9 rounded-xl items-center justify-center bg-gray-100"
                  activeOpacity={0.85}
                >
                  <Ionicons name="close" size={20} color={COLORS.muted} />
                </TouchableOpacity>
              </View>

              {/* Meta */}
              <View className="flex-row items-center justify-between gap-2.5 py-1.5">
                <Text className="text-gray-500 text-xs font-bold flex-shrink-0">
                  {t("admin.messageFrom")}
                </Text>
                <Text
                  className="flex-1 min-w-0 text-gray-900 text-xs font-bold text-right"
                  numberOfLines={1}
                >
                  {selected?.senderName || t("messages.unknownUser")}
                </Text>
              </View>

              {selected?.senderEmail ? (
                <View className="flex-row items-center justify-between gap-2.5 py-1.5">
                  <Text className="text-gray-500 text-xs font-bold flex-shrink-0">
                    {t("admin.messageEmail")}
                  </Text>
                  <Text
                    className="flex-1 min-w-0 text-gray-900 text-xs font-bold text-right"
                    numberOfLines={1}
                  >
                    {selected.senderEmail}
                  </Text>
                </View>
              ) : null}

              <View className="flex-row items-center justify-between gap-2.5 py-1.5">
                <Text className="text-gray-500 text-xs font-bold flex-shrink-0">
                  {t("admin.messageWhen")}
                </Text>
                <Text
                  className="flex-1 min-w-0 text-gray-900 text-xs font-bold text-right"
                  numberOfLines={1}
                >
                  {formatDateTime(selected?.createdAt, language)}
                </Text>
              </View>

              {selected?.subject ? (
                <View className="mt-2 p-3 rounded-xl border border-gray-100 bg-gray-50">
                  <Text className="text-gray-500 text-xs font-extrabold mb-1">
                    {t("admin.messageSubject")}
                  </Text>
                  <Text className="text-gray-900 text-xs font-extrabold">
                    {selected.subject}
                  </Text>
                </View>
              ) : null}

              <View className="mt-2.5 p-3 rounded-xl border border-gray-100 bg-white">
                <Text className="text-gray-500 text-xs font-extrabold mb-1.5">
                  {t("admin.messageBody")}
                </Text>
                <Text className="text-gray-900 text-xs leading-5">
                  {selected?.body || ""}
                </Text>
              </View>

              {markingRead ? (
                <View className="mt-3 flex-row items-center gap-2.5">
                  <ActivityIndicator size="small" color={COLORS.muted} />
                  <Text className="text-gray-500 text-xs">
                    {t("admin.markingRead")}
                  </Text>
                </View>
              ) : null}

              {/* ── PREVIOUS REPLY ── */}
              {selected?.repliedAt ? (
                <View className="mt-3 p-3 rounded-xl border border-blue-200 bg-blue-50">
                  <View className="flex-row items-center gap-1.5 mb-1.5">
                    <Ionicons name="arrow-undo-outline" size={14} color={COLORS.blue} />
                    <Text className="text-blue-700 text-xs font-extrabold">
                      {t("admin.repliedBadge")} · {formatDateTime(selected.repliedAt, language)}
                    </Text>
                  </View>
                  <Text className="text-blue-900 text-xs leading-5">
                    {selected.replyBody || ""}
                  </Text>
                </View>
              ) : null}

              {/* ── REPLY BOX ── */}
              <View className="mt-4 pt-3 border-t border-gray-100">
                <View className="flex-row items-center gap-1.5 mb-2">
                  <Ionicons name="send-outline" size={14} color={COLORS.greenDark} />
                  <Text className="text-gray-800 text-xs font-extrabold">
                    {t("admin.replyLabel")}
                  </Text>
                </View>
                <TextInput
                  value={replyText}
                  onChangeText={setReplyText}
                  placeholder={t("admin.replyPlaceholder")}
                  placeholderTextColor="#94a3b8"
                  multiline
                  textAlignVertical="top"
                  maxLength={5000}
                  className="min-h-[90px] rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-900"
                />
                <TouchableOpacity
                  onPress={sendReply}
                  disabled={!replyText.trim() || sendingReply}
                  activeOpacity={0.85}
                  className="mt-2.5 h-11 rounded-xl bg-green-600 items-center justify-center flex-row gap-2"
                  style={{ opacity: !replyText.trim() || sendingReply ? 0.5 : 1 }}
                >
                  {sendingReply ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="send" size={15} color="#fff" />
                  )}
                  <Text className="text-white text-xs font-extrabold">
                    {sendingReply ? t("admin.replySending") : t("admin.replySend")}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </AdminShell>
  );
}
