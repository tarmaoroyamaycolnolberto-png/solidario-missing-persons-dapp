import { useEffect, useState } from "react";
import { getCaseById } from "../services/contract";
import CaseCard from "./CaseCard";

function extractMetadataCID(data) {
  if (!data) return "";

  if (typeof data.metadataCID === "string" && data.metadataCID.trim()) {
    return data.metadataCID.trim();
  }

  if (typeof data[2] === "string" && data[2].trim()) {
    return data[2].trim();
  }

  return "";
}

function normalizeCID(value) {
  if (!value) return "";
  return String(value).replace("ipfs://", "").trim();
}

function SearchIcon() {
  return (
    <svg
      className="search-case-button-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path
        d="M20 20L16.65 16.65"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ReadCase({
  account,
  setMessage,
  selectedCaseId = "",
  onOpenUserPanel,
}) {
  const [caseId, setCaseId] = useState(
    selectedCaseId !== undefined && selectedCaseId !== null
      ? String(selectedCaseId)
      : ""
  );
  const [readResult, setReadResult] = useState(null);
  const [caseMetadata, setCaseMetadata] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (
      selectedCaseId !== "" &&
      selectedCaseId !== null &&
      selectedCaseId !== undefined
    ) {
      setCaseId(String(selectedCaseId));
      handleReadCase(String(selectedCaseId));
    }
  }, [selectedCaseId]);

  async function fetchMetadataByCID(metadataCID) {
    const cleanCID = normalizeCID(metadataCID);

    if (!cleanCID) {
      throw new Error("No existe un metadataCID válido");
    }

    const gateways = [
      `https://ipfs.io/ipfs/${cleanCID}`,
      `https://cloudflare-ipfs.com/ipfs/${cleanCID}`,
      `https://gateway.pinata.cloud/ipfs/${cleanCID}`,
    ];

    let lastError = null;

    for (const url of gateways) {
      try {
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`No se pudo obtener la metadata desde ${url}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(
      lastError?.message || "No se pudo obtener la metadata desde IPFS"
    );
  }

  async function handleReadCase(customCaseId) {
    if (isLoading) return;

    try {
      const finalCaseId =
        customCaseId !== undefined && customCaseId !== null
          ? String(customCaseId)
          : String(caseId);

      if (finalCaseId.trim() === "") {
        throw new Error("Ingresa el ID del caso");
      }

      const numericId = Number(finalCaseId);

      if (
        Number.isNaN(numericId) ||
        !Number.isInteger(numericId) ||
        numericId < 0
      ) {
        throw new Error("Ingresa un ID de caso válido");
      }

      setIsLoading(true);
      setReadResult(null);
      setCaseMetadata(null);

      setMessage("Consultando caso en blockchain...");
      const data = await getCaseById(numericId);

      if (!data) {
        throw new Error("No se encontró el caso");
      }

      const metadataCID = extractMetadataCID(data);

      if (!metadataCID) {
        throw new Error("El caso no tiene metadataCID válido");
      }

      setMessage("Descargando metadata desde IPFS...");
      const metadata = await fetchMetadataByCID(metadataCID);

      setCaseId(String(numericId));
      setReadResult(data);
      setCaseMetadata(metadata);
      setMessage("Caso encontrado correctamente");
    } catch (error) {
      console.error(error);
      setReadResult(null);
      setCaseMetadata(null);
      setMessage(error.message || "Error al buscar caso");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="section-card search-case-card">
      <h2 className="section-title">Buscar caso por ID</h2>

      <div className="read-box search-box-compact improved-read-box search-case-inline">
        <input
          className="form-input compact-input search-case-input"
          type="number"
          min="0"
          placeholder="ID del caso"
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleReadCase();
            }
          }}
          disabled={isLoading}
        />

        <button
          className="secondary-button compact-search-button search-case-button"
          onClick={() => handleReadCase()}
          type="button"
          aria-label="Buscar caso"
          title="Buscar caso"
          disabled={isLoading}
        >
          <SearchIcon />
          <span className="search-case-button-text">
            {isLoading ? "Buscando..." : "Buscar caso"}
          </span>
        </button>
      </div>

      <CaseCard
        account={account}
        readResult={readResult}
        caseMetadata={caseMetadata}
        setMessage={setMessage}
        onOpenUserPanel={onOpenUserPanel}
      />
    </section>
  );
}

export default ReadCase;