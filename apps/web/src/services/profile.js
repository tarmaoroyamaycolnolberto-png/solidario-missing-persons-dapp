import Web3 from "web3";
import { API_BASE_URL } from "../config";
import { getCurrentProvider } from "../web3";

function normalizeWallet(wallet) {
  return String(wallet || "").trim().toLowerCase();
}

export async function getPublicProfileByWallet(wallet) {
  const normalizedWallet = normalizeWallet(wallet);

  if (!normalizedWallet) {
    return null;
  }

  const res = await fetch(`${API_BASE_URL}/api/profile/${normalizedWallet}`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "No se pudo obtener el perfil público");
  }

  return data?.profile || null;
}

async function getProfileAuthMessage(wallet) {
  const normalizedWallet = normalizeWallet(wallet);

  if (!normalizedWallet) {
    throw new Error("Wallet inválida");
  }

  const res = await fetch(
    `${API_BASE_URL}/api/profile/${normalizedWallet}/auth-message`
  );
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "No se pudo generar el mensaje de firma");
  }

  return data;
}

async function signProfileMessage(message, wallet) {
  const provider = getCurrentProvider();

  if (!provider?.request) {
    throw new Error("Primero conecta tu wallet");
  }

  const account = String(wallet || "").trim();
  const hexMessage = Web3.utils.utf8ToHex(message);

  try {
    return await provider.request({
      method: "personal_sign",
      params: [hexMessage, account],
    });
  } catch (firstError) {
    try {
      return await provider.request({
        method: "personal_sign",
        params: [account, hexMessage],
      });
    } catch {
      throw firstError;
    }
  }
}

export async function savePublicSocials(wallet, socials) {
  const rawWallet = String(wallet || "").trim();
  const normalizedWallet = normalizeWallet(rawWallet);

  if (!normalizedWallet) {
    throw new Error("Wallet inválida");
  }

  const auth = await getProfileAuthMessage(rawWallet);
  const signature = await signProfileMessage(auth.message, rawWallet);

  const res = await fetch(
    `${API_BASE_URL}/api/profile/${normalizedWallet}/socials`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instagram: socials?.instagram || "",
        facebook: socials?.facebook || "",
        twitter: socials?.twitter || "",
        telegram: socials?.telegram || "",
        tiktok: socials?.tiktok || "",
        nonce: auth.nonce,
        signature,
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "No se pudo guardar el perfil público");
  }

  return data?.profile || null;
}

export async function getPublicActivityByWallet(wallet) {
  const profile = await getPublicProfileByWallet(wallet);
  return Array.isArray(profile?.activity) ? profile.activity : [];
}