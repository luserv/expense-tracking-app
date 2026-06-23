/**
 * Generación del reporte PDF de un préstamo.
 * - Android: expo-print (printToFileAsync) + expo-sharing.
 * - Electron: printToPDF en el proceso principal (IPC) + guardar.
 * - Web puro: window.print.
 */
import { Platform } from 'react-native';
import type { Installment, Loan, Person } from './repo/types';

export function delayDays(dueDate: string, paidDate: string | null): number | null {
  if (!paidDate) return null;
  const ms = new Date(paidDate + 'T12:00:00').getTime() - new Date(dueDate + 'T12:00:00').getTime();
  return Math.round(ms / 86400000);
}

const money = (n: number) => '$' + n.toFixed(2);
const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
const isoToDisplay = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

export function buildLoanReportHtml(person: Person, loan: Loan, installments: Installment[]): string {
  const interest = loan.amount * (loan.interest_rate || 0) / 100;
  const total = loan.amount + interest;
  const paid = installments.reduce((s, i) => s + i.paid_amount, 0);
  const outstanding = Math.max(0, total - paid);
  const freqLabel = loan.frequency === 'weekly' ? 'Semanal' : loan.frequency === 'biweekly' ? 'Quincenal' : 'Mensual';

  const rows = installments.map(i => {
    const d = delayDays(i.due_date, i.paid_date);
    const status = i.paid_amount >= i.amount ? 'Saldada' : i.paid_amount > 0 ? 'Parcial' : 'Impaga';
    const statusColor = i.paid_amount >= i.amount ? '#16A34A' : i.paid_amount > 0 ? '#F59E0B' : '#9CA3AF';
    const delayTxt = d === null ? '—' : d > 0 ? `${d} día(s) tarde` : d < 0 ? `${-d} día(s) antes` : 'a tiempo';
    const delayColor = d === null ? '#9CA3AF' : d > 0 ? '#DC2626' : '#16A34A';
    return `<tr>
      <td>${i.number}</td>
      <td>${isoToDisplay(i.due_date)}</td>
      <td class="num">${money(i.amount)}</td>
      <td>${i.paid_date ? isoToDisplay(i.paid_date) : '—'}</td>
      <td class="num">${money(i.paid_amount)}</td>
      <td style="color:${statusColor};font-weight:600">${status}</td>
      <td style="color:${delayColor}">${delayTxt}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif; color: #111827; margin: 32px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .sub { color: #6B7280; font-size: 13px; margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 22px; }
    .box { border: 1px solid #E5E7EB; border-radius: 10px; padding: 12px; }
    .box .l { font-size: 11px; color: #6B7280; text-transform: uppercase; letter-spacing: .04em; }
    .box .v { font-size: 17px; font-weight: 700; margin-top: 3px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; background: #F9FAFB; color: #374151; padding: 8px; border-bottom: 2px solid #E5E7EB; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; }
    td { padding: 8px; border-bottom: 1px solid #F3F4F6; }
    .num { text-align: right; }
    .foot { margin-top: 18px; font-size: 11px; color: #9CA3AF; }
  </style></head><body>
    <h1>Reporte de préstamo</h1>
    <div class="sub">${esc(person.name)} · ${esc(loan.description)} · prestado el ${isoToDisplay(loan.date)}</div>
    <div class="grid">
      <div class="box"><div class="l">Capital</div><div class="v">${money(loan.amount)}</div></div>
      <div class="box"><div class="l">Interés (${loan.interest_rate || 0}%)</div><div class="v">${money(interest)}</div></div>
      <div class="box"><div class="l">Total a pagar</div><div class="v">${money(total)}</div></div>
      <div class="box"><div class="l">Saldo</div><div class="v" style="color:${outstanding > 0 ? '#DC2626' : '#16A34A'}">${money(outstanding)}</div></div>
    </div>
    <div class="sub">${installments.length} cuota(s) · frecuencia ${freqLabel} · abonado ${money(paid)}</div>
    <table>
      <thead><tr>
        <th>#</th><th>Vence</th><th class="num">Monto</th><th>Pagó</th>
        <th class="num">Abonado</th><th>Estado</th><th>Atraso</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="foot">Generado por Chiro · ${new Date().toLocaleString('es-ES')}</div>
  </body></html>`;
}

/** Genera y exporta el PDF del reporte según la plataforma. */
export async function exportLoanReport(html: string, baseName: string): Promise<void> {
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    const Print = require('expo-print');
    const Sharing = require('expo-sharing');
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: baseName, UTI: 'com.adobe.pdf' });
    }
    return;
  }

  // Electron / Web
  const w = window as any;
  if (w.electronReport?.savePdf) {
    const r = await w.electronReport.savePdf(html, baseName);
    if (r?.error) throw new Error(r.error);
    return;
  }
  // Fallback web: ventana de impresión del navegador.
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }
}
