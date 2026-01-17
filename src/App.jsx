import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import { AuthProvider } from './context/AuthContext';
import Store from './pages/Store';
import LoginPage from './pages/LoginPage';
import AdminLogin from './pages/Admin/AdminLogin';
import AdminLayout from './pages/Admin/AdminLayout';
import Dashboard from './pages/Admin/Dashboard';
import ProductManager from './pages/Admin/ProductManager';
import CreateProduct from './pages/Admin/CreateProduct';
import Finance from './pages/Admin/Finance';
import OrderManager from './pages/Admin/OrderManager';
import AccountPage from './pages/AccountPage';
import ProductDetail from './pages/ProductDetail';
import { Toaster } from 'react-hot-toast';

import Checkout from './pages/Checkout';

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <BrowserRouter basename="/G-tec">
          <Toaster />
          <Routes>
            <Route path="/" element={<Store />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/admin/login" element={<AdminLogin />} />

            {/* Admin Routes */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="create-product" element={<CreateProduct />} />
              <Route path="products" element={<ProductManager />} />
              <Route path="finance" element={<Finance />} />
              <Route path="orders" element={<OrderManager />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </DataProvider>
    </AuthProvider>
  );
}

export default App;
