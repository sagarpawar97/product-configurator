import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { DEFAULTS } from './config/api';
import ConfiguratorModal from './components/ConfiguratorModal';
import { RootContext } from './context/RootContext';
import type { ConfiguratorProps } from './types';
// All styles, compiled from styles/index.scss and injected into this component's Shadow DOM
import styles from './styles/index.scss?inline';

/**
 * WebShop Configurator
 *
 *   const [showConfigurator, setShowConfigurator] = useState(false);
 *
 *   <button onClick={() => setShowConfigurator(true)}>Configure</button>
 *   <Configurator open={showConfigurator} onClose={() => setShowConfigurator(false)} />
 *
 * Styles are isolated: the component renders into its own Shadow DOM, so the page's CSS
 * can't change it and its CSS can't change the page. The Shadow DOM host is attached to
 * <body> (not inside the PDP markup), so a transform / overflow / z-index on any PDP
 * container can't clip the modal or push it under the site header.
 */
export default function Configurator({
  open = false,
  onClose = () => {},
  itemId = DEFAULTS.item,
  branch = DEFAULTS.branch,
  onAddToCart = () => {},
}: ConfiguratorProps) {
  const [rootEl, setRootEl] = useState<HTMLElement | null>(null);

  // Create the host + Shadow DOM once: <body> › div.wsc-host › #shadow › <style> + .wsc-configurator
  useLayoutEffect(() => {
    const host = document.createElement('div');
    host.className = 'wsc-host';
    host.setAttribute('data-webshop-configurator', '');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = styles;
    const root = document.createElement('div');
    root.className = 'wsc-configurator';
    shadow.append(style, root);
    document.body.appendChild(host);
    setRootEl(root);
    return () => {
      host.remove();
      setRootEl(null);
    };
  }, []);

  return (
    <>
      {rootEl &&
        createPortal(
          <RootContext.Provider value={rootEl}>
            <ConfiguratorModal
              open={open}
              item={String(itemId || DEFAULTS.item)}
              branch={String(branch || DEFAULTS.branch)}
              onClose={onClose}
              onAddToCart={(line) => {
                onAddToCart(line);
                onClose();
              }}
            />
          </RootContext.Provider>,
          rootEl,
        )}
    </>
  );
}
