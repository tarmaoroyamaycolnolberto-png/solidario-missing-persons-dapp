import { useEffect, useState } from "react";
import { CONTRACT_ADDRESS, ACTIVE_NETWORK } from "../config";
import {
  connectWallet,
  disconnectWallet,
  getAvailableWallets,
  promptWalletAccountSelection,
  switchToActiveNetwork,
} from "../web3";

function formatAddress(address) {
  if (!address) return "Todavía no has conectado tu wallet";
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function ChainIcon() {
  return (
    <svg
      className="wallet-profile-avatar-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10.2 13.8L7.4 16.6C6.1 17.9 4 17.9 2.7 16.6C1.4 15.3 1.4 13.2 2.7 11.9L5.5 9.1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.8 10.2L16.6 7.4C17.9 6.1 20 6.1 21.3 7.4C22.6 8.7 22.6 10.8 21.3 12.1L18.5 14.9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 15.5L15.5 8.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ExternalLinkIcon() {
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
        d="M19 14V17C19 18.1046 18.1046 19 17 19H7C5.89543 19 5 18.1046 5 17V7C5 5.89543 5.89543 5 7 5H10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WalletOptionIcon() {
  return (
    <svg
      className="wallet-option-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="3"
        y="6"
        width="18"
        height="12"
        rx="3"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M16 12H21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="12" r="1.2" fill="currentColor" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      className="wallet-option-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20 12A8 8 0 1 1 17.66 6.34"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M20 4V10H14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getExplorerBaseUrl() {
  return (
    ACTIVE_NETWORK?.blockExplorerUrls?.[0]?.replace(/\/$/, "") ||
    "https://bscscan.com"
  );
}

function buildAddressUrl(address) {
  return `${getExplorerBaseUrl()}/address/${address}`;
}

function ConnectWallet({ account, setAccount, setMessage }) {
  const [availableWallets, setAvailableWallets] = useState([]);
  const [isRefreshingWallets, setIsRefreshingWallets] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  function refreshWalletsList() {
    const detected = getAvailableWallets();
    setAvailableWallets(detected);
    return detected;
  }

  useEffect(() => {
    refreshWalletsList();
  }, []);

  async function handleRefreshWallets() {
    try {
      setIsRefreshingWallets(true);
      setMessage("Buscando wallets disponibles...");

      const detected = refreshWalletsList();

      if (detected.length > 0) {
        setMessage(`Se detectaron ${detected.length} wallet(s) compatibles`);
      } else {
        setMessage("No se detectaron wallets EVM en este navegador");
      }
    } catch (error) {
      console.error(error);
      setMessage("No se pudieron recargar las wallets");
    } finally {
      setIsRefreshingWallets(false);
    }
  }

  async function handleConnect(selectedProvider, walletName) {
    try {
      setIsConnecting(true);
      setMessage(`Conectando ${walletName}...`);

      const result = await connectWallet(selectedProvider);

      if (result.chainId !== ACTIVE_NETWORK.chainId) {
        setMessage("Cambiando a BNB Smart Chain...");
        await switchToActiveNetwork(selectedProvider);
      }

      setAccount(result.account);
      setMessage(`${walletName} conectada correctamente`);
    } catch (error) {
      console.error(error);
      setMessage(error.message || `Error al conectar ${walletName}`);
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleChangeAccount() {
    try {
      if (!availableWallets.length) {
        throw new Error("No se detectaron wallets compatibles");
      }

      const selected = availableWallets[0];
      setIsConnecting(true);
      setMessage(`Solicitando cambio de cuenta en ${selected.name}...`);

      const result = await promptWalletAccountSelection(selected.provider);
      setAccount(result.account);
      setMessage(`Cuenta cambiada correctamente en ${selected.name}`);
    } catch (error) {
      console.error(error);
      setMessage(
        error.message ||
          "No se pudo cambiar la cuenta. También puedes hacerlo desde tu wallet."
      );
    } finally {
      setIsConnecting(false);
    }
  }

  function handleDisconnect() {
    disconnectWallet();
    setAccount("");
    setMessage("Wallet desconectada en la dApp");
  }

  const isConnected = Boolean(account);
  const accountUrl = isConnected ? buildAddressUrl(account) : "";
  const contractUrl = buildAddressUrl(CONTRACT_ADDRESS);

  return (
    <div className="wallet-profile-card improved-wallet-profile-card">
      <div className="wallet-connect-shell">
        <div className="wallet-connect-main">
          <div className="wallet-profile-header improved-wallet-header wallet-connect-main-card">
            <div className="wallet-profile-avatar">
              <ChainIcon />
            </div>

            <div className="wallet-profile-identity">
              <div className="wallet-profile-title-row wallet-title-row-inline">
                <div className="wallet-title-copy">
                  <h3 className="wallet-profile-name">
                    {isConnected
                      ? "Solidario conectado"
                      : "Conecta tu wallet para comenzar"}
                  </h3>

                  <p className="wallet-profile-subcopy">
                    Compatible con wallets EVM sobre{" "}
                    {ACTIVE_NETWORK?.chainName || "BNB Smart Chain"}.
                  </p>
                </div>

                <span
                  className={`wallet-profile-status-badge ${
                    isConnected ? "connected" : "disconnected"
                  }`}
                >
                  <span className="wallet-status-dot" />
                  {isConnected ? "Wallet conectada" : "Wallet no conectada"}
                </span>
              </div>

              <div className="wallet-profile-summary-grid">
                <div className="wallet-summary-box">
                  <span className="wallet-summary-label">Cuenta activa</span>
                  <span className="wallet-summary-value">
                    {isConnected ? formatAddress(account) : "@sin-wallet"}
                  </span>
                </div>

                <div className="wallet-summary-box">
                  <span className="wallet-summary-label">Red requerida</span>
                  <span className="wallet-summary-value">
                    {ACTIVE_NETWORK?.chainName || "BNB Smart Chain"}
                  </span>
                </div>
              </div>

              <div className="wallet-session-actions wallet-session-actions-compact">
                <button
                  type="button"
                  className="secondary-button wallet-session-button"
                  onClick={handleRefreshWallets}
                  disabled={isRefreshingWallets || isConnecting}
                >
                  <RefreshIcon />
                  <span>
                    {isRefreshingWallets ? "Buscando..." : "Recargar wallets"}
                  </span>
                </button>

                {isConnected && (
                  <>
                    <button
                      type="button"
                      className="secondary-button wallet-session-button"
                      onClick={handleChangeAccount}
                      disabled={isConnecting}
                    >
                      Cambiar cuenta
                    </button>

                    <button
                      type="button"
                      className="secondary-button wallet-session-button"
                      onClick={handleDisconnect}
                      disabled={isConnecting}
                    >
                      Desconectar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="wallet-connect-side">
          <div className="wallet-selector-panel">
            <div className="wallet-selector-head improved-wallet-selector-head">
              <div className="wallet-selector-copy">
                <span className="wallet-selector-label">Wallets detectadas</span>
                <span className="wallet-selector-note">
                  Pulsa recargar si cambiaste de billetera o extensión.
                </span>
              </div>
            </div>

            {availableWallets.length > 0 ? (
              <div className="wallet-options-grid improved-wallet-options-grid wallet-options-grid-vertical">
                {availableWallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    type="button"
                    className="primary-button wallet-option-button improved-wallet-option-button wallet-option-button-full"
                    onClick={() => handleConnect(wallet.provider, wallet.name)}
                    disabled={isConnecting}
                  >
                    <WalletOptionIcon />
                    <span>{wallet.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="wallet-empty-state">
                No se detectaron wallets EVM compatibles en este navegador.
              </div>
            )}
          </div>

          <div className="wallet-profile-info-grid improved-wallet-info-grid wallet-info-grid-compact">
            <div className="wallet-profile-info-card compact improved-wallet-info-card">
              <div className="wallet-profile-info-head">
                <span className="wallet-profile-info-label">Cuenta completa</span>

                {isConnected ? (
                  <a
                    href={accountUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="wallet-profile-link-button"
                    aria-label="Ver cuenta en BscScan"
                    title="Ver cuenta en BscScan"
                  >
                    <ExternalLinkIcon />
                  </a>
                ) : (
                  <button
                    type="button"
                    className="wallet-profile-link-button disabled"
                    aria-label="Cuenta no disponible"
                    title="Cuenta no disponible"
                    disabled
                  >
                    <ExternalLinkIcon />
                  </button>
                )}
              </div>

              <p className="wallet-profile-info-value">
                {account || "Todavía no has conectado tu wallet"}
              </p>
            </div>

            <div className="wallet-profile-info-card compact improved-wallet-info-card">
              <div className="wallet-profile-info-head">
                <span className="wallet-profile-info-label">Contrato</span>

                <a
                  href={contractUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="wallet-profile-link-button"
                  aria-label="Ver contrato en BscScan"
                  title="Ver contrato en BscScan"
                >
                  <ExternalLinkIcon />
                </a>
              </div>

              <p className="wallet-profile-info-value">{CONTRACT_ADDRESS}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConnectWallet;