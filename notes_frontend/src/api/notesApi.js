/**
 * Small REST client for Notes backend.
 *
 * Uses fetch and throws readable errors for non-2xx responses.
 */

// Default assumes same-origin in production (reverse proxy). In dev, set REACT_APP_NOTES_API_BASE_URL.
const DEFAULT_BASE_URL = "";

/**
 * @param {Response} response
 * @returns {Promise<any>}
 */
async function parseJsonSafely(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return null;
  return response.json();
}

/**
 * @param {Response} response
 * @returns {Promise<Error>}
 */
async function buildHttpError(response) {
  const body = await parseJsonSafely(response);
  const msg =
    (body && (body.detail || body.message)) ||
    `Request failed (${response.status} ${response.statusText})`;
  return new Error(msg);
}

/**
 * @param {string} path
 * @param {RequestInit} init
 * @returns {Promise<any>}
 */
async function requestJson(path, init = {}) {
  const baseUrl = process.env.REACT_APP_NOTES_API_BASE_URL || DEFAULT_BASE_URL;
  const url = `${baseUrl}${path}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    throw await buildHttpError(response);
  }

  // Many endpoints return JSON. If empty, return null.
  const data = await parseJsonSafely(response);
  return data;
}

// PUBLIC_INTERFACE
export async function listNotes() {
  /** List notes. Expected backend shape is an array of notes. */
  return requestJson(`/notes`, { method: "GET" });
}

// PUBLIC_INTERFACE
export async function getNote(noteId) {
  /** Fetch a single note by id. */
  return requestJson(`/notes/${encodeURIComponent(noteId)}`, { method: "GET" });
}

// PUBLIC_INTERFACE
export async function createNote(payload) {
  /**
   * Create a new note.
   * @param {{title: string, content: string}} payload
   */
  return requestJson(`/notes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// PUBLIC_INTERFACE
export async function updateNote(noteId, payload) {
  /**
   * Update an existing note.
   * @param {{title: string, content: string}} payload
   */
  return requestJson(`/notes/${encodeURIComponent(noteId)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// PUBLIC_INTERFACE
export async function deleteNote(noteId) {
  /** Delete a note by id. */
  return requestJson(`/notes/${encodeURIComponent(noteId)}`, {
    method: "DELETE",
  });
}

