// controllers/kcController.js
const KCReference = require('../models/KCReference');
const KC_DATA = require('../data/kcData'); // données FAO-56

// ─── Utilitaire partagé ───────────────────────────────────────────────────────

/**
 * Recherche le Kc saisonnier FAO-56 pour une culture et un mois donnés.
 * Utilisé par kcController, irrigationController, cultureController.
 *
 * Ordre de recherche :
 *  1. Correspondance exacte (insensible à la casse) sur `culture` ou `aliases`
 *  2. Correspondance partielle sur le premier mot du nom
 *  3. Valeur par défaut FAO : 0.65
 */
async function getKcForCultureAndMonth(cultureName, mois) {
  const month    = mois || (new Date().getMonth() + 1);
  const nameNorm = (cultureName || '').toLowerCase().trim();

  // 1. Recherche principale
  let kcRef = await KCReference.findOne({
    $or: [
      { culture: { $regex: nameNorm, $options: 'i' } },
      { aliases: { $elemMatch: { $regex: nameNorm, $options: 'i' } } },
    ],
  });

  // 2. Fallback sur le premier mot (ex: "Orange Navel" → "Orange")
  if (!kcRef) {
    const firstWord = nameNorm.split(' ')[0];
    if (firstWord && firstWord !== nameNorm) {
      kcRef = await KCReference.findOne({
        $or: [
          { culture: { $regex: firstWord, $options: 'i' } },
          { aliases: { $elemMatch: { $regex: firstWord, $options: 'i' } } },
        ],
      });
    }
  }

  if (!kcRef) {
    return { kc: 0.65, stade: 'Moyen FAO', source: 'default', found: false };
  }

  // 3. Trouver le stade correspondant au mois courant
  let stadeTrouve = null;
  for (const stade of kcRef.stades) {
    const { debut, fin } = stade.periode;
    // Gestion de la période qui chevauche le changement d'année (ex: Dec→Fév)
    if (debut <= fin) {
      if (month >= debut && month <= fin) { stadeTrouve = stade; break; }
    } else {
      if (month >= debut || month <= fin) { stadeTrouve = stade; break; }
    }
  }

  const kc    = stadeTrouve ? stadeTrouve.kc  : kcRef.kcMoyen;
  const stade = stadeTrouve ? stadeTrouve.nom  : 'Moyen annuel';

  return { kc, stade, source: kcRef.culture, found: true };
}

// Export de l'utilitaire pour les autres controllers
module.exports.getKcForCultureAndMonth = getKcForCultureAndMonth;

// ─── GET /api/kc/current?culture=Orange&mois=4 ───────────────────────────────
/**
 * Retourne le Kc saisonnier FAO-56 du mois demandé (ou mois courant si absent).
 * Utilisé par irrigation.jsx → fetchKcDynamique()
 *
 * Réponse :
 *   { success: true, data: { kc, stade, source, found, mois } }
 */
