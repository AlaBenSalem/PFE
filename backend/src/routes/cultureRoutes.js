// src/routes/cultureRoutes.js
const express            = require('express');
const router             = express.Router();
const cultureController  = require('../controllers/cultureController');
const { optionalAuth }   = require('../middleware/auth');
const { validate, cultureValidators } = require('../middleware/validate');

router.get('/',       optionalAuth, cultureController.getAllCultures);
router.get('/:id',    optionalAuth, cultureController.getCultureById);
router.post('/',      optionalAuth, cultureValidators, validate, cultureController.createCulture);
router.delete('/:id', optionalAuth, cultureController.deleteCulture);

module.exports = router;
