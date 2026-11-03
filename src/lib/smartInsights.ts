export interface MonthlyInsightData {
  month: number;
  year: number;
  production: number;          // kWh (PF)
  importFromGrid: number;      // kWh (1.8.0 delta)
  exportToGrid: number;        // kWh (2.8.0 delta)
  selfConsumptionKw: number;   // kWh (AK)
  selfConsumptionPercent: number; // %
  coveragePercent: number;     // %
  totalConsumptionKw: number;  // kWh (Z = AK + import)
  pricePerKwh: number;         // PLN
  gridBalance: number;         // kWh (export * 0.8 - import)
}

export interface SmartInsightResult {
  level: 'info' | 'success' | 'warning';
  title: string;
  message: string;
  badge: string;
  metrics: {
    exportedKwh: number;
    currentAkPercent: number;
    estimatedAkPercent: number;
    potentialSavingsPln: number;
    shiftableKwh: number;
  };
  actions: string[];
}

const MONTH_NAMES_GENITIVE = [
  "styczniu", "lutym", "marcu", "kwietniu", "maju", "czerwcu",
  "lipcu", "sierpniu", "wrześniu", "październiku", "listopadzie", "grudniu"
];

/**
 * Inteligentne Rekomendacje (Smart Energy Insights)
 * Dynamiczne generowanie wskazówek dla użytkownika na podstawie danych miesięcznych.
 */
