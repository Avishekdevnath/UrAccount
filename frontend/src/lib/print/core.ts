type PrintMetaItem = {
  label: string;
  value: string;
};

type PrintTableColumn = {
  label: string;
  align?: "left" | "right";
};

type PrintTableOptions = {
  title?: string;
  columns: PrintTableColumn[];
  rows: string[][];
  emptyText?: string;
};

type PrintMetricItem = {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
};

type BuildPrintPageOptions = {
  title: string;
  heading: string;
  subtitle?: string;
  meta?: PrintMetaItem[];
  sectionsHtml: string;
  footerText?: string;
};

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeText(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return escapeHtml(String(value));
}

export function formatDate(dateValue: string | null | undefined): string {
  if (!dateValue) {
    return "-";
  }

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return safeText(dateValue);
  }

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function formatNumber(
  value: string | number | null | undefined,
  minimumFractionDigits = 2,
  maximumFractionDigits = 2
): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return safeText(value);
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(parsed);
}

export function formatAmount(value: string | number | null | undefined, currencyCode: string): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return safeText(value);
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsed);
}

export function formatDocumentNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "-";
  }
  return `#${safeText(value)}`;
}

export function renderInfoCard(label: string, value: string): string {
  return `
    <section class="section">
      <h3>${safeText(label)}</h3>
      <div class="card">${safeText(value)}</div>
    </section>
  `;
}

export function renderKeyValueList(items: PrintMetaItem[], emphasizeLast = false): string {
  if (!items.length) {
    return "";
  }

  return `
    <table class="kv">
      <tbody>
        ${items
          .map((item, index) => {
            const rowClass = emphasizeLast && index === items.length - 1 ? "kv-emphasis" : "";
            return `
              <tr class="${rowClass}">
                <td>${safeText(item.label)}</td>
                <td>${safeText(item.value)}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

export function renderMetricGrid(metrics: PrintMetricItem[]): string {
  if (!metrics.length) {
    return "";
  }

  return `
    <section class="section">
      <div class="metric-grid">
        ${metrics
          .map((metric) => {
            const toneClass =
              metric.tone === "positive" ? "metric-value-positive" : metric.tone === "negative" ? "metric-value-negative" : "";
            return `
              <div class="metric-card">
                <p class="metric-label">${safeText(metric.label)}</p>
                <p class="metric-value ${toneClass}">${safeText(metric.value)}</p>
              </div>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

export function renderTable({ title, columns, rows, emptyText = "No data available" }: PrintTableOptions): string {
  const headers = columns
    .map((column) => {
      const className = column.align === "right" ? "num" : "";
      return `<th class="${className}">${safeText(column.label)}</th>`;
    })
    .join("");

  const bodyRows = rows.length
    ? rows
        .map((row) => {
          const cells = row
            .map((cell, index) => {
              const className = columns[index]?.align === "right" ? "num" : "";
              return `<td class="${className}">${safeText(cell)}</td>`;
            })
            .join("");
          return `<tr>${cells}</tr>`;
        })
        .join("")
    : `<tr><td colspan="${columns.length}" class="empty-row">${safeText(emptyText)}</td></tr>`;

  return `
    <section class="section">
      ${title ? `<h3>${safeText(title)}</h3>` : ""}
      <table class="print-table">
        <thead>
          <tr>${headers}</tr>
        </thead>
        <tbody>
          ${bodyRows}
        </tbody>
      </table>
    </section>
  `;
}

export function buildPrintPageHtml({
  title,
  heading,
  subtitle,
  meta = [],
  sectionsHtml,
  footerText = "Generated from URAccount",
}: BuildPrintPageOptions): string {
  const metaRows = meta
    .map((item) => `<tr><td>${safeText(item.label)}</td><td>${safeText(item.value)}</td></tr>`)
    .join("");

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeText(title)}</title>
    <style>
      :root {
        --text: #0f172a;
        --muted: #475569;
        --line: #dbe2ea;
        --soft: #f8fafc;
        --accent: #1d4ed8;
        --positive: #166534;
        --negative: #b91c1c;
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
        max-width: 900px;
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
      .card {
        border: 1px solid var(--line);
        background: var(--soft);
        border-radius: 8px;
        padding: 12px;
      }
      .print-table {
        width: 100%;
        border-collapse: collapse;
      }
      .print-table th,
      .print-table td {
        border: 1px solid var(--line);
        padding: 8px 10px;
        font-size: 13px;
      }
      .print-table th {
        background: var(--soft);
        color: var(--muted);
        text-align: left;
      }
      .print-table .num {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .kv {
        margin-top: 14px;
        margin-left: auto;
        width: 340px;
        border-collapse: collapse;
      }
      .kv td {
        padding: 6px 0;
        font-size: 14px;
      }
      .kv td:first-child {
        color: var(--muted);
      }
      .kv td:last-child {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .kv .kv-emphasis td {
        border-top: 1px solid var(--line);
        font-weight: 700;
        padding-top: 8px;
      }
      .metric-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .metric-card {
        border: 1px solid var(--line);
        background: var(--soft);
        border-radius: 8px;
        padding: 10px 12px;
      }
      .metric-label {
        margin: 0;
        color: var(--muted);
        font-size: 12px;
      }
      .metric-value {
        margin: 4px 0 0;
        font-size: 20px;
        font-weight: 700;
      }
      .metric-value-positive { color: var(--positive); }
      .metric-value-negative { color: var(--negative); }
      .empty-row {
        text-align: center;
        color: var(--muted);
      }
      .footer {
        margin-top: 26px;
        border-top: 1px dashed var(--line);
        padding-top: 10px;
        color: var(--muted);
        font-size: 12px;
      }
      @media print {
        body { padding: 0; }
        .wrap { max-width: none; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header class="header">
        <div>
          <h1 class="title">${safeText(heading)}</h1>
          ${subtitle ? `<p class="subtitle">${safeText(subtitle)}</p>` : ""}
        </div>
        ${
          metaRows
            ? `
          <div class="meta">
            <table class="meta-table">
              ${metaRows}
            </table>
          </div>
        `
            : ""
        }
      </header>
      ${sectionsHtml}
      <footer class="footer">${safeText(footerText)}</footer>
    </div>
  </body>
</html>
  `;
}

export function printHtml(html: string): boolean {
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
      }, 250);
    }, 60);

    return true;
  } catch {
    return false;
  }
}

