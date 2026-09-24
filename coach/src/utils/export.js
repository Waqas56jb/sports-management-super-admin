/** Client-side exports. CSV downloads a real file; PDF opens a print-ready A4 document. */

function escapeCsv(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCsv(filename, columns, rows) {
  const header = columns.map((c) => escapeCsv(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => escapeCsv(c.value(r))).join(',')).join('\n');
  const blob = new Blob([`﻿${header}\n${body}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/** Renders a report in a new window and opens the browser's print dialog ("Save as PDF"). */
export function exportPdf({ title, subtitle, columns, rows, brand, footer, lang = 'en' }) {
  const win = window.open('', '_blank', 'width=960,height=720');
  if (!win) return false;
  const head = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('');
  const body = rows
    .map((r) => `<tr>${columns.map((c) => `<td>${escapeHtml(c.value(r))}</td>`).join('')}</tr>`)
    .join('');
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  body { font-family: Inter, system-ui, sans-serif; color: #0f172a; margin: 24px; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #079075; padding-bottom: 10px; margin-bottom: 18px; }
  h1 { font-size: 20px; margin: 0; }
  .sub { color: #475467; font-size: 12px; margin-top: 4px; }
  .brand { font-weight: 700; color: #079075; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; background: #f2f4f7; color: #344054; padding: 7px 8px; border-bottom: 1px solid #d0d5dd; }
  td { padding: 6px 8px; border-bottom: 1px solid #eaecf0; font-variant-numeric: tabular-nums; }
  tr:nth-child(even) td { background: #fafbfc; }
  footer { margin-top: 16px; font-size: 10px; color: #667085; }
</style></head><body>
<header><div><h1>${escapeHtml(title)}</h1><div class="sub">${escapeHtml(subtitle || '')}</div></div><div class="brand">${escapeHtml(brand)}</div></header>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
<footer>${escapeHtml(footer || '')}</footer>
</body></html>`;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
  return true;
}
