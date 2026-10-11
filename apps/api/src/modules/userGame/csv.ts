import { CsvChar } from "@/utils/enums";

// Minimal RFC 4180 CSV support for library import/export: quoted fields may
// contain commas, escaped quotes and newlines.

export const parseCSV = (content: string): Record<string, string>[] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const text = content.replace(/^﻿/, "");

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === CsvChar.Quote && text[i + 1] === CsvChar.Quote) {
        field += CsvChar.Quote;
        i++;
      } else if (char === CsvChar.Quote) {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === CsvChar.Quote) {
      inQuotes = true;
    } else if (char === CsvChar.Comma) {
      row.push(field);
      field = "";
    } else if (char === CsvChar.Newline || char === CsvChar.CarriageReturn) {
      if (char === CsvChar.CarriageReturn && text[i + 1] === CsvChar.Newline) i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((value) => value.trim() !== ""));
  if (nonEmpty.length < 2) return [];

  const headers = nonEmpty[0].map((h) => h.trim());

  return nonEmpty
    .slice(1)
    .map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, (values[index] ?? "").trim()])),
    );
};

const escapeCsvField = (field: unknown): string => {
  if (field === null || field === undefined) return "";
  let str = String(field);

  // Neutralise spreadsheet formulas (CSV injection) in free-text fields
  if (typeof field === "string" && /^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const toCSV = (headers: string[], rows: Record<string, unknown>[]): string =>
  [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvField(row[header])).join(",")),
  ].join("\n") + "\n";
