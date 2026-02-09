import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, ShoppingCart, TrendingUp } from 'lucide-react';

const AdminView = () => {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    fetch('http://localhost:8000/orders')
      .then(res => res.json())
      .then(data => setOrders(data));
  }, []);

  // Calculate Metrics
  const totalRevenue = orders.reduce((sum, order) => sum + (order.price), 0);
  const totalOrders = orders.length;
  
  // Prepare Chart Data
  const chartData = orders.map(order => ({
    name: order.item,
    price: order.price
  }));

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">📊 Manager Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-4 bg-green-100 text-green-600 rounded-full">
            <DollarSign size={32} />
          </div>
          <div>
            <p className="text-gray-500">Total Revenue</p>
            <h2 className="text-2xl font-bold">${totalRevenue.toFixed(2)}</h2>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-4 bg-blue-100 text-blue-600 rounded-full">
            <ShoppingCart size={32} />
          </div>
          <div>
            <p className="text-gray-500">Total Orders</p>
            <h2 className="text-2xl font-bold">{totalOrders}</h2>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-4 bg-purple-100 text-purple-600 rounded-full">
            <TrendingUp size={32} />
          </div>
          <div>
            <p className="text-gray-500">Avg Order Value</p>
            <h2 className="text-2xl font-bold">
              ${totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : "0.00"}
            </h2>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm h-[400px]">
        <h3 className="text-xl font-semibold mb-4">Sales Trend</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="price" fill="#4f46e5" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AdminView;