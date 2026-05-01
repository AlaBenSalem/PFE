import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { Logo } from "@components/Logo";
import { SafeScreen } from "@components/SafeScreen";
import { authAPI } from "@api/auth";
import { APP_ROUTES, AUTH_ROUTES } from "@constants/routes";
import { LANGUAGE_OPTIONS, useLanguage } from "@context/LanguageContext";

// ─── Google Signin — Android natif seulement ─────────────────────────────────
let GoogleSignin = null;
let statusCodes = {};

if (Platform.OS === "android") {
  try {
    const gsModule = require("@react-native-google-signin/google-signin");
    GoogleSignin = gsModule.GoogleSignin;
    statusCodes = gsModule.statusCodes;

    GoogleSignin.configure({
      webClientId:
        "861346189775-dcblovh2u607hduecqvi2tj0p3sv4c2i.apps.googleusercontent.com",
      androidClientId:
        "861346189775-c9qano8fpg5lqjhlc9ebiil4ub7lpbmo.apps.googleusercontent.com",
      iosClientId:
        "861346189775-jt0kp72jduhpgkjnnupjboosdchu11td.apps.googleusercontent.com",
      offlineAccess: false,
    });
  } catch (e) {
    console.warn("[GoogleSignin] Module non disponible:", e.message);
  }
}

WebBrowser.maybeCompleteAuthSession();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AUTH_ROUTE = APP_ROUTES.home;
const ADMIN_ROUTE = APP_ROUTES.adminDashboard;

const GOOGLE_WEB_CLIENT_ID =
  "861346189775-dcblovh2u607hduecqvi2tj0p3sv4c2i.apps.googleusercontent.com";
const GOOGLE_ANDROID_CLIENT_ID =
  "861346189775-c9qano8fpg5lqjhlc9ebiil4ub7lpbmo.apps.googleusercontent.com";
const GOOGLE_IOS_CLIENT_ID =
  "861346189775-jt0kp72jduhpgkjnnupjboosdchu11td.apps.googleusercontent.com";

// ✅ Config Google — jamais null, évite le crash "Cannot read property 'iosClientId' of null"
const GOOGLE_AUTH_CONFIG = {
  clientId: GOOGLE_WEB_CLIENT_ID,
  iosClientId: GOOGLE_IOS_CLIENT_ID,
  androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  extraParams: { prompt: "select_account", access_type: "online" },
};

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}
function sanitizeText(v) {
  return String(v || "").trim();
}

async function saveLog(action, details) {
  try {
    const raw = await AsyncStorage.getItem("smartirrig_user_logs");
    const logs = raw ? JSON.parse(raw) : [];
    logs.unshift({
      id: Date.now().toString(),
      type: "auth",
      action,
      details,
      timestamp: new Date().toISOString(),
    });
    await AsyncStorage.setItem(
      "smartirrig_user_logs",
      JSON.stringify(logs.slice(0, 200))
    );
  } catch {}
}

// ✅ Gère v11 ET v12+ response shape de @react-native-google-signin
async function googleSignInNative() {
  if (!GoogleSignin) throw new Error("GoogleSignin non disponible");
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  try { await GoogleSignin.signOut(); } catch {}
  const result = await GoogleSignin.signIn();
  const idToken =
    result?.data?.idToken ||
    result?.idToken ||
    result?.data?.authentication?.idToken;
  if (!idToken) {
    console.error("[GoogleSignin] Response shape reçue:", JSON.stringify(result));
    throw new Error(
      "idToken introuvable. Vérifiez que oauth_client n'est pas vide dans google-services.json."
    );
  }
  return { idToken };
}

