// frontend/hooks/useAIVoice.js
// Voice / TTS hook: expo-speech, ElevenLabs TTS, Web Speech API TTS fallback,
// and SpeechRecognition via expo-speech-recognition.

import { useState, useRef, useCallback, useEffect } from "react";
import { Platform, Alert, Linking } from "react-native";
import * as Speech from "expo-speech";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { apiFetch, API_ENDPOINTS } from "@api/client";
import { useLanguage } from "@context/LanguageContext";

// ── Optional speech recognition ───────────────────────────────────────────────
let ExpoSpeechRecognitionModule = null;
let useSpeechRecognitionEvent = () => {};

try {
  const speechRecognition = require("expo-speech-recognition");
  ExpoSpeechRecognitionModule =
    speechRecognition.ExpoSpeechRecognitionModule ?? null;
  useSpeechRecognitionEvent =
    speechRecognition.useSpeechRecognitionEvent ?? (() => {});
} catch (error) {
  console.warn("[AIChat] Voice recognition unavailable:", error?.message ?? error);
}

// ══════════════════════════════════════════════════════════════════════════════
// PURE HELPERS (module-level, not hooks)
// ══════════════════════════════════════════════════════════════════════════════

export function stripMarkdown(text = "") {
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
  return text
    .replace(/[ً-ٰٟ]/g, "")
    .replace(/\b(\d+)\b/g, (_, n) => numToArabic(n));
}

export function detectSpeechLang(text = "") {
  const s = text.slice(0, 300);
  const arabicChars = (s.match(/[؀-ۿ]/g) || []).length;

  const tunisianWords = /\b(chneya|kifesh|barsha|bhi|mrigel|ya3tik|3andek|3andi|3andha|lazem|bech|bch|taw|famma|hnaya|sahit|yezzi|mouch|wala|kifek|labas|nheb|ma3lich|haka|9addesh|9adh|9oulha|9abel|ween|mta3|elli|yelzem|tnajem|talbek|ena|inti|brabi|chkoun|chbik|nrou7|nlawej|shniya|fih|3lih|manha|ghadi|rahi|yaani|chahed|mar7ba|ahlen|yser|w9t|b3d|kbir|sghir|zwina|behi|mrigla|nfhem|tfhem|nkhou|baba|mama|khti|khoya|7abs|7aja|ki|wach|mich|mn|jit|besh)\b/gi;
  const tunisianScore = (s.match(tunisianWords) || []).length;
  const hasNumLetters = /\b\w*[379]\w*\b/.test(s);

  if (arabicChars > 3 && !hasNumLetters) return "ar-SA";
  if (tunisianScore >= 1 || hasNumLetters) return "ar-SA";

  const scores = {
    "tr-TR":
      (s.match(/[şğüöçıİŞĞÜÖÇ]/g) || []).length * 4,
    "fr-FR":
      (s.match(/[àâæçéèêëîïôœùûüÿ]/gi) || []).length * 2 +
      (s.match(/\b(le|la|les|de|du|des|pour|avec|dans|que|qui|vous|votre|je|nous|est|une|bonjour|merci|température|irrigation)\b/gi) || []).length * 1.5,
    "en-US":
      (s.match(/\b(the|is|are|and|for|with|your|you|this|have|will|from|they|weather|irrigation|crop|hello|thank)\b/gi) || []).length,
  };

  const winner = Object.entries(scores).reduce((a, b) => (b[1] > a[1] ? b : a));
  return winner[1] >= 2 ? winner[0] : "fr-FR";
}

export const LANG_LABELS = {
  "ar-SA": "العربية 🇸🇦",
  "tr-TR": "Türkçe 🇹🇷",
  "fr-FR": "Français 🇫🇷",
  "en-US": "English 🇬🇧",
};

const SPEECH_RATE = {
  "ar-SA": 0.84,
  "tr-TR": 0.88,
  "fr-FR": 0.92,
  "en-US": 0.90,
};
const SPEECH_PITCH = {
  "ar-SA": 1.0,
  "fr-FR": 1.05,
  "tr-TR": 1.0,
  "en-US": 1.0,
};

// ── Web TTS via SpeechSynthesis ───────────────────────────────────────────────
let _webVoicesCache = null;
function loadWebVoices() {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) { resolve([]); return; }
    const v = window.speechSynthesis.getVoices();
    if (v.length > 0) { _webVoicesCache = v; resolve(v); return; }
    window.speechSynthesis.onvoiceschanged = () => {
      _webVoicesCache = window.speechSynthesis.getVoices();
      resolve(_webVoicesCache);
    };
    setTimeout(() => resolve(window.speechSynthesis.getVoices() || []), 2000);
  });
}

