export default function UploadProgress({ phase, percent, index, uploaded, total, sending, onPause }) {
  if (phase === 'idle') return null;
  return <section className="upload-progress neo-card" aria-label="File upload progress">
    <div role="status" aria-live="polite" aria-atomic="true">
      <strong>Uploaded: {uploaded} of {total} files</strong>
      <p>{phase === 'submitting' ? 'All files uploaded. Confirming your order…' : phase === 'failed' ? 'Submission paused. Retry to continue.' : phase === 'verifying' ? `Confirming upload of file ${index} of ${total}…` : `${phase === 'preparing' ? 'Preparing' : 'Uploading'} file ${index} of ${total}`}</p>
    </div>
    <progress max="100" value={phase === 'submitting' ? 100 : percent} aria-label={phase === 'submitting' ? 'Files uploaded; confirming order' : 'Overall file upload'} />
    <small>{phase === 'submitting' ? 'Checking files, prices and document pages.' : phase === 'verifying' ? 'File data sent. Waiting for storage confirmation.' : `${percent}% of file data uploaded`}</small>
    <button className="neo-btn" disabled={!sending || phase === 'submitting'} onClick={onPause}>{phase === 'submitting' ? 'Confirming order…' : sending ? 'Pause upload' : 'Upload paused'}</button>
  </section>;
}
