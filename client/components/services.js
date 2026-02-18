const TOKEN_KEY = "english_app_token";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    ...options,
    headers
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(payload.error || "Request failed");
    error.responseErrors = payload.errors || {};
    throw error;
  }

  return payload;
}

async function login(email, password) {
  const data = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  setToken(data.token);
  return data.user;
}

async function register({ email, password, confirmPassword, nickname }) {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, confirmPassword, nickname })
  });
}

async function getCurrentUser() {
  try {
    return await request("/api/auth/me");
  } catch (err) {
    return null;
  }
}

async function getSectionsTree(includeInactive = false) {
  const query = includeInactive ? "?include_inactive=1" : "";
  return request(`/api/sections/tree${query}`);
}

async function getSections(parentId, includeInactive = false) {
  const params = new URLSearchParams();
  if (parentId == null) {
    params.set("parent_id", "null");
  } else {
    params.set("parent_id", String(parentId));
  }
  if (includeInactive) {
    params.set("include_inactive", "1");
  }
  return request(`/api/sections?${params.toString()}`);
}

async function getExercises(sectionId) {
  const query = sectionId == null ? "" : `?section_id=${encodeURIComponent(sectionId)}`;
  return request(`/api/exercises${query}`);
}

async function saveResult(exerciseId, answerIndex, isCorrect) {
  return request("/api/results", {
    method: "POST",
    body: JSON.stringify({ exerciseId, answerIndex, isCorrect })
  });
}

async function getResults() {
  return request("/api/results");
}

async function addExercise(exercise) {
  return request("/api/exercises", {
    method: "POST",
    body: JSON.stringify(exercise)
  });
}

export const api = {
  getToken,
  setToken,
  logout,
  login,
  register,
  getCurrentUser,
  getSections,
  getSectionsTree,
  getExercises,
  saveResult,
  getResults,
  addExercise
};
