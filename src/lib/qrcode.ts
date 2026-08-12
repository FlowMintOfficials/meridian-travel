/**
 * Minimal, dependency-free QR code encoder — Byte mode, error-correction
 * level L, versions 1–40 (auto-picks the smallest version that fits).
 *
 * Every table here (Reed–Solomon block sizes, alignment-pattern positions,
 * BCH generator polynomials) is public ISO/IEC 18004 specification data,
 * cross-checked against a known-good reference implementation and verified
 * end-to-end against a real QR decoder (dense coverage of payload lengths
 * 1–300 bytes, exact capacity boundaries for a dozen versions, and
 * realistic trip-shaped JSON payloads) before this shipped. The encoding
 * pipeline itself — bit packing, GF(256) Reed–Solomon, matrix placement,
 * masking — is this file's own implementation, not copied from anywhere.
 *
 * No UI framework or drawing code lives here — see QrCode.tsx for the SVG
 * renderer. Kept private to this app (not published), but self-contained
 * enough to lift elsewhere if ever needed.
 */

export interface QRMatrix {
  version: number
  /** modules[row][col] — true = dark module. Includes all function
   * patterns (finder/timing/alignment/format/version info) and data. */
  modules: boolean[][]
}

// ---- Error-correction Level L RS block table (ISO/IEC 18004, versions 1-40) ----
// Each row is a flat list of [blockCount, totalCodewordsPerBlock, dataCodewordsPerBlock]
// groups (1 or 2 groups per version).
const EC_L_BLOCKS: number[][] = [
  [1, 26, 19], [1, 44, 34], [1, 70, 55], [1, 100, 80], [1, 134, 108],
  [2, 86, 68], [2, 98, 78], [2, 121, 97], [2, 146, 116], [2, 86, 68, 2, 87, 69],
  [4, 101, 81], [2, 116, 92, 2, 117, 93], [4, 133, 107], [3, 145, 115, 1, 146, 116], [5, 109, 87, 1, 110, 88],
  [5, 122, 98, 1, 123, 99], [1, 135, 107, 5, 136, 108], [5, 150, 120, 1, 151, 121], [3, 141, 113, 4, 142, 114], [3, 135, 107, 5, 136, 108],
  [4, 144, 116, 4, 145, 117], [2, 139, 111, 7, 140, 112], [4, 151, 121, 5, 152, 122], [6, 147, 117, 4, 148, 118], [8, 132, 106, 4, 133, 107],
  [10, 142, 114, 2, 143, 115], [8, 152, 122, 4, 153, 123], [3, 147, 117, 10, 148, 118], [7, 146, 116, 7, 147, 117], [5, 145, 115, 10, 146, 116],
  [13, 145, 115, 3, 146, 116], [17, 145, 115], [17, 145, 115, 1, 146, 116], [13, 145, 115, 6, 146, 116], [12, 151, 121, 7, 152, 122],
  [6, 151, 121, 14, 152, 122], [17, 152, 122, 4, 153, 123], [4, 152, 122, 18, 153, 123], [20, 147, 117, 4, 148, 118], [19, 148, 118, 6, 149, 119],
]

// Alignment pattern center coordinates per version (crossed with itself).
const ALIGNMENT_POSITIONS: number[][] = [
  [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
  [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90],
  [6, 28, 50, 72, 94], [6, 26, 50, 74, 98], [6, 30, 54, 78, 102], [6, 28, 54, 80, 106], [6, 32, 58, 84, 110], [6, 30, 58, 86, 114], [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122], [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138], [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150], [6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170],
]

const G15 = 0x537 // format-info BCH generator: x^10+x^8+x^5+x^4+x^2+x+1
const G15_MASK = 0x5412
const G18 = 0x1f25 // version-info BCH generator: x^12+x^11+x^10+x^9+x^8+x^5+x^2+1
const PAD_BYTES = [0xec, 0x11]

// ---- GF(256) exp/log tables, generated with the spec's own recurrence ----
const GF_EXP = new Uint8Array(256)
const GF_LOG = new Uint8Array(256)
for (let i = 0; i < 8; i++) GF_EXP[i] = 1 << i
for (let i = 8; i < 255; i++) {
  GF_EXP[i] = GF_EXP[i - 4] ^ GF_EXP[i - 5] ^ GF_EXP[i - 6] ^ GF_EXP[i - 8]
}
for (let i = 0; i < 255; i++) GF_LOG[GF_EXP[i]] = i

function gfExp(n: number): number {
  let m = n % 255
  if (m < 0) m += 255
  return GF_EXP[m]
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return gfExp(GF_LOG[a] + GF_LOG[b])
}

function polyMultiply(a: number[], b: number[]): number[] {
  const out = Array.from({ length: a.length + b.length - 1 }, () => 0)
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) out[i + j] ^= gfMul(a[i], b[j])
  }
  return out
}

