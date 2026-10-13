import { useState } from 'react';
import Configurator from './configurator';
import { DEFAULTS } from './configurator/config/api';

export default function PdpPage() {
  const [showConfigurator, setShowConfigurator] = useState(false);
  const [item, setItem] = useState<string>(DEFAULTS.item);
  const [branch, setBranch] = useState<string>(DEFAULTS.branch);

  const styles = {
    container: {
      maxWidth: '960px',
      margin: '32px auto',
      padding: '24px',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      backgroundColor: '#ffffff',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      boxSizing: 'border-box' as const,
    },
    heading: {
      margin: '0 0 6px',
      fontSize: '22px',
      fontWeight: 600,
      color: '#111827',
    },
    description: {
      margin: '0 0 24px',
      fontSize: '14px',
      color: '#6b7280',
      lineHeight: 1.5,
    },
    form: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: '16px',
      marginBottom: '20px',
    },
    field: {
      flex: '1 1 240px',
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '7px',
    },
    label: {
      fontSize: '13px',
      fontWeight: 600,
      color: '#374151',
    },
    input: {
      width: '100%',
      boxSizing: 'border-box' as const,
      padding: '11px 12px',
      border: '1px solid #d1d5db',
      borderRadius: '7px',
      backgroundColor: '#ffffff',
      color: '#111827',
      fontSize: '14px',
      outline: 'none',
    },
    button: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: '11px 22px',
      border: 'none',
      borderRadius: '7px',
      backgroundColor: '#2563eb',
      color: '#ffffff',
      fontSize: '14px',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'background-color 0.2s ease',
    },
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Product Configurator</h2>
      <p style={styles.description}>
        Enter the item ID and brand to configure your product.
      </p>

      <div style={styles.form}>
        <div style={styles.field}>
          <label htmlFor="item-id" style={styles.label}>
            Item ID
          </label>
          <input
            id="item-id"
            type="text"
            value={item}
            placeholder="Enter item ID"
            onChange={(e) => setItem(e.target.value)}
            style={styles.input}
          />
        </div>

        <div style={styles.field}>
          <label htmlFor="brand" style={styles.label}>
            Brand
          </label>
          <input
            id="brand"
            type="text"
            value={branch}
            placeholder="Enter brand"
            onChange={(e) => setBranch(e.target.value)}
            style={styles.input}
          />
        </div>
      </div>

      <button
        id="configure-btn"
        type="button"
        onClick={() => setShowConfigurator(true)}
        style={styles.button}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#1d4ed8';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#2563eb';
        }}
      >
        Configure Product
        <span aria-hidden="true">→</span>
      </button>

      <Configurator
        itemId={item}
        branch={branch}
        open={showConfigurator}
        onClose={() => setShowConfigurator(false)}
      />
    </div>
  );
}
