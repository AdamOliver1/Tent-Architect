import type { TentDimensions, Inventory, Scenario, Constraints } from '../types';

const API_BASE = '/api';

export interface CalculateRequest {
  tent: TentDimensions;
  inventory?: Inventory;
  constraints?: Constraints;
}

export interface CalculateResponse {
  scenarios: Scenario[];
  tent: TentDimensions;
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function calculateFloorPlan(
  request: CalculateRequest
): Promise<CalculateResponse> {
  const response = await fetch(`${API_BASE}/calculate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...request,
      inventory: request.inventory
        ? {
            ...request.inventory,
            braces: request.inventory.braces.map(({ color: _, ...rest }) => rest),
          }
        : undefined,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorData.message || `Request failed with status ${response.status}`
    );
  }

  return response.json();
}
