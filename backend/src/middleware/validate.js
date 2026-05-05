// src/middleware/validate.js — express-validator error handler
const { validationResult, body } = require('express-validator');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

// ── Reusable validator chains ─────────────────────────────────────────────────

const registerValidators = [
  body('firstName').trim().notEmpty().withMessage('Le prénom est requis.')
    .isLength({ min: 2 }).withMessage('Le prénom doit contenir au moins 2 caractères.'),
  body('lastName').trim().notEmpty().withMessage('Le nom est requis.')
    .isLength({ min: 2 }).withMessage('Le nom doit contenir au moins 2 caractères.'),
  body('address').trim().notEmpty().withMessage("L'adresse est requise.")
    .isLength({ min: 5 }).withMessage("L'adresse doit contenir au moins 5 caractères."),
  body('email').trim().isEmail().withMessage('Email invalide.').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères.'),
];

const loginValidators = [
  body('email').trim().isEmail().withMessage('Email invalide.').normalizeEmail(),
  body('password').notEmpty().withMessage('Le mot de passe est requis.'),
];

const forgotPasswordValidators = [
  body('email').trim().isEmail().withMessage('Email invalide.').normalizeEmail(),
];

const resetPasswordValidators = [
  body('email').trim().isEmail().withMessage('Email invalide.').normalizeEmail(),
  body('code').trim().notEmpty().withMessage('Le code est requis.'),
  body('newPassword').isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères.'),
];

const cultureValidators = [
  body('nom').trim().notEmpty().withMessage('Le nom de la culture est requis.'),
  body('surface').optional({ nullable: true })
    .isFloat({ min: 0.01 }).withMessage('La surface doit être un nombre positif.'),
  body('nombreArbres').optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Le nombre d\'arbres doit être un entier positif.'),
];

const messageValidators = [
  body('body').optional().trim(),
  body('message').optional().trim(),
  body().custom((_, { req }) => {
    const text = String(req.body?.body ?? req.body?.message ?? '').trim();
    if (text.length < 4) throw new Error('Le message doit contenir au moins 4 caractères.');
    return true;
  }),
];

module.exports = {
  validate,
  registerValidators,
  loginValidators,
  forgotPasswordValidators,
  resetPasswordValidators,
  cultureValidators,
  messageValidators,
};
