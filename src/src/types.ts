export interface PVData {
  production: number;      // P
  importFromGrid: number;  // 1.8.0
  exportToGrid: number;    // 2.8.0
  pricePerKwh: number;     // PLN
}

export interface PVReport {
  selfConsumptionKw: number; // AK
  totalConsumptionKw: number; // Z
  selfConsumptionPercent: number;
  coveragePercent: number;
  savedAmount: number;
  energyBalance: number;
  financialBalance: number;
}
