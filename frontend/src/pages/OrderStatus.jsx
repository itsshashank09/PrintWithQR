import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Printer, CheckCircle, Clock, XCircle, FileText, 
  MapPin, Landmark, RefreshCw, AlertCircle
} from 'lucide-react';
import { supabase } from '../supabaseClient';

const OrderStatus = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOrderStatus = async () => {
    try {
      const { data: orderData, error: dbError } = await supabase
        .from('orders')
        .select('*, shops(*)')
        .eq('id', orderId)
        .single();

      if (dbError || !orderData) {
        throw new Error('Order not found.');
      }

      setOrder({
        ...orderData,
        shop: orderData.shops
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderStatus();

    const channel = supabase
      .channel(`order_${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`
        },
        (payload) => {
          setOrder(prev => prev ? { ...prev, status: payload.new.status } : null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <RefreshCw size={36} className="neo-upload-icon" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '20px' }}>
        <div className="neo-card" style={{ maxWidth: '440px', textAlign: 'center', padding: '40px' }}>
          <AlertCircle size={48} style={{ color: 'var(--danger-color)', marginBottom: '15px' }} />
          <h2>Order Not Found</h2>
          <p style={{ margin: '15px 0' }}>{error}</p>
          <button className="neo-btn neo-btn-primary" onClick={() => navigate('/')}>Home</button>
        </div>
      </div>
    );
  }

  const getStatusDetails = () => {
    switch (order.status) {
      case 'Pending':
        return {
          icon: <Clock size={40} style={{ color: 'var(--warning-color)' }} />,
          title: 'Order Pending',
          desc: 'Waiting at the counter. Show your Order ID to the shop owner, pay in cash, and they will start printing.'
        };
      case 'Printing':
        return {
          icon: <Printer size={40} style={{ color: 'var(--info-color)', animation: 'float 3s ease-in-out infinite' }} />,
          title: 'Printing Document',
          desc: 'Your file is currently printing on the shop printer. Please wait a moment.'
        };
      case 'Completed':
        return {
          icon: <CheckCircle size={40} style={{ color: 'var(--success-color)' }} />,
          title: 'Print Job Completed',
          desc: 'Your print order is completed. Collect your document from the counter.'
        };
      case 'Cancelled':
        return {
          icon: <XCircle size={40} style={{ color: 'var(--danger-color)' }} />,
          title: 'Order Cancelled',
          desc: 'This order was cancelled by the shop owner.'
        };
      default:
        return {
          icon: <Clock size={40} />,
          title: 'Unknown Status',
          desc: 'The status of this order is unknown.'
        };
    }
  };

  const statusInfo = getStatusDetails();

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '90vh', padding: '20px' }}>
      <div className="neo-card" style={{ width: '100%', maxWidth: '520px', padding: '40px 30px', textAlign: 'center' }}>
        
        {/* Logo and Shop Reference */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '25px', color: 'var(--text-secondary)' }}>
          <MapPin size={16} />
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{order.shop_name}</span>
        </div>

        {/* Dynamic Status Icon Container */}
        <div className="neo-card-inset" style={{ display: 'inline-flex', width: '90px', height: '90px', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', marginBottom: '25px' }}>
          {statusInfo.icon}
        </div>

        {/* Order Details Header */}
        <h2 style={{ fontSize: '1.75rem', marginBottom: '8px' }}>{statusInfo.title}</h2>
        
        {/* Large ID display */}
        <div className="neo-card-inset" style={{ padding: '12px 20px', margin: '20px auto', display: 'inline-block', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
            Print Order ID
          </span>
          <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-color)', fontFamily: 'monospace' }}>
            {order.id}
          </span>
        </div>

        {/* Status description */}
        <p style={{ fontSize: '0.95rem', marginBottom: '30px', padding: '0 10px' }}>
          {statusInfo.desc}
        </p>

        {/* Order details summary card */}
        {(() => {
          let fileNamesList = [];
          try {
            if (order.file_name && order.file_name.startsWith('[')) {
              fileNamesList = JSON.parse(order.file_name);
            } else {
              fileNamesList = [order.file_name];
            }
          } catch (e) {
            fileNamesList = [order.file_name];
          }

          return (
            <div className="neo-card-inset" style={{ padding: '20px', borderRadius: '15px', textAlign: 'left', marginBottom: '30px' }}>
              <h4 style={{ fontSize: '0.95rem', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={16} /> Order Details
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Files ({fileNamesList.length}):</span>
                  <span style={{ fontWeight: 600, textAlign: 'right', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {fileNamesList.join(', ')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Pages to print:</span>
                  <span style={{ fontWeight: 600 }}>{order.pages_to_print} page(s)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Print Color:</span>
                  <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    {order.print_type === 'color' ? 'Color' : 'B&W'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '5px' }}>
                  <span style={{ fontWeight: 700 }}>Total Amount:</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent-color)' }}>₹{order.total_amount}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Cash payment instruction */}
        {order.status === 'Pending' && (
          <div className="neo-card" style={{ padding: '15px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', background: 'var(--bg-color)' }}>
            <Landmark size={18} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Offline cash counter payment only</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderStatus;
