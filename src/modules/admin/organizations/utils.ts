export function generateOrganizationCode(name: string): string {
  const trimmed = name.trim();
  const openParen = trimmed.indexOf('(');
  const closeParen = trimmed.lastIndexOf(')');

  if (openParen !== -1 && closeParen > openParen) {
    const namePart = trimmed.slice(0, openParen).trim();
    const suffix = trimmed.slice(closeParen + 1).trim();
    const acronym = namePart
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0]?.toUpperCase())
      .join('');
    return suffix ? `${acronym}-${suffix}` : acronym;
  }

  return trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase())
    .join('');
}
