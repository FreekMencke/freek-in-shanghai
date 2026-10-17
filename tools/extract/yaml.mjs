// Minimal YAML writer for front matter: plain objects, arrays, strings, numbers, booleans and null.
// Multi-line strings become block scalars; everything else is a JSON-quoted scalar, which is valid YAML.

function scalar(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(String(value));
}

function isEmpty(value) {
  return (Array.isArray(value) && value.length === 0) || (value && typeof value === 'object' && !Object.keys(value).length);
}

function lines(value, indent) {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) {
    return value.flatMap(item => {
      if (item && typeof item === 'object' && !isEmpty(item)) {
        const [first, ...rest] = lines(item, indent + 2);
        return [`${pad}- ${first.trimStart()}`, ...rest];
      }
      return [`${pad}- ${isEmpty(item) ? JSON.stringify(item) : scalar(item)}`];
    });
  }
  return Object.entries(value).flatMap(([key, v]) => {
    if (typeof v === 'string' && v.includes('\n')) {
      return [`${pad}${key}: |-`, ...v.split('\n').map(l => (l ? `${pad}  ${l}` : ''))];
    }
    if (v && typeof v === 'object' && !isEmpty(v)) return [`${pad}${key}:`, ...lines(v, indent + 2)];
    return [`${pad}${key}: ${isEmpty(v) ? JSON.stringify(v) : scalar(v)}`];
  });
}

export function frontMatter(data) {
  return ['---', ...lines(data, 0), '---', ''].join('\n');
}
