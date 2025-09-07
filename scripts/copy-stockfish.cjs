/* Copy a browser-friendly Stockfish build into public/stockfish
 * We pick the "lite-single" variant (single-threaded WASM) for widest
 * compatibility on GitHub Pages (no COOP/COEP needed).
 */
const fs = require('fs')
const path = require('path')

function pickFile(dir, pattern) {
  const files = fs.readdirSync(dir)
  const matches = files.filter(f => pattern.test(f)).sort()
  if (!matches.length) throw new Error(`No files matching ${pattern} in ${dir}`)
  return matches[0]
}

function main() {
  const srcDir = path.join(process.cwd(), 'node_modules', 'stockfish', 'src')
  const outDir = path.join(process.cwd(), 'public', 'stockfish')
  if (!fs.existsSync(srcDir)) throw new Error('stockfish/src not found. Did you install dependencies?')
  fs.mkdirSync(outDir, { recursive: true })

  const jsName = pickFile(srcDir, /stockfish-.*-lite-single-.*\.js$/)
  const wasmName = pickFile(srcDir, /stockfish-.*-lite-single-.*\.wasm$/)

  fs.copyFileSync(path.join(srcDir, jsName), path.join(outDir, 'stockfish.js'))
  fs.copyFileSync(path.join(srcDir, wasmName), path.join(outDir, 'stockfish.wasm'))

  console.log(`Copied Stockfish → public/stockfish (js=${jsName}, wasm=${wasmName})`)
}

try { main() } catch (e) { console.error(e.message); process.exit(1) }

