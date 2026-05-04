// src/routes/aiRoutes.js
const express       = require('express');
const router        = express.Router();
const { requireAuth } = require('../middleware/auth');
const aiController  = require('../controllers/aiController');

router.post('/chat',   requireAuth, aiController.chat);
router.post('/tts',    requireAuth, aiController.tts);
router.get('/status',              aiController.status);

module.exports = router;