async function webSpeak(text, langCode, { rate = 0.92, pitch = 1.0, onDone, onError } = {}) {
  if (typeof window === "undefined" || !window.speechSynthesis) { onError?.(); return; }
  window.speechSynthesis.cancel();
  const voices     = await loadWebVoices();
  const utterance  = new window.SpeechSynthesisUtterance(text);
  const langPrefix = langCode.split("-")[0];
  const matched    =
    voices.find((v) => v.lang === langCode && v.name?.toLowerCase().includes("google")) ||
    voices.find((v) => v.lang?.startsWith(langPrefix) && v.name?.toLowerCase().includes("google")) ||
    voices.find((v) => v.lang === langCode) ||
    voices.find((v) => v.lang?.startsWith(langPrefix));
  if (matched) utterance.voice = matched;
  utterance.lang  = langCode;
  utterance.rate  = rate;
  utterance.pitch = pitch;
  const keepAlive = setInterval(() => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    } else clearInterval(keepAlive);
  }, 10000);
  utterance.onend   = () => { clearInterval(keepAlive); onDone?.(); };
  utterance.onerror = (e) => { clearInterval(keepAlive); console.error("[WebTTS]", e.error); onError?.(); };
  window.speechSynthesis.speak(utterance);
}

function stopWebSpeech() {
  if (typeof window !== "undefined" && window.speechSynthesis)
    window.speechSynthesis.cancel();
}

// ── Web AudioContext for ElevenLabs ──────────────────────────────────────────
let _audioCtx    = null;
let _audioSource = null;

export function getWebAudioCtx() {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!_audioCtx || _audioCtx.state === "closed") _audioCtx = new Ctor();
  return _audioCtx;
}

function stopWebAudio() {
  if (_audioSource) {
    try { _audioSource.stop(); } catch {}
    _audioSource = null;
  }
}

// ── Best native voice for a language (Android only) ─────────────────────────
async function getVoiceForLanguage(language) {
  if (Platform.OS !== "android") return undefined;
  try {
    const voices     = await Speech.getAvailableVoicesAsync();
    const langPrefix = language.split("-")[0];
    const google   = voices.find(v => v.language === language && v.name?.toLowerCase().includes("google"));
    if (google) return google.identifier;
    const enhanced = voices.find(v => v.language === language && v.quality === "Enhanced");
    if (enhanced) return enhanced.identifier;
    const same     = voices.find(v => v.language === language);
    if (same) return same.identifier;
    const prefix   = voices.find(v => v.language?.startsWith(langPrefix) && v.name?.toLowerCase().includes("google"));
    return prefix?.identifier;
  } catch { return undefined; }
}

// ══════════════════════════════════════════════════════════════════════════════
// HOOK
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @param {{ onTranscriptReady: (text: string) => void, onInterimTranscript: (text: string) => void }} callbacks
 */
