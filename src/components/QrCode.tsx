import { useMemo } from 'react'
import { encodeQR } from '../lib/qrcode'

interface QrCodeProps {
  /** Data to encode — kept small (a URL or short code); see lib/qrcode.ts
   * for the size budget (~2953 bytes max). */
  data: string
  /** Rendered pixel size of the square. Module count varies with data length. */
  size?: number
}

interface Run {
  x: number
  y: number
  width: number
}

/** Merges consecutive dark modules within a row into single wide rects —
 * a version-40 code can have ~31k modules; this keeps the DOM small. */
function rowRuns(modules: boolean[][], border: number): Run[] {
  const runs: Run[] = []
  for (let r = 0; r < modules.length; r++) {
    let start = -1
    for (let c = 0; c <= modules[r].length; c++) {
      const dark = c < modules[r].length && modules[r][c]
      if (dark && start === -1) start = c
      if (!dark && start !== -1) {
        runs.push({ x: start + border, y: r + border, width: c - start })
        start = -1
      }
    }
  }
  return runs
}

export function QrCode({ data, size = 220 }: QrCodeProps) {
  const result = useMemo(() => {
    try {
      const bytes = new TextEncoder().encode(data)
      return { modules: encodeQR(bytes).modules, error: null as string | null }
    } catch (err) {
      return { modules: null, error: (err as Error).message }
    }
  }, [data])

  if (result.error || !result.modules) {
    return (
      <div className="qr-error" role="img" aria-label="Could not generate QR code">
        {result.error ?? 'Could not generate QR code.'}
      </div>
    )
  }

  const border = 2
  const dim = result.modules.length + border * 2
  const runs = rowRuns(result.modules, border)

  return (
    <svg
      viewBox={`0 0 ${dim} ${dim}`}
      width={size}
      height={size}
      className="qr-code"
      role="img"
      aria-label="QR code"
      shapeRendering="crispEdges"
    >
      {/* Always white-on-black regardless of app theme — QR scanners need
          real contrast, not whatever the current dark/light palette is. */}
      <rect x={0} y={0} width={dim} height={dim} fill="#fff" />
      {runs.map((run, i) => (
        <rect key={i} x={run.x} y={run.y} width={run.width} height={1} fill="#000" />
      ))}
    </svg>
  )
}
