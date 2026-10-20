import { TEAM_BRAND_DEFS } from '../../../utils/teamBrands.js'
import { evalScoreTier } from '../../../utils/learnerTests.js'
import useCountUp from '../../../hooks/useCountUp.js'
import { defineCountUpDuration } from './DefineAnimatedNumber.jsx'

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

function bubbleRadius(volume, maxVolume) {
  const minR = 32
  const maxR = 50
  if (!maxVolume) return minR
  const ratio = clamp((volume ?? 0) / maxVolume, 0.2, 1)
  return minR + ratio * (maxR - minR)
}

function moduleCaptionLines(t, volume, captionKind = 'formation') {
  const many = volume > 1
  if (captionKind === 'elearning') {
    return {
      line1: many ? t.medacap_define_chart_elearning_line1_many : t.medacap_define_chart_elearning_line1_one,
      line2: many ? t.medacap_define_chart_elearning_line2_many : t.medacap_define_chart_elearning_line2_one,
    }
  }
  return {
    line1: many ? t.medacap_define_chart_module_line1_many : t.medacap_define_chart_module_line1_one,
    line2: many ? t.medacap_define_chart_module_line2_many : t.medacap_define_chart_module_line2_one,
  }
}

function bubbleTierClass(score) {
  const tier = evalScoreTier(score)
  if (tier === 'high') return 'define-tech-bubble--high'
  if (tier === 'mid') return 'define-tech-bubble--mid'
  if (tier === 'low') return 'define-tech-bubble--low'
  return 'define-tech-bubble--pending'
}

function scoreAnchorY(score, plotH, padTop, yMax) {
  return padTop + plotH - (score / yMax) * plotH
}

function buildTrendPolyline(points, plotH, padTop, yMax, plotLeft, plotRight) {
  const anchors = points.filter(point => point.score != null)
  if (!anchors.length) return null

  if (anchors.length === 1) {
    const y = scoreAnchorY(anchors[0].score, plotH, padTop, yMax)
    return `${plotLeft},${y} ${plotRight},${y}`
  }

  const firstY = scoreAnchorY(anchors[0].score, plotH, padTop, yMax)
  const lastY = scoreAnchorY(anchors[anchors.length - 1].score, plotH, padTop, yMax)

  return [
    `${plotLeft},${firstY}`,
    ...anchors.map(point => `${point.x},${scoreAnchorY(point.score, plotH, padTop, yMax)}`),
    `${plotRight},${lastY}`,
  ].join(' ')
}

function scoreTierStrokeColor(score) {
  const tier = evalScoreTier(score)
  if (tier === 'high') return '#1aab5b'
  if (tier === 'mid') return '#f5a623'
  if (tier === 'low') return '#e3001b'
  return '#64748b'
}

function lowestChartScore(points) {
  const scores = points.map(point => point.score).filter(score => score != null)
  return scores.length ? Math.min(...scores) : null
}

const CHART_HEADROOM_SCORE_MIN = 70
const CALLOUT_WIDTH = 240
const CALLOUT_HEIGHT = 30
const CALLOUT_BG_OFFSET = 38
const CALLOUT_STACK_GAP = 6

function naturalCalloutTop(point, plotH, padTop, yMax, maxVolume) {
  const r = bubbleRadius(point.volume ?? 0, maxVolume)
  const scoreY = scoreAnchorY(point.score, plotH, padTop, yMax)
  const measureY = scoreY - r
  return measureY - r - CALLOUT_BG_OFFSET
}

function calloutBoxesOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

/** Décale verticalement les callouts qui se chevauchent (gauche → droite). */
function resolveCalloutLifts(points, plotH, padTop, yMax, maxVolume) {
  const lifts = new Map()
  const placed = []
  const stackStep = CALLOUT_HEIGHT + CALLOUT_STACK_GAP

  for (const point of points) {
    if (point.score == null) {
      lifts.set(point.brandId, 0)
      continue
    }

    const baseTop = naturalCalloutTop(point, plotH, padTop, yMax, maxVolume)
    let lift = 0
    let box = {
      left: point.x - CALLOUT_WIDTH / 2,
      right: point.x + CALLOUT_WIDTH / 2,
      top: baseTop,
      bottom: baseTop + CALLOUT_HEIGHT,
    }

    let guard = 0
    while (placed.some(prev => calloutBoxesOverlap(prev, box)) && guard < 12) {
      lift += stackStep
      box = {
        ...box,
        top: baseTop - lift,
        bottom: baseTop - lift + CALLOUT_HEIGHT,
      }
      guard += 1
    }

    placed.push(box)
    lifts.set(point.brandId, lift)
  }

  return lifts
}