export function useAIVoice({ onTranscriptReady, onInterimTranscript } = {}) {
  const { language } = useLanguage();

  const [isSpeaking,     setIsSpeaking]     = useState(false);
  const [ttsLang,        setTtsLang]        = useState("fr-FR");
  const [ttsEnabled,     setTtsEnabled]     = useState(true);
  const [nativeVoices,   setNativeVoices]   = useState({});
  const [isListening,    setIsListening]    = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);

  const pendingTranscriptRef = useRef("");
  const recordTimerRef       = useRef(null);
  const elevenLabsSoundRef   = useRef(null);

  // Store callbacks in refs so event handlers always see the latest value
  const onTranscriptReadyRef   = useRef(onTranscriptReady);
  const onInterimTranscriptRef = useRef(onInterimTranscript);
  useEffect(() => { onTranscriptReadyRef.current   = onTranscriptReady;   }, [onTranscriptReady]);
  useEffect(() => { onInterimTranscriptRef.current = onInterimTranscript; }, [onInterimTranscript]);

  const speechRecognitionAvailable = !!(ExpoSpeechRecognitionModule?.start);

  const speechInputLangs = (() => {
    const all     = ["ar-SA", "fr-FR", "en-US", "tr-TR"];
    const appLang = { fr: "fr-FR", en: "en-US", ar: "ar-SA", tr: "tr-TR" }[language] || "ar-SA";
    return [appLang, ...all.filter((l) => l !== appLang)];
  })();

  // ── Load native voices (Android) ─────────────────────────────────────────
  const loadNativeVoices = useCallback(async () => {
    const voicesMap = {};
    for (const lang of ["ar-SA", "tr-TR", "fr-FR", "en-US"]) {
      const id = await getVoiceForLanguage(lang);
      if (id) voicesMap[lang] = id;
    }
    setNativeVoices(voicesMap);
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      loadWebVoices();
    } else {
      loadNativeVoices();
      if (ExpoSpeechRecognitionModule?.requestPermissionsAsync) {
        ExpoSpeechRecognitionModule.requestPermissionsAsync().catch(() => {});
      }
    }
  }, [loadNativeVoices]);

  // ── ElevenLabs TTS — Web (AudioContext) ──────────────────────────────────
  const speakWithElevenLabsWeb = useCallback(async (text) => {
    const ctx = getWebAudioCtx();
    if (!ctx) return false;
    try {
      const res = await apiFetch(API_ENDPOINTS.ai.tts, {
        method:    "POST",
        body:      JSON.stringify({ text }),
        timeoutMs: 15000,
      });
      if (!res.ok) return false;

      const ab = await res.arrayBuffer();
      if (!ab || ab.byteLength === 0) return false;

      stopWebAudio();
      stopWebSpeech();

      await ctx.resume();
      const audioBuffer = await ctx.decodeAudioData(ab);
      const source      = ctx.createBufferSource();
      source.buffer     = audioBuffer;
      source.connect(ctx.destination);
      _audioSource   = source;
      source.onended = () => { setIsSpeaking(false); _audioSource = null; };
      source.start(0);
      return true;
    } catch (e) {
      console.error("❌ [ElevenLabs Web TTS]", e.message);
      setIsSpeaking(false);
      _audioSource = null;
      return false;
    }
  }, []);

  // ── ElevenLabs TTS — Mobile ──────────────────────────────────────────────
  const speakWithElevenLabs = useCallback(async (text) => {
    try {
      const res = await apiFetch(API_ENDPOINTS.ai.tts, {
        method: "POST",
        body: JSON.stringify({ text }),
        timeoutMs: 15000,
      });
      if (!res.ok) return false;

      const ab    = await res.arrayBuffer();
      const bytes = new Uint8Array(ab);
      const CHUNK = 0x8000;
      let binary  = "";
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      }
      const base64 = btoa(binary);

      const tempFile = (FileSystem.cacheDirectory || FileSystem.documentDirectory) + "ai_tts.mp3";
      await FileSystem.writeAsStringAsync(tempFile, base64, { encoding: FileSystem.EncodingType.Base64 });

      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });

      if (elevenLabsSoundRef.current) {
        try { await elevenLabsSoundRef.current.unloadAsync(); } catch {}
        elevenLabsSoundRef.current = null;
      }

      const { sound } = await Audio.Sound.createAsync({ uri: tempFile }, { shouldPlay: true });
      elevenLabsSoundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish || status.error) {
          setIsSpeaking(false);
          try { sound.unloadAsync(); } catch {}
          if (elevenLabsSoundRef.current === sound) elevenLabsSoundRef.current = null;
        }
      });
      return true;
    } catch (e) {
      console.error("❌ [ElevenLabs TTS]", e.message);
      return false;
    }
  }, []);

  // ── Stop all TTS ─────────────────────────────────────────────────────────
  const stopSpeaking = useCallback(async () => {
    if (elevenLabsSoundRef.current) {
      try {
        await elevenLabsSoundRef.current.stopAsync();
        await elevenLabsSoundRef.current.unloadAsync();
      } catch {}
      elevenLabsSoundRef.current = null;
    }
    if (Platform.OS === "web") { stopWebAudio(); stopWebSpeech(); }
    else { try { await Speech.stop(); } catch {} }
    setIsSpeaking(false);
  }, []);

  // ── speakText — routes to correct TTS engine ─────────────────────────────
  const speakText = useCallback(async (text, detectedLang) => {
    if (!ttsEnabled) { setIsSpeaking(false); return; }

    const isArabic = detectedLang === "ar-SA";
    const cleaned  = stripMarkdown(text);
    const rate     = SPEECH_RATE[detectedLang]  ?? 0.9;
    const pitch    = SPEECH_PITCH[detectedLang] ?? 1.0;

    try {
      if (Platform.OS === "web") {
        if (isArabic) {
          const ok = await speakWithElevenLabsWeb(cleaned);
          if (ok) return;
        }
        await webSpeak(cleaned, detectedLang, {
          rate, pitch,
          onDone:  () => setIsSpeaking(false),
          onError: () => setIsSpeaking(false),
        });
        return;
      }

      if (isArabic) {
        const ok = await speakWithElevenLabs(cleaned);
        if (ok) return;
      }

      const ttsText = isArabic ? prepareArabicTTS(cleaned) : cleaned;
      const opts = {
        language: detectedLang,
        rate,
        pitch,
        onDone:  () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      };
      if (Platform.OS === "android" && nativeVoices[detectedLang]) {
        opts.voice = nativeVoices[detectedLang];
      }
      Speech.speak(ttsText, opts);

    } catch (e) {
      console.error("❌ [TTS]", e.message);
      setIsSpeaking(false);
    }
  }, [ttsEnabled, nativeVoices, speakWithElevenLabs, speakWithElevenLabsWeb]);

  // ── Record timer ──────────────────────────────────────────────────────────
  const startRecordTimer = useCallback(() => {
    setRecordDuration(0);
    recordTimerRef.current = setInterval(() => setRecordDuration((p) => p + 1), 1000);
  }, []);

  const stopRecordTimer = useCallback(() => {
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
    setRecordDuration(0);
  }, []);

  const formatDuration = (secs) =>
    `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, "0")}`;

  // ── Speech recognition events ─────────────────────────────────────────────
  useSpeechRecognitionEvent("result", (event) => {
    if (!speechRecognitionAvailable) return;
    const spoken = event.results[0]?.transcript;
    if (spoken) {
      pendingTranscriptRef.current = spoken;
      onInterimTranscriptRef.current?.(spoken);
    }
  });

  useSpeechRecognitionEvent("end", () => {
    if (!speechRecognitionAvailable) return;
    stopRecordTimer();
    setIsListening(false);
    const transcript = pendingTranscriptRef.current;
    pendingTranscriptRef.current = "";
    if (transcript?.trim()) {
      onTranscriptReadyRef.current?.(transcript.trim());
    }
  });

  useSpeechRecognitionEvent("error", () => {
    if (!speechRecognitionAvailable) return;
    stopRecordTimer();
    setIsListening(false);
    pendingTranscriptRef.current = "";
  });

  // ── Mic toggle ────────────────────────────────────────────────────────────
  const onMicToggle = useCallback(async (loading) => {
    if (!speechRecognitionAvailable || loading) return;

    if (isListening) {
      stopRecordTimer();
      setIsListening(false);
      try {
        if (ExpoSpeechRecognitionModule.stop) await ExpoSpeechRecognitionModule.stop();
        else if (ExpoSpeechRecognitionModule.abort) await ExpoSpeechRecognitionModule.abort();
      } catch {}
      // The "end" event will fire and call onTranscriptReady
      return;
    }

    // Check / request mic permission
    if (Platform.OS !== "web" && ExpoSpeechRecognitionModule?.requestPermissionsAsync) {
      try {
        const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!result?.granted) {
          if (result?.canAskAgain === false) {
            Alert.alert(
              "Permission microphone",
              "L'accès au microphone a été refusé. Activez-le dans les paramètres de l'application.",
              [
                { text: "Annuler", style: "cancel" },
                { text: "Paramètres", onPress: () => Linking.openSettings() },
              ]
            );
          } else {
            Alert.alert(
              "Permission microphone",
              "SmartIrrig a besoin du microphone pour enregistrer votre voix.",
              [{ text: "OK" }]
            );
          }
          return;
        }
      } catch (e) {
        console.warn("[Voice] Permission error:", e.message);
        return;
      }
    }

    // Start recognition
    try {
      if (isSpeaking) await stopSpeaking();
      pendingTranscriptRef.current = "";
      setIsListening(true);
      startRecordTimer();
      await ExpoSpeechRecognitionModule.start({
        lang:           speechInputLangs[0],
        extraLanguages: speechInputLangs.slice(1),
        interimResults: true,
        continuous:     false,
      });
    } catch (e) {
      console.error("❌ [Voice]", e.message);
      stopRecordTimer();
      setIsListening(false);
      Alert.alert("Microphone", "Impossible de démarrer la reconnaissance vocale. Réessayez.");
    }
  }, [
    speechRecognitionAvailable, isListening, isSpeaking,
    stopSpeaking, startRecordTimer, stopRecordTimer, speechInputLangs,
  ]);

  // ── Cancel recording ──────────────────────────────────────────────────────
  const cancelRecording = useCallback(async () => {
    pendingTranscriptRef.current = "";
    stopRecordTimer();
    setIsListening(false);
    if (speechRecognitionAvailable) {
      try {
        if (ExpoSpeechRecognitionModule.abort) await ExpoSpeechRecognitionModule.abort();
        else if (ExpoSpeechRecognitionModule.stop) await ExpoSpeechRecognitionModule.stop();
      } catch {}
    }
  }, [speechRecognitionAvailable, stopRecordTimer]);

  return {
    // state
    isSpeaking,
    setIsSpeaking,
    ttsLang,
    setTtsLang,
    ttsEnabled,
    setTtsEnabled,
    isListening,
    recordDuration,
    speechRecognitionAvailable,
    // functions
    speakText,
    stopSpeaking,
    onMicToggle,
    cancelRecording,
    formatDuration,
  };
}
