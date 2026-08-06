export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "/openings-sicilian/";
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export function sharedOpeningAssetUrl(path: string): string {
  return `/openings/${path.replace(/^\/+/, "")}`;
}
