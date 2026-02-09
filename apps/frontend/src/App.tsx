import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CalculationProvider } from './context/CalculationContext';
import { Header } from './components/Header';
import { DashboardPage } from './pages/DashboardPage';
import { ResultsPage } from './pages/ResultsPage';

export function App() {
  return (
    <CalculationProvider>
      <BrowserRouter>
        <Header />
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/results" element={<ResultsPage />} />
        </Routes>
      </BrowserRouter>
    </CalculationProvider>
  );
}
