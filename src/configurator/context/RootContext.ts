import { createContext, useContext } from 'react';

/**
 * The component's root element inside its Shadow DOM (the `.wsc-configurator` div).
 * Floating UI (dropdowns) is portalled here — next to the modal, outside every scrolling panel —
 * so nothing inside the modal can clip or offset it.
 */
export const RootContext = createContext<HTMLElement | null>(null);

export const useRootEl = (): HTMLElement | null => useContext(RootContext);
