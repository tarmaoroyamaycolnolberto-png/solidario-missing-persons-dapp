import { useEffect, useMemo, useRef, useState } from "react";
import { createCaseOnChain } from "../services/contract";
import { uploadImageToBackend, uploadJSONToBackend } from "../services/ipfs";
import { WORLD_DATA, getStatesByCountry, getCitiesByState } from "../data/worldData";
import Web3 from "web3";

function WalletIcon() {
  return (
    <svg className="create-case-info-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 7.5C3 6.12 4.12 5 5.5 5H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M3 8.5C3 7.12 4.12 6 5.5 6H18.5C19.88 6 21 7.12 21 8.5V15.5C21 16.88 19.88 18 18.5 18H5.5C4.12 18 3 16.88 3 15.5V8.5Z" stroke="currentColor" strokeWidth="2" />
      <path d="M16.5 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16.5" cy="12" r="1.2" fill="currentColor" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg className="create-case-upload-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 16V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8.5 10.5L12 7L15.5 10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg className="create-case-preview-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="9" cy="10" r="1.4" fill="currentColor" />
      <path d="M21 15L16.6 11.2C16.12 10.79 15.41 10.82 14.97 11.26L10.4 15.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CreateCaseForm({ account, setMessage }) {
  const [personName, setPersonName]       = useState("");
  const [countryCode, setCountryCode]     = useState("");   // iso2 p.ej. "PE"
  const [stateId, setStateId]             = useState("");   // id numérico de región
  const [cityId, setCityId]               = useState("");   // id numérico de ciudad
  const [age, setAge]                     = useState("");
  const [description, setDescription]     = useState("");
  const [contact, setContact]             = useState("");
  const [missingDate, setMissingDate]     = useState("");
  const [imageFiles, setImageFiles]       = useState([]);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [recipientAddress, setRecipientAddress] = useState("");
  const fileInputRef = useRef(null);

  // ── Autocompletar wallet ────────────────────────────────────────
  useEffect(() => {
    if (account) setRecipientAddress(account);
  }, [account]);

  // ── Opciones derivadas ──────────────────────────────────────────
  const countries = useMemo(
    () => WORLD_DATA.map((c) => ({ code: c.iso2, name: c.name })).sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  const states = useMemo(() => getStatesByCountry(countryCode), [countryCode]);

  const cities = useMemo(() => {
    if (!stateId) return [];
    return getCitiesByState(countryCode, Number(stateId));
  }, [countryCode, stateId]);

  // ── Labels seleccionados (para guardar en metadata) ─────────────
  const selectedCountryObj = useMemo(
    () => WORLD_DATA.find((c) => c.iso2 === countryCode) || null,
    [countryCode]
  );

  const selectedStateObj = useMemo(
    () => states.find((s) => s.id === Number(stateId)) || null,
    [states, stateId]
  );

  const selectedCityObj = useMemo(
    () => cities.find((c) => c.id === Number(cityId)) || null,
    [cities, cityId]
  );

  // ── Limpiar en cascada ──────────────────────────────────────────
  function handleCountryChange(e) {
    setCountryCode(e.target.value);
    setStateId("");
    setCityId("");
  }

  function handleStateChange(e) {
    setStateId(e.target.value);
    setCityId("");
  }

  // ── Preview imágenes ────────────────────────────────────────────
  const previews = useMemo(
    () => imageFiles.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })),
    [imageFiles]
  );

  useEffect(() => {
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [previews]);

  function handleImageChange(e) {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length === 0) return;

    const invalidFile = newFiles.find((f) => !f.type.startsWith("image/"));
    if (invalidFile) { setMessage("Todos los archivos deben ser imágenes válidas"); e.target.value = ""; return; }

    const combined = [...imageFiles, ...newFiles];
    if (combined.length > 3) { setMessage("Solo puedes subir un máximo de 3 imágenes"); e.target.value = ""; return; }

    setImageFiles(combined);
    setMessage("");
    e.target.value = "";
  }

  function handleRemoveImage(indexToRemove) {
    setImageFiles((prev) => prev.filter((_, i) => i !== indexToRemove));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenFilePicker() {
    if (isSubmitting) return;
    fileInputRef.current?.click();
  }

  // ── Submit ──────────────────────────────────────────────────────
  async function handleCreateCase() {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      if (!account) throw new Error("Primero conecta tu wallet");
      if (!personName.trim()) throw new Error("Ingresa el nombre de la persona");
      if (!countryCode) throw new Error("Selecciona un país");
      if (!stateId) throw new Error("Selecciona una región / estado");
      if (!cityId) throw new Error("Selecciona una ciudad o distrito");

      const numericAge = Number(age);
      if (age === "" || Number.isNaN(numericAge) || numericAge < 0 || numericAge > 120)
        throw new Error("Ingresa una edad válida");

      if (!missingDate) throw new Error("Selecciona la fecha de desaparición");
      if (!contact.trim()) throw new Error("Ingresa un contacto");
      if (!description.trim()) throw new Error("Ingresa una descripción");
      if (!Web3.utils.isAddress(recipientAddress)) throw new Error("Wallet receptora inválida");
      if (imageFiles.length === 0) throw new Error("Debes subir entre 1 y 3 imágenes");

      setMessage("Subiendo imágenes...");
      const imageCIDs = [];
      for (const file of imageFiles) {
        const cid = await uploadImageToBackend(file);
        imageCIDs.push(cid);
      }

      const metadata = {
        name:        personName.trim(),
        country:     selectedCountryObj?.name     || "",
        countryCode: selectedCountryObj?.iso2     || "",
        state:       selectedStateObj?.name       || "",
        stateId:     Number(stateId),
        city:        selectedCityObj?.name        || "",
        cityId:      Number(cityId),
        age:         numericAge,
        description: description.trim(),
        contact:     contact.trim(),
        missingDate,
        posterImage: `ipfs://${imageCIDs[0]}`,
        gallery:     imageCIDs.map((cid) => `ipfs://${cid}`),
      };

      setMessage("Subiendo metadata...");
      const metadataCID = await uploadJSONToBackend(metadata);

      setMessage("Creando caso en blockchain...");
      await createCaseOnChain(recipientAddress, metadataCID, account);
      setMessage(`Caso creado correctamente. Metadata CID: ${metadataCID}`);

      // Reset
      setPersonName("");
      setCountryCode("");
      setStateId("");
      setCityId("");
      setAge("");
      setDescription("");
      setContact("");
      setMissingDate("");
      setImageFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Error al crear caso");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <section className="section-card compact-form-card create-case-panel">
      <div className="create-case-header">
        <div className="create-case-header-copy">
          <p className="section-description compact-description create-case-description">
            Registra la información de la persona desaparecida, sube hasta 3 imágenes
            y guarda el caso en blockchain con metadata en IPFS.
          </p>
        </div>
      </div>

      {/* Wallet receptora */}
      <div className="create-case-wallet-card compact-banner">
        <div className="create-case-wallet-icon-wrap">
          <WalletIcon />
        </div>
        <div className="create-case-wallet-content">
          <span className="auto-recipient-label create-case-wallet-label">Wallet receptora</span>
          <input
            type="text"
            className="form-input compact-input create-case-wallet-input"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            placeholder="0x..."
            disabled={isSubmitting}
          />
          <p className="create-case-wallet-helper">Puedes cambiar la wallet que recibirá las donaciones</p>
        </div>
      </div>

      <div className="create-case-form-shell">

        {/* ── Bloque: Datos principales ── */}
        <div className="create-case-block">
          <div className="create-case-block-head">
            <h3 className="create-case-block-title">Datos principales</h3>
            <p className="create-case-block-text">Completa la información básica del caso.</p>
          </div>

          <div className="form-grid compact-form-grid create-case-grid">

            {/* Nombre */}
            <div className="form-group form-group-full">
              <label className="form-label">Nombre de la persona desaparecida</label>
              <input
                className="form-input compact-input"
                type="text"
                placeholder="Ej. Juan Pérez"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* País */}
            <div className="form-group">
              <label className="form-label">País</label>
              <select
                className="form-input compact-input"
                value={countryCode}
                onChange={handleCountryChange}
                disabled={isSubmitting}
              >
                <option value="">Selecciona un país</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Edad */}
            <div className="form-group">
              <label className="form-label">Edad</label>
              <input
                className="form-input compact-input"
                type="number"
                min="0"
                max="120"
                placeholder="Ej. 14"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Región / Estado */}
            <div className="form-group">
              <label className="form-label">Región / Departamento / Estado</label>
              <select
                className="form-input compact-input"
                value={stateId}
                onChange={handleStateChange}
                disabled={isSubmitting || !countryCode}
              >
                <option value="">
                  {countryCode ? "Selecciona una región" : "Primero selecciona un país"}
                </option>
                {states.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Ciudad / Distrito */}
            <div className="form-group">
              <label className="form-label">Ciudad / Distrito</label>
              <select
                className="form-input compact-input"
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
                disabled={isSubmitting || !stateId}
              >
                <option value="">
                  {stateId ? "Selecciona una ciudad" : "Primero selecciona una región"}
                </option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Fecha */}
            <div className="form-group">
              <label className="form-label">Fecha de desaparición</label>
              <input
                className="form-input compact-input date-input"
                type="date"
                value={missingDate}
                onChange={(e) => setMissingDate(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Contacto */}
            <div className="form-group form-group-full">
              <label className="form-label">Contacto</label>
              <input
                className="form-input compact-input"
                type="text"
                placeholder="Teléfono, correo o referencia"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Descripción */}
            <div className="form-group form-group-full">
              <label className="form-label">Descripción</label>
              <textarea
                className="form-textarea compact-textarea create-case-textarea"
                placeholder="Describe ropa, última ubicación, rasgos o detalles útiles."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

          </div>
        </div>

        {/* ── Bloque: Imágenes ── */}
        <div className="create-case-block create-case-upload-block">
          <div className="create-case-block-head">
            <h3 className="create-case-block-title">Imágenes del afiche</h3>
            <p className="create-case-block-text">Sube entre 1 y 3 imágenes. La primera será la principal del caso.</p>
          </div>

          <input
            ref={fileInputRef}
            className="hidden-file-input"
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageChange}
            disabled={isSubmitting}
          />

          <div className="image-upload-box compact-upload-box create-case-upload-box">
            <div className="create-case-upload-main">
              <div className="create-case-upload-badge"><UploadIcon /></div>
              <div className="image-upload-copy">
                <p className="image-upload-title">Sube hasta 3 imágenes</p>
                <p className="image-upload-text">Formatos permitidos: JPG, PNG, WEBP.</p>
              </div>
            </div>
            <button
              type="button"
              className="secondary-button upload-trigger-button compact-upload-button create-case-upload-button"
              onClick={handleOpenFilePicker}
              disabled={isSubmitting}
            >
              Seleccionar imágenes
            </button>
          </div>

          {imageFiles.length > 0 && (
            <div className="create-case-preview-summary">
              <span className="create-case-preview-counter">
                {imageFiles.length} imagen{imageFiles.length > 1 ? "es" : ""} cargada{imageFiles.length > 1 ? "s" : ""}
              </span>
            </div>
          )}

          {imageFiles.length > 0 && (
            <div className="upload-preview-list create-case-preview-list">
              {previews.map((preview, index) => (
                <div className="upload-preview-row create-case-preview-row" key={`${preview.name}-${index}`}>
                  <div className="upload-preview-thumb-wrap create-case-preview-thumb-wrap">
                    <img src={preview.url} alt={`Vista previa ${index + 1}`} className="upload-preview-thumb" />
                  </div>
                  <div className="upload-preview-content create-case-preview-content">
                    <div className="create-case-preview-meta">
                      <div className="create-case-preview-meta-top">
                        <ImageIcon />
                        <span className="create-case-preview-index">Imagen {index + 1}</span>
                      </div>
                      <p className="upload-preview-filename" title={preview.name}>{preview.name}</p>
                    </div>
                    <button
                      type="button"
                      className="remove-image-button improved-remove-button"
                      onClick={() => handleRemoveImage(index)}
                      disabled={isSubmitting}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      <div className="form-actions compact-actions create-case-actions">
        <button
          className="primary-button compact-submit-button create-case-submit-button"
          onClick={handleCreateCase}
          type="button"
          disabled={isSubmitting || !account}
        >
          {isSubmitting ? "Procesando..." : "Crear caso"}
        </button>
      </div>
    </section>
  );
}

export default CreateCaseForm;