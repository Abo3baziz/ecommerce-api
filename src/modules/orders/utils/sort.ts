export interface ParsedSort {
  field: string;
  direction: "asc" | "desc";
}

export function parseSort(sort: string): ParsedSort {
  const descending = sort.startsWith("-");
  const field = descending ? sort.slice(1) : sort;
  return { field, direction: descending ? "desc" : "asc" };
}
