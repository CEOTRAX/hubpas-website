const fs = require('fs')
const vm = require('vm')

const html = fs.readFileSync('admin.html', 'utf8')

const openTag = '<script type="module">'
const start = html.indexOf(openTag)
if (start < 0) {
  console.error('Could not find <script type="module"> in admin.html')
  process.exit(1)
}

const scriptStart = html.indexOf('>', start) + 1
const end = html.indexOf('</script>', scriptStart)
if (end < 0) {
  console.error('Could not find closing </script> for module script in admin.html')
  process.exit(1)
}

const rawJs = html.slice(scriptStart, end)
const lines = rawJs.split(/\r?\n/)
const filteredLines = []

let skippingImport = false

for (const line of lines) {
  const trimmed = line.trim()
  if (!skippingImport && trimmed.startsWith('import ')) {
    skippingImport = true
    if (trimmed.includes(' from ') && (trimmed.endsWith('"') || trimmed.endsWith("'") || trimmed.endsWith(';'))) {
      skippingImport = false
    }
    continue
  }
  if (skippingImport) {
    if (trimmed.includes(' from ') && (trimmed.endsWith('"') || trimmed.endsWith("'") || trimmed.endsWith(';'))) {
      skippingImport = false
    }
    continue
  }
  filteredLines.push(line)
}

const js = filteredLines.join('\n')

try {
  new vm.Script(js, { filename: 'admin.html <module script>' })
  console.log('admin.html module script: parse OK')
} catch (e) {
  console.error('admin.html module script: parse FAILED')
  console.error(String(e && e.message ? e.message : e))
  if (e && e.stack) console.error(String(e.stack))

  const line = Number(e && e.lineNumber ? e.lineNumber : NaN)
  const column = Number(e && e.columnNumber ? e.columnNumber : NaN)
  let stackLine = NaN
  let stackColumn = NaN
  if (Number.isNaN(line) && e && e.stack) {
    const match = String(e.stack).match(/admin\.html <module script>:(\d+):(\d+)/)
    if (match) {
      stackLine = Number(match[1])
      stackColumn = Number(match[2])
    }
  }

  const bestLine = !Number.isNaN(line) ? line : stackLine
  const bestColumn = !Number.isNaN(column) ? column : stackColumn

  if (!Number.isNaN(bestLine)) {
    const from = Math.max(1, bestLine - 6)
    const to = Math.min(filteredLines.length, bestLine + 6)
    console.error(`Location: line ${bestLine}${Number.isNaN(bestColumn) ? '' : `, col ${bestColumn}`}`)
    for (let i = from; i <= to; i++) {
      console.error(String(i).padStart(6, ' ') + ' | ' + (filteredLines[i - 1] ?? ''))
    }
  }
  process.exit(2)
}
