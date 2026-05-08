// frontend/hooks/useAIChat.js
// Chat logic hook: manages messages, sending to the backend, loading state,
// conversation ID, and server wake-up ping.

import { useState, useRef, useCallback, useEffect } from "react";
import { Platform } from "react-native";
import { apiFetch, API_ENDPOINTS } from "@api/client";
import { useLanguage } from "@context/LanguageContext";
import { getWebAudioCtx } from "./useAIVoice";

const INITIAL_MESSAGES = {
  fr: "🌿 Bonjour! Comment puis-je vous aider?",
  en: "🌿 Hello! How can I help you?",
  ar: "🌿 أهلاً! كيف يمكنني مساعدتك؟",
  tr: "🌿 Merhaba! Size nasıl yardımcı olabilirim?",
};

// IDs of messages to exclude from history sent to the backend
const INITIAL_MSG_ID = "0";

/**
 * @param {{
 *   speakText: (text: string, lang: string) => Promise<void>,
 *   setIsSpeaking: (v: boolean) => void,
 *   detectSpeechLang: (text: string) => string,
 *   setTtsLang: (lang: string) => void,
 *   flatListRef: React.RefObject<any>,
 * }} deps
 */
export function useAIChat({ speakText, setIsSpeaking, detectSpeechLang, setTtsLang, flatListRef }) {
  const { language } = useLanguage();

  const [messages,     setMessages]     = useState([{ id: INITIAL_MSG_ID, role: "assistant", text: INITIAL_MESSAGES[language] || INITIAL_MESSAGES.fr }]);
  const [loading,      setLoading]      = useState(false);
  const [serverStatus, setServerStatus] = useState("connecting"); // "connecting" | "ready"

  const conversationIdRef = useRef("");
  const wakingUpRef       = useRef(true);
  const wakeTimerRef      = useRef(null);

  // ── i18n helper ──────────────────────────────────────────────────────────
  const t = useCallback((map) => map[language] ?? map.fr, [language]);

  // ── Server wake-up ping ──────────────────────────────────────────────────
  const pingServer = useCallback(async (attempt) => {
    if (!wakingUpRef.current || attempt >= 5) { setServerStatus("ready"); return; }
    try {
      const res = await apiFetch(API_ENDPOINTS.ai.status, { timeoutMs: 5000 });
      if (res.ok) { setServerStatus("ready"); wakingUpRef.current = false; return; }
    } catch {}
    if (wakingUpRef.current) {
      wakeTimerRef.current = setTimeout(() => pingServer(attempt + 1), 3000);
    }
  }, []);

  const stopConnecting = useCallback(() => {
    wakingUpRef.current = false;
    if (wakeTimerRef.current) clearTimeout(wakeTimerRef.current);
    setServerStatus("ready");
  }, []);

  useEffect(() => {
    pingServer(0);
    return () => {
      wakingUpRef.current = false;
      if (wakeTimerRef.current) clearTimeout(wakeTimerRef.current);
    };
  }, [pingServer]);

  // ── Reset messages when language changes ────────────────────────────────
  useEffect(() => {
    setMessages([{ id: INITIAL_MSG_ID, role: "assistant", text: INITIAL_MESSAGES[language] || INITIAL_MESSAGES.fr }]);
    conversationIdRef.current = "";
  }, [language]);

  // ── Text helpers ─────────────────────────────────────────────────────────
  const getLoadingText = useCallback(() => t({
    ar: "جاري التحليل...", en: "Analyzing...", tr: "Analiz ediliyor...", fr: "Analyse...",
  }), [t]);

  const getErrorText = useCallback((type = "connection") => {
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
  }, [t]);

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    if (!text?.trim() || loading) return;
    const trimmed = text.trim();

    // Unlock AudioContext during a user gesture (web)
    if (Platform.OS === "web") { try { getWebAudioCtx()?.resume(); } catch {} }

    // ✅ Build history BEFORE setMessages, excluding the static welcome message (id="0")
    // so the AI doesn't think it already greeted and skip the salutation response.
    const history = [
      ...messages
        .filter((m) => m.id !== INITIAL_MSG_ID && (m.role === "user" || m.role === "assistant"))
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.text })),
      { role: "user", content: trimmed },
    ];

    setMessages((prev) => [...prev, { id: Date.now().toString(), role: "user", text: trimmed }]);
    setLoading(true);

    try {

      const res = await apiFetch(API_ENDPOINTS.ai?.chat || "/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          message:        trimmed,
          conversationId: conversationIdRef.current || "",
          city:           "Tunis",
          history,
        }),
        timeoutMs: 90000,
      });
      const data = await res.json();

      if (res.status === 503 || res.status === 429 || data?.error === "service_overloaded" || data?.error === "rate_limit") {
        setMessages((prev) => [...prev, { id: "err-" + Date.now(), role: "assistant", text: getErrorText("overload") }]);
        return;
      }

      if (!res.ok || !data?.success) {
        const serverMsg  = data?.error || data?.message;
        const displayMsg = serverMsg
          ? `⚠️ ${serverMsg}`
          : t({ fr: "⚠️ Erreur serveur. Réessayez.", en: "⚠️ Server error. Retry.", ar: "⚠️ خطأ في الخادم. أعد المحاولة.", tr: "⚠️ Sunucu hatası. Tekrar dene." });
        setMessages((prev) => [...prev, { id: "err-" + Date.now(), role: "assistant", text: displayMsg }]);
        return;
      }

      if (data.conversationId) conversationIdRef.current = data.conversationId;

      const aiText  = data.answer;
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", text: aiText }]);

      // ✅ Truncate TTS to 200 chars max — long sentences cause bad voice quality
      const ttsText  = aiText.length > 200 ? aiText.slice(0, 200).replace(/[^.!?،؟]*$/, '').trim() || aiText.slice(0, 200) : aiText;
      const detected = detectSpeechLang(aiText);
      setTtsLang(detected);
      setIsSpeaking(true);
      await speakText(ttsText, detected);

    } catch (err) {
      console.error("❌ [sendMessage]", err.message);
      const isTimeout = err?.name === "AbortError" || err?.name === "TimeoutError";
      const errMsg = isTimeout
        ? t({ fr: "⏳ Serveur en démarrage. Réessayez dans quelques secondes.", en: "⏳ Server starting up. Please retry in a few seconds.", ar: "⏳ الخادم يبدأ. أعد المحاولة.", tr: "⏳ Sunucu başlıyor. Lütfen tekrar deneyin." })
        : getErrorText("connection");
      setMessages((prev) => [...prev, { id: "err-" + Date.now(), role: "assistant", text: errMsg }]);
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [loading, messages, speakText, setIsSpeaking, detectSpeechLang, setTtsLang, getErrorText, t, flatListRef]);

  return {
    messages,
    loading,
    serverStatus,
    sendMessage,
    stopConnecting,
    getLoadingText,
    t,
  };
}