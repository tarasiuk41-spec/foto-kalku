"""
Zaawansowane Raportowanie (Excel i PDF) w Pythonie
Generowanie arkuszy XLSX i estetycznych raportów PDF z bilansu rocznego prosumenckiego.
"""

import os
from io import BytesIO
from typing import Optional
from datetime import datetime
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
try:
    from models import YearlySummary
except ImportError:
    from python.models import YearlySummary

def generate_excel_report(summary: YearlySummary, output_path: Optional[str] = None) -> bytes:
    """
    Generuje profesjonalny arkusz Excel (.xlsx) zawierający 12 miesięcy,
    współczynnik opustu 0.8, autokonsumpcję i sumy roczne.
    """
    wb = Workbook()
    ws = wb.active
    ws.title = f"Raport PV {summary.year}"

    # Stylistyka
    title_font = Font(name="Calibri", size=16, bold=True, color="1E3A8A")
    subtitle_font = Font(name="Calibri", size=10, italic=True, color="475569")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    data_font = Font(name="Calibri", size=10)
    total_font = Font(name="Calibri", size=11, bold=True, color="0F172A")

    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    summary_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

    thin_border = Border(
        left=Side(style='thin', color="E2E8F0"),
        right=Side(style='thin', color="E2E8F0"),
        top=Side(style='thin', color="E2E8F0"),
        bottom=Side(style='thin', color="E2E8F0")
    )
    total_border = Border(
        top=Side(style='medium', color="1E3A8A"),
        bottom=Side(style='double', color="1E3A8A")
    )

    # Nagłówek raportu
    ws.cell(row=1, column=1, value=f"Roczny Raport Energetyczny i Prosumencki - Rok {summary.year}").font = title_font
    ws.cell(row=2, column=1, value=f"Wygenerowano: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | Monitor PV").font = subtitle_font
    ws.row_dimensions[1].height = 25
    ws.row_dimensions[2].height = 18

    # Karty KPI
    kpis = [
        ("Produkcja Całkowita", f"{summary.total_production_kwh:,.1f} kWh"),
        ("Autokonsumpcja Średnia", f"{summary.avg_self_consumption_percent:.1f}%"),
        ("Oddano po opuście (0.8)", f"{summary.total_corrected_grid_08_kwh:,.1f} kWh"),
        ("Bilans Finansowy", f"{summary.total_financial_balance_pln:,.2f} PLN")
    ]
    for idx, (label, val) in enumerate(kpis, start=1):
        cell_lbl = ws.cell(row=4, column=idx * 2 - 1, value=label)
        cell_lbl.font = Font(name="Calibri", size=9, bold=True, color="64748B")
        cell_val = ws.cell(row=5, column=idx * 2 - 1, value=val)
        cell_val.font = Font(name="Calibri", size=13, bold=True, color="0F172A")

    # Tabela 12 miesięcy
    headers = [
        "Miesiąc", "Produkcja (kWh)", "Pobór 1.8.0 (kWh)", "Oddanie 2.8.0 (kWh)",
        "Oddanie po opuście 0.8 (kWh)", "Autokonsumpcja (kWh)", "Autokonsumpcja (%)",
        "Pokrycie (%)", "Bilans Sieci (kWh)", "Saldo Finansowe (PLN)"
    ]

    start_row = 7
    for col_idx, h in enumerate(headers, start=1):
        c = ws.cell(row=start_row, column=col_idx, value=h)
        c.font = header_font
        c.fill = header_fill
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = thin_border
    ws.row_dimensions[start_row].height = 28

    current_row = start_row + 1
    for idx, m in enumerate(summary.monthly_reports):
        row_values = [
            m.month_name,
            m.production_kwh,
            m.import_from_grid_kwh,
            m.export_to_grid_kwh,
            m.corrected_grid_energy_kwh,
            m.self_consumption_kwh,
            f"{m.self_consumption_percent:.1f}%",
            f"{m.coverage_percent:.1f}%",
            m.grid_balance_kwh,
            m.financial_balance_pln
        ]
        is_even = (idx % 2 == 0)
        for col_idx, val in enumerate(row_values, start=1):
            c = ws.cell(row=current_row, column=col_idx, value=val)
            c.font = data_font
            c.border = thin_border
            if is_even:
                c.fill = zebra_fill
            if col_idx == 1:
                c.alignment = Alignment(horizontal="left")
            elif col_idx in [7, 8]:
                c.alignment = Alignment(horizontal="center")
            else:
                c.alignment = Alignment(horizontal="right")
        current_row += 1

    # Wiersz podsumowania (Total)
    totals_row = [
        "SUMA / ŚREDNIA",
        summary.total_production_kwh,
        summary.total_import_kwh,
        summary.total_export_kwh,
        summary.total_corrected_grid_08_kwh,
        summary.total_self_consumption_kwh,
        f"{summary.avg_self_consumption_percent:.1f}%",
        f"{summary.avg_coverage_percent:.1f}%",
        summary.total_grid_balance_kwh,
        summary.total_financial_balance_pln
    ]
    for col_idx, val in enumerate(totals_row, start=1):
        c = ws.cell(row=current_row, column=col_idx, value=val)
        c.font = total_font
        c.fill = summary_fill
        c.border = total_border
        if col_idx == 1:
            c.alignment = Alignment(horizontal="left")
        elif col_idx in [7, 8]:
            c.alignment = Alignment(horizontal="center")
        else:
            c.alignment = Alignment(horizontal="right")

    # Dostosuj szerokości kolumn
    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = col[0].column_letter
        ws.column_dimensions[col_letter].width = max(max_len + 3, 13)

    if output_path:
        wb.save(output_path)

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()

