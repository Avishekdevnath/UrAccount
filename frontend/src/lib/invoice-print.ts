import type { Invoice } from "@/lib/api-types";

type PrintInvoiceParams = {
  invoice: Invoice;
  companyName: string;
  customerName: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(dateValue: string | null | undefined): string {
  if (!dateValue) {
    return "-";
  }

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatAmount(amount: string, currencyCode: string): string {
  const parsed = Number.parseFloat(amount);
  if (Number.isNaN(parsed)) {
    return amount;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsed);
}

function buildLineRows(invoice: Invoice): string {
  if (!invoice.lines.length) {
    return `
      <tr>
        <td colspan="4" class="empty-row">No line items</td>
      </tr>
    `;
  }

  return invoice.lines
    .map((line) => {
      const qty = Number.parseFloat(line.quantity);
      const unit = Number.parseFloat(line.unit_price);
      const total = Number.parseFloat(line.line_total);

      return `
        <tr>
          <td>${escapeHtml(line.description || "-")}</td>
          <td class="num">${Number.isNaN(qty) ? escapeHtml(line.quantity) : qty.toFixed(2)}</td>
          <td class="num">${Number.isNaN(unit) ? escapeHtml(line.unit_price) : unit.toFixed(2)}</td>
          <td class="num">${Number.isNaN(total) ? escapeHtml(line.line_total) : total.toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");
}

function buildInvoiceHtml({ invoice, companyName, customerName }: PrintInvoiceParams): string {
  const safeCompanyName = escapeHtml(companyName);
  const safeCustomerName = escapeHtml(customerName);
  const safeStatus = escapeHtml(invoice.status.toUpperCase());
  const safeNotes = escapeHtml(invoice.notes || "-");

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Invoice ${invoice.invoice_no ? `#${invoice.invoice_no}` : ""}</title>
    <style>
      :root {
        --text: #0f172a;
        --muted: #475569;
        --line: #dbe2ea;
        --soft: #f8fafc;
        --accent: #1d4ed8;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 24px;
        color: var(--text);
        background: #ffffff;
        font-family: "Segoe UI", Roboto, Arial, sans-serif;
        line-height: 1.35;
      }
      .wrap {
        max-width: 860px;
        margin: 0 auto;
      }
      .header {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        padding-bottom: 16px;
        border-bottom: 2px solid var(--line);
      }
      .title {
        margin: 0;
        font-size: 28px;
        letter-spacing: 0.04em;
      }
      .subtitle {
        margin: 6px 0 0;
        color: var(--muted);
      }
      .meta {
        min-width: 280px;
      }
      .meta-table {
        width: 100%;
        border-collapse: collapse;
      }
      .meta-table td {
        padding: 4px 0;
        font-size: 14px;
      }
      .meta-table td:first-child {
        color: var(--muted);
        width: 120px;
      }
      .section {
        margin-top: 18px;
      }
      .section h3 {
        margin: 0 0 8px;
        color: var(--muted);
        font-size: 14px;
        letter-spacing: 0.04em;
      }
      .section .card {
        border: 1px solid var(--line);
        background: var(--soft);
        border-radius: 8px;
        padding: 12px;
      }
      table.lines {
        width: 100%;
        border-collapse: collapse;
        margin-top: 6px;
      }
      .lines th, .lines td {
        border: 1px solid var(--line);
        padding: 8px 10px;
        font-size: 13px;
      }
      .lines th {
        background: var(--soft);
        color: var(--muted);
        text-align: left;
      }
      .lines .num {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .empty-row {
        text-align: center;
        color: var(--muted);
      }
      .totals {
        margin-top: 14px;
        margin-left: auto;
        width: 320px;
        border-collapse: collapse;
      }
      .totals td {
        padding: 6px 0;
        font-size: 14px;
      }
      .totals td:first-child {
        color: var(--muted);
      }
      .totals td:last-child {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .totals tr.total td {
        border-top: 1px solid var(--line);
        font-weight: 700;
        padding-top: 8px;
      }
      .footer {
        margin-top: 26px;
        border-top: 1px dashed var(--line);
        padding-top: 10px;
        color: var(--muted);
        font-size: 12px;
      }
      .status {
        color: var(--accent);
        font-weight: 600;
      }
      @media print {
        body {
          padding: 0;
        }
        .wrap {
          max-width: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header class="header">
        <div>
          <h1 class="title">INVOICE</h1>
          <p class="subtitle">${safeCompanyName}</p>
        </div>
        <div class="meta">
          <table class="meta-table">
            <tr><td>Invoice #</td><td>${invoice.invoice_no ? `#${invoice.invoice_no}` : "-"}</td></tr>
            <tr><td>Status</td><td><span class="status">${safeStatus}</span></td></tr>
            <tr><td>Issue Date</td><td>${formatDate(invoice.issue_date)}</td></tr>
            <tr><td>Due Date</td><td>${formatDate(invoice.due_date)}</td></tr>
            <tr><td>Currency</td><td>${escapeHtml(invoice.currency_code)}</td></tr>
          </table>
        </div>
      </header>

      <section class="section">
        <h3>BILL TO</h3>
        <div class="card">${safeCustomerName}</div>
      </section>

      <section class="section">
        <h3>LINE ITEMS</h3>
        <table class="lines">
          <thead>
            <tr>
              <th>Description</th>
              <th class="num">Qty</th>
              <th class="num">Unit Price</th>
              <th class="num">Line Total</th>
            </tr>
          </thead>
          <tbody>
            ${buildLineRows(invoice)}
          </tbody>
        </table>
      </section>

      <table class="totals">
        <tr><td>Subtotal</td><td>${formatAmount(invoice.subtotal, invoice.currency_code)}</td></tr>
        <tr><td>Tax</td><td>${formatAmount(invoice.tax_total, invoice.currency_code)}</td></tr>
        <tr class="total"><td>Total</td><td>${formatAmount(invoice.total, invoice.currency_code)}</td></tr>
        <tr><td>Paid</td><td>${formatAmount(invoice.amount_paid, invoice.currency_code)}</td></tr>
      </table>

      <section class="section">
        <h3>NOTES</h3>
        <div class="card">${safeNotes}</div>
      </section>

      <footer class="footer">
        Generated from URAccount invoice detail view.
      </footer>
    </div>
  </body>
</html>
  `;
}

function printWithHiddenIframe(html: string): boolean {
  try {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.right = "0";
    iframe.style.bottom = "0";

    document.body.appendChild(iframe);

    const frameWindow = iframe.contentWindow;
    const frameDocument = frameWindow?.document;
    if (!frameWindow || !frameDocument) {
      iframe.remove();
      return false;
    }

    frameDocument.open();
    frameDocument.write(html);
    frameDocument.close();

    window.setTimeout(() => {
      frameWindow.focus();
      frameWindow.print();
      window.setTimeout(() => {
        iframe.remove();
      }, 200);
    }, 50);

    return true;
  } catch {
    return false;
  }
}

export function printInvoice(params: PrintInvoiceParams): boolean {
  const html = buildInvoiceHtml(params);
  return printWithHiddenIframe(html);
}
