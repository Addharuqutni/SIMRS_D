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

/** Wrap a page component with the RoleGuard */
function G({ children }: { children: React.ReactNode }) {
  return <RoleGuard>{children}</RoleGuard>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', color: '#64748b' }}>Memuat sistem SIMRS...</div>}>
          <Routes>
            {/* Login — public */}
            <Route path="/login" element={<LoginPage />} />

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
              <Route path="/registrasi" element={<G><RegistrasiList /></G>} />
              <Route path="/registrasi/baru" element={<G><RegistrasiBaru /></G>} />
              <Route path="/registrasi/:id" element={<G><RegistrasiBaru /></G>} />
              <Route path="/sep" element={<G><SepVClaim /></G>} />
              <Route path="/jadwal-dokter" element={<G><JadwalDokter /></G>} />
              <Route path="/antrean" element={<G><Antrean /></G>} />

              {/* Pelayanan Medis — Superadmin, Dokter, Perawat */}
              <Route path="/rawat-jalan" element={<G><RawatJalanList /></G>} />
              <Route path="/rawat-jalan/:id" element={<G><RawatJalanEMR /></G>} />
              <Route path="/rawat-inap" element={<G><RawatInapList /></G>} />
              <Route path="/igd" element={<G><IgdList /></G>} />
              <Route path="/dokter" element={<G><ListDokter /></G>} />
              <Route path="/rekam-medis" element={<G><RekamMedis /></G>} />

              {/* Penunjang — Superadmin, Dokter, Analis Lab, Perawat */}
              <Route path="/laboratorium" element={<G><Laboratorium /></G>} />
              <Route path="/radiologi" element={<G><Radiologi /></G>} />

              {/* Farmasi — Superadmin, Apoteker, Dokter (resep only) */}
              <Route path="/farmasi/resep" element={<G><FarmasiResep /></G>} />
              <Route path="/farmasi/stok" element={<G><FarmasiStok /></G>} />
              <Route path="/farmasi/alert" element={<G><AlertExpired /></G>} />

              {/* Keuangan — Superadmin, Kasir / Billing */}
              <Route path="/billing" element={<G><BillingList /></G>} />
              <Route path="/billing/:id" element={<G><BillingDetail /></G>} />
              <Route path="/klaim-bpjs" element={<G><KlaimBpjs /></G>} />
              <Route path="/laporan-keuangan" element={<G><LaporanKeuangan /></G>} />

              {/* Pengaturan — Superadmin only */}
              <Route path="/users" element={<G><ManajemenUser /></G>} />
              <Route path="/master-data" element={<G><MasterData /></G>} />
              <Route path="/konfigurasi" element={<G><KonfigurasiSistem /></G>} />
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
