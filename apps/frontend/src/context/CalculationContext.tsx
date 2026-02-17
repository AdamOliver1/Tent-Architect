import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { TentDimensions, Inventory, Scenario, Constraints } from '../types';
import { calculateFloorPlan, ApiError } from '../services/api';

interface CalculationState {
  tent: TentDimensions;
  inventory: Inventory | null;
  constraints: Constraints;
  results: Scenario[] | null;
  isLoading: boolean;
  error: string | null;
}

interface CalculationContextValue extends CalculationState {
  setTent: (tent: TentDimensions) => void;
  setInventory: (inventory: Inventory | null) => void;
  setConstraints: (constraints: Constraints) => void;
  calculate: () => Promise<boolean>;
  clearResults: () => void;
  clearError: () => void;
}

const defaultTent: TentDimensions = {
  length: 20,
  width: 10,
};

const defaultConstraints: Constraints = {
  minSetback: 0.08,
  maxSetback: 0.25,
  maxColumnGap: 0.39,
};

const defaultInventory: Inventory = {
  braces: [
    { length: 2.45, width: 1.22, quantity: 1000, color: '#2D5A4A' },
    { length: 2.0, width: 1.0, quantity: 1000, color: '#4A3272' },
    { length: 0.5, width: 2.0, quantity: 1000, color: '#8B4513' },
    { length: 0.6, width: 2.44, quantity: 1000, color: '#1B4F6B' },
    { length: 0.4, width: 2.0, quantity: 1000, color: '#D2691E' },
  ],
  rails: [
    { length: 1.0, quantity: 1000 },
    { length: 2.0, quantity: 1000 },
    { length: 3.0, quantity: 1000 },
    { length: 4.0, quantity: 1000 },
    { length: 5.0, quantity: 1000 },
    { length: 7.36, quantity: 1000 },
  ],
};

const CalculationContext = createContext<CalculationContextValue | null>(null);

export function CalculationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CalculationState>({
    tent: defaultTent,
    inventory: defaultInventory,
    constraints: defaultConstraints,
    results: null,
    isLoading: false,
    error: null,
  });

  const setTent = useCallback((tent: TentDimensions) => {
    setState((prev) => ({ ...prev, tent }));
  }, []);

  const setInventory = useCallback((inventory: Inventory | null) => {
    setState((prev) => ({ ...prev, inventory }));
  }, []);

  const setConstraints = useCallback((constraints: Constraints) => {
    setState((prev) => ({ ...prev, constraints }));
  }, []);

  const clearResults = useCallback(() => {
    setState((prev) => ({ ...prev, results: null, error: null }));
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const calculate = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await calculateFloorPlan({
        tent: state.tent,
        inventory: state.inventory || undefined,
        constraints: state.constraints,
      });

      setState((prev) => ({
        ...prev,
        results: response.scenarios,
        isLoading: false,
      }));
      return true;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'An unexpected error occurred';

      setState((prev) => ({
        ...prev,
        error: message,
        isLoading: false,
      }));
      return false;
    }
  }, [state.tent, state.inventory, state.constraints]);

  return (
    <CalculationContext.Provider
      value={{
        ...state,
        setTent,
        setInventory,
        setConstraints,
        calculate,
        clearResults,
        clearError,
      }}
    >
      {children}
    </CalculationContext.Provider>
  );
}

export function useCalculation(): CalculationContextValue {
  const context = useContext(CalculationContext);
  if (!context) {
    throw new Error('useCalculation must be used within CalculationProvider');
  }
  return context;
}
