import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer, CheckCircle, Clock, XCircle, FileText, RefreshCw, AlertCircle, Copy, ShieldCheck } from 'lucide-react';
import { RECEIPT_KEY, readTrackingToken, saveReceipt, receiptLink, forgetReceipt, findReceipt } from '../utils/customerOrders.mjs';
import LoadingSpinner from '../components/LoadingSpinner';
import { isArchiveOrder } from '../utils/dashboardOrders.mjs';
import '../customer.css';

const money = amount => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(amount || 0));
const statusInfo = {
  Pending: { icon: Clock, label: 'Waiting at the counter', text: 'Your files are in the queue. Show these order numbers to the staff.' },
  Printing: { icon: Printer, label: 'Being handled by the counter', text: 'Staff have started this job. They will confirm when printing is complete.' },
  Completed: { icon: CheckCircle, label: 'Ready to collect', text: 'The counter marked this file completed.' },
  Cancelled: { icon: XCircle, label: 'Cancelled', text: 'Ask the counter staff if you need help with this file.' },
};

export default function OrderStatus() {
  const { orderId } = useParams();
  const [access, setAccess] = useState(() => readTrackingToken(orderId, window.location.hash));
  const receivedAccess = useRef({ orderId, token: access });
  const [orders, setOrders] = useState([]), [shopName, setShopName] = useState('Print counter'), [shopId, setShopId] = useState('');
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [refresh, setRefresh] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null), [saved, setSaved] = useState(false), [copyState, setCopyState] = useState('');
  const [manualLink, setManualLink] = useState(false), [forgotten, setForgotten] = useState(false);

  useEffect(() => {
    const sync = event => {
      if (saved && (event.key === RECEIPT_KEY || event.key === null) && !findReceipt(orderId)) {
        setForgotten(true); setAccess(null); setOrders([]);
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [orderId, saved]);

  useEffect(() => {
    const recovered = readTrackingToken(orderId, window.location.hash) || (receivedAccess.current.orderId === orderId ? receivedAccess.current.token : null);
    receivedAccess.current = { orderId, token: recovered };
    setAccess(recovered);
    setOrders([]); setLoading(true); setError(''); setForgotten(false);
  }, [orderId]);

  useEffect(() => {
    let active = true, timer, controller;
    const poll = async () => {
      if (!access || forgotten) { if (active) setLoading(false); return; }
      if (document.visibilityState === 'hidden') { timer = setTimeout(poll, 5000); return; }
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch('/api/platform?action=customer_status&orderId=' + encodeURIComponent(orderId), { headers: { 'X-Order-Token': access }, signal: controller.signal, cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to refresh this order.');
        if (!active) return;
        const rows = result.orders || [result.order];
        setOrders(rows); setShopName(result.order.shop_name); setError(''); setLastUpdated(new Date());
        const previous = findReceipt(orderId);
        const businessId = result.shop?.id || previous?.shopId;
        setShopId(businessId || '');
        const persisted = businessId ? saveReceipt({ shopId: businessId, orderIds: rows.map(row => row.id), token: access }) : false;
        setSaved(persisted);
        // Remove the fragment only after saving a working recovery method. If
        // storage is blocked, the address remains usable after a reload.
        if (persisted && new URLSearchParams(window.location.hash.slice(1)).has('track')) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
      } catch (failure) { if (active) setError(failure.name === 'AbortError' ? 'Connection is taking longer than expected. We will retry.' : failure.message); }
      finally {
        clearTimeout(timeout);
        if (active) { setLoading(false); timer = setTimeout(poll, 5000); }
      }
    };
    poll();
    return () => { active = false; clearTimeout(timer); controller?.abort(); };
  }, [orderId, access, refresh, forgotten]);

  const link = access ? receiptLink(window.location.origin, orderId, access) : '';
  async function copyLink() {
    try { await navigator.clipboard.writeText(link); setCopyState('Copied. Keep this link private.'); setManualLink(false); }
    catch { setManualLink(true); setCopyState('Select and copy the private link below.'); }
  }
  function forget() {
    orders.forEach(order => forgetReceipt(order.id)); forgetReceipt(orderId);
    receivedAccess.current = { orderId, token: null };
    if (new URLSearchParams(window.location.hash.slice(1)).has('track')) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    setForgotten(true); setOrders([]); setAccess(null); setManualLink(false); setCopyState('');
  }

  if (loading) return <LoadingSpinner label="Opening your order receipt" />;
  if (!access || forgotten) return <main className="customer-shell"><section className="neo-card customer-empty"><ShieldCheck size={34} /><h1>Your private tracking link is needed</h1><p>{forgotten ? 'Tracking was removed from this device. Your print order has not been cancelled.' : 'Open the private link you saved after ordering, or reopen the business QR page in the browser you used.'}</p><p>Order numbers alone cannot reveal another customer’s status or documents. Ask the counter staff if you no longer have your link.</p><a className="neo-btn" href="/">About PrintWithQR</a></section></main>;
  if (!orders.length) return <main className="customer-shell"><section className="neo-card customer-empty"><AlertCircle size={34} /><h1>We couldn’t refresh your order</h1><p>{error || 'Check your connection and retry.'}</p><button className="neo-btn" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={18} />Try again</button></section></main>;

  const done = orders.every(order => ['Completed', 'Cancelled'].includes(order.status));
  const total = orders.reduce((sum, order) => sum + Math.round(Number(order.total_amount || 0) * 100), 0) / 100;
  const totalPages = orders.reduce((sum, order) => sum + Number(order.pages_to_print || 0), 0);
  const archiveCount = orders.filter(isArchiveOrder).length, onlyArchives = archiveCount === orders.length;
  return <main className="customer-shell receipt-shell">
    <header className="customer-header"><span className="customer-brand"><Printer size={23} />PrintWithQR</span><h1>{done ? 'Your order summary' : 'Your files are at the counter'}</h1><p>{orders.length} {orders.length === 1 ? 'file' : 'files'} submitted to <strong>{shopName}</strong>.</p></header>
    <section className="neo-card customer-card receipt-total"><div><span>{archiveCount ? 'ZIP price confirmed by the shop' : 'Total for all submitted files'}<br /><small>{orders.length} files{!onlyArchives && ` · ${totalPages} counted pages to print`}</small></span><strong>{onlyArchives ? 'At counter' : <>{money(total)}{archiveCount > 0 && <small> + ZIP price</small>}</>}</strong></div><p>Pay the business directly. The staff handle printing and collection.{archiveCount > 0 && ' ZIP pages and prices are confirmed with you at the counter.'}</p></section>
    {orders.map((order, index) => {
      const info = statusInfo[order.status] || statusInfo.Pending, Icon = info.icon;
      const archive = isArchiveOrder(order);
      return <section className="neo-card customer-card receipt-file" key={order.id}>
        <div className="receipt-file-heading"><FileText size={24} /><h2>{order.file_name || `File ${index + 1}`}</h2><strong>{archive ? 'Price at counter' : money(order.total_amount)}</strong></div>
        <p>{archive ? 'ZIP sent unchanged · download only · contents checked by the shop' : <>{order.pages_to_print} pages · {order.print_type === 'color' ? 'Colour' : 'B&W'} · {order.paper_size} · {order.duplex ? 'Double sided' : 'Single sided'}</>}</p>
        <div className={`receipt-status status-${String(order.status).toLowerCase()}`}><Icon size={20} /><strong>{archive && order.status === 'Completed' ? 'Handled by the counter' : info.label}</strong></div><p>{order.status === 'Cancelled' && order.print_options?.queueExpiredAt ? 'The counter did not handle this file within 10 minutes. The order expired and its stored document is scheduled for deletion. Scan the QR code to send it again if needed.' : archive && order.status === 'Completed' ? 'The shop marked this ZIP handled. Its stored copy expires after 10 minutes.' : info.text}</p>
        <div className="receipt-order-number"><span>Order number</span><code>{order.id}</code></div>
      </section>;
    })}
    <section className="neo-card customer-card tracking-card"><h2>Come back to this order</h2><p>{saved ? 'Tracking is saved in this browser for up to 7 days. You can close this tab and reopen the business QR page or this order address.' : 'This browser could not save tracking. Copy your private link before closing the tab.'}</p><button className="neo-btn" onClick={copyLink}><Copy size={18} />Copy private tracking link</button>{copyState && <p role="status">{copyState}</p>}{manualLink && <label className="customer-field">Private tracking link<input className="neo-input" readOnly value={link} onFocus={event => event.target.select()} /></label>}<p className="customer-footnote">This link shows your filenames, prices and statuses. It does not allow document downloads. Share it only with someone you trust.</p><button className="neo-btn" onClick={forget}>Remove tracking from this device</button></section>
    <div className="receipt-refresh"><span>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</span><button className="neo-btn" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={17} />Refresh status</button></div>
    {error && <div className="customer-notice" role="status"><AlertCircle size={20} /><p>{error} Your last confirmed status is shown above.</p></div>}
    {shopId && shopId !== 'tracking-only' && <a className="neo-btn new-print-order" href={'/shop/' + encodeURIComponent(shopId)}>Print more files at this counter</a>}
    <p className="customer-footnote">Waiting files expire 10 minutes after submission. Jobs already in Printing are preserved. Completed or manually cancelled documents expire 10 minutes later. This receipt can remain available after the files are deleted.</p>
  </main>;
}
