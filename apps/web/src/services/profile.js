const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:4000";

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

export async function savePublicSocials(wallet, socials) {
  const normalizedWallet = normalizeWallet(wallet);

  if (!normalizedWallet) {
    throw new Error("Wallet inválida");
  }

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