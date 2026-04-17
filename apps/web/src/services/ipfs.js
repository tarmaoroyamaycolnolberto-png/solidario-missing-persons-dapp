import {
  API_BASE_URL,
  DEFAULT_IPFS_GATEWAY,
  IPFS_GATEWAYS,
} from "../config";

export function normalizeCID(value) {
  if (!value) return "";
  return String(value).replace("ipfs://", "").trim();
}

export function ipfsToHttp(value) {
  if (!value) return "";

  if (String(value).startsWith("ipfs://")) {
    const cid = normalizeCID(value);
    return `${DEFAULT_IPFS_GATEWAY}/${cid}`;
  }

  return value;
}

export async function fetchJSONFromIPFS(metadataCID) {
  const cleanCID = normalizeCID(metadataCID);

  if (!cleanCID) {
    throw new Error("No existe un metadataCID válido");
  }

  let lastError = null;

  for (const gateway of IPFS_GATEWAYS) {
    const url = `${gateway}/${cleanCID}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`No se pudo obtener metadata desde ${url}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(lastError?.message || "No se pudo obtener metadata desde IPFS");
}

export function buildGalleryFromMetadata(metadata) {
  if (!metadata) return [];

  const gallery = Array.isArray(metadata.gallery) ? metadata.gallery : [];
  const poster = metadata.posterImage || metadata.image;

  const combined = [...gallery];

  if (poster && !combined.includes(poster)) {
    combined.unshift(poster);
  }

  return combined.map(ipfsToHttp).filter(Boolean);
}

export async function uploadImageToBackend(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/api/pinata/upload-image`, {
    method: "POST",
    body: formData,
  });

  let data = {};

  try {
    data = await res.json();
  } catch {
    throw new Error(
      "El servidor no devolvió una respuesta JSON válida al subir la imagen"
    );
  }

  if (!res.ok) {
    throw new Error(
      data.error ||
        data.details?.error ||
        data.details?.message ||
        "Error subiendo imagen al servidor"
    );
  }

  if (!data.cid) {
    throw new Error("El servidor no devolvió un CID válido para la imagen");
  }

  return data.cid;
}

export async function uploadJSONToBackend(jsonData) {
  const res = await fetch(`${API_BASE_URL}/api/pinata/upload-json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(jsonData),
  });

  let data = {};

  try {
    data = await res.json();
  } catch {
    throw new Error(
      "El servidor no devolvió una respuesta JSON válida al subir la metadata"
    );
  }

  if (!res.ok) {
    throw new Error(
      data.error ||
        data.details?.error ||
        data.details?.message ||
        "Error subiendo metadata al servidor"
    );
  }

  if (!data.cid) {
    throw new Error("El servidor no devolvió un CID válido para la metadata");
  }

  return data.cid;
}