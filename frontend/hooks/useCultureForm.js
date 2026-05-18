// hooks/useCultureForm.js — form hook for add-culture modal
import { useState, useCallback } from "react";
import { Alert } from "react-native";
import cultureService from "../api/cultureService";
import { useLanguage } from "@context/LanguageContext";

// ── Initial form shape ───────────────────────────────────────────────────────
const INITIAL_FORM = {
  parcelle: "",
  nom: "",
  variete: "",
  datePlantation: null,
  surface: "",
  nombreArbres: "",
  typeSol: "limoneux",
  region: "",
  // Irrigation system
  debitGoutteur: "",
  nbGoutteursParArbre: "",
  densitePlantation: "",
  // Soil hydric params
  thetaCc: "",
  thetaPf: "",
  // Saxton & Rawls texture
  sablePct: "",
  argilePct: "",
  om: "",
  // FAO-56 depletion / root depth
  p: "",
  z: "",
  // Initial water stock
  stockInitial: "",
  // Kc mode
  kcMode: "auto",
  kcIni: "",
  kcMid: "",
  kcEnd: "",
};

export function useCultureForm({ onSuccess }) {
  const { t } = useLanguage();

  // ── Modal / stepper state ────────────────────────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // ── Pickers state ────────────────────────────────────────────────────────────
  const [nomPickerVisible, setNomPickerVisible] = useState(false);
  const [varietePickerVisible, setVarietePickerVisible] = useState(false);
  const [solPickerVisible, setSolPickerVisible] = useState(false);

  // ── Form state ───────────────────────────────────────────────────────────────
  const [newCulture, setNewCulture] = useState(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState({});

  // ── Reset ────────────────────────────────────────────────────────────────────
  const resetForm = useCallback(() => {
    setNewCulture(INITIAL_FORM);
    setFieldErrors({});
    setNomPickerVisible(false);
    setVarietePickerVisible(false);
    setSolPickerVisible(false);
    setStep(1);
    setShowDatePicker(false);
  }, []);

  // ── Picker handlers ───────────────────────────────────────────────────────────
  const handleNomSelect = useCallback(
    (selectedNom, allCultures) => {
      const found = allCultures.find(
        (c) => c.nom.toLowerCase() === selectedNom.toLowerCase(),
      );
      setNewCulture((prev) => ({
        ...prev,
        nom: selectedNom,
        variete: found ? found.variete : prev.variete || "Standard",
      }));
      setFieldErrors((prev) => ({ ...prev, nom: null, variete: null }));
      setNomPickerVisible(false);
    },
    [],
  );

  const handleVarieteSelect = useCallback((selectedVariete) => {
    setNewCulture((prev) => ({ ...prev, variete: selectedVariete }));
    setFieldErrors((prev) => ({ ...prev, variete: null }));
    setVarietePickerVisible(false);
  }, []);

  // ── Step 1 validation ────────────────────────────────────────────────────────
  const validateStep1 = useCallback(() => {
    const errs = {};
    if (!newCulture.parcelle.trim())
      errs.parcelle = t("cultures.modal.parcelRequired");
    if (!newCulture.nom.trim()) errs.nom = t("cultures.modal.nomRequired");
    if (!newCulture.variete.trim())
      errs.variete = t("cultures.modal.varietyRequired");
    if (!newCulture.datePlantation)
      errs.datePlantation = t("cultures.modal.dateRequired");
    if (!newCulture.surface.trim()) {
      errs.surface = t("cultures.modal.surfaceRequired");
    } else if (
      isNaN(parseFloat(newCulture.surface)) ||
      parseFloat(newCulture.surface) <= 0
    ) {
      errs.surface = t("cultures.modal.surfaceInvalid");
    }
    if (!newCulture.nombreArbres?.trim()) {
      errs.nombreArbres = t("cultures.modal.treesRequired");
    } else {
      const n = parseInt(newCulture.nombreArbres);
      if (isNaN(n) || n <= 0)
        errs.nombreArbres = t("cultures.modal.treesInvalid");
    }
    if (newCulture.densitePlantation.trim()) {
      const dp = parseFloat(newCulture.densitePlantation);
      if (isNaN(dp) || dp <= 0 || dp > 10000)
        errs.densitePlantation = t("cultures.modal.density_invalid");
    }
    if (newCulture.kcMode === "manuel") {
      const checkKc = (v, key) => {
        if (!v.trim()) return;
        const n = parseFloat(v);
        if (isNaN(n) || n < 0.1 || n > 1.5)
          errs[key] = t("cultures.modal.kc_invalid");
      };
      if (!newCulture.kcMid.trim()) {
        errs.kcMid = t("cultures.modal.kc_mid_required");
      } else {
        checkKc(newCulture.kcMid, "kcMid");
      }
      checkKc(newCulture.kcIni, "kcIni");
      checkKc(newCulture.kcEnd, "kcEnd");
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }, [newCulture, t]);

  // ── Step 2 validation ────────────────────────────────────────────────────────
  const validateStep2 = useCallback(() => {
    const errs = {};
    if (!newCulture.debitGoutteur.trim()) {
      errs.debitGoutteur = t("cultures.modal.drip_flow_required");
    } else {
      const dg = parseFloat(newCulture.debitGoutteur);
      if (isNaN(dg) || dg <= 0 || dg > 20)
        errs.debitGoutteur = t("cultures.modal.drip_flow_invalid");
    }
    if (!newCulture.nbGoutteursParArbre.trim()) {
      errs.nbGoutteursParArbre = t("cultures.modal.drip_nb_required");
    } else {
      const ng = parseInt(newCulture.nbGoutteursParArbre);
      if (isNaN(ng) || ng <= 0 || ng > 20)
        errs.nbGoutteursParArbre = t("cultures.modal.drip_nb_invalid");
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }, [newCulture, t]);

  // ── Full validation (all steps) ──────────────────────────────────────────────
  const validate = useCallback(() => {
    const errs = {};
    if (!newCulture.parcelle.trim())
      errs.parcelle = t("cultures.modal.parcelRequired");
    if (!newCulture.nom.trim()) errs.nom = t("cultures.modal.nomRequired");
    if (!newCulture.variete.trim())
      errs.variete = t("cultures.modal.varietyRequired");
    if (!newCulture.datePlantation)
      errs.datePlantation = t("cultures.modal.dateRequired");
    if (!newCulture.surface.trim()) {
      errs.surface = t("cultures.modal.surfaceRequired");
    } else if (
      isNaN(parseFloat(newCulture.surface)) ||
      parseFloat(newCulture.surface) <= 0
    ) {
      errs.surface = t("cultures.modal.surfaceInvalid");
    }
    if (!newCulture.nombreArbres?.trim()) {
      errs.nombreArbres = t("cultures.modal.treesRequired");
    } else {
      const n = parseInt(newCulture.nombreArbres);
      if (isNaN(n) || n <= 0)
        errs.nombreArbres = t("cultures.modal.treesInvalid");
    }
    if (!newCulture.debitGoutteur.trim()) {
      errs.debitGoutteur = t("cultures.modal.drip_flow_required");
    } else {
      const dg = parseFloat(newCulture.debitGoutteur);
      if (isNaN(dg) || dg <= 0 || dg > 20)
        errs.debitGoutteur = t("cultures.modal.drip_flow_invalid");
    }
    if (!newCulture.nbGoutteursParArbre.trim()) {
      errs.nbGoutteursParArbre = t("cultures.modal.drip_nb_required");
    } else {
      const ng = parseInt(newCulture.nbGoutteursParArbre);
      if (isNaN(ng) || ng <= 0 || ng > 20)
        errs.nbGoutteursParArbre = t("cultures.modal.drip_nb_invalid");
    }
    if (!newCulture.densitePlantation.trim()) {
      errs.densitePlantation = t("cultures.modal.density_required");
    } else {
      const dp = parseFloat(newCulture.densitePlantation);
      if (isNaN(dp) || dp <= 0 || dp > 10000)
        errs.densitePlantation = t("cultures.modal.density_invalid");
    }
    if (newCulture.thetaCc.trim()) {
      const cc = parseFloat(newCulture.thetaCc);
      if (isNaN(cc) || cc <= 0 || cc > 0.6)
        errs.thetaCc = t("cultures.modal.thetaCc_invalid");
    }
    if (newCulture.thetaPf.trim()) {
      const pf = parseFloat(newCulture.thetaPf);
      if (isNaN(pf) || pf <= 0 || pf > 0.4)
        errs.thetaPf = t("cultures.modal.thetaPf_invalid");
    }
    if (newCulture.thetaCc.trim() && newCulture.thetaPf.trim()) {
      const cc = parseFloat(newCulture.thetaCc);
      const pf = parseFloat(newCulture.thetaPf);
      if (!isNaN(cc) && !isNaN(pf) && pf >= cc)
        errs.thetaPf = t("cultures.modal.thetaPf_lt_cc");
    }
    if (newCulture.kcMode === "manuel") {
      const checkKc = (v, key) => {
        if (!v.trim()) return;
        const n = parseFloat(v);
        if (isNaN(n) || n < 0.1 || n > 1.5)
          errs[key] = t("cultures.modal.kc_invalid");
      };
      if (!newCulture.kcMid.trim()) {
        errs.kcMid = t("cultures.modal.kc_mid_required");
      } else {
        checkKc(newCulture.kcMid, "kcMid");
      }
      checkKc(newCulture.kcIni, "kcIni");
      checkKc(newCulture.kcEnd, "kcEnd");
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }, [newCulture, t]);

  // ── Submit ───────────────────────────────────────────────────────────────────
  const addCulture = useCallback(async () => {
    if (!validate()) return;
    try {
      setSubmitting(true);
      const debitGoutteurVal = parseFloat(newCulture.debitGoutteur);
      const nbGoutteursVal = parseInt(newCulture.nbGoutteursParArbre);
      const nbArbresVal = parseInt(newCulture.nombreArbres);
      const debitTotal = debitGoutteurVal * nbGoutteursVal * nbArbresVal;

      const result = await cultureService.addCulture({
        parcelle: newCulture.parcelle.trim(),
        nom: newCulture.nom.trim(),
        variete: newCulture.variete.trim(),
        datePlantation: newCulture.datePlantation.toISOString(),
        surface: parseFloat(newCulture.surface),
        nombreArbres: nbArbresVal,
        typeSol: newCulture.typeSol,
        region: newCulture.region?.trim() || undefined,
        irrigation: {
          type: "goutte-a-goutte",
          debit: debitTotal,
          efficacite: 0.9,
        },
        debitGoutteur: debitGoutteurVal,
        nbGoutteursParArbre: nbGoutteursVal,
        densitePlantation: parseFloat(newCulture.densitePlantation),
        thetaCc: newCulture.thetaCc.trim()
          ? parseFloat(newCulture.thetaCc)
          : undefined,
        thetaPf: newCulture.thetaPf.trim()
          ? parseFloat(newCulture.thetaPf)
          : undefined,
        p: newCulture.p.trim() ? parseFloat(newCulture.p) : undefined,
        profondeurRacinaire: newCulture.z.trim()
          ? parseFloat(newCulture.z)
          : undefined,
        stockEauMm: newCulture.stockInitial.trim()
          ? parseFloat(newCulture.stockInitial)
          : undefined,
        stockEauUpdatedAt: newCulture.stockInitial.trim()
          ? new Date().toISOString()
          : undefined,
        ...(newCulture.sablePct.trim() &&
        newCulture.argilePct.trim() &&
        newCulture.om.trim()
          ? {
              sableFraction: parseFloat(newCulture.sablePct) / 100,
              argileFraction: parseFloat(newCulture.argilePct) / 100,
              matOrganique: parseFloat(newCulture.om),
              thetaSource: "saxton_rawls",
            }
          : newCulture.thetaCc.trim()
          ? { thetaSource: "manuel" }
          : {}),
        ...(newCulture.kcMode === "manuel" && newCulture.kcMid.trim()
          ? {
              kcManuel: {
                ini: newCulture.kcIni.trim()
                  ? parseFloat(newCulture.kcIni)
                  : undefined,
                mid: parseFloat(newCulture.kcMid),
                end: newCulture.kcEnd.trim()
                  ? parseFloat(newCulture.kcEnd)
                  : undefined,
              },
            }
          : {}),
      });

      if (result.success) {
        setModalVisible(false);
        resetForm();
        if (onSuccess) onSuccess();
        Alert.alert(t("common.successTitle"), t("cultures.modal.successAdd"));
      } else {
        Alert.alert(
          t("common.errorTitle"),
          result.error || t("cultures.modal.errorAdd"),
        );
      }
    } catch (err) {
      const isTimeout =
        err?.name === "AbortError" || err?.name === "TimeoutError";
      Alert.alert(
        t("common.errorTitle"),
        isTimeout
          ? t("calendar.serverStarting")
          : err.message || t("cultures.modal.errorServer"),
      );
    } finally {
      setSubmitting(false);
    }
  }, [newCulture, validate, resetForm, onSuccess, t]);

  return {
    // modal visibility
    modalVisible,
    setModalVisible,
    showDatePicker,
    setShowDatePicker,
    step,
    setStep,
    submitting,
    // pickers
    nomPickerVisible,
    setNomPickerVisible,
    varietePickerVisible,
    setVarietePickerVisible,
    solPickerVisible,
    setSolPickerVisible,
    // form data
    newCulture,
    setNewCulture,
    fieldErrors,
    setFieldErrors,
    // handlers
    handleNomSelect,
    handleVarieteSelect,
    validateStep1,
    validateStep2,
    addCulture,
    resetForm,
  };
}
