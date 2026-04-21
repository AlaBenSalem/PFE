// backend/src/controllers/fertilisationController.js
const Fertilisation = require('../models/Fertilisation');
const Culture       = require('../models/Culture');

// ── Helpers ───────────────────────────────────────────────────────────────────
function calcProchaineDate(dateApplication, frequenceJours) {
  if (!frequenceJours || frequenceJours <= 0) return null;
  return new Date(new Date(dateApplication).getTime() + frequenceJours * 86400000);
}

// ── POST /api/fertilisations — Créer une fertilisation ───────────────────────
exports.createFertilisation = async (req, res) => {
  try {
    const {
      cultureId,
      date,
      typeProduit,
      produit,
      dose,
      uniteDose,
      modeApplication,
      stadeApplication,
      frequenceJours,
      surface,
      nombreArbres,
      quantiteTotale,
      meteo,
      notes,
    } = req.body;

    // Vérifier que la culture appartient à l'utilisateur
    const culture = await Culture.findOne({ _id: cultureId, userId: req.userId });
    if (!culture) {
      return res.status(404).json({ success: false, message: 'Culture introuvable.' });
    }

    const applicationDate = date ? new Date(date) : new Date();
    const prochaineDate   = calcProchaineDate(applicationDate, frequenceJours);

    const fertilisation = new Fertilisation({
      cultureId,
      date:             applicationDate,
      typeProduit,
      produit,
      dose,
      uniteDose:        uniteDose        || 'kg/ha',
      modeApplication,
      stadeApplication: stadeApplication || 'croissance',
      frequenceJours:   frequenceJours   || null,
      prochaineDate,
      surface:          surface          || culture.surface || null,
      nombreArbres:     nombreArbres     || culture.nombreArbres || null,
      quantiteTotale:   quantiteTotale   || null,
      meteo:            meteo            || {},
      notes:            notes            || '',
    });

    await fertilisation.save();

    return res.status(201).json({
      success: true,
      message: 'Fertilisation enregistrée avec succès.',
      data:    fertilisation,
    });
  } catch (err) {
    console.error('❌ createFertilisation:', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// ── GET /api/fertilisations — Historique de l'utilisateur ───────────────────
exports.getFertilisations = async (req, res) => {
  try {
    const { cultureId, limit = 20 } = req.query;

    // Cultures de l'utilisateur
    const cultures = await Culture.find({ userId: req.userId }).select('_id');
    const cultureIds = cultures.map(c => c._id);

    const filter = { cultureId: { $in: cultureIds } };
    if (cultureId) filter.cultureId = cultureId;

    const fertilisations = await Fertilisation.find(filter)
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .populate('cultureId', 'nom variete surface');

    return res.json({ success: true, data: fertilisations });
  } catch (err) {
    console.error('❌ getFertilisations:', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// ── GET /api/fertilisations/prochaines — Prochaines dates ────────────────────
exports.getProchaines = async (req, res) => {
  try {
    const cultures   = await Culture.find({ userId: req.userId }).select('_id nom variete');
    const cultureIds = cultures.map(c => c._id);

    // Dernière fertilisation par culture
    const results = await Promise.all(
      cultures.map(async (culture) => {
        const last = await Fertilisation.findOne({ cultureId: culture._id })
          .sort({ date: -1 });

        if (!last) {
          return {
            culture:       { id: culture._id, nom: culture.nom, variete: culture.variete },
            derniereFert:  null,
            prochaineDate: null,
            joursRestants: null,
            statut:        'aucune_fert',
          };
        }

        // Prochaine date : priorité au champ stocké, sinon calcul
        let prochaineDate = last.prochaineDate;
        if (!prochaineDate && last.frequenceJours) {
          prochaineDate = calcProchaineDate(last.date, last.frequenceJours);
        }

        const joursRestants = prochaineDate
          ? Math.ceil((new Date(prochaineDate) - new Date()) / (1000 * 60 * 60 * 24))
          : null;

        const statut = prochaineDate
          ? joursRestants <= 0
            ? 'en_retard'
            : joursRestants <= 3
              ? 'urgent'
              : 'planifie'
          : 'non_planifie';

        return {
          culture:       { id: culture._id, nom: culture.nom, variete: culture.variete },
          derniereFert:  last,
          prochaineDate,
          joursRestants,
          statut,
        };
      })
    );

    return res.json({ success: true, data: results });
  } catch (err) {
    console.error('❌ getProchaines:', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// ── GET /api/fertilisations/:id — Détail ─────────────────────────────────────
exports.getFertilisationById = async (req, res) => {
  try {
    const fert = await Fertilisation.findById(req.params.id).populate('cultureId', 'nom variete');
    if (!fert) return res.status(404).json({ success: false, message: 'Fertilisation introuvable.' });
    return res.json({ success: true, data: fert });
  } catch (err) {
    console.error('❌ getFertilisationById:', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// ── PUT /api/fertilisations/:id — Modifier ───────────────────────────────────
exports.updateFertilisation = async (req, res) => {
  try {
    const updates = { ...req.body };

    // Recalculer prochaineDate si date ou frequenceJours changent
    if (updates.date || updates.frequenceJours) {
      const existing = await Fertilisation.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, message: 'Introuvable.' });
      const baseDate    = updates.date          ? new Date(updates.date)    : existing.date;
      const freq        = updates.frequenceJours ?? existing.frequenceJours;
      updates.prochaineDate = calcProchaineDate(baseDate, freq);
    }

    const updated = await Fertilisation.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('cultureId', 'nom variete');

    if (!updated) return res.status(404).json({ success: false, message: 'Fertilisation introuvable.' });
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('❌ updateFertilisation:', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// ── DELETE /api/fertilisations/:id — Supprimer ───────────────────────────────
exports.deleteFertilisation = async (req, res) => {
  try {
    const deleted = await Fertilisation.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Fertilisation introuvable.' });
    return res.json({ success: true, message: 'Fertilisation supprimée.' });
  } catch (err) {
    console.error('❌ deleteFertilisation:', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};