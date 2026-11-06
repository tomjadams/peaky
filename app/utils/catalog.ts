// Provider-neutral catalog URL builders
// These can be configured to point to any service catalog or directory

const CATALOG_BASE = "https://launchpad.is.adyen.com/catalog/default";

/**
 * Build URL to view a user in the external catalog/directory
 */
export const catalogUserUrl = (id: string) => `${CATALOG_BASE}/user/${id}`;

/**
 * Build URL to view a group/team in the external catalog/directory
 */
export const catalogGroupUrl = (id: string) => `${CATALOG_BASE}/group/${id}`;

/**
 * Build URL to view a component/application in the external catalog/directory
 */
export const catalogComponentUrl = (id: string) =>
  `${CATALOG_BASE}/component/${id}`;
