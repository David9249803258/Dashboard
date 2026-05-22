import { useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import HealthModule from './modules/health';
import FinancesModule from './modules/finances';
import AppearanceModule from './modules/appearance';
import GoalsModule from './modules/goals';
import ProductivityModule from './modules/productivity';
import NutritionModule from './modules/nutrition';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-gray-950">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <TopBar onMenuClick={() => setSidebarOpen(true)} />

      <main className="lg:pl-56 pt-14">
        <div className="p-4 md:p-6 page-enter" key={pathname}>
          <Routes>
            <Route path="/"             element={<Dashboard />} />
            <Route path="/health/*"     element={<HealthModule />} />
            <Route path="/finances/*"   element={<FinancesModule />} />
            <Route path="/appearance/*" element={<AppearanceModule />} />
            <Route path="/goals/*"      element={<GoalsModule />} />
            <Route path="/productivity/*" element={<ProductivityModule />} />
            <Route path="/nutrition/*"  element={<NutritionModule />} />
            <Route path="/settings"     element={<Settings />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
