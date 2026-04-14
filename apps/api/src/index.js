import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";

dotenv.config();

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB por archivo
  },
});

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.json({ message: "API Missing Global funcionando" });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
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

    const pinataRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PINATA_JWT}`,
      },
      body: formData,
    });

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

    const pinataRes = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.PINATA_JWT}`,
      },
      body: JSON.stringify(req.body),
    });

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