function headroomForScore(score, maxRadius, plotH, basePadTop, yMax) {
  const scoreY = basePadTop + plotH - (score / yMax) * plotH
  const calloutClearance = CALLOUT_BG_OFFSET + CALLOUT_HEIGHT
  const margin = 10
  const topEdge = scoreY - maxRadius * 2 - calloutClearance
  return Math.max(0, margin - topEdge)
}

/** Marge haute proportionnelle dès 70 % — bulle + callout, axe Y reste 0–100. */
function resolveChartTopHeadroom(scores, maxRadius, plotH, basePadTop, yMax) {
  if (!scores.length) return 0

  const maxScore = Math.max(...scores)
  if (maxScore < CHART_HEADROOM_SCORE_MIN) return 0

  const fullHeadroom = headroomForScore(yMax, maxRadius, plotH, basePadTop, yMax)
  const factor = clamp(
    (maxScore - CHART_HEADROOM_SCORE_MIN) / (yMax - CHART_HEADROOM_SCORE_MIN),
    0,
    1,
  )
  return Math.ceil(fullHeadroom * factor)
}

function bubbleGradientId(score) {
  const tier = evalScoreTier(score)
  if (tier === 'high') return 'define-tech-bubble-grad-high'
  if (tier === 'mid') return 'define-tech-bubble-grad-mid'
  if (tier === 'low') return 'define-tech-bubble-grad-low'
  return 'define-tech-bubble-grad-pending'
}

function ChartBubbleDefs() {
  return (
    <defs>
      <radialGradient id="define-tech-bubble-grad-high" cx="28%" cy="22%" r="72%" fx="22%" fy="16%">
        <stop offset="0%" stopColor="#3ec97a" />
        <stop offset="50%" stopColor="#1aab5b" />
        <stop offset="100%" stopColor="#0a6b38" />
      </radialGradient>
      <radialGradient id="define-tech-bubble-grad-mid" cx="28%" cy="22%" r="72%" fx="22%" fy="16%">
        <stop offset="0%" stopColor="#e89412" />
        <stop offset="50%" stopColor="#f5a623" />
        <stop offset="100%" stopColor="#b8740a" />
      </radialGradient>
      <radialGradient id="define-tech-bubble-grad-low" cx="28%" cy="22%" r="72%" fx="22%" fy="16%">
        <stop offset="0%" stopColor="#c80018" />
        <stop offset="50%" stopColor="#e3001b" />
        <stop offset="100%" stopColor="#9a0012" />
      </radialGradient>
      <radialGradient id="define-tech-bubble-grad-pending" cx="28%" cy="22%" r="72%" fx="22%" fy="16%">
        <stop offset="0%" stopColor="#b8c4d4" />
        <stop offset="50%" stopColor="#cbd5e1" />
        <stop offset="100%" stopColor="#94a3b8" />
      </radialGradient>
      <filter id="define-tech-bubble-shadow" x="-45%" y="-35%" width="190%" height="190%">
        <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#0f172a" floodOpacity="0.2" />
      </filter>
    </defs>
  )
}

function BubbleSphere({ cx, cy, r, score, scoreAnchorYPos, includeGroundShadow = true }) {
  const gradId = bubbleGradientId(score)
  const anchorY = scoreAnchorYPos ?? cy + r

  return (
    <g className="define-tech-bubble-sphere">
      {includeGroundShadow ? (
        <ellipse
          cx={cx}
          cy={anchorY + 6}
          rx={r * 0.82}
          ry={r * 0.17}
          className="define-tech-bubble-ground-shadow"
        />
      ) : null}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={`url(#${gradId})`}
        className={`define-tech-bubble ${bubbleTierClass(score)}`}
        filter="url(#define-tech-bubble-shadow)"
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        className="define-tech-bubble-rim"
      />
      <ellipse
        cx={cx - r * 0.54}
        cy={cy - r * 0.54}
        rx={r * 0.17}
        ry={r * 0.1}
        className="define-tech-bubble-highlight"
      />
    </g>
  )
}

function calloutScoreTierClass(score) {
  const tier = evalScoreTier(score)
  if (tier === 'high') return 'define-tech-bubble-chart-callout-score--high'
  if (tier === 'mid') return 'define-tech-bubble-chart-callout-score--mid'
  if (tier === 'low') return 'define-tech-bubble-chart-callout-score--low'
  return 'define-tech-bubble-chart-callout-score--pending'
}