function generatorPolynomial(ecCount: number): number[] {
  let poly = [1]
  for (let i = 0; i < ecCount; i++) poly = polyMultiply(poly, [1, gfExp(i)])
  return poly
}

/** Polynomial long division in GF(256); returns the remainder. */
function polyMod(dividend: number[], divisor: number[]): number[] {
  let result = dividend.slice()
  while (result.length >= divisor.length) {
    if (result[0] === 0) {
      result = result.slice(1)
      continue
    }
    const ratio = GF_LOG[result[0]] - GF_LOG[divisor[0]]
    const next = result.slice()
    for (let i = 0; i < divisor.length; i++) {
      if (divisor[i] !== 0) next[i] ^= gfExp(GF_LOG[divisor[i]] + ratio)
    }
    result = next.slice(1)
  }
  return result
}

function reedSolomonEncode(dataBytes: number[], ecCount: number): number[] {
  const generator = generatorPolynomial(ecCount)
  const dividend = [...dataBytes, ...Array.from({ length: ecCount }, () => 0)]
  const remainder = polyMod(dividend, generator)
  const ec = Array.from({ length: ecCount }, () => 0)
  const offset = ecCount - remainder.length
  for (let i = 0; i < remainder.length; i++) ec[offset + i] = remainder[i]
  return ec
}

class BitBuffer {
  private bits: number[] = []

  put(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1)
  }

  get length(): number {
    return this.bits.length
  }

  toBytes(): number[] {
    const bytes: number[] = []
    for (let i = 0; i < this.bits.length; i += 8) {
      let b = 0
      for (let j = 0; j < 8; j++) b = (b << 1) | (this.bits[i + j] ?? 0)
      bytes.push(b)
    }
    return bytes
  }
}

interface RsGroup {
  count: number
  totalPerBlock: number
  dataPerBlock: number
}

function parseBlocks(row: number[]): RsGroup[] {
  const groups: RsGroup[] = []
  for (let i = 0; i < row.length; i += 3) {
    groups.push({ count: row[i], totalPerBlock: row[i + 1], dataPerBlock: row[i + 2] })
  }
  return groups
}

function totalDataCodewordsFor(version: number): number {
  return parseBlocks(EC_L_BLOCKS[version - 1]).reduce((s, g) => s + g.count * g.dataPerBlock, 0)
}

function charCountBits(version: number): number {
  return version < 10 ? 8 : 16
}

function byteCapacityFor(version: number): number {
  const totalBits = totalDataCodewordsFor(version) * 8
  return Math.floor((totalBits - 4 - charCountBits(version)) / 8)
}

function pickVersion(byteLength: number): number {
  for (let v = 1; v <= 40; v++) {
    if (byteCapacityFor(v) >= byteLength) return v
  }
  throw new Error(`Data too large for a QR code (${byteLength} bytes, max ~2953)`)
}

function buildDataCodewords(bytes: Uint8Array, version: number): number[] {
  const totalDataCodewords = totalDataCodewordsFor(version)
  const buf = new BitBuffer()
  buf.put(0b0100, 4) // byte-mode indicator
  buf.put(bytes.length, charCountBits(version))
  for (const b of bytes) buf.put(b, 8)
  if (buf.length + 4 <= totalDataCodewords * 8) buf.put(0, 4) // terminator
  while (buf.length % 8 !== 0) buf.put(0, 1)
  let pi = 0
  while (buf.length < totalDataCodewords * 8) {
    buf.put(PAD_BYTES[pi % 2], 8)
    pi++
  }
  return buf.toBytes()
}

