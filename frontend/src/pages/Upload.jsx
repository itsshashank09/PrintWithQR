import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Upload, Printer, FileText, Info, HelpCircle, AlertCircle, 
  ChevronLeft, ChevronRight, CheckCircle, Landmark, RefreshCw
} from 'lucide-react';
import { supabase } from '../supabaseClient';

// Helper to get pdfjsLib dynamically from window
const getPdfjs = () => {
  const lib = window.pdfjsLib;
  if (lib && !lib.GlobalWorkerOptions.workerSrc) {
    lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  return lib;
};

// Compress image before upload to avoid "Failed to fetch" on slow networks or Supabase bucket limits
const compressImage = (file) => {
  return new Promise((resolve) => {
    if (file.size <= 500 * 1024) {
      resolve(file);
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_DIM = 2400; // ample resolution for A4 print
        if (width > height && width > MAX_DIM) {
          height *= MAX_DIM / width;
          width = MAX_DIM;
        } else if (height > MAX_DIM) {
          width *= MAX_DIM / height;
          height = MAX_DIM;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile.size < file.size ? compressedFile : file);
        }, 'image/jpeg', 0.85); 
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

const UploadPage = () => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  
  // Shop details
  const [shop, setShop] = useState(null);
  const [loadingShop, setLoadingShop] = useState(true);
  const [error, setError] = useState('');
  
  // File details - array of file entries
  const [files, setFiles] = useState([]); // [{ file, fileType, filePages, fileUrl, pdfRef }, ...]
  const [dragging, setDragging] = useState(false);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  
  // Print settings
  const [printRangeType, setPrintRangeType] = useState('all'); // all, odd, even, custom
  const [printRangeCustom, setPrintRangeCustom] = useState('');
  const [printType, setPrintType] = useState('bw'); // bw, color
  const [paperSize, setPaperSize] = useState('A4');
  const [duplex, setDuplex] = useState(false);
  
  // Preview PDF state
  const [previewPage, setPreviewPage] = useState(1);
  const [renderingPreview, setRenderingPreview] = useState(false);
  const canvasRef = useRef(null);

  const [placingOrder, setPlacingOrder] = useState(false);
  const [step, setStep] = useState(1);

  // Helper getters for the active file
  const activeFile = files[activeFileIndex] || null;
  const file = activeFile?.file || null;
  const fileType = activeFile?.fileType || '';
  const filePages = activeFile?.filePages || 0;
  const fileUrl = activeFile?.fileUrl || '';
  const pdfRef = activeFile?.pdfRef || null;
  const totalFilesPages = files.reduce((sum, f) => sum + (f.filePages || 0), 0);



  // Fetch shop metadata on entry
  useEffect(() => {
    const fetchShop = async () => {
      try {
        const { data, error: dbError } = await supabase
          .from('shops')
          .select('*')
          .eq('id', shopId)
          .single();
        
        if (dbError || !data) {
          throw new Error('This shop is not registered or currently inactive.');
        }

        const isExpired = data.subscription_expires_at ? new Date(data.subscription_expires_at) < new Date() : false;
        const hasPaidSubscription = data.is_paid === 1 && data.subscription_status === 'active' && !isExpired;
        
        const isFreePlan = data.subscription_status === 'free';
        const freeAllowed = data.free_prints_allowed !== null && data.free_prints_allowed !== undefined ? data.free_prints_allowed : 10;
        const freeUsed = data.free_prints_used || 0;
        const freeRemaining = Math.max(0, freeAllowed - freeUsed);

        if (!hasPaidSubscription && !(isFreePlan && freeRemaining > 0)) {
          throw new Error('This shop subscription has expired or run out of free prints. Please inform the shop owner to renew.');
        }
        
        setShop(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingShop(false);
      }
    };
    
    fetchShop();
  }, [shopId]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      files.forEach(f => { if (f.fileUrl) URL.revokeObjectURL(f.fileUrl); });
    };
  }, []);

  // Handle PDF rendering inside Canvas
  const renderPdfPage = async (pageNumber, pdfInstance = pdfRef) => {
    if (!canvasRef.current || !pdfInstance) return;
    setRenderingPreview(true);
    try {
      const page = await pdfInstance.getPage(pageNumber);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      
      const viewport = page.getViewport({ scale: 1 });
      // Calculate scale to fit canvas inside preview box
      const scale = Math.min(260 / viewport.width, 350 / viewport.height);
      const scaledViewport = page.getViewport({ scale });
      
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      
      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport
      };
      
      await page.render(renderContext).promise;
    } catch (err) {
      console.error('Error rendering PDF page:', err);
    } finally {
      setRenderingPreview(false);
    }
  };

  useEffect(() => {
    if (pdfRef && step === 2) {
      const timer = setTimeout(() => {
        renderPdfPage(previewPage);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [previewPage, pdfRef, step, activeFileIndex]);

  // Zero-dependency binary PDF page count extractor (failsafe if PDF.js CDN is blocked or slow)
  const parsePdfPageCountFromBuffer = (arrayBuffer) => {
    try {
      const text = new TextDecoder('latin1').decode(new Uint8Array(arrayBuffer));
      // 1. Check for /Count N in PDF document catalog
      const countMatches = text.match(/\/Count\s+(\d+)/g);
      if (countMatches && countMatches.length > 0) {
        let maxCount = 0;
        for (const m of countMatches) {
          const num = parseInt(m.replace(/\/Count\s+/, ''), 10);
          if (!isNaN(num) && num > maxCount) {
            maxCount = num;
          }
        }
        if (maxCount > 0) return maxCount;
      }
      // 2. Fallback: Count /Type /Page entries
      const pageMatches = text.match(/\/Type\s*\/Page\b/g);
      if (pageMatches && pageMatches.length > 0) {
        return pageMatches.length;
      }
    } catch (e) {
      console.warn("Binary PDF page extraction failed:", e);
    }
    return 1;
  };

  // Read PDF pages using pdfjs with binary parser fallback
  // Returns a Promise that resolves with { pages, pdfInstance }
  const processPdfFile = (selectedFile) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const arrayBuffer = e.target.result;
        let detectedPages = 0;
        let pdfInstance = null;

        const pdfjs = getPdfjs();
        if (pdfjs) {
          try {
            const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
            pdfInstance = pdf;
            detectedPages = pdf.numPages;
          } catch (pdfJsErr) {
            console.warn('PDF.js renderer error, using binary parser fallback:', pdfJsErr);
          }
        }

        if (detectedPages <= 0) {
          detectedPages = parsePdfPageCountFromBuffer(arrayBuffer);
        }

        resolve({ pages: Math.max(1, detectedPages), pdfInstance });
      };
      reader.readAsArrayBuffer(selectedFile);
    });
  };

  // Handle multiple files from input or drop
  const handleFilesSelected = async (selectedFiles) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newEntries = [];
    for (let selectedFile of selectedFiles) {
      // Validate size (100MB limit per file)
      if (selectedFile.size > 100 * 1024 * 1024) {
        alert(`File "${selectedFile.name}" exceeds the 100 MB limit and was skipped.`);
        continue;
      }

      const extension = selectedFile.name.split('.').pop().toLowerCase();
      const isPDF = extension === 'pdf';
      const isImage = ['png', 'jpg', 'jpeg'].includes(extension);

      if (!isPDF && !isImage) {
        alert(`File "${selectedFile.name}" is not a supported format and was skipped.`);
        continue;
      }

      if (isImage) {
        selectedFile = await compressImage(selectedFile);
      }

      const entry = {
        file: selectedFile,
        fileType: isPDF ? 'pdf' : 'image',
        filePages: 1,
        fileUrl: URL.createObjectURL(selectedFile),
        pdfRef: null
      };

      if (isPDF) {
        const { pages, pdfInstance } = await processPdfFile(selectedFile);
        entry.filePages = pages;
        entry.pdfRef = pdfInstance;
      }

      newEntries.push(entry);
    }

    if (newEntries.length > 0) {
      setFiles(prev => [...prev, ...newEntries]);
      setActiveFileIndex(0);
      setPreviewPage(1);
      setStep(1);
    }
  };

  // Remove a file from the list
  const removeFile = (index) => {
    setFiles(prev => {
      const updated = [...prev];
      if (updated[index]?.fileUrl) URL.revokeObjectURL(updated[index].fileUrl);
      updated.splice(index, 1);
      return updated;
    });
    setActiveFileIndex(0);
    setPreviewPage(1);
  };

  // Legacy single-file handler for backward compatibility
  const handleFileChange = (selectedFile) => {
    if (selectedFile) handleFilesSelected([selectedFile]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  // Helper to parse custom print ranges (e.g. 2-5, 7)
  const calculatePagesFromCustomRange = (rangeStr, maxPages) => {
    if (!rangeStr.trim()) return 0;
    
    const pages = new Set();
    const parts = rangeStr.split(',');
    
    for (let part of parts) {
      part = part.trim();
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const start = parseInt(startStr);
        const end = parseInt(endStr);
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          for (let i = start; i <= end; i++) {
            if (i >= 1 && i <= maxPages) pages.add(i);
          }
        }
      } else {
        const page = parseInt(part);
        if (!isNaN(page) && page >= 1 && page <= maxPages) {
          pages.add(page);
        }
      }
    }
    return pages.size;
  };

  // Calculate pages to print based on range type (across all files)
  const getPagesToPrintForFile = (fPages) => {
    if (printRangeType === 'all') return fPages;
    if (printRangeType === 'odd') return Math.ceil(fPages / 2);
    if (printRangeType === 'even') return Math.floor(fPages / 2);
    if (printRangeType === 'custom') return calculatePagesFromCustomRange(printRangeCustom, fPages);
    return fPages;
  };

  const totalPagesToPrint = files.reduce((sum, f) => sum + getPagesToPrintForFile(f.filePages), 0);

  const calculateTotal = () => {
    if (!shop || files.length === 0) return 0;
    const rate = printType === 'color' ? (parseFloat(shop.color_rate) || 10.0) : (parseFloat(shop.bw_rate) || 5.0);
    return Math.max(0, totalPagesToPrint) * rate;
  };

  // Place order — creates one order per uploaded file
  const handlePlaceOrder = async () => {
    if (files.length === 0) {
      alert('Please upload at least one file to print.');
      return;
    }
    if (totalPagesToPrint <= 0) {
      alert('Invalid page count to print. Check custom page range.');
      return;
    }

    setPlacingOrder(true);
    try {
      // 1. Fetch fresh, authoritative shop rates & subscription status directly from DB
      const { data: freshShop, error: shopFetchErr } = await supabase
        .from('shops')
        .select('bw_rate, color_rate, is_paid, subscription_status, subscription_expires_at, free_prints_allowed, free_prints_used')
        .eq('id', shopId)
        .single();

      if (shopFetchErr || !freshShop) {
        throw new Error('Could not verify shop details. Please refresh and try again.');
      }

      const expiryDate = freshShop.subscription_expires_at ? new Date(freshShop.subscription_expires_at) : null;
      const isExpired = expiryDate && expiryDate < new Date();
      const hasPaidSubscription = freshShop.is_paid === 1 && freshShop.subscription_status === 'active' && !isExpired;
      const isFreePlan = freshShop.subscription_status === 'free';
      const freeAllowed = Number(freshShop.free_prints_allowed || 10);
      const freeUsed = Number(freshShop.free_prints_used || 0);
      const freeRemaining = Math.max(0, freeAllowed - freeUsed);

      if (!hasPaidSubscription && !isFreePlan) {
        throw new Error('This print shop subscription is currently inactive or expired. Orders cannot be placed at this time.');
      }

      const dbRate = printType === 'color' ? (parseFloat(freshShop.color_rate) || 10.0) : (parseFloat(freshShop.bw_rate) || 5.0);

      // Prepare order items and upload files to storage, but delegate final order creation to server-side API
      const orderItems = [];
      for (const entry of files) {
        const f = entry.file;
        const pages = Math.max(1, getPagesToPrintForFile(entry.filePages));
        orderItems.push({
          file: f,
          file_name: f.name,
          pages_to_print: pages,
          print_type: printType,
          paper_size: paperSize,
          duplex: duplex ? 1 : 0,
          estimated_amount: pages * dbRate
        });
      }

      // If on free plan, ensure requested pages fit in remaining allowance before uploading
      const totalRequested = orderItems.reduce((s, it) => s + it.pages_to_print, 0);
      if (isFreePlan && totalRequested > freeRemaining) {
        throw new Error(`You have requested ${totalRequested} pages, but this shop only has ${freeRemaining} free print${freeRemaining === 1 ? '' : 's'} remaining on its free trial. Please ask the shop owner to subscribe, or reduce your page count.`);
      }

      // Upload files to storage and collect public URLs
      const preparedOrders = [];
      for (const it of orderItems) {
        const f = it.file;
        const fileExt = f.name.split('.').pop();
        const sanitizedFileName = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const uniqueFileName = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${sanitizedFileName}`;
        const filePath = `${shopId}/${uniqueFileName}`;

        const { error: uploadError } = await supabase.storage
          .from('print-jobs')
          .upload(filePath, f, { cacheControl: '3600', upsert: false });

        if (uploadError) throw new Error(`Failed to upload "${f.name}": ${uploadError.message}`);

        const { data: urlData } = await supabase.storage.from('print-jobs').getPublicUrl(filePath);
        const publicUrl = urlData?.publicUrl || null;
        if (!publicUrl) throw new Error('Failed to obtain public URL for uploaded file.');

        preparedOrders.push({
          file_path: publicUrl,
          file_name: it.file_name,
          pages_to_print: it.pages_to_print,
          print_type: it.print_type,
          paper_size: it.paper_size,
          duplex: it.duplex
        });
      }

      // Send order creation request to server API which will enforce free-print accounting transactionally
      const resp = await fetch('/api/create-print-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, orders: preparedOrders, paperSize, duplex })
      });

      const payload = await resp.json();
      if (!resp.ok) {
        throw new Error(payload.error || 'Failed to place print order.');
      }

      if (Array.isArray(payload.orderIds) && payload.orderIds.length > 0) {
        navigate(`/order/${payload.orderIds[0]}`);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setPlacingOrder(false);
    }
  };

  if (loadingShop) {
    return <div style={{ textAlign: 'center', padding: '100px' }}>Loading shop interface...</div>;
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '20px' }}>
        <div className="neo-card" style={{ maxWidth: '480px', textAlign: 'center', padding: '40px' }}>
          <AlertCircle size={48} style={{ color: 'var(--danger-color)', marginBottom: '15px' }} />
          <h2>Shop Inactive</h2>
          <p style={{ margin: '15px 0' }}>{error}</p>
          <button className="neo-btn neo-btn-primary" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="neo-container" style={{ padding: '30px 15px' }}>
      <header className="neo-header" style={{ marginBottom: '25px' }}>
        <div className="logo-container">
          <Printer size={24} className="neo-upload-icon" style={{ animation: 'none' }} />
          <span style={{ fontWeight: 700, fontSize: '1.25rem' }}>{shop.name} Checkout</span>
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          {shop.address}
        </div>
      </header>

      {/* Main Single Wizard Box */}
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        
        {/* Progress Bar / Step Indicator */}
        <div className="neo-card-inset" style={{ padding: '12px 20px', borderRadius: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: step === 1 ? 'var(--accent-color)' : 'var(--text-secondary)' }}>
            1. Upload
          </span>
          <div style={{ width: '30px', height: '2px', background: 'var(--border-color)' }}></div>
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: step === 2 ? 'var(--accent-color)' : 'var(--text-secondary)' }}>
            2. Preview
          </span>
          <div style={{ width: '30px', height: '2px', background: 'var(--border-color)' }}></div>
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: step === 3 ? 'var(--accent-color)' : 'var(--text-secondary)' }}>
            3. Options & Order
          </span>
        </div>

        <div className="neo-card" style={{ padding: '30px' }}>
          
          {/* STEP 1: FILE UPLOAD */}
          {step === 1 && (
            <div className="step-enter">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <h3 style={{ margin: 0 }}>File Upload</h3>
                <button 
                  className="neo-btn neo-btn-primary pulse-action-btn" 
                  disabled={files.length === 0}
                  onClick={() => { setActiveFileIndex(0); setPreviewPage(1); setStep(2); }}
                >
                  Next
                </button>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>PDF, PNG, JPG, JPEG supported (Max 100MB per file). Select multiple files at once.</p>
              
              <div 
                className={`neo-upload-area ${dragging ? 'dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('fileInput').click()}
                style={{ padding: '30px 20px', minHeight: '130px' }}
              >
                <Upload size={36} className="neo-upload-icon" />
                <div style={{ marginTop: '10px' }}>
                  <span style={{ fontWeight: 600 }}>{files.length > 0 ? 'Tap to add more files' : 'Drag & drop files here'}</span>
                  <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '5px' }}>{files.length > 0 ? `${files.length} file(s) selected` : 'or click to browse (multiple allowed)'}</span>
                </div>
                <input 
                  id="fileInput" 
                  type="file" 
                  style={{ display: 'none' }} 
                  accept=".pdf,.png,.jpg,.jpeg"
                  multiple
                  onChange={(e) => { handleFilesSelected(Array.from(e.target.files)); e.target.value = ''; }}
                />
              </div>

              {/* Selected Files List */}
              {files.length > 0 && (
                <div style={{ marginTop: '15px' }}>
                  {files.map((entry, idx) => (
                    <div key={idx} className="neo-card-inset" style={{ 
                      padding: '10px 14px', borderRadius: '10px', marginBottom: '8px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px'
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileText size={16} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.file.name}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', paddingLeft: '24px' }}>
                          {(entry.file.size / (1024 * 1024)).toFixed(2)} MB · {entry.filePages} page(s)
                        </div>
                      </div>
                      <button
                        className="neo-btn"
                        style={{ padding: '5px 10px', borderRadius: '8px', fontSize: '0.78rem', flexShrink: 0 }}
                        onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                        title="Remove file"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textAlign: 'right', marginTop: '5px' }}>
                    Total: {files.length} file(s) · {totalFilesPages} page(s)
                  </div>
                </div>
              )}
              
              
            </div>
          )}

          {/* STEP 2: PRINT PREVIEW */}
          {step === 2 && (
            <div className="step-enter">
              {/* File tabs for multi-file preview */}
              {files.length > 1 && (
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '12px', paddingBottom: '4px' }}>
                  {files.map((entry, idx) => (
                    <button
                      key={idx}
                      className={`neo-btn ${idx === activeFileIndex ? 'neo-btn-primary' : ''}`}
                      style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '0.78rem', whiteSpace: 'nowrap', flexShrink: 0 }}
                      onClick={() => { setActiveFileIndex(idx); setPreviewPage(1); }}
                    >
                      {entry.file.name.length > 18 ? entry.file.name.substring(0, 15) + '...' : entry.file.name}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <h3 style={{ margin: 0 }}>Document Preview</h3>
                  {fileType === 'pdf' && filePages > 1 && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <button 
                        className="neo-btn" 
                        style={{ padding: '5px 10px', borderRadius: '8px' }}
                        disabled={previewPage <= 1 || renderingPreview}
                        onClick={() => setPreviewPage(prev => prev - 1)}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{previewPage} / {filePages}</span>
                      <button 
                        className="neo-btn" 
                        style={{ padding: '5px 10px', borderRadius: '8px' }}
                        disabled={previewPage >= filePages || renderingPreview}
                        onClick={() => setPreviewPage(prev => prev + 1)}
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="neo-btn" onClick={() => setStep(1)}>Back</button>
                  <button
                    className="neo-btn neo-btn-primary pulse-action-btn"
                    onClick={() => setStep(3)}
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="neo-preview-box" style={{ background: '#ffffff', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', overflow: 'hidden' }}>
                {fileType === 'image' ? (
                  <img 
                    src={fileUrl} 
                    alt="Preview" 
                    style={{ maxWidth: '100%', maxHeight: '350px', objectFit: 'contain', borderRadius: '8px', boxShadow: 'var(--shadow-dark)' }} 
                  />
                ) : (
                  <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                    <canvas ref={canvasRef} style={{ boxShadow: 'var(--shadow-dark)', borderRadius: '4px', maxWidth: '100%', maxHeight: '350px', display: 'block' }}></canvas>
                    {renderingPreview && (
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(224, 224, 224, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px' }}>
                        <RefreshCw size={24} className="neo-upload-icon" />
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              
            </div>
          )}

          {/* STEP 3: PRINT OPTIONS & ORDER */}
          {step === 3 && (
            <div className="step-enter">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ margin: 0 }}>Print Configuration</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="neo-btn" onClick={() => setStep(2)}>Back</button>
                  <button 
                    className="neo-btn neo-btn-success pulse-action-btn" 
                    disabled={placingOrder || totalPagesToPrint <= 0}
                    onClick={handlePlaceOrder}
                  >
                    {placingOrder ? `Uploading ${files.length} file(s)...` : `Place Print Order (${files.length} file${files.length > 1 ? 's' : ''})`}
                  </button>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>Select preferences for printing your document</p>

              {/* Color Option */}
              <div className="neo-input-group" style={{ marginBottom: '15px' }}>
                <label className="neo-label">Color Option</label>
                <div className="neo-tabs">
                  <div 
                    className={`neo-tab ${printType === 'bw' ? 'active' : ''}`}
                    onClick={() => setPrintType('bw')}
                  >
                    B&W (₹{shop.bw_rate}/page)
                  </div>
                  {shop.color_enabled !== 0 ? (
                    <div 
                      className={`neo-tab ${printType === 'color' ? 'active' : ''}`}
                      onClick={() => setPrintType('color')}
                    >
                      Color (₹{shop.color_rate}/page)
                    </div>
                  ) : (
                    <div 
                      className="neo-tab"
                      style={{ opacity: 0.5, cursor: 'not-allowed', textDecoration: 'line-through' }}
                      title="Color printing is disabled by this shop"
                    >
                      Color (N/A)
                    </div>
                  )}
                </div>
              </div>

              {/* Select Pages */}
              <div className="neo-input-group" style={{ marginBottom: '15px' }}>
                <label className="neo-label">Select Pages</label>
                <select 
                  className="neo-select"
                  value={printRangeType}
                  onChange={(e) => setPrintRangeType(e.target.value)}
                >
                  <option value="all">All Pages ({totalFilesPages})</option>
                  <option value="odd">Odd Pages Only</option>
                  <option value="even">Even Pages Only</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {/* Custom Range Input */}
              {printRangeType === 'custom' && (
                <div className="neo-input-group" style={{ marginBottom: '15px' }}>
                  <label className="neo-label">Custom Range (e.g. 2-5, 7, 9-11)</label>
                  <input 
                    type="text" 
                    className="neo-input" 
                    placeholder="Enter ranges separated by commas"
                    value={printRangeCustom}
                    onChange={(e) => setPrintRangeCustom(e.target.value)}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '5px' }}>
                    Pages to print: {totalPagesToPrint} / {totalFilesPages}
                  </p>
                </div>
              )}

              {/* Paper Size & Duplex Switch */}
              <div className="neo-grid" style={{ gap: '0 20px', gridTemplateColumns: '1fr 1fr', marginBottom: '20px' }}>
                <div className="neo-input-group">
                  <label className="neo-label">Paper Size</label>
                  <select 
                    className="neo-select"
                    value={paperSize}
                    onChange={(e) => setPaperSize(e.target.value)}
                  >
                    <option value="A4">A4</option>
                    <option value="Letter">Letter</option>
                    <option value="16:9">16:9</option>
                  </select>
                </div>

                <div 
                  className="neo-switch-container" 
                  style={{ alignSelf: 'center', marginTop: '15px', cursor: 'pointer' }}
                  onClick={() => setDuplex(prev => !prev)}
                >
                  <span className="neo-switch-label" style={{ fontSize: '0.95rem', userSelect: 'none' }}>Double Sided</span>
                  <label className="neo-switch" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      checked={duplex} 
                      onChange={(e) => setDuplex(e.target.checked)}
                    />
                    <span className="neo-slider"></span>
                  </label>
                </div>
              </div>

              {/* Pricing Breakdown */}
              <div className="neo-card-inset" style={{ padding: '20px', borderRadius: '15px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Files:</span>
                  <span style={{ fontWeight: 600 }}>{files.length} file(s)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total pages to print:</span>
                  <span style={{ fontWeight: 600 }}>{totalPagesToPrint} page(s)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Rate per page:</span>
                  <span style={{ fontWeight: 600 }}>₹{printType === 'color' ? shop.color_rate : shop.bw_rate}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Total Cost:</span>
                  <span style={{ fontWeight: 700, fontSize: '1.6rem', color: 'var(--accent-color)' }}>₹{calculateTotal()}</span>
                </div>
              </div>

              {/* Cash Payment Banner */}
              <div className="neo-card-inset" style={{ padding: '15px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
                <Landmark size={20} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Offline Cash Payment Only</span>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Show your Print Order ID at the counter to pay and get your printouts.
                  </p>
                </div>
              </div>
              
              
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default UploadPage;
