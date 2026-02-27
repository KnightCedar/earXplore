
const mode = document.body.dataset.mode || "default";
const STORAGE_KEY = `selected_columns_${mode}`;

export function loadSelectedColumns() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : null;
}

export function saveSelectedColumns(cols) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cols));
}

export function clearSelectedColumns() {
  localStorage.removeItem(STORAGE_KEY);
}