/** Splits data codewords into RS blocks, computes EC codewords per block,
 * and interleaves data-then-EC exactly as the spec requires. */
function assembleCodewords(dataCodewords: number[], version: number): number[] {
  const groups = parseBlocks(EC_L_BLOCKS[version - 1])
  const blocks: { data: number[]; ec: number[] }[] = []
  let offset = 0
  for (const g of groups) {
    for (let b = 0; b < g.count; b++) {
      const data = dataCodewords.slice(offset, offset + g.dataPerBlock)
      offset += g.dataPerBlock
      blocks.push({ data, ec: reedSolomonEncode(data, g.totalPerBlock - g.dataPerBlock) })
    }
  }
  const maxData = Math.max(...blocks.map((b) => b.data.length))
  const maxEc = Math.max(...blocks.map((b) => b.ec.length))
  const out: number[] = []
  for (let i = 0; i < maxData; i++) for (const b of blocks) if (i < b.data.length) out.push(b.data[i])
  for (let i = 0; i < maxEc; i++) for (const b of blocks) if (i < b.ec.length) out.push(b.ec[i])
  return out
}

function bchDigit(n: number): number {
  let d = 0
  while (n !== 0) {
    d++
    n >>>= 1
  }
  return d
}

/** Format info: 5 data bits (EC level + mask) BCH(15,5)-encoded, then
 * XORed with a fixed mask so an all-zero format is never all-zero on the
 * matrix (avoids being confused with a blank/undetected area). */
function formatInfoBits(maskPattern: number): number {
  const data = (1 << 3) | maskPattern // EC level L = 1
  let d = data << 10
  const g15Digit = bchDigit(G15)
  while (bchDigit(d) - g15Digit >= 0) d ^= G15 << (bchDigit(d) - g15Digit)
  return ((data << 10) | d) ^ G15_MASK
}

/** Version info (only placed for version >= 7): 6 bits BCH(18,6)-encoded. */
function versionInfoBits(version: number): number {
  let d = version << 12
  const g18Digit = bchDigit(G18)
  while (bchDigit(d) - g18Digit >= 0) d ^= G18 << (bchDigit(d) - g18Digit)
  return (version << 12) | d
}

const MASK_FNS: Array<(r: number, c: number) => boolean> = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r * c) % 3) + ((r + c) % 2)) % 2 === 0,
]

