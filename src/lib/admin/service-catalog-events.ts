export const SERVICE_CATALOG_CHANGED_EVENT = "mua:service-catalog-changed";

export function notifyServiceCatalogChanged(): void {
  window.dispatchEvent(new Event(SERVICE_CATALOG_CHANGED_EVENT));
}
