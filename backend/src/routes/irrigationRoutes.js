// src/routes/irrigationRoutes.js
const express                    = require('express');
const router                     = express.Router();
const irrigationController       = require('../controllers/irrigationController');
const { optionalAuth, requireAuth } = require('../middleware/auth');

router.get('/',                           optionalAuth, irrigationController.getAllIrrigations);
router.get('/today',                      optionalAuth, irrigationController.getTodayIrrigations);
router.get('/calculate-needs/:cultureId', optionalAuth, irrigationController.calculateIrrigationNeeds);
router.get('/culture/:cultureId',         optionalAuth, irrigationController.getIrrigationsByCulture);
router.get('/etc-history/:cultureId',     optionalAuth, irrigationController.getETcHistory);
router.get('/:id',                        optionalAuth, irrigationController.getIrrigationById);
router.post('/',                          requireAuth,  irrigationController.createIrrigation);
router.put('/:id',                        requireAuth,  irrigationController.updateIrrigation);
router.delete('/:id',                     requireAuth,  irrigationController.deleteIrrigation);

module.exports = router;
