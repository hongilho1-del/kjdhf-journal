export type JournalContentBlock =
  | { type: "text"; content: string }
  | { type: "table"; headers: string[]; rows: string[][] };

function parseTableRow(line: string) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  return trimmed.slice(1, -1).split("|").map((cell) => cell.trim());
}

function isTableDivider(cells: string[] | null, columnCount: number) {
  return Boolean(cells && cells.length === columnCount && cells.every((cell) => /^:?-{3,}:?$/.test(cell)));
}

export function buildJournalTableTemplate(columnCount: number, bodyRowCount: number) {
  const columns = Math.min(8, Math.max(2, Math.trunc(columnCount)));
  const rows = Math.min(30, Math.max(1, Math.trunc(bodyRowCount)));
  const header = `| ${Array.from({ length: columns }, (_, index) => `제목 ${index + 1}`).join(" | ")} |`;
  const divider = `| ${Array.from({ length: columns }, () => "---").join(" | ")} |`;
  const body = Array.from({ length: rows }, () => `| ${Array.from({ length: columns }, () => "내용").join(" | ")} |`);
  return [header, divider, ...body].join("\n");
}

export function parseJournalContent(content: string): JournalContentBlock[] {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: JournalContentBlock[] = [];
  let textLines: string[] = [];

  const flushText = () => {
    const text = textLines.join("\n").trim();
    if (text) blocks.push({ type: "text", content: text });
    textLines = [];
  };

  for (let index = 0; index < lines.length;) {
    const headers = parseTableRow(lines[index]);
    const divider = index + 1 < lines.length ? parseTableRow(lines[index + 1]) : null;
    if (headers && headers.length >= 2 && isTableDivider(divider, headers.length)) {
      flushText();
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length) {
        const row = parseTableRow(lines[index]);
        if (!row || row.length !== headers.length) break;
        rows.push(row);
        index += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }
    textLines.push(lines[index]);
    index += 1;
  }

  flushText();
  return blocks;
}
