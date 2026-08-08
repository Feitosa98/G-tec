import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import { AuthProvider } from './context/AuthContext';
import Store from './pages/Store';
import LoadingSpinner from './components/LoadingSpinner';
import { Toaster } from 'react-hot-toast';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const AdminLogin = lazy(() => import('./pages/Admin/AdminLogin'));
const AdminLayout = lazy(() => import('./pages/Admin/AdminLayout'));
const Dashboard = lazy(() => import('./pages/Admin/Dashboard'));
const ProductManager = lazy(() => import('./pages/Admin/ProductManager'));
const CreateProduct = lazy(() => import('./pages/Admin/CreateProduct'));
const Finance = lazy(() => import('./pages/Admin/Finance'));
const OrderManager = lazy(() => import('./pages/Admin/OrderManager'));
const Receivables = lazy(() => import('./pages/Admin/Receivables'));
const TenantSettings = lazy(() => import('./pages/Admin/TenantSettings'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Checkout = lazy(() => import('./pages/Checkout'));

const PageFallback = () => (
  <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
    <LoadingSpinner size={56} color="var(--color-primary)" />
  </div>
);

function App() {
  const routerBaseName = import.meta.env.BASE_URL === '/'
    ? '/'
    : import.meta.env.BASE_URL.replace(/\/$/, '');

  return (
    <AuthProvider>
      <DataProvider>
        <BrowserRouter basename={routerBaseName}>
          <Toaster />
          <Suspense fallback={<PageFallback />}>
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
                <Route path="receivables" element={<Receivables />} />
                <Route path="settings" element={<TenantSettings />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </DataProvider>
    </AuthProvider>
  );
}

export default App;