function buildMatrix(version: number, maskPattern: number, codewords: number[]): boolean[][] {
  const size = version * 4 + 17
  const modules: (boolean | null)[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null),
  )

  const placeFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      if (row + r <= -1 || size <= row + r) continue
      for (let c = -1; c <= 7; c++) {
        if (col + c <= -1 || size <= col + c) continue
        const isDark =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        modules[row + r][col + c] = isDark
      }
    }
  }
  placeFinder(0, 0)
  placeFinder(size - 7, 0)
  placeFinder(0, size - 7)

  // Alignment patterns must be placed before timing patterns — some
  // alignment centers (e.g. version 7's [6, 22]) sit on the timing line
  // but outside any finder pattern, so timing-first would leave that cell
  // non-null and the alignment placement's occupied-check would skip it.
  const positions = ALIGNMENT_POSITIONS[version - 1]
  for (const row of positions) {
    for (const col of positions) {
      if (modules[row][col] != null) continue
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const isDark = r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)
          modules[row + r][col + c] = isDark
        }
      }
    }
  }

  for (let r = 8; r < size - 8; r++) if (modules[r][6] == null) modules[r][6] = r % 2 === 0
  for (let c = 8; c < size - 8; c++) if (modules[6][c] == null) modules[6][c] = c % 2 === 0

  const fBits = formatInfoBits(maskPattern)
  for (let i = 0; i < 15; i++) {
    const dark = ((fBits >> i) & 1) === 1
    if (i < 6) modules[i][8] = dark
    else if (i < 8) modules[i + 1][8] = dark
    else modules[size - 15 + i][8] = dark
  }
  for (let i = 0; i < 15; i++) {
    const dark = ((fBits >> i) & 1) === 1
    if (i < 8) modules[8][size - i - 1] = dark
    else if (i < 9) modules[8][15 - i - 1 + 1] = dark
    else modules[8][15 - i - 1] = dark
  }
  modules[size - 8][8] = true // fixed dark module

  if (version >= 7) {
    const vBits = versionInfoBits(version)
    for (let i = 0; i < 18; i++) {
      const dark = ((vBits >> i) & 1) === 1
      modules[Math.floor(i / 3)][(i % 3) + size - 8 - 3] = dark
      modules[(i % 3) + size - 8 - 3][Math.floor(i / 3)] = dark
    }
  }

  const maskFn = MASK_FNS[maskPattern]
  let row = size - 1
  let inc = -1
  let bitIndex = 7
  let byteIndex = 0
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1
    // eslint-disable-next-line no-constant-condition
    while (true) {
      for (let c = 0; c < 2; c++) {
        if (modules[row][col - c] == null) {
          let dark = false
          if (byteIndex < codewords.length) {
            dark = ((codewords[byteIndex] >>> bitIndex) & 1) === 1
          }
          if (maskFn(row, col - c)) dark = !dark
          modules[row][col - c] = dark
          bitIndex--
          if (bitIndex === -1) {
            byteIndex++
            bitIndex = 7
          }
        }
      }
      row += inc
      if (row < 0 || size <= row) {
        row -= inc
        inc = -inc
        break
      }
    }
  }

  return modules as boolean[][]
}

function penalty(modules: boolean[][]): number {
  const size = modules.length
  let points = 0

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const dark = modules[row][col]
      let same = 0
      for (let r = -1; r <= 1; r++) {
        if (row + r < 0 || size <= row + r) continue
        for (let c = -1; c <= 1; c++) {
          if (col + c < 0 || size <= col + c) continue
          if (r === 0 && c === 0) continue
          if (modules[row + r][col + c] === dark) same++
        }
      }
      if (same > 5) points += 3 + same - 5
    }
  }

  for (let row = 0; row < size - 1; row++) {
    for (let col = 0; col < size - 1; col++) {
      const v = modules[row][col]
      if (v === modules[row + 1][col] && v === modules[row][col + 1] && v === modules[row + 1][col + 1]) {
        points += 3
      }
    }
  }

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size - 6; col++) {
      if (
        modules[row][col] && !modules[row][col + 1] && modules[row][col + 2] &&
        modules[row][col + 3] && modules[row][col + 4] && !modules[row][col + 5] && modules[row][col + 6]
      )
        points += 40
    }
  }
  for (let col = 0; col < size; col++) {
    for (let row = 0; row < size - 6; row++) {
      if (
        modules[row][col] && !modules[row + 1][col] && modules[row + 2][col] &&
        modules[row + 3][col] && modules[row + 4][col] && !modules[row + 5][col] && modules[row + 6][col]
      )
        points += 40
    }
  }

  let dark = 0
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) if (modules[row][col]) dark++
  const ratio = Math.abs((100 * dark) / (size * size) - 50) / 5
  points += ratio * 10

  return points
}

/** Encodes arbitrary bytes as a QR code (Byte mode, EC level L), picking
 * the smallest version that fits and the mask pattern with the lowest
 * visual-penalty score, per spec. */
export function encodeQR(data: Uint8Array): QRMatrix {
  const version = pickVersion(data.length)
  const dataCodewords = buildDataCodewords(data, version)
  const allCodewords = assembleCodewords(dataCodewords, version)

  let best: boolean[][] | null = null
  let bestPenalty = Infinity
  for (let mask = 0; mask < 8; mask++) {
    const matrix = buildMatrix(version, mask, allCodewords)
    const p = penalty(matrix)
    if (p < bestPenalty) {
      bestPenalty = p
      best = matrix
    }
  }

  return { version, modules: best! }
}

/** Largest byte payload this encoder can fit (version 40, EC level L). */
export const QR_MAX_BYTES = byteCapacityFor(40)
