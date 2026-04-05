const rawApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

export const apiBaseUrl =
  rawApiBaseUrl === undefined ? "http://localhost:4000" : rawApiBaseUrl.trim();

export function apiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (!apiBaseUrl) {
    return normalizedPath;
  }

  return `${apiBaseUrl.replace(/\/$/, "")}${normalizedPath}`;
}
