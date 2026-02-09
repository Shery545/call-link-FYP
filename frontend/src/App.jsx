import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import CustomerView from './pages/CustomerView';
import KitchenView from './pages/KitchenView';
import AdminView from './pages/AdminView';
import { LayoutDashboard, UtensilsCrossed, ChefHat } from 'lucide-react';

const App = () => {
  return (
    <Router>
      {/* Navigation Bar (Floating at bottom) */}
      <nav className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white shadow-2xl rounded-full px-6 py-3 flex gap-8 z-50 border border-gray-200">
        <Link to="/" className="flex flex-col items-center text-gray-500 hover:text-orange-500 transition-colors">
          <UtensilsCrossed size={24} />
          <span className="text-xs font-medium">Order</span>
        </Link>
        <Link to="/kitchen" className="flex flex-col items-center text-gray-500 hover:text-orange-500 transition-colors">
          <ChefHat size={24} />
          <span className="text-xs font-medium">Kitchen</span>
        </Link>
        <Link to="/admin" className="flex flex-col items-center text-gray-500 hover:text-orange-500 transition-colors">
          <LayoutDashboard size={24} />
          <span className="text-xs font-medium">Admin</span>
        </Link>
      </nav>

      <Routes>
        <Route path="/" element={<CustomerView />} />
        <Route path="/kitchen" element={<KitchenView />} />
        <Route path="/admin" element={<AdminView />} />
      </Routes>
    </Router>
  );
};

export default App;