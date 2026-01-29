import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { createNote, deleteNote, listNotes, updateNote } from "./api/notesApi";

/**
 * Normalize a note object coming from an unknown backend shape.
 * Supports typical {id,title,content} but also tolerates missing fields.
 * @param {any} note
 */
function normalizeNote(note) {
  return {
    id: note?.id ?? note?.note_id ?? note?.uuid ?? note?.pk ?? "",
    title: note?.title ?? "",
    content: note?.content ?? "",
  };
}

/**
 * @param {string} title
 * @param {string} content
 */
function validateNote(title, content) {
  const trimmedTitle = (title || "").trim();
  const trimmedContent = (content || "").trim();

  if (!trimmedTitle) return "Title is required.";
  if (trimmedTitle.length > 120) return "Title must be 120 characters or less.";
  if (trimmedContent.length > 10000) return "Content is too long (max 10,000 characters).";
  return null;
}

// PUBLIC_INTERFACE
function App() {
  /** Retro-themed notes SPA: list on the left, editor on the right. */
  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");

  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [apiOk, setApiOk] = useState(true);

  const selectedNote = useMemo(() => notes.find((n) => n.id === selectedId) || null, [
    notes,
    selectedId,
  ]);

  const filteredNotes = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return notes;

    return notes.filter((n) => {
      const t = (n.title || "").toLowerCase();
      const c = (n.content || "").toLowerCase();
      return t.includes(q) || c.includes(q);
    });
  }, [notes, filter]);

  async function refreshNotes({ preserveSelection = true } = {}) {
    setError("");
    setBusy(true);
    try {
      const data = await listNotes();

      // Support possible shapes: array, {items: []}, {notes: []}
      const list = Array.isArray(data) ? data : data?.items || data?.notes || [];
      const normalized = list.map(normalizeNote).filter((n) => n.id !== "");

      setNotes(normalized);
      setApiOk(true);

      if (preserveSelection) {
        // If current selection vanished, fall back to first note.
        if (selectedId && normalized.some((n) => n.id === selectedId)) return;
        setSelectedId(normalized[0]?.id ?? null);
      } else {
        setSelectedId(normalized[0]?.id ?? null);
      }
    } catch (e) {
      setApiOk(false);
      setError(e?.message || "Failed to load notes from API.");
    } finally {
      setBusy(false);
    }
  }

  // Load initial notes from API
  useEffect(() => {
    refreshNotes({ preserveSelection: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When selection changes, load draft from selected note
  useEffect(() => {
    if (!selectedNote) {
      setDraftTitle("");
      setDraftContent("");
      return;
    }
    setDraftTitle(selectedNote.title || "");
    setDraftContent(selectedNote.content || "");
  }, [selectedNote]);

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedNote) return draftTitle.trim() !== "" || draftContent.trim() !== "";
    return draftTitle !== (selectedNote.title || "") || draftContent !== (selectedNote.content || "");
  }, [selectedNote, draftTitle, draftContent]);

  // PUBLIC_INTERFACE
  async function handleCreate() {
    /** Create a new note and select it. */
    setError("");
    setBusy(true);
    try {
      const payload = { title: "Untitled", content: "" };
      const created = await createNote(payload);
      const newNote = normalizeNote(created);

      // If backend returns no note, just refresh
      if (!newNote.id) {
        await refreshNotes({ preserveSelection: false });
        return;
      }

      setNotes((prev) => [newNote, ...prev]);
      setSelectedId(newNote.id);
      setApiOk(true);
    } catch (e) {
      setApiOk(false);
      setError(e?.message || "Failed to create note.");
    } finally {
      setBusy(false);
    }
  }

  // PUBLIC_INTERFACE
  async function handleSave() {
    /** Save current note (update if selected, otherwise create). */
    setError("");

    const validationError = validateNote(draftTitle, draftContent);
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    try {
      if (selectedNote?.id) {
        const updated = await updateNote(selectedNote.id, {
          title: draftTitle.trim(),
          content: draftContent,
        });
        const normalized = normalizeNote(updated);

        // If backend doesn't return updated note, update locally as a fallback.
        setNotes((prev) =>
          prev.map((n) =>
            n.id === selectedNote.id
              ? {
                  ...n,
                  title: normalized.title || draftTitle.trim(),
                  content: normalized.content ?? draftContent,
                }
              : n
          )
        );
      } else {
        const created = await createNote({
          title: draftTitle.trim(),
          content: draftContent,
        });
        const normalized = normalizeNote(created);
        if (normalized.id) {
          setNotes((prev) => [normalized, ...prev]);
          setSelectedId(normalized.id);
        } else {
          await refreshNotes({ preserveSelection: false });
        }
      }

      setApiOk(true);
    } catch (e) {
      setApiOk(false);
      setError(e?.message || "Failed to save note.");
    } finally {
      setBusy(false);
    }
  }

  // PUBLIC_INTERFACE
  async function handleDelete() {
    /** Delete selected note. */
    if (!selectedNote?.id) return;

    const ok = window.confirm(`Delete "${selectedNote.title || "Untitled"}"? This cannot be undone.`);
    if (!ok) return;

    setError("");
    setBusy(true);
    try {
      await deleteNote(selectedNote.id);

      setNotes((prev) => prev.filter((n) => n.id !== selectedNote.id));
      setSelectedId((prevId) => {
        if (prevId !== selectedNote.id) return prevId;
        // select next available
        const remaining = notes.filter((n) => n.id !== selectedNote.id);
        return remaining[0]?.id ?? null;
      });

      setApiOk(true);
    } catch (e) {
      setApiOk(false);
      setError(e?.message || "Failed to delete note.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="App">
      <div className="appShell">
        <aside className="panel sidebar" aria-label="Notes sidebar">
          <div className="sidebarHeader">
            <div className="brandRow">
              <div className="brand">
                <h1 className="brandTitle">RETRO NOTES</h1>
                <p className="brandSubtitle">Neon CRUD • title + content</p>
              </div>
              <span
                className={`statusPill ${apiOk ? "statusOk" : "statusErr"}`}
                aria-label={apiOk ? "API reachable" : "API error"}
                title={
                  process.env.REACT_APP_NOTES_API_BASE_URL
                    ? `API: ${process.env.REACT_APP_NOTES_API_BASE_URL}`
                    : "API: same-origin (set REACT_APP_NOTES_API_BASE_URL for dev)"
                }
              >
                {apiOk ? "API OK" : "API ERR"}
              </span>
            </div>

            <div className="toolbar" role="toolbar" aria-label="Sidebar actions">
              <button className="btn btnPrimary" onClick={handleCreate} disabled={busy}>
                + New
              </button>
              <button
                className="btn btnDanger"
                onClick={handleDelete}
                disabled={busy || !selectedNote?.id}
              >
                Delete
              </button>
            </div>

            <div className="searchRow">
              <label className="label" htmlFor="noteSearch" style={{ display: "none" }}>
                Search notes
              </label>
              <input
                id="noteSearch"
                className="input"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search notes…"
                aria-label="Search notes"
              />
            </div>
          </div>

          <div className="noteList" role="list" aria-label="Notes list">
            {busy && notes.length === 0 ? (
              <div className="emptyHint">Loading notes…</div>
            ) : filteredNotes.length === 0 ? (
              <div className="emptyHint">
                {filter.trim() ? "No notes match your search." : "No notes yet. Create one!"}
              </div>
            ) : (
              filteredNotes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`noteItem ${n.id === selectedId ? "noteItemActive" : ""}`}
                  onClick={() => setSelectedId(n.id)}
                  role="listitem"
                  aria-current={n.id === selectedId ? "true" : "false"}
                >
                  <p className="noteTitle">{n.title || "Untitled"}</p>
                  <p className="noteMeta">{(n.content || "").trim() || "No content"}</p>
                </button>
              ))
            )}
          </div>
        </aside>

        <main className="panel main" aria-label="Note editor">
          <div className="mainHeader">
            <div>
              <div className="brandTitle" style={{ fontSize: 13 }}>
                {selectedNote?.id ? "EDIT NOTE" : "NEW NOTE"}
              </div>
              <div className="brandSubtitle">
                {busy ? "Working…" : hasUnsavedChanges ? "Unsaved changes" : "All changes saved"}
              </div>
            </div>

            <button
              className="btn btnPrimary"
              onClick={handleSave}
              disabled={busy || (!hasUnsavedChanges && !!selectedNote?.id)}
            >
              Save
            </button>
          </div>

          <div className="mainBody">
            <div className="formRow">
              <div>
                <label className="label" htmlFor="titleInput">
                  Title
                </label>
                <input
                  id="titleInput"
                  className="input"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="e.g. Laser ideas for tomorrow"
                  maxLength={120}
                />
              </div>

              <div>
                <label className="label" htmlFor="contentInput">
                  Content
                </label>
                <textarea
                  id="contentInput"
                  className="textarea"
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  placeholder="Type your note…"
                />
              </div>

              {error ? (
                <div className="alert" role="alert">
                  {error}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mainFooter">
            <div className="helperText">
              Tip: set <code>REACT_APP_NOTES_API_BASE_URL</code> to point at the backend (for dev).
            </div>
            <button className="btn" onClick={() => refreshNotes()} disabled={busy}>
              Refresh
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;

