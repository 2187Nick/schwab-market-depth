import { customSeriesDefaultOptions } from 'lightweight-charts'
import { fullBarWidth, positionsBox } from './dimensions'

const defaultOptions = {
  // thin cell gap; caller can override
  cellBorderWidth: 0.5,
  cellBorderColor: '#000',
  cellShader: a => {
    const alpha = Math.min(Math.abs(a) / 100, 1)
    return a > 0 ? `rgba(76,175,80,${alpha})` : `rgba(244,67,54,${alpha})`
  },
}

class HeatMapSeriesRenderer {
  _data = null
  _options = null

  update(data, options) {
    this._data = data
    this._options = { ...defaultOptions, ...options }
  }

  draw(target, priceConverter) {
    if (!this._data || !this._options) return

    target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio: px }) => {
      ctx.save()
      const { bars, visibleRange, barSpacing } = this._data
      if (bars && visibleRange) {
        let lastSizeDrawn = null

        for (let i = visibleRange.from; i < visibleRange.to; i++) {
          const bar = bars[i]
          const o = bar?.originalData
          if (!o?.cells) continue

          const fullWidth = fullBarWidth(bar.x, barSpacing / 2, px)
          const gap = this._options.cellBorderWidth * px

          // ----- draw heat-map cells -----
          for (const c of o.cells) {
            if (!Number.isFinite(c.low) || !Number.isFinite(c.high)) continue
            const low = priceConverter(c.low)
            const high = priceConverter(c.high)
            const v = positionsBox(low, high, px)

            ctx.fillStyle = this._options.cellShader(c.amount)
            ctx.fillRect(
              fullWidth.position + gap,
              v.position + gap,
              fullWidth.length   - gap * 2,
              v.length           - gap * 2,
            )

            // label on rightmost bar
            if (i === visibleRange.to - 1) {
              ctx.font           = `${12 * px}px Arial`
              ctx.textBaseline  = 'middle'
              ctx.textAlign     = 'left'
              const labelX      = fullWidth.position + fullWidth.length + 4 * px
              const labelY      = v.position + v.length / 2
              const priceTxt    = c.low.toFixed(2)

              ctx.fillStyle     = '#fff'
              ctx.fillText(priceTxt, labelX, labelY)

              ctx.font           = `bold ${12 * px}px Arial`
              ctx.fillStyle     = c.amount > 0 ? 'green' : 'red'
              ctx.fillText(
                ` ${Math.abs(c.amount)}`,
                labelX + ctx.measureText(priceTxt).width + 4 * px,
                labelY,
              )
            }
          }

          // ----- yellow size bubble (always recalc Y) -----
          if (
            Number.isFinite(o.lastSize) &&
            Number.isFinite(o.lastPrice) &&
            o.lastSize !== lastSizeDrawn
          ) {
            lastSizeDrawn = o.lastSize

            const cx  = fullWidth.position + fullWidth.length / 2
            const yPx = priceConverter(o.lastPrice) * px
            const r   = Math.sqrt(o.lastSize) * px * 3

            ctx.beginPath()
            ctx.arc(cx, yPx, r, 0, Math.PI * 2)
            ctx.fillStyle    = 'rgba(239,246,105,0.5)'  // 50% opacity
            ctx.fill()

            ctx.fillStyle    = '#000'
            ctx.font         = `bold ${11 * px}px Arial`
            ctx.textAlign    = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(o.lastSize.toString(), cx, yPx)
          }
        }
      }
      ctx.restore()
    })
  }

  getZOrder() {
    return 'top'
  }
}

export class HeatMapSeries {
  _renderer = new HeatMapSeriesRenderer()

  priceValueBuilder(r) {
    if (!r?.cells?.length) return [NaN]
    let low  = Infinity, high = -Infinity
    for (const c of r.cells) {
      if (c.low < low)  low  = c.low
      if (c.high > high) high = c.high
    }
    const mid = low + (high - high + low) / 2
    return [low, high, mid]
  }

  isWhitespace(d) {
    return !d?.cells?.length
  }

  renderer() {
    return this._renderer
  }

  update(data, options) {
    this._renderer.update(data, options)
  }

  defaultOptions() {
    return { ...customSeriesDefaultOptions, timeFormat: 'timestamp', ...defaultOptions }
  }
}
