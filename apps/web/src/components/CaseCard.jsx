import { useEffect, useMemo, useState } from "react";
import { donateToCase, formatWeiToBNB } from "../services/contract";
import { buildGalleryFromMetadata } from "../services/ipfs";
import { ACTIVE_NETWORK } from "../config";
import { getCurrentProvider, switchToActiveNetwork } from "../web3";
import { getWriteContract } from "../services/contract";
import { getWalletWeb3 } from "../web3";

function getExplorerBaseUrl() {
  return (
    ACTIVE_NETWORK?.blockExplorerUrls?.[0]?.replace(/\/$/, "") ||
    "https://bscscan.com"
  );
}

function buildAddressUrl(address) {
  return `${getExplorerBaseUrl()}/address/${address}`;
}

function getCaseStatusLabel(status) {
  return Number(status) === 1 ? "Encontrado" : "Desaparecido";
}

function getCaseStatusClass(status) {
  return Number(status) === 1 ? "found" : "missing";
}

function HeartIcon() {
  return (
    <svg
      className="donate-heart-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 20.5L10.55 19.18C5.4 14.5 2 11.41 2 7.61C2 4.52 4.42 2.1 7.5 2.1C9.24 2.1 10.91 2.91 12 4.19C13.09 2.91 14.76 2.1 16.5 2.1C19.58 2.1 22 4.52 22 7.61C22 11.41 18.6 14.5 13.45 19.19L12 20.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ExternalArrowIcon() {
  return (
    <svg
      className="wallet-external-icon"
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
        d="M19 14V17C19 18.1046 18.1046 19 17 19H7C5.89543 19 5 18.1046 5 17V7C5 5.89543 5 5 7 5H10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserProfileIcon() {
  return (
    <svg
      className="wallet-external-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M4 20C5.8 16.8 8.5 15 12 15C15.5 15 18.2 16.8 20 20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      className="gallery-nav-icon"
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
      className="gallery-nav-icon"
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

function CaseCard({
  account,
  readResult,
  caseMetadata,
  setMessage,
  onOpenUserPanel,
}) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [donationAmount, setDonationAmount] = useState("");
  const [isDonating, setIsDonating] = useState(false);
  const [chainId, setChainId] = useState("");
  const [isCheckingNetwork, setIsCheckingNetwork] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const galleryImages = useMemo(
    () => buildGalleryFromMetadata(caseMetadata),
    [caseMetadata]
  );
  const currentImage = galleryImages[activeImageIndex] || "";

  useEffect(() => {
    setActiveImageIndex(0);
    setDonationAmount("");
  }, [readResult?.id, caseMetadata]);

  useEffect(() => {
    async function syncChain() {
      try {
        const provider = getCurrentProvider();
        if (!provider?.request) {
          setChainId("");
          return;
        }

        const currentChainId = await provider.request({ method: "eth_chainId" });
        setChainId(currentChainId);
      } catch {
        setChainId("");
      }
    }

    syncChain();
  }, [account, readResult?.id]);

  if (!readResult) return null;

  const totalDonatedBNB = formatWeiToBNB(readResult.totalDonated || "0");
  const recipientUrl = readResult?.recipient
    ? buildAddressUrl(readResult.recipient)
    : "";

  const isConnected = Boolean(account);
const isCorrectNetwork =
  Number(chainId) === Number(ACTIVE_NETWORK.chainId);

  const isCaseActive = Boolean(readResult?.active);

const canDonate =
  isConnected &&
  isCorrectNetwork &&
  isCaseActive &&
  !isDonating &&
  donationAmount &&
  Number(donationAmount) > 0;

  function handlePrevImage() {
    setActiveImageIndex((prev) => {
      if (prev === 0) return galleryImages.length - 1;
      return prev - 1;
    });
  }

  function handleNextImage() {
    setActiveImageIndex((prev) => {
      if (prev === galleryImages.length - 1) return 0;
      return prev + 1;
    });
  }

  async function handleSwitchNetwork() {
    try {
      setIsCheckingNetwork(true);
      setMessage("Cambiando a BNB Smart Chain...");
      await switchToActiveNetwork();

      const provider = getCurrentProvider();
      const currentChainId = await provider.request({ method: "eth_chainId" });
      setChainId(currentChainId);

      setMessage("Red cambiada correctamente a BNB Smart Chain");
    } catch (error) {
      console.error(error);
      setMessage(error.message || "No se pudo cambiar la red");
    } finally {
      setIsCheckingNetwork(false);
    }
  }

async function handleDonate() {
  try {
    if (!isConnected) {
      throw new Error("Primero conecta una wallet compatible");
    }

    if (!isCorrectNetwork) {
      throw new Error("Debes conectarte a BNB Smart Chain para donar");
    }

    if (!readResult?.active) {
      throw new Error("Este caso ya no acepta donaciones");
    }

    if (!donationAmount || Number(donationAmount) <= 0) {
      throw new Error("Ingresa una cantidad válida de BNB");
    }

    setIsDonating(true);
    setMessage("Validando transacción...");

    // 🔥 PRE-CHECK (EVITA ERROR DE METAMASK)
    const contract = getWriteContract();
    const web3 = getWalletWeb3();
    const value = web3.utils.toWei(String(donationAmount), "ether");

    await contract.methods.donate(readResult.id).call({
      from: account,
      value,
    });

    setMessage("Enviando donación en BNB...");

    await donateToCase(readResult.id, donationAmount, account);

    setMessage("Donación en BNB realizada correctamente");
    setDonationAmount("");
  } catch (error) {
    console.error(error);

    if (error?.message?.includes("InactiveCase")) {
      setMessage("Este caso ya no acepta donaciones");
    } else if (error?.message?.includes("CaseNotFound")) {
      setMessage("El caso no existe");
    } else if (error?.message?.includes("TransferFailed")) {
      setMessage("Error al enviar fondos al destinatario");
    } else {
      setMessage(error.message || "Error al donar");
    }
  } finally {
    setIsDonating(false);
  }
}

  function handleOpenRecipientProfile() {
    if (typeof onOpenUserPanel === "function" && readResult?.recipient) {
      onOpenUserPanel(readResult.recipient);
    }
  }
  async function handleDownloadImage() {
  try {
    if (!currentImage) return;

    const response = await fetch(currentImage);
    const blob = await response.blob();

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "imagen-caso.jpg";
    document.body.appendChild(a);
    a.click();

    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error(error);
    setMessage("Error al descargar la imagen");
  }
}

return (
  <>
    <div className="case-card improved-case-card">
      <div className="case-card-top improved-case-top">
        <div className="case-image-wrap improved-case-image-wrap">
          <div className="case-image-tools">
            {currentImage ? (
<button
  className="case-view-button"
  onClick={() => setIsViewerOpen(true)}
>
  Ver imagen
</button>
            ) : null}
          </div>

          {currentImage ? (
            <div className="case-image-stage">
              <div className="case-image-frame">
                <img
                  className="case-image improved-case-image"
                  src={currentImage}
                  alt={caseMetadata?.name || "Afiche"}
                />
              </div>

              {galleryImages.length > 1 && (
                <>
                  <button
                    type="button"
                    className="case-overlay-nav case-overlay-nav-left"
                    onClick={handlePrevImage}
                    aria-label="Imagen anterior"
                    title="Imagen anterior"
                  >
                    <ChevronLeftIcon />
                  </button>

                  <button
                    type="button"
                    className="case-overlay-nav case-overlay-nav-right"
                    onClick={handleNextImage}
                    aria-label="Imagen siguiente"
                    title="Imagen siguiente"
                  >
                    <ChevronRightIcon />
                  </button>

                  <div className="case-overlay-counter">
                    {activeImageIndex + 1} / {galleryImages.length}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="empty-image">No hay imagen disponible para este caso</div>
          )}
        </div>

        <div className="case-content improved-case-content">
          <h3 className="case-title">
            {caseMetadata?.name || "Persona no identificada"}
          </h3>

          <p className="case-subtitle">
            Información pública del caso registrada en IPFS y verificada desde
            blockchain.
          </p>

          <div className="case-meta-grid improved-case-meta-grid">

<div className="meta-box meta-box-full">
  <span className="meta-label">Ubicación</span>

  <div className="meta-value location-value">
    <span className="location-icon">📍</span>

    {[
      caseMetadata?.city,
      caseMetadata?.stateName,
      caseMetadata?.country,
    ]
      .filter(Boolean)
      .join(", ") || "No disponible"}
  </div>
</div>

            <div className="meta-box">
              <span className="meta-label">Edad</span>
              <div className="meta-value">
                {caseMetadata?.age !== undefined && caseMetadata?.age !== null
                  ? `${caseMetadata.age} años`
                  : "No disponible"}
              </div>
            </div>

            <div className="meta-box">
              <span className="meta-label">Estado actual</span>
              <div
                className={`case-status-badge ${getCaseStatusClass(
                  readResult?.status
                )}`}
              >
                {getCaseStatusLabel(readResult?.status)}
              </div>
            </div>

            <div className="meta-box">
              <span className="meta-label">Fecha de desaparición</span>
              <div className="meta-value">
                {caseMetadata?.lastSeenDate ||
                  caseMetadata?.date ||
                  caseMetadata?.missingDate ||
                  "No disponible"}
              </div>
            </div>

            <div className="meta-box">
              <span className="meta-label">Contacto</span>
              <div className="meta-value">
                {caseMetadata?.contact || "No disponible"}
              </div>
            </div>

            <div className="meta-box meta-box-full">
              <span className="meta-label">Descripción</span>
              <div className="meta-value">
                {caseMetadata?.description || "No disponible"}
              </div>
            </div>

            <div className="meta-box meta-box-full donation-box">
              <span className="meta-label">Apoyar con donación</span>

              <div className="donation-network-notice">
                <div className="donation-network-copy">
                  <div>
                    <strong>Esta dApp solo acepta BNB</strong>
                    <p>
                      Usa una wallet EVM compatible conectada a{" "}
                      {ACTIVE_NETWORK?.chainName || "BNB Smart Chain"}.
                    </p>
                  </div>
                </div>

                {!isConnected ? (
                  <span className="donation-status-badge warning">
                    Conecta una wallet
                  </span>
                ) : isCorrectNetwork ? (
                  <span className="donation-status-badge success">
                    Red correcta
                  </span>
                ) : (
                  <button
                    type="button"
                    className="secondary-button donation-switch-network-button"
                    onClick={handleSwitchNetwork}
                    disabled={isCheckingNetwork}
                  >
                    {isCheckingNetwork ? "Cambiando..." : "Cambiar a BNB Smart Chain"}
                  </button>
                )}
              </div>

              <div className="donation-row">
                <div className="donation-input-wrap">
                  <input
                    className="form-input donation-input"
                    type="number"
                    min="0"
                    step="0.0001"
                    placeholder="0.00"
                    value={donationAmount}
                    onChange={(e) => setDonationAmount(e.target.value)}
                  />
                  <span className="donation-currency">BNB</span>
                </div>

                <button
                  type="button"
                  className={`primary-button donate-button ${
                    !isDonating ? "shake-donate" : ""
                  }`}
                  onClick={handleDonate}
                  disabled={!canDonate}
                >
                  <HeartIcon />
                  <span>{isDonating ? "Donando..." : "Donar BNB"}</span>
                </button>

              </div>
                              {!readResult?.active && (
  <p className="donation-helper-text warning">
    Este caso ya no acepta donaciones.
  </p>
)}

              {!isConnected && (
                <p className="donation-helper-text">
                  Necesitas conectar una wallet antes de donar.
                </p>
              )}

              {isConnected && !isCorrectNetwork && (
                <p className="donation-helper-text warning">
                  Tu wallet está en una red distinta. Cámbiala a BNB Smart Chain.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="case-chain-section">
        <h4 className="case-chain-title">Datos del caso en blockchain</h4>

        <div className="chain-grid improved-chain-grid">
          <div className="meta-box">
            <span className="meta-label">ID</span>
            <div className="meta-value">{readResult.id?.toString()}</div>
          </div>

          <div className="meta-box">
            <span className="meta-label">Total donado</span>
            <div className="meta-value">{totalDonatedBNB} BNB</div>
          </div>

          <div className="meta-box">
            <span className="meta-label">Red requerida</span>
            <div className="meta-value">
              {ACTIVE_NETWORK?.chainName || "BNB Smart Chain"}
            </div>
          </div>

          <div className="meta-box">
            <span className="meta-label">Estado on-chain</span>
            <div
              className={`case-status-badge ${getCaseStatusClass(
                readResult?.status
              )}`}
            >
              {getCaseStatusLabel(readResult?.status)}
            </div>
          </div>

          <div className="meta-box meta-box-full wallet-chain-box">
            <div className="wallet-chain-head">
              <span className="meta-label">Wallet receptora</span>

              <div className="wallet-chain-actions">

                {readResult?.recipient ? (
                  <a
                    href={recipientUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="wallet-profile-link-button"
                    aria-label="Ver wallet receptora en BscScan"
                    title="Ver wallet receptora en BscScan"
                  >
                    <ExternalArrowIcon />
                  </a>
                ) : null}
              </div>
            </div>
            

            <div className="meta-value wallet-chain-value">
              {readResult.recipient || "No disponible"}
            </div>
          </div>
        </div>
      </div>
    </div>
    {isViewerOpen && (
      <div
        className="image-viewer-overlay"
        onClick={() => setIsViewerOpen(false)}
      >
        <img
          src={currentImage}
          alt="Vista completa"
          className="image-viewer-full"
          onClick={(e) => e.stopPropagation()}
        />

        <button
          className="image-viewer-close"
          onClick={() => setIsViewerOpen(false)}
        >
          ✕
        </button>
      </div>
    )}
  </>
);
}

export default CaseCard;