import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { DollarSign, ShoppingCart, TrendingUp, Lock } from 'lucide-react';

const AdminView = () => {
  const [orders, setOrders] = useState([]);
  const [calls, setCalls] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      fetch('http://localhost:8000/orders')
        .then(res => res.json())
        .then(data => setOrders(data));

      fetch('http://localhost:8000/calls')
        .then(res => res.json())
        .then(data => setCalls(data));
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

  // 1. Bar Chart Data (Revenue by Item)
  const itemRevenue = {};
  orders.forEach(o => { itemRevenue[o.item] = (itemRevenue[o.item] || 0) + o.price; });
  const barData = Object.keys(itemRevenue).map(key => ({ name: key, revenue: itemRevenue[key] }));

  // 2. Pie Chart Data (Order Status)
  const statusCounts = { pending: 0, completed: 0 };
  orders.forEach(o => { if (statusCounts[o.status] !== undefined) statusCounts[o.status]++; });
  const pieData = [
    { name: 'Pending', value: statusCounts.pending },
    { name: 'Completed', value: statusCounts.completed }
  ];
  const PIE_COLORS = ['#f97316', '#22c55e'];

  // 3. Line Chart Data (Timeline reverse chronologically)
  const lineData = [...orders].reverse().map(o => ({
    time: new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    price: o.price
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
            <h2 className="text-3xl font-bold text-gray-800">Rs. {totalRevenue.toFixed(0)}</h2>
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
              Rs. {totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(0) : "0"}
            </h2>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Bar Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[350px]">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Revenue by Item</h3>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={barData}>
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `Rs.${val}`} />
              <Tooltip cursor={{ fill: '#f3f4f6' }} />
              <Bar dataKey="revenue" fill="#f97316" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[350px]">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Order Status Distribution</h3>
          <ResponsiveContainer width="100%" height="85%">
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Line Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[350px] lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Sales Timeline</h3>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `Rs.${val}`} />
              <Tooltip />
              <Line type="monotone" dataKey="price" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* Call Logs Section */ }
  <div className="mt-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
    <h3 className="text-lg font-semibold mb-6 text-gray-800">Phone Call Logs</h3>
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="py-4 px-6 text-sm font-semibold text-gray-500 uppercase tracking-widest bg-gray-50 rounded-tl-lg">ID</th>
            <th className="py-4 px-6 text-sm font-semibold text-gray-500 uppercase tracking-widest bg-gray-50">Caller Phone</th>
            <th className="py-4 px-6 text-sm font-semibold text-gray-500 uppercase tracking-widest bg-gray-50">Time Connected</th>
            <th className="py-4 px-6 text-sm font-semibold text-gray-500 uppercase tracking-widest bg-gray-50 rounded-tr-lg">Twilio SID</th>
          </tr>
        </thead>
        <tbody>
          {calls.length === 0 ? (
            <tr>
              <td colSpan="4" className="py-8 text-center text-gray-400">No calls registered yet.</td>
            </tr>
          ) : (
            calls.map((c, idx) => (
              <tr key={c.id} className={`hover:bg-gray-50 transition-colors ${idx !== calls.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <td className="py-4 px-6 text-sm font-medium text-gray-900">#{c.id}</td>
                <td className="py-4 px-6 text-sm font-bold text-indigo-600">{c.caller_phone_number}</td>
                <td className="py-4 px-6 text-sm text-gray-500">{new Date(c.start_time).toLocaleString()}</td>
                <td className="py-4 px-6 text-xs text-gray-400 font-mono tracking-tighter">{c.call_sid}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
    </div >
  );
};

export default AdminView;