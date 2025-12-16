import { useEffect, useMemo, useState } from "react";
import {
  api,
  clearToken,
  getToken,
  setToken,
  getApiUrl,
  setApiUrl,
  clearApiUrl,
} from "./api";

function getType(v) {
  if (v === null) return "null";
  return typeof v; // "string" | "number" | "boolean"
}

function coerceToType(type, value) {
  // Convierte el valor actual al tipo elegido (primitivos)
  if (type === "null") return null;

  if (type === "boolean") {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") return value.trim().toLowerCase() === "true";
    return false;
  }

  if (type === "number") {
    if (typeof value === "number") return value;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (typeof value === "string") {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  }

  // string
  if (value === null) return "";
  return String(value);
}

export default function App() {
  const [token, setTokenState] = useState(getToken());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Login
  const [apiUrl, setApiUrlState] = useState(getApiUrl() || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Config
  const [config, setConfig] = useState(null);

  // drafts: { [key]: { type, value } }
  const [drafts, setDrafts] = useState({});

  // fila nueva (+)
  const [newRowOpen, setNewRowOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newType, setNewType] = useState("string");
  const [newValue, setNewValue] = useState(""); // string/number raw; boolean usa true/false

  const isLogged = useMemo(() => Boolean(token), [token]);

  async function loadConfig() {
    setError("");
    setLoading(true);
    try {
      const cfg = await api.getConfig();
      setConfig(cfg);

      const next = {};
      for (const [k, v] of Object.entries(cfg)) {
        next[k] = { type: getType(v), value: v };
      }
      setDrafts(next);
    } catch (e) {
      setConfig(null);
      setDrafts({});
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isLogged) loadConfig();
  }, [isLogged]);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const normalized = setApiUrl(apiUrl);
      if (!/^https?:\/\/.+/i.test(normalized)) {
        throw new Error("La URL de la API debe empezar por http:// o https://");
      }
      const { token } = await api.login(username, password);
      setToken(token);
      setTokenState(token);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    clearToken();
    setTokenState("");
    setConfig(null);
    setDrafts({});
    setError("");
  }

  function handleResetApiUrl() {
    clearApiUrl();
    clearToken();
    setTokenState("");
    setConfig(null);
    setDrafts({});
    setApiUrlState("");
    setError("");
  }

  function updateDraft(key, partial) {
    setDrafts((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || { type: "string", value: "" }), ...partial },
    }));
  }

  async function saveKey(key) {
    setError("");
    setLoading(true);
    try {
      const d = drafts[key];
      if (!d) throw new Error("No hay datos para guardar.");
      await api.patchConfig({ [key]: d.value });
      await loadConfig();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteKey(key) {
    setError("");
    setLoading(true);
    try {
      await api.deleteKey(key);
      await loadConfig();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // --- nueva fila (+) ---
  function openNewRow() {
    setNewRowOpen(true);
    setNewKey("");
    setNewType("string");
    setNewValue("");
  }

  function cancelNewRow() {
    setNewRowOpen(false);
    setNewKey("");
    setNewType("string");
    setNewValue("");
  }

  async function createNewKey() {
    setError("");
    setLoading(true);
    try {
      const key = newKey.trim();
      if (!key) throw new Error("La clave no puede estar vacía.");
      if (!/^[A-Za-z0-9_-]+$/.test(key)) {
        throw new Error("La clave solo puede tener letras, números, _ o -");
      }
      if (config && key in config) throw new Error("Esa clave ya existe.");

      let value;
      if (newType === "null") value = null;
      else if (newType === "boolean") value = Boolean(newValue);
      else if (newType === "number") {
        const n = Number(newValue);
        if (!Number.isFinite(n)) throw new Error("Número inválido.");
        value = n;
      } else value = String(newValue ?? "");

      await api.createKey(key, value);
      setNewRowOpen(false);
      await loadConfig();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function renderValueEditor(key) {
    const d = drafts[key];
    if (!d) return null;

    if (d.type === "boolean") {
      return (
        <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="switch">
            <input
              type="checkbox"
              checked={Boolean(d.value)}
              onChange={(e) => updateDraft(key, { value: e.target.checked })}
            />
            <span className="slider" />
          </span>
          <span className="muted">{d.value ? "true" : "false"}</span>
        </label>
      );
    }

    if (d.type === "number") {
      return (
        <input
          className="input"
          type="number"
          value={typeof d.value === "number" ? d.value : 0}
          onChange={(e) => {
            const raw = e.target.value;
            // permitimos vacío mientras edita, pero lo guardamos como 0
            updateDraft(key, { value: raw === "" ? 0 : Number(raw) });
          }}
        />
      );
    }

    if (d.type === "null") {
      return <code>null</code>;
    }

    return (
      <input
        className="input"
        type="text"
        value={d.value ?? ""}
        onChange={(e) => updateDraft(key, { value: e.target.value })}
      />
    );
  }

  if (!isLogged) {
    return (
      <div style={{ maxWidth: 460, margin: "40px auto", padding: 16 }}>
        <h2>Login</h2>

        <form onSubmit={handleLogin} style={{ display: "grid", gap: 12 }}>
          <label>
            URL de la API
            <input
              className="input"
              value={apiUrl}
              onChange={(e) => setApiUrlState(e.target.value)}
            />
          </label>

          <label>
            Usuario
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>

          <label>
            Contraseña
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <button className="btn btnPrimary" disabled={loading}>Entrar</button>

          <button className="btn" type="button" onClick={handleResetApiUrl} disabled={loading}>
            Borrar URL y sesión
          </button>
        </form>

        {error && <p style={{ color: "#fb7185" }}>{error}</p>}
      </div>
    );
  }

  const entries = config ? Object.entries(config).sort(([a], [b]) => a.localeCompare(b)) : [];

  return (
    <div style={{ maxWidth: 980, margin: "40px auto", padding: 16 }}>
      <div className="toolbar">
        <div>
          <h2 style={{ margin: 0 }}>Configuración</h2>
          <div className="muted">
            API: <code>{getApiUrl()}</code>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={loadConfig} disabled={loading}>Recargar</button>
          <button className="btn" onClick={handleLogout}>Salir</button>
        </div>
      </div>

      {error && <p style={{ color: "#fb7185" }}>{error}</p>}
      {loading && <p className="muted">Cargando...</p>}

      <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
        <div className="toolbar" style={{ padding: 12 }}>
          <strong>Claves</strong>
          <button className="btn btnPrimary" onClick={openNewRow} disabled={loading || newRowOpen}>
            + Añadir
          </button>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th className="th">Clave</th>
              <th className="th">Valor</th>
              <th className="th" style={{ width: 140 }}>Tipo</th>
              <th className="th" style={{ width: 190, textAlign: "center" }}>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {newRowOpen && (
              <tr>
                <td className="td" style={{ fontFamily: "monospace" }}>
                  <input
                    className="input"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="nueva_clave"
                  />
                </td>

                <td className="td">
                  {newType === "boolean" ? (
                    <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="switch">
                        <input
                          type="checkbox"
                          checked={Boolean(newValue)}
                          onChange={(e) => setNewValue(e.target.checked)}
                        />
                        <span className="slider" />
                      </span>
                      <span className="muted">{newValue ? "true" : "false"}</span>
                    </label>
                  ) : newType === "number" ? (
                    <input
                      className="input"
                      type="number"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                    />
                  ) : newType === "null" ? (
                    <code>null</code>
                  ) : (
                    <input
                      className="input"
                      type="text"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                    />
                  )}
                </td>

                <td className="td">
                  <select className="select" value={newType} onChange={(e) => setNewType(e.target.value)}>
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                    <option value="null">null</option>
                  </select>
                </td>

                <td className="td" style={{ textAlign: "center" }}>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    <button className="btn btnPrimary" onClick={createNewKey} disabled={loading || !newKey.trim()}>
                      Guardar
                    </button>
                    <button className="btn" type="button" onClick={cancelNewRow} disabled={loading}>
                      Cancelar
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {entries.map(([key]) => {
              const d = drafts[key];
              if (!d) return null;

              return (
                <tr key={key}>
                  <td className="td" style={{ fontFamily: "monospace" }}>{key}</td>

                  <td className="td">{renderValueEditor(key)}</td>

                  <td className="td">
                    <select
                      className="select"
                      value={d.type}
                      onChange={(e) => {
                        const nextType = e.target.value;
                        const nextValue = coerceToType(nextType, d.value);
                        updateDraft(key, { type: nextType, value: nextValue });
                      }}
                    >
                      <option value="string">string</option>
                      <option value="number">number</option>
                      <option value="boolean">boolean</option>
                      <option value="null">null</option>
                    </select>
                  </td>

                  <td className="td" style={{ textAlign: "center" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                      <button className="btn btnPrimary" onClick={() => saveKey(key)} disabled={loading}>
                        Guardar
                      </button>
                      <button className="btn" onClick={() => deleteKey(key)} disabled={loading} title="Borrar">
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {entries.length === 0 && !newRowOpen && (
              <tr>
                <td className="td muted" colSpan={4}>
                  No hay claves. Pulsa <strong>+ Añadir</strong>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="muted" style={{ marginTop: 12 }}>
        Cambia el tipo con el selector y el editor se adapta. “Guardar” hace <code>PATCH /config</code> solo de esa clave.
      </p>
    </div>
  );
}
