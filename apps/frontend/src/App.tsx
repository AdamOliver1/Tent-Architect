import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CalculationProvider } from './context/CalculationContext';
import { DashboardPage } from './pages/DashboardPage';
import { ResultsPage } from './pages/ResultsPage';

export function App() {
  return (
    <CalculationProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/results" element={<ResultsPage />} />
        </Routes>
      </BrowserRouter>
    </CalculationProvider>
  );
}
