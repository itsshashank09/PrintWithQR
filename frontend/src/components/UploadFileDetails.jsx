import { memo } from 'react';
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
function UploadFileDetails({ files, estimates, printType, paperSize, rate, totalPages, totalAmount }) {
  const archiveCount = files.filter(entry => entry.type === 'zip').length;
  const onlyArchives = archiveCount === files.length;
  return <div className="customer-summary neo-card-inset" aria-label="Selected file details"><h3>Your files</h3>{files.map((entry, index) => <div className={`summary-file${entry.type === 'zip' ? ' summary-archive' : ''}`} key={entry.id}><div><strong>{entry.file.name}</strong><small>{entry.type === 'zip' ? 'ZIP · sent unchanged · pages checked by the shop' : <>{entry.type === 'pdf' ? `PDF · ${entry.pages} ${entry.pages === 1 ? 'page' : 'pages'}` : 'Image · 1 page'} · {estimates[index].pages} to print · {printType === 'bw' ? 'B&W' : 'Colour'} · {paperSize}</>}</small></div><strong>{entry.type === 'zip' ? 'Price confirmed by the shop' : money(estimates[index].amount)}</strong></div>)}<div className="summary-total"><span>{files.length} files{!onlyArchives && ` · ${totalPages} counted pages to print`}<br /><small>{archiveCount ? `${archiveCount} ZIP ${archiveCount === 1 ? 'price' : 'prices'} confirmed separately at the counter` : `${money(rate)}/page · Estimated total for all files`}</small></span><strong>{onlyArchives ? 'Price at counter' : <>{money(totalAmount)}{archiveCount > 0 && <small> + ZIP price</small>}</>}</strong></div></div>;
}
export default memo(UploadFileDetails);
