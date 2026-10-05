import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Upload, Printer, FileText, AlertCircle, ChevronLeft, ChevronRight, CheckCircle, X, RefreshCw, ShieldCheck } from 'lucide-react';
import { platform } from '../utils/platform';
import { readReceipts, receiptLink, saveReceipt, newOrderToken } from '../utils/customerOrders.mjs';
import { countPdfPages, estimateFiles, uploadWithProgress, uploadQueueProgress } from '../utils/upload.mjs';
import { FloatingDotsButton } from '../components/RectangleButtons';
import { SkeuomorphicToggle } from '../components/SkeuomorphicToggle';
import LoadingSpinner from '../components/LoadingSpinner';
import UploadProgress from '../components/UploadProgress';
import UploadFileDetails from '../components/UploadFileDetails';
import '../customer.css';

let pdfjsPromise;
function loadPreviewLibrary() {
  if (!pdfjsPromise) pdfjsPromise = new Promise(resolve => {
    if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
    const script = document.createElement('script');
    const timer = setTimeout(() => resolve(null), 8000);
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => { clearTimeout(timer); resolve(window.pdfjsLib || null); };
    script.onerror = () => { clearTimeout(timer); resolve(null); };
    document.head.appendChild(script);
  });
  return pdfjsPromise;
}
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);

