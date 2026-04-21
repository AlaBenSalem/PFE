// frontend/components/AIChatScreen.jsx
// ✅ Full NativeWind (Tailwind) rewrite — no StyleSheet

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
import * as Speech from "expo-speech";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch, API_ENDPOINTS } from "@api/client";
import { useLanguage } from "@context/LanguageContext";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

// ── Optional speech recognition ───────────────────────────────────────────────
let ExpoSpeechRecognitionModule = null;
let useSpeechRecognitionEvent = () => { };

try {
  const speechRecognition = require("expo-speech-recognition");
  ExpoSpeechRecognitionModule =
    speechRecognition.ExpoSpeechRecognitionModule ?? null;
  useSpeechRecognitionEvent =
    speechRecognition.useSpeechRecognitionEvent ?? (() => { });
} catch (error) {
  console.warn(
    "[AIChat] Voice recognition unavailable:",
    error?.message ?? error,
  );
}

const { width: SCREEN_W } = Dimensions.get("window");
const SHEET_W = Math.min(Math.round(SCREEN_W * 0.85), 420);
const FAB_SIZE = 58;
const FAB_ORBIT_SIZE = 96;
const FAB_WRAP_SIZE = FAB_ORBIT_SIZE;
const TAB_BAR_H = 50;
const FAB_GAP_ABOVE_TAB = 0;

const RAW = {
  green: "#22c55e",
  greenDark: "#16a34a",
  muted: "#64748b",
  recording: "#ef4444",
};

const INITIAL_MESSAGES = {
  fr: "🌿 Bonjour! Comment puis-je vous aider?",
  en: "🌿 Hello! How can I help you?",
  ar: "🌿 أهلاً! كيف يمكنني مساعدتك؟",
  tr: "🌿 Merhaba! Size nasıl yardımcı olabilirim?",
};

// ══════════════════════════════════════════════════════════════════════════════
// ELEVENLABS TTS
// ══════════════════════════════════════════════════════════════════════════════
const ELEVENLABS_VOICE_ID = "cgSgspJ2msm6clMCkdW9";
const ELEVENLABS_API_KEY  = "sk_fd88b305d46cb875bc5570685561f801fd04e343eb2ad874";

async function elevenLabsSpeak(text, { onDone, onError } = {}) {
  try {
    if (Platform.OS === "web") {
      try {
        const res = await apiFetch(API_ENDPOINTS.ai?.tts || "/ai/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) { console.warn("⚠️ [TTS proxy] HTTP", res.status); onError?.(); return null; }
        const blob  = await res.blob();
        const url   = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => { URL.revokeObjectURL(url); onDone?.(); };
        audio.onerror = (e) => { console.warn("⚠️ [TTS web] onerror", e); URL.revokeObjectURL(url); onError?.(); };
        const p = audio.play();
        if (p !== undefined) {
          p.catch((e) => { console.warn("⚠️ [TTS web] play() bloqué:", e.message); URL.revokeObjectURL(url); onError?.(); });
        }
        return audio;
      } catch (webErr) {
        console.warn("⚠️ [TTS web] proxy error:", webErr.message);
        onError?.(); return null;
      }
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        method: "POST",
        headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
        }),
      },
    );

    if (!res.ok) { console.error("❌ [ElevenLabs mobile] HTTP", res.status); onError?.(); return null; }

    const { Audio }   = require("expo-av");
    const FileSystem  = require("expo-file-system");
    const arrayBuffer = await res.arrayBuffer();
    const bytes       = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    const uri = FileSystem.cacheDirectory + "tts_elevenlabs.mp3";
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });

    const { sound } = await Audio.Sound.createAsync({ uri });
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) { sound.unloadAsync(); onDone?.(); }
      if (status.error)         { sound.unloadAsync(); onError?.(); }
    });
    await sound.playAsync();
    return sound;

  } catch (err) {
    console.error("❌ [ElevenLabs]", err.message);
    onError?.(); return null;
  }
}

