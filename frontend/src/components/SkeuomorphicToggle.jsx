import React from 'react';
import './SkeuomorphicToggle.css';

/**
 * SkeuomorphicToggle
 * A tactile skeuomorphic toggle with a sliding on/off thumb that automatically
 * matches light and dark appearances, isolated without the surrounding card.
 *
 * @param {boolean} checked - Current toggle state (on/off)
 * @param {function} onChange - Callback fired when toggle changes: (checked, event) => void
 * @param {'sm' | 'md' | 'lg'} size - Toggle size variant (default: 'md')
 * @param {boolean} disabled - Whether toggle is disabled
 * @param {string | React.ReactNode} label - Optional label next to the toggle
 * @param {string | React.ReactNode} description - Optional helper description below label
 * @param {'auto' | 'light' | 'dark'} mode - Appearance mode override (default: 'auto')
 * @param {React.ReactNode} onIcon - Optional custom icon/glyph on the active side
 * @param {React.ReactNode} offIcon - Optional custom icon/glyph on the inactive side
 * @param {string} id - HTML id for the input
 * @param {string} name - Form field name
 * @param {string} ariaLabel - Accessible description
 */
export const SkeuomorphicToggle = ({
  checked = false,
  onChange,
  size = 'md',
  disabled = false,
  label,
  description,
  mode = 'auto',
  onIcon,
  offIcon,
  id,
  name,
  ariaLabel,
  className = '',
  style = {}
}) => {
  const generatedId = id || `skeuo-toggle-${Math.random().toString(36).slice(2, 9)}`;

  const handleToggle = (e) => {
    if (disabled) return;
    if (onChange) {
      const nextChecked = !checked;
      onChange(nextChecked, e);
    }
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleToggle(e);
    }
  };

  const modeClass = mode === 'dark' ? 'mode-dark' : mode === 'light' ? 'mode-light' : '';

  return (
    <div 
      className={`skeuo-toggle-wrapper skeuo-size-${size} ${modeClass} ${disabled ? 'disabled' : ''} ${className}`}
      style={style}
      onClick={handleToggle}
    >
      <input
        type="checkbox"
        id={generatedId}
        name={name}
        checked={Boolean(checked)}
        onChange={() => {}} // handled via wrapper onClick
        disabled={disabled}
        aria-label={ariaLabel || (typeof label === 'string' ? label : 'Toggle Switch')}
        role="switch"
        aria-checked={Boolean(checked)}
        className="skeuo-toggle-input"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
      />

      <div 
        className={`skeuo-toggle-track ${checked ? 'checked' : ''}`}
        aria-hidden="true"
      >
        <span className="skeuo-track-glyph skeuo-track-glyph-on">
          {onIcon || 'I'}
        </span>
        <span className="skeuo-track-glyph skeuo-track-glyph-off">
          {offIcon || 'O'}
        </span>

        <div className="skeuo-toggle-thumb">
          <div className="skeuo-thumb-led" />
          <div className="skeuo-thumb-grip">
            <span className="skeuo-thumb-grip-line" />
            <span className="skeuo-thumb-grip-line" />
            <span className="skeuo-thumb-grip-line" />
          </div>
        </div>
      </div>

      {(label || description) && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {label && (
            <label 
              htmlFor={generatedId} 
              style={{ 
                fontWeight: 600, 
                fontSize: size === 'sm' ? '0.85rem' : size === 'lg' ? '1.05rem' : '0.95rem',
                color: 'var(--text-primary)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                margin: 0,
                lineHeight: 1.3
              }}
            >
              {label}
            </label>
          )}
          {description && (
            <span 
              style={{ 
                fontSize: size === 'sm' ? '0.72rem' : '0.78rem', 
                color: 'var(--text-secondary)', 
                marginTop: '2px',
                lineHeight: 1.3
              }}
            >
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default SkeuomorphicToggle;

