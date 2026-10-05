import { useEffect, useRef, useState } from 'react';
import { Printer, Download, CheckCircle, XCircle } from 'lucide-react';
import { FloatingDotsButton } from './RectangleButtons';
import { dashboardGroups, fetchGroupFiles, orderFiles } from '../utils/dashboardOrders.mjs';
import { platform } from '../utils/platform';
import { initialisePrintWindow, prepareImagePrint } from '../utils/imagePrint.mjs';
import { individualDownloads, triggerDownloads } from '../utils/imageDownloads.mjs';
import { waitingDeadline, waitingExpired } from '../../api/_lib/queue-clock.js';
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);

export default function PrintQueue({ orders, refresh, printPdf, savePdf }) {
  const [now, setNow] = useState(Date.now);
  const groups = dashboardGroups(orders.filter(order => !waitingExpired(order, now)));
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const downloads = useRef(null), downloadTimer = useRef(null);
  const lock = useRef(false), abort = useRef(null), popup = useRef(null), releases = useRef(new Set()), alive = useRef(true);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    alive.current = true;
    const cleanups = releases.current;
    return () => { alive.current = false; abort.current?.abort(); popup.current?.close(); clearTimeout(downloadTimer.current); downloads.current?.cleanup(); cleanups.forEach(release => release()); cleanups.clear(); };
  }, []);
  const show = message => { if (alive.current) setNotice(message); };
  const updateGroup = async (group, status) => {
    const results = await Promise.allSettled(group.groupOrders.filter(order => order.status !== status).map(order => platform('status', { orderId: order.id, status })));
    await refresh();
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw new Error(failure.reason.message || 'Some jobs changed. Refresh and retry.');
  };
  const download = files => {
    clearTimeout(downloadTimer.current); downloads.current?.cleanup();
    const prepared = individualDownloads(files); downloads.current = prepared;
    downloadTimer.current = setTimeout(() => { prepared.cleanup(); downloads.current = null; }, 60000);
    triggerDownloads(prepared.links);
  };
  async function status(group, value) {
    if (lock.current) return;
    lock.current = true; setBusy(true); show('Updating selected jobs…');
    try { await updateGroup(group, value); show('Group updated.'); }
    catch (error) { show(error.message); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function action(group, operation) {
    if (lock.current) return;
    if (group.isArchive && operation !== 'download') return;
    let win;
    // Preserve the user gesture: opening after a signed-URL fetch gets blocked.
    if (operation === 'print' && group.isImageGroup) {
      win = window.open('', '_blank', 'width=950,height=1000');
      if (!win) { show('Allow pop-ups for PrintWithQR, then click Print again.'); return; }
      popup.current?.close(); popup.current = win;
      initialisePrintWindow(win);
    }
    lock.current = true; setBusy(true); show('Preparing your files…');
    const controller = new AbortController(); abort.current = controller;
    const started = performance.now();
    let release, watch, statusAttempted = false;
    try {
      if (!group.isImageGroup) {
        statusAttempted = operation === 'print';
        if (operation === 'print') await printPdf(group.groupOrders[0]); else await savePdf(group.groupOrders[0]);
        show(''); return;
      }
      if (win) {
        watch = setInterval(() => { if (win.closed) controller.abort(); }, 500);
      }
      const files = await fetchGroupFiles(group.files, {
        projectUrl: import.meta.env.VITE_SUPABASE_URL, signal: controller.signal, onProgress: show,
        getFileUrls: async (files, signal) => {
          statusAttempted = operation === 'print';
          const result = await platform('file_urls', { files, startPrinting: operation === 'print' }, true, 'POST', { signal });
          if (operation === 'print' && result.printingStarted !== true) throw new Error('Printing could not be authorized. Refresh and retry.');
          return result.files;
        }
      });
      if (operation === 'download') {
        controller.signal.throwIfAborted(); download(files);
        show(files.length === 1 ? 'Download requested.' : 'Requested ' + files.length + ' individual image downloads. If prompted, allow multiple downloads.');
      } else {
        show('Rendering all ' + files.length + ' images…');
        release = await prepareImagePrint(win, files, { signal: controller.signal });
        controller.signal.throwIfAborted();
        controller.signal.throwIfAborted(); if (win.closed) throw new Error('The print window was closed. Retry printing.');
        // All images have decoded before this point. Never force-print an
        // incomplete job and never mark physical printing automatically done.
        const releaseImages = release;
        const cleanup = () => { releaseImages(); clearInterval(watch); releases.current.delete(cleanup); };
        releases.current.add(cleanup); release = cleanup;
        win.onafterprint = () => { cleanup(); win.close(); };
        clearInterval(watch);
        watch = setInterval(() => { if (win.closed) cleanup(); }, 500);
        const seconds = ((performance.now() - started) / 1000).toFixed(1);
        win.focus(); win.print(); release = null;
        show('Prepared ' + files.length + ' images in ' + seconds + ' seconds. Mark Done only after all printouts are finished.');
      }
    } catch (error) {
      release?.(); if (win) win.close(); clearInterval(watch);
      const message = error.name === 'AbortError' ? 'Preparation cancelled. Nothing was sent to the printer.' : error.message || 'Could not prepare every image. Refresh and retry.';
      show(message + (statusAttempted ? ' Jobs may remain in Printing; retry the group or cancel it.' : ''));
    } finally {
      // Keep the queue fresh without delaying the native print dialog.
      if (statusAttempted && alive.current) Promise.resolve().then(refresh).catch(() => show('Queue refresh failed. Refresh the dashboard to see the latest status.'));
      if (operation !== 'print' || win?.closed) clearInterval(watch);
      abort.current = null; lock.current = false; if (alive.current) setBusy(false);
    }
  }
  return <>
    <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Waiting files expire after 10 minutes. Start Print to keep a job active. For ZIPs, mark Done once handled. Downloading does not stop the timer.</p>
    {notice && <div className="neo-card-inset" role="status" aria-live="polite" style={{ padding: '14px', marginBottom: '18px' }}><p>{notice}</p>{busy && abort.current && <button className="neo-btn" onClick={() => abort.current?.abort()}>Cancel preparation</button>}</div>}
    {!groups.length ? <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>No active print jobs in queue.</div> : <div className="neo-table-wrapper"><table className="neo-table">
      <thead><tr><th>Order ID</th><th>Details</th><th>Pricing</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>{groups.map(group => <tr key={group.id}>
        <td style={{ fontWeight: 600, maxWidth: '210px', overflowWrap: 'anywhere' }}>
          {group.groupOrders.length > 1 && <strong style={{ display: 'block', color: 'var(--accent)' }}>Image group</strong>}
          <code>{group.id}</code>{group.groupOrders.length > 1 && <small style={{ display: 'block' }}>{group.groupOrders.length} orders · one submission</small>}
        </td>
        <td>
          <details><summary style={{ cursor: 'pointer', fontWeight: 600 }}>{group.files.length} {group.isImageGroup ? group.files.length === 1 ? 'image' : 'images' : 'document'} · {group.files[0]?.name || 'Document'}</summary><ul style={{ paddingLeft: '20px', marginTop: '10px', maxWidth: '280px', overflowWrap: 'anywhere' }}>{group.files.map(file => <li key={file.orderId + ':' + file.index}>{file.name}</li>)}</ul></details>
          <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>{group.isArchive ? 'ZIP · download unchanged. Confirm contents and price with the customer.' : <>{group.pages_to_print} pages · {group.print_type === 'color' ? 'Colour' : 'B&W'} · {group.paper_size || 'A4'} · {group.duplex ? 'Double sided' : 'Single sided'}</>}
            {!group.isImageGroup && !group.isArchive && Number.isInteger(group.print_options?.documentPages) && <span style={{ display: 'block' }}>PDF · {group.print_options.documentPages} total pages · {group.pages_to_print} to print</span>}
            {group.isImageGroup && group.files.length > 1 && <span style={{ display: 'block' }}>One image per page · one print dialog · individual image downloads</span>}
            {!group.isImageGroup && !group.isArchive && group.print_options?.rangeType && <span style={{ display: 'block' }}>Print range: {group.print_options.rangeType === 'custom' ? group.print_options.rangeCustom : group.print_options.rangeType}. Confirm the range in your printer dialog.</span>}
          </div>
        </td>
        <td style={{ fontWeight: 600 }}>{group.isArchive ? 'Price confirmed at counter' : group.groupOrders.length > 1 ? group.groupOrders.map(order => <div key={order.id} style={{ marginBottom: '8px' }}><small style={{ display: 'block', color: 'var(--text-secondary)', maxWidth: '180px', overflowWrap: 'anywhere' }}>{orderFiles(order)[0]?.name} · {order.pages_to_print} {order.pages_to_print === 1 ? 'page' : 'pages'}</small>{money(order.total_amount)}</div>) : money(group.total_amount)}</td>
        <td><span className={'neo-badge status-' + group.status.toLowerCase()}>{group.statusLabel}</span>{(() => {
          const deadlines = group.groupOrders.map(waitingDeadline).filter(deadline => deadline !== null);
          if (!deadlines.length) return <small style={{ display: 'block', marginTop: '8px', color: 'var(--text-secondary)' }}>Timer stopped · printing started</small>;
          const seconds = Math.max(0, Math.ceil((Math.min(...deadlines) - now) / 1000));
          return <div role="timer" aria-label="Time remaining before waiting files expire" style={{ marginTop: '8px', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: seconds <= 60 ? 'var(--danger-color)' : 'var(--text-secondary)' }}>{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}<small style={{ display: 'block', fontWeight: 400 }}>until waiting files expire</small></div>;
        })()}</td>
        <td><div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <button className="neo-btn" disabled={busy} onClick={() => action(group, 'download')} title={group.isImageGroup && group.files.length > 1 ? 'Download every original image separately' : 'Download original file'}><Download size={15} />{group.isImageGroup && group.files.length > 1 ? 'Download all images' : 'Download'}</button>
          {!group.isArchive && <>
          <FloatingDotsButton className="dashboard-print-button" disabled={busy} onClick={() => action(group, 'print')} title={group.isImageGroup ? 'Prepare every image before opening one print dialog' : 'Open PDF print preview'} icon={<Printer size={15} />}>{group.isImageGroup ? group.files.length > 1 ? 'Print all ' + group.files.length + ' images' : 'Print image' : 'Print PDF'}</FloatingDotsButton>
          </>}
          {(group.status === 'Printing' || (group.isArchive && group.status === 'Pending')) && <button className="neo-btn neo-btn-success" disabled={busy} onClick={() => status(group, 'Completed')} title={group.isArchive ? 'Finish handling this ZIP and start its 10-minute deletion countdown' : 'Mark completed only after all printouts are finished'}><CheckCircle size={15} />{group.groupOrders.length > 1 ? 'Done — all images' : 'Done'}</button>}
          <button className="neo-btn neo-btn-danger" disabled={busy} onClick={() => status(group, 'Cancelled')} aria-label={group.groupOrders.length > 1 ? 'Cancel this image group' : 'Cancel this order'} title="Cancel the selected group"><XCircle size={16} /></button>
        </div></td>
      </tr>)}</tbody>
    </table></div>}
  </>;
}
