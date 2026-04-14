import { useEffect, useMemo, useState } from "react";
import { getCaseById, getNextCaseId } from "../services/contract";
import { COUNTRIES } from "../data/countries";

const CASES_PER_PAGE = 6;

function normalizeCID(value) {
  if (!value) return "";
  return String(value).replace("ipfs://", "").trim();
}

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

function ipfsToHttp(value) {
  if (!value) return "";
  if (value.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${value.replace("ipfs://", "")}`;
  }
  return value;
}

function getCaseStatusLabel(status) {
  return Number(status) === 1 ? "Encontrado" : "Desaparecido";
}

function getCaseStatusClass(status) {
  return Number(status) === 1 ? "found" : "missing";
}

function SearchIcon() {
  return (
    <svg
      className="explore-search-icon"
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

function ChevronLeftIcon() {
  return (
    <svg
      className="explore-nav-icon"
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
      className="explore-nav-icon"
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

function FilterIcon() {
  return (
    <svg
      className="explore-section-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 6H20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M7 12H17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10 18H14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      className="explore-input-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="4"
        y="5"
        width="16"
        height="15"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M8 3V7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16 3V7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4 10H20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ExploreCases({ setMessage, onSelectCase }) {
  const [allCases, setAllCases] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedAgeRange, setSelectedAgeRange] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(0);

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

  async function loadCases() {
    try {
      setIsLoading(true);
      setMessage("Cargando afiches desde blockchain...");

      const nextCaseId = await getNextCaseId();
      const totalCases = Number(nextCaseId);
      const loadedCases = [];

      for (let i = 0; i < totalCases; i += 1) {
        try {
          const onChainData = await getCaseById(i);
          if (!onChainData) continue;

          const metadataCID = extractMetadataCID(onChainData);
          if (!metadataCID) continue;

          const metadata = await fetchMetadataByCID(metadataCID);

          loadedCases.push({
            id: Number(onChainData.id ?? onChainData[0] ?? i),
            recipient: onChainData.recipient || onChainData[1] || "",
            totalDonated: onChainData.totalDonated || onChainData[4] || "0",
            status: onChainData.status ?? onChainData[3],
            active: onChainData.active ?? onChainData[6],
            metadataCID,
            metadata,
          });
        } catch (error) {
          console.error(`Error cargando caso ${i}:`, error);
        }
      }

      loadedCases.sort((a, b) => b.id - a.id);

      setAllCases(loadedCases);
      setMessage(
        loadedCases.length > 0
          ? `Se cargaron ${loadedCases.length} caso(s)`
          : "No hay casos registrados todavía"
      );
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Error al cargar casos");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCases();
  }, []);

  function handleApplySearch() {
    setAppliedSearch(searchText);
  }

  function handleClearFilters() {
    setSearchText("");
    setAppliedSearch("");
    setSelectedCountry("");
    setSelectedAgeRange("");
    setStartDate("");
    setEndDate("");
    setCurrentPage(0);
  }

  function matchesAgeRange(ageValue, range) {
    const age = Number(ageValue);
    if (!range) return true;
    if (Number.isNaN(age)) return false;

    switch (range) {
      case "0-12":
        return age >= 0 && age <= 12;
      case "13-17":
        return age >= 13 && age <= 17;
      case "18-30":
        return age >= 18 && age <= 30;
      case "31-59":
        return age >= 31 && age <= 59;
      case "60+":
        return age >= 60;
      default:
        return true;
    }
  }

  function matchesDateInterval(caseDateValue, fromDate, toDate) {
    if (!fromDate && !toDate) return true;
    if (!caseDateValue) return false;

    const caseDate = new Date(caseDateValue);
    if (Number.isNaN(caseDate.getTime())) return false;

    if (fromDate) {
      const from = new Date(fromDate);
      if (caseDate < from) return false;
    }

    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      if (caseDate > to) return false;
    }

    return true;
  }

  const filteredCases = useMemo(() => {
    const q = appliedSearch.trim().toLowerCase();

    return allCases.filter((item) => {
      const name = String(item.metadata?.name || "").toLowerCase();
      const country = String(item.metadata?.country || "").toLowerCase();
      const city = String(item.metadata?.city || "").toLowerCase();
      const description = String(item.metadata?.description || "").toLowerCase();
      const id = String(item.id || "");
      const caseCountryCode = String(item.metadata?.countryCode || "");
      const caseAge = item.metadata?.age;
      const caseDate = item.metadata?.lastSeenDate || item.metadata?.date || "";

      const matchesText =
        !q ||
        name.includes(q) ||
        country.includes(q) ||
        city.includes(q) ||
        description.includes(q) ||
        id.includes(q);

      const matchesCountry =
        !selectedCountry || caseCountryCode === selectedCountry;

      const matchesAge = matchesAgeRange(caseAge, selectedAgeRange);
      const matchesDate = matchesDateInterval(caseDate, startDate, endDate);

      return matchesText && matchesCountry && matchesAge && matchesDate;
    });
  }, [
    allCases,
    appliedSearch,
    selectedCountry,
    selectedAgeRange,
    startDate,
    endDate,
  ]);

  const totalFiltered = filteredCases.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / CASES_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages - 1);

  const visibleCases = useMemo(() => {
    const start = safePage * CASES_PER_PAGE;
    return filteredCases.slice(start, start + CASES_PER_PAGE);
  }, [filteredCases, safePage]);

  useEffect(() => {
    setCurrentPage(0);
  }, [appliedSearch, selectedCountry, selectedAgeRange, startDate, endDate]);

  function handlePrevPage() {
    setCurrentPage((prev) => Math.max(prev - 1, 0));
  }

  function handleNextPage() {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages - 1));
  }

  function handleSelectCase(caseId) {
    if (typeof onSelectCase === "function") {
      onSelectCase(caseId);
    }
    setMessage(`Caso ${caseId} enviado al lector`);
  }

  const startCount = totalFiltered === 0 ? 0 : safePage * CASES_PER_PAGE + 1;
  const endCount = Math.min((safePage + 1) * CASES_PER_PAGE, totalFiltered);

  const activeFilterCount = [
    appliedSearch,
    selectedCountry,
    selectedAgeRange,
    startDate,
    endDate,
  ].filter(Boolean).length;

  return (
    <section id="explorar" className="section-card explore-cases-card">
      <div className="explore-topbar">
        <div className="explore-topbar-copy">
          <h2 className="section-title">Explorar casos</h2>
          <p className="section-description">
            Explora afiches publicados en blockchain. Selecciona uno para cargar
            automáticamente su ID en el lector de casos.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button explore-refresh-button"
          onClick={loadCases}
          disabled={isLoading}
        >
          {isLoading ? "Cargando..." : "Actualizar"}
        </button>
      </div>

      <div className="explore-filters-panel">
        <div className="explore-panel-heading">
          <div className="explore-panel-title-wrap">
            <FilterIcon />
            <span className="explore-panel-title">Búsqueda y filtros</span>
          </div>

          <div className="explore-panel-actions">
            {activeFilterCount > 0 && (
              <span className="explore-active-filters-badge">
                {activeFilterCount} filtro{activeFilterCount > 1 ? "s" : ""} activo
                {activeFilterCount > 1 ? "s" : ""}
              </span>
            )}

            <button
              type="button"
              className="explore-clear-button"
              onClick={handleClearFilters}
            >
              Limpiar
            </button>
          </div>
        </div>

        <div className="explore-primary-search-row">
          <button
            type="button"
            className={`explore-filter-chip ${activeFilterCount === 0 ? "active" : ""}`}
            onClick={handleClearFilters}
          >
            Todo
          </button>

          <div className="explore-search-wrap">
            <input
              type="text"
              className="form-input compact-input explore-search-input"
              placeholder="Buscar por nombre, país, ciudad o ID"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleApplySearch();
              }}
            />

            <button
              type="button"
              className="explore-search-button"
              onClick={handleApplySearch}
              aria-label="Buscar"
              title="Buscar"
            >
              <SearchIcon />
            </button>
          </div>
        </div>

        <div className="explore-secondary-filters-grid">
          <div className="explore-filter-field">
            <label className="explore-field-label">País</label>
            <select
              className="form-input compact-input explore-filter-select"
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              aria-label="Filtrar por país"
            >
              <option value="">Todos los países</option>
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>

          <div className="explore-filter-field">
            <label className="explore-field-label">Edad</label>
            <select
              className="form-input compact-input explore-filter-select"
              value={selectedAgeRange}
              onChange={(e) => setSelectedAgeRange(e.target.value)}
              aria-label="Filtrar por edad"
            >
              <option value="">Todas las edades</option>
              <option value="0-12">0 a 12 años</option>
              <option value="13-17">13 a 17 años</option>
              <option value="18-30">18 a 30 años</option>
              <option value="31-59">31 a 59 años</option>
              <option value="60+">60+ años</option>
            </select>
          </div>

          <div className="explore-filter-field">
            <label className="explore-field-label">Desde</label>
            <div className="explore-date-input-wrap">
              <input
                type="date"
                className="form-input compact-input explore-date-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                aria-label="Fecha inicial"
              />
            </div>
          </div>

          <div className="explore-filter-field">
            <label className="explore-field-label">Hasta</label>
            <div className="explore-date-input-wrap">
              <input
                type="date"
                className="form-input compact-input explore-date-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                aria-label="Fecha final"
              />
            </div>
          </div>
        </div>
      </div>

      {!isLoading && (
        <div className="explore-results-bar">
          <div className="explore-results-copy">
            <span className="explore-results-title">Resultados</span>
            <span className="explore-results-text">
              Mostrando <strong>{startCount}-{endCount}</strong> de{" "}
              <strong>{totalFiltered}</strong> caso{totalFiltered === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="explore-loading-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="explore-poster-card skeleton" key={index}>
              <div className="explore-poster-image skeleton-block" />
              <div className="explore-poster-line skeleton-line large" />
              <div className="explore-poster-line skeleton-line" />
              <div className="explore-poster-line skeleton-line short" />
            </div>
          ))}
        </div>
      ) : visibleCases.length > 0 ? (
        <>
          <div className="explore-posters-grid">
            {visibleCases.map((item) => {
              const posterSrc = ipfsToHttp(
                item.metadata?.posterImage ||
                  (Array.isArray(item.metadata?.gallery)
                    ? item.metadata.gallery[0]
                    : "")
              );

              return (
                <button
                  type="button"
                  key={`${item.id}-${item.metadataCID}`}
                  className="explore-poster-card"
                  onClick={() => handleSelectCase(item.id)}
                >
                  <div className="explore-poster-image-wrap">
                    {posterSrc ? (
                      <img
                        src={posterSrc}
                        alt={item.metadata?.name || `Caso ${item.id}`}
                        className="explore-poster-image"
                      />
                    ) : (
                      <div className="explore-poster-image empty">
                        Sin imagen
                      </div>
                    )}
                  </div>

                  <div className="explore-poster-body">
                    <h3 className="explore-poster-name">
                      {item.metadata?.name || "Persona no identificada"}
                    </h3>

                    <p className="explore-poster-location">
                      {[item.metadata?.city, item.metadata?.country]
                        .filter(Boolean)
                        .join(", ") || "Ubicación no disponible"}
                    </p>

                    <div className="explore-poster-status-row">
                      <span
                        className={`explore-case-status ${getCaseStatusClass(
                          item.status
                        )}`}
                      >
                        {getCaseStatusLabel(item.status)}
                      </span>
                    </div>

                    <div className="explore-poster-footer">
                      <span className="explore-case-id">ID #{item.id}</span>
                      <span className="explore-case-age">
                        {item.metadata?.age !== undefined &&
                        item.metadata?.age !== null
                          ? `${item.metadata.age} años`
                          : "Edad N/D"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="explore-pagination">
            <button
              type="button"
              className="secondary-button explore-page-button"
              onClick={handlePrevPage}
              disabled={safePage === 0}
            >
              <ChevronLeftIcon />
              <span className="explore-page-text">Anterior</span>
            </button>

            <div className="explore-pagination-counter">
              Página <strong>{safePage + 1}</strong> de <strong>{totalPages}</strong>
            </div>

            <button
              type="button"
              className="secondary-button explore-page-button"
              onClick={handleNextPage}
              disabled={safePage >= totalPages - 1}
            >
              <span className="explore-page-text">Siguiente</span>
              <ChevronRightIcon />
            </button>
          </div>
        </>
      ) : (
        <div className="explore-empty-state">
          No se encontraron afiches con ese criterio de búsqueda.
        </div>
      )}
    </section>
  );
}

export default ExploreCases;