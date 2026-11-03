import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

export interface PVDataReading {
  year: number;
  month: number;
  production: number;
  meter180: number;
  meter280: number;
  pricePerKwh: number;
}

export interface MeterBaselineItem {
  year: number;
  baseline180: number;
  baseline280: number;
}

export interface PVReportMetrics {
  production: number;
  importFromGrid: number;
  exportToGrid: number;
  selfConsumptionKw: number;
  totalConsumptionKw: number;
  selfConsumptionPercent: number;
  coveragePercent: number;
  savedAmount: number;
  energyBalance: number;
  financialBalance: number;
  dailyAverage: number;
  correctedGridEnergy: number;
  gridBalance: number;
}

const MONTH_NAMES = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", 
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
];

/**
 * Eksport do Excel (XLSX) z kompletnym 12-miesięcznym zestawieniem
 */
export function exportYearlyExcel(
  readings: PVDataReading[],
  baselines: MeterBaselineItem[],
  calculateReportFn: (curr: PVDataReading, allReadings: PVDataReading[], yearBaselines: MeterBaselineItem[]) => PVReportMetrics,
  selectedYear: number,
  installationInfo = { name: 'Instalacja PV', peakKwp: 3.8 }
) {
  const wb = XLSX.utils.book_new();

  // 1. Arkusz: Zestawienie Miesięczne wybranego roku (12 miesięcy)
  const monthlyRows: any[] = [];
  let sumProd = 0;
  let sumImport = 0;
  let sumExport = 0;
  let sumAk = 0;
  let sumTotalCons = 0;
  let sumCorrected = 0;
  let sumGridBal = 0;
  let sumSaved = 0;
  let sumFinBal = 0;
  let activeMonthCount = 0;

  for (let m = 1; m <= 12; m++) {
    const reading = readings.find(r => r.year === selectedYear && r.month === m);
    const mName = MONTH_NAMES[m - 1];

    if (reading) {
      const rep = calculateReportFn(reading, readings, baselines);
      activeMonthCount++;
      sumProd += reading.production || 0;
      sumImport += rep.importFromGrid || 0;
      sumExport += rep.exportToGrid || 0;
      sumAk += rep.selfConsumptionKw || 0;
      sumTotalCons += rep.totalConsumptionKw || 0;
      sumCorrected += rep.correctedGridEnergy || 0;
      sumGridBal += rep.gridBalance || 0;
      sumSaved += rep.savedAmount || 0;
      sumFinBal += rep.financialBalance || 0;

      monthlyRows.push({
        'Miesiąc': mName,
        'Rok': selectedYear,
        'Produkcja Falownika (kWh)': Math.round((reading.production || 0) * 10) / 10,
        'Stan Licznika 1.8.0': Math.round((reading.meter180 || 0) * 10) / 10,
        'Stan Licznika 2.8.0': Math.round((reading.meter280 || 0) * 10) / 10,
        'Pobranie z Sieci (kWh)': Math.round(rep.importFromGrid * 10) / 10,
        'Oddanie do Sieci (kWh)': Math.round(rep.exportToGrid * 10) / 10,
        'Autokonsumpcja (kWh)': Math.round(rep.selfConsumptionKw * 10) / 10,
        'Autokonsumpcja (%)': (Math.round(rep.selfConsumptionPercent * 10) / 10) + '%',
        'Całkowite Zużycie Domu (kWh)': Math.round(rep.totalConsumptionKw * 10) / 10,
        'Pokrycie Potrzeb (%)': (Math.round(rep.coveragePercent * 10) / 10) + '%',
        'Energia z Magazynu Sieci (0.8)': Math.round(rep.correctedGridEnergy * 10) / 10,
        'Bilans Ilościowy Sieci (kWh)': Math.round(rep.gridBalance * 10) / 10,
        'Cena Energii (PLN/kWh)': reading.pricePerKwh,
        'Wartość Autokonsumpcji (PLN)': Math.round(rep.savedAmount * 100) / 100,
        'Realne Saldo Finansowe (PLN)': Math.round(rep.financialBalance * 100) / 100,
      });
    } else {
      monthlyRows.push({
        'Miesiąc': mName,
        'Rok': selectedYear,
        'Produkcja Falownika (kWh)': '-',
        'Stan Licznika 1.8.0': '-',
        'Stan Licznika 2.8.0': '-',
        'Pobranie z Sieci (kWh)': '-',
        'Oddanie do Sieci (kWh)': '-',
        'Autokonsumpcja (kWh)': '-',
        'Autokonsumpcja (%)': '-',
        'Całkowite Zużycie Domu (kWh)': '-',
        'Pokrycie Potrzeb (%)': '-',
        'Energia z Magazynu Sieci (0.8)': '-',
        'Bilans Ilościowy Sieci (kWh)': '-',
        'Cena Energii (PLN/kWh)': '-',
        'Wartość Autokonsumpcji (PLN)': '-',
        'Realne Saldo Finansowe (PLN)': '-',
      });
    }
  }

  // Wiersz podsumowania
  const avgAkPercent = sumProd > 0 ? (sumAk / sumProd) * 100 : 0;
  const avgCovPercent = sumTotalCons > 0 ? (sumAk / sumTotalCons) * 100 : 0;

  monthlyRows.push({
    'Miesiąc': 'PODSUMOWANIE ROKU',
    'Rok': selectedYear,
    'Produkcja Falownika (kWh)': Math.round(sumProd * 10) / 10,
    'Stan Licznika 1.8.0': '',
    'Stan Licznika 2.8.0': '',
    'Pobranie z Sieci (kWh)': Math.round(sumImport * 10) / 10,
    'Oddanie do Sieci (kWh)': Math.round(sumExport * 10) / 10,
    'Autokonsumpcja (kWh)': Math.round(sumAk * 10) / 10,
    'Autokonsumpcja (%)': (Math.round(avgAkPercent * 10) / 10) + '%',
    'Całkowite Zużycie Domu (kWh)': Math.round(sumTotalCons * 10) / 10,
    'Pokrycie Potrzeb (%)': (Math.round(avgCovPercent * 10) / 10) + '%',
    'Energia z Magazynu Sieci (0.8)': Math.round(sumCorrected * 10) / 10,
    'Bilans Ilościowy Sieci (kWh)': Math.round(sumGridBal * 10) / 10,
    'Cena Energii (PLN/kWh)': '-',
    'Wartość Autokonsumpcji (PLN)': Math.round(sumSaved * 100) / 100,
    'Realne Saldo Finansowe (PLN)': Math.round(sumFinBal * 100) / 100,
  });

  const wsMonthly = XLSX.utils.json_to_sheet(monthlyRows);
  XLSX.utils.book_append_sheet(wb, wsMonthly, `Zestawienie ${selectedYear}`);

  // 2. Arkusz: Historia wieloletnia
  const uniqueYears = Array.from(new Set(readings.map(r => r.year))).sort((a, b) => b - a);
  const yearlyData = uniqueYears.map(yr => {
    const yrReadings = readings.filter(r => r.year === yr);
    let p = 0, imp = 0, exp = 0, ak = 0, fin = 0, gBal = 0;
    yrReadings.forEach(r => {
      const rep = calculateReportFn(r, readings, baselines);
      p += r.production || 0;
      imp += rep.importFromGrid || 0;
      exp += rep.exportToGrid || 0;
      ak += rep.selfConsumptionKw || 0;
      fin += rep.financialBalance || 0;
      gBal += rep.gridBalance || 0;
    });
    return {
      'Rok': yr,
      'Liczba miesięcy': yrReadings.length,
      'Produkcja Roczna (kWh)': Math.round(p * 10) / 10,
      'Pobranie z Sieci (kWh)': Math.round(imp * 10) / 10,
      'Oddanie do Sieci (kWh)': Math.round(exp * 10) / 10,
      'Autokonsumpcja (kWh)': Math.round(ak * 10) / 10,
      'Średnia Autokonsumpcja (%)': (p > 0 ? Math.round((ak / p) * 1000) / 10 : 0) + '%',
      'Bilans Roczny (0.8) (kWh)': Math.round(gBal * 10) / 10,
      'Realne Saldo Roczne (PLN)': Math.round(fin * 100) / 100,
    };
  });

  if (yearlyData.length > 0) {
    const wsYearly = XLSX.utils.json_to_sheet(yearlyData);
    XLSX.utils.book_append_sheet(wb, wsYearly, 'Podsumowanie Wieloletnie');
  }

  // 3. Arkusz: Metadane instalacji i zasady
  const metaData = [
    { 'Parametr': 'Nazwa Instalacji', 'Wartość': installationInfo.name },
    { 'Parametr': 'Moc Zainstalowana (kWp)', 'Wartość': installationInfo.peakKwp },
    { 'Parametr': 'Model Rozliczenia', 'Wartość': 'Net-metering (opust 0.8 dla mikroinstalacji do 10 kW)' },
    { 'Parametr': 'Współczynnik opustu', 'Wartość': '0.80' },
    { 'Parametr': 'Wybrany Rok Raportu', 'Wartość': selectedYear },
    { 'Parametr': 'Data Wygenerowania', 'Wartość': new Date().toLocaleString('pl-PL') },
    { 'Parametr': 'System Analityczny', 'Wartość': 'Monitor PV - Smart Green Energy' },
  ];
  const wsMeta = XLSX.utils.json_to_sheet(metaData);
  XLSX.utils.book_append_sheet(wb, wsMeta, 'Metadane i Zasady');

  // Zapisz plik
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Raport_Roczny_PV_${selectedYear}_${dateStr}.xlsx`);
}

/**
 * Eksport do eleganckiego raportu PDF (jsPDF + autoTable)
 */
export async function exportYearlyPdf(
  readings: PVDataReading[],
  baselines: MeterBaselineItem[],
  calculateReportFn: (curr: PVDataReading, allReadings: PVDataReading[], yearBaselines: MeterBaselineItem[]) => PVReportMetrics,
  selectedYear: number,
  installationInfo = { name: 'Instalacja PV Dom', peakKwp: 3.8, location: 'Polska' },
  chartElementIds: string[] = []
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const dateStr = new Date().toLocaleDateString('pl-PL');
  const timeStr = new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

  // Pobierz dane dla wybranego roku
  const yearReadings = readings.filter(r => r.year === selectedYear).sort((a, b) => a.month - b.month);
  let totalProd = 0;
  let totalImport = 0;
  let totalExport = 0;
  let totalAk = 0;
  let totalSaved = 0;
  let totalFinBal = 0;
  let totalGridBal = 0;
  let totalCons = 0;

  yearReadings.forEach(r => {
    const rep = calculateReportFn(r, readings, baselines);
    totalProd += r.production || 0;
    totalImport += rep.importFromGrid || 0;
    totalExport += rep.exportToGrid || 0;
    totalAk += rep.selfConsumptionKw || 0;
    totalSaved += rep.savedAmount || 0;
    totalFinBal += rep.financialBalance || 0;
    totalGridBal += rep.gridBalance || 0;
    totalCons += rep.totalConsumptionKw || 0;
  });

  const avgAkPercent = totalProd > 0 ? (totalAk / totalProd) * 100 : 0;
  const avgCovPercent = totalCons > 0 ? (totalAk / totalCons) * 100 : 0;

  // ==========================================
  // STRONA 1: Nagłówek, KPI, Podsumowanie i Wykresy
  // ==========================================

  // Pasek nagłówkowy ciemny / szmaragdowy
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 42, 'F');

  // Akcent kolorystyczny zielony
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 42, 210, 2.5, 'F');

  // Tytuł
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`ROCZNY RAPORT ENERGETYCZNY ${selectedYear}`, 14, 20);

  // Podtytuł i metadane
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`MONITOR PV • Smart Green Energy Analytics • System rozliczeń: Net-metering 0.8`, 14, 28);
  doc.text(`Data wygenerowania: ${dateStr} ${timeStr} • Instalacja: ${installationInfo.name} (${installationInfo.peakKwp} kWp)`, 14, 34);

  // Badge w prawym górnym rogu
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(148, 12, 48, 20, 3, 3, 'F');
  doc.setTextColor(16, 185, 129);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('STATUS PROSUMENTA', 152, 19);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text(`${yearReadings.length}/12 MIESIĘCY`, 152, 27);

  // Karty KPI Podsumowania
  let startKpiY = 52;
  const cardW = 44;
  const cardH = 26;
  const gap = 4.5;
  const kpis = [
    { title: 'PRODUKCJA PV', value: `${totalProd.toFixed(1)} kWh`, color: [16, 185, 129] },
    { title: 'POBRANIE Z SIECI', value: `${totalImport.toFixed(1)} kWh`, color: [239, 68, 68] },
    { title: 'AUTOKONSUMPCJA', value: `${avgAkPercent.toFixed(1)}%`, sub: `${totalAk.toFixed(1)} kWh`, color: [16, 185, 129] },
    { title: 'SALDO FINANSOWE', value: `${totalFinBal >= 0 ? '+' : ''}${totalFinBal.toFixed(2)} PLN`, color: totalFinBal >= 0 ? [16, 185, 129] : [239, 68, 68] },
  ];

  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * (cardW + gap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, startKpiY, cardW, cardH, 2.5, 2.5, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.title, x + 3.5, startKpiY + 7);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, x + 3.5, startKpiY + 16);

    if (kpi.sub) {
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(kpi.sub, x + 3.5, startKpiY + 22);
    }
  });

  // Druga linia kart KPI (Bilans 0.8, Wartość oszczędności, Pokrycie potrzeb)
  startKpiY += cardH + 4;
  const kpis2 = [
    { title: 'BILANS ILOŚCIOWY (0.8)', value: `${totalGridBal >= 0 ? '+' : ''}${totalGridBal.toFixed(1)} kWh`, color: totalGridBal >= 0 ? [16, 185, 129] : [239, 68, 68] },
    { title: 'ODDANIE DO SIECI', value: `${totalExport.toFixed(1)} kWh`, color: [59, 130, 246] },
    { title: 'POKRYCIE POTRZEB', value: `${avgCovPercent.toFixed(1)}%`, sub: 'niezależność energetyczna', color: [59, 130, 246] },
    { title: 'OSZCZĘDNOŚĆ PV', value: `${totalSaved.toFixed(2)} PLN`, color: [217, 119, 6] },
  ];

  kpis2.forEach((kpi, idx) => {
    const x = 14 + idx * (cardW + gap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, startKpiY, cardW, cardH, 2.5, 2.5, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.title, x + 3.5, startKpiY + 7);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, x + 3.5, startKpiY + 16);

    if (kpi.sub) {
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(kpi.sub, x + 3.5, startKpiY + 22);
    }
  });

  // Przechwycenie wykresów z UI, jeśli dostępne
  let chartY = startKpiY + cardH + 8;
  let chartAdded = false;

  for (const id of chartElementIds) {
    const el = document.getElementById(id);
    if (el) {
      try {
        const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        const imgW = 182;
        const imgH = (canvas.height * imgW) / canvas.width;
        const maxH = 110;
        const finalH = Math.min(imgH, maxH);

        doc.setFillColor(241, 245, 249);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(51, 65, 85);
        doc.text('WIZUALIZACJA: CHARAKTERYSTYKA ROCZNA INSTALACJI', 14, chartY);

        doc.addImage(imgData, 'PNG', 14, chartY + 3, imgW, finalH);
        chartY += finalH + 10;
        chartAdded = true;
        break; // Jedno duże ujęcie na stronie 1
      } catch (err) {
        console.error('Błąd przechwytywania wykresu:', err);
      }
    }
  }

  // Wskazówka / Smart Insight podsumowujący na dole strony 1
  const insightBoxY = chartAdded ? Math.min(chartY + 2, 240) : 130;
  doc.setFillColor(240, 253, 244); // light green
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(14, insightBoxY, 182, 36, 3, 3, 'FD');

  doc.setTextColor(22, 101, 52);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('INTELIGENTNA WSKAZÓWKA EFEKTYWNOŚCI ENERGETYCZNEJ', 20, insightBoxY + 8);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const insightText = `W całym roku ${selectedYear} oddano do sieci łącznie ${totalExport.toFixed(0)} kWh. Średnia autokonsumpcja wyniosła ${avgAkPercent.toFixed(1)}%. W systemie opustów 0.8 przeniesienie dodatkowego obciążenia (ogrzewanie CWU, praca klimatyzacji/pomp ciepła, ładowanie pojazdów elektrycznych) na godziny słoneczne 11:00-15:00 pozwala zaoszczędzić kolejne setki złotych i uniknąć 20% potrącenia magazynowego przez OSD.`;
  const splitInsight = doc.splitTextToSize(insightText, 170);
  doc.text(splitInsight, 20, insightBoxY + 15);

  // Stopka strony 1
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Strona 1 z 2 • Wygenerowano przez Monitor PV • ${dateStr}`, 14, 288);

  // ==========================================
  // STRONA 2: Tabela Bilansu Prosumenckiego dla celów podatkowych i archiwalnych
  // ==========================================
  doc.addPage();

  // Nagłówek strony 2
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 24, 'F');
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 24, 210, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`SZCZEGÓŁOWY BILANS PROSUMENCKI – ROK ${selectedYear}`, 14, 15);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Zestawienie miesięczne do celów ewidencyjnych, podatkowych i weryfikacji faktur OSD (współczynnik 0.8)`, 14, 20);

  // Dane tabelaryczne
  const tableRows: any[] = [];
  for (let m = 1; m <= 12; m++) {
    const reading = readings.find(r => r.year === selectedYear && r.month === m);
    const mName = MONTH_NAMES[m - 1];
    if (reading) {
      const rep = calculateReportFn(reading, readings, baselines);
      tableRows.push([
        mName,
        reading.production.toFixed(1),
        reading.meter180.toFixed(1),
        reading.meter280.toFixed(1),
        rep.importFromGrid.toFixed(1),
        rep.exportToGrid.toFixed(1),
        rep.selfConsumptionKw.toFixed(1),
        `${rep.selfConsumptionPercent.toFixed(1)}%`,
        rep.correctedGridEnergy.toFixed(1),
        `${rep.gridBalance >= 0 ? '+' : ''}${rep.gridBalance.toFixed(1)}`,
        `${rep.financialBalance >= 0 ? '+' : ''}${rep.financialBalance.toFixed(2)} zł`
      ]);
    } else {
      tableRows.push([mName, '—', '—', '—', '—', '—', '—', '—', '—', '—', '—']);
    }
  }

  // Wiersz sumaryczny
  tableRows.push([
    'RAZEM',
    totalProd.toFixed(1),
    '—',
    '—',
    totalImport.toFixed(1),
    totalExport.toFixed(1),
    totalAk.toFixed(1),
    `${avgAkPercent.toFixed(1)}%`,
    (totalExport * 0.8).toFixed(1),
    `${totalGridBal >= 0 ? '+' : ''}${totalGridBal.toFixed(1)}`,
    `${totalFinBal >= 0 ? '+' : ''}${totalFinBal.toFixed(2)} zł`
  ]);

  autoTable(doc, {
    startY: 32,
    head: [[
      'Miesiąc', 
      'Prod. PV', 
      '1.8.0', 
      '2.8.0', 
      'Pobranie', 
      'Oddanie', 
      'Autokons.', 
      'AK %', 
      'Magazyn 0.8', 
      'Saldo kWh', 
      'Saldo PLN'
    ]],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7.2,
      textColor: [30, 41, 59],
      cellPadding: 2,
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'left', cellWidth: 20 },
      1: { halign: 'right' },
      2: { halign: 'right', textColor: [100, 116, 139] },
      3: { halign: 'right', textColor: [100, 116, 139] },
      4: { halign: 'right', textColor: [220, 38, 38] },
      5: { halign: 'right', textColor: [37, 99, 235] },
      6: { halign: 'right', textColor: [16, 185, 129] },
      7: { halign: 'center', fontStyle: 'bold' },
      8: { halign: 'right' },
      9: { halign: 'right', fontStyle: 'bold' },
      10: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      // Podświetlenie ostatniego wiersza (RAZEM)
      if (data.row.index === 12) {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.fontStyle = 'bold';
        if (data.column.index === 10) {
          data.cell.styles.textColor = totalFinBal >= 0 ? [16, 185, 129] : [220, 38, 38];
        }
      }
    }
  });

  // Notatki prawne i metodyka rozliczenia prosumenckiego
  const finalY = (doc as any).lastAutoTable?.finalY || 180;
  
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, finalY + 6, 182, 45, 2.5, 2.5, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('METODYKA I PODSTAWA PRAWNA ROZLICZENIA NET-METERING (OPUST 0.8):', 20, finalY + 14);

  doc.setFontSize(7.2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  const notes = [
    '1. Rozliczenie oparte na Ustawie o Odnawialnych Źródłach Energii (art. 4 ust. 1) dla mikroinstalacji do mocy 10 kWp.',
    '2. Współczynnik ilościowy 1 do 0.8: za każdą 1 kWh wprowadzoną do sieci (kod OBIS 2.8.0), prosument może bezpłatnie odebrać 0.8 kWh.',
    '3. Autokonsumpcja (AK) = Produkcja falownika pomniejszona o energię oddaną do sieci (2.8.0).',
    '4. Pobranie z sieci = Różnica stanów licznika dwukierunkowego (kod OBIS 1.8.0) w danym okresie rozliczeniowym.',
    '5. Saldo finansowe prezentuje realną wartość wygenerowanej energii z uwzględnieniem oszczędności autokonsumpcji oraz bilansu sieciowego.',
  ];
  notes.forEach((line, i) => {
    doc.text(line, 20, finalY + 20 + i * 5);
  });

  // Miejsce na podpis / akceptację
  doc.setDrawColor(203, 213, 225);
  doc.line(130, finalY + 68, 190, finalY + 68);
  doc.setFontSize(7);
  doc.text('Podpis / Zatwierdzenie Prosumenta', 135, finalY + 72);

  // Stopka strony 2
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Strona 2 z 2 • Dokument wygenerowany automatycznie • Monitor PV System`, 14, 288);

  // Zapis do pliku
  doc.save(`Raport_Roczny_PV_${selectedYear}_${dateStr.replace(/\./g, '-')}.pdf`);
}
