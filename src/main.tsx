// Dev harness only (not part of the configurator): registers the sample PDP as <pdp-page>
import r2wc from '@r2wc/react-to-web-component';
import PdpPage from './PdpPage';

if (!customElements.get('pdp-page')) customElements.define('pdp-page', r2wc(PdpPage));