// ── Strip markdown for TTS ────────────────────────────────────────────────────
function stripMarkdown(text = "") {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1")
    .replace(/_{1,2}(.+?)_{1,2}/g, "$1").replace(/#{1,6}\s+/g, "")
    .replace(/`{1,3}[^`]*`{1,3}/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[-*•]\s+/gm, "").replace(/^\d+\.\s+/gm, "")
    .replace(/>{1,}\s*/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

const AR_NUMBERS = {
  0:"صفر",1:"واحد",2:"اثنان",3:"ثلاثة",4:"أربعة",5:"خمسة",6:"ستة",
  7:"سبعة",8:"ثمانية",9:"تسعة",10:"عشرة",11:"أحد عشر",12:"اثنا عشر",
  13:"ثلاثة عشر",14:"أربعة عشر",15:"خمسة عشر",16:"ستة عشر",17:"سبعة عشر",
  18:"ثمانية عشر",19:"تسعة عشر",20:"عشرون",30:"ثلاثون",40:"أربعون",
  50:"خمسون",60:"ستون",70:"سبعون",80:"ثمانون",90:"تسعون",
  100:"مئة",200:"مئتان",1000:"ألف",
};

function numToArabic(n) {
  const num = parseInt(n, 10);
  if (isNaN(num)) return n;
  if (AR_NUMBERS[num] !== undefined) return AR_NUMBERS[num];
  if (num < 100) {
    const tens = Math.floor(num / 10) * 10, ones = num % 10;
    return `${AR_NUMBERS[ones]} و${AR_NUMBERS[tens]}`;
  }
  return n;
}

function prepareArabicTTS(text = "") {
  return text.replace(/[\u064B-\u065F\u0670]/g, "").replace(/\b(\d+)\b/g, (_, n) => numToArabic(n));
}

function detectSpeechLang(text = "") {
  const s = text.slice(0, 300);
  const tunisianWords = /\b(chneya|kifesh|barsha|bhi|mrigel|ya3tik|3andek|lazem|bech|taw|famma|hnaya|sahit|yezzi|mouch|wala|kifek|labas|nheb|ma3lich|haka|chahed|kol|inti|ena|yelzem|tnajem|talbek|t9olha|9oulha|shniya|9addesh|ween|mta3|elli|fih|3lih|manha|ghadi|rahi|brabi|yaani|chkoun|chbik|mch|nrou7|nlawej)\b/gi;
  const tunisianScore = (s.match(tunisianWords) || []).length * 5;
  const arabicChars   = (s.match(/[\u0600-\u06FF]/g) || []).length;
  const scores = {
    "ar-TN": tunisianScore + arabicChars,
    "ar-SA": arabicChars * 4,
    "tr-TR": (s.match(/[şğüöçıİŞĞÜÖÇ]/g) || []).length * 4,
    "fr-FR": (s.match(/[àâæçéèêëîïôœùûüÿ]/gi) || []).length * 2 +
      (s.match(/\b(le|la|les|de|du|des|pour|avec|dans|que|qui|vous|votre|je|nous|est|une|bonjour|merci|température|irrigation)\b/gi) || []).length * 1.5,
    "en-US": (s.match(/\b(the|is|are|and|for|with|your|you|this|have|will|from|they|weather|irrigation|crop|hello|thank)\b/gi) || []).length,
  };
  if (tunisianScore > 0 && scores["ar-TN"] > scores["ar-SA"]) return "ar-TN";
  const winner = Object.entries(scores).filter(([k]) => k !== "ar-TN").reduce((a, b) => (b[1] > a[1] ? b : a));
  return winner[1] >= 2 ? winner[0] : "fr-FR";
}

function getTTSLang(lang) { return lang === "ar-TN" ? "ar-SA" : lang; }

const LANG_LABELS = { "ar-TN":"تونسي 🇹🇳","ar-SA":"العربية","tr-TR":"Türkçe","fr-FR":"Français","en-US":"English" };

// ── Web TTS fallback ──────────────────────────────────────────────────────────
let _webVoicesCache = null;
function loadWebVoices() {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) { resolve([]); return; }
    const v = window.speechSynthesis.getVoices();
    if (v.length > 0) { _webVoicesCache = v; resolve(v); return; }
    window.speechSynthesis.onvoiceschanged = () => { _webVoicesCache = window.speechSynthesis.getVoices(); resolve(_webVoicesCache); };
    setTimeout(() => resolve(window.speechSynthesis.getVoices() || []), 2000);
  });
}
async function webSpeak(text, langCode, { rate = 0.92, pitch = 1.0, onDone, onError } = {}) {
  if (typeof window === "undefined" || !window.speechSynthesis) { onError?.(); return; }
  window.speechSynthesis.cancel();
  const voices    = await loadWebVoices();
  const utterance = new window.SpeechSynthesisUtterance(text);
  const matched   = voices.find((v) => v.lang === langCode) || voices.find((v) => v.lang?.startsWith(langCode.split("-")[0]));
  if (matched) utterance.voice = matched;
  utterance.lang = langCode; utterance.rate = rate; utterance.pitch = pitch;
  const keepAlive = setInterval(() => {
    if (window.speechSynthesis.speaking) { window.speechSynthesis.pause(); window.speechSynthesis.resume(); }
    else clearInterval(keepAlive);
  }, 10000);
  utterance.onend   = () => { clearInterval(keepAlive); onDone?.(); };
  utterance.onerror = (e) => { clearInterval(keepAlive); console.error("[WebTTS]", e.error); onError?.(); };
  window.speechSynthesis.speak(utterance);
}
function stopWebSpeech() {
  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
}

async function getVoiceForLanguage(language) {
  if (Platform.OS !== "android") return undefined;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const v = voices.find((v) => v.language === language && (v.quality === "Enhanced" || v.name?.includes("Google")));
    return v?.identifier;
  } catch { return undefined; }
}

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
    const orbitLoop = Animated.loop(Animated.timing(orbitAnim, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true }));
    floatingLoop.start(); haloLoop.start(); haloLoopAlt.start(); orbitLoop.start();
    return () => {
      floatingLoop.stop(); haloLoop.stop(); haloLoopAlt.stop(); orbitLoop.stop();
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
    };
  }, [floatAnim, haloAnim, haloAnimAlt, orbitAnim]);

  const showSheet = useCallback(() => {
    openTimerRef.current = null;
    slideAnim.setValue(SHEET_W); overlayOpacity.setValue(0); panelScale.setValue(0.94);
    setOpen(true);
    Animated.parallel([
      Animated.spring(slideAnim,      { toValue: 0, useNativeDriver: true, tension: 74, friction: 11 }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(panelScale,     { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }),
    ]).start(() => { isTransitioningRef.current = false; });
  }, [overlayOpacity, panelScale, slideAnim]);

  const openSheet = useCallback(() => {
    if (open || isTransitioningRef.current) return;
    isTransitioningRef.current = true; tapRipple.setValue(0);
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

  const isWeb           = Platform.OS === "web";
  const fabLift         = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const orbitRotate     = orbitAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const haloScale       = haloAnim.interpolate({ inputRange: [0, 1], outputRange: isWeb ? [0.9, 1.22] : [0.88, 1.45] });
  const haloOpacityValue= haloAnim.interpolate({ inputRange: [0, 1], outputRange: [0.36, 0] });
  const haloScaleAlt    = haloAnimAlt.interpolate({ inputRange: [0, 1], outputRange: isWeb ? [0.98, 1.28] : [0.96, 1.56] });
  const haloOpacityAlt  = haloAnimAlt.interpolate({ inputRange: [0, 1], outputRange: [0.24, 0] });
  const rippleScale     = tapRipple.interpolate({ inputRange: [0, 1], outputRange: isWeb ? [0.9, 1.25] : [0.8, 1.9] });
  const rippleOpacity   = tapRipple.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0.42, 0] });
  const iconTranslateY  = iconLift.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const iconRotate      = iconLift.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["0deg", "-8deg", "8deg"] });
  const badgeLift       = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const fabBottom   = (insets.bottom || 0) + TAB_BAR_H + FAB_GAP_ABOVE_TAB;
  const haloInset   = Math.round((FAB_WRAP_SIZE - (FAB_SIZE + 18)) / 2);
  const haloAltInset= Math.round((FAB_WRAP_SIZE - (FAB_SIZE + 30)) / 2);
  const rippleInset = Math.round((FAB_WRAP_SIZE - (FAB_SIZE + 12)) / 2);
  const fabRight    = isWeb ? 18 : 14;

  return (
    <>
      <View pointerEvents="box-none" style={{ position: "absolute", right: fabRight, bottom: fabBottom, width: FAB_WRAP_SIZE, height: FAB_WRAP_SIZE, zIndex: 999, alignItems: "center", justifyContent: "center" }}>
        <Animated.View pointerEvents="none" style={{ position: "absolute", top: -10, right: 8, transform: [{ translateY: badgeLift }] }} />
        <Animated.View pointerEvents="none" style={{ position: "absolute", width: FAB_ORBIT_SIZE, height: FAB_ORBIT_SIZE, alignItems: "center", justifyContent: "center", transform: [{ rotate: orbitRotate }] }}>
          <View style={{ position: "absolute", top: 2, width: 12, height: 12, borderRadius: 999, backgroundColor: "#fde68a", shadowColor: "#f59e0b", shadowOpacity: 0.38, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }} />
          <View style={{ position: "absolute", right: 4, bottom: 18, width: 8, height: 8, borderRadius: 999, backgroundColor: "#a7f3d0" }} />
          <View style={{ position: "absolute", left: 6, bottom: 22, width: 9, height: 9, borderRadius: 999, backgroundColor: "#d9f99d" }} />
        </Animated.View>
        <Animated.View pointerEvents="none" style={{ position: "absolute", top: haloInset, left: haloInset, width: FAB_SIZE + 18, height: FAB_SIZE + 18, borderRadius: 999, borderWidth: 2, borderColor: "#6ee7b7", opacity: haloOpacityValue, transform: [{ scale: haloScale }] }} />
        <Animated.View pointerEvents="none" style={{ position: "absolute", top: haloAltInset, left: haloAltInset, width: FAB_SIZE + 30, height: FAB_SIZE + 30, borderRadius: 999, borderWidth: 1.5, borderColor: "#bbf7d0", opacity: haloOpacityAlt, transform: [{ scale: haloScaleAlt }] }} />
        <Animated.View pointerEvents="none" style={{ position: "absolute", top: rippleInset, left: rippleInset, width: FAB_SIZE + 12, height: FAB_SIZE + 12, borderRadius: 999, backgroundColor: "#34d399", opacity: rippleOpacity, transform: [{ scale: rippleScale }] }} />
        <Animated.View style={{ transform: [{ translateY: fabLift }, { scale: pressScale }] }}>
          <TouchableOpacity onPress={openSheet} activeOpacity={0.96} accessibilityRole="button" accessibilityLabel="Open SmartIrrig AI chat"
            style={{ width: FAB_SIZE, height: FAB_SIZE, borderRadius: 26, backgroundColor: "#0f766e", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", shadowColor: "#0f766e", shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 12 }, elevation: 14, overflow: "hidden" }}>
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
        <Animated.View pointerEvents="box-none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: overlayOpacity }}>
          <TouchableOpacity style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(2, 6, 23, 0.42)" }} activeOpacity={1} onPress={closeSheet} />
        </Animated.View>
        <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, right: 0, width: SHEET_W, backgroundColor: "#ffffff", borderTopLeftRadius: 20, borderBottomLeftRadius: 20, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: -6, height: 0 }, elevation: 20, overflow: "hidden" }, { transform: [{ translateX: slideAnim }, { scale: panelScale }] }]}>
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

  const [messages,            setMessages]            = useState([{ id: "0", role: "assistant", text: INITIAL_MESSAGES[language] || INITIAL_MESSAGES.fr }]);
  const [input,               setInput]               = useState("");
  const [loading,             setLoading]             = useState(false);
  const [isListening,         setIsListening]         = useState(false);
  const [conversationId,      setConversationId]      = useState("");
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isSpeaking,          setIsSpeaking]          = useState(false);
  const [ttsLang,             setTtsLang]             = useState("fr-FR");
  const [ttsEnabled,          setTtsEnabled]          = useState(true);
  const [nativeVoices,        setNativeVoices]        = useState({});
  const [recordDuration,      setRecordDuration]      = useState(0);

  const elevenLabsAudioRef   = useRef(null);
  const flatListRef          = useRef(null);
  const pendingTranscriptRef = useRef("");
  const recordTimerRef       = useRef(null);

  const speechInputLangs = (() => {
    const primary = { fr: "fr-FR", en: "en-US", ar: "ar-SA", tr: "tr-TR" }[language] || "ar-SA";
    const all = ["ar-SA", "fr-FR", "en-US", "tr-TR"];
    return [primary, ...all.filter((l) => l !== primary)];
  })();

  const speechRecognitionAvailable = !!(
    ExpoSpeechRecognitionModule?.start &&
    ExpoSpeechRecognitionModule?.stop &&
    ExpoSpeechRecognitionModule?.abort
  );

  useEffect(() => {
    if (Platform.OS === "web")     loadWebVoices();
    if (Platform.OS === "android") loadNativeVoices();
  }, []);

  useEffect(() => {
    setMessages([{ id: "0", role: "assistant", text: INITIAL_MESSAGES[language] || INITIAL_MESSAGES.fr }]);
    setConversationHistory([]);
  }, [language]);

  const loadNativeVoices = async () => {
    const voicesMap = {};
    for (const lang of ["ar-SA", "tr-TR", "fr-FR", "en-US"]) {
      const id = await getVoiceForLanguage(lang);
      if (id) voicesMap[lang] = id;
    }
    setNativeVoices(voicesMap);
  };

  // ── Stop all TTS ───────────────────────────────────────────────────────────
  const stopSpeaking = useCallback(async () => {
    if (elevenLabsAudioRef.current) {
      try {
        if (Platform.OS === "web") { elevenLabsAudioRef.current.pause(); }
        else { await elevenLabsAudioRef.current.stopAsync?.(); await elevenLabsAudioRef.current.unloadAsync?.(); }
      } catch { /* ignore */ }
      elevenLabsAudioRef.current = null;
    }
    if (Platform.OS === "web") stopWebSpeech();
    else await Speech.stop();
    setIsSpeaking(false);
  }, []);

  // ── Fallback TTS ──────────────────────────────────────────────────────────
  const fallbackSpeak = useCallback(async (ttsText, ttsCode, detectedLang) => {
    try {
      if (Platform.OS === "web") {
        await webSpeak(ttsText, ttsCode, { rate: 0.9, pitch: 1.0, onDone: () => setIsSpeaking(false), onError: () => setIsSpeaking(false) });
      } else {
        const rateMap  = { "ar-SA": 0.78, "ar-TN": 0.78, "tr-TR": 0.88, "fr-FR": 0.92 };
        const pitchMap = { "ar-SA": 1.1,  "ar-TN": 1.1,  "fr-FR": 1.05 };
        const opts = {
          language: ttsCode,
          rate:  rateMap[detectedLang]  ?? 0.9,
          pitch: pitchMap[detectedLang] ?? 1.0,
          onDone:  () => setIsSpeaking(false),
          onError: () => setIsSpeaking(false),
        };
        if (Platform.OS === "android" && nativeVoices[ttsCode]) opts.voice = nativeVoices[ttsCode];
        await Speech.speak(ttsText, opts);
      }
    } catch { setIsSpeaking(false); }
  }, [nativeVoices]);

  // ── Speak text ─────────────────────────────────────────────────────────────
  const speakText = useCallback(async (text, detectedLang) => {
    if (!ttsEnabled) { setIsSpeaking(false); return; }
    const ttsCode  = getTTSLang(detectedLang);
    const isArabic = ttsCode === "ar-SA" || detectedLang === "ar-TN";
    const cleaned  = stripMarkdown(text);
    const ttsText  = isArabic ? prepareArabicTTS(cleaned) : cleaned;

    try {
      const audio = await elevenLabsSpeak(ttsText, {
        onDone:  () => { elevenLabsAudioRef.current = null; setIsSpeaking(false); },
        onError: async () => { elevenLabsAudioRef.current = null; await fallbackSpeak(ttsText, ttsCode, detectedLang); },
      });
      if (audio) { elevenLabsAudioRef.current = audio; }
      else { await fallbackSpeak(ttsText, ttsCode, detectedLang); }
    } catch (e) { console.error("❌ [TTS]", e); setIsSpeaking(false); }
  }, [ttsEnabled, fallbackSpeak]);

  // ── Speech recognition events ──────────────────────────────────────────────
  useSpeechRecognitionEvent("result", (event) => {
    if (!speechRecognitionAvailable) return;
    const spoken = event.results[0]?.transcript;
    if (spoken) { pendingTranscriptRef.current = spoken; setInput(spoken); }
  });
  useSpeechRecognitionEvent("end", () => {
    if (!speechRecognitionAvailable) return;
    stopRecordTimer(); setIsListening(false);
    const t = pendingTranscriptRef.current;
    if (t?.trim()) { pendingTranscriptRef.current = ""; setInput(""); sendMessage(t.trim()); }
  });
  useSpeechRecognitionEvent("error", () => {
    if (!speechRecognitionAvailable) return;
    stopRecordTimer(); setIsListening(false); pendingTranscriptRef.current = "";
  });

  const startRecordTimer = () => {
    setRecordDuration(0);
    recordTimerRef.current = setInterval(() => setRecordDuration((p) => p + 1), 1000);
  };
  const stopRecordTimer = () => {
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
    setRecordDuration(0);
  };
  const formatDuration = (secs) => `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, "0")}`;

  const onMicPressIn = async () => {
    if (!speechRecognitionAvailable || isListening || loading) return;
    try {
      if (isSpeaking) await stopSpeaking();
      pendingTranscriptRef.current = ""; setInput(""); setIsListening(true); startRecordTimer();
      await ExpoSpeechRecognitionModule.start({ lang: speechInputLangs[0], extraLanguages: speechInputLangs.slice(1), interimResults: true });
    } catch (e) { console.error("❌ [Voice]", e); stopRecordTimer(); setIsListening(false); }
  };
  const onMicPressOut = async () => {
    if (!speechRecognitionAvailable || !isListening) return;
    try { await ExpoSpeechRecognitionModule.stop(); }
    catch {
      try { await ExpoSpeechRecognitionModule.abort(); } catch { }
      stopRecordTimer(); setIsListening(false);
      const t = pendingTranscriptRef.current;
      if (t?.trim()) { pendingTranscriptRef.current = ""; setInput(""); sendMessage(t.trim()); }
    }
  };
  const cancelRecording = async () => {
    pendingTranscriptRef.current = ""; setInput(""); stopRecordTimer(); setIsListening(false);
    if (speechRecognitionAvailable) { try { await ExpoSpeechRecognitionModule.abort(); } catch { } }
  };

  // ── i18n helpers ───────────────────────────────────────────────────────────
  const t = (map) => map[language] ?? map.fr;

  const getLoadingText = () => t({ ar: "جاري التحليل...", en: "Analyzing...", tr: "Analiz ediliyor...", fr: "Analyse..." });

  const getErrorText = (type = "connection") => {
    if (type === "overload") return t({
      fr: "⚠️ Service surchargé. Réessayez dans quelques secondes.",
      en: "⚠️ Service overloaded. Please retry in a few seconds.",
      ar: "⚠️ الخدمة مشغولة. أعد المحاولة.",
      tr: "⚠️ Servis meşgul. Lütfen tekrar deneyin.",
    });
    return t({
      fr: "❌ Erreur de connexion. Vérifiez votre réseau.",
      en: "❌ Connection error. Check your network.",
      ar: "❌ خطأ في الاتصال. تحقق من شبكتك.",
      tr: "❌ Bağlantı hatası. Ağınızı kontrol edin.",
    });
  };

  const getPlaceholder = () => {
    if (isListening) return `🎤 ${formatDuration(recordDuration)}  ${t({ ar: "تحدث... (أفلت للإرسال)", en: "Speak... (release to send)", tr: "Konuşun... (göndermek için bırakın)", fr: "Parlez... (relâchez pour envoyer)" })}`;
    return t({ ar: "اكتب سؤالك...", en: "Ask a question...", tr: "Sorunuzu yazın...", fr: "Posez votre question..." });
  };

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    if (!text?.trim() || loading) return;
    const trimmed = text.trim();
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: "user", text: trimmed }]);
    setInput("");
    setLoading(true);

    try {
      const res  = await apiFetch(API_ENDPOINTS.ai?.chat || "/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          message:             trimmed,
          conversation_id:     conversationId,
          conversationHistory,
          city:                "Tunis",
        }),
      });
      const data = await res.json();

      if (res.status === 503 || data?.error === "service_overloaded") {
        setMessages((prev) => [...prev, { id: "err-" + Date.now(), role: "assistant", text: getErrorText("overload") }]);
        return;
      }

      if (!res.ok || !data?.success) throw new Error(data?.error || "Erreur IA");

      if (data.conversation_id) setConversationId(data.conversation_id);
      if (Array.isArray(data.conversationHistory)) setConversationHistory(data.conversationHistory);

      const aiText = data.answer;
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", text: aiText }]);

      const detected = detectSpeechLang(aiText);
      setTtsLang(detected);
      setIsSpeaking(true);
      await speakText(aiText, detected);

    } catch (err) {
      console.error("❌ [sendMessage]", err.message);
      setMessages((prev) => [...prev, { id: "err-" + Date.now(), role: "assistant", text: getErrorText("connection") }]);
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [loading, conversationId, conversationHistory, speakText]);

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

  const LoadingFooter = loading ? (
    <View className="flex-row items-center gap-1.5 mt-0.5">
      <View className="w-7 h-7 rounded-full bg-green-50 border border-slate-200 items-center justify-center">
        <Text className="text-[13px]">🌿</Text>
      </View>
      <View className="flex-row items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-2xl rounded-bl-sm px-3 py-2">
        <ActivityIndicator size="small" color={RAW.green} />
        <Text className="text-xs text-slate-400 italic">{getLoadingText()}</Text>
      </View>
    </View>
  ) : null;

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top || 12, paddingBottom: insets.bottom || 10 }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-3.5 py-3 border-b border-slate-200 bg-white">
        <View className="flex-row gap-1.5">
          <TouchableOpacity onPress={onClose} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 items-center justify-center">
            <Ionicons name="chevron-forward" size={20} color={RAW.muted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setTtsEnabled((p) => !p); if (isSpeaking) stopSpeaking(); }}
            className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 items-center justify-center">
            <Ionicons name={ttsEnabled ? "volume-high-outline" : "volume-mute-outline"} size={18} color={ttsEnabled ? RAW.green : RAW.muted} />
          </TouchableOpacity>
          {isSpeaking && (
            <TouchableOpacity onPress={stopSpeaking} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 items-center justify-center">
              <Ionicons name="stop-circle-outline" size={20} color={RAW.green} />
            </TouchableOpacity>
          )}
        </View>
        <View className="flex-row items-center gap-2.5">
          <View className="items-end">
            <Text className="text-sm font-extrabold text-slate-900">SmartIrrig AI</Text>
            <Text className="text-[10px] text-green-500 mt-0.5">
              {isSpeaking
                ? `🔊 ${LANG_LABELS[ttsLang]}`
                : isListening
                  ? `🎤 ${formatDuration(recordDuration)}  ${t({ ar: "يستمع...", en: "Listening...", tr: "Dinliyor...", fr: "Écoute..." })}`
                  : `Powered by Groq • ${t({ ar: "٥ لغات", en: "5 languages", tr: "5 dil", fr: "5 langues" })}`}
            </Text>
          </View>
          <View className="w-9 h-9 rounded-full bg-green-50 border border-slate-200 items-center justify-center">
            <Text className="text-base">🌿</Text>
          </View>
        </View>
      </View>

      {/* Messages + input */}
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={10}>
        <FlatList
          ref={flatListRef}
          className="flex-1"
          contentContainerStyle={{ padding: 12, paddingBottom: 4, gap: 6 }}
          data={messages}
          keyExtractor={(item) => item.id}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={LoadingFooter}
        />

        {isListening && (
          <View className="flex-row items-center gap-2 px-3.5 py-1.5 bg-red-50 border-t border-red-200">
            <View className="w-2 h-2 rounded-full bg-red-500" />
            <Text className="flex-1 text-[11px] text-red-500 font-semibold">
              {formatDuration(recordDuration)} • {t({ ar: "أفلت الميكروفون للإرسال", en: "Release mic to send", tr: "Göndermek için bırakın", fr: "Relâchez le micro pour envoyer" })}
            </Text>
            <TouchableOpacity onPress={cancelRecording} className="w-6.5 h-6.5 rounded-full bg-red-100 items-center justify-center">
              <Ionicons name="close" size={16} color={RAW.recording} />
            </TouchableOpacity>
          </View>
        )}

        <View className="flex-row items-center gap-1.5 px-3 py-2.5 bg-white border-t border-slate-200">
          <TouchableOpacity onPressIn={onMicPressIn} onPressOut={onMicPressOut} activeOpacity={0.85}
            disabled={loading || !speechRecognitionAvailable}
            className={`w-[38px] h-[38px] rounded-full border items-center justify-center shrink-0 ${isListening ? "bg-red-500 border-red-500" : "bg-slate-100 border-slate-200"}`}>
            <Ionicons
              name={speechRecognitionAvailable ? (isListening ? "mic" : "mic-outline") : "mic-off-outline"}
              size={19} color={isListening ? "#fff" : RAW.muted}
            />
          </TouchableOpacity>

          <TextInput
            className={`flex-1 border rounded-[20px] px-3.5 py-2 text-[13px] max-h-[90px] ${isListening ? "border-red-300 bg-red-50 text-red-500" : "border-slate-200 bg-slate-100 text-slate-900"}`}
            placeholder={getPlaceholder()}
            placeholderTextColor={isListening ? RAW.recording : RAW.muted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => { if (input.trim() && !isListening) sendMessage(input); }}
            blurOnSubmit={false}
            returnKeyType="send"
            maxLength={500}
            editable={!isListening}
            style={isRTL ? { textAlign: "right" } : undefined}
          />

          <TouchableOpacity onPress={() => sendMessage(input)} disabled={loading || !input.trim() || isListening}
            activeOpacity={0.85}
            className={`w-[38px] h-[38px] rounded-full border items-center justify-center shrink-0 ${input.trim() && !loading && !isListening ? "bg-green-700 border-green-700" : "bg-slate-100 border-slate-200"}`}>
            <Ionicons name="send" size={17} color={input.trim() && !loading && !isListening ? "#fff" : RAW.muted} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}