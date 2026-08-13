import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { 
  Printer, QrCode, Download, Settings, LogOut, CheckCircle, 
  XCircle, Play, Layers, HelpCircle, Laptop, HardDrive, RefreshCw,
  Sparkles, Zap, ShieldAlert, Clock
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { triggerAutoCleanup, syncOrdersToLocalStorage } from '../utils/cleanup';
import { processSubscriptionPayment } from '../utils/payment';

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalPages: 0,
    bwUsage: 0,
    colorUsage: 0,
    totalRevenue: 0
  });
  const [orders, setOrders] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [posterDataUrl, setPosterDataUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('orders'); // orders, printers, guide
  const [subscriptionDaysLeft, setSubscriptionDaysLeft] = useState(null);
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState(null);
  const [freePrintsAllowed, setFreePrintsAllowed] = useState(10);
  const [freePrintsUsed, setFreePrintsUsed] = useState(0);
  const [hasPaidSubscription, setHasPaidSubscription] = useState(false);
  const [isFreePlan, setIsFreePlan] = useState(true);
  const [upgradingInDashboard, setUpgradingInDashboard] = useState(false);
  const [timeTick, setTimeTick] = useState(Date.now());

  const shopId = localStorage.getItem('shopId');
  const shopName = localStorage.getItem('shopName');

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeTick(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getPrintingTimers = () => {
    try {
      return JSON.parse(localStorage.getItem(`printing_timers_${shopId}`) || '{}');
    } catch (e) {
      return {};
    }
  };

  const savePrintingTimer = (orderId) => {
    const timers = getPrintingTimers();
    timers[orderId] = Date.now();
    localStorage.setItem(`printing_timers_${shopId}`, JSON.stringify(timers));
  };

  const generatePosterComposite = (qrUrl) => {
    return new Promise((resolve) => {
      const posterImg = new Image();
      posterImg.crossOrigin = 'anonymous';
      posterImg.src = '/qr_poster_template.png';
      
      posterImg.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = posterImg.naturalWidth || 682;
        canvas.height = posterImg.naturalHeight || 1024;
        const ctx = canvas.getContext('2d');

        // Draw Poster Template Background
        ctx.drawImage(posterImg, 0, 0, canvas.width, canvas.height);

        // Draw Shop Custom QR Code inside center white cutout box
        const qrImg = new Image();
        qrImg.crossOrigin = 'anonymous';
        qrImg.src = qrUrl;

        qrImg.onload = () => {
          const qrSize = Math.round(canvas.width * 0.41); // ~280px
          const posX = Math.round((canvas.width / 2) - (qrSize / 2)); // ~201px
          const posY = Math.round((canvas.height * 0.374) - (qrSize / 2)); // ~243px

          ctx.drawImage(qrImg, posX, posY, qrSize, qrSize);
          const finalPosterUrl = canvas.toDataURL('image/png');
          resolve(finalPosterUrl);
        };

        qrImg.onerror = () => resolve('');
      };

      posterImg.onerror = () => resolve('');
    });
  };


  const getLocalOrderHistory = () => {
    try {
      const historyStr = localStorage.getItem(`orders_history_${shopId}`);
      return historyStr ? JSON.parse(historyStr) : [];
    } catch (e) {
      console.error('Error parsing order history:', e);
      return [];
    }
  };

  const saveLocalOrderHistory = (history) => {
    localStorage.setItem(`orders_history_${shopId}`, JSON.stringify(history));
  };

  const calculateStats = (allOrders) => {
    const totalOrders = allOrders.length;
    let totalPages = 0;
    let bwUsage = 0;
    let colorUsage = 0;
    let totalRevenue = 0;

    allOrders.forEach(o => {
      if (o && (o.status || 'Pending') !== 'Cancelled') {
        const pages = parseInt(o.pages_to_print) || 0;
        totalPages += pages;
        totalRevenue += parseFloat(o.total_amount) || 0;
        if (o.print_type === 'color') {
          colorUsage += pages;
        } else {
          bwUsage += pages;
        }
      }
    });

    return {
      totalOrders,
      totalPages,
      bwUsage,
      colorUsage,
      totalRevenue
    };
  };

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // 1. Fetch active orders from Supabase orders table
      const { data: dbOrders, error: dbError } = await supabase
        .from('orders')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (dbError) {
        throw new Error(dbError.message || 'Failed to fetch orders from database.');
      }

      setOrders(dbOrders || []);
      syncOrdersToLocalStorage(shopId, dbOrders || []);

      // Calculate combined stats from DB active orders + browser local storage history
      const localHistory = getLocalOrderHistory();
      const allCombinedMap = new Map();
      localHistory.forEach(item => { if (item && item.id) allCombinedMap.set(item.id, item); });
      (dbOrders || []).forEach(item => { if (item && item.id) allCombinedMap.set(item.id, item); });
      const combinedList = Array.from(allCombinedMap.values());

      setStats(calculateStats(combinedList));
      triggerAutoCleanup(shopId, dbOrders || []);

      // Check live payment & admin status from database
      const { data: currentShop } = await supabase
        .from('shops')
        .select('is_paid, is_admin, subscription_expires_at, subscription_status, free_prints_allowed, free_prints_used')
        .eq('id', shopId)
        .single();
      
      if (currentShop) {
        const expiryDate = currentShop.subscription_expires_at ? new Date(currentShop.subscription_expires_at) : null;
        const now = new Date();
        const isExpired = expiryDate ? expiryDate < now : false;

        const hasPaidSubscription = currentShop.is_paid === 1 && currentShop.subscription_status === 'active' && !isExpired;
        const isFreePlan = currentShop.subscription_status === 'free';
        
        // Store this state for UI rendering
        setHasPaidSubscription(hasPaidSubscription);
        setIsFreePlan(isFreePlan);

        if (currentShop.is_admin) {
          localStorage.setItem('isAdmin', 'true');
        } else {
          localStorage.setItem('isAdmin', 'false');
          
          if (expiryDate) {
            setSubscriptionExpiresAt(currentShop.subscription_expires_at);
            const diffTime = Math.max(0, expiryDate - now);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            setSubscriptionDaysLeft(diffDays);
          }

          const freeAllowed = currentShop.free_prints_allowed !== null && currentShop.free_prints_allowed !== undefined ? currentShop.free_prints_allowed : 10;
          const freeUsed = currentShop.free_prints_used || 0;
          setFreePrintsAllowed(freeAllowed);
          setFreePrintsUsed(freeUsed);

          const freeRemaining = Math.max(0, freeAllowed - freeUsed);

          if (!hasPaidSubscription && !(isFreePlan && freeRemaining > 0)) {
            navigate(`/payment/${shopId}?plan=yearly`);
            return;
          }
        }
      }

      // Generate QR Code & Printable Official Poster
      const customerUrl = `${window.location.origin}/shop/${shopId}`;
      const qrDataUrl = await QRCode.toDataURL(customerUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#1a1a1a',
          light: '#ffffff'
        }
      });
      setQrCodeUrl(qrDataUrl);

      const posterUrl = await generatePosterComposite(qrDataUrl);
      if (posterUrl) {
        setPosterDataUrl(posterUrl);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    fetchData();

    // 1. Subscribe to Postgres changes on the public.orders table in real-time
    const channel = supabase
      .channel(`orders_shop_${shopId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'orders',
          filter: `shop_id=eq.${shopId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            try {
              const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav');
              audio.volume = 0.5;
              audio.play();
            } catch (e) {
              console.log('Audio play blocked by browser policies.');
            }
          }
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shopId, navigate]);

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      // Update order status directly in Supabase
      const { error: dbError } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (dbError) {
        throw new Error(dbError.message || 'Failed to update order status.');
      }
      
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const getSignedFileUrl = async (filePath) => {
    if (!filePath) return '';
    try {
      let storagePath = filePath;
      if (filePath.includes('/print-jobs/')) {
        storagePath = filePath.split('/print-jobs/').pop();
      } else if (filePath.startsWith('http')) {
        const urlParts = filePath.split('/');
        storagePath = urlParts.slice(-2).join('/');
      }

      const { data, error } = await supabase.storage
        .from('print-jobs')
        .createSignedUrl(storagePath, 3600); // 1-hour secure Signed URL

      if (error || !data?.signedUrl) {
        return filePath;
      }
      return data.signedUrl;
    } catch (e) {
      return filePath;
    }
  };

  const parseOrderFiles = (order) => {
    let paths = [];
    let names = [];
    try {
      if (order.file_path && order.file_path.startsWith('[')) {
        paths = JSON.parse(order.file_path);
      } else {
        paths = [order.file_path];
      }
    } catch (e) {
      paths = [order.file_path];
    }

    try {
      if (order.file_name && order.file_name.startsWith('[')) {
        names = JSON.parse(order.file_name);
      } else {
        names = [order.file_name];
      }
    } catch (e) {
      names = [order.file_name];
    }

    return { paths, names };
  };

  const getOrderDisplayName = (order) => {
    const { names } = parseOrderFiles(order);
    if (names.length > 1) {
      return `${names.length} Files (${names.join(', ')})`;
    }
    return names[0] || 'Document';
  };

  const handleSaveFile = async (order) => {
    const { paths, names } = parseOrderFiles(order);
    for (let i = 0; i < paths.length; i++) {
      const fileUrl = await getSignedFileUrl(paths[i]);
      try {
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = names[i] || `file_${i + 1}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      } catch (e) {
        window.open(fileUrl, '_blank');
      }
    }
  };

  const handleBrowserPrint = async (order) => {
    const { paths, names } = parseOrderFiles(order);
    await handleUpdateStatus(order.id, 'Printing');
    savePrintingTimer(order.id);

    const signedUrls = await Promise.all(paths.map(p => getSignedFileUrl(p)));
    const allImages = names.every(name => /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(name));

    if (allImages) {
      // Open a clean dedicated print window containing ONLY the uploaded document images
      const printWin = window.open('', '_blank', 'width=900,height=1000');
      if (!printWin) {
        alert('Pop-up blocked. Please allow pop-ups for this site so the print window can open.');
        return;
      }

      const imgHtml = signedUrls.map((url, idx) => `
        <div style="page-break-after: ${idx === signedUrls.length - 1 ? 'avoid' : 'always'}; page-break-inside: avoid; display: flex; justify-content: center; align-items: center; min-height: 98vh; width: 100%;">
          <img src="${url}" style="max-width: 100%; max-height: 98vh; object-fit: contain;" onload="window.checkAllLoaded && window.checkAllLoaded()" />
        </div>
      `).join('');

      printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Print Job - ${order.id}</title>
          <style>
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              width: 100%;
            }
            @page {
              margin: 0;
              size: auto;
            }
            @media print {
              html, body { margin: 0; padding: 0; }
              div { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          ${imgHtml}
          <script>
            let totalImages = ${signedUrls.length};
            let loadedImages = 0;
            let printed = false;
            window.checkAllLoaded = function() {
              loadedImages++;
              if (loadedImages >= totalImages && !printed) {
                printed = true;
                setTimeout(function() {
                  window.focus();
                  window.print();
                }, 300);
              }
            };
            setTimeout(function() {
              if (!printed) {
                printed = true;
                window.focus();
                window.print();
              }
            }, 10000);
          </script>
        </body>
        </html>
      `);
      printWin.document.close();
    } else {
      // PDF File: Open inside a full-screen iframe overlay directly inside the dashboard tab
      const pdfUrl = signedUrls[0];

      // Remove any existing overlay iframe container
      const existingContainer = document.getElementById('pdf-iframe-container');
      if (existingContainer) existingContainer.parentNode.removeChild(existingContainer);

      const container = document.createElement('div');
      container.id = 'pdf-iframe-container';
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '0';
      container.style.width = '100vw';
      container.style.height = '100vh';
      container.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      container.style.zIndex = '999999';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';

      const bar = document.createElement('div');
      bar.style.display = 'flex';
      bar.style.justifyContent = 'space-between';
      bar.style.alignItems = 'center';
      bar.style.padding = '12px 24px';
      bar.style.backgroundColor = '#0f172a';
      bar.style.color = '#ffffff';
      bar.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';

      const titleSpan = document.createElement('span');
      titleSpan.style.fontWeight = '700';
      titleSpan.style.fontSize = '1.05rem';
      titleSpan.innerText = `📄 PDF Preview — ${names[0] || order.id}`;

      const buttonsContainer = document.createElement('div');
      buttonsContainer.style.display = 'flex';
      buttonsContainer.style.gap = '12px';

      const printBtn = document.createElement('button');
      printBtn.innerText = '🖨️ Print PDF';
      printBtn.style.padding = '8px 18px';
      printBtn.style.backgroundColor = '#3b82f6';
      printBtn.style.color = '#ffffff';
      printBtn.style.border = 'none';
      printBtn.style.borderRadius = '8px';
      printBtn.style.fontWeight = '700';
      printBtn.style.cursor = 'pointer';
      printBtn.style.fontSize = '0.9rem';
      printBtn.onclick = () => {
        window.open(pdfUrl, '_blank');
      };

      const closeBtn = document.createElement('button');
      closeBtn.innerText = '✕ Close Preview';
      closeBtn.style.padding = '8px 18px';
      closeBtn.style.backgroundColor = '#ef4444';
      closeBtn.style.color = '#ffffff';
      closeBtn.style.border = 'none';
      closeBtn.style.borderRadius = '8px';
      closeBtn.style.fontWeight = '700';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.fontSize = '0.9rem';
      closeBtn.onclick = () => {
        if (container.parentNode) container.parentNode.removeChild(container);
      };

      buttonsContainer.appendChild(printBtn);
      buttonsContainer.appendChild(closeBtn);

      bar.appendChild(titleSpan);
      bar.appendChild(buttonsContainer);

      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = 'calc(100vh - 55px)';
      iframe.style.border = 'none';
      iframe.src = pdfUrl;

      container.appendChild(bar);
      container.appendChild(iframe);
      document.body.appendChild(container);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('shopId');
    localStorage.removeItem('shopName');
    navigate('/');
  };

  // Pre-configured dynamic Python Print Agent script generator
  const downloadPrintAgent = () => {
    const backendUrl = SOCKET_URL;
    const agentScript = `import os
import sys
import time
import requests
import socketio
from PIL import Image, ImageWin

# Configuration
API_URL = "${SOCKET_URL}/api"
SOCKET_URL = "${SOCKET_URL}"
SHOP_ID = "${shopId}"

# Attempt to import win32print for system printer access on Windows
try:
    import win32print
    import win32ui
    import win32gui
    import fitz  # PyMuPDF for PDF rendering
    WIN_ENABLED = True
except ImportError:
    WIN_ENABLED = False
    print("WARNING: Windows printing libraries not found. Running in mock mode.")
    print("To install, run: pip install pywin32 PyMuPDF Pillow requests python-socketio[client]")

sio = socketio.Client()

def get_printers():
    if not WIN_ENABLED:
        return [{"name": "Mock Default PDF Printer", "type": "both"}]
    
    printers = []
    try:
        flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
        printer_list = win32print.EnumPrinters(flags, None, 4)
        
        # Keywords to filter out virtual document writers / fax
        virtual_keywords = ['onenote', 'print to pdf', 'xps document writer', 'fax']
        
        for p in printer_list:
            name = p.get('pPrinterName', '')
            if name:
                # Skip virtual printers
                if any(kw in name.lower() for kw in virtual_keywords):
                    continue
                p_type = 'color' if any(x in name.lower() for x in ['color', 'photo', 'inkjet', 'deskjet']) else 'bw'
                printers.append({"name": name, "type": p_type})
    except Exception as e:
        print(f"Error reading system printers: {e}")
        
    return printers

def register_printers():
    printers = get_printers()
    print(f"Registering system printers: {[p['name'] for p in printers]}")
    try:
        res = requests.post(f"{API_URL}/agent/register-printers", json={
            "shop_id": SHOP_ID,
            "printers": printers
        })
        if res.status_code == 200:
            print("Printers successfully registered with server.")
        else:
            print(f"Failed to register printers: {res.text}")
    except Exception as e:
        print(f"Error registering printers: {e}")

def print_document_via_dc(file_path, printer_name, duplex_setting=0):
    if not WIN_ENABLED:
        print(f"[MOCK] Printing {file_path} to {printer_name} (Duplex: {duplex_setting}).")
        return True

    hprinter = win32print.OpenPrinter(printer_name)
    try:
        properties = win32print.GetPrinter(hprinter, 2)
        devmode = properties["pDevMode"]
        
        target_duplex = 2 if duplex_setting == 1 else 1
        devmode.Duplex = target_duplex
        devmode.Fields |= 0x1000
        
        win32print.DocumentProperties(0, hprinter, printer_name, devmode, devmode, 10)
        
        hdc_handle = win32gui.CreateDC("WINSPOOL", printer_name, devmode)
        hdc = win32ui.CreateDCFromHandle(hdc_handle)
        
        hdc.StartDoc("QRPrintPlatform Job")
        
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.pdf':
            doc = fitz.open(file_path)
            for page_num in range(len(doc)):
                print(f"  Rendering & spooling page {page_num + 1}/{len(doc)}...")
                hdc.StartPage()
                page = doc.load_page(page_num)
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                draw_image_on_dc(hdc, img)
                hdc.EndPage()
        else:
            hdc.StartPage()
            img = Image.open(file_path)
            draw_image_on_dc(hdc, img)
            hdc.EndPage()
            
        hdc.EndDoc()
        win32gui.DeleteDC(hdc_handle)
        return True
    except Exception as e:
        print(f"Error spooling document: {e}")
        raise e
    finally:
        try:
            win32print.ClosePrinter(hprinter)
        except Exception:
            pass

def draw_image_on_dc(hdc, img):
    print_w = hdc.GetDeviceCaps(8)
    print_h = hdc.GetDeviceCaps(10)
    img_w, img_h = img.size
    ratio = min(print_w / img_w, print_h / img_h)
    new_w = int(img_w * ratio)
    new_h = int(img_h * ratio)
    x1 = (print_w - new_w) // 2
    y1 = (print_h - new_h) // 2
    x2 = x1 + new_w
    y2 = y1 + new_h
    dib = ImageWin.Dib(img)
    dib.draw(hdc.GetSafeHdc(), (x1, y1, x2, y2))

@sio.event
def connect():
    print("Connected to QRPrintPlatform Socket Server.")
    sio.emit("joinAgent", SHOP_ID)
    register_printers()

@sio.on("newPrintJob")
def on_new_print_job(data):
    job_id = data.get("id")
    file_name = data.get("fileName")
    file_path_rel = data.get("filePath")
    target_printer = data.get("printerId") # Discovered printer name selected by owner
    pages = data.get("pages")
    duplex = data.get("duplex", 0)
    print_type = data.get("printType", "bw")
    
    file_url = f"{SOCKET_URL}{file_path_rel}"
    print("\\n" + "="*50)
    print(f"NEW PRINT JOB DETECTED: {job_id}")
    print(f"File Name: {file_name}")
    print(f"Pages: {pages}")
    print(f"Print Type: {print_type.upper()}")
    print(f"Double Sided: {'Yes' if duplex == 1 else 'No'}")
    print(f"Target Printer: {target_printer or 'Default'}")
    print("="*50)
    
    print("Direct printing active. Initializing spooler...")
    print("Downloading file...")
    try:
        r = requests.get(file_url)
        temp_dir = os.path.join(os.path.expanduser('~'), 'Downloads', 'QRPrintJobs')
        if not os.path.exists(temp_dir):
            os.makedirs(temp_dir)
            
        temp_file_path = os.path.join(temp_dir, f"{job_id}_{file_name}")
        with open(temp_file_path, 'wb') as f:
            f.write(r.content)
            
        print(f"Saved to: {temp_file_path}")
        print("Sending to Windows spooler...")
        
        printer_to_use = target_printer if target_printer else win32print.GetDefaultPrinter()
        print_document_via_dc(temp_file_path, printer_to_use, duplex)
            
        print("Spool completed. Marking order as Completed.")
        requests.put(f"{API_URL}/owner/order-status", json={
            "orderId": job_id,
            "status": "Completed"
        }, headers={"Authorization": "Bearer AGENT_BYPASS"})
    except Exception as e:
        print(f"Error executing print job: {e}")

@sio.event
def disconnect():
    print("Disconnected from server.")

if __name__ == "__main__":
    print("Starting QRPrintPlatform PC Agent...")
    try:
        sio.connect(SOCKET_URL)
        sio.wait()
    except KeyboardInterrupt:
        print("\\nExiting Print Agent.")
        sys.exit(0)
    except Exception as e:
        print(f"Connection error: {e}")
`;

    const blob = new Blob([agentScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'agent.py';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadStartupScript = () => {
    const batContent = `@echo off
echo Setting up PrintWithQR to open on startup...
set STARTUP_FOLDER=%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup
echo start https://www.printwithqr.in/dashboard > "%STARTUP_FOLDER%\\PrintWithQR_Startup.bat"
echo Setup complete! PrintWithQR will now open automatically every time you turn on your PC.
start https://www.printwithqr.in/dashboard
pause`;

    const blob = new Blob([batContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Setup_PrintWithQR_Startup.bat';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="neo-container" style={{ padding: '30px 20px' }}>
      {/* Top Header */}
      <header className="neo-header">
        <div className="logo-container" style={{ alignItems: 'flex-start' }}>
          <Printer size={46} className="neo-upload-icon" style={{ animation: 'none', marginTop: '6px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{ fontSize: '2.2rem', fontWeight: '900', color: 'var(--accent-color)', letterSpacing: '-0.5px', lineHeight: '1', marginBottom: '4px' }}>PrintWithQR.in</span>
            <span className="logo-text" style={{ lineHeight: '1', color: 'var(--text-secondary)' }}>{shopName}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button className="neo-btn" onClick={() => navigate('/profile')}>
            <Settings size={18} /> Settings
          </button>
          <button className="neo-btn neo-btn-danger" onClick={handleLogout}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </header>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <RefreshCw size={36} className="neo-upload-icon" />
        </div>
      ) : (
        <>
          {/* SPECIAL UPGRADE OFFER BANNER (During last 3 days of subscription) */}
          {subscriptionDaysLeft !== null && subscriptionDaysLeft <= 3 && (
            <div className="neo-card-inset" style={{ 
              padding: '24px 28px', 
              borderRadius: '20px', 
              marginBottom: '30px', 
              border: '2px solid var(--accent-color)', 
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(245, 158, 11, 0.08) 100%)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: '-1px', right: '20px', background: 'var(--accent-gradient)', color: '#ffffff', fontSize: '0.72rem', padding: '5px 14px', borderRadius: '0 0 12px 12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                🔥 50% OFF Limited Upgrade Offer
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                <div style={{ maxWidth: '620px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <Sparkles size={24} style={{ color: 'var(--accent-color)' }} />
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-color)' }}>
                      Special Upgrade Offer: Switch to Annual Plan for ₹599/yr &amp; Save 50%!
                    </h3>
                  </div>

                  <p style={{ margin: '6px 0 0 0', fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    Your current monthly subscription expires in <strong style={{ color: 'var(--danger-color)' }}>{subscriptionDaysLeft > 0 ? `${subscriptionDaysLeft} day${subscriptionDaysLeft > 1 ? 's' : ''}` : 'today'}</strong>. Upgrade now to the Annual Plan for <strong>₹599/year</strong> to get 12 months of unlimited shop QR prints for the price of 6!
                  </p>
                </div>

                <button
                  className="neo-btn neo-btn-primary"
                  style={{ padding: '14px 24px', borderRadius: '15px', fontSize: '0.98rem', fontWeight: 700, gap: '10px', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}
                  disabled={upgradingInDashboard}
                  onClick={() => {
                    processSubscriptionPayment({
                      plan: 'yearly',
                      shopId,
                      phone: localStorage.getItem('saved_phone') || '',
                      name: shopName,
                      setLoading: setUpgradingInDashboard,
                      onSuccess: () => {
                        fetchData();
                      }
                    });
                  }}
                >
                  <Zap size={18} /> {upgradingInDashboard ? 'Launching Razorpay...' : 'Upgrade Now for ₹599'}
                </button>
              </div>
            </div>
          )}

          {/* Main Dashboard Cards */}
          <div className="dashboard-stats-grid">
            <div className="neo-card stat-card">
              <div className="stat-val">{stats.totalOrders}</div>
              <div className="stat-label">Total Orders</div>
            </div>
            <div className="neo-card stat-card">
              <div className="stat-val">{stats.totalPages}</div>
              <div className="stat-label">Pages Printed</div>
            </div>
            <div className="neo-card stat-card">
              <div className="stat-val">₹{stats.totalRevenue}</div>
              <div className="stat-label">Total Revenue</div>
            </div>
            <div className="neo-card stat-card">
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-color)' }}>
                {hasPaidSubscription ? 'Unlimited' : Math.max(0, freePrintsAllowed - freePrintsUsed)}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {hasPaidSubscription ? 'Prints Available' : 'Free Prints Remaining'}
              </div>
              <div style={{ fontSize: '0.75rem', marginTop: '8px', color: 'var(--text-secondary)' }}>
                {hasPaidSubscription ? 'Active Subscription' : `${freePrintsUsed}/${freePrintsAllowed} used`}
              </div>
            </div>
            <div className="neo-card stat-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '15px', width: '100%', justifyContent: 'space-around' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--text-color)' }}>{stats.bwUsage}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>B&W Pages</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--accent-color)' }}>{stats.colorUsage}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Color Pages</div>
                </div>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'var(--bg-color)', boxShadow: 'var(--inset-shadow)', borderRadius: '4px', marginTop: '15px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${stats.totalPages > 0 ? (stats.bwUsage / stats.totalPages) * 100 : 50}%`, background: 'var(--text-color)', height: '100%' }}></div>
                <div style={{ width: `${stats.totalPages > 0 ? (stats.colorUsage / stats.totalPages) * 100 : 50}%`, background: 'var(--accent-color)', height: '100%' }}></div>
              </div>
            </div>
          </div>

          <div className="dashboard-layout-row">
            {/* Left side actions and QR Code */}
            <div className="dashboard-left-col" style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
              
              {/* Official Shop Printable Poster Card */}
              <div className="neo-card" style={{ textAlign: 'center', padding: '24px 20px' }}>
                <h3 style={{ margin: '0 0 6px 0' }}>Shop Counter QR Poster</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '18px', lineHeight: '1.4' }}>
                  Print & display this official poster in your shop so customers can scan to upload!
                </p>
                
                {posterDataUrl ? (
                  <div className="neo-card-inset" style={{ display: 'inline-flex', padding: '6px', background: '#ffffff', borderRadius: '16px', marginBottom: '18px', border: '1px solid var(--border-color)', boxShadow: '0 6px 20px rgba(0,0,0,0.1)' }}>
                    <img src={posterDataUrl} alt="Official Shop QR Counter Poster" style={{ width: '100%', maxWidth: '270px', height: 'auto', borderRadius: '10px', display: 'block' }} />
                  </div>
                ) : qrCodeUrl ? (
                  <div className="neo-card-inset" style={{ display: 'inline-flex', padding: '15px', background: '#ffffff', borderRadius: '15px', marginBottom: '18px' }}>
                    <img src={qrCodeUrl} alt="Shop QR Code" style={{ width: '200px', height: '200px', borderRadius: '10px' }} />
                  </div>
                ) : null}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {posterDataUrl && (
                    <a href={posterDataUrl} download={`${shopName}_Official_Shop_Poster.png`} className="neo-btn neo-btn-primary" style={{ width: '100%', textDecoration: 'none', justifyContent: 'center', padding: '12px 16px' }}>
                      <Download size={18} /> Download Shop Poster (PNG)
                    </a>
                  )}
                  {qrCodeUrl && (
                    <a href={qrCodeUrl} download={`${shopName}_QR_Code_Only.png`} className="neo-btn" style={{ width: '100%', textDecoration: 'none', justifyContent: 'center', fontSize: '0.82rem', padding: '10px 14px' }}>
                      <QrCode size={16} /> Download QR Code Only
                    </a>
                  )}
                </div>
              </div>

            </div>

            {/* Right side main order status and tables */}
            <div className="dashboard-right-col" style={{ flex: '1 1 0', minWidth: 0 }}>
              <div className="neo-tabs">
                <div className={`neo-tab ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
                  Live Print Queue
                </div>
                <div className={`neo-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
                  Saved History (Browser)
                </div>
                <div className={`neo-tab ${activeTab === 'guide' ? 'active' : ''}`} onClick={() => setActiveTab('guide')}>
                  How to Use
                </div>
              </div>

              {/* ORDERS TAB */}
              {activeTab === 'orders' && (
                <div className="neo-card" style={{ padding: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '0 10px' }}>
                    <h3>Active Print Jobs</h3>
                    <button className="neo-btn" onClick={fetchData} style={{ padding: '8px 15px', borderRadius: '10px' }}>
                      <RefreshCw size={14} /> Refresh
                    </button>
                  </div>

                  {orders.filter(o => (o.status || 'Pending') === 'Pending' || o.status === 'Printing').length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                      No active print jobs in queue.
                    </div>
                  ) : (
                    <div className="neo-table-wrapper">
                      <table className="neo-table">
                        <thead>
                          <tr>
                            <th>Order ID</th>
                            <th>Details</th>
                            <th>Pricing</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.filter(o => (o.status || 'Pending') === 'Pending' || o.status === 'Printing').map((o) => (
                            <tr key={o.id}>
                              <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{o.id}</td>
                              <td>
                                <div style={{ fontWeight: 600, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={getOrderDisplayName(o)}>
                                  {getOrderDisplayName(o)}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                  {(o.pages_to_print || 0)} pages • {(o.print_type || 'bw').toUpperCase()} • {(o.paper_size || 'A4')} • {o.duplex ? 'Double Sided' : 'Single Sided'}
                                </div>
                              </td>
                              <td style={{ fontWeight: 600 }}>₹{(o.total_amount || 0)}</td>
                              <td>
                                <span className={`neo-badge status-${(o.status || 'Pending').toLowerCase()}`}>
                                  {(o.status || 'Pending')}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  {(() => {
                                    const timers = getPrintingTimers();
                                    const printTime = timers[o.id];
                                    const isWithin3Min = printTime && (timeTick - printTime < 3 * 60 * 1000);
                                    const secondsLeft = printTime ? Math.max(0, Math.ceil((3 * 60 * 1000 - (timeTick - printTime)) / 1000)) : 0;
                                    const currentStatus = o.status || 'Pending';

                                    if (currentStatus === 'Pending') {
                                      return (
                                        <>
                                          <button 
                                            className="neo-btn" 
                                            style={{ padding: '8px 12px', borderRadius: '10px' }}
                                            onClick={() => handleSaveFile(o)}
                                            title="Download/Save File to PC"
                                          >
                                            <Download size={14} /> Save
                                          </button>
                                          <button 
                                            className="neo-btn neo-btn-primary" 
                                            style={{ padding: '8px 12px', borderRadius: '10px' }}
                                            onClick={() => handleBrowserPrint(o)}
                                            title="Print via Browser (Supports Duplex/Both Sides)"
                                          >
                                            <Printer size={14} /> Print (Browser)
                                          </button>
                                          <button 
                                            className="neo-btn neo-btn-danger" 
                                            style={{ padding: '8px 12px', borderRadius: '10px' }}
                                            onClick={() => handleUpdateStatus(o.id, 'Cancelled')}
                                          >
                                            <XCircle size={14} />
                                          </button>
                                        </>
                                      );
                                    }

                                    if (currentStatus === 'Printing') {
                                      return (
                                        <>
                                          {isWithin3Min && (
                                            <>
                                              <button 
                                                className="neo-btn" 
                                                style={{ padding: '8px 12px', borderRadius: '10px' }}
                                                onClick={() => handleSaveFile(o)}
                                                title="Download/Save File to PC"
                                              >
                                                <Download size={14} /> Save
                                              </button>
                                              <button 
                                                className="neo-btn neo-btn-primary" 
                                                style={{ padding: '8px 12px', borderRadius: '10px' }}
                                                onClick={() => handleBrowserPrint(o)}
                                                title={`Reprint (${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')})`}
                                              >
                                                <Printer size={14} /> Reprint
                                              </button>
                                            </>
                                          )}
                                          <button 
                                            className="neo-btn neo-btn-success" 
                                            style={{ padding: '8px 12px', borderRadius: '10px' }}
                                            onClick={() => handleUpdateStatus(o.id, 'Completed')}
                                          >
                                            <CheckCircle size={14} /> Done
                                          </button>
                                        </>
                                      );
                                    }

                                    return null;
                                  })()}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* SAVED BROWSER HISTORY TAB */}
              {activeTab === 'history' && (
                <div className="neo-card" style={{ padding: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '0 10px' }}>
                    <div>
                      <h3 style={{ margin: 0 }}>Saved Order History</h3>
                      <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: '2px 0 0 0' }}>Stored in your browser (Active queue resets daily at 12 AM)</p>
                    </div>
                    <button 
                      className="neo-btn neo-btn-danger" 
                      onClick={() => {
                        if (window.confirm('Clear local browser order history?')) {
                          localStorage.removeItem(`orders_history_${shopId}`);
                          fetchData();
                        }
                      }} 
                      style={{ padding: '6px 12px', borderRadius: '10px', fontSize: '0.8rem' }}
                    >
                      Clear History
                    </button>
                  </div>

                  {getLocalOrderHistory().length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                      No saved order history in this browser yet.
                    </div>
                  ) : (
                    <div className="neo-table-wrapper">
                      <table className="neo-table">
                        <thead>
                          <tr>
                            <th>Order ID</th>
                            <th>Details</th>
                            <th>Pricing</th>
                            <th>Date / Time</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getLocalOrderHistory().map((o) => (
                            <tr key={o.id}>
                              <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{o.id}</td>
                              <td>
                                <div style={{ fontWeight: 600, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={getOrderDisplayName(o)}>
                                  {getOrderDisplayName(o)}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                  {(o.pages_to_print || 0)} pages • {(o.print_type || 'bw').toUpperCase()} • {o.paper_size || 'A4'} • {o.duplex ? 'Double Sided' : 'Single Sided'}
                                </div>
                              </td>
                              <td style={{ fontWeight: 700, color: 'var(--accent-color)' }}>
                                ₹{(o.total_amount || 0)}
                              </td>
                              <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                {o.created_at ? new Date(o.created_at).toLocaleString() : 'N/A'}
                              </td>
                              <td>
                                <span className={`status-badge status-${(o.status || 'Pending').toLowerCase()}`}>
                                  {(o.status || 'Pending')}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* HOW TO USE TAB */}
              {activeTab === 'guide' && (
                <div className="neo-card">
                  <h2>How to Use the QR Print Platform</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
                    <div style={{ display: 'flex', gap: '15px' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>1</div>
                      <div>
                        <h4>Share Your Shop QR Code</h4>
                        <p style={{ fontSize: '0.9rem', marginTop: '4px' }}>
                          Download the <strong>Shop Checkout QR Code</strong> from the left panel and print it out. Place it at your counter or desk where customers can scan it.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>2</div>
                      <div>
                        <h4>Customer Uploads Document</h4>
                        <p style={{ fontSize: '0.9rem', marginTop: '4px' }}>
                          Customers scan the QR code using their phones. They can upload files (PDF or images) and choose print preferences: color/grayscale, double-sided, page counts, or specific pages (like odd pages only).
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>3</div>
                      <div>
                        <h4>Click Print in Live Queue</h4>
                        <p style={{ fontSize: '0.9rem', marginTop: '4px' }}>
                          Once submitted, the order will chime and appear instantly in your <strong>Live Print Queue</strong> tab. Click the <strong>"Print (Browser)"</strong> button on the order card.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>4</div>
                      <div>
                        <h4>Confirm & Run Print Dialog</h4>
                        <p style={{ fontSize: '0.9rem', marginTop: '4px' }}>
                          A hidden iframe loads the document and opens the browser's native print preview dialog. Your paper size and color preferences are read automatically. Verify your printer is selected, toggle double-sided printing if needed, and click <strong>"Print"</strong>!
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>5</div>
                      <div>
                        <h4>Open Automatically on PC Startup (Optional)</h4>
                        <p style={{ fontSize: '0.9rem', marginTop: '4px', marginBottom: '10px' }}>
                          If you want this dashboard to open automatically every time you turn on your shop's computer, download and run the startup script below.
                        </p>
                        <button className="neo-btn" style={{ padding: '8px 15px', borderRadius: '10px', fontSize: '0.9rem', background: 'var(--accent-light)', color: 'var(--accent-color)', border: '1px solid var(--accent-color)' }} onClick={handleDownloadStartupScript}>
                           Download Auto-Startup Script
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