export default function UploadPage() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const [shop, setShop] = useState(null), [shopError, setShopError] = useState(''), [shopLoading, setShopLoading] = useState(true);
  const [reload, setReload] = useState(0), [files, setFiles] = useState([]), [notice, setNotice] = useState('');
  const [reading, setReading] = useState(''), [step, setStep] = useState(1), [dragging, setDragging] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0), [previewPage, setPreviewPage] = useState(1), [previewState, setPreviewState] = useState('loading');
  const [printType, setPrintType] = useState('bw'), [paperSize, setPaperSize] = useState('A4'), [duplex, setDuplex] = useState(false);
  const [rangeType, setRangeType] = useState('all'), [rangeCustom, setRangeCustom] = useState('');
  const [sending, setSending] = useState(false), [sendError, setSendError] = useState(''), [locked, setLocked] = useState(false);
  const [progress, setProgress] = useState({ phase: 'idle', percent: 0, index: 0, name: '' });
  const [recent, setRecent] = useState(() => readReceipts().filter(row => row.shopId === shopId));
  const inputRef = useRef(null), canvasRef = useRef(null), filesRef = useRef(files), busyRef = useRef(false), readingRef = useRef(false);
  const abortRef = useRef(null), submissionRef = useRef(null), customerTokenRef = useRef(null), mounted = useRef(true);
  const progressRef = useRef(null);
  const showUploadProgress = step === 3 && progress.phase !== 'idle';
  filesRef.current = files;
  const current = files[activeIndex];

  useEffect(() => {
    let active = true;
    setShopLoading(true); setShopError('');
    platform('public_shop', { shopId }, false, 'GET').then(({ shop: value }) => {
      if (!active) return;
      const paid = value.is_paid === 1 && value.subscription_status === 'active' && (!value.subscription_expires_at || Date.parse(value.subscription_expires_at) > Date.now());
      const trial = value.subscription_status === 'free' && Number(value.free_prints_used || 0) < Number(value.free_prints_allowed ?? 10);
      if (!paid && !trial) { setShopError('This business is not accepting new orders right now. Please ask the counter staff.'); return; }
      setShop(value);
    }).catch(error => { if (active) setShopError(error.message); }).finally(() => { if (active) setShopLoading(false); });
    setRecent(readReceipts().filter(row => row.shopId === shopId));
    return () => { active = false; };
  }, [shopId, reload]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; abortRef.current?.abort(); filesRef.current.forEach(item => URL.revokeObjectURL(item.url)); };
  }, []);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); }, [step]);
  useEffect(() => {
    if (sending && showUploadProgress) progressRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [sending, showUploadProgress]);

  // Cancel stale renders before changing the active page or file.
  useEffect(() => {
    if (step !== 2 || !current || current.type !== 'pdf') return;
    let stopped = false, renderTask, pdfDocument;
    setPreviewState('loading');
    (async () => {
      try {
        const lib = await loadPreviewLibrary();
        if (!lib || stopped) { if (!stopped) setPreviewState('unavailable'); return; }
        lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        pdfDocument = await lib.getDocument({ data: await current.file.arrayBuffer() }).promise;
        if (stopped) { await pdfDocument.destroy(); return; }
        const page = await pdfDocument.getPage(previewPage);
        if (stopped || !canvasRef.current) return;
        const canvas = canvasRef.current, viewport = page.getViewport({ scale: 1 });
        const view = page.getViewport({ scale: Math.min(420 / viewport.width, 500 / viewport.height) });
        canvas.width = view.width; canvas.height = view.height;
        renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport: view });
        await renderTask.promise;
        if (!stopped) setPreviewState('ready');
      } catch { if (!stopped) setPreviewState('unavailable'); }
    })();
    return () => { stopped = true; renderTask?.cancel(); pdfDocument?.destroy().catch(() => {}); };
  }, [step, current, previewPage]);

  async function chooseFiles(list) {
    if (readingRef.current || busyRef.current || locked || !list?.length) return;
    readingRef.current = true; setNotice(''); setSendError('');
    const entries = [], problems = [], available = Math.max(0, 10 - filesRef.current.length);
    if (list.length > available) problems.push('Choose up to 10 files per order. Extra files were not added.');
    try {
      for (const file of Array.from(list).slice(0, available)) {
        setReading(`Reading ${file.name}…`);
        try {
          if (file.size < 1 || file.size > 50 * 1024 * 1024) throw new Error('Choose a non-empty file smaller than 50 MB.');
          const extension = file.name.split('.').pop().toLowerCase();
          if (!['pdf', 'png', 'jpg', 'jpeg', 'zip'].includes(extension)) throw new Error('Use a PDF, PNG, JPEG or ZIP file.');
          if (file.name.length > 150) throw new Error('Shorten the filename to fewer than 151 characters.');
          const type = extension === 'pdf' ? 'pdf' : extension === 'zip' ? 'zip' : 'image';
          let pages = type === 'zip' ? null : 1;
          if (type === 'pdf') {
            try { pages = await countPdfPages(await file.arrayBuffer()); }
            catch { throw new Error('This PDF is damaged or locked. Save an unlocked PDF and try again.'); }
          }
          if (!mounted.current) return;
          // Keep originals: silent image compression can reduce print quality.
          const original = type === 'zip' ? new File([file], file.name, { type: 'application/zip', lastModified: file.lastModified }) : file;
          entries.push({ id: crypto.randomUUID(), file: original, type, pages, url: URL.createObjectURL(original), mime: extension === 'pdf' ? 'application/pdf' : extension === 'png' ? 'image/png' : extension === 'zip' ? 'application/zip' : 'image/jpeg' });
        } catch (error) { problems.push(`${file.name}: ${error.message}`); }
      }
      if (mounted.current) { setFiles(previous => [...previous, ...entries]); setNotice(problems.join(' ')); }
    } finally {
      readingRef.current = false;
      if (mounted.current) setReading('');
      else entries.forEach(entry => URL.revokeObjectURL(entry.url));
    }
  }
  function removeFile(id) {
    if (sending || locked || readingRef.current) return;
    const removed = files.find(item => item.id === id); if (removed) URL.revokeObjectURL(removed.url);
    setFiles(previous => previous.filter(item => item.id !== id)); setActiveIndex(0); setPreviewPage(1); setSendError('');
  }
  const rate = Number(printType === 'color' ? shop?.color_rate ?? 10 : shop?.bw_rate ?? 5);
  const { estimates, rangeError, totalPages, totalAmount } = useMemo(() => estimateFiles(files, { rangeType, rangeCustom, rate }), [files, rangeType, rangeCustom, rate]);
  const hasArchives = files.some(entry => entry.type === 'zip');
  const onlyArchives = files.length > 0 && files.every(entry => entry.type === 'zip');

  async function placeOrder() {
    if (busyRef.current || reading || !files.length || (rangeError && !submissionRef.current)) return;
    busyRef.current = true; setSending(true); setSendError('');
    const controller = new AbortController(); abortRef.current = controller;
    try {
      if (!submissionRef.current) {
        const queueProgress = uploadQueueProgress(files), orders = [];
        for (let index = 0; index < files.length; index++) {
          const entry = files[index];
          if (!entry.uploadIntent) {
            setProgress({ phase: 'preparing', percent: queueProgress.percent, index: index + 1, name: entry.file.name });
            if (controller.signal.aborted) throw new Error('Upload paused. Retry when you are ready.');
            const intent = await platform('upload_intent', { shopId, name: entry.file.name, mime: entry.mime, size: entry.file.size }, false, 'POST', { signal: controller.signal });
            await uploadWithProgress({ url: intent.uploadUrl, projectUrl: import.meta.env.VITE_SUPABASE_URL, file: entry.file, signal: controller.signal, onProgress: percent => {
              const value = queueProgress.update(entry, percent), phase = percent === 100 ? 'verifying' : 'uploading';
              if (mounted.current) setProgress(previous => previous.phase === phase && previous.percent === value && previous.index === index + 1 ? previous : { phase, percent: value, index: index + 1, name: entry.file.name });
            } });
            entry.uploadIntent = intent;
          }
          if (mounted.current) setProgress({ phase: 'uploading', percent: queueProgress.confirm(entry), index: index + 1, name: '' });
          orders.push({ intentId: entry.uploadIntent.intentId, intentToken: entry.uploadIntent.intentToken, ...(entry.type === 'zip' ? {} : { print_type: printType, paper_size: paperSize, duplex: duplex ? 1 : 0, rangeType, rangeCustom }) });
        }
        if (!customerTokenRef.current) customerTokenRef.current = newOrderToken();
        submissionRef.current = { shopId, orders, customerToken: customerTokenRef.current };
        setLocked(true);
      }
      // Replay the exact body after a lost response; the server is idempotent.
      setProgress({ phase: 'submitting', percent: 100, index: files.length, name: '' });
      const confirmationTimeout = setTimeout(() => controller.abort(), 45000);
      let response, result;
      try {
        response = await fetch('/api/create-print-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submissionRef.current), signal: controller.signal });
        result = await response.json();
      } finally { clearTimeout(confirmationTimeout); }
      if (!response.ok) {
        // A server failure can arrive after a successful commit. Keep the exact
        // checkout capability and settings until its confirmation is recovered.
        if (response.status < 500) { submissionRef.current = null; setLocked(false); }
        if (response.status === 410) files.forEach(entry => { delete entry.uploadIntent; });
        throw new Error(result.error || 'The order was not accepted. Review your settings and retry.');
      }
      if (!Array.isArray(result.orderIds) || !result.orderIds.length) throw new Error('Confirmation could not be read. Retry to recover the same order.');
      const token = customerTokenRef.current;
      saveReceipt({ shopId, orderIds: result.orderIds, token });
      if (!mounted.current) return;
      const link = new URL(receiptLink(window.location.origin, result.orderIds[0], token));
      navigate(link.pathname + link.hash, { replace: true });
    } catch (error) {
      if (mounted.current) { setSendError(error.name === 'AbortError' && submissionRef.current ? 'Confirmation took too long. Retry to recover the same order.' : error.message || 'Connection lost. Retry with the same files.'); setProgress(previous => ({ ...previous, phase: 'failed' })); }
    } finally { busyRef.current = false; if (mounted.current) setSending(false); }
  }

  if (shopLoading) return <LoadingSpinner label="Opening business upload" />;
  if (shopError || !shop) return <main className="customer-shell"><section className="neo-card customer-empty"><AlertCircle size={32} /><h1>Unable to open this counter</h1><p>{shopError || 'Please scan the business QR again.'}</p><button className="neo-btn" onClick={() => setReload(value => value + 1)}>Try again</button>{recent[0] && <a className="neo-btn" href={receiptLink(window.location.origin, recent[0].orderIds[0], recent[0].token)}>Track your recent order</a>}</section></main>;

  return <main className="customer-shell">
    <header className="customer-header"><span className="customer-brand"><Printer size={23} /> PrintWithQR</span><h1>{shop.name}</h1>{shop.address && shop.address !== 'Not Provided' && <p>{shop.address}</p>}<p>Choose your documents. This counter will print them for you.</p></header>
    {recent[0] && <a className="recent-order neo-card-inset" href={receiptLink(window.location.origin, recent[0].orderIds[0], recent[0].token)}><CheckCircle size={18} />Track your recent order <ChevronRight size={18} /></a>}
    <ol className="customer-steps" aria-label="Order progress">{['Choose files', 'Preview', onlyArchives ? 'Review & send' : 'Print options'].map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined} className={step === index + 1 ? 'active' : ''}><span>{index + 1}</span>{label}</li>)}</ol>
    {showUploadProgress && <div ref={progressRef} className="customer-upload-progress"><UploadProgress phase={progress.phase} percent={progress.percent} index={progress.index} uploaded={files.filter(file => file.uploadIntent).length} total={files.length} sending={sending} onPause={() => abortRef.current?.abort()} /></div>}
    <section className="neo-card customer-card" aria-busy={sending || Boolean(reading)}>
      {step === 1 && <>
        <h2>What would you like to print?</h2><p>Tap the blue button to choose files from your phone.</p>
        <div className={`customer-picker ${dragging ? 'dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); chooseFiles(event.dataTransfer.files); }}>
          <Upload size={38} aria-hidden="true" />
          <FloatingDotsButton className="choose-files-button" onClick={() => inputRef.current?.click()} disabled={Boolean(reading) || sending || locked || files.length >= 10} icon={<Upload size={20} />}>{files.length ? 'Add more files' : 'Choose files from phone'}</FloatingDotsButton>
          <input ref={inputRef} type="file" className="visually-hidden" aria-label="Select PDF, image or ZIP files" accept=".pdf,.png,.jpg,.jpeg,.zip" multiple disabled={Boolean(reading) || sending || locked} onChange={event => { chooseFiles(event.target.files); event.target.value = ''; }} />
          <p>PDF, JPG, PNG or ZIP · 50 MB per file · up to 10 files</p><small>ZIPs go to the shop unchanged. Staff confirm their pages and price. In the picker, open Files, Browse or Downloads. On a computer you can also drag files here.</small>
        </div>
        {reading && <p role="status" className="customer-inline-status"><RefreshCw size={18} className="spin" />{reading}</p>}
        {notice && <div role="alert" className="customer-notice"><AlertCircle size={19} /><p>{notice}</p></div>}
        {!!files.length && <div className="selected-files"><h3>{files.length} {files.length === 1 ? 'file' : 'files'} selected</h3>{files.map(entry => <div className="selected-file neo-card-inset" key={entry.id}><FileText size={21} /><div><strong>{entry.file.name}</strong><small>{entry.type === 'zip' ? 'ZIP · price confirmed by the shop' : `${entry.pages} ${entry.pages === 1 ? 'page' : 'pages'}`} · {(entry.file.size / 1048576).toFixed(1)} MB</small></div><button className="neo-btn icon-button" aria-label={`Remove ${entry.file.name}`} disabled={locked || sending || Boolean(reading)} onClick={() => removeFile(entry.id)}><X size={18} /></button></div>)}</div>}
      </>}
      {step === 2 && current && <>
        <h2>Check your documents</h2><p>Swipe through the file buttons to review each document.</p>
        <div className="customer-file-tabs" aria-label="Selected documents">{files.map((entry, index) => <button key={entry.id} className={`neo-btn ${activeIndex === index ? 'neo-btn-primary' : ''}`} aria-pressed={activeIndex === index} onClick={() => { setActiveIndex(index); setPreviewPage(1); }}>{index + 1}. {entry.file.name}</button>)}</div>
        <div className="customer-preview">{current.type === 'zip' ? <div><FileText size={38} /><h3>ZIP ready for the counter</h3><p>The ZIP will be sent unchanged. Staff download it, check the contents and confirm the price with you.</p></div> : current.type === 'image' ? <img src={current.url} alt={`Document preview: ${current.file.name}`} /> : <><canvas ref={canvasRef} hidden={previewState !== 'ready'} aria-label={`Preview of page ${previewPage}`} />{previewState === 'loading' && <p role="status">Preparing preview…</p>}{previewState === 'unavailable' && <p>Preview is unavailable here. Your original document can still be submitted.</p>}</>}</div>
        {current.type !== 'zip' && <>
        <div className="preview-controls"><button className="neo-btn icon-button" aria-label="Previous page" disabled={previewPage <= 1 || previewState === 'loading'} onClick={() => setPreviewPage(value => value - 1)}><ChevronLeft size={20} /></button><span>Page {previewPage} of {current.pages}</span><button className="neo-btn icon-button" aria-label="Next page" disabled={previewPage >= current.pages || previewState === 'loading'} onClick={() => setPreviewPage(value => value + 1)}><ChevronRight size={20} /></button></div>
        <a className="neo-btn preview-original" href={current.url} target="_blank" rel="noopener noreferrer">Open original preview</a>
        </>}
      </>}
      {step === 3 && <>
        <h2>{onlyArchives ? 'Review & send' : 'Print options & total'}</h2><p>{onlyArchives ? 'The shop downloads your ZIP unchanged. Confirm its contents and price at the counter.' : 'Print settings apply to PDFs and images. Pay the counter directly.'}</p>
        {hasArchives && !onlyArchives && <p>ZIP files are download-only and have no print settings. Their price is confirmed separately at the counter.</p>}
        {!onlyArchives && <>
        <fieldset disabled={sending || locked} className="customer-options"><legend className="visually-hidden">Print settings for all files</legend>
          <div><span className="neo-label">Printing</span><div className="customer-choice-row"><button type="button" className={`neo-btn ${printType === 'bw' ? 'neo-btn-primary' : ''}`} aria-pressed={printType === 'bw'} onClick={() => setPrintType('bw')}>B&amp;W · {money(shop.bw_rate)}/page</button><button type="button" className={`neo-btn ${printType === 'color' ? 'neo-btn-primary' : ''}`} aria-pressed={printType === 'color'} disabled={shop.color_enabled === 0} onClick={() => setPrintType('color')}>{shop.color_enabled === 0 ? 'Colour unavailable' : `Colour · ${money(shop.color_rate)}/page`}</button></div></div>
          <label className="customer-field">Pages<select className="neo-select" value={rangeType} onChange={event => setRangeType(event.target.value)}><option value="all">All pages</option><option value="odd">Odd pages</option><option value="even">Even pages</option><option value="custom">Custom range</option></select></label>
          {rangeType === 'custom' && <label className="customer-field">Page range for every file<input className="neo-input" value={rangeCustom} placeholder="For example 1-3, 5" onChange={event => setRangeCustom(event.target.value)} aria-invalid={Boolean(rangeError)} aria-describedby="range-help" /><small id="range-help">Every file must contain all the page numbers entered.</small></label>}
          <label className="customer-field">Paper size<select className="neo-select" value={paperSize} onChange={event => setPaperSize(event.target.value)}><option value="A4">A4</option><option value="Letter">Letter</option><option value="16:9">16:9</option></select></label>
          <SkeuomorphicToggle checked={duplex} onChange={setDuplex} label="Double sided" description="Ask the counter to confirm printer support." disabled={sending || locked} />
        </fieldset>
        {rangeError && <p role="alert" className="customer-error">{rangeError}</p>}
        </>}
        <UploadFileDetails files={files} estimates={estimates} printType={printType} paperSize={paperSize} rate={rate} totalPages={totalPages} totalAmount={totalAmount} />
        <p className="customer-trust"><ShieldCheck size={18} />Private files. Only this counter can access them.</p>
        {sendError && <div role="alert" className="customer-notice"><AlertCircle size={21} /><div><strong>We couldn’t confirm your order</strong><p>{sendError}</p><p>Your selected files are still here. Retry to continue; a confirmed order won’t be created twice.</p>{locked && <small>Your original settings are kept while we recover the confirmation.</small>}</div></div>}
      </>}
    </section>
    <div className="customer-actions">
      {step > 1 && <button className="neo-btn" disabled={sending || locked} onClick={() => { setStep(value => value - 1); setSendError(''); }}><ChevronLeft size={18} />Back</button>}
      <FloatingDotsButton disabled={sending || Boolean(reading) || !files.length || (step === 3 && Boolean(rangeError) && !locked)} onClick={() => step === 3 ? placeOrder() : setStep(value => value + 1)} icon={step === 3 ? onlyArchives ? <Upload size={20} /> : <Printer size={20} /> : <ChevronRight size={20} />}>{step === 1 ? 'Next: Check files' : step === 2 ? onlyArchives ? 'Next: Review & send' : 'Next: Print options' : sending ? 'Sending your order…' : sendError ? 'Retry submission' : hasArchives ? `Send files · ${onlyArchives ? 'price at counter' : `${money(totalAmount)} + ZIP price at counter`}` : `Send ${files.length === 1 ? 'file' : 'files'} · ${money(totalAmount)}`}</FloatingDotsButton>
    </div>
    <p className="customer-footnote">Files upload only when you tap Send. Unhandled orders are cancelled after 10 minutes and their files deleted. Completed or manually cancelled documents are deleted after another 10 minutes. Keep your originals.</p>
  </main>;
}