export function generateSmartInsights(
  data: MonthlyInsightData,
  energyPrice: number,
  peakPowerKwp: number = 3.8
): SmartInsightResult {
  const monthName = MONTH_NAMES_GENITIVE[Math.max(0, Math.min(11, (data.month || 1) - 1))];
  const production = Math.max(0, data.production || 0);
  const exported = Math.max(0, data.exportToGrid || 0);
  const imported = Math.max(0, data.importFromGrid || 0);
  const akKw = Math.max(0, data.selfConsumptionKw || 0);
  const akPercent = production > 0 ? (akKw / production) * 100 : 0;
  const exportRatio = production > 0 ? (exported / production) : 0;
  const price = energyPrice > 0 ? energyPrice : 0.95;

  // Case 0: Brak danych lub zerowa produkcja (miesiące zimowe lub brak wpisu)
  if (production <= 0) {
    return {
      level: 'info',
      title: 'Brak generacji słonecznej',
      badge: 'Zima / Oczekiwanie',
      message: `W ${monthName} brak zarejestrowanej produkcji PV. W miesiącach zimowych warto skupić się na optymalizacji zużycia taryfowego (np. G12w) oraz redukcji poboru bazowego.`,
      metrics: {
        exportedKwh: 0,
        currentAkPercent: 0,
        estimatedAkPercent: 0,
        potentialSavingsPln: 0,
        shiftableKwh: 0,
      },
      actions: [
        'Wykorzystaj taryfę nocną/weekendową do ogrzewania domu i wody',
        'Sprawdź czy panele nie są zaśnieżone lub zabrudzone',
        'Rozważ programator czasowy dla urządzeń o dużym poborze'
      ]
    };
  }

  // Obliczenie potencjału przesunięcia obciążenia (CWU, pompa ciepła, ładowanie EV, zmywarka/pralka)
  // Szacujemy, że z oddanej do sieci energii użytkownik jest w stanie przenieść 35% - 50%
  // na godziny szczytowej generacji słonecznej (11:00 - 15:00).
  const shiftFactor = exported > 300 ? 0.45 : exported > 150 ? 0.40 : 0.35;
  const shiftableKwh = Math.round(exported * shiftFactor);

  // Nowa autokonsumpcja przy przesunięciu
  const newAkKw = akKw + shiftableKwh;
  const estimatedAkPercent = Math.min(95, Math.round((newAkKw / production) * 100));

  // W systemie net-metering (opust 0.8) oddając 1 kWh tracimy 20% (0.2 kWh) energii.
  // Jeśli użytkownik ma taryfę net-billing lub net-metering, zużywając prąd bezpośrednio
  // oszczędza pełną stawkę zakupu energii (np. opłaty dystrybucyjne ~0.40-0.50 zł lub stratę 20% w opuście + opłaty).
  // Szacunek dodatkowej korzyści: w net-metering 20% utraconej wartości + opłata dystrybucyjna zmienna = ~0.40 zł/kWh
  // lub przy pełnej autokonsumpcji unikanie opłat sieciowych. Użyjmy realnej formuły oszczędności:
  const unitSavingsPln = price * 0.35; // realna strata na oddaniu do sieci (dystrybucja + potrącenie 20%)
  const potentialSavingsPln = Math.round(shiftableKwh * unitSavingsPln);

  // Sprawdzenie kryteriów:
  // Próg oddania energii do sieci > 30% całkowitej produkcji
  if (exportRatio > 0.30 && exported >= 30) {
    const formattedExported = Math.round(exported);
    const formattedSavings = potentialSavingsPln > 0 ? potentialSavingsPln : Math.round(shiftableKwh * 0.3);

    return {
      level: 'warning',
      title: 'Możliwość zwiększenia autokonsumpcji',
      badge: 'Wysoki eksport do sieci',
      message: `W ${monthName} wyeksportowałeś ${formattedExported} kWh. Gdybyś przeniósł podgrzewanie CWU, uruchamianie pompy ciepła lub ładowanie EV na godziny 11:00–15:00, podniósłbyś autokonsumpcję do ~${estimatedAkPercent}%, oszczędzając dodatkowo ${formattedSavings} zł miesięcznie.`,
      metrics: {
        exportedKwh: formattedExported,
        currentAkPercent: Math.round(akPercent * 10) / 10,
        estimatedAkPercent: estimatedAkPercent,
        potentialSavingsPln: formattedSavings,
        shiftableKwh: shiftableKwh,
      },
      actions: [
        'Ustaw zegar grzałki bojlera CWU na okno 11:30 - 14:30',
        'Zaprogramuj pralkę, suszarkę i zmywarkę w godzinach południowych',
        'Podnoś zadaną temperaturę pompy ciepła w dzień (magazynowanie ciepła w buforze/podłodze)',
        'Rozważ stacjonarny magazyn energii (5-10 kWh) do absorpcji nadwyżek'
      ]
    };
  }

  // Jeśli autokonsumpcja jest bardzo wysoka (> 60%)
  if (akPercent >= 60) {
    return {
      level: 'success',
      title: 'Wzorowa autokonsumpcja',
      badge: 'Mistrz autokonsumpcji',
      message: `Świetny wynik w ${monthName}! Twoja autokonsumpcja wyniosła aż ${Math.round(akPercent)}%. Większość generowanego prądu zasila Twoje bieżące potrzeby, co maksymalizuje opłacalność instalacji PV i minimalizuje straty przesyłowe.`,
      metrics: {
        exportedKwh: Math.round(exported),
        currentAkPercent: Math.round(akPercent * 10) / 10,
        estimatedAkPercent: Math.round(akPercent),
        potentialSavingsPln: 0,
        shiftableKwh: 0,
      },
      actions: [
        'Utrzymuj nawyk uruchamiania urządzeń w godzinach pracy paneli',
        'Instalacja jest bardzo dobrze zwymiarowana do profilu zużycia domu'
      ]
    };
  }

  // Umiarkowany eksport (autokonsumpcja między 30% a 60%, eksport < 30%)
  return {
    level: 'info',
    title: 'Zrównoważony profil energetyczny',
    badge: 'Stabilna praca',
    message: `W ${monthName} autokonsumpcja wyniosła ${Math.round(akPercent)}% przy wyeksportowaniu ${Math.round(exported)} kWh. Profil zużycia jest zrównoważony, a nadwyżki zasilają Twój wirtualny magazyn w sieci (współczynnik 0.8).`,
    metrics: {
      exportedKwh: Math.round(exported),
      currentAkPercent: Math.round(akPercent * 10) / 10,
      estimatedAkPercent: Math.min(85, Math.round(akPercent + 15)),
      potentialSavingsPln: Math.round(exported * 0.2 * price),
      shiftableKwh: Math.round(exported * 0.3),
    },
    actions: [
      'W słoneczne dni przenieś część prania i zmywania na godziny 12:00-14:00',
      'Pamiętaj o regularnym czyszczeniu paneli przed sezonem wiosenno-letnim'
    ]
  };
}
