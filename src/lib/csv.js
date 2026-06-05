// ============================================================
// Tiny CSV import/export. Handles quoted fields, commas, and
// newlines inside quotes — enough for real-world pasted data
// without pulling in a parsing library.
// ============================================================

/** Parse CSV text into an array of string-arrays (rows of cells). */
export function parseCSV(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cell += '"'
          i++ // escaped quote
        } else {
          inQuotes = false
        }
      } else {
        cell += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += c
    }
  }
  // flush last cell/row if any content remains
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''))
}

/**
 * Map pasted rows → target objects. Accepts either:
 *  - a header row (we match columns by fuzzy name), or
 *  - no header (positional: Name, Email, Department, Lab, Research area, Hook).
 */
export function rowsToTargets(rows) {
  if (!rows.length) return []
  const headerLike = looksLikeHeader(rows[0])
  const cols = headerLike ? buildHeaderMap(rows[0]) : null
  const dataRows = headerLike ? rows.slice(1) : rows

  return dataRows.map((r) => {
    const get = (key, posIndex) => {
      if (cols && cols[key] != null) return (r[cols[key]] || '').trim()
      return (r[posIndex] || '').trim()
    }
    return {
      name: get('name', 0),
      email: get('email', 1),
      department: get('department', 2),
      lab: get('lab', 3),
      research_area: get('research_area', 4),
      hook: get('hook', 5),
    }
  }).filter((t) => t.name) // a target with no name is noise
}

function looksLikeHeader(row) {
  const joined = row.join(' ').toLowerCase()
  if (/@/.test(joined)) return false // an email address means this is real data
  // Require SEVERAL column-name tokens — a single stray word like a lab name
  // ("Healy Lab") in a real first row must NOT be mistaken for a header.
  const tokens = ['name', 'email', 'e-mail', 'dept', 'department', 'lab', 'hook', 'research', 'area', 'field', 'channel', 'priority', 'note']
  const hits = tokens.filter((t) => joined.includes(t)).length
  return hits >= 2
}

function buildHeaderMap(header) {
  const map = {}
  header.forEach((h, i) => {
    const k = h.toLowerCase().trim()
    if (/name/.test(k) && map.name == null) map.name = i
    else if (/e.?mail/.test(k)) map.email = i
    else if (/dep|dept/.test(k)) map.department = i
    else if (/lab/.test(k)) map.lab = i
    else if (/research|area|field/.test(k)) map.research_area = i
    else if (/hook|personal|note/.test(k)) map.hook = i
  })
  return map
}

// ── Export ──────────────────────────────────────────────────
function esc(v) {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Build a CSV string from an array of objects + ordered column list. */
export function toCSV(objects, columns) {
  const header = columns.map((c) => esc(c.label)).join(',')
  const lines = objects.map((o) => columns.map((c) => esc(c.get(o))).join(','))
  return [header, ...lines].join('\n')
}

/** Trigger a browser download of text as a file. */
export function downloadFile(filename, text, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
