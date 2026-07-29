import Papa from "papaparse";

export interface ParseResult {
  emails: string[];
  duplicatesRemoved: number;
  invalidRemoved: number;
  total: number;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parse a CSV/TXT file for email addresses.
 * Handles:
 * - CSV files with header row (looks for column named 'email', 'Email', 'EMAIL', etc.)
 * - Plain text files with one email per line
 * - CSVs where first column is the email
 */
export async function parseEmailFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const allEmails: string[] = [];

        if (results.data.length > 0) {
          const headers = Object.keys(results.data[0] as Record<string, string>);
          
          // Find the email column
          const emailCol = headers.find(
            (h) =>
              h.toLowerCase() === "email" ||
              h.toLowerCase() === "email address" ||
              h.toLowerCase() === "emailaddress"
          );

          if (emailCol) {
            // Use the email column
            (results.data as Record<string, string>[]).forEach((row) => {
              const val = row[emailCol]?.trim();
              if (val) allEmails.push(val);
            });
          } else {
            // Fall back to first column
            (results.data as Record<string, string>[]).forEach((row) => {
              const firstVal = Object.values(row)[0]?.trim();
              if (firstVal) allEmails.push(firstVal);
            });
          }
        }

        // If no data from CSV parse, try line-by-line
        if (allEmails.length === 0) {
          const text = results.meta.delimiter
            ? results.data.map((r) => Object.values(r as Record<string, string>)[0]).join("\n")
            : "";
          text.split("\n").forEach((line) => {
            const trimmed = line.trim();
            if (trimmed) allEmails.push(trimmed);
          });
        }

        const total = allEmails.length;

        // Filter valid emails
        const validEmails = allEmails.filter((e) => EMAIL_REGEX.test(e.toLowerCase()));
        const invalidRemoved = total - validEmails.length;

        // Deduplicate
        const unique = [...new Set(validEmails.map((e) => e.toLowerCase()))];
        const duplicatesRemoved = validEmails.length - unique.length;

        resolve({
          emails: unique,
          duplicatesRemoved,
          invalidRemoved,
          total,
        });
      },
      error: (err) => reject(new Error(`CSV parse error: ${err.message}`)),
    });
  });
}

/**
 * Parse a plain text input where emails are separated by commas, semicolons, or newlines.
 */
export function parseEmailText(text: string): ParseResult {
  const parts = text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  const total = parts.length;

  const validEmails = parts.filter((e) => EMAIL_REGEX.test(e.toLowerCase()));
  const invalidRemoved = total - validEmails.length;

  const unique = [...new Set(validEmails.map((e) => e.toLowerCase()))];
  const duplicatesRemoved = validEmails.length - unique.length;

  return {
    emails: unique,
    duplicatesRemoved,
    invalidRemoved,
    total,
  };
}
