import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import Web3 from "web3";
import { fileURLToPath } from "url";
import FormData from "form-data";
import fetch from "node-fetch";

dotenv.config();

const app = express();
const serverWeb3 = new Web3();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "../data");
const PROFILES_FILE = path.join(DATA_DIR, "profiles.json");

const PROFILE_AUTH_TTL_MS = 5 * 60 * 1000;
const profileAuthChallenges = new Map();

/* =========================
   UTILIDADES
========================= */

function ensureProfilesStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(PROFILES_FILE)) {
    fs.writeFileSync(PROFILES_FILE, JSON.stringify({}, null, 2), "utf-8");
  }
}

function normalizeWallet(value) {
  return String(value || "").trim().toLowerCase();
}

function readProfiles() {
  ensureProfilesStorage();
  try {
    const raw = fs.readFileSync(PROFILES_FILE, "utf-8");
    return JSON.parse(raw) || {};
  } catch (err) {
    console.error("❌ Error leyendo profiles:", err);
    return {};
  }
}

function writeProfiles(data) {
  ensureProfilesStorage();
  fs.writeFileSync(PROFILES_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function ensureProfileShape(profile = {}, wallet = "") {
  return {
    wallet,
    socials: profile.socials || {
      instagram: "",
      facebook: "",
      twitter: "",
      telegram: "",
      tiktok: "",
    },
    activity: Array.isArray(profile.activity) ? profile.activity : [],
    updatedAt: profile.updatedAt || null,
  };
}

function createPublicActivity(type, detail) {
  const now = new Date();
  return {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    detail,
    timestamp: now.toISOString(),
    timestampLabel: now.toLocaleString(),
  };
}

function buildMessage(wallet, nonce) {
  return [
    "Solidario - Actualización de perfil público",
    `Wallet: ${wallet}`,
    `Nonce: ${nonce}`,
    "Acción: guardar redes sociales públicas",
    "Este mensaje no ejecuta transacciones ni consume gas.",
  ].join("\n");
}

function cleanupChallenges() {
  const now = Date.now();
  for (const [wallet, data] of profileAuthChallenges.entries()) {
    if (data.expiresAt <= now) {
      profileAuthChallenges.delete(wallet);
    }
  }
}

/* =========================
   CORS (FIX)
========================= */

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = [
        "http://localhost:5173",
        "https://solidario-missing-persons-dapp.vercel.app",
        "https://solidario-missing-persons-dapp.onrender.com",
      ];

      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        console.log("❌ CORS bloqueado:", origin);
        callback(new Error("No permitido por CORS"));
      }
    },
  })
);

app.use(express.json({ limit: "10mb" }));

/* =========================
   HEALTH
========================= */

app.get("/", (req, res) => {
  res.json({ ok: true, message: "API funcionando" });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/* =========================
   PROFILE GET
========================= */

app.get("/api/profile/:wallet", (req, res) => {
  try {
    const wallet = normalizeWallet(req.params.wallet);
    if (!wallet) throw new Error("Wallet inválida");

    const profiles = readProfiles();
    const profile = profiles[wallet]
      ? ensureProfileShape(profiles[wallet], wallet)
      : null;

    res.json({ ok: true, profile });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* =========================
   AUTH MESSAGE
========================= */

app.get("/api/profile/:wallet/auth-message", (req, res) => {
  try {
    cleanupChallenges();

    const wallet = normalizeWallet(req.params.wallet);
    if (!wallet) throw new Error("Wallet inválida");

    const nonce = crypto.randomBytes(16).toString("hex");
    const expiresAt = Date.now() + PROFILE_AUTH_TTL_MS;
    const message = buildMessage(wallet, nonce);

    profileAuthChallenges.set(wallet, { nonce, expiresAt });

    res.json({ ok: true, wallet, nonce, message, expiresAt });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* =========================
   SAVE SOCIALS (FIRMA)
========================= */

app.post("/api/profile/:wallet/socials", async (req, res) => {
  try {
    cleanupChallenges();

    const wallet = normalizeWallet(req.params.wallet);
    const { signature, nonce } = req.body;

    if (!wallet || !signature || !nonce) {
      return res.status(400).json({ ok: false, error: "Datos incompletos" });
    }

    const challenge = profileAuthChallenges.get(wallet);
    if (!challenge || challenge.nonce !== nonce) {
      return res.status(401).json({ ok: false, error: "Nonce inválido" });
    }

    if (challenge.expiresAt < Date.now()) {
      profileAuthChallenges.delete(wallet);
      return res.status(401).json({ ok: false, error: "Expirado" });
    }

    const message = buildMessage(wallet, nonce);

    const recovered = normalizeWallet(
      serverWeb3.eth.accounts.recover(message, signature)
    );

    if (recovered !== wallet) {
      return res.status(403).json({ ok: false, error: "Firma inválida" });
    }

    profileAuthChallenges.delete(wallet);

    const profiles = readProfiles();
    const current = ensureProfileShape(profiles[wallet], wallet);

    profiles[wallet] = {
      ...current,
      socials: req.body.socials || current.socials,
      activity: [
        createPublicActivity("socials", "Redes actualizadas"),
        ...current.activity,
      ],
      updatedAt: new Date().toISOString(),
    };

    writeProfiles(profiles);

    res.json({ ok: true, profile: profiles[wallet] });
  } catch (err) {
    console.error("🔥 ERROR socials:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* =========================
   PINATA IMAGE (FIX NODE)
========================= */

app.post("/api/pinata/upload-image", upload.single("file"), async (req, res) => {
  try {
    if (!process.env.PINATA_JWT) {
      throw new Error("Falta PINATA_JWT");
    }

    if (!req.file) {
      throw new Error("No hay archivo");
    }

    const formData = new FormData();
    formData.append("file", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    const response = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PINATA_JWT}`,
        },
        body: formData,
      }
    );

    const data = await response.json();

    res.json({ ok: true, cid: data.IpfsHash });
  } catch (err) {
    console.error("🔥 Pinata image:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* =========================
   PINATA JSON
========================= */

app.post("/api/pinata/upload-json", async (req, res) => {
  try {
    const response = await fetch(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.PINATA_JWT}`,
        },
        body: JSON.stringify(req.body),
      }
    );

    const data = await response.json();

    res.json({ ok: true, cid: data.IpfsHash });
  } catch (err) {
    console.error("🔥 Pinata JSON:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* =========================
   ERROR GLOBAL
========================= */

app.use((err, req, res, next) => {
  console.error("🔥 ERROR GLOBAL:", err.message);
  res.status(500).json({ ok: false, error: err.message });
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Server listo en http://localhost:${PORT}`);
});