def generate_pdf_report(summary: YearlySummary, output_path: Optional[str] = None) -> bytes:
    """
    Generuje estetyczny raport PDF zawierający metryki, tabele i podsumowanie bilansu.
    """
    buf = BytesIO()
    doc = SimpleDocTemplate(
        output_path if output_path else buf,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'MainTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        textColor=colors.HexColor('#1E3A8A'),
        spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        textColor=colors.HexColor('#64748B'),
        spaceAfter=14
    )
    section_style = ParagraphStyle(
        'Section',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=10,
        spaceAfter=8
    )

    story = []

    # Nagłówek
    story.append(Paragraph(f"Roczny Raport Energetyczny - Rok {summary.year}", title_style))
    story.append(Paragraph(f"Aplikacja Monitor PV | Data raportu: {datetime.now().strftime('%d.%m.%Y %H:%M')}", subtitle_style))

    # Kafelki KPI podsumowania
    kpi_data = [
        [
            Paragraph("<b>PRODUKCJA PV</b>", subtitle_style),
            Paragraph("<b>AUTOKONSUMPCJA</b>", subtitle_style),
            Paragraph("<b>ODDANO (OPUST 0.8)</b>", subtitle_style),
            Paragraph("<b>SALDO FINANSOWE</b>", subtitle_style)
        ],
        [
            Paragraph(f"<b>{summary.total_production_kwh:,.1f} kWh</b>", title_style),
            Paragraph(f"<b>{summary.avg_self_consumption_percent:.1f}%</b>", title_style),
            Paragraph(f"<b>{summary.total_corrected_grid_08_kwh:,.1f} kWh</b>", title_style),
            Paragraph(f"<b>{summary.total_financial_balance_pln:,.2f} PLN</b>", title_style)
        ]
    ]
    kpi_table = Table(kpi_data, colWidths=[130, 130, 130, 130])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 14))

    # Tabela miesięczna
    story.append(Paragraph("Zestawienie Bilansu Miesiąc po Miesiącu (Net-metering)", section_style))

    table_data = [
        ["Miesiąc", "Prod.", "Pobór", "Oddano", "Oddano 0.8", "Autokons.", "AK %", "Bilans Sieci", "Saldo PLN"]
    ]

    for m in summary.monthly_reports:
        table_data.append([
            m.month_name,
            f"{m.production_kwh:.0f}",
            f"{m.import_from_grid_kwh:.0f}",
            f"{m.export_to_grid_kwh:.0f}",
            f"{m.corrected_grid_energy_kwh:.0f}",
            f"{m.self_consumption_kwh:.0f}",
            f"{m.self_consumption_percent:.0f}%",
            f"{m.grid_balance_kwh:+.0f}",
            f"{m.financial_balance_pln:+.1f}"
        ])

    # Wiersz podsumowania
    table_data.append([
        "SUMA",
        f"{summary.total_production_kwh:.0f}",
        f"{summary.total_import_kwh:.0f}",
        f"{summary.total_export_kwh:.0f}",
        f"{summary.total_corrected_grid_08_kwh:.0f}",
        f"{summary.total_self_consumption_kwh:.0f}",
        f"{summary.avg_self_consumption_percent:.0f}%",
        f"{summary.total_grid_balance_kwh:+.0f}",
        f"{summary.total_financial_balance_pln:+.1f}"
    ])

    report_table = Table(table_data, colWidths=[65, 55, 55, 55, 60, 58, 48, 65, 60])
    report_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E3A8A')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('ALIGN', (0, 1), (0, -1), 'LEFT'),
        ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#E2E8F0')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
    ]))

    story.append(report_table)
    story.append(Spacer(1, 12))

    # Notatka prawna / podatkowa
    note_text = (
        "<b>Wskaźniki dla celów archiwalnych / podatkowych:</b> Zgodnie z ustawą o OZE, "
        "rozliczenie w systemie opustów (net-metering) dla mikroinstalacji do 10 kWp odbywa się ze współczynnikiem ilościowym 1 do 0.8. "
        "Energia oddana i skorygowana stanowi magazyn wirtualny do wykorzystania w ciągu 12 miesięcy od daty wprowadzenia."
    )
    story.append(Paragraph(note_text, subtitle_style))

    doc.build(story)
    return buf.getvalue()