function AnimatedBubbleGroup({
  point,
  animationKey,
  plotH,
  padTop,
  yMax,
  height,
  maxVolume,
  calloutLift = 0,
  t,
}) {
  const duration = defineCountUpDuration()
  const targetVolume = point.volume ?? 0
  const hasScore = point.score != null
  const targetScore = hasScore ? point.score : 0
  const targetRadius = bubbleRadius(targetVolume, maxVolume)

  const animatedVolume = useCountUp(targetVolume, {
    duration,
    start: true,
    restartKey: animationKey,
  })
  const animatedScore = useCountUp(targetScore, {
    duration,
    start: hasScore,
    restartKey: animationKey,
  })
  const animatedRadius = useCountUp(targetRadius, {
    duration,
    start: true,
    restartKey: animationKey,
  })

  const scoreY = hasScore
    ? scoreAnchorY(animatedScore, plotH, padTop, yMax)
    : padTop + plotH - 8
  const measureY = scoreY - animatedRadius
  const logoY = height - 42
  const logoW = 92
  const logoH = 34
  const stemTop = scoreY + 4
  const caption = moduleCaptionLines(t, targetVolume, point.captionKind)
  const calloutWidth = point.captionKind === 'elearning' ? 268 : CALLOUT_WIDTH
  const calloutTop = measureY - animatedRadius - CALLOUT_BG_OFFSET - calloutLift
  const calloutCenterY = calloutTop + CALLOUT_HEIGHT / 2
  const calloutClipId = `define-tech-callout-clip-${point.brandId}`

  return (
    <g>
      <line
        x1={point.x}
        y1={stemTop}
        x2={point.x}
        y2={logoY - 4}
        className="define-tech-bubble-chart-stem"
      />

      {point.logo ? (
        <image
          href={point.logo}
          x={point.x - logoW / 2}
          y={logoY}
          width={logoW}
          height={logoH}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : (
        <text x={point.x} y={logoY + 20} className="define-tech-bubble-chart-logo-fallback" textAnchor="middle">
          {point.label}
        </text>
      )}

      {hasScore ? (
        <g className="define-tech-bubble-chart-callout-wrap">
          <defs>
            <clipPath id={calloutClipId}>
              <rect
                x={point.x - calloutWidth / 2}
                y={calloutTop}
                width={calloutWidth}
                height={CALLOUT_HEIGHT}
                rx="6"
              />
            </clipPath>
          </defs>
          <rect
            x={point.x - calloutWidth / 2}
            y={calloutTop}
            width={calloutWidth}
            height={CALLOUT_HEIGHT}
            rx="6"
            className="define-tech-bubble-chart-callout-bg"
          />
          <text
            x={point.x}
            y={calloutCenterY}
            className="define-tech-bubble-chart-callout"
            textAnchor="middle"
            dominantBaseline="middle"
            clipPath={`url(#${calloutClipId})`}
          >
            <tspan>
              {point.captionKind === 'elearning'
                ? t.medacap_define_chart_callout_teamgp_prefix
                : t.medacap_define_chart_callout_prefix}
            </tspan>
            <tspan
              className={`define-tech-bubble-chart-callout-score ${calloutScoreTierClass(targetScore)}`}
              fontWeight="700"
            >
              {Math.round(animatedScore)} %
            </tspan>
          </text>
        </g>
      ) : null}

      <g className="define-tech-bubble-hit">
        <circle
          cx={point.x}
          cy={measureY}
          r={animatedRadius + 4}
          className="define-tech-bubble-hit-area"
        />
        <ellipse
          cx={point.x}
          cy={scoreY + 6}
          rx={animatedRadius * 0.82}
          ry={animatedRadius * 0.17}
          className="define-tech-bubble-ground-shadow"
        />
        <g transform={`translate(${point.x} ${scoreY})`}>
          <g className="define-tech-bubble-jump-target">
            <g transform={`translate(${-point.x} ${-scoreY})`}>
              <BubbleSphere
                cx={point.x}
                cy={measureY}
                r={animatedRadius}
                score={hasScore ? targetScore : null}
                scoreAnchorYPos={scoreY}
                includeGroundShadow={false}
              />

              <text x={point.x} y={measureY - 8} className="define-tech-bubble-count" textAnchor="middle">
                {String(animatedVolume).padStart(2, '0')}
              </text>
              <text x={point.x} y={measureY + 6} className="define-tech-bubble-caption" textAnchor="middle">
                <tspan x={point.x} dy="0">{caption.line1}</tspan>
                <tspan x={point.x} dy="11">{caption.line2}</tspan>
              </text>
            </g>
          </g>
        </g>
      </g>
    </g>
  )
}

export default function DefineTechnicianMeasureChart({
  series,
  filters,
  levelToggles = [],
  onLevelChange,
  animationKey,
  t,
}) {
  const toggles = levelToggles.length
    ? levelToggles
    : [{ value: 'all', labelKey: 'medacap_define_chart_tier_all' }]

  if (!series.length) {
    return (
      <section className="define-tech-bubble-chart-panel">
        <p className="define-tech-chart-empty">{t.medacap_define_chart_pending_sub}</p>
      </section>
    )
  }

  const width = 980
  const baseHeight = 420
  const padLeft = 88
  const padRight = 32
  const basePadTop = 12
  const padBottom = 72
  const plotW = width - padLeft - padRight
  const maxVolume = Math.max(1, ...series.map(row => row.volume ?? 0))
  const maxBubbleRadius = bubbleRadius(maxVolume, maxVolume)
  const yMax = 100
  const yTicks = Array.from({ length: 11 }, (_, i) => i * 10)

  const rawScores = series
    .map(row => (row.measureScore == null ? null : clamp(row.measureScore, 0, yMax)))
    .filter(score => score != null)

  const basePlotH = baseHeight - basePadTop - padBottom
  let topHeadroom = resolveChartTopHeadroom(rawScores, maxBubbleRadius, basePlotH, basePadTop, yMax)
  let padTop = basePadTop + topHeadroom
  let height = baseHeight + topHeadroom
  let plotH = height - padTop - padBottom
  const slotW = plotW / series.length

  const points = series.map((row, index) => {
    const x = padLeft + slotW * index + slotW / 2
    const score = row.measureScore == null ? null : clamp(row.measureScore, 0, yMax)
    const logo = row.logo ?? TEAM_BRAND_DEFS[row.brandId]?.logo ?? null

    return {
      ...row,
      x,
      score,
      logo,
    }
  })

  const calloutLifts = resolveCalloutLifts(points, plotH, padTop, yMax, maxVolume)
  const maxCalloutLift = Math.max(0, ...calloutLifts.values())
  if (maxCalloutLift > 0) {
    padTop += maxCalloutLift
    height += maxCalloutLift
    plotH = height - padTop - padBottom
  }

  const pointsWithLifts = points.map(point => ({
    ...point,
    calloutLift: calloutLifts.get(point.brandId) ?? 0,
  }))

  const plotRight = width - padRight
  const trendPolyline = buildTrendPolyline(pointsWithLifts, plotH, padTop, yMax, padLeft, plotRight)
  const trendMinScore = lowestChartScore(pointsWithLifts)

  return (
    <section className="define-tech-bubble-chart-panel" aria-labelledby="define-tech-chart-title">
      <header className="define-tech-bubble-chart-head">
        <div className="define-tech-bubble-chart-head-main">
          <span className="define-tech-bubble-chart-head-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 20V10" />
              <path d="M10 20V4" />
              <path d="M16 20v-8" />
              <path d="M22 20V8" />
            </svg>
          </span>
          <h2 id="define-tech-chart-title">{t.medacap_define_chart_section_title}</h2>
        </div>
        <div className="define-tech-bubble-chart-toggles" role="group" aria-label={t.medacap_define_chart_tier_aria}>
          {toggles.map(toggle => (
            <button
              key={toggle.value}
              type="button"
              className={[
                'define-tech-bubble-chart-toggle',
                filters.level === toggle.value && 'define-tech-bubble-chart-toggle--active',
              ].filter(Boolean).join(' ')}
              aria-pressed={filters.level === toggle.value}
              onClick={() => onLevelChange?.({ level: toggle.value })}
            >
              {t[toggle.labelKey]}
            </button>
          ))}
        </div>
      </header>

      <div className="define-tech-bubble-chart-body">
        <svg
          className="define-tech-bubble-chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={t.medacap_define_chart_aria}
          preserveAspectRatio="xMidYMid meet"
        >
          <ChartBubbleDefs />

          <text
            x={24}
            y={padTop + plotH / 2}
            transform={`rotate(-90 24 ${padTop + plotH / 2})`}
            className="define-tech-bubble-chart-y-title"
            textAnchor="middle"
          >
            {t.medacap_define_chart_y_title}
          </text>

          {yTicks.map(tick => {
            const y = padTop + plotH - (tick / yMax) * plotH
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  className="define-tech-bubble-chart-grid"
                />
                <text x={padLeft - 12} y={y + 4} className="define-tech-bubble-chart-y-label" textAnchor="end">
                  {tick}
                </text>
              </g>
            )
          })}

          {trendPolyline ? (
            <polyline
              points={trendPolyline}
              className="define-tech-bubble-chart-trend"
              stroke={scoreTierStrokeColor(trendMinScore)}
            />
          ) : null}

          {pointsWithLifts.map(point => (
            <AnimatedBubbleGroup
              key={point.brandId}
              point={point}
              animationKey={animationKey}
              plotH={plotH}
              padTop={padTop}
              yMax={yMax}
              height={height}
              maxVolume={maxVolume}
              calloutLift={point.calloutLift}
              t={t}
            />
          ))}
        </svg>
      </div>
    </section>
  )
}
