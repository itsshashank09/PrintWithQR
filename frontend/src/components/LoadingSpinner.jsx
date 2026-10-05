export default function LoadingSpinner({ label = 'Loading', className = '' }) {
  return (
    <div className={`app-loading ${className}`} role="status" aria-label={label}>
      <span className="app-loading__spinner" aria-hidden="true" />
    </div>
  );
}
