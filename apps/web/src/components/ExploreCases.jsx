import { useEffect, useMemo, useState } from "react";
import { getCaseById, getNextCaseId } from "../services/contract";
import { fetchJSONFromIPFS, ipfsToHttp } from "../services/ipfs";
import { COUNTRIES, getStatesByCountry, getCitiesByState } from "../data/worldData";

const CASES_PER_PAGE = 6;

// ─── helpers ──────────────────────────────────────────────────────────────────

function extractMetadataCID(data) {
  if (!data) return "";
  if (typeof data.metadataCID === "string" && data.metadataCID.trim())
    return data.metadataCID.trim();
  if (typeof data[2] === "string" && data[2].trim()) return data[2].trim();
  return "";
}

function getCaseStatusLabel(status) {
  return Number(status) === 1 ? "Encontrado" : "Desaparecido";
}

function getCaseStatusClass(status) {
  return Number(status) === 1 ? "found" : "missing";
}

// ─── icons ────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg className="explore-search-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className="explore-nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="explore-nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg className="explore-section-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M4 6H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 12H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 18H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg className="explore-card-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.8"/>
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="explore-card-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg className="explore-card-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M4 21c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

// ─── sorted countries list from worldData ─────────────────────────────────────

const SORTED_COUNTRIES = [...COUNTRIES].sort((a, b) =>
  a.name.localeCompare(b.name)
);

// ─── age range matcher ────────────────────────────────────────────────────────

function matchesAgeRange(ageValue, range) {
  const age = Number(ageValue);
  if (!range) return true;
  if (Number.isNaN(age)) return false;
  switch (range) {
    case "0-12":  return age >= 0  && age <= 12;
    case "13-17": return age >= 13 && age <= 17;
    case "18-30": return age >= 18 && age <= 30;
    case "31-59": return age >= 31 && age <= 59;
    case "60+":   return age >= 60;
    default:      return true;
  }
}

function matchesDateInterval(caseDateValue, fromDate, toDate) {
  if (!fromDate && !toDate) return true;
  if (!caseDateValue) return false;
  const caseDate = new Date(caseDateValue);
  if (Number.isNaN(caseDate.getTime())) return false;
  if (fromDate && caseDate < new Date(fromDate)) return false;
  if (toDate) {
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);
    if (caseDate > to) return false;
  }
  return true;
}

// ─── component ────────────────────────────────────────────────────────────────

