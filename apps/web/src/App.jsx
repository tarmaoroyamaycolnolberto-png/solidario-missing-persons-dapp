import { useEffect, useState } from "react";
import ConnectWallet from "./components/ConnectWallet";
import CreateCaseForm from "./components/CreateCaseForm";
import ReadCase from "./components/ReadCase";
import ExploreCases from "./components/ExploreCases";
import UserDashboardModal from "./components/UserDashboardModal";
import { API_BASE_URL } from "./config";  

import {
  getCurrentProvider,
  getWalletWeb3,
  resetWalletConnection,
  switchToActiveNetwork,
} from "./web3";
import "./App.css";
import { PROJECT_SUPPORT_WALLET } from "./config";


function AccordionArrow({ isOpen }) {
  return (
    <span className={`section-toggle-arrow ${isOpen ? "open" : ""}`}>▼</span>
  );
}

function ChainBadgeIcon() {
  return (
    <svg
      className="hero-badge-icon"
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

function SupportPointerIcon() {
  return (
    <svg
      className="support-pointer-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7 3L19 12L13.2 13.4L15.8 20.2L12.8 21.3L10.2 14.4L6 18V3H7Z"
        fill="currentColor"
      />
    </svg>
  );
}

function HeartSupportIcon() {
  return (
    <svg
      className="support-button-icon"
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

function SunIcon() {
  return (
    <svg
      className="theme-toggle-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M12 2.5V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 19V21.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M21.5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 12H2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18.72 5.28L16.95 7.05" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7.05 16.95L5.28 18.72" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18.72 18.72L16.95 16.95" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7.05 7.05L5.28 5.28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      className="theme-toggle-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20 14.5C18.95 14.85 17.84 15 16.72 14.93C12.03 14.62 8.27 10.86 7.97 6.17C7.89 5.05 8.05 3.94 8.4 2.9C4.79 4.15 2.23 7.63 2.45 11.66C2.71 16.31 6.5 20.07 11.15 20.3C15.19 20.5 18.66 17.97 20 14.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function App() {
  console.log("API_BASE_URL:", API_BASE_URL);
  const [account, setAccount] = useState("");
  const [message, setMessage] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedUserAccount, setSelectedUserAccount] = useState("");
  const [projectSupportAmount, setProjectSupportAmount] = useState("");
  const [isSupportingProject, setIsSupportingProject] = useState(false);
  const [showSupportToast, setShowSupportToast] = useState(false);

  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem("solidario-theme") || "light";
  });

  const [openSections, setOpenSections] = useState({
    about: true,
    wallet: true,
    upload: true,
  });

  function toggleSection(key) {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  function toggleTheme() {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }

  function handleOpenUserPanel(targetAccount) {
    if (!targetAccount) return;
    setSelectedUserAccount(targetAccount);
    setIsUserModalOpen(true);
  }

  function handleOpenOwnPanel() {
    if (!account) return;
    setSelectedUserAccount(account);
    setIsUserModalOpen(true);
  }

  function handleCloseUserPanel() {
    setIsUserModalOpen(false);
    setSelectedUserAccount("");
  }

  function scrollToReadCase() {
    const readSection = document.getElementById("leer");
    if (readSection) {
      readSection.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  function handleSelectCase(caseId) {
    setSelectedCaseId(String(caseId));
    scrollToReadCase();
  }

  function handleSelectCaseFromUserModal(caseId) {
    setSelectedCaseId(String(caseId));
    setIsUserModalOpen(false);
    setTimeout(() => {
      scrollToReadCase();
    }, 120);
    setMessage(`Caso ${caseId} enviado al lector`);
  }

  useEffect(() => {
    document.body.classList.remove("theme-light", "theme-dark");
    document.body.classList.add(`theme-${theme}`);
    localStorage.setItem("solidario-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!showSupportToast) return;

    const timer = window.setTimeout(() => {
      setShowSupportToast(false);
    }, 30000);

    return () => window.clearTimeout(timer);
  }, [showSupportToast]);

  useEffect(() => {
    const provider = getCurrentProvider();

    if (!provider?.on) return;

    function handleAccountsChanged(accounts) {
      const nextAccount = Array.isArray(accounts) ? accounts[0] || "" : "";

      setAccount(nextAccount);

      if (nextAccount) {
        setMessage("Cuenta actualizada correctamente");
      } else {
        resetWalletConnection();
        setMessage("Wallet desconectada");
        setIsUserModalOpen(false);
        setSelectedUserAccount("");
      }
    }

    function handleChainChanged() {
      setMessage("La red cambió. Recargando dApp...");
      window.location.reload();
    }

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);

    return () => {
      if (provider.removeListener) {
        provider.removeListener("accountsChanged", handleAccountsChanged);
        provider.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, []);

  useEffect(() => {
  async function restoreConnection() {
    try {
      const provider = getCurrentProvider();
      if (!provider) return;

      const accounts = await provider.request({
        method: "eth_accounts",
      });

if (accounts && accounts.length > 0) {
  setAccount(accounts[0]);
  setMessage("Wallet restaurada automáticamente");
}
    } catch (error) {
      console.error("Error restaurando wallet:", error);
    }
  }

  restoreConnection();
}, []);

async function handleSupportProject() {
  try {
    if (!account) {
      throw new Error("Primero conecta tu wallet");
    }

    if (!PROJECT_SUPPORT_WALLET) {
      throw new Error("Wallet de destino no configurada");
    }

    if (!projectSupportAmount || Number(projectSupportAmount) <= 0) {
      throw new Error("Ingresa una cantidad válida de BNB");
    }

    setIsSupportingProject(true);
    setMessage("Preparando transacción...");

    // 🔥 ASEGURA PROVIDER
    let provider = getCurrentProvider();

    if (!provider) {
      throw new Error("No se detectó provider. Reconecta tu wallet.");
    }

    // 🔥 ASEGURA RED
    await switchToActiveNetwork(provider);

    // 🔥 ASEGURA PERMISOS
    await provider.request({ method: "eth_requestAccounts" });

    const web3 = getWalletWeb3();

    const value = web3.utils.toWei(
      String(projectSupportAmount),
      "ether"
    );

    setMessage("Confirmando transacción en wallet...");

    await web3.eth.sendTransaction({
      from: account,
      to: PROJECT_SUPPORT_WALLET,
      value,
    });

    setProjectSupportAmount("");
    setShowSupportToast(true);
    setMessage("Transacción enviada correctamente 🚀");

  } catch (error) {
    console.error("ERROR APOYO:", error);

    if (error.code === 4001) {
      setMessage("Transacción cancelada por el usuario");
    } else {
      setMessage(error.message || "Error al enviar BNB");
    }

  } finally {
    setIsSupportingProject(false);
  }
}

  return (
    <div className={`app-shell ${theme === "dark" ? "dark-theme" : "light-theme"}`}>
      <nav className="top-navbar">
        <div className="nav-brand">
          <button
            type="button"
            className="theme-toggle-button"
            onClick={toggleTheme}
            aria-label={theme === "light" ? "Activar modo oscuro" : "Activar modo claro"}
            title={theme === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
          >
            {theme === "light" ? <MoonIcon /> : <SunIcon />}
          </button>

          <p className="nav-brand-name">Solidario</p>
        </div>

        <div className="nav-account">
          <button
            type="button"
            className={`nav-account-button ${!account ? "disabled" : ""}`}
            onClick={handleOpenOwnPanel}
            disabled={!account}
            aria-label={account ? "Abrir panel del usuario" : "Conecta tu wallet para abrir tu panel"}
            title={account ? "Abrir panel del usuario" : "Conecta tu wallet para abrir tu panel"}
          >
            {account ? (
              <span className="nav-account-chip">
                <span className="wallet-dot" />
                {account.slice(0, 6)}…{account.slice(-4)}
              </span>
            ) : (
              <span className="nav-account-chip muted">Sin wallet</span>
            )}
          </button>
        </div>
      </nav>

      <div className="accordion-stack">
        <section className="accordion-card">
          <button
            className="accordion-toggle-button"
            type="button"
            onClick={() => toggleSection("about")}
            aria-expanded={openSections.about}
            aria-controls="about-solidario-panel"
          >
            <span>Sobre Solidario</span>
            <AccordionArrow isOpen={openSections.about} />
          </button>

          <div
            id="about-solidario-panel"
            className={`accordion-panel ${openSections.about ? "open" : ""}`}
          >
            <div className="accordion-panel-inner">
              <div className="hero-copy standalone-hero-copy">
                <span className="hero-badge">
                  <ChainBadgeIcon />
                  <span>IPFS + BNB SMART CHAIN MAINNET</span>
                </span>

                <h1 className="hero-title">Solidario — Missing Persons DApp</h1>

                <p className="hero-text">
                  Plataforma solidaria para registrar, consultar y visibilizar casos
                  de personas desaparecidas con almacenamiento en IPFS y registro
                  inmutable en blockchain. Además, permite recibir donaciones en
                  crypto BNB para apoyar gastos de búsqueda, transporte, difusión,
                  impresión de afiches y otras acciones urgentes que ayuden a
                  encontrar a una persona.
                </p>

                <p className="hero-support-text">
                  Cada aporte puede convertirse en una pista, una búsqueda más amplia
                  o una oportunidad real de reencuentro. Apoyar también es actuar.
                </p>

                <div className="project-support-card">
                  <div className="project-support-head">
                    <div>
                      <p className="project-support-eyebrow">Apoyo al proyecto</p>
                      <h3 className="project-support-title">
                        Impulsa el crecimiento de Solidario
                      </h3>
                    </div>

                    <div className="project-support-pointer-wrap">
                      <SupportPointerIcon />
                    </div>
                  </div>

                  <p className="project-support-text">
                    Tu apoyo ayuda a seguir mejorando la plataforma, su difusión y su
                    infraestructura.
                  </p>

                  <div className="project-support-action-row">
                    <div className="project-support-input-wrap">
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        className="form-input project-support-input"
                        placeholder="0.00"
                        value={projectSupportAmount}
                        onChange={(e) => setProjectSupportAmount(e.target.value)}
                        disabled={isSupportingProject}
                      />
                      <span className="project-support-currency">BNB</span>
                    </div>

<button
  type="button"
  className="primary-button project-support-button"
  onClick={handleSupportProject}
  disabled={isSupportingProject || !account}
>
                      <HeartSupportIcon />
                      <span>{isSupportingProject ? "Apoyando..." : "Apoyar"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="accordion-card">
          <button
            className="accordion-toggle-button"
            type="button"
            onClick={() => toggleSection("wallet")}
            aria-expanded={openSections.wallet}
            aria-controls="wallet-panel"
          >
            <span>Conecta tu wallet</span>
            <AccordionArrow isOpen={openSections.wallet} />
          </button>

          <div
            id="wallet-panel"
            className={`accordion-panel ${openSections.wallet ? "open" : ""}`}
          >
            <div className="accordion-panel-inner">
              <div className="hero-status-card standalone-wallet-card">
                <ConnectWallet
                  account={account}
                  setAccount={setAccount}
                  setMessage={setMessage}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="accordion-card">
          <button
            className="accordion-toggle-button"
            type="button"
            onClick={() => toggleSection("upload")}
            aria-expanded={openSections.upload}
            aria-controls="upload-panel"
          >
            <span>Sube un caso</span>
            <AccordionArrow isOpen={openSections.upload} />
          </button>

          <div
            id="upload-panel"
            className={`accordion-panel ${openSections.upload ? "open" : ""}`}
          >
            <div className="accordion-panel-inner">
              <section className="upload-panel-wrap">
                <div className="sticky-panel">
                  <CreateCaseForm account={account} setMessage={setMessage} />
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>

      <main id="dashboard" className="dashboard-layout single-column-dashboard">
        <section className="right-panel">
          <div id="leer">
            <ReadCase
              account={account}
              setMessage={setMessage}
              selectedCaseId={selectedCaseId}
              onOpenUserPanel={handleOpenUserPanel}
            />
          </div>

          <ExploreCases
            setMessage={setMessage}
            onSelectCase={handleSelectCase}
          />
        </section>
      </main>

      <UserDashboardModal
        isOpen={isUserModalOpen}
        onClose={handleCloseUserPanel}
        account={selectedUserAccount || account}
        viewerAccount={account}
        setMessage={setMessage}
        onSelectCase={handleSelectCaseFromUserModal}
      />

      {showSupportToast && (
        <div className="project-support-toast" role="status" aria-live="polite">
          Gracias por tu apoyo al proyecto Solidario. Tu contribución ayuda a seguir construyendo esta plataforma.
        </div>
      )}
    </div>
  );
}

export default App;