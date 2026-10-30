/** Suppliers are free-text names on purchases; "-" stands for purchases without a supplier. */
export const NO_SUPPLIER = "-";
export const supplierHref = (name?: string | null) => `/suppliers/${encodeURIComponent(name?.trim() || NO_SUPPLIER)}`;