function ExploreCases({ setMessage, onSelectCase }) {
  const [allCases, setAllCases]               = useState([]);
  const [isLoading, setIsLoading]             = useState(false);
  const [searchText, setSearchText]           = useState("");
  const [appliedSearch, setAppliedSearch]     = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedState, setSelectedState]     = useState("");
  const [selectedCity, setSelectedCity]       = useState("");
  const [selectedAgeRange, setSelectedAgeRange] = useState("");
  const [startDate, setStartDate]             = useState("");
  const [endDate, setEndDate]                 = useState("");
  const [currentPage, setCurrentPage]         = useState(0);

  // ── cascading lists ──────────────────────────────────────────────────────────
  const stateList = useMemo(
    () => (selectedCountry ? getStatesByCountry(selectedCountry) : []),
    [selectedCountry]
  );

  const cityList = useMemo(
    () => {
      if (!selectedCountry || !selectedState) return [];
      const stateId = Number(selectedState);
      return getCitiesByState(selectedCountry, stateId);
    },
    [selectedCountry, selectedState]
  );

  // ── reset cascades ───────────────────────────────────────────────────────────
  useEffect(() => {
    setSelectedState("");
    setSelectedCity("");
  }, [selectedCountry]);

  useEffect(() => {
    setSelectedCity("");
  }, [selectedState]);

  // ── load cases ───────────────────────────────────────────────────────────────
  async function loadCases() {
    try {
      setIsLoading(true);
      setMessage("Cargando afiches desde blockchain...");

      const nextCaseId   = await getNextCaseId();
      const totalCases   = Number(nextCaseId);
      const loadedCases  = [];

      for (let i = 0; i < totalCases; i++) {
        try {
          const onChainData = await getCaseById(i);
          if (!onChainData) continue;

          const metadataCID = extractMetadataCID(onChainData);
          if (!metadataCID) continue;

          const metadata = await fetchJSONFromIPFS(metadataCID);

          loadedCases.push({
            id:           Number(onChainData.id ?? onChainData[0] ?? i),
            recipient:    onChainData.recipient  || onChainData[1] || "",
            totalDonated: onChainData.totalDonated || onChainData[4] || "0",
            status:       onChainData.status  ?? onChainData[3],
            active:       onChainData.active  ?? onChainData[6],
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

  useEffect(() => { loadCases(); }, []);

  // ── filter actions ───────────────────────────────────────────────────────────
  function handleApplySearch() { setAppliedSearch(searchText); }

  function handleClearFilters() {
    setSearchText("");
    setAppliedSearch("");
    setSelectedCountry("");
    setSelectedState("");
    setSelectedCity("");
    setSelectedAgeRange("");
    setStartDate("");
    setEndDate("");
    setCurrentPage(0);
  }

  // ── filtering ────────────────────────────────────────────────────────────────
  const filteredCases = useMemo(() => {
    const q = appliedSearch.trim().toLowerCase();

    return allCases.filter((item) => {
      const name        = String(item.metadata?.name        || "").toLowerCase();
      const country     = String(item.metadata?.country     || "").toLowerCase();
      const city        = String(item.metadata?.city        || "").toLowerCase();
      const state       = String(item.metadata?.state       || "").toLowerCase();
      const description = String(item.metadata?.description || "").toLowerCase();
      const id          = String(item.id || "");

      const caseCountryCode = String(item.metadata?.countryCode  || "");
      const caseStateId     = String(item.metadata?.stateId      || "");
      const caseCityId      = String(item.metadata?.cityId       || "");

      const caseAge  = item.metadata?.age;
      const caseDate =
        item.metadata?.lastSeenDate ||
        item.metadata?.missingDate  ||
        item.metadata?.date         ||
        "";

      const matchesText =
        !q ||
        name.includes(q)        ||
        country.includes(q)     ||
        city.includes(q)        ||
        state.includes(q)       ||
        description.includes(q) ||
        id.includes(q);

      // Country: match by iso2 code stored in metadata
      const matchesCountry =
        !selectedCountry || caseCountryCode === selectedCountry;

      // State: match by stateId (numeric string) stored in metadata
      const matchesState =
        !selectedState || caseStateId === String(selectedState);

      // City: match by cityId stored in metadata, or fall back to city name
      const matchesCity =
        !selectedCity ||
        caseCityId === String(selectedCity) ||
        city === (cityList.find((c) => String(c.id) === String(selectedCity))?.name || "").toLowerCase();

      const matchesAge  = matchesAgeRange(caseAge, selectedAgeRange);
      const matchesDate = matchesDateInterval(caseDate, startDate, endDate);

      return matchesText && matchesCountry && matchesState && matchesCity && matchesAge && matchesDate;
    });
  }, [
    allCases, appliedSearch,
    selectedCountry, selectedState, selectedCity,
    selectedAgeRange, startDate, endDate, cityList,
  ]);

  const totalFiltered = filteredCases.length;
  const totalPages    = Math.max(1, Math.ceil(totalFiltered / CASES_PER_PAGE));
  const safePage      = Math.min(currentPage, totalPages - 1);

  const visibleCases = useMemo(() => {
    const start = safePage * CASES_PER_PAGE;
    return filteredCases.slice(start, start + CASES_PER_PAGE);
  }, [filteredCases, safePage]);

  useEffect(() => {
    setCurrentPage(0);
  }, [appliedSearch, selectedCountry, selectedState, selectedCity, selectedAgeRange, startDate, endDate]);

  function handlePrevPage() { setCurrentPage((p) => Math.max(p - 1, 0)); }
  function handleNextPage()  { setCurrentPage((p) => Math.min(p + 1, totalPages - 1)); }

  function handleSelectCase(caseId) {
    if (typeof onSelectCase === "function") onSelectCase(caseId);
    setMessage(`Caso ${caseId} enviado al lector`);
  }

  const startCount = totalFiltered === 0 ? 0 : safePage * CASES_PER_PAGE + 1;
  const endCount   = Math.min((safePage + 1) * CASES_PER_PAGE, totalFiltered);

  const activeFilterCount = [
    appliedSearch,
    selectedCountry,
    selectedState,
    selectedCity,
    selectedAgeRange,
    startDate,
    endDate,
  ].filter(Boolean).length;

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <section id="explorar" className="section-card explore-cases-card">
      {/* ── top bar ── */}
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

      {/* ── filters panel ── */}
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
            <button type="button" className="explore-clear-button" onClick={handleClearFilters}>
              Limpiar
            </button>
          </div>
        </div>

        {/* search row */}
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
              onKeyDown={(e) => { if (e.key === "Enter") handleApplySearch(); }}
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

        {/* secondary filters – 3-col location cascade + age + dates */}
        <div className="explore-secondary-filters-grid">

          {/* País */}
          <div className="explore-filter-field">
            <label className="explore-field-label">País</label>
            <select
              className="form-input compact-input explore-filter-select"
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              aria-label="Filtrar por país"
            >
              <option value="">Todos los países</option>
              {SORTED_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Estado / Región */}
          <div className="explore-filter-field">
            <label className="explore-field-label">Estado / Región</label>
            <select
              className="form-input compact-input explore-filter-select"
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              disabled={!selectedCountry || stateList.length === 0}
              aria-label="Filtrar por estado o región"
            >
              <option value="">
                {!selectedCountry
                  ? "Selecciona un país"
                  : stateList.length === 0
                  ? "Sin regiones"
                  : "Todas las regiones"}
              </option>
              {stateList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Ciudad */}
          <div className="explore-filter-field">
            <label className="explore-field-label">Ciudad</label>
            <select
              className="form-input compact-input explore-filter-select"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              disabled={!selectedState || cityList.length === 0}
              aria-label="Filtrar por ciudad"
            >
              <option value="">
                {!selectedState
                  ? "Selecciona una región"
                  : cityList.length === 0
                  ? "Sin ciudades"
                  : "Todas las ciudades"}
              </option>
              {cityList.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Edad */}
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

          {/* Desde */}
          <div className="explore-filter-field">
            <label className="explore-field-label">Desde</label>
            <input
              type="date"
              className="form-input compact-input explore-date-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-label="Fecha inicial"
            />
          </div>

          {/* Hasta */}
          <div className="explore-filter-field">
            <label className="explore-field-label">Hasta</label>
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

      {/* ── results bar ── */}
      {!isLoading && (
        <div className="explore-results-bar">
          <div className="explore-results-copy">
            <span className="explore-results-title">Resultados</span>
            <span className="explore-results-text">
              Mostrando <strong>{startCount}–{endCount}</strong> de{" "}
              <strong>{totalFiltered}</strong> caso{totalFiltered === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      )}

      {/* ── grid ── */}
      {isLoading ? (
        <div className="explore-loading-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="explore-poster-card skeleton" key={i}>
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
                  (Array.isArray(item.metadata?.gallery) ? item.metadata.gallery[0] : "")
              );

              // Build location string using worldData names when available
              const locationParts = [];
              if (item.metadata?.city)    locationParts.push(item.metadata.city);
              if (item.metadata?.state)   locationParts.push(item.metadata.state);
              if (item.metadata?.country) locationParts.push(item.metadata.country);
              const locationStr = locationParts.join(", ") || "Ubicación no disponible";

              const lastSeenDate =
                item.metadata?.lastSeenDate ||
                item.metadata?.missingDate  ||
                item.metadata?.date         ||
                null;

              const formattedDate = lastSeenDate
                ? new Date(lastSeenDate).toLocaleDateString("es-PE", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : null;

              const statusClass = getCaseStatusClass(item.status);
              const statusLabel = getCaseStatusLabel(item.status);

              return (
                <button
                  type="button"
                  key={`${item.id}-${item.metadataCID}`}
                  className="explore-poster-card"
                  onClick={() => handleSelectCase(item.id)}
                >
                  {/* image */}
                  <div className="explore-poster-image-wrap">
                    {posterSrc ? (
                      <img
                        src={posterSrc}
                        alt={item.metadata?.name || `Caso ${item.id}`}
                        className="explore-poster-image"
                      />
                    ) : (
                      <div className="explore-poster-image empty">
                        <PersonIcon />
                        <span>Sin imagen</span>
                      </div>
                    )}

                    {/* status badge overlaid on image */}
                    <span className={`explore-case-status-badge ${statusClass}`}>
                      {statusLabel}
                    </span>
                  </div>

                  {/* body */}
                  <div className="explore-poster-body">
                    <h3 className="explore-poster-name">
                      {item.metadata?.name || "Persona no identificada"}
                    </h3>

                    <div className="explore-poster-meta">
                      <span className="explore-poster-meta-item">
                        <MapPinIcon />
                        {locationStr}
                      </span>

                      {formattedDate && (
                        <span className="explore-poster-meta-item">
                          <CalendarIcon />
                          {formattedDate}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* footer */}
                  <div className="explore-poster-footer">
                    <span className="explore-case-id">ID #{item.id}</span>
                    <span className="explore-case-age">
                      {item.metadata?.age != null
                        ? `${item.metadata.age} años`
                        : "Edad N/D"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* pagination */}
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