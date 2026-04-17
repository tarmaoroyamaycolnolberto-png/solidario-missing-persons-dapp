import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import Web3 from "web3";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const serverWeb3 = new Web3();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "../data");
const PROFILES_FILE = path.join(DATA_DIR, "profiles.json");

const PROFILE_AUTH_TTL_MS = 5 * 60 * 1000;
const profileAuthChallenges = new Map();

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
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.error("Error leyendo profiles.json:", error);
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
    id: `public-${type}-${now.getTime()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    type,
    detail,
    source: "public_profile",
    timestamp: now.toISOString(),
    timestampLabel: now.toLocaleString(),
  };
}

function buildProfileSocialsMessage(wallet, nonce) {
  return [
    "Solidario - Actualización de perfil público",
    `Wallet: ${wallet}`,
    `Nonce: ${nonce}`,
    "Acción: guardar redes sociales públicas",
    "Este mensaje no ejecuta transacciones ni consume gas.",
  ].join("\n");
}

function cleanupExpiredProfileChallenges() {
  const now = Date.now();

  for (const [wallet, challenge] of profileAuthChallenges.entries()) {
    if (!challenge?.expiresAt || challenge.expiresAt <= now) {
      profileAuthChallenges.delete(wallet);
    }
  }
}

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.json({ message: "API Missing Global funcionando" });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/profile/:wallet", (req, res) => {
  try {
    const wallet = normalizeWallet(req.params.wallet);

    if (!wallet) {
      return res.status(400).json({
        ok: false,
        error: "Wallet inválida",
      });
    }

    const profiles = readProfiles();
    const profile = profiles[wallet]
      ? ensureProfileShape(profiles[wallet], wallet)
      : null;

    return res.json({
      ok: true,
      profile,
    });
  } catch (error) {
    console.error("Error en GET /api/profile/:wallet:", error);

    return res.status(500).json({
      ok: false,
      error: "Error interno al obtener perfil",
      details: error.message,
    });
  }
});

app.get("/api/profile/:wallet/auth-message", (req, res) => {
  try {
    cleanupExpiredProfileChallenges();

    const wallet = normalizeWallet(req.params.wallet);

    if (!wallet) {
      return res.status(400).json({
        ok: false,
        error: "Wallet inválida",
      });
    }

    const nonce = crypto.randomBytes(16).toString("hex");
    const expiresAt = Date.now() + PROFILE_AUTH_TTL_MS;
    const message = buildProfileSocialsMessage(wallet, nonce);

    profileAuthChallenges.set(wallet, {
      nonce,
      expiresAt,
    });

    return res.json({
      ok: true,
      wallet,
      nonce,
      message,
      expiresAt,
    });
  } catch (error) {
    console.error("Error en GET /api/profile/:wallet/auth-message:", error);

    return res.status(500).json({
      ok: false,
      error: "No se pudo generar el reto de firma",
      details: error.message,
    });
  }
});

app.post("/api/profile/:wallet/socials", async (req, res) => {
  try {
    cleanupExpiredProfileChallenges();

    const wallet = normalizeWallet(req.params.wallet);

    if (!wallet) {
      return res.status(400).json({
        ok: false,
        error: "Wallet inválida",
      });
    }

    const signature = String(req.body?.signature || "").trim();
    const nonce = String(req.body?.nonce || "").trim();

    if (!signature || !nonce) {
      return res.status(401).json({
        ok: false,
        error: "Falta la firma o el nonce de autenticación",
      });
    }

    const storedChallenge = profileAuthChallenges.get(wallet);

    if (!storedChallenge || storedChallenge.nonce !== nonce) {
      return res.status(401).json({
        ok: false,
        error: "Nonce inválido o inexistente",
      });
    }

    if (storedChallenge.expiresAt <= Date.now()) {
      profileAuthChallenges.delete(wallet);

      return res.status(401).json({
        ok: false,
        error: "La firma expiró. Solicita una nueva.",
      });
    }

    const message = buildProfileSocialsMessage(wallet, nonce);

    let recoveredWallet = "";
    try {
      recoveredWallet = normalizeWallet(
        serverWeb3.eth.accounts.recover(message, signature)
      );
    } catch (error) {
      return res.status(401).json({
        ok: false,
        error: "No se pudo verificar la firma",
        details: error.message,
      });
    }

    if (recoveredWallet !== wallet) {
      return res.status(403).json({
        ok: false,
        error: "La firma no pertenece a la wallet del perfil",
      });
    }

    profileAuthChallenges.delete(wallet);

    const socials = {
      instagram: String(req.body?.instagram || "").trim(),
      facebook: String(req.body?.facebook || "").trim(),
      twitter: String(req.body?.twitter || "").trim(),
      telegram: String(req.body?.telegram || "").trim(),
      tiktok: String(req.body?.tiktok || "").trim(),
    };

    const profiles = readProfiles();
    const current = ensureProfileShape(profiles[wallet] || {}, wallet);

    const nextActivity = [
      createPublicActivity(
        "Redes sociales actualizadas",
        "El usuario actualizó sus redes sociales públicas"
      ),
      ...current.activity,
    ];

    profiles[wallet] = {
      ...current,
      wallet,
      socials,
      activity: nextActivity,
      updatedAt: new Date().toISOString(),
    };

    writeProfiles(profiles);

    return res.json({
      ok: true,
      profile: profiles[wallet],
    });
  } catch (error) {
    console.error("Error en POST /api/profile/:wallet/socials:", error);

    return res.status(500).json({
      ok: false,
      error: "Error interno al guardar redes sociales",
      details: error.message,
    });
  }
});

app.post("/api/pinata/upload-image", upload.single("file"), async (req, res) => {
  try {
    if (!process.env.PINATA_JWT) {
      return res.status(500).json({
        error: "Falta configurar PINATA_JWT en el archivo .env",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "No se recibió ninguna imagen",
      });
    }

    if (!req.file.mimetype?.startsWith("image/")) {
      return res.status(400).json({
        error: "El archivo enviado no es una imagen válida",
      });
    }

    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });

    formData.append("file", blob, req.file.originalname);

    const pinataRes = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PINATA_JWT}`,
        },
        body: formData,
      }
    );

    const data = await pinataRes.json();

    if (!pinataRes.ok) {
      return res.status(pinataRes.status).json({
        error: "Pinata devolvió un error al subir la imagen",
        details: data,
      });
    }

    return res.json({
      ok: true,
      cid: data.IpfsHash,
    });
  } catch (error) {
    console.error("Error en /api/pinata/upload-image:", error);

    return res.status(500).json({
      error: "Error interno al subir imagen",
      details: error.message,
    });
  }
});

app.post("/api/pinata/upload-json", async (req, res) => {
  try {
    if (!process.env.PINATA_JWT) {
      return res.status(500).json({
        error: "Falta configurar PINATA_JWT en el archivo .env",
      });
    }

    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        error: "No se recibió metadata JSON",
      });
    }

    const pinataRes = await fetch(
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

    const data = await pinataRes.json();

    if (!pinataRes.ok) {
      return res.status(pinataRes.status).json({
        error: "Pinata devolvió un error al subir la metadata",
        details: data,
      });
    }

    return res.json({
      ok: true,
      cid: data.IpfsHash,
    });
  } catch (error) {
    console.error("Error en /api/pinata/upload-json:", error);

    return res.status(500).json({
      error: "Error interno al subir metadata",
      details: error.message,
    });
  }
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});