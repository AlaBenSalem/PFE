// src/models/Admin.js
const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  fullName:    { type: String, required: true, trim: true },
  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:    { type: String, required: true, minlength: 8 },
  lastLoginAt: { type: Date, default: null },
  createdAt:   { type: Date, default: Date.now },
});

module.exports = mongoose.models.Admin || mongoose.model('Admin', adminSchema);
