import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GlobalConfirmModal } from './components/GlobalConfirmModal';
import LoadingSpinner from './components/LoadingSpinner';
import { Toaster } from 'react-hot-toast';

const Home = lazy(() => import('./pages/Home'));
const AdminLayout = lazy(() => import('./pages/Admin/AdminLayout'));
const Dashboard = lazy(() => import('./pages/Admin/Dashboard'));
const Finance = lazy(() => import('./pages/Admin/Finance'));
const OrderManager = lazy(() => import('./pages/Admin/OrderManager'));
const Receivables = lazy(() => import('./pages/Admin/Receivables'));
const TenantSettings = lazy(() => import('./pages/Admin/TenantSettings'));
const SaasManager = lazy(() => import('./pages/SaasManager'));
const ServiceOrdersManager = lazy(() => import('./pages/Admin/ServiceOrdersManager'));
const SubscriptionsManager = lazy(() => import('./pages/Admin/SubscriptionsManager'));
const Integrations = lazy(() => import('./pages/Admin/Integrations'));
const StockManager = lazy(() => import('./pages/Admin/StockManager'));
const Agenda = lazy(() => import('./pages/Admin/Agenda'));
const Reports = lazy(() => import('./pages/Admin/Reports'));
const CustomerPortal = lazy(() => import('./pages/CustomerPortal'));
const PermissionsManager = lazy(() => import('./pages/Admin/PermissionsManager'));
const AuditLog = lazy(() => import('./pages/Admin/AuditLog'));
const BackupManager = lazy(() => import('./pages/Admin/BackupManager'));
const RegistrationsManager = lazy(() => import('./pages/Admin/RegistrationsManager'));

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
    <>
      <BrowserRouter basename={routerBaseName}>
        <Toaster />
        <GlobalConfirmModal />
        <Suspense fallback={<PageFallback />}>
          <Routes>
            {/* Redirect root to admin */}
            <Route path="/" element={<Home />} />
            
            <Route path="/admin/login" element={<Navigate to="/" replace />} />
            <Route path="/gestor-saas" element={<SaasManager />} />

            {/* Admin Routes */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="cadastros" element={<RegistrationsManager />} />
              <Route path="cadastrar-produto" element={<Navigate to="/admin/cadastros?tipo=novo-produto" replace />} />
              <Route path="produtos" element={<Navigate to="/admin/cadastros?tipo=produtos" replace />} />
              <Route path="clientes" element={<Navigate to="/admin/cadastros?tipo=clientes" replace />} />
              <Route path="servicos" element={<Navigate to="/admin/cadastros?tipo=servicos" replace />} />
              <Route path="ordens-servico" element={<ServiceOrdersManager />} />
              <Route path="financeiro" element={<Finance />} />
              <Route path="pedidos" element={<OrderManager />} />
              <Route path="cobrancas" element={<Receivables />} />
              <Route path="assinaturas" element={<SubscriptionsManager />} />
              <Route path="integracoes" element={<Integrations />} />
              <Route path="estoque" element={<StockManager />} />
              <Route path="fornecedores" element={<Navigate to="/admin/cadastros?tipo=fornecedores" replace />} />
              <Route path="agenda" element={<Agenda />} />
              <Route path="relatorios" element={<Reports />} />
              <Route path="permissoes" element={<PermissionsManager />} />
              <Route path="auditoria" element={<AuditLog />} />
              <Route path="backup" element={<BackupManager />} />
              <Route path="personalizar" element={<TenantSettings />} />
            </Route>

            <Route path="/acompanhar" element={<CustomerPortal />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </>
  );
}

export default App;
