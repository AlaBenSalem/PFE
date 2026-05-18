// app/(admin)/utilisateurs.jsx — responsive web (tableau) + mobile (cartes)
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Modal, Platform, ScrollView, StyleSheet,
  Switch, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { adminAPI } from "@api/admin";
import { AdminShell } from "@components/AdminShell";
import { useLanguage } from "@context/LanguageContext";

const IS_WEB = Platform.OS === "web";

const C = {
  green: "#22c55e", greenDark: "#16a34a", greenSoft: "#e8f8ed",
  red: "#ef4444",   redSoft: "#fee2e2",
  blue: "#3b82f6",  blueSoft: "#eff6ff",
  text: "#111827",  muted: "#6b7280",
  border: "#edf1f0",surface: "#ffffff", bg: "#f7f9f8",
};

function uid(u) { return String(u?._id || u?.id || ""); }
function initials(fn, ln) {
  return (((fn||"")[0]||"").toUpperCase()+((ln||"")[0]||"").toUpperCase()) || "?";
}
function fmtDate(v, language) {
  if (!v) return "—";
  try {
    const locale = language === "ar" ? "ar-TN" : language === "tr" ? "tr-TR" : language === "en" ? "en-GB" : "fr-FR";
    return new Date(v).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
  } catch { return "—"; }
}

