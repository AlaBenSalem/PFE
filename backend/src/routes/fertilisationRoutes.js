// src/routes/fertilisationRoutes.js
const express          = require('express');
const router           = express.Router();
const ctrl             = require('../controllers/fertilisationController');
const { requireAuth }  = require('../middleware/auth');

router.get('/',            requireAuth, ctrl.getFertilisations);
router.get('/prochaines',  requireAuth, ctrl.getProchaines);
router.get('/:id',         requireAuth, ctrl.getFertilisationById);
router.post('/',           requireAuth, ctrl.createFertilisation);
router.put('/:id',         requireAuth, ctrl.updateFertilisation);
router.delete('/:id',      requireAuth, ctrl.deleteFertilisation);

module.exports = router;
