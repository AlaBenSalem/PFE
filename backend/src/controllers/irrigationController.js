// controllers/irrigationController.js
// ✅ MODIFIÉ : Ajout endpoint updateStockEauHoraire — mise à jour stock sol chaque 1h
const Irrigation = require('../models/Irrigation');
const Culture    = require('../models/Culture');
const Weather    = require('../models/Weather');
const { getKcForCultureAndMonth } = require('./kcController');
const { SOIL_PARAMS, calculerRFU } = require('../data/soilData');

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';

function extractUserId(req) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded?.id || null;
  } catch {
    return null;
  }
}

// ─── GET toutes les irrigations ───────────────────────────────────────────────
exports.getAllIrrigations = async (req, res) => {
  try {
    const userId = extractUserId(req);
    let filter = {};
    if (userId) {
      const userCultures = await Culture.find({ userId }).select('_id');
      const ids = userCultures.map(c => c._id);
      filter = { cultureId: { $in: ids } };
    }

    const irrigations = await Irrigation.find(filter)
      .populate('cultureId', 'nom variete parcelle surface nombreArbres typeSol')
      .sort({ date: -1 });

    const transformedData = irrigations.map((irr) => ({
      _id: irr._id,
      nom: irr.cultureId?.nom || 'Culture inconnue',
      mode: irr.mode,
      volume: irr.volume,
      duree: irr.duree,
      date: irr.date,
      et0: irr.et0,
      etc: irr.etc,
      kc: irr.kc,
      eauMm: irr.eauMm,
      debitMmh: irr.debitMmh,
      typeSol: irr.typeSol,
      rfu: irr.rfu,
      ru: irr.ru,
      frequenceJours: irr.frequenceJours,
      prochaineDate: irr.prochaineDate,
      cultureId: irr.cultureId,
    }));

    res.json({ success: true, data: transformedData, count: transformedData.length });
  } catch (error) {
    console.error('❌ Erreur GET /irrigations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET irrigations d'une culture ───────────────────────────────────────────
exports.getIrrigationsByCulture = async (req, res) => {
  try {
    const { cultureId } = req.params;
    const { limit = 20 } = req.query;

    const irrigations = await Irrigation.find({ cultureId })
      .sort({ date: -1 })
      .limit(parseInt(limit));

    const transformedData = irrigations.map((irr) => ({
      _id: irr._id,
      mode: irr.mode,
      volume: irr.volume,
      duree: irr.duree,
      date: irr.date,
      et0: irr.et0,
      etc: irr.etc,
      kc: irr.kc,
      eauMm: irr.eauMm,
      debitMmh: irr.debitMmh,
      typeSol: irr.typeSol,
      rfu: irr.rfu,
      ru: irr.ru,
      frequenceJours: irr.frequenceJours,
      prochaineDate: irr.prochaineDate,
    }));

    res.json({ success: true, data: transformedData, count: transformedData.length });
  } catch (error) {
    console.error('❌ Erreur GET /irrigations/culture/:cultureId:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET irrigation par ID ────────────────────────────────────────────────────
exports.getIrrigationById = async (req, res) => {
  try {
    const irrigation = await Irrigation.findById(req.params.id)
      .populate('cultureId', 'nom variete parcelle surface irrigation nombreArbres typeSol profondeurRacinaire');

    if (!irrigation) {
      return res.status(404).json({ success: false, error: 'Irrigation non trouvée' });
    }

    res.json({
      success: true,
      data: {
        _id: irrigation._id,
        nom: irrigation.cultureId?.nom || 'Culture inconnue',
        mode: irrigation.mode,
        volume: irrigation.volume,
        duree: irrigation.duree,
        date: irrigation.date,
        cultureId: irrigation.cultureId,
        et0: irrigation.et0,
        etc: irrigation.etc,
        kc: irrigation.kc,
        debit: irrigation.debit,
        surface: irrigation.surface,
        efficacite: irrigation.efficacite,
        eauMm: irrigation.eauMm,
        debitMmh: irrigation.debitMmh,
        typeSol: irrigation.typeSol,
        rfu: irrigation.rfu,
        ru: irrigation.ru,
        doseNetteMm: irrigation.doseNetteMm,
        frequenceJours: irrigation.frequenceJours,
        prochaineDate: irrigation.prochaineDate,
        notes: irrigation.notes,
        completed: irrigation.completed,
        meteo: irrigation.meteo,
      },
    });
  } catch (error) {
    console.error('❌ Erreur GET /irrigations/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─── POST nouvelle irrigation ─────────────────────────────────────────────────
exports.createIrrigation = async (req, res) => {
  try {
    const {
      cultureId, mode, duree, volume, debit,
      et0, etc, kc, surface, efficacite = 0.9,
      eauMm, debitMmh, notes, completed = true, date = new Date(),
    } = req.body;

    const culture = await Culture.findById(cultureId);
    if (!culture) {
      return res.status(404).json({ success: false, error: 'Culture non trouvée' });
    }

    if (eauMm === undefined || eauMm === null) {
      return res.status(400).json({ success: false, error: 'Le champ eauMm est requis' });
    }
    if (debitMmh === undefined || debitMmh === null) {
      return res.status(400).json({ success: false, error: 'Le champ debitMmh est requis' });
    }
    const volumeParsed = parseFloat(volume);
    const dureeParsed  = parseFloat(duree);
    if (!volumeParsed || volumeParsed <= 0) {
      return res.status(400).json({ success: false, error: 'Volume invalide (doit être > 0)' });
    }
    if (!dureeParsed || dureeParsed < 1) {
      return res.status(400).json({ success: false, error: 'Durée invalide (doit être ≥ 1 min)' });
    }

    const typeSol    = culture.typeSol || 'limoneux';
    const typeCulture = culture.type   || 'legume';
    const etcVal     = parseFloat(etc) || 3.5;
    const rfuData    = calculerRFU(typeSol, typeCulture, etcVal, culture.profondeurRacinaire);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const weather = await Weather.findOne({
      date: { $gte: today, $lt: tomorrow },
    }).sort({ date: -1 });

    const irrigation = new Irrigation({
      cultureId,
      date,
      mode,
      duree: dureeParsed,
      volume: volumeParsed,
      debit: parseFloat(debit),
      et0: parseFloat(et0),
      etc: parseFloat(etc),
      kc: parseFloat(kc),
      surface: parseFloat(surface),
      efficacite: parseFloat(efficacite),
      eauMm: parseFloat(eauMm),
      debitMmh: parseFloat(debitMmh),
      typeSol,
      ru: rfuData.ru,
      rfu: rfuData.rfu,
      doseNetteMm: rfuData.doseNetteMm,
      frequenceJours: rfuData.frequenceJours,
      prochaineDate: rfuData.prochaineDate,
      notes,
      completed,
      meteo: weather ? {
        temperature: weather.temperature?.avg,
        humidity: weather.humidity?.avg,
        windSpeed: weather.wind?.speed,
      } : undefined,
    });

    await irrigation.save();

    culture.historiqueIrrigation = culture.historiqueIrrigation || [];
    culture.historiqueIrrigation.push({
      date: irrigation.date,
      volume: irrigation.volume,
      duree: irrigation.duree,
      mode: irrigation.mode,
      et0: irrigation.et0,
      etc: irrigation.etc,
      eauMm: irrigation.eauMm,
      debitMmh: irrigation.debitMmh,
    });
    culture.kcActuel = parseFloat(kc);

    // ✅ Remettre le stock à la capacité au champ (W_cc) après irrigation
    // + marquer le timestamp exact pour le calcul horaire
    const THETA_STD_CTRL = {
      sableux:         { cc: 0.12 }, limono_sableux: { cc: 0.23 },
      limoneux:        { cc: 0.31 }, argilo_limoneux: { cc: 0.38 }, argileux: { cc: 0.42 },
    };
    const Z_DEFAUT_CTRL = { agrume: 0.9, fruit: 1.0, legume: 0.5, cereale: 1.0 };
    const thetaCcEff = culture.thetaCc != null
      ? culture.thetaCc
      : (THETA_STD_CTRL[typeSol]?.cc || 0.31);
    const zEff = culture.profondeurRacinaire != null
      ? culture.profondeurRacinaire
      : (Z_DEFAUT_CTRL[typeCulture] || 0.6);

    culture.stockEauMm        = parseFloat((thetaCcEff * zEff * 1000).toFixed(1));
    // ✅ Timestamp exact de la mise à jour (pour calcul horaire côté frontend)
    culture.stockEauUpdatedAt = new Date();

    await culture.save();

    console.log(
      `✅ Irrigation créée pour ${culture.nom}: ${volumeParsed}L — ${eauMm}mm — ` +
      `ETc: ${etc}mm — Kc: ${kc} — Sol: ${typeSol} — RFU: ${rfuData.rfu}mm`
    );

    res.status(201).json({
      success: true,
      data: {
        _id: irrigation._id,
        nom: culture.nom,
        mode: irrigation.mode,
        volume: irrigation.volume,
        duree: irrigation.duree,
        date: irrigation.date,
        et0: irrigation.et0,
        etc: irrigation.etc,
        kc: irrigation.kc,
        eauMm: irrigation.eauMm,
        debitMmh: irrigation.debitMmh,
        typeSol: irrigation.typeSol,
        rfu: irrigation.rfu,
        ru: irrigation.ru,
        frequenceJours: irrigation.frequenceJours,
        prochaineDate: irrigation.prochaineDate,
        cultureId: { _id: culture._id, nom: culture.nom, variete: culture.variete, parcelle: culture.parcelle },
      },
      rfuInfo: rfuData,
      message: 'Irrigation enregistrée avec succès',
    });
  } catch (error) {
    console.error('❌ Erreur POST /irrigations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─── ✅ NOUVEAU : PUT mise à jour horaire du stock sol ─────────────────────────
// Appelé par un cron job toutes les heures (ex: node-cron dans server.js)
// Calcule la moyenne ETc des dernières 1h et déduit du stock
exports.updateStockEauHoraire = async (req, res) => {
  try {
    // Récupérer toutes les cultures actives
    const cultures = await Culture.find({ stockEauMm: { $ne: null } });

    const now     = new Date();
    const oneHourAgo = new Date(now.getTime() - 3_600_000);

    let updated = 0;
    const results = [];

    for (const culture of cultures) {
      try {
        const typeSol     = culture.typeSol    || 'limoneux';
        const typeCulture = culture.type       || 'legume';

        // ── Récupérer les données météo de la dernière heure ──────────────────
        const weatherRecords = await Weather.find({
          date: { $gte: oneHourAgo, $lte: now },
        }).sort({ date: -1 });

        // ── Calculer ET0 moyen sur la dernière 1h ─────────────────────────────
        let et0Moyen;
        if (weatherRecords.length > 0) {
          const sumEt0 = weatherRecords.reduce((s, w) => s + (w.et0 || 0), 0);
          et0Moyen = sumEt0 / weatherRecords.length;
        } else {
          // Fallback : utiliser le dernier enregistrement météo disponible
          const lastWeather = await Weather.findOne().sort({ date: -1 });
          et0Moyen = lastWeather?.et0 || 3.5;
        }

        // ── Calculer Kc du mois en cours ──────────────────────────────────────
        let kc = culture.kcActuel || 0.65;
        try {
          const moisCourant = now.getMonth() + 1;
          const { kc: kcDynamic } = await getKcForCultureAndMonth(culture.nom, moisCourant);
          if (kcDynamic && kcDynamic > 0) kc = kcDynamic;
        } catch (_) { /* garder kc actuel */ }

        // ── ETc moyen sur 1h (mm/h) ───────────────────────────────────────────
        const etcJournalier = et0Moyen * kc;          // mm/jour
        const etcHoraire    = etcJournalier / 24;     // mm/heure

        // ── ETc/h doit être strictement positif pour déduire ─────────────────
        if (etcHoraire <= 0) continue;

        // ── Bornes du sol ─────────────────────────────────────────────────────
        const THETA_STD = {
          sableux:         { cc: 0.12, pf: 0.05 },
          limono_sableux:  { cc: 0.23, pf: 0.10 },
          limoneux:        { cc: 0.31, pf: 0.15 },
          argilo_limoneux: { cc: 0.38, pf: 0.22 },
          argileux:        { cc: 0.42, pf: 0.26 },
        };
        const Z_DEFAUT = { agrume: 0.9, fruit: 1.0, legume: 0.5, cereale: 1.0 };

        const thetaCcEff = culture.thetaCc != null
          ? culture.thetaCc
          : (THETA_STD[typeSol]?.cc || 0.31);
        const thetaPfEff = culture.thetaPf != null
          ? culture.thetaPf
          : (THETA_STD[typeSol]?.pf || 0.15);
        const z = culture.profondeurRacinaire != null
          ? culture.profondeurRacinaire
          : (Z_DEFAUT[typeCulture] || 0.6);

        const W_cc    = thetaCcEff * z * 1000;
        const W_pf_mm = thetaPfEff * z * 1000;

        // ── Nouveau stock = ancien stock − ETc/h uniquement ───────────────────
        // Règle absolue : le stock ne peut QUE DIMINUER via ETc.
        // La pluie et les irrigations sont gérées séparément — elles ne sont
        // jamais ajoutées ici pour éviter toute augmentation involontaire.
        const stockActuel  = parseFloat(culture.stockEauMm);
        const stockDeduit  = stockActuel - etcHoraire;
        const nouveauStock = Math.min(
          stockActuel,                          // jamais au-dessus du stock actuel
          Math.max(W_pf_mm, stockDeduit)        // jamais en dessous du point de flétrissement
        );

        // ── Persister en base ─────────────────────────────────────────────────
        culture.stockEauMm        = parseFloat(nouveauStock.toFixed(1));
        culture.stockEauUpdatedAt = now;
        await culture.save();

        updated++;
        results.push({
          cultureId: culture._id,
          nom: culture.nom,
          stockAvant: stockActuel.toFixed(1),
          etcHoraire: etcHoraire.toFixed(3),
          stockApres: nouveauStock.toFixed(1),
          delta: (nouveauStock - stockActuel).toFixed(3),
          et0Moyen: et0Moyen.toFixed(2),
          kc: kc.toFixed(2),
        });

        console.log(
          `⏱ Stock horaire [${culture.nom}]: ${stockActuel.toFixed(1)} → ${nouveauStock.toFixed(1)} mm` +
          ` (ETc/h=${etcHoraire.toFixed(3)} mm, ET0moy=${et0Moyen.toFixed(2)}, Kc=${kc.toFixed(2)})`
        );
      } catch (cultureErr) {
        console.error(`❌ Erreur update stock [${culture.nom}]:`, cultureErr.message);
      }
    }

    res.json({
      success: true,
      message: `Stock sol mis à jour pour ${updated} culture(s)`,
      updatedAt: now,
      results,
    });
  } catch (error) {
    console.error('❌ Erreur updateStockEauHoraire:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─── PUT mise à jour ──────────────────────────────────────────────────────────
exports.updateIrrigation = async (req, res) => {
  try {
    const irrigation = await Irrigation.findByIdAndUpdate(
      req.params.id, req.body, { new: true, runValidators: true }
    ).populate('cultureId', 'nom');

    if (!irrigation) {
      return res.status(404).json({ success: false, error: 'Irrigation non trouvée' });
    }

    res.json({
      success: true,
      data: {
        _id: irrigation._id,
        nom: irrigation.cultureId?.nom || 'Culture inconnue',
        mode: irrigation.mode,
        volume: irrigation.volume,
        duree: irrigation.duree,
        date: irrigation.date,
        et0: irrigation.et0,
        etc: irrigation.etc,
        kc: irrigation.kc,
        eauMm: irrigation.eauMm,
        debitMmh: irrigation.debitMmh,
        typeSol: irrigation.typeSol,
        rfu: irrigation.rfu,
        ru: irrigation.ru,
        frequenceJours: irrigation.frequenceJours,
        prochaineDate: irrigation.prochaineDate,
        cultureId: irrigation.cultureId,
      },
      message: 'Irrigation mise à jour',
    });
  } catch (error) {
    console.error('❌ Erreur PUT /irrigations/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─── DELETE ───────────────────────────────────────────────────────────────────
exports.deleteIrrigation = async (req, res) => {
  try {
    const irrigation = await Irrigation.findByIdAndDelete(req.params.id);
    if (!irrigation) {
      return res.status(404).json({ success: false, error: 'Irrigation non trouvée' });
    }
    await Culture.updateOne(
      { _id: irrigation.cultureId },
      { $pull: { historiqueIrrigation: { date: irrigation.date } } }
    );
    res.json({ success: true, message: 'Irrigation supprimée', data: irrigation });
  } catch (error) {
    console.error('❌ Erreur DELETE /irrigations/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET irrigations du jour ──────────────────────────────────────────────────
exports.getTodayIrrigations = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const irrigations = await Irrigation.find({ date: { $gte: today, $lt: tomorrow } })
      .populate('cultureId', 'nom variete parcelle')
      .sort({ date: -1 });

    const transformedData = irrigations.map((irr) => ({
      _id: irr._id,
      nom: irr.cultureId?.nom || 'Culture inconnue',
      mode: irr.mode,
      volume: irr.volume,
      duree: irr.duree,
      date: irr.date,
      et0: irr.et0,
      etc: irr.etc,
      kc: irr.kc,
      eauMm: irr.eauMm,
      debitMmh: irr.debitMmh,
      typeSol: irr.typeSol,
      rfu: irr.rfu,
      frequenceJours: irr.frequenceJours,
      prochaineDate: irr.prochaineDate,
      cultureId: irr.cultureId,
    }));

    const stats = {
      totalVolume: irrigations.reduce((s, i) => s + i.volume, 0),
      totalDuree: irrigations.reduce((s, i) => s + i.duree, 0),
      totalETc: irrigations.reduce((s, i) => s + i.etc, 0).toFixed(1),
      count: irrigations.length,
    };

    res.json({ success: true, data: transformedData, stats, date: today });
  } catch (error) {
    console.error('❌ Erreur GET /irrigations/today:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET calcul des besoins + RFU ────────────────────────────────────────────
exports.calculateIrrigationNeeds = async (req, res) => {
  try {
    const { cultureId } = req.params;
    const culture = await Culture.findById(cultureId);
    if (!culture) {
      return res.status(404).json({ success: false, error: 'Culture non trouvée' });
    }

    const currentMonth = new Date().getMonth() + 1;
    const { kc, stade } = await getKcForCultureAndMonth(culture.nom, currentMonth);

    const weather  = await Weather.findOne().sort({ date: -1 });
    const et0      = weather?.et0 || 3.5;
    const etc      = et0 * kc;

    const surface     = culture.surface || 100;
    const debit       = culture.irrigation?.debit || 1000;
    const efficacite  = culture.irrigation?.efficacite || 0.9;
    const volumeLiters = etc * surface;
    const volumeReel  = volumeLiters / efficacite;
    const tempsMinutes = Math.round((volumeReel / debit) * 60);

    const nombreArbres = culture.nombreArbres || null;
    const volumeParArbre = nombreArbres && nombreArbres > 0
      ? Math.round((volumeReel / nombreArbres) * 10) / 10
      : null;

    const typeSol    = culture.typeSol   || 'limoneux';
    const typeCulture = culture.type     || 'legume';
    const rfuData    = calculerRFU(typeSol, typeCulture, etc, culture.profondeurRacinaire);

    const derniereIrrigation = await Irrigation.findOne({ cultureId }).sort({ date: -1 });
    let etcCumuleDepuisIrrigation = null;
    let joursDepuisIrrigation     = null;
    let urgenceIrrigation         = false;
    let pourcentageRFU            = null;

    if (derniereIrrigation) {
      const msEcoules = Date.now() - new Date(derniereIrrigation.date).getTime();
      joursDepuisIrrigation = Math.floor(msEcoules / (1000 * 60 * 60 * 24));
      etcCumuleDepuisIrrigation = parseFloat((joursDepuisIrrigation * etc).toFixed(1));
      pourcentageRFU = Math.min(100, Math.round((etcCumuleDepuisIrrigation / rfuData.rfu) * 100));
      urgenceIrrigation = etcCumuleDepuisIrrigation >= rfuData.rfu * 0.9;
    }

    res.json({
      success: true,
      data: {
        culture: { id: culture._id, nom: culture.nom, variete: culture.variete, surface, kc, nombreArbres, typeSol, typeCulture },
        besoins: { et0: et0.toFixed(2), kc: kc.toFixed(2), stade, etc: parseFloat(etc.toFixed(2)), volumeTheorique: Math.round(volumeLiters), volumeReel: Math.round(volumeReel), efficacite, debit, tempsMinutes, volumeParArbre },
        rfu: { ...rfuData, derniereIrrigation: derniereIrrigation?.date || null, joursDepuisIrrigation, etcCumuleDepuisIrrigation, pourcentageRFU, urgenceIrrigation },
        meteo: { date: weather?.date, et0: weather?.et0 },
      },
    });
  } catch (error) {
    console.error('❌ Erreur GET /calculate-needs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET historique ETc ───────────────────────────────────────────────────────
exports.getETcHistory = async (req, res) => {
  try {
    const { cultureId } = req.params;
    const { days = 30 } = req.query;

    const culture = await Culture.findById(cultureId);
    if (!culture) {
      return res.status(404).json({ success: false, error: 'Culture non trouvée' });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const irrigations  = await Irrigation.find({ cultureId, date: { $gte: startDate } }).sort({ date: 1 });
    const weatherData  = await Weather.find({ date: { $gte: startDate } }).sort({ date: 1 });

    const weatherMap    = {};
    weatherData.forEach((w) => { weatherMap[w.date.toISOString().split('T')[0]] = w; });

    const irrigationMap = {};
    irrigations.forEach((i) => { irrigationMap[i.date.toISOString().split('T')[0]] = i; });

    const kcCache = {};
    const typeSol    = culture.typeSol || 'limoneux';
    const typeCulture = culture.type   || 'legume';

    const history = [];
    for (let i = 0; i < parseInt(days); i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const dateKey  = date.toISOString().split('T')[0];
      const month    = date.getMonth() + 1;
      const weather  = weatherMap[dateKey];
      const irrigation = irrigationMap[dateKey];
      const et0      = weather?.et0 || 3.5;

      let kc;
      if (irrigation?.kc) {
        kc = irrigation.kc;
      } else {
        if (!kcCache[month]) {
          const result = await getKcForCultureAndMonth(culture.nom, month);
          kcCache[month] = result.kc;
        }
        kc = kcCache[month];
      }

      const etc = irrigation?.etc != null ? irrigation.etc : parseFloat((et0 * kc).toFixed(2));
      const rfuDuJour = calculerRFU(typeSol, typeCulture, etc, culture.profondeurRacinaire);

      history.push({
        date,
        dateStr: dateKey,
        et0: parseFloat(et0).toFixed(2),
        kc: parseFloat(kc).toFixed(2),
        etc: parseFloat(etc).toFixed(2),
        volume: irrigation?.volume || 0,
        eauMm: irrigation?.eauMm || null,
        debitMmh: irrigation?.debitMmh || null,
        irrigated: !!irrigation,
        irrigationId: irrigation?._id,
        mode: irrigation?.mode,
        duree: irrigation?.duree || 0,
        rfu: rfuDuJour.rfu,
        ru: rfuDuJour.ru,
        frequenceJours: rfuDuJour.frequenceJours,
        weather: weather ? { temp: weather.temperature?.avg, humidity: weather.humidity?.avg, wind: weather.wind?.speed } : null,
      });
    }

    history.sort((a, b) => new Date(b.date) - new Date(a.date));

    const stats = {
      totalETc: history.reduce((s, d) => s + parseFloat(d.etc), 0).toFixed(1),
      avgETc: (history.reduce((s, d) => s + parseFloat(d.etc), 0) / history.length).toFixed(1),
      totalVolume: history.reduce((s, d) => s + (d.volume || 0), 0),
      irrigatedDays: history.filter((d) => d.irrigated).length,
      maxETc: Math.max(...history.map((d) => parseFloat(d.etc))).toFixed(1),
      minETc: Math.min(...history.map((d) => parseFloat(d.etc))).toFixed(1),
      avgEfficacite: ((history.filter((d) => d.irrigated).length / history.length) * 100).toFixed(0),
    };

    res.json({
      success: true,
      data: history,
      culture: { id: culture._id, nom: culture.nom, variete: culture.variete, parcelle: culture.parcelle, kcMoyen: culture.kcActuel, surface: culture.surface, nombreArbres: culture.nombreArbres ?? null, typeSol: culture.typeSol },
      stats,
      period: `${days} jours`,
    });
  } catch (error) {
    console.error('❌ Erreur GET /etc-history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = exports;