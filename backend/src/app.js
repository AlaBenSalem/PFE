// src/app.js — Express application setup
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const logger     = require('./utils/logger');

const authRoutes          = require('./routes/authRoutes');
const weatherRoutes       = require('./routes/weatherRoutes');
const kcRoutes            = require('./routes/kcRoutes');
const cultureRoutes       = require('./routes/cultureRoutes');
const irrigationRoutes    = require('./routes/irrigationRoutes');
const fertilisationRoutes = require('./routes/fertilisationRoutes');
const adminRoutes         = require('./routes/adminRoutes');
const userRoutes          = require('./routes/userRoutes');
const messageRoutes       = require('./routes/messageRoutes');
const aiRoutes            = require('./routes/aiRoutes');

const app = express();

app.use(helmet());

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:8081', 'http://localhost:19006'];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(morgan('dev', { stream: { write: msg => logger.http(msg.trim()) } }));

// ── Rate limiters ─────────────────────────────────────────────────────────────
const authLimiter    = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const aiChatLimiter  = rateLimit({ windowMs: 60 * 1000,      max: 30, standardHeaders: true, legacyHeaders: false });
const aiTtsLimiter   = rateLimit({ windowMs: 60 * 1000,      max: 20, standardHeaders: true, legacyHeaders: false });
const messageLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',           authLimiter,    authRoutes);
app.use('/api/weather',                        weatherRoutes);
app.use('/api/kc',                             kcRoutes);
app.use('/api/cultures',                       cultureRoutes);
app.use('/api/irrigations',                    irrigationRoutes);
app.use('/api/fertilisations',                 fertilisationRoutes);
app.use('/api/admin',                          adminRoutes);
app.use('/api/users',                          userRoutes);
app.use('/api/messages',       messageLimiter, messageRoutes);
app.use('/api/ai/chat',        aiChatLimiter);
app.use('/api/ai/tts',         aiTtsLimiter);
app.use('/api/ai',                             aiRoutes);

module.exports = app;