// ── FormInput ─────────────────────────────────────────────────────────────────
function FormInput({ isPassword=false, showPassword=false, onTogglePassword, icon, style, ...props }) {
  return (
    <View style={[s.inputRow, style]}>
      {icon && <Ionicons name={icon} size={17} color="#9ca3af" style={{ marginHorizontal: 12, flexShrink: 0 }} />}
      <TextInput
        style={[s.inputText, !icon && { paddingLeft: 14 }]}
        placeholderTextColor="#9ca3af"
        {...props}
      />
      {isPassword && (
        <TouchableOpacity onPress={onTogglePassword} activeOpacity={0.7} style={{ paddingHorizontal: 12 }} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
          <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={17} color="#9ca3af" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, type = "success", visible }) {
  if (!visible) return null;
  const bg   = type === "success" ? "#16a34a" : type === "error" ? "#ef4444" : "#f59e0b";
  const icon = type === "success" ? "checkmark-circle" : type === "error" ? "close-circle" : "information-circle";
  return (
    <View style={{ position:"absolute", top:16, right:16, zIndex:9999, backgroundColor:bg, borderRadius:12, paddingHorizontal:14, paddingVertical:10, flexDirection:"row", alignItems:"center", gap:8, maxWidth:280, shadowColor:"#000", shadowOffset:{width:0,height:4}, shadowOpacity:0.2, shadowRadius:8, elevation:10 }}>
      <Ionicons name={icon} size={16} color="#fff" />
      <Text style={{ color:"#fff", fontSize:13, fontWeight:"600", flexShrink:1 }}>{message}</Text>
    </View>
  );
}

// ── ConfirmModal ──────────────────────────────────────────────────────────────
function ConfirmModal({ visible, title, message, onConfirm, onCancel, danger=true }) {
  const { t } = useLanguage();
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <SafeAreaView style={{ flex:1, backgroundColor:"rgba(0,0,0,0.4)", alignItems:"center", justifyContent:"center", paddingHorizontal:24 }} edges={["top","left","right","bottom"]}>
        <View style={{ backgroundColor:"#fff", borderRadius:20, padding:28, width:"100%", maxWidth:400, shadowColor:"#000", shadowOffset:{width:0,height:8}, shadowOpacity:0.2, shadowRadius:24, elevation:12 }}>
          <View style={{ width:52, height:52, borderRadius:26, backgroundColor:danger?"#fef2f2":"#eff6ff", alignItems:"center", justifyContent:"center", alignSelf:"center", marginBottom:16 }}>
            <Ionicons name={danger?"trash-outline":"help-circle-outline"} size={26} color={danger?"#ef4444":"#3b82f6"} />
          </View>
          <Text style={{ fontSize:17, fontWeight:"700", color:"#111827", textAlign:"center", marginBottom:8 }}>{title}</Text>
          <Text style={{ fontSize:14, color:"#6b7280", textAlign:"center", marginBottom:24, lineHeight:20 }}>{message}</Text>
          <View style={{ flexDirection:"row", gap:10 }}>
            <TouchableOpacity style={{ flex:1, paddingVertical:13, borderRadius:12, borderWidth:1, borderColor:"#e5e7eb", alignItems:"center", backgroundColor:"#f9fafb" }} onPress={onCancel} activeOpacity={0.8}>
              <Text style={{ fontSize:14, fontWeight:"600", color:"#374151" }}>{t("admin.userCancelBtn")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex:1, paddingVertical:13, borderRadius:12, alignItems:"center", backgroundColor:danger?"#ef4444":"#3b82f6" }} onPress={onConfirm} activeOpacity={0.85}>
              <Text style={{ fontSize:14, fontWeight:"700", color:"#fff" }}>{danger?t("admin.userDeleteBtn"):t("common.confirm")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ── UserFormModal ─────────────────────────────────────────────────────────────
const EMPTY_FORM = { firstName:"", lastName:"", address:"", email:"", password:"", isActive:true };

function UserFormModal({ visible, user, onClose, onSave }) {
  const { t } = useLanguage();
  const isEdit = !!user;
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (visible) {
      setErr(""); setShowPwd(false);
      setForm(user ? { firstName:user.firstName||"", lastName:user.lastName||"", address:user.address||"", email:user.email||"", password:"", isActive:user.isActive!==false } : EMPTY_FORM);
    }
  }, [visible, user]);

  const set = k => v => { setForm(p => ({ ...p, [k]: v })); setErr(""); };

  const handleSave = async () => {
    setErr("");
    const { firstName, lastName, address, email, password, isActive } = form;
    if (!firstName.trim()) { setErr(t("admin.userErrFirstName")); return; }
    if (!lastName.trim())  { setErr(t("admin.userErrLastName")); return; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setErr(t("admin.userErrEmail")); return; }
    if (!isEdit && password.length < 8) { setErr(t("admin.userErrPassword")); return; }
    if (isEdit && password && password.length < 8) { setErr(t("admin.userErrPassword")); return; }

    setSaving(true);
    try {
      const body = { firstName:firstName.trim(), lastName:lastName.trim(), address:address.trim(), email:email.trim().toLowerCase(), isActive };
      if (password) body.password = password;
      let result;
      if (isEdit) {
        result = await adminAPI.updateUser(uid(user), body);
      } else {
        body.password = password;
        result = await adminAPI.createUser(body);
      }
      const saved = result?.user || result?.data || result;
      onSave(saved, isEdit);
      onClose();
    } catch (e) {
      setErr(e?.message || t("admin.userErrServer"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex:1, backgroundColor:"rgba(0,0,0,0.45)", justifyContent:"flex-end" }} edges={["bottom","left","right"]}>
        <View style={{ backgroundColor:"#fff", borderTopLeftRadius:24, borderTopRightRadius:24, maxHeight:"92%" }}>
          {/* Handle */}
          <View style={{ width:40, height:4, backgroundColor:"#e2e8f0", borderRadius:2, alignSelf:"center", marginTop:12, marginBottom:4 }} />
          {/* Header */}
          <View style={{ flexDirection:"row", alignItems:"center", paddingHorizontal:20, paddingVertical:14, borderBottomWidth:1, borderBottomColor:C.border }}>
            <View style={{ width:46, height:46, borderRadius:14, backgroundColor:C.greenSoft, alignItems:"center", justifyContent:"center" }}>
              <Ionicons name={isEdit?"pencil":"person-add-outline"} size={20} color={C.greenDark} />
            </View>
            <View style={{ flex:1, marginLeft:12 }}>
              <Text style={{ fontSize:15, fontWeight:"700", color:C.text }}>{isEdit ? t("admin.userEdit") : t("admin.userCreate")}</Text>
              {isEdit && <Text style={{ fontSize:12, color:C.muted }}>{user?.email}</Text>}
            </View>
            <TouchableOpacity onPress={onClose} style={{ width:36, height:36, borderRadius:11, backgroundColor:"#f1f5f9", alignItems:"center", justifyContent:"center" }}>
              <Ionicons name="close" size={18} color={C.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding:20, gap:14 }} keyboardShouldPersistTaps="handled">
            {/* Prénom */}
            <View>
              <Text style={s.fieldLabel}>{t("admin.userFieldFirstName")} *</Text>
              <FormInput icon="person-outline" value={form.firstName} onChangeText={set("firstName")} placeholder={t("admin.userFieldFirstName")} autoCapitalize="words" />
            </View>
            {/* Nom */}
            <View>
              <Text style={s.fieldLabel}>{t("admin.userFieldLastName")} *</Text>
              <FormInput icon="person-outline" value={form.lastName} onChangeText={set("lastName")} placeholder={t("admin.userFieldLastName")} autoCapitalize="words" />
            </View>
            {/* Adresse */}
            <View>
              <Text style={s.fieldLabel}>{t("admin.userFieldAddress")}</Text>
              <FormInput icon="location-outline" value={form.address} onChangeText={set("address")} placeholder={t("admin.userFieldAddress")} />
            </View>
            {/* Email */}
            <View>
              <Text style={s.fieldLabel}>{t("admin.userFieldEmail")} *</Text>
              {isEdit ? (
                <View style={[s.inputRow, { backgroundColor:"#f1f5f9" }]}>
                  <Ionicons name="mail-outline" size={17} color="#9ca3af" style={{ marginHorizontal:12 }} />
                  <Text style={[s.inputText, { color:C.muted }]}>{form.email}</Text>
                  <Ionicons name="lock-closed-outline" size={14} color="#9ca3af" style={{ marginRight:12 }} />
                </View>
              ) : (
                <FormInput icon="mail-outline" value={form.email} onChangeText={set("email")} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
              )}
            </View>
            {/* Mot de passe */}
            <View>
              <Text style={s.fieldLabel}>
                {t("admin.userFieldPassword")} {isEdit ? <Text style={{ color:C.muted, fontSize:12 }}>{t("admin.userPasswordOptional")}</Text> : "*"}
              </Text>
              <FormInput isPassword icon="lock-closed-outline" value={form.password} onChangeText={set("password")} placeholder={isEdit ? t("admin.userPasswordNew") : "••••••••"} secureTextEntry={!showPwd} showPassword={showPwd} onTogglePassword={() => setShowPwd(p => !p)} />
              <Text style={{ fontSize:11, color:C.muted, marginTop:4 }}>{t("admin.userPasswordMin")}</Text>
            </View>
            {/* Statut */}
            <View style={s.switchRow}>
              <View style={{ flex:1 }}>
                <Text style={{ fontSize:14, fontWeight:"700", color:C.text }}>{t("admin.userAccountActive")}</Text>
                <Text style={{ fontSize:12, color:C.muted, marginTop:2 }}>
                  {form.isActive ? t("admin.userAccountActiveDesc") : t("admin.userAccountInactiveDesc")}
                </Text>
              </View>
              <Switch value={form.isActive} onValueChange={set("isActive")} trackColor={{ false:"#e5e7eb", true:C.greenSoft }} thumbColor={form.isActive ? C.greenDark : "#9ca3af"} />
            </View>

            {err ? (
              <View style={s.errBox}>
                <Ionicons name="alert-circle" size={16} color="#dc2626" />
                <Text style={s.errText}>{err}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: saving ? "#86efac" : C.greenDark }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.9}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name={isEdit?"save-outline":"person-add-outline"} size={18} color="#fff" />
              }
              <Text style={s.saveBtnText}>
                {saving ? "..." : isEdit ? t("admin.userSaveEdit") : t("admin.userSaveCreate")}
              </Text>
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ── UserDetailModal ───────────────────────────────────────────────────────────
function UserDetailModal({ user, visible, onClose, onEdit, onDelete, onToggle, allCultures, toggling }) {
  const { t, language } = useLanguage();
  const [tab, setTab] = useState("profile");
  const [irrigStats, setIrrigStats] = useState(null);
  const [irrigLoading, setIrrigLoading] = useState(false);

  useEffect(() => {
    if (!visible || !user) return;
    setTab("profile");
    setIrrigStats(null);
  }, [visible, user?._id]);

  useEffect(() => {
    if (tab !== "irrigations" || !user) return;
    const load = async () => {
      setIrrigLoading(true);
      try {
        const res = await adminAPI.getUserStats(user._id || user.id);
        if (res?.success) setIrrigStats(res.data);
      } catch {}
      finally { setIrrigLoading(false); }
    };
    load();
  }, [tab, user?._id]);

  if (!visible || !user) return null;

  const isActive = user.isActive !== false;
  const fullName = `${user.firstName||""} ${user.lastName||""}`.trim();
  const userCultures = allCultures.filter(c => String(c.userId?._id||c.userId) === uid(user));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex:1, backgroundColor:"rgba(0,0,0,0.45)", justifyContent:"flex-end" }} edges={["bottom","left","right"]}>
        <View style={{ backgroundColor:"#fff", borderTopLeftRadius:24, borderTopRightRadius:24, maxHeight:"90%" }}>
          <View style={{ width:40, height:4, backgroundColor:"#e2e8f0", borderRadius:2, alignSelf:"center", marginTop:12, marginBottom:4 }} />
          {/* Header */}
          <View style={{ flexDirection:"row", alignItems:"center", paddingHorizontal:20, paddingVertical:14, borderBottomWidth:1, borderBottomColor:C.border }}>
            <View style={{ width:46, height:46, borderRadius:14, backgroundColor:C.greenSoft, alignItems:"center", justifyContent:"center" }}>
              <Text style={{ fontSize:17, fontWeight:"700", color:C.greenDark }}>{initials(user.firstName, user.lastName)}</Text>
            </View>
            <View style={{ flex:1, marginLeft:12 }}>
              <Text style={{ fontSize:15, fontWeight:"700", color:C.text }} numberOfLines={1}>{fullName||"—"}</Text>
              <Text style={{ fontSize:12, color:C.muted }} numberOfLines={1}>{user.email}</Text>
            </View>
            <View style={{ flexDirection:"row", gap:8 }}>
              <TouchableOpacity style={{ width:36, height:36, borderRadius:11, backgroundColor:C.blueSoft, alignItems:"center", justifyContent:"center" }} onPress={() => { onClose(); onEdit(user); }} activeOpacity={0.8}>
                <Ionicons name="pencil" size={16} color={C.blue} />
              </TouchableOpacity>
              <TouchableOpacity style={{ width:36, height:36, borderRadius:11, backgroundColor:C.redSoft, alignItems:"center", justifyContent:"center" }} onPress={() => { onClose(); onDelete(user); }} activeOpacity={0.8}>
                <Ionicons name="trash-outline" size={16} color={C.red} />
              </TouchableOpacity>
              <TouchableOpacity style={{ width:36, height:36, borderRadius:11, backgroundColor:"#f1f5f9", alignItems:"center", justifyContent:"center" }} onPress={onClose} activeOpacity={0.8}>
                <Ionicons name="close" size={18} color={C.muted} />
              </TouchableOpacity>
            </View>
          </View>
          {/* Onglets */}
          <View style={{ flexDirection:"row", borderBottomWidth:1, borderBottomColor:C.border }}>
            {[
              { key:"profile",    icon:"person-outline",  label: t("admin.userTabProfile") },
              { key:"cultures",   icon:"leaf-outline",    label: `${t("admin.userTabCultures")} (${userCultures.length})` },
              { key:"irrigations",icon:"water-outline",   label: t("admin.cardIrrigations") || "Irrigations" },
            ].map(tk => (
              <TouchableOpacity key={tk.key} style={[{ flex:1, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:4, paddingVertical:13, borderBottomWidth:2, borderBottomColor: tk.key===tab ? C.greenDark : "transparent" }]} onPress={() => setTab(tk.key)} activeOpacity={0.8}>
                <Ionicons name={tk.icon} size={15} color={tk.key===tab?C.greenDark:C.muted} />
                <Text style={{ fontSize:11, fontWeight:"600", color:tk.key===tab?C.greenDark:C.muted }} numberOfLines={1}>
                  {tk.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView contentContainerStyle={{ padding:18, gap:10 }} showsVerticalScrollIndicator={false}>
            {tab === "irrigations" ? (
              irrigLoading ? (
                <View style={{ alignItems:"center", paddingVertical:32 }}>
                  <ActivityIndicator size="large" color={C.greenDark} />
                </View>
              ) : (
                <View style={{ gap:12 }}>
                  <View style={{ flexDirection:"row", gap:10 }}>
                    <View style={{ flex:1, backgroundColor:"#eff6ff", borderRadius:16, padding:16, alignItems:"center" }}>
                      <Ionicons name="water" size={28} color="#3b82f6" />
                      <Text style={{ fontSize:28, fontWeight:"800", color:"#3b82f6", marginTop:8 }}>{irrigStats?.irrigationCount ?? "—"}</Text>
                      <Text style={{ fontSize:12, color:"#60a5fa", fontWeight:"600", marginTop:4 }}>{t("admin.cardIrrigations") || "Irrigations"}</Text>
                    </View>
                    <View style={{ flex:1, backgroundColor:"#f0fdf4", borderRadius:16, padding:16, alignItems:"center" }}>
                      <Ionicons name="analytics" size={28} color={C.greenDark} />
                      <Text style={{ fontSize:22, fontWeight:"800", color:C.greenDark, marginTop:8 }}>
                        {irrigStats ? ((irrigStats.totalVolume || 0) / 1000).toFixed(2) : "—"}
                      </Text>
                      <Text style={{ fontSize:12, color:"#4ade80", fontWeight:"600", marginTop:4 }}>m³ {t("admin.totalVolume") || "total"}</Text>
                    </View>
                  </View>
                  {!irrigStats && (
                    <View style={{ alignItems:"center", paddingVertical:24 }}>
                      <Ionicons name="water-outline" size={40} color="#d1d5db" />
                      <Text style={{ fontSize:14, color:C.muted, marginTop:8 }}>{t("calendar.noData")}</Text>
                    </View>
                  )}
                </View>
              )
            ) : tab === "profile" ? (
              <>
                {[
                  { icon:"person-outline",   label:t("admin.userFullName"),   value:fullName||"—" },
                  { icon:"mail-outline",      label:t("admin.tableEmail"),     value:user.email||"—" },
                  { icon:"location-outline",  label:t("admin.userAddress"),    value:user.address||"—" },
                  { icon:"calendar-outline",  label:t("admin.userRegistered"), value:fmtDate(user.createdAt, language) },
                ].map((row, i) => (
                  <View key={i} style={{ flexDirection:"row", alignItems:"center", gap:10, backgroundColor:"#f8fafc", borderRadius:12, padding:12 }}>
                    <View style={{ width:32, height:32, borderRadius:10, backgroundColor:C.greenSoft, alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <Ionicons name={row.icon} size={16} color={C.greenDark} />
                    </View>
                    <Text style={{ flex:1, fontSize:13, color:C.muted, fontWeight:"600" }}>{row.label}</Text>
                    <Text style={{ fontSize:13, fontWeight:"700", color:C.text, textAlign:"right", flexShrink:1, maxWidth:"50%" }} numberOfLines={2}>{row.value}</Text>
                  </View>
                ))}
                {/* Statut + toggle */}
                <View style={{ backgroundColor:"#f8fafc", borderRadius:12, padding:12 }}>
                  <Text style={{ fontSize:13, color:C.muted, fontWeight:"600", marginBottom:8 }}>{t("admin.userAccountStatus")}</Text>
                  <Text style={{ fontSize:14, color: isActive ? C.greenDark : C.red, fontWeight:"700", marginBottom:12 }}>
                    {isActive ? t("admin.userStatusActive") : t("admin.userStatusInactive")}
                  </Text>
                  <TouchableOpacity
                    style={{ paddingHorizontal:14, paddingVertical:9, borderRadius:10, backgroundColor: isActive ? C.redSoft : C.greenSoft, flexDirection:"row", alignItems:"center", gap:6, alignSelf:"flex-start" }}
                    onPress={() => onToggle(user)}
                    disabled={toggling}
                    activeOpacity={0.8}
                  >
                    {toggling
                      ? <ActivityIndicator size="small" color={isActive ? C.red : C.greenDark} />
                      : <Ionicons name={isActive?"person-remove-outline":"person-add-outline"} size={16} color={isActive?C.red:C.greenDark} />
                    }
                    <Text style={{ fontSize:13, fontWeight:"700", color: isActive?C.red:C.greenDark }}>
                      {isActive ? t("admin.userDeactivate") : t("admin.userActivate")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              userCultures.length === 0 ? (
                <View style={{ alignItems:"center", paddingVertical:32, gap:8 }}>
                  <MaterialCommunityIcons name="sprout-outline" size={40} color="#d1d5db" />
                  <Text style={{ fontSize:14, fontWeight:"700", color:C.muted }}>{t("admin.userNoCultures")}</Text>
                  <Text style={{ fontSize:13, color:C.muted, textAlign:"center" }}>{t("admin.userNoCulturesDesc")}</Text>
                </View>
              ) : (
                userCultures.map((c, i) => (
                  <View key={i} style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"flex-start", backgroundColor:"#f8fafc", borderRadius:14, padding:14, borderWidth:1, borderColor:C.border }}>
                    <View style={{ flexDirection:"row", alignItems:"flex-start", gap:10, flex:1 }}>
                      <View style={{ width:34, height:34, borderRadius:10, backgroundColor:C.greenSoft, alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        <MaterialCommunityIcons name="sprout" size={18} color={C.greenDark} />
                      </View>
                      <View style={{ flex:1 }}>
                        <Text style={{ fontSize:14, fontWeight:"700", color:C.text }}>{c.nom}</Text>
                        <Text style={{ fontSize:11, color:C.muted, marginTop:2 }}>{c.variete} · {c.parcelle}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize:12, color:C.greenDark, fontWeight:"700" }}>{c.surface} m²</Text>
                  </View>
                ))
              )
            )}
            <View style={{ height:24 }} />
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ── UserCard (mobile) ─────────────────────────────────────────────────────────
function UserCard({ user, cultures, language, onView, onEdit, onDelete, onToggle, isDeleting, isToggling, t }) {
  const isActive = user.isActive !== false;
  const fullName = `${user.firstName||""} ${user.lastName||""}`.trim();
  const nbCult   = cultures.filter(c => String(c.userId?._id||c.userId) === uid(user)).length;

  return (
    <View style={s.card}>
      <TouchableOpacity style={s.cardMain} onPress={onView} activeOpacity={0.8}>
        <View style={s.cardAvatar}>
          <Text style={s.cardAvatarText}>{initials(user.firstName, user.lastName)}</Text>
        </View>
        <View style={{ flex:1 }}>
          <Text style={s.cardName} numberOfLines={1}>{fullName||"—"}</Text>
          <Text style={s.cardEmail} numberOfLines={1}>{user.email}</Text>
          <View style={{ flexDirection:"row", gap:6, marginTop:4, flexWrap:"wrap" }}>
            <View style={[s.statusBadge, isActive ? s.statusOn : s.statusOff]}>
              <Text style={[s.statusText, { color: isActive ? C.greenDark : C.red }]}>
                {isActive ? t("admin.userActive_label") : t("admin.userInactive_label")}
              </Text>
            </View>
            {nbCult > 0 && (
              <View style={{ backgroundColor:"#f0fdf4", paddingHorizontal:7, paddingVertical:3, borderRadius:8 }}>
                <Text style={{ fontSize:10, color:C.greenDark, fontWeight:"600" }}>🌿 {nbCult}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
      <View style={s.cardActions}>
        <TouchableOpacity style={[s.actionBtn, { backgroundColor:C.blueSoft }]} onPress={onEdit} activeOpacity={0.8}>
          <Ionicons name="pencil" size={14} color={C.blue} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, { backgroundColor: isActive?C.redSoft:C.greenSoft }]} onPress={onToggle} disabled={isToggling} activeOpacity={0.8}>
          {isToggling
            ? <ActivityIndicator size="small" color={isActive?C.red:C.greenDark} style={{ width:14, height:14 }} />
            : <Ionicons name={isActive?"person-remove-outline":"person-add-outline"} size={14} color={isActive?C.red:C.greenDark} />
          }
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, { backgroundColor:C.redSoft }]} onPress={onDelete} disabled={isDeleting} activeOpacity={0.8}>
          {isDeleting
            ? <ActivityIndicator size="small" color={C.red} style={{ width:14, height:14 }} />
            : <Ionicons name="trash-outline" size={14} color={C.red} />
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── PAGE PRINCIPALE ───────────────────────────────────────────────────────────
export default function AdminUtilisateursPage() {
  const { t, language } = useLanguage();
  const [users,      setUsers]      = useState([]);
  const [cultures,   setCultures]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [search,     setSearch]     = useState("");

  const [detailUser, setDetailUser] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [editUser,   setEditUser]   = useState(null);
  const [showForm,   setShowForm]   = useState(false);
  const [confirm,    setConfirm]    = useState({ visible:false, user:null });
  const [toast,      setToast]      = useState({ visible:false, message:"", type:"success" });
  const toastTimer = useRef(null);

  const showToast = useCallback((message, type="success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible:true, message, type });
    toastTimer.current = setTimeout(() => setToast(p => ({ ...p, visible:false })), 3000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersResult, culturesRes] = await Promise.all([adminAPI.listUsers(), adminAPI.listCultures()]);
      setUsers(usersResult?.users || []);
      if (culturesRes?.success) setCultures(culturesRes.data || []);
    } catch (e) {
      showToast(e?.message || t("admin.userLoadError"), "error");
    } finally { setLoading(false); }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditUser(null); setShowForm(true); };
  const openEdit   = (user) => { setEditUser(user); setShowForm(true); };

  const handleSaved = useCallback((savedUser, isEdit) => {
    if (!savedUser) return;
    const normalize = u => ({ ...u, id:u.id||u._id, _id:u._id||u.id });
    if (isEdit) {
      setUsers(prev => prev.map(u => uid(u)===uid(savedUser) ? { ...u, ...normalize(savedUser) } : u));
      if (detailUser && uid(detailUser)===uid(savedUser)) setDetailUser(u => ({ ...u, ...normalize(savedUser) }));
    } else {
      setUsers(prev => [normalize(savedUser), ...prev]);
    }
    showToast(isEdit ? t("admin.userUpdatedSuccess") : t("admin.userCreatedSuccess"), "success");
  }, [detailUser, t]);

  const handleToggle = useCallback(async (user) => {
    const id = uid(user);
    setTogglingId(id);
    try {
      const res = await adminAPI.toggleUserStatus(id);
      const newStatus = res?.isActive ?? !user.isActive;
      setUsers(prev => prev.map(u => uid(u)===id ? { ...u, isActive:newStatus } : u));
      if (detailUser && uid(detailUser)===id) setDetailUser(u => ({ ...u, isActive:newStatus }));
    } catch (e) {
      showToast(e?.message || t("admin.userStatusError"), "error");
    } finally { setTogglingId(null); }
  }, [detailUser, t]);

  const handleDelete = useCallback((user) => { setConfirm({ visible:true, user }); }, []);

  const doConfirmedDelete = useCallback(async () => {
    const user = confirm.user;
    if (!user) return;
    const name = `${user.firstName||""} ${user.lastName||""}`.trim() || user.email;
    const id   = uid(user);
    setConfirm({ visible:false, user:null });
    setDeletingId(id);
    try {
      await adminAPI.deleteUser(id);
      setUsers(prev => prev.filter(u => uid(u)!==id));
      if (detailUser && uid(detailUser)===id) { setShowDetail(false); setDetailUser(null); }
      showToast(`${name} ${t("admin.userDeletedSuccess")}`, "success");
    } catch (e) {
      showToast(e?.message || t("admin.userDeleteError"), "error");
    } finally { setDeletingId(null); }
  }, [confirm.user, detailUser, showToast, t]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => `${u.firstName||""} ${u.lastName||""} ${u.email||""}`.toLowerCase().includes(q));
  }, [users, search]);

  const activeCount   = users.filter(u => u.isActive !== false).length;
  const inactiveCount = users.length - activeCount;

  return (
    <AdminShell activeKey="utilisateurs" title={t("admin.usersTitle")} onRefresh={load} loading={loading}>

      {/* Stats */}
      <View style={s.statRow}>
        {[
          { label:t("admin.userTotal"),    value:users.length,  bg:C.greenSoft, icon:"people-outline",          color:C.greenDark },
          { label:t("admin.userActive"),   value:activeCount,   bg:"#ecfeff",   icon:"checkmark-circle-outline", color:"#0ea5e9"   },
          { label:t("admin.userInactive"), value:inactiveCount, bg:C.redSoft,   icon:"person-remove-outline",    color:C.red       },
        ].map((stat, i) => (
          <View key={i} style={s.statCard}>
            <View style={s.statHeader}>
              <Text style={s.statLabel}>{stat.label}</Text>
              <View style={[s.iconBadge, { backgroundColor:stat.bg }]}>
                <Ionicons name={stat.icon} size={18} color={stat.color} />
              </View>
            </View>
            <Text style={s.statValue}>{stat.value}</Text>
          </View>
        ))}
      </View>

      {/* Barre recherche + créer */}
      <View style={{ flexDirection:"row", gap:10, marginBottom:12 }}>
        <View style={[s.searchBox, { flex:1 }]}>
          <Ionicons name="search" size={15} color={C.muted} />
          <TextInput
            placeholder={t("admin.userSearch")}
            placeholderTextColor={C.muted}
            value={search}
            onChangeText={setSearch}
            style={s.searchInput}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top:6,bottom:6,left:6,right:6 }}>
              <Ionicons name="close-circle" size={15} color={C.muted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={s.createBtn} onPress={openCreate} activeOpacity={0.85}>
          <Ionicons name="add" size={20} color="#fff" />
          {IS_WEB && <Text style={s.createBtnText}>{t("admin.userNew")}</Text>}
        </TouchableOpacity>
      </View>

      <Text style={s.count}>{filtered.length} {t("admin.userCount")}</Text>

      {/* ── WEB : tableau ── */}
      {IS_WEB ? (
        <View style={s.panel}>
          <View style={s.thead}>
            <Text style={[s.th, { flex:2.2 }]}>{t("admin.colName")}</Text>
            <Text style={[s.th, { flex:2 }]}>{t("admin.colEmail")}</Text>
            <Text style={[s.th, { flex:0.9 }]}>{t("admin.colStatus")}</Text>
            <Text style={[s.th, { flex:1, textAlign:"right" }]}>{t("admin.colActions")}</Text>
          </View>
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="people-outline" size={42} color="#d1d5db" />
              <Text style={s.emptyText}>{t("admin.userNone")}</Text>
            </View>
          ) : (
            filtered.map(user => {
              const id       = uid(user);
              const fullName = `${user.firstName||""} ${user.lastName||""}`.trim();
              const isActive = user.isActive !== false;
              const isDeleting = deletingId === id;
              const isToggling = togglingId === id;
              const nbCult = cultures.filter(c => String(c.userId?._id||c.userId) === id).length;

              return (
                <View key={id} style={s.row}>
                  <TouchableOpacity style={[s.nameCell, { flex:2.2 }]} onPress={() => { setDetailUser(user); setShowDetail(true); }} activeOpacity={0.7}>
                    <View style={s.avatar}><Text style={s.avatarText}>{initials(user.firstName, user.lastName)}</Text></View>
                    <View style={{ flex:1 }}>
                      <Text style={s.rowName} numberOfLines={1}>{fullName||"—"}</Text>
                      <Text style={s.rowSub}>{fmtDate(user.createdAt, language)}</Text>
                      {nbCult > 0 && <Text style={s.cultBadge}>🌿 {nbCult} {t("admin.userTabCultures").toLowerCase()}</Text>}
                    </View>
                  </TouchableOpacity>
                  <Text style={[s.rowEmail, { flex:2 }]} numberOfLines={1}>{user.email}</Text>
                  <View style={{ flex:0.9 }}>
                    <View style={[s.badge, isActive?s.badgeOn:s.badgeOff]}>
                      <Text style={[s.badgeText, { color: isActive?C.greenDark:C.red }]}>
                        {isActive ? t("admin.userActive_label") : t("admin.userInactive_label")}
                      </Text>
                    </View>
                  </View>
                  <View style={[s.actionsCell, { flex:1 }]}>
                    <TouchableOpacity style={s.btnEye} activeOpacity={0.7} onPress={() => { setDetailUser(user); setShowDetail(true); }} hitSlop={{ top:5,bottom:5,left:5,right:5 }}>
                      <Ionicons name="eye-outline" size={15} color={C.greenDark} />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.btnEdit} activeOpacity={0.7} onPress={() => openEdit(user)} hitSlop={{ top:5,bottom:5,left:5,right:5 }}>
                      <Ionicons name="pencil" size={14} color={C.blue} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.btnDel, isDeleting && { opacity:0.4 }]} activeOpacity={0.7} onPress={() => handleDelete(user)} disabled={isDeleting} hitSlop={{ top:5,bottom:5,left:5,right:5 }}>
                      {isDeleting ? <ActivityIndicator size="small" color={C.red} style={{ width:15,height:15 }} /> : <Ionicons name="trash-outline" size={15} color={C.red} />}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      ) : (
        /* ── MOBILE : cartes ── */
        <View style={{ gap:10 }}>
          {filtered.length === 0 ? (
            <View style={[s.empty, { backgroundColor:"#fff", borderRadius:16, padding:32 }]}>
              <Ionicons name="people-outline" size={42} color="#d1d5db" />
              <Text style={s.emptyText}>{t("admin.userNone")}</Text>
            </View>
          ) : (
            filtered.map(user => (
              <UserCard
                key={uid(user)}
                user={user}
                cultures={cultures}
                language={language}
                t={t}
                onView={() => { setDetailUser(user); setShowDetail(true); }}
                onEdit={() => openEdit(user)}
                onDelete={() => handleDelete(user)}
                onToggle={() => handleToggle(user)}
                isDeleting={deletingId === uid(user)}
                isToggling={togglingId === uid(user)}
              />
            ))
          )}
        </View>
      )}

      <UserDetailModal
        user={detailUser} visible={showDetail}
        onClose={() => { setShowDetail(false); setDetailUser(null); }}
        onEdit={openEdit} onDelete={handleDelete} onToggle={handleToggle}
        allCultures={cultures} toggling={togglingId === uid(detailUser)}
      />
      <UserFormModal visible={showForm} user={editUser} onClose={() => setShowForm(false)} onSave={handleSaved} />
      <ConfirmModal
        visible={confirm.visible}
        title={t("admin.userDeleteTitle")}
        message={`${t("admin.userDeleteConfirm")}\n\n${t("admin.userDeleteIrreversible")}`}
        onConfirm={doConfirmedDelete}
        onCancel={() => setConfirm({ visible:false, user:null })}
        danger
      />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} />
    </AdminShell>
  );
}

const s = StyleSheet.create({
  statRow:      { flexDirection:"row", gap:10, marginBottom:14 },
  statCard:     { flex:1, backgroundColor:C.surface, borderRadius:14, padding:12, borderWidth:1, borderColor:C.border },
  statHeader:   { flexDirection:"row", justifyContent:"space-between", alignItems:"flex-start" },
  statLabel:    { fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:0.5, flexShrink:1 },
  statValue:    { marginTop:6, fontSize:24, fontWeight:"700", color:C.text },
  iconBadge:    { width:32, height:32, borderRadius:10, alignItems:"center", justifyContent:"center", flexShrink:0 },
  panel:        { backgroundColor:C.surface, borderRadius:16, padding:14, borderWidth:1, borderColor:C.border },
  searchBox:    { flexDirection:"row", alignItems:"center", backgroundColor:"#f8fafc", borderRadius:12, borderWidth:1, borderColor:C.border, paddingHorizontal:12, height:42, gap:8 },
  searchInput:  { flex:1, fontSize:13, color:C.text },
  createBtn:    { flexDirection:"row", alignItems:"center", gap:4, backgroundColor:C.greenDark, paddingHorizontal:14, height:42, borderRadius:12 },
  createBtnText:{ color:"#fff", fontSize:13, fontWeight:"700" },
  count:        { fontSize:12, color:C.muted, marginBottom:8 },
  thead:        { flexDirection:"row", paddingVertical:8, borderBottomWidth:1, borderBottomColor:C.border },
  th:           { fontSize:10, textTransform:"uppercase", letterSpacing:0.5, color:C.muted, fontWeight:"700" },
  row:          { flexDirection:"row", alignItems:"center", paddingVertical:11, borderBottomWidth:1, borderBottomColor:C.border },
  nameCell:     { flexDirection:"row", alignItems:"center", gap:8 },
  avatar:       { width:36, height:36, borderRadius:12, backgroundColor:C.greenSoft, alignItems:"center", justifyContent:"center", flexShrink:0 },
  avatarText:   { fontSize:13, fontWeight:"700", color:C.greenDark },
  rowName:      { fontSize:13, fontWeight:"700", color:C.text },
  rowSub:       { fontSize:11, color:C.muted, marginTop:2 },
  rowEmail:     { fontSize:11, color:C.muted },
  cultBadge:    { fontSize:10, color:C.greenDark, fontWeight:"600", marginTop:3 },
  actionsCell:  { flexDirection:"row", gap:6, justifyContent:"flex-end", alignItems:"center" },
  btnEye:       { width:30, height:30, borderRadius:9, backgroundColor:C.greenSoft, alignItems:"center", justifyContent:"center" },
  btnEdit:      { width:30, height:30, borderRadius:9, backgroundColor:C.blueSoft, alignItems:"center", justifyContent:"center" },
  btnDel:       { width:30, height:30, borderRadius:9, backgroundColor:C.redSoft, alignItems:"center", justifyContent:"center" },
  badge:        { paddingHorizontal:8, paddingVertical:3, borderRadius:8, alignSelf:"flex-start" },
  badgeOn:      { backgroundColor:C.greenSoft },
  badgeOff:     { backgroundColor:C.redSoft },
  badgeText:    { fontSize:11, fontWeight:"700" },
  empty:        { alignItems:"center", paddingVertical:32, gap:8 },
  emptyText:    { fontSize:14, color:C.muted, fontWeight:"600" },
  // Mobile card
  card:         { backgroundColor:C.surface, borderRadius:14, padding:14, borderWidth:1, borderColor:C.border, flexDirection:"row", alignItems:"center", gap:10 },
  cardMain:     { flex:1, flexDirection:"row", alignItems:"center", gap:10 },
  cardAvatar:   { width:44, height:44, borderRadius:14, backgroundColor:C.greenSoft, alignItems:"center", justifyContent:"center", flexShrink:0 },
  cardAvatarText:{ fontSize:15, fontWeight:"700", color:C.greenDark },
  cardName:     { fontSize:14, fontWeight:"700", color:C.text },
  cardEmail:    { fontSize:11, color:C.muted, marginTop:2 },
  statusBadge:  { paddingHorizontal:7, paddingVertical:3, borderRadius:8 },
  statusOn:     { backgroundColor:C.greenSoft },
  statusOff:    { backgroundColor:C.redSoft },
  statusText:   { fontSize:10, fontWeight:"700" },
  cardActions:  { flexDirection:"column", gap:6 },
  actionBtn:    { width:30, height:30, borderRadius:9, alignItems:"center", justifyContent:"center" },
  // Form
  fieldLabel:   { fontSize:13, color:C.text, fontWeight:"600", marginBottom:6 },
  inputRow:     { flexDirection:"row", alignItems:"center", borderWidth:1, borderColor:"#e5e7eb", borderRadius:12, backgroundColor:"#f9fafb", height:48, overflow:"hidden" },
  inputText:    { flex:1, fontSize:14, color:C.text, paddingVertical:0, paddingRight:14 },
  switchRow:    { flexDirection:"row", alignItems:"center", gap:12, backgroundColor:"#f8fafc", borderRadius:12, padding:14 },
  saveBtn:      { flexDirection:"row", alignItems:"center", justifyContent:"center", gap:8, paddingVertical:15, borderRadius:50, marginTop:8 },
  saveBtnText:  { color:"#fff", fontWeight:"700", fontSize:15 },
  errBox:       { flexDirection:"row", alignItems:"center", gap:8, backgroundColor:"#fef2f2", borderWidth:1, borderColor:"#fecaca", borderRadius:12, padding:12 },
  errText:      { color:"#dc2626", fontSize:13, flex:1, fontWeight:"500" },
});