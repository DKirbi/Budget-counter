/**
 * React context for the device services the scan flow needs (OCR, camera/photos, photo storage, secure
 * storage, `fetch`). The app injects the real implementations; Jest and Storybook inject fakes.
 * @module lib/services
 */
import type { ScanServices } from '@tbc/core';
import * as React from 'react';

const ServicesContext = React.createContext<ScanServices | null>(null);

/** Props for {@link ScanServicesProvider}. */
export interface ScanServicesProviderProps {
  services: ScanServices;
  children: React.ReactNode;
}

/**
 * Make scan services available to the Bills, Scan and Review screens.
 * @example
 * <ScanServicesProvider services={nativeScanServices}><App /></ScanServicesProvider>
 */
export function ScanServicesProvider({ services, children }: ScanServicesProviderProps) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

/**
 * The injected scan services.
 * @throws When used outside {@link ScanServicesProvider} — a missing provider is a wiring bug, not a runtime state.
 */
export function useScanServices(): ScanServices {
  const services = React.useContext(ServicesContext);
  if (!services) throw new Error('useScanServices must be used inside <ScanServicesProvider>');
  return services;
}
