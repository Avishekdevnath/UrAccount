import type { Bill, Invoice, Receipt, VendorPayment } from "@/lib/api-types";
import {
  buildPrintPageHtml,
  formatAmount,
  formatDate,
  formatDocumentNumber,
  formatNumber,
  printHtml,
  renderInfoCard,
  renderKeyValueList,
  renderTable,
} from "@/lib/print/core";

type PrintInvoiceParams = {
  invoice: Invoice;
  companyName: string;
  customerName: string;
};

type PrintBillParams = {
  bill: Bill;
  companyName: string;
  vendorName: string;
};

type PrintReceiptParams = {
  receipt: Receipt;
  companyName: string;
  customerName: string;
  invoiceNumberById?: Record<string, string>;
};

type PrintVendorPaymentParams = {
  vendorPayment: VendorPayment;
  companyName: string;
  vendorName: string;
  billNumberById?: Record<string, string>;
};

function withHashNumber(value: number | null): string {
  if (value === null) {
    return "-";
  }
  return `#${value}`;
}

export function printInvoice({ invoice, companyName, customerName }: PrintInvoiceParams): boolean {
  const lineRows = invoice.lines.map((line) => [
    line.description || "-",
    formatNumber(line.quantity),
    formatNumber(line.unit_price),
    formatNumber(line.line_total),
  ]);

  const html = buildPrintPageHtml({
    title: `Invoice ${formatDocumentNumber(invoice.invoice_no)}`,
    heading: "INVOICE",
    subtitle: companyName,
    meta: [
      { label: "Invoice #", value: formatDocumentNumber(invoice.invoice_no) },
      { label: "Status", value: invoice.status.toUpperCase() },
      { label: "Issue Date", value: formatDate(invoice.issue_date) },
      { label: "Due Date", value: formatDate(invoice.due_date) },
      { label: "Currency", value: invoice.currency_code },
    ],
    sectionsHtml: [
      renderInfoCard("Bill To", customerName),
      renderTable({
        title: "Line Items",
        columns: [
          { label: "Description" },
          { label: "Qty", align: "right" },
          { label: "Unit Price", align: "right" },
          { label: "Line Total", align: "right" },
        ],
        rows: lineRows,
        emptyText: "No line items",
      }),
      renderKeyValueList(
        [
          { label: "Subtotal", value: formatAmount(invoice.subtotal, invoice.currency_code) },
          { label: "Tax", value: formatAmount(invoice.tax_total, invoice.currency_code) },
          { label: "Total", value: formatAmount(invoice.total, invoice.currency_code) },
          { label: "Paid", value: formatAmount(invoice.amount_paid, invoice.currency_code) },
        ],
        true
      ),
      renderInfoCard("Notes", invoice.notes || "-"),
    ].join(""),
    footerText: "Generated from URAccount invoice detail view.",
  });

  return printHtml(html);
}

export function printBill({ bill, companyName, vendorName }: PrintBillParams): boolean {
  const lineRows = bill.lines.map((line) => [
    line.description || "-",
    formatNumber(line.quantity),
    formatNumber(line.unit_cost),
    formatNumber(line.line_total),
  ]);

  const html = buildPrintPageHtml({
    title: `Bill ${formatDocumentNumber(bill.bill_no)}`,
    heading: "BILL",
    subtitle: companyName,
    meta: [
      { label: "Bill #", value: formatDocumentNumber(bill.bill_no) },
      { label: "Status", value: bill.status.toUpperCase() },
      { label: "Bill Date", value: formatDate(bill.bill_date) },
      { label: "Due Date", value: formatDate(bill.due_date) },
      { label: "Currency", value: bill.currency_code },
    ],
    sectionsHtml: [
      renderInfoCard("Vendor", vendorName),
      renderTable({
        title: "Line Items",
        columns: [
          { label: "Description" },
          { label: "Qty", align: "right" },
          { label: "Unit Cost", align: "right" },
          { label: "Line Total", align: "right" },
        ],
        rows: lineRows,
        emptyText: "No bill lines",
      }),
      renderKeyValueList(
        [
          { label: "Subtotal", value: formatAmount(bill.subtotal, bill.currency_code) },
          { label: "Tax", value: formatAmount(bill.tax_total, bill.currency_code) },
          { label: "Total", value: formatAmount(bill.total, bill.currency_code) },
          { label: "Paid", value: formatAmount(bill.amount_paid, bill.currency_code) },
        ],
        true
      ),
      renderInfoCard("Notes", bill.notes || "-"),
    ].join(""),
    footerText: "Generated from URAccount bill detail view.",
  });

  return printHtml(html);
}

export function printReceipt({
  receipt,
  companyName,
  customerName,
  invoiceNumberById = {},
}: PrintReceiptParams): boolean {
  const allocationRows = receipt.allocations.map((allocation) => {
    const invoiceLabel = invoiceNumberById[allocation.invoice] || allocation.invoice;
    return [invoiceLabel, formatAmount(allocation.amount, receipt.currency_code)];
  });

  const html = buildPrintPageHtml({
    title: `Receipt ${formatDocumentNumber(receipt.receipt_no)}`,
    heading: "RECEIPT",
    subtitle: companyName,
    meta: [
      { label: "Receipt #", value: formatDocumentNumber(receipt.receipt_no) },
      { label: "Status", value: receipt.status.toUpperCase() },
      { label: "Received Date", value: formatDate(receipt.received_date) },
      { label: "Currency", value: receipt.currency_code },
    ],
    sectionsHtml: [
      renderInfoCard("Received From", customerName),
      renderTable({
        title: "Allocations",
        columns: [
          { label: "Invoice" },
          { label: "Amount", align: "right" },
        ],
        rows: allocationRows,
        emptyText: "No allocations",
      }),
      renderKeyValueList(
        [{ label: "Receipt Amount", value: formatAmount(receipt.amount, receipt.currency_code) }],
        true
      ),
      renderInfoCard("Notes", receipt.notes || "-"),
    ].join(""),
    footerText: "Generated from URAccount receipt detail view.",
  });

  return printHtml(html);
}

export function printVendorPayment({
  vendorPayment,
  companyName,
  vendorName,
  billNumberById = {},
}: PrintVendorPaymentParams): boolean {
  const allocationRows = vendorPayment.allocations.map((allocation) => {
    const billLabel = billNumberById[allocation.bill] || allocation.bill;
    return [billLabel, formatAmount(allocation.amount, vendorPayment.currency_code)];
  });

  const html = buildPrintPageHtml({
    title: `Vendor Payment ${formatDocumentNumber(vendorPayment.payment_no)}`,
    heading: "VENDOR PAYMENT",
    subtitle: companyName,
    meta: [
      { label: "Payment #", value: withHashNumber(vendorPayment.payment_no) },
      { label: "Status", value: vendorPayment.status.toUpperCase() },
      { label: "Payment Date", value: formatDate(vendorPayment.paid_date) },
      { label: "Currency", value: vendorPayment.currency_code },
    ],
    sectionsHtml: [
      renderInfoCard("Vendor", vendorName),
      renderTable({
        title: "Bill Allocations",
        columns: [
          { label: "Bill" },
          { label: "Amount", align: "right" },
        ],
        rows: allocationRows,
        emptyText: "No allocations",
      }),
      renderKeyValueList(
        [{ label: "Payment Amount", value: formatAmount(vendorPayment.amount, vendorPayment.currency_code) }],
        true
      ),
      renderInfoCard("Notes", vendorPayment.notes || "-"),
    ].join(""),
    footerText: "Generated from URAccount vendor payment detail view.",
  });

  return printHtml(html);
}