// ─────────────────────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const { t, isRTL, language, changeLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState("login");

  const handleLanguageSwitch = () => {
    const options = LANGUAGE_OPTIONS.map((item) => item.code);
    const currentIndex = options.indexOf(language);
    const nextLanguage = options[(currentIndex + 1) % options.length];
    changeLanguage(nextLanguage);
  };

  return (
    <SafeScreen>
      <KeyboardAvoidingView
        className="flex-1 bg-white"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 px-6 pb-4">
            <View className="mb-2 mt-1.5 items-end">
              <TouchableOpacity
                className="self-end rounded-full border border-slate-300 bg-slate-100 px-3.5 py-1.5 shadow-sm"
                onPress={handleLanguageSwitch}
                activeOpacity={0.85}
              >
                <View className="flex-row items-center justify-center">
                  <Text className="mr-2 text-xs font-semibold text-slate-700">
                    {t("drawer.languageTitle")}
                  </Text>
                  <Text className="text-[13px] font-extrabold text-slate-900">
                    {language.toUpperCase()}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
            <View className="mt-4">
              <Logo />
            </View>
            <View className="mb-4 flex-row border-b border-slate-200">
              {["login", "signup"].map((tab) => (
                <TouchableOpacity
                  key={tab}
                  className="relative flex-1 items-center pb-3"
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`text-base font-semibold ${
                      activeTab === tab ? "text-green-600" : "text-slate-400"
                    }`}
                  >
                    {tab === "login" ? t("tabs.login") : t("tabs.signup")}
                  </Text>
                  {activeTab === tab ? (
                    <View className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600" />
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
            {activeTab === "login" ? (
              <LoginForm t={t} isRTL={isRTL} />
            ) : (
              <SignupForm t={t} isRTL={isRTL} />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN FORM
// ─────────────────────────────────────────────────────────────────────────────
function LoginForm({ t, isRTL }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [fieldError, setFieldError] = useState("");

  // ✅ FIX : toujours passer un objet valide, jamais null
  // Sur Android on utilise GoogleSignin natif, mais useAuthRequest doit quand même
  // recevoir un config valide pour éviter le crash "Cannot read property 'iosClientId' of null"
  const [, response, promptAsync] = Google.useAuthRequest(GOOGLE_AUTH_CONFIG);

  const handleGoogleSuccess = useCallback(
    async ({ idToken, accessToken }) => {
      if (!idToken && !accessToken) {
        setFieldError(t("login.invalidCredentials"));
        return;
      }
      setGoogleLoading(true);
      setFieldError("");
      try {
        const data = await authAPI.googleLogin({ idToken, accessToken });
        if (data.token) await AsyncStorage.setItem("userToken", data.token);
        if (data.user)
          await AsyncStorage.setItem("userData", JSON.stringify(data.user));
        await saveLog("Connexion Google", data.user?.email || "");
        router.replace(data.role === "admin" ? ADMIN_ROUTE : AUTH_ROUTE);
      } catch (err) {
        setFieldError(err.message || t("login.invalidCredentials"));
      } finally {
        setGoogleLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    if (Platform.OS === "android") return;
    if (response?.type === "success") {
      const idToken = response.authentication?.idToken;
      const accessToken = response.authentication?.accessToken;
      handleGoogleSuccess({ idToken, accessToken });
    }
  }, [response, handleGoogleSuccess]);

  const handleGooglePress = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    setFieldError("");
    try {
      if (Platform.OS === "android" && GoogleSignin) {
        const { idToken } = await googleSignInNative();
        await handleGoogleSuccess({ idToken });
      } else {
        setGoogleLoading(false);
        await promptAsync();
      }
    } catch (err) {
      const code = err?.code;
      if (
        code === statusCodes.SIGN_IN_CANCELLED ||
        code === statusCodes.IN_PROGRESS
      ) {
        // Silencieux
      } else {
        console.error("[Google Login]", err);
        setFieldError(err.message || t("login.invalidCredentials"));
      }
      setGoogleLoading(false);
    }
  };

  const handleLogin = async () => {
  setFieldError("");
  const em = normalizeEmail(email);
  const pw = String(password || "");
  if (!em || !pw) {
    setFieldError(t("login.fillFields") || "Remplissez tous les champs");
    return;
  }
  if (!EMAIL_REGEX.test(em)) {
    setFieldError(t("login.invalidEmail") || "Email invalide");
    return;
  }
  setLoading(true);
  try {
    // ✅ Essayer adminLogin d'abord
    let data;
    let isAdmin = false;
    try {
      data = await authAPI.adminLogin({ email: em, password: pw });
      isAdmin = true;
    } catch {
      // Pas admin → essayer login user normal
      data = await authAPI.login({ email: em, password: pw });
    }

    if (data.token) {
      if (isAdmin) {
        await AsyncStorage.setItem("adminToken", data.token);
        if (data.admin) await AsyncStorage.setItem("adminData", JSON.stringify(data.admin));
      } else {
        await AsyncStorage.setItem("userToken", data.token);
        if (data.user) await AsyncStorage.setItem("userData", JSON.stringify(data.user));
      }
    }
    await saveLog("Connexion", em);
    router.replace(isAdmin ? ADMIN_ROUTE : AUTH_ROUTE);
  } catch (err) {
    setFieldError(err.message || t("login.invalidCredentials"));
  } finally {
    setLoading(false);
  }
};

  return (
    <View>
      <ErrorBox message={fieldError} />
      <FieldLabel text={t("signup.emailLabel")} isRTL={isRTL} />
      <FieldInput
        placeholder="votre@email.com"
        value={email}
        onChangeText={setEmail}
        icon="mail-outline"
        keyboardType="email-address"
        autoCapitalize="none"
        isRTL={isRTL}
      />
      <FieldLabel text={t("signup.passwordLabel")} isRTL={isRTL} />
      <FieldInput
        placeholder="........"
        value={password}
        onChangeText={setPassword}
        icon="lock-closed-outline"
        secureTextEntry={!showPassword}
        isPassword
        showPassword={showPassword}
        onTogglePassword={() => setShowPassword((p) => !p)}
        isRTL={isRTL}
        extraStyle={{ marginBottom: 8 }}
      />
      <TouchableOpacity
        className="mb-4 items-end"
        onPress={() => router.push(AUTH_ROUTES.forgotPassword)}
        activeOpacity={0.7}
      >
        <Text className="text-[13px] text-green-600">
          {t("login.forgotPassword") || "Mot de passe oublié ?"}
        </Text>
      </TouchableOpacity>
      <SubmitButton
        label={loading ? t("login.loginLoading") || "Connexion..." : t("tabs.login")}
        onPress={handleLogin}
        disabled={loading}
      />
      <Separator />
      <GoogleButton
        loading={googleLoading}
        onPress={handleGooglePress}
        label={t("common.googleLogin")}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGNUP FORM
// ─────────────────────────────────────────────────────────────────────────────
function SignupForm({ t, isRTL }) {
  const [form, setFormState] = useState({
    firstName: "",
    lastName: "",
    address: "",
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [fieldError, setFieldError] = useState("");

  // ✅ FIX : toujours passer un objet valide, jamais null
  const [, response, promptAsync] = Google.useAuthRequest(GOOGLE_AUTH_CONFIG);

  const set = (key) => (val) => setFormState((prev) => ({ ...prev, [key]: val }));

  const handleGoogleSuccess = useCallback(
    async ({ idToken, accessToken }) => {
      if (!idToken && !accessToken) {
        setFieldError(t("login.invalidCredentials"));
        return;
      }
      setGoogleLoading(true);
      setFieldError("");
      try {
        const data = await authAPI.googleLogin({ idToken, accessToken });
        if (data.token) await AsyncStorage.setItem("userToken", data.token);
        if (data.user)
          await AsyncStorage.setItem("userData", JSON.stringify(data.user));
        await saveLog("Inscription Google", data.user?.email || "");
        router.replace(data.role === "admin" ? ADMIN_ROUTE : AUTH_ROUTE);
      } catch (err) {
        setFieldError(err.message || t("login.invalidCredentials"));
      } finally {
        setGoogleLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    if (Platform.OS === "android") return;
    if (response?.type === "success") {
      const idToken = response.authentication?.idToken;
      const accessToken = response.authentication?.accessToken;
      handleGoogleSuccess({ idToken, accessToken });
    }
  }, [response, handleGoogleSuccess]);

  const handleGooglePress = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    setFieldError("");
    try {
      if (Platform.OS === "android" && GoogleSignin) {
        const { idToken } = await googleSignInNative();
        await handleGoogleSuccess({ idToken });
      } else {
        setGoogleLoading(false);
        await promptAsync();
      }
    } catch (err) {
      const code = err?.code;
      if (
        code === statusCodes.SIGN_IN_CANCELLED ||
        code === statusCodes.IN_PROGRESS
      ) {
        // Silencieux
      } else {
        console.error("[Google Signup]", err);
        setFieldError(err.message || t("login.invalidCredentials"));
      }
      setGoogleLoading(false);
    }
  };

  const handleSignup = async () => {
    setFieldError("");
    const fn = sanitizeText(form.firstName),
      ln = sanitizeText(form.lastName);
    const ad = sanitizeText(form.address),
      em = normalizeEmail(form.email);
    const pw = String(form.password || "");
    if (!fn || !ln || !ad || !em || !pw) {
      setFieldError(t("signup.fillFields"));
      return;
    }
    if (fn.length < 2) { setFieldError(t("signup.firstNameTooShort")); return; }
    if (ln.length < 2) { setFieldError(t("signup.lastNameTooShort")); return; }
    if (ad.length < 5) { setFieldError(t("signup.addressTooShort")); return; }
    if (!EMAIL_REGEX.test(em)) { setFieldError(t("signup.invalidEmail")); return; }
    if (pw.length < 8) { setFieldError(t("signup.passwordTooShort")); return; }
    setLoading(true);
    try {
      await authAPI.register({
        firstName: fn,
        lastName: ln,
        address: ad,
        email: em,
        password: pw,
      });
      await saveLog("Inscription", em);
      Alert.alert(t("common.successTitle"), t("signup.createdMessage"));
      router.replace(AUTH_ROUTE);
    } catch (error) {
      setFieldError(error?.message || t("signup.signupFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <ErrorBox message={fieldError} />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <FieldLabel text={t("signup.lastNameLabel")} isRTL={isRTL} />
          <FieldInput
            placeholder="Ben Ali"
            value={form.lastName}
            onChangeText={set("lastName")}
            icon="person-outline"
            isRTL={isRTL}
          />
        </View>
        <View className="flex-1">
          <FieldLabel text={t("signup.firstNameLabel")} isRTL={isRTL} />
          <FieldInput
            placeholder="Mohamed"
            value={form.firstName}
            onChangeText={set("firstName")}
            icon="person-outline"
            isRTL={isRTL}
          />
        </View>
      </View>
      <FieldLabel text={t("signup.addressLabel")} isRTL={isRTL} />
      <FieldInput
        placeholder="Tunis, Tunisie"
        value={form.address}
        onChangeText={set("address")}
        icon="location-outline"
        isRTL={isRTL}
      />
      <FieldLabel text={t("signup.emailLabel")} isRTL={isRTL} />
      <FieldInput
        placeholder="votre@email.com"
        value={form.email}
        onChangeText={set("email")}
        icon="mail-outline"
        keyboardType="email-address"
        autoCapitalize="none"
        isRTL={isRTL}
      />
      <FieldLabel text={t("signup.passwordLabel")} isRTL={isRTL} />
      <FieldInput
        placeholder="........"
        value={form.password}
        onChangeText={set("password")}
        icon="lock-closed-outline"
        secureTextEntry={!showPassword}
        isPassword
        showPassword={showPassword}
        onTogglePassword={() => setShowPassword((p) => !p)}
        isRTL={isRTL}
        extraStyle={{ marginBottom: 24 }}
      />
      <SubmitButton
        label={loading ? t("signup.signupLoading") : t("common.confirm")}
        onPress={handleSignup}
        disabled={loading}
      />
      <Separator />
      <GoogleButton
        loading={googleLoading}
        onPress={handleGooglePress}
        label={t("common.googleLogin")}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANTS COMMUNS
// ─────────────────────────────────────────────────────────────────────────────
function ErrorBox({ message }) {
  if (!message) return null;
  return (
    <View className="mb-3.5 flex-row items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
      <Ionicons name="alert-circle" size={18} color="#ef4444" />
      <Text className="flex-1 text-[13px] font-medium text-red-600">
        {message}
      </Text>
    </View>
  );
}

function Separator() {
  return (
    <View className="my-3.5 flex-row items-center gap-2.5">
      <View className="h-px flex-1 bg-slate-200" />
      <Text className="text-[13px] font-medium text-slate-400">ou</Text>
      <View className="h-px flex-1 bg-slate-200" />
    </View>
  );
}

function GoogleButton({ loading, onPress, label }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <TouchableOpacity
      className="mb-1 flex-row items-center justify-center rounded-full border-[1.5px] border-slate-200 bg-white px-6 py-[13px]"
      style={loading ? { opacity: 0.55 } : undefined}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color="#EA4335"
          style={{ marginRight: 10 }}
        />
      ) : imgErr ? (
        <View className="mr-2.5 h-5 w-5 items-center justify-center rounded-[2px] bg-white">
          <Text className="text-sm font-bold text-[#4285F4]">G</Text>
        </View>
      ) : (
        <Image
          source={{
            uri: "https://developers.google.com/identity/images/g-logo.png",
          }}
          style={{ width: 20, height: 20, marginRight: 10 }}
          resizeMode="contain"
          onError={() => setImgErr(true)}
        />
      )}
      <Text className="text-sm font-semibold text-slate-700">{label}</Text>
    </TouchableOpacity>
  );
}

function FieldLabel({ text, isRTL }) {
  return (
    <Text
      className="mb-1.5 mt-3.5 text-sm font-medium text-slate-700"
      style={{ textAlign: isRTL ? "right" : "left" }}
    >
      {text}
    </Text>
  );
}

function FieldInput({
  isRTL = false,
  isPassword = false,
  showPassword = false,
  onTogglePassword,
  icon,
  extraStyle = {},
  hasError = false,
  ...props
}) {
  return (
    <View style={extraStyle}>
      {icon && (
        <View
          className="absolute bottom-0 top-0 z-[5] justify-center"
          style={{ [isRTL ? "right" : "left"]: 12 }}
          pointerEvents="none"
        >
          <Ionicons name={icon} size={19} color="#9ca3af" />
        </View>
      )}
      <TextInput
        className="rounded-xl border bg-slate-50 py-[13px] pr-4 text-sm text-slate-900"
        style={{
          textAlign: isRTL ? "right" : "left",
          [isRTL ? "paddingRight" : "paddingLeft"]: icon ? 42 : 16,
          borderColor: hasError ? "#ef4444" : "#e5e7eb",
        }}
        placeholderTextColor="#9ca3af"
        {...props}
      />
      {isPassword && (
        <TouchableOpacity
          className="absolute bottom-0 top-0 justify-center"
          style={{ [isRTL ? "left" : "right"]: 12 }}
          onPress={onTogglePassword}
          activeOpacity={0.7}
        >
          <Ionicons
            name={showPassword ? "eye-off-outline" : "eye-outline"}
            size={19}
            color="#9ca3af"
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

function SubmitButton({ label, onPress, disabled }) {
  return (
    <TouchableOpacity
      className="mb-3 items-center rounded-full bg-green-600 py-[15px]"
      style={{ opacity: disabled ? 0.65 : 1 }}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <Text className="text-base font-bold text-white">{label}</Text>
    </TouchableOpacity>
  );
}