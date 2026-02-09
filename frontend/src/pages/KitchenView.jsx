import React, { useEffect, useState } from 'react';
import { CheckCircle, Clock, ChefHat } from 'lucide-react';

const KitchenView = () => {
  const [orders, setOrders] = useState([]);

  const fetchOrders = async () => {
    try {
      const res = await fetch('http://localhost:8000/orders');
      const data = await res.json();
      setOrders(data);
    } catch (err) {
      console.error("Failed to fetch orders", err);
    }
  };

  // Poll every 2 seconds
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <header className="flex items-center gap-3 mb-8 border-b border-slate-700 pb-4">
        <ChefHat className="text-orange-500" size={32} />
        <h1 className="text-3xl font-bold">Kitchen Display System (KDS)</h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {orders.map((order) => (
          <div 
            key={order.id} 
            className="bg-slate-800 border-l-4 border-orange-500 rounded-lg p-6 shadow-lg animate-in fade-in slide-in-from-bottom-4"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="bg-slate-700 text-slate-300 px-3 py-1 rounded text-sm font-mono">
                #{order.id}
              </span>
              <span className="flex items-center gap-1 text-sm text-slate-400">
                <Clock size={14} />
                {new Date(order.created_at).toLocaleTimeString()}
              </span>
            </div>
            
            <div className="text-2xl font-bold text-white mb-2">
              {order.quantity}x <span className="text-orange-400">{order.item}</span>
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center">
              <span className="text-slate-400 capitalize">{order.status}</span>
              <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors">
                <CheckCircle size={18} /> Complete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KitchenView;