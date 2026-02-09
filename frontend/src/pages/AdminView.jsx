import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, ShoppingCart, TrendingUp, Lock } from 'lucide-react';

const AdminView = () => {
  const [orders, setOrders] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      fetch('http://localhost:8000/orders')
        .then(res => res.json())
        .then(data => setOrders(data));
    }
  }, [isAuthenticated]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (pin === "1234") { // <--- CHANGE YOUR PIN HERE
      setIsAuthenticated(true);
      setError("");
    } else {
      setError("Incorrect PIN. Access Denied.");
      setPin("");
    }
  };

  // --- LOGIN SCREEN (Shown if not authenticated) ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-sm text-center animate-in fade-in zoom-in duration-300">
          <div className="bg-orange-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Lock className="text-orange-600" size={32} />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-gray-800">Manager Access</h2>
          <p className="text-gray-500 mb-6 text-sm">Please enter your security PIN to view revenue data.</p>
          
          <form onSubmit={handleLogin}>
            <input 
              type="password" 
              className="w-full p-3 border-2 border-gray-200 rounded-lg mb-4 text-center text-2xl tracking-[0.5em] font-bold focus:border-orange-500 focus:outline-none transition-colors"
              placeholder="••••"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
            />
            
            {error && <p className="text-red-500 text-sm mb-4 font-medium">{error}</p>}
            
            <button 
              type="submit"
              className="w-full bg-orange-600 text-white p-3 rounded-lg font-bold hover:bg-orange-700 transition-colors shadow-lg shadow-orange-200"
            >
              Unlock Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- DASHBOARD (Shown only after login) ---
  const totalRevenue = orders.reduce((sum, order) => sum + (order.price), 0);
  const totalOrders = orders.length;
  
  const chartData = orders.map(order => ({
    name: order.item,
    price: order.price
  }));

  return (
    <div className="min-h-screen bg-gray-100 p-8 pb-24"> {/* Added padding bottom for nav */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">📊 Manager Dashboard</h1>
        <button 
          onClick={() => setIsAuthenticated(false)}
          className="text-sm text-red-600 hover:text-red-800 font-medium bg-red-50 px-4 py-2 rounded-lg"
        >
          Lock Screen
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-green-100 text-green-600 rounded-full">
            <DollarSign size={32} />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Total Revenue</p>
            <h2 className="text-3xl font-bold text-gray-800">₹{totalRevenue.toFixed(0)}</h2>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-blue-100 text-blue-600 rounded-full">
            <ShoppingCart size={32} />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Total Orders</p>
            <h2 className="text-3xl font-bold text-gray-800">{totalOrders}</h2>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-purple-100 text-purple-600 rounded-full">
            <TrendingUp size={32} />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Avg Order Value</p>
            <h2 className="text-3xl font-bold text-gray-800">
              ₹{totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(0) : "0"}
            </h2>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[400px]">
        <h3 className="text-xl font-semibold mb-6 text-gray-800">Real-time Sales Trend</h3>
        <ResponsiveContainer width="100%" height="85%">
          <BarChart data={chartData}>
            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              cursor={{ fill: '#f3f4f6' }}
            />
            <Bar dataKey="price" fill="#f97316" radius={[4, 4, 0, 0]} barSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AdminView;