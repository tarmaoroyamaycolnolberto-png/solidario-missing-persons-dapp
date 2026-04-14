import { useEffect, useMemo, useState } from "react";
import {
  getCasesCreatedByAccount,
  getUserActivityFromEvents,
  updateCaseStatusOnChain,
} from "../services/contract";
import { getCurrentProvider, switchToActiveNetwork } from "../web3";
import { ACTIVE_NETWORK } from "../config";

const EMPTY_SOCIALS = {
  instagram: "",
  facebook: "",
  twitter: "",
  telegram: "",
  tiktok: "",
};

function CloseIcon() {
  return (
    <svg
      className="user-modal-close-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PosterIcon() {
  return (
    <svg
      className="user-modal-section-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M8 15L10.6 12.4C11.02 11.98 11.7 11.95 12.16 12.34L16 15.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="9" r="1.2" fill="currentColor" />
    </svg>
  );
}

function SocialIcon() {
  return (
    <svg
      className="user-modal-section-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="6" cy="12" r="2" fill="currentColor" />
      <circle cx="18" cy="7" r="2" fill="currentColor" />
      <circle cx="18" cy="17" r="2" fill="currentColor" />
      <path d="M8 11L16 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 13L16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg
      className="user-modal-section-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 12H8L10.5 7L13.5 17L16 12H20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      className="user-poster-nav-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M15 18L9 12L15 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      className="user-poster-nav-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9 18L15 12L9 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      className="user-inline-link-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M14 5H19V10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 14L19 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 14V17C19 18.1046 18.1046 19 17 19H7C5.89543 19 5 18.1046 5 17V7C5 5.89543 5.89543 5 7 5H10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatAddress(address) {
  if (!address) return "Sin wallet conectada";
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function normalizeCID(value) {
  if (!value) return "";
  return String(value).replace("ipfs://", "").trim();
}

function getSocialStorageKey(account) {
  return `solidario-profile-socials-${String(account).toLowerCase()}`;
}

function getActivityStorageKey(account) {
  return `solidario-profile-activity-${String(account).toLowerCase()}`;
}

function loadStoredSocials(account) {
  if (!account || typeof window === "undefined") return EMPTY_SOCIALS;

  try {
    const raw = localStorage.getItem(getSocialStorageKey(account));
    if (!raw) return EMPTY_SOCIALS;

    const parsed = JSON.parse(raw);

    return {
      instagram: parsed?.instagram || "",
      facebook: parsed?.facebook || "",
      twitter: parsed?.twitter || "",
      telegram: parsed?.telegram || "",
      tiktok: parsed?.tiktok || "",
    };
  } catch {
    return EMPTY_SOCIALS;
  }
}

function saveStoredSocials(account, socials) {
  if (!account || typeof window === "undefined") return;
  localStorage.setItem(getSocialStorageKey(account), JSON.stringify(socials));
}

function loadStoredActivity(account) {
  if (!account || typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(getActivityStorageKey(account));
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredActivity(account, activity) {
  if (!account || typeof window === "undefined") return;
  localStorage.setItem(getActivityStorageKey(account), JSON.stringify(activity));
}

function createActivityEntry(type, detail, source = "local") {
  const now = new Date();
  return {
    id: `${source}-${type}-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    detail,
    source,
    timestamp: now.toISOString(),
    timestampLabel: now.toLocaleString(),
  };
}

function buildExplorerBaseUrl() {
  return (
    ACTIVE_NETWORK?.blockExplorerUrls?.[0]?.replace(/\/$/, "") ||
    "https://bscscan.com"
  );
}

function buildTxUrl(txHash) {
  if (!txHash) return "";
  return `${buildExplorerBaseUrl()}/tx/${txHash}`;
}

function buildSocialUrl(type, value) {
  const clean = String(value || "").trim();
  if (!clean) return "";

  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    return clean;
  }

  switch (type) {
    case "instagram":
      return clean.startsWith("@")
        ? `https://instagram.com/${clean.replace("@", "")}`
        : `https://instagram.com/${clean}`;
    case "facebook":
      return clean.startsWith("@")
        ? `https://facebook.com/${clean.replace("@", "")}`
        : `https://facebook.com/${clean.replace("facebook.com/", "")}`;
    case "twitter":
      return clean.startsWith("@")
        ? `https://x.com/${clean.replace("@", "")}`
        : `https://x.com/${clean}`;
    case "telegram":
      return clean.startsWith("@")
        ? `https://t.me/${clean.replace("@", "")}`
        : `https://t.me/${clean}`;
    case "tiktok":
      return clean.startsWith("@")
        ? `https://www.tiktok.com/${clean}`
        : `https://www.tiktok.com/@${clean}`;
    default:
      return clean;
  }
}

async function fetchMetadataByCID(metadataCID) {
  const cleanCID = normalizeCID(metadataCID);

  if (!cleanCID) {
    throw new Error("No existe un metadataCID válido");
  }

  const gateways = [
    `https://gateway.pinata.cloud/ipfs/${cleanCID}`,
    `https://ipfs.io/ipfs/${cleanCID}`,
    `https://cloudflare-ipfs.com/ipfs/${cleanCID}`,
  ];

  let lastError = null;

  for (const url of gateways) {
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

  throw new Error(lastError?.message || "No se pudo obtener metadata");
}

function ipfsToHttp(value) {
  if (!value) return "";
  if (value.startsWith("ipfs://")) {
    return `https://gateway.pinata.cloud/ipfs/${value.replace("ipfs://", "")}`;
  }
  return value;
}

function getStatusLabel(status) {
  return Number(status) === 1 ? "Encontrado" : "Desaparecido";
}

function getStatusClass(status) {
  return Number(status) === 1 ? "found" : "missing";
}

function getNextStatus(status) {
  return Number(status) === 1 ? 0 : 1;
}

function getChangeStatusButtonText(status) {
  return Number(status) === 1
    ? "Marcar como desaparecido"
    : "Marcar como encontrado";
}

function getActivitySourceClass(source) {
  return source === "blockchain" ? "blockchain" : "local";
}

function getActivitySourceLabel(source) {
  return source === "blockchain" ? "Blockchain" : "Local";
}

function UserDashboardModal({
  isOpen,
  onClose,
  account,
  viewerAccount,
  setMessage = () => {},
}) {
  const [activeTab, setActiveTab] = useState("posters");
  const [myCases, setMyCases] = useState([]);
  const [isLoadingCases, setIsLoadingCases] = useState(false);
  const [activePosterIndex, setActivePosterIndex] = useState(0);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [chainId, setChainId] = useState("");

  const [socials, setSocials] = useState(EMPTY_SOCIALS);
  const [isSavingSocials, setIsSavingSocials] = useState(false);
  const [socialsSavedAt, setSocialsSavedAt] = useState("");

  const [activityLog, setActivityLog] = useState([]);
  const [chainActivity, setChainActivity] = useState([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  const isOwnProfile =
    viewerAccount &&
    account &&
    String(viewerAccount).toLowerCase() === String(account).toLowerCase();

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab("posters");
    }
  }, [isOpen]);

  useEffect(() => {
    async function syncChain() {
      try {
        const provider = getCurrentProvider();
        if (!provider?.request) {
          setChainId("");
          return;
        }

        const currentChainId = await provider.request({
          method: "eth_chainId",
        });
        setChainId(currentChainId);
      } catch {
        setChainId("");
      }
    }

    if (isOpen) {
      syncChain();
    }
  }, [isOpen, viewerAccount]);

  useEffect(() => {
    if (!isOpen) return;

    if (!account) {
      setSocials(EMPTY_SOCIALS);
      setSocialsSavedAt("");
      setActivityLog([]);
      setChainActivity([]);
      return;
    }

    setSocials(loadStoredSocials(account));
    setActivityLog(loadStoredActivity(account));
    setSocialsSavedAt("");
  }, [isOpen, account]);

  async function loadMyCases() {
    if (!account) {
      setMyCases([]);
      setActivePosterIndex(0);
      return;
    }

    try {
      setIsLoadingCases(true);

      const cases = await getCasesCreatedByAccount(account);
      const enrichedCases = await Promise.all(
        cases.map(async (item) => {
          try {
            const metadata = await fetchMetadataByCID(item.metadataCID);

            return {
              ...item,
              metadata,
            };
          } catch (error) {
            console.error(`Error cargando metadata del caso ${item.id}:`, error);

            return {
              ...item,
              metadata: null,
            };
          }
        })
      );

      setMyCases(enrichedCases);
      setActivePosterIndex((prev) => {
        if (!enrichedCases.length) return 0;
        return Math.min(prev, enrichedCases.length - 1);
      });

      setIsLoadingActivity(true);
      const events = await getUserActivityFromEvents(
        account,
        enrichedCases.map((item) => item.id)
      );
      setChainActivity(events);
    } catch (error) {
      console.error(error);
      setMyCases([]);
      setChainActivity([]);
    } finally {
      setIsLoadingCases(false);
      setIsLoadingActivity(false);
    }
  }

  useEffect(() => {
    if (!isOpen || !account) {
      setMyCases([]);
      setActivePosterIndex(0);
      setChainActivity([]);
      return;
    }

    loadMyCases();
  }, [isOpen, account]);

  const activePoster = useMemo(() => {
    if (!myCases.length) return null;
    return myCases[activePosterIndex] || myCases[0];
  }, [myCases, activePosterIndex]);

  const isCorrectNetwork = chainId === ACTIVE_NETWORK.chainId;

  function appendActivity(entry) {
    if (!account) return;

    setActivityLog((prev) => {
      const next = [entry, ...prev];
      saveStoredActivity(account, next);
      return next;
    });
  }

  const mergedActivity = useMemo(() => {
    const combined = [...activityLog, ...chainActivity];

    return combined.sort((a, b) => {
      if (a.timestamp && b.timestamp) {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }
      if (a.timestamp && !b.timestamp) return -1;
      if (!a.timestamp && b.timestamp) return 1;
      return 0;
    });
  }, [activityLog, chainActivity]);

  const socialEntries = useMemo(() => {
    return [
      { key: "instagram", label: "Instagram", value: socials.instagram },
      { key: "facebook", label: "Facebook", value: socials.facebook },
      { key: "twitter", label: "X / Twitter", value: socials.twitter },
      { key: "telegram", label: "Telegram", value: socials.telegram },
      { key: "tiktok", label: "TikTok", value: socials.tiktok },
    ];
  }, [socials]);

  function handlePrevPoster() {
    setActivePosterIndex((prev) => {
      if (prev === 0) return myCases.length - 1;
      return prev - 1;
    });
  }

  function handleNextPoster() {
    setActivePosterIndex((prev) => {
      if (prev === myCases.length - 1) return 0;
      return prev + 1;
    });
  }

  function handleSocialChange(field, value) {
    if (!isOwnProfile) return;

    setSocials((prev) => ({
      ...prev,
      [field]: value,
    }));
    setSocialsSavedAt("");
  }

  async function handleSaveSocials() {
    if (!account || !isOwnProfile || isSavingSocials) return;

    try {
      setIsSavingSocials(true);

      const normalized = {
        instagram: socials.instagram.trim(),
        facebook: socials.facebook.trim(),
        twitter: socials.twitter.trim(),
        telegram: socials.telegram.trim(),
        tiktok: socials.tiktok.trim(),
      };

      saveStoredSocials(account, normalized);
      setSocials(normalized);

      const now = new Date();
      const timeText = now.toLocaleString();

      setSocialsSavedAt(timeText);

      appendActivity(
        createActivityEntry(
          "Redes sociales",
          "Se actualizaron las redes sociales del perfil",
          "local"
        )
      );

      setMessage("Redes sociales guardadas correctamente");
    } catch (error) {
      console.error(error);
      setMessage("No se pudieron guardar las redes sociales");
    } finally {
      setIsSavingSocials(false);
    }
  }

  async function handleSwitchNetwork() {
    try {
      setMessage("Cambiando a BNB Smart Chain...");
      await switchToActiveNetwork();
      const provider = getCurrentProvider();

      if (provider?.request) {
        const currentChainId = await provider.request({
          method: "eth_chainId",
        });
        setChainId(currentChainId);
      }

      setMessage("Red actualizada correctamente");
    } catch (error) {
      console.error(error);
      setMessage(error.message || "No se pudo cambiar de red");
    }
  }

  async function handleToggleStatus() {
    if (!activePoster || !account || !isOwnProfile || isUpdatingStatus) return;

    try {
      if (!isCorrectNetwork) {
        throw new Error("Tu wallet debe estar en BNB Smart Chain");
      }

      setIsUpdatingStatus(true);

      const nextStatus = getNextStatus(activePoster.status);

      setMessage("Actualizando estado del afiche en blockchain...");
      await updateCaseStatusOnChain(activePoster.id, nextStatus, viewerAccount);

      setMyCases((prev) =>
        prev.map((item) =>
          item.id === activePoster.id
            ? {
                ...item,
                status: nextStatus,
                active: nextStatus === 0,
              }
            : item
        )
      );

      appendActivity(
        createActivityEntry(
          "Cambio de estado",
          `Caso #${activePoster.id} marcado como ${getStatusLabel(nextStatus)}`,
          "local"
        )
      );

      setMessage(
        nextStatus === 1
          ? "Caso actualizado a Encontrado"
          : "Caso actualizado a Desaparecido"
      );
    } catch (error) {
      console.error(error);
      setMessage(error.message || "No se pudo actualizar el estado");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  if (!isOpen) return null;

  const posterImage = ipfsToHttp(
    activePoster?.metadata?.posterImage ||
      activePoster?.metadata?.image ||
      activePoster?.metadata?.gallery?.[0] ||
      ""
  );

  return (
    <div
      className="user-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-dashboard-title"
    >
      <div
        className="user-modal-card improved-user-modal-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="user-modal-header">
          <div className="user-modal-header-copy">
            <p className="user-modal-eyebrow">Panel del usuario</p>
            <h2 id="user-dashboard-title" className="user-modal-title">
              {isOwnProfile ? "Mi espacio en Solidario" : "Perfil del usuario"}
            </h2>
            <p className="user-modal-subtitle">
              {isOwnProfile
                ? "Administra tus afiches, tu perfil social y tu historial en un solo lugar."
                : "Consulta los afiches, redes públicas y actividad asociada a esta wallet."}
            </p>
          </div>

          <button
            type="button"
            className="user-modal-close-button"
            onClick={onClose}
            aria-label="Cerrar panel del usuario"
            title="Cerrar"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="user-modal-profile-bar">
          <div className="user-modal-profile-chip">
            <span className="wallet-dot" />
            {account
              ? isOwnProfile
                ? "Mi wallet"
                : "Wallet del perfil"
              : "Wallet no disponible"}
          </div>

          <div className="user-modal-wallet-box">
            <span className="user-modal-wallet-label">Cuenta</span>
            <span className="user-modal-wallet-value">
              {account || "Wallet no disponible"}
            </span>
            {account && (
              <span className="user-modal-wallet-short">
                {formatAddress(account)}
              </span>
            )}
          </div>
        </div>

        {!isOwnProfile && account && (
          <div className="user-profile-readonly-banner">
            Estás viendo un perfil público. Solo el dueño de esta wallet puede editar afiches y redes sociales.
          </div>
        )}

        <div className="user-modal-tabs">
          <button
            type="button"
            className={`user-modal-tab ${activeTab === "posters" ? "active" : ""}`}
            onClick={() => setActiveTab("posters")}
          >
            <PosterIcon />
            <span>{isOwnProfile ? "Mis afiches" : "Afiches"}</span>
          </button>

          <button
            type="button"
            className={`user-modal-tab ${activeTab === "socials" ? "active" : ""}`}
            onClick={() => setActiveTab("socials")}
          >
            <SocialIcon />
            <span>{isOwnProfile ? "Mis redes" : "Redes públicas"}</span>
          </button>

          <button
            type="button"
            className={`user-modal-tab ${activeTab === "activity" ? "active" : ""}`}
            onClick={() => setActiveTab("activity")}
          >
            <ActivityIcon />
            <span>Actividad</span>
          </button>
        </div>

        <div className="user-modal-tab-content">
          {activeTab === "posters" && (
            <section className="user-modal-panel user-modal-panel-single">
              <div className="user-modal-panel-head">
                <PosterIcon />
                <h3 className="user-modal-panel-title">
                  {isOwnProfile ? "Mis afiches" : "Afiches publicados"}
                </h3>
              </div>

              <p className="user-modal-panel-text">
                {isOwnProfile
                  ? "Aquí puedes revisar los casos creados con tu wallet y cambiar su estado."
                  : "Aquí puedes revisar los casos publicados por esta wallet."}
              </p>

              {isLoadingCases ? (
                <div className="user-modal-placeholder">Cargando afiches...</div>
              ) : !account ? (
                <div className="user-modal-placeholder">
                  No hay wallet disponible para mostrar afiches.
                </div>
              ) : myCases.length === 0 ? (
                <div className="user-modal-placeholder">
                  Esta wallet todavía no ha publicado afiches.
                </div>
              ) : (
                <div className="user-poster-carousel">
                  {isOwnProfile && !isCorrectNetwork && (
                    <div className="user-poster-network-warning">
                      <div className="user-poster-network-copy">
                        <strong>Red incorrecta</strong>
                        <p>
                          Cambia tu wallet a {ACTIVE_NETWORK.chainName} para poder
                          actualizar el estado del afiche.
                        </p>
                      </div>

                      <button
                        type="button"
                        className="secondary-button user-poster-network-button"
                        onClick={handleSwitchNetwork}
                      >
                        Cambiar red
                      </button>
                    </div>
                  )}

                  <div className="user-poster-stage">
                    <div className="user-poster-media">
                      {posterImage ? (
                        <img
                          src={posterImage}
                          alt={activePoster?.metadata?.name || `Caso ${activePoster?.id}`}
                          className="user-poster-image"
                        />
                      ) : (
                        <div className="user-poster-image-empty">
                          Sin imagen disponible
                        </div>
                      )}
                    </div>

                    <div className="user-poster-info">
                      <div className="user-poster-top">
                        <div>
                          <h4 className="user-poster-name">
                            {activePoster?.metadata?.name || "Sin nombre"}
                          </h4>
                          <p className="user-poster-location">
                            {activePoster?.metadata?.country || "País no definido"}
                            {activePoster?.metadata?.city
                              ? ` · ${activePoster.metadata.city}`
                              : ""}
                          </p>
                        </div>

                        <span
                          className={`user-poster-status ${getStatusClass(
                            activePoster?.status
                          )}`}
                        >
                          {getStatusLabel(activePoster?.status)}
                        </span>
                      </div>

                      <div className="user-poster-meta-grid">
                        <div className="user-poster-meta-box">
                          <span className="user-poster-meta-label">ID del caso</span>
                          <span className="user-poster-meta-value">
                            #{activePoster?.id}
                          </span>
                        </div>

                        <div className="user-poster-meta-box">
                          <span className="user-poster-meta-label">Edad</span>
                          <span className="user-poster-meta-value">
                            {activePoster?.metadata?.age ?? "—"}
                          </span>
                        </div>

                        <div className="user-poster-meta-box user-poster-meta-box-full">
                          <span className="user-poster-meta-label">Contacto</span>
                          <span className="user-poster-meta-value">
                            {activePoster?.metadata?.contact || "No definido"}
                          </span>
                        </div>
                      </div>

                      <div className="user-poster-actions">
                        <button
                          type="button"
                          className="secondary-button user-poster-nav-button"
                          onClick={handlePrevPoster}
                          disabled={myCases.length <= 1}
                        >
                          <ChevronLeftIcon />
                          <span>Anterior</span>
                        </button>

                        <span className="user-poster-counter">
                          {activePosterIndex + 1} / {myCases.length}
                        </span>

                        <button
                          type="button"
                          className="secondary-button user-poster-nav-button"
                          onClick={handleNextPoster}
                          disabled={myCases.length <= 1}
                        >
                          <span>Siguiente</span>
                          <ChevronRightIcon />
                        </button>
                      </div>

                      {isOwnProfile ? (
                        <button
                          type="button"
                          className="primary-button user-poster-status-button"
                          onClick={handleToggleStatus}
                          disabled={!isCorrectNetwork || isUpdatingStatus}
                        >
                          {isUpdatingStatus
                            ? "Actualizando..."
                            : getChangeStatusButtonText(activePoster?.status)}
                        </button>
                      ) : (
                        <div className="user-readonly-note">
                          Solo el dueño del perfil puede cambiar el estado del afiche.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {activeTab === "socials" && (
            <section className="user-modal-panel user-modal-panel-single">
              <div className="user-modal-panel-head">
                <SocialIcon />
                <h3 className="user-modal-panel-title">Redes sociales</h3>
              </div>

              <p className="user-modal-panel-text">
                {isOwnProfile
                  ? "Edita tus redes y además accede rápidamente a tus enlaces activos."
                  : "Estas son las redes públicas visibles para esta wallet."}
              </p>

              <div className="user-social-form">
                <div className="user-social-field">
                  <label className="user-social-label">Instagram</label>
                  <input
                    className="form-input user-social-input"
                    type="text"
                    placeholder="@tuusuario"
                    value={socials.instagram}
                    onChange={(e) => handleSocialChange("instagram", e.target.value)}
                    disabled={!isOwnProfile || isSavingSocials}
                  />
                </div>

                <div className="user-social-field">
                  <label className="user-social-label">Facebook</label>
                  <input
                    className="form-input user-social-input"
                    type="text"
                    placeholder="facebook.com/tu-perfil"
                    value={socials.facebook}
                    onChange={(e) => handleSocialChange("facebook", e.target.value)}
                    disabled={!isOwnProfile || isSavingSocials}
                  />
                </div>

                <div className="user-social-field">
                  <label className="user-social-label">X / Twitter</label>
                  <input
                    className="form-input user-social-input"
                    type="text"
                    placeholder="@tuusuario"
                    value={socials.twitter}
                    onChange={(e) => handleSocialChange("twitter", e.target.value)}
                    disabled={!isOwnProfile || isSavingSocials}
                  />
                </div>

                <div className="user-social-field">
                  <label className="user-social-label">Telegram</label>
                  <input
                    className="form-input user-social-input"
                    type="text"
                    placeholder="@tuusuario"
                    value={socials.telegram}
                    onChange={(e) => handleSocialChange("telegram", e.target.value)}
                    disabled={!isOwnProfile || isSavingSocials}
                  />
                </div>

                <div className="user-social-field user-social-field-full">
                  <label className="user-social-label">TikTok</label>
                  <input
                    className="form-input user-social-input"
                    type="text"
                    placeholder="@tuusuario"
                    value={socials.tiktok}
                    onChange={(e) => handleSocialChange("tiktok", e.target.value)}
                    disabled={!isOwnProfile || isSavingSocials}
                  />
                </div>
              </div>

              <div className="user-social-actions">
                {isOwnProfile ? (
                  <button
                    type="button"
                    className="primary-button user-social-save-button"
                    onClick={handleSaveSocials}
                    disabled={!isOwnProfile || isSavingSocials}
                  >
                    {isSavingSocials ? "Guardando..." : "Guardar redes"}
                  </button>
                ) : (
                  <div className="user-readonly-note">
                    Solo el dueño del perfil puede editar estas redes.
                  </div>
                )}

                {socialsSavedAt ? (
                  <span className="user-social-saved-text">
                    Guardado: {socialsSavedAt}
                  </span>
                ) : (
                  <span className="user-social-saved-text muted">
                    {isOwnProfile
                      ? "Edita y guarda tus redes"
                      : "Modo consulta"}
                  </span>
                )}
              </div>

              <div className="user-social-links-grid">
                {socialEntries.map((entry) => {
                  const url = buildSocialUrl(entry.key, entry.value);

                  return (
                    <div className="user-social-link-card" key={entry.key}>
                      <div className="user-social-link-copy">
                        <span className="user-social-link-label">{entry.label}</span>
                        <span className="user-social-link-value">
                          {entry.value || "Sin configurar"}
                        </span>
                      </div>

                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="user-social-link-button"
                          title={`Abrir ${entry.label}`}
                          aria-label={`Abrir ${entry.label}`}
                        >
                          <ExternalLinkIcon />
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="user-social-link-button disabled"
                          disabled
                          title="Sin enlace"
                          aria-label="Sin enlace"
                        >
                          <ExternalLinkIcon />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {activeTab === "activity" && (
            <section className="user-modal-panel user-modal-panel-single">
              <div className="user-modal-panel-head">
                <ActivityIcon />
                <h3 className="user-modal-panel-title">Actividad</h3>
              </div>

              <p className="user-modal-panel-text">
                Aquí verás actividad local del panel y también eventos reales del
                contrato.
              </p>

              <div className="user-activity-list">
                {isLoadingActivity ? (
                  <div className="user-modal-placeholder">Cargando actividad...</div>
                ) : mergedActivity.length > 0 ? (
                  mergedActivity.map((entry) => {
                    const txUrl = buildTxUrl(entry.txHash);

                    return (
                      <div className="user-activity-item" key={entry.id}>
                        <div className="user-activity-item-main">
                          <div className="user-activity-item-top">
                            <span className="user-activity-type">{entry.type}</span>
                            <span
                              className={`user-activity-source-badge ${getActivitySourceClass(
                                entry.source
                              )}`}
                            >
                              {getActivitySourceLabel(entry.source)}
                            </span>
                          </div>

                          <p className="user-activity-detail">{entry.detail}</p>

                          <div className="user-activity-meta">
                            <span>{entry.timestampLabel || "—"}</span>

                            {txUrl ? (
                              <a
                                href={txUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="user-activity-tx-link"
                              >
                                Ver transacción
                                <ExternalLinkIcon />
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="user-modal-placeholder">
                    Todavía no hay actividad para mostrar para esta wallet.
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserDashboardModal;