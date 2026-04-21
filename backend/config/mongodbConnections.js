const mongoose = require("mongoose");

const CONNECT_OPTIONS = { serverSelectionTimeoutMS: 10000 };

/** Default when MONGODB_URI is unset (same as previous server.js behavior). */
const DEFAULT_PRIMARY_URI = "mongodb://127.0.0.1:27017/smartirrig";

let localConnection = null;

/**
 * If URI has no database name (e.g. mongodb://localhost:27017/), append one so Compass/local works like Atlas.
 * Leaves mongodb+srv and full paths unchanged.
 */
function ensureDatabaseInUri(uri, dbName) {
  const name = dbName || process.env.MONGODB_LOCAL_DB || "smartirrig";
  const u = String(uri || "").trim();
  if (!u) return u;
  if (/^mongodb\+srv:/i.test(u)) return u;

  const protoIdx = u.indexOf("//");
  if (protoIdx === -1) return u;
  const afterProto = u.slice(protoIdx + 2);
  const slashIdx = afterProto.indexOf("/");
  if (slashIdx === -1) {
    return `${u.replace(/\/+$/, "")}/${name}`;
  }
  const pathAndQuery = afterProto.slice(slashIdx + 1);
  if (!pathAndQuery || pathAndQuery === "/") {
    return `${u.replace(/\/+$/, "")}/${name}`;
  }
  return u;
}

function normalizeUriForCompare(uri) {
  return String(uri || "")
    .trim()
    .replace(/\/+$/, "")
    .toLowerCase();
}

/**
 * Primary app database (existing behavior): MONGODB_URI, or localhost fallback.
 */
async function connectPrimary() {
  const uri = process.env.MONGODB_URI || DEFAULT_PRIMARY_URI;
  await mongoose.connect(uri, CONNECT_OPTIONS);
  const isRemote =
    /mongodb\+srv:/i.test(uri) ||
    /\.mongodb\.net/i.test(uri) ||
    (uri !== DEFAULT_PRIMARY_URI && !/localhost|127\.0\.0\.1/i.test(uri));
  console.log(
    `MongoDB primary connected (${isRemote ? "Atlas / remote" : "local URI"})`
  );
}

/**
 * Optional second connection for MongoDB Compass / local dev.
 * Set MONGODB_LOCAL_URI (e.g. mongodb://localhost:27017/) — DB name defaults to smartirrig unless path is present.
 * Set ENABLE_LOCAL_MONGODB=false to skip even if MONGODB_LOCAL_URI is set.
 */
async function connectLocalOptional() {
  if (String(process.env.ENABLE_LOCAL_MONGODB).toLowerCase() === "false") {
    return;
  }

  const raw = process.env.MONGODB_LOCAL_URI;
  if (!raw || !String(raw).trim()) {
    return;
  }

  const localUri = ensureDatabaseInUri(raw.trim());
  const primaryUri = process.env.MONGODB_URI || DEFAULT_PRIMARY_URI;
  if (normalizeUriForCompare(localUri) === normalizeUriForCompare(primaryUri)) {
    console.log(
      "[MongoDB] Local URI matches primary — single connection (no duplicate)."
    );
    return;
  }

  try {
    localConnection = mongoose.createConnection(localUri, CONNECT_OPTIONS);
    await localConnection.asPromise();
    console.log(
      "[MongoDB] Local (Compass) connection ready:",
      localUri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@")
    );
  } catch (err) {
    console.warn(
      "[MongoDB] Local connection failed — app continues on primary only:",
      err.message
    );
    localConnection = null;
  }
}

async function connectAllMongo() {
  await connectPrimary();
  await connectLocalOptional();
}

function getLocalConnection() {
  return localConnection;
}

module.exports = {
  connectAllMongo,
  connectPrimary,
  connectLocalOptional,
  getLocalConnection,
  ensureDatabaseInUri,
  DEFAULT_PRIMARY_URI,
  CONNECT_OPTIONS,
};