exports.getKCCurrent = async (req, res) => {
  try {
    const { culture, mois } = req.query;

    if (!culture) {
      return res.status(400).json({ success: false, error: 'Paramètre culture requis' });
    }

    const month  = mois ? parseInt(mois) : new Date().getMonth() + 1;
    const result = await getKcForCultureAndMonth(culture, month);

    return res.json({
      success: true,
      data: {
        kc:     result.kc,
        stade:  result.stade,
        source: result.source,
        found:  result.found,
        mois:   month,
      },
    });
  } catch (error) {
    console.error('❌ Erreur getKCCurrent:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─── POST /api/kc/init ────────────────────────────────────────────────────────
/**
 * (Re)charge toutes les données FAO-56 dans la collection KCReference.
 */
exports.initializeKCData = async (req, res) => {
  try {
    await KCReference.deleteMany({});
    const result = await KCReference.insertMany(KC_DATA);
    res.json({
      success: true,
      message: `${result.length} cultures initialisées (données FAO-56)`,
      data: result.map((r) => ({ culture: r.culture, type: r.type, stades: r.stades.length })),
    });
  } catch (error) {
    console.error('❌ Erreur initializeKCData:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─── POST /api/kc/add ─────────────────────────────────────────────────────────
/**
 * Ajoute une nouvelle culture à la base KCReference (si elle n'existe pas déjà).
 * Appelé automatiquement depuis addculture.jsx quand l'admin saisit une culture inconnue.
 */
exports.addKCEntry = async (req, res) => {
  try {
    const { culture, aliases, variete, type, stades, kcMoyen, references } = req.body;

    if (!culture || !stades || stades.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Champs requis manquants (culture, stades)',
      });
    }

    const existing = await KCReference.findOne({
      $or: [
        { culture: { $regex: culture.trim(), $options: 'i' } },
        { aliases: { $elemMatch: { $regex: culture.trim().toLowerCase(), $options: 'i' } } },
      ],
    });

    if (existing) {
      return res.json({
        success: true,
        message: 'Culture déjà présente dans la base Kc',
        data: existing,
        alreadyExists: true,
      });
    }

    const computedKcMoyen = kcMoyen
      || Math.round((stades.reduce((sum, s) => sum + s.kc, 0) / stades.length) * 100) / 100;

    const entry = await KCReference.create({
      culture:    culture.trim(),
      aliases:    aliases || [culture.trim().toLowerCase()],
      variete:    variete || 'Standard',
      type:       type || 'legume',
      stades,
      kcMoyen:    computedKcMoyen,
      references: references || {
        fao: false,
        source: "Ajouté manuellement par l'administrateur",
        notes: '',
      },
    });

    console.log(`✅ Nouvelle culture ajoutée à KCReference: "${culture}"`);

    res.status(201).json({
      success: true,
      message: `"${culture}" ajoutée à la base Kc FAO-56`,
      data: entry,
      alreadyExists: false,
    });
  } catch (error) {
    console.error('❌ Erreur addKCEntry:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/kc/search?culture=Tomate&mois=5 ────────────────────────────────
exports.getKCByCulture = async (req, res) => {
  try {
    const { culture, mois } = req.query;

    const query = {};
    if (culture) {
      query.$or = [
        { culture: { $regex: culture, $options: 'i' } },
        { aliases: { $elemMatch: { $regex: culture, $options: 'i' } } },
      ];
    }

    const kcData = await KCReference.find(query);

    if (mois && kcData.length > 0) {
      const month = parseInt(mois);
      kcData.forEach((item) => {
        item.stades = item.stades.filter((stade) => {
          const { debut, fin } = stade.periode;
          return debut <= fin
            ? month >= debut && month <= fin
            : month >= debut || month <= fin;
        });
      });
    }

    res.json({ success: true, data: kcData, count: kcData.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/kc/mensuel/:culture ─────────────────────────────────────────────
exports.getKCMensuel = async (req, res) => {
  try {
    const { culture } = req.params;

    const kcData = await KCReference.findOne({
      $or: [
        { culture: { $regex: culture, $options: 'i' } },
        { aliases: { $elemMatch: { $regex: culture, $options: 'i' } } },
      ],
    });

    if (!kcData) {
      return res.status(404).json({ success: false, error: 'Culture non trouvée dans la base Kc' });
    }

    const moisLabels = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
    const kcMensuel  = [];

    for (let i = 1; i <= 12; i++) {
      let stadeTrouve = null;
      for (const stade of kcData.stades) {
        const { debut, fin } = stade.periode;
        if (debut <= fin) {
          if (i >= debut && i <= fin) { stadeTrouve = stade; break; }
        } else {
          if (i >= debut || i <= fin) { stadeTrouve = stade; break; }
        }
      }
      kcMensuel.push({
        mois:   moisLabels[i - 1],
        numero: i,
        kc:     stadeTrouve ? stadeTrouve.kc  : kcData.kcMoyen,
        stade:  stadeTrouve ? stadeTrouve.nom  : 'Hors saison',
      });
    }

    res.json({
      success: true,
      data: {
        culture:    kcData.culture,
        variete:    kcData.variete,
        type:       kcData.type,
        kcMoyen:    kcData.kcMoyen,
        references: kcData.references,
        kcMensuel,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─── DELETE /api/kc/:id ───────────────────────────────────────────────────────
exports.deleteKCEntry = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id.length < 10) {
      return res.status(400).json({ success: false, error: 'ID invalide' });
    }
    const deleted = await KCReference.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Culture non trouvée dans la base Kc' });
    }
    console.log(`🗑️ KCReference supprimée: "${deleted.culture}"`);
    res.json({ success: true, message: `"${deleted.culture}" supprimée de la base Kc` });
  } catch (error) {
    console.error('❌ Erreur deleteKCEntry:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};