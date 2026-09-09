export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 5;
export const ZOOM_STEP = 0.25;

export const clampZoom = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +numericValue.toFixed(2)));
};
