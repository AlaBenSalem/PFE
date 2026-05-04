// frontend/components/AIChatScreen.jsx
// ✅ Full NativeWind (Tailwind) rewrite — no StyleSheet
// ✅ TTS: expo-speech natif (remplace ElevenLabs — gratuit, hors ligne, multilingue)
// ✅ Fix Bug 1: détection langue améliorée (arabe tunisien darija)

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Animated,
  Dimensions,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLanguage } from "@context/LanguageContext";

import { useAIVoice, detectSpeechLang, LANG_LABELS } from "../hooks/useAIVoice";
import { useAIChat } from "../hooks/useAIChat";

const { width: SCREEN_W } = Dimensions.get("window");
const SHEET_W        = Math.min(Math.round(SCREEN_W * 0.85), 420);
const FAB_SIZE       = 58;
const FAB_ORBIT_SIZE = 96;
const FAB_WRAP_SIZE  = FAB_ORBIT_SIZE;
const TAB_BAR_H      = 50;
const FAB_GAP_ABOVE_TAB = 0;

const RAW = {
  green:     "#22c55e",
  greenDark: "#16a34a",
  muted:     "#64748b",
  recording: "#ef4444",
};

// ══════════════════════════════════════════════════════════════════════════════
// FAB
// ══════════════════════════════════════════════════════════════════════════════
export default function AIChatFAB() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const slideAnim      = useRef(new Animated.Value(SHEET_W)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const panelScale     = useRef(new Animated.Value(0.94)).current;
  const floatAnim      = useRef(new Animated.Value(0)).current;
  const haloAnim       = useRef(new Animated.Value(0)).current;
  const haloAnimAlt    = useRef(new Animated.Value(0)).current;
  const orbitAnim      = useRef(new Animated.Value(0)).current;
  const pressScale     = useRef(new Animated.Value(1)).current;
  const iconLift       = useRef(new Animated.Value(0)).current;
  const tapRipple      = useRef(new Animated.Value(0)).current;
  const openTimerRef       = useRef(null);
  const isTransitioningRef = useRef(false);

  useEffect(() => {
    const floatingLoop = Animated.loop(Animated.sequence([
      Animated.timing(floatAnim, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(floatAnim, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    const haloLoop = Animated.loop(Animated.sequence([
      Animated.timing(haloAnim, { toValue: 1, duration: 1900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(haloAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    const haloLoopAlt = Animated.loop(Animated.sequence([
      Animated.delay(800),
      Animated.timing(haloAnimAlt, { toValue: 1, duration: 1900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(haloAnimAlt, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    const orbitLoop = Animated.loop(
      Animated.timing(orbitAnim, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true })
    );
    floatingLoop.start(); haloLoop.start(); haloLoopAlt.start(); orbitLoop.start();
    return () => {
      floatingLoop.stop(); haloLoop.stop(); haloLoopAlt.stop(); orbitLoop.stop();
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
    };
  }, [floatAnim, haloAnim, haloAnimAlt, orbitAnim]);

  const showSheet = useCallback(() => {
    openTimerRef.current = null;
    slideAnim.setValue(SHEET_W);
    overlayOpacity.setValue(0);
    panelScale.setValue(0.94);
    setOpen(true);
    Animated.parallel([
      Animated.spring(slideAnim,      { toValue: 0, useNativeDriver: true, tension: 74, friction: 11 }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(panelScale,     { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }),
    ]).start(() => { isTransitioningRef.current = false; });
  }, [overlayOpacity, panelScale, slideAnim]);

  const openSheet = useCallback(() => {
    if (open || isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    tapRipple.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.spring(pressScale, { toValue: 0.9,  useNativeDriver: true, tension: 210, friction: 11 }),
        Animated.spring(pressScale, { toValue: 1.06, useNativeDriver: true, tension: 180, friction: 8  }),
        Animated.spring(pressScale, { toValue: 1,    useNativeDriver: true, tension: 150, friction: 10 }),
      ]),
      Animated.sequence([
        Animated.spring(iconLift, { toValue: 1, useNativeDriver: true, tension: 190, friction: 10 }),
        Animated.spring(iconLift, { toValue: 0, useNativeDriver: true, tension: 170, friction: 11 }),
      ]),
      Animated.sequence([
        Animated.timing(tapRipple, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(tapRipple, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    ]).start();
    openTimerRef.current = setTimeout(showSheet, 140);
  }, [iconLift, open, pressScale, showSheet, tapRipple]);

  const closeSheet = useCallback(() => {
    if (openTimerRef.current) { clearTimeout(openTimerRef.current); openTimerRef.current = null; }
    Animated.parallel([
      Animated.timing(slideAnim,      { toValue: SHEET_W, duration: 240, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(panelScale,     { toValue: 0.96, duration: 200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]).start(() => { setOpen(false); isTransitioningRef.current = false; });
  }, [overlayOpacity, panelScale, slideAnim]);

  const isWeb            = Platform.OS === "web";
  const fabLift          = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const orbitRotate      = orbitAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const haloScale        = haloAnim.interpolate({ inputRange: [0, 1], outputRange: isWeb ? [0.9, 1.22] : [0.88, 1.45] });
  const haloOpacityValue = haloAnim.interpolate({ inputRange: [0, 1], outputRange: [0.36, 0] });
  const haloScaleAlt     = haloAnimAlt.interpolate({ inputRange: [0, 1], outputRange: isWeb ? [0.98, 1.28] : [0.96, 1.56] });
  const haloOpacityAlt   = haloAnimAlt.interpolate({ inputRange: [0, 1], outputRange: [0.24, 0] });
  const rippleScale      = tapRipple.interpolate({ inputRange: [0, 1], outputRange: isWeb ? [0.9, 1.25] : [0.8, 1.9] });
  const rippleOpacity    = tapRipple.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0.42, 0] });
  const iconTranslateY   = iconLift.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const iconRotate       = iconLift.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["0deg", "-8deg", "8deg"] });
  const badgeLift        = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const fabBottom    = (insets.bottom || 0) + TAB_BAR_H + FAB_GAP_ABOVE_TAB;
  const haloInset    = Math.round((FAB_WRAP_SIZE - (FAB_SIZE + 18)) / 2);
  const haloAltInset = Math.round((FAB_WRAP_SIZE - (FAB_SIZE + 30)) / 2);
  const rippleInset  = Math.round((FAB_WRAP_SIZE - (FAB_SIZE + 12)) / 2);
  const fabRight     = isWeb ? 18 : 14;

  return (
    <>
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute", right: fabRight, bottom: fabBottom,
          width: FAB_WRAP_SIZE, height: FAB_WRAP_SIZE,
          zIndex: 999, alignItems: "center", justifyContent: "center",
        }}
      >
        <Animated.View pointerEvents="none" style={{ position: "absolute", top: -10, right: 8, transform: [{ translateY: badgeLift }] }} />

        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute", width: FAB_ORBIT_SIZE, height: FAB_ORBIT_SIZE,
            alignItems: "center", justifyContent: "center",
            transform: [{ rotate: orbitRotate }],
          }}
        >
          <View style={{ position: "absolute", top: 2, width: 12, height: 12, borderRadius: 999, backgroundColor: "#fde68a", shadowColor: "#f59e0b", shadowOpacity: 0.38, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }} />
          <View style={{ position: "absolute", right: 4, bottom: 18, width: 8,  height: 8,  borderRadius: 999, backgroundColor: "#a7f3d0" }} />
          <View style={{ position: "absolute", left: 6,  bottom: 22, width: 9,  height: 9,  borderRadius: 999, backgroundColor: "#d9f99d" }} />
        </Animated.View>

        <Animated.View pointerEvents="none" style={{ position: "absolute", top: haloInset, left: haloInset, width: FAB_SIZE + 18, height: FAB_SIZE + 18, borderRadius: 999, borderWidth: 2, borderColor: "#6ee7b7", opacity: haloOpacityValue, transform: [{ scale: haloScale }] }} />
        <Animated.View pointerEvents="none" style={{ position: "absolute", top: haloAltInset, left: haloAltInset, width: FAB_SIZE + 30, height: FAB_SIZE + 30, borderRadius: 999, borderWidth: 1.5, borderColor: "#bbf7d0", opacity: haloOpacityAlt, transform: [{ scale: haloScaleAlt }] }} />
        <Animated.View pointerEvents="none" style={{ position: "absolute", top: rippleInset, left: rippleInset, width: FAB_SIZE + 12, height: FAB_SIZE + 12, borderRadius: 999, backgroundColor: "#34d399", opacity: rippleOpacity, transform: [{ scale: rippleScale }] }} />

        <Animated.View style={{ transform: [{ translateY: fabLift }, { scale: pressScale }] }}>
          <TouchableOpacity
            onPress={openSheet}
            activeOpacity={0.96}
            accessibilityRole="button"
            accessibilityLabel="Open SmartIrrig AI chat"
            style={{
              width: FAB_SIZE, height: FAB_SIZE, borderRadius: 26,
              backgroundColor: "#0f766e", alignItems: "center", justifyContent: "center",
              borderWidth: 1, borderColor: "rgba(255,255,255,0.35)",
              shadowColor: "#0f766e", shadowOpacity: 0.35, shadowRadius: 18,
              shadowOffset: { width: 0, height: 12 }, elevation: 14, overflow: "hidden",
            }}
          >
            <View pointerEvents="none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#059669", opacity: 0.98 }} />
            <View pointerEvents="none" style={{ position: "absolute", top: -10, left: 10, right: 10, height: 30, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.22)" }} />
            <View pointerEvents="none" style={{ position: "absolute", bottom: -16, right: -10, width: 48, height: 48, borderRadius: 18, backgroundColor: "rgba(5,150,105,0.82)", transform: [{ rotate: "18deg" }] }} />
            <Animated.View style={{ transform: [{ translateY: iconTranslateY }, { rotate: iconRotate }] }}>
              <MaterialCommunityIcons name="robot" color="#ffffff" size={27} />
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <Modal visible={open} transparent animationType="none" statusBarTranslucent onRequestClose={closeSheet}>
        <Animated.View
          pointerEvents="box-none"
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: overlayOpacity }}
        >
          <TouchableOpacity
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(2, 6, 23, 0.42)" }}
            activeOpacity={1}
            onPress={closeSheet}
          />
        </Animated.View>
        <Animated.View
          style={[
            {
              position: "absolute", top: 0, bottom: 0, right: 0, width: SHEET_W,
              backgroundColor: "#ffffff", borderTopLeftRadius: 20, borderBottomLeftRadius: 20,
              shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 20,
              shadowOffset: { width: -6, height: 0 }, elevation: 20, overflow: "hidden",
            },
            { transform: [{ translateX: slideAnim }, { scale: panelScale }] },
          ]}
        >
          <AIChatSheet onClose={closeSheet} />
        </Animated.View>
      </Modal>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CHAT SHEET
// ══════════════════════════════════════════════════════════════════════════════
function AIChatSheet({ onClose }) {
  const { language, isRTL } = useLanguage();
  const insets = useSafeAreaInsets();

  const [input, setInput] = useState("");
  const flatListRef = useRef(null);

  // ── Voice hook ─────────────────────────────────────────────────────────────
  const voice = useAIVoice({
    onTranscriptReady:   (text) => { setInput(""); chat.sendMessage(text); },
    onInterimTranscript: (text) => setInput(text),
  });

  // ── Chat hook ──────────────────────────────────────────────────────────────
  const chat = useAIChat({
    speakText:        voice.speakText,
    setIsSpeaking:    voice.setIsSpeaking,
    detectSpeechLang: detectSpeechLang,
    setTtsLang:       voice.setTtsLang,
    flatListRef,
  });

  // ── i18n shorthand ─────────────────────────────────────────────────────────
  const t = chat.t;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const formatDuration = voice.formatDuration;

  const getPlaceholder = () => {
    if (voice.isListening)
      return `🎤 ${formatDuration(voice.recordDuration)}  ${t({ ar: "تحدث... (أفلت للإرسال)", en: "Speak... (release to send)", tr: "Konuşun... (göndermek için bırakın)", fr: "Parlez... (relâchez pour envoyer)" })}`;
    return t({ ar: "اكتب سؤالك...", en: "Ask a question...", tr: "Sorunuzu yazın...", fr: "Posez votre question..." });
  };

  // ── Render helpers ─────────────────────────────────────────────────────────
  const renderItem = ({ item }) => {
    const isUser = item.role === "user";
    return (
      <View className={`flex-row items-end gap-1.5 mb-1 ${isUser ? "justify-end" : "justify-start"}`}>
        {!isUser && (
          <View className="w-7 h-7 rounded-full bg-green-50 border border-slate-200 items-center justify-center shrink-0">
            <Text className="text-[13px]">🌿</Text>
          </View>
        )}
        <View className="max-w-[85%]">
          <View className={`rounded-2xl px-3 py-2 ${isUser ? "bg-green-700 rounded-br-sm" : "bg-slate-100 border border-slate-200 rounded-bl-sm"}`}>
            <Text
              className={`text-[13px] leading-5 ${isUser ? "text-white" : "text-slate-900"}`}
              style={isRTL ? { textAlign: "right", writingDirection: "rtl" } : undefined}
            >
              {item.text}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const LoadingFooter = chat.loading ? (
    <View className="flex-row items-center gap-1.5 mt-0.5">
      <View className="w-7 h-7 rounded-full bg-green-50 border border-slate-200 items-center justify-center">
        <Text className="text-[13px]">🌿</Text>
      </View>
      <View className="flex-row items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-2xl rounded-bl-sm px-3 py-2">
        <ActivityIndicator size="small" color={RAW.green} />
        <Text className="text-xs text-slate-400 italic">{chat.getLoadingText()}</Text>
      </View>
    </View>
  ) : null;

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top || 12, paddingBottom: insets.bottom || 10 }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-3.5 py-3 border-b border-slate-200 bg-white">
        <View className="flex-row gap-1.5">
          <TouchableOpacity
            onPress={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 items-center justify-center"
          >
            <Ionicons name="chevron-forward" size={20} color={RAW.muted} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { voice.setTtsEnabled((p) => !p); if (voice.isSpeaking) voice.stopSpeaking(); }}
            className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 items-center justify-center"
          >
            <Ionicons
              name={voice.ttsEnabled ? "volume-high-outline" : "volume-mute-outline"}
              size={18}
              color={voice.ttsEnabled ? RAW.green : RAW.muted}
            />
          </TouchableOpacity>
          {voice.isSpeaking && (
            <TouchableOpacity
              onPress={voice.stopSpeaking}
              className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 items-center justify-center"
            >
              <Ionicons name="stop-circle-outline" size={20} color={RAW.green} />
            </TouchableOpacity>
          )}
        </View>
        <View className="flex-row items-center gap-2.5">
          <View className="items-end">
            <Text className="text-sm font-extrabold text-slate-900">SmartIrrig AI</Text>
            <Text className="text-[10px] text-green-500 mt-0.5">
              {voice.isSpeaking
                ? `🔊 ${LANG_LABELS[voice.ttsLang]}`
                : voice.isListening
                  ? `🎤 ${formatDuration(voice.recordDuration)}  ${t({ ar: "يستمع...", en: "Listening...", tr: "Dinliyor...", fr: "Écoute..." })}`
                  : `Powered by Groq • ${t({ ar: "5 لغات", en: "5 languages", tr: "5 dil", fr: "5 langues" })}`}
            </Text>
          </View>
          <View className="w-9 h-9 rounded-full bg-green-50 border border-slate-200 items-center justify-center">
            <Text className="text-base">🌿</Text>
          </View>
        </View>
      </View>

      {/* Connecting banner */}
      {chat.serverStatus === "connecting" && (
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff7ed", borderBottomWidth: 1, borderBottomColor: "#fed7aa" }}>
          <ActivityIndicator size="small" color="#f97316" />
          <Text style={{ marginLeft: 8, flex: 1, fontSize: 12, color: "#9a3412" }}>
            {t({ fr: "Connexion au serveur...", en: "Connecting to server...", ar: "جاري الاتصال بالخادم...", tr: "Sunucuya bağlanılıyor..." })}
          </Text>
          <TouchableOpacity onPress={chat.stopConnecting} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ fontSize: 12, color: "#dc2626", fontWeight: "bold" }}>Stop</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Messages + input */}
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={10}
      >
        <FlatList
          ref={flatListRef}
          className="flex-1"
          contentContainerStyle={{ padding: 12, paddingBottom: 4, gap: 6 }}
          data={chat.messages}
          keyExtractor={(item) => item.id}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={LoadingFooter}
        />

        {voice.isListening && (
          <View className="flex-row items-center gap-2 px-3.5 py-1.5 bg-red-50 border-t border-red-200">
            <View className="w-2 h-2 rounded-full bg-red-500" />
            <Text className="flex-1 text-[11px] text-red-500 font-semibold">
              {formatDuration(voice.recordDuration)} • {t({ ar: "اضغط مرة أخرى للإرسال", en: "Tap again to send", tr: "Göndermek için tekrar basın", fr: "Appuyez à nouveau pour envoyer" })}
            </Text>
            <TouchableOpacity
              onPress={voice.cancelRecording}
              className="w-6.5 h-6.5 rounded-full bg-red-100 items-center justify-center"
            >
              <Ionicons name="close" size={16} color={RAW.recording} />
            </TouchableOpacity>
          </View>
        )}

        <View className="flex-row items-center gap-1.5 px-3 py-2.5 bg-white border-t border-slate-200">
          <TouchableOpacity
            onPress={() => voice.onMicToggle(chat.loading)}
            activeOpacity={0.85}
            disabled={chat.loading || !voice.speechRecognitionAvailable}
            className={`w-[38px] h-[38px] rounded-full border items-center justify-center shrink-0 ${voice.isListening ? "bg-red-500 border-red-500" : "bg-slate-100 border-slate-200"}`}
          >
            <Ionicons
              name={voice.speechRecognitionAvailable ? (voice.isListening ? "mic" : "mic-outline") : "mic-off-outline"}
              size={19}
              color={voice.isListening ? "#fff" : RAW.muted}
            />
          </TouchableOpacity>

          <TextInput
            className={`flex-1 border rounded-[20px] px-3.5 py-2 text-[13px] max-h-[90px] ${voice.isListening ? "border-red-300 bg-red-50 text-red-500" : "border-slate-200 bg-slate-100 text-slate-900"}`}
            placeholder={getPlaceholder()}
            placeholderTextColor={voice.isListening ? RAW.recording : RAW.muted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => { if (input.trim() && !voice.isListening) chat.sendMessage(input); }}
            submitBehavior="blurAndSubmit"
            returnKeyType="send"
            maxLength={500}
            editable={!voice.isListening}
            style={isRTL ? { textAlign: "right" } : undefined}
          />

          <TouchableOpacity
            onPress={() => { chat.sendMessage(input); setInput(""); }}
            disabled={chat.loading || !input.trim() || voice.isListening}
            activeOpacity={0.85}
            className={`w-[38px] h-[38px] rounded-full border items-center justify-center shrink-0 ${input.trim() && !chat.loading && !voice.isListening ? "bg-green-700 border-green-700" : "bg-slate-100 border-slate-200"}`}
          >
            <Ionicons
              name="send"
              size={17}
              color={input.trim() && !chat.loading && !voice.isListening ? "#fff" : RAW.muted}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
