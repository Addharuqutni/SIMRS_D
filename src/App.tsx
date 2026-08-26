import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client';
import { AppLayout } from './components/layout';
import { LoginPage } from './pages/login/LoginPage';
import { RoleGuard } from './components/auth/RoleGuard';
import { useSession } from './lib/auth-client';

import React, { Suspense } from 'react';

// Lazy loaded pages for performance (Code Splitting)
const Dashboard = React.lazy(() => import('./pages/dashboard/Dashboard').then(m => ({ default: m.Dashboard })));
const NotifikasiPage = React.lazy(() => import('./pages/notifikasi/NotifikasiPage').then(m => ({ default: m.NotifikasiPage })));
const RegistrasiList = React.lazy(() => import('./pages/registrasi/RegistrasiList').then(m => ({ default: m.RegistrasiList })));
const RegistrasiBaru = React.lazy(() => import('./pages/registrasi/RegistrasiBaru').then(m => ({ default: m.RegistrasiBaru })));
const SepVClaim = React.lazy(() => import('./pages/registrasi/SepVClaim').then(m => ({ default: m.SepVClaim })));
const JadwalDokter = React.lazy(() => import('./pages/registrasi/JadwalDokter').then(m => ({ default: m.JadwalDokter })));
const Antrean = React.lazy(() => import('./pages/registrasi/Antrean').then(m => ({ default: m.Antrean })));
const RawatJalanList = React.lazy(() => import('./pages/rawat-jalan/RawatJalanList').then(m => ({ default: m.RawatJalanList })));
const RawatJalanEMR = React.lazy(() => import('./pages/rawat-jalan/RawatJalanEMR').then(m => ({ default: m.RawatJalanEMR })));
const RawatInapList = React.lazy(() => import('./pages/rawat-inap/RawatInapList').then(m => ({ default: m.RawatInapList })));
const IgdList = React.lazy(() => import('./pages/igd/IgdList').then(m => ({ default: m.IgdList })));
const ListDokter = React.lazy(() => import('./pages/pelayanan-medis/ListDokter').then(m => ({ default: m.ListDokter })));
const RekamMedis = React.lazy(() => import('./pages/rekam-medis/RekamMedis').then(m => ({ default: m.RekamMedis })));
const Laboratorium = React.lazy(() => import('./pages/penunjang/Laboratorium').then(m => ({ default: m.Laboratorium })));
const Radiologi = React.lazy(() => import('./pages/penunjang/Radiologi').then(m => ({ default: m.Radiologi })));
const FarmasiResep = React.lazy(() => import('./pages/farmasi/FarmasiResep').then(m => ({ default: m.FarmasiResep })));
const FarmasiStok = React.lazy(() => import('./pages/farmasi/FarmasiStok').then(m => ({ default: m.FarmasiStok })));
const AlertExpired = React.lazy(() => import('./pages/farmasi/AlertExpired').then(m => ({ default: m.AlertExpired })));
const BillingList = React.lazy(() => import('./pages/billing/BillingList').then(m => ({ default: m.BillingList })));
const BillingDetail = React.lazy(() => import('./pages/billing/BillingDetail').then(m => ({ default: m.BillingDetail })));
const KlaimBpjs = React.lazy(() => import('./pages/billing/KlaimBpjs').then(m => ({ default: m.KlaimBpjs })));
const LaporanKeuangan = React.lazy(() => import('./pages/billing/LaporanKeuangan').then(m => ({ default: m.LaporanKeuangan })));
const ManajemenUser = React.lazy(() => import('./pages/pengaturan/ManajemenUser').then(m => ({ default: m.ManajemenUser })));
const MasterData = React.lazy(() => import('./pages/pengaturan/MasterData').then(m => ({ default: m.MasterData })));
const KonfigurasiSistem = React.lazy(() => import('./pages/pengaturan/KonfigurasiSistem').then(m => ({ default: m.KonfigurasiSistem })));
const BridgingStatus = React.lazy(() => import('./pages/pengaturan/BridgingStatus').then(m => ({ default: m.BridgingStatus })));
const AuditTrail = React.lazy(() => import('./pages/pengaturan/AuditTrail').then(m => ({ default: m.AuditTrail })));
const DisplayBoard = React.lazy(() => import('./pages/display/DisplayBoard').then(m => ({ default: m.DisplayBoard })));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', color: '#64748b' }}>Memeriksa sesi...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', color: '#64748b' }}>Memuat sistem SIMRS...</div>}>
          <Routes>
            {/* Login — public */}
            <Route path="/login" element={<LoginPage />} />

            {/* Papan antrian kiosk — public, no app chrome */}
            <Route path="/display" element={<DisplayBoard />} />

            {/* Protected routes */}
            <Route element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              {/* Redirect root */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* Dashboard & Notifikasi — accessible to ALL roles */}
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/notifikasi" element={<NotifikasiPage />} />

              {/* Pendaftaran — Superadmin, Pendaftaran */}
              <Route path="/registrasi" element={<RoleGuard><RegistrasiList /></RoleGuard>} />
              <Route path="/registrasi/baru" element={<RoleGuard><RegistrasiBaru /></RoleGuard>} />
              <Route path="/registrasi/:id" element={<RoleGuard><RegistrasiBaru /></RoleGuard>} />
              <Route path="/sep" element={<RoleGuard><SepVClaim /></RoleGuard>} />
              <Route path="/jadwal-dokter" element={<RoleGuard><JadwalDokter /></RoleGuard>} />
              <Route path="/antrean" element={<RoleGuard><Antrean /></RoleGuard>} />

              {/* Pelayanan Medis — Superadmin, Dokter, Perawat */}
              <Route path="/rawat-jalan" element={<RoleGuard><RawatJalanList /></RoleGuard>} />
              <Route path="/rawat-jalan/:id" element={<RoleGuard><RawatJalanEMR /></RoleGuard>} />
              <Route path="/rawat-inap" element={<RoleGuard><RawatInapList /></RoleGuard>} />
              <Route path="/igd" element={<RoleGuard><IgdList /></RoleGuard>} />
              <Route path="/dokter" element={<RoleGuard><ListDokter /></RoleGuard>} />
              <Route path="/rekam-medis" element={<RoleGuard><RekamMedis /></RoleGuard>} />

              {/* Penunjang — Superadmin, Dokter, Analis Lab, Perawat */}
              <Route path="/laboratorium" element={<RoleGuard><Laboratorium /></RoleGuard>} />
              <Route path="/radiologi" element={<RoleGuard><Radiologi /></RoleGuard>} />

              {/* Farmasi — Superadmin, Apoteker, Dokter (resep only) */}
              <Route path="/farmasi/resep" element={<RoleGuard><FarmasiResep /></RoleGuard>} />
              <Route path="/farmasi/stok" element={<RoleGuard><FarmasiStok /></RoleGuard>} />
              <Route path="/farmasi/alert" element={<RoleGuard><AlertExpired /></RoleGuard>} />

              {/* Keuangan — Superadmin, Kasir / Billing */}
              <Route path="/billing" element={<RoleGuard><BillingList /></RoleGuard>} />
              <Route path="/billing/:id" element={<RoleGuard><BillingDetail /></RoleGuard>} />
              <Route path="/klaim-bpjs" element={<RoleGuard><KlaimBpjs /></RoleGuard>} />
              <Route path="/laporan-keuangan" element={<RoleGuard><LaporanKeuangan /></RoleGuard>} />

              {/* Pengaturan — Superadmin only */}
              <Route path="/users" element={<RoleGuard><ManajemenUser /></RoleGuard>} />
              <Route path="/master-data" element={<RoleGuard><MasterData /></RoleGuard>} />
              <Route path="/konfigurasi" element={<RoleGuard><KonfigurasiSistem /></RoleGuard>} />
              <Route path="/bridging-status" element={<RoleGuard><BridgingStatus /></RoleGuard>} />
              <Route path="/audit-trail" element={<RoleGuard><AuditTrail /></RoleGuard>} />
            </Route>

            {/* Catch all — redirect to login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
