'use client'

/**
 * Premium animated login branding SVG.
 * Combina: plano arquitectónico que se dibuja solo + dashboard ERP animado.
 * Usa CSS animations + SVG SMIL. No requiere framer-motion.
 */
export function LoginBrandingSvg() {
  // Blueprint color: #22d3ee (cyan)  Data/chart: #60a5fa (blue)  Positive: #4ade80 (green)
  return (
    <svg
      className="absolute inset-0 h-full w-full overflow-hidden"
      viewBox="0 0 720 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <style>{`
          /* ── Base classes ── */
          .bp  { fill: none; stroke: #22d3ee; stroke-linecap: round; stroke-linejoin: round; }
          .bp2 { stroke-width: 2.2; }
          .bp1 { stroke-width: 1.5; }
          .bp05{ stroke-width: 0.75; }
          .dim { stroke-width: 0.7; stroke-dasharray: 5 4; opacity: 0.28; }

          /* ── Draw animation (stroke-dashoffset reveal) ── */
          .draw { stroke-dasharray: 3000; stroke-dashoffset: 3000;
                  animation: draw 1.4s cubic-bezier(0.22,1,0.36,1) both; }
          .draw-md { stroke-dasharray: 3000; stroke-dashoffset: 3000;
                     animation: draw 0.65s cubic-bezier(0.22,1,0.36,1) both; }
          .draw-chart { stroke-dasharray: 3000; stroke-dashoffset: 3000;
                        animation: draw 2.2s cubic-bezier(0.22,1,0.36,1) both; }
          @keyframes draw { to { stroke-dashoffset: 0; } }

          /* ── Fade in ── */
          .fade { opacity: 0; animation: fade 0.45s ease forwards; }
          @keyframes fade { to { opacity: 1; } }

          /* ── Pop scale ── */
          .pop { transform: scale(0); animation: pop 0.4s cubic-bezier(0.22,1,0.36,1) forwards; }
          @keyframes pop { to { transform: scale(1); } }

          /* ── Live pulse (continuous) ── */
          .pulse { animation: pulse 2.8s ease-in-out infinite; }
          @keyframes pulse { 0%,100%{ opacity: 1; } 50%{ opacity: 0.25; } }

          /* ── Scan line sweep ── */
          .scan { animation: scan 8s ease-in-out 4.5s infinite; }
          @keyframes scan {
            0%   { transform: translateX(0px);   opacity: 0; }
            4%   { opacity: 1; }
            96%  { opacity: 0.7; }
            100% { transform: translateX(482px); opacity: 0; }
          }

          /* ── KPI card top bar grow (uses SMIL below, CSS fallback) ── */
          .bar-fill { transition: width 1.2s; }

          /* ── Number cycling for finance panel ── */
          .c1 { animation: c1 7s step-start 3.5s infinite; }
          .c2 { opacity:0; animation: c2 7s step-start 3.5s infinite; }
          .c3 { opacity:0; animation: c3 7s step-start 3.5s infinite; }
          @keyframes c1 { 0%,33%{opacity:1} 34%,100%{opacity:0} }
          @keyframes c2 { 0%,33%{opacity:0} 34%,67%{opacity:1} 68%,100%{opacity:0} }
          @keyframes c3 { 0%,67%{opacity:0} 68%,100%{opacity:1} }

          /* ── Prefers-reduced-motion override ── */
          @media (prefers-reduced-motion: reduce) {
            .draw,.draw-md,.draw-chart,.fade,.pop,.scan,.pulse,.c1,.c2,.c3 {
              animation: none !important;
              opacity: 1 !important;
              stroke-dashoffset: 0 !important;
              transform: none !important;
            }
          }
        `}</style>

        {/* Chart area gradient */}
        <linearGradient id="grad-chart" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.02" />
        </linearGradient>

        {/* Vignette: soften center where text overlay lives */}
        <radialGradient id="vignette" cx="50%" cy="30%" r="45%">
          <stop offset="0%" stopColor="#0d1a2e" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#0d1a2e" stopOpacity="0" />
        </radialGradient>

        {/* Flow path for moving dot */}
        <path id="flow-path" d="M 38 488 L 506 488" fill="none" />
      </defs>

      {/* ─────────────────────────────────────────
          BACKGROUND: Blueprint grid
      ───────────────────────────────────────── */}
      <g opacity="0.08">
        {Array.from({ length: 18 }).map((_, i) => (
          <line key={`gh${i}`} x1="0" y1={i * 52} x2="720" y2={i * 52}
            stroke="#22d3ee" strokeWidth="0.5" />
        ))}
        {Array.from({ length: 14 }).map((_, i) => (
          <line key={`gv${i}`} x1={i * 56} y1="0" x2={i * 56} y2="900"
            stroke="#22d3ee" strokeWidth="0.5" />
        ))}
      </g>

      {/* ─────────────────────────────────────────
          REGISTRATION CROSSHAIRS
      ───────────────────────────────────────── */}
      {([[22, 22], [698, 22], [698, 878], [22, 878]] as [number, number][]).map(([x, y], i) => (
        <g key={`reg${i}`} className="fade" style={{ animationDelay: `${0.1 + i * 0.06}s` }}>
          <line x1={x - 11} y1={y} x2={x + 11} y2={y} stroke="#22d3ee" strokeWidth="0.8" opacity="0.35" />
          <line x1={x} y1={y - 11} x2={x} y2={y + 11} stroke="#22d3ee" strokeWidth="0.8" opacity="0.35" />
        </g>
      ))}

      {/* ─────────────────────────────────────────
          ZONE A: BLUEPRINT FLOOR PLAN (y 155–510)
      ───────────────────────────────────────── */}

      {/* Outer building perimeter */}
      <path d="M 30 155 L 510 155 L 510 510 L 30 510 Z"
        className="bp bp2 draw" stroke="#22d3ee" opacity="0.88"
        style={{ animationDelay: '0.35s' }} />

      {/* Interior wall: vertical full-height at x=210 */}
      <line x1="210" y1="155" x2="210" y2="510"
        className="bp bp1 draw-md" stroke="#22d3ee" opacity="0.72"
        style={{ animationDelay: '1.55s' }} />

      {/* Interior wall: vertical partial at x=370 */}
      <line x1="370" y1="155" x2="370" y2="338"
        className="bp bp1 draw-md" stroke="#22d3ee" opacity="0.72"
        style={{ animationDelay: '1.85s' }} />

      {/* Interior wall: horizontal at y=338 */}
      <line x1="210" y1="338" x2="510" y2="338"
        className="bp bp1 draw-md" stroke="#22d3ee" opacity="0.72"
        style={{ animationDelay: '2.1s' }} />

      {/* Short horizontal divider y=248 in left section */}
      <line x1="30" y1="248" x2="210" y2="248"
        className="bp bp1 draw-md" stroke="#22d3ee" opacity="0.55"
        style={{ animationDelay: '2.3s' }} />

      {/* Junction dots at wall intersections */}
      {([[210, 155], [370, 155], [210, 338], [370, 338], [510, 338], [210, 510]] as [number, number][]).map(([x, y], i) => (
        <circle key={`jd${i}`} cx={x} cy={y} r={3.5}
          fill="#22d3ee" opacity="0.9"
          className="pop"
          style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${2.2 + i * 0.07}s` }} />
      ))}

      {/* Window indicators on top wall */}
      {[95, 295, 435].map((x, i) => (
        <rect key={`tw${i}`} x={x - 14} y={148} width={28} height={8} rx="1.5"
          fill="rgba(34,211,238,0.18)" stroke="#22d3ee" strokeWidth="0.75" opacity="0.72"
          className="fade" style={{ animationDelay: `${2.6 + i * 0.09}s` }} />
      ))}

      {/* Window indicators on right wall */}
      {[230, 425].map((y, i) => (
        <rect key={`rw${i}`} x={503} y={y - 10} width={8} height={20} rx="1.5"
          fill="rgba(34,211,238,0.18)" stroke="#22d3ee" strokeWidth="0.75" opacity="0.72"
          className="fade" style={{ animationDelay: `${2.8 + i * 0.1}s` }} />
      ))}

      {/* Door arcs */}
      <path d="M 30 310 A 38 38 0 0 1 68 272"
        className="bp bp05 draw-md" stroke="#22d3ee" opacity="0.5"
        strokeDasharray="3 2.5" style={{ animationDelay: '2.9s' }} />
      <path d="M 210 195 A 30 30 0 0 0 240 165"
        className="bp bp05 draw-md" stroke="#22d3ee" opacity="0.5"
        strokeDasharray="3 2.5" style={{ animationDelay: '3.1s' }} />

      {/* Room labels */}
      {[
        { x: 120, y: 206, label: 'VESTÍBULO' },
        { x: 120, y: 400, label: 'SALA REUNIÓN' },
        { x: 290, y: 248, label: 'OFICINAS' },
        { x: 440, y: 248, label: 'SALA' },
        { x: 360, y: 435, label: 'ÁREA COMÚN' },
      ].map((r, i) => (
        <text key={r.label} x={r.x} y={r.y}
          fill="#22d3ee" fontSize="8" fontFamily="ui-monospace,monospace"
          textAnchor="middle" letterSpacing="2" opacity="0.3"
          className="fade" style={{ animationDelay: `${3.2 + i * 0.1}s` }}>
          {r.label}
        </text>
      ))}

      {/* Dimension line: top */}
      <line x1="30" y1="132" x2="510" y2="132"
        className="bp dim draw-md" stroke="#22d3ee"
        style={{ animationDelay: '3.3s' }} />
      {[30, 510].map((x, i) => (
        <line key={`dt${i}`} x1={x} y1={127} x2={x} y2={137}
          stroke="#22d3ee" strokeWidth="0.7" opacity="0.28"
          className="fade" style={{ animationDelay: '3.6s' }} />
      ))}
      <text x="270" y="128" fill="#22d3ee" fontSize="7.5" fontFamily="ui-monospace,monospace"
        textAnchor="middle" opacity="0.42"
        className="fade" style={{ animationDelay: '3.7s' }}>
        40.00 m
      </text>

      {/* Dimension line: left */}
      <line x1="12" y1="155" x2="12" y2="510"
        className="bp dim draw-md" stroke="#22d3ee"
        style={{ animationDelay: '3.4s' }} />
      <text x="12" y="338" fill="#22d3ee" fontSize="7.5" fontFamily="ui-monospace,monospace"
        textAnchor="middle" opacity="0.42"
        transform="rotate(-90,12,338)"
        className="fade" style={{ animationDelay: '3.7s' }}>
        30.00 m
      </text>

      {/* Title block (right of blueprint, x=528–698) */}
      <rect x="528" y="345" width="162" height="105" rx="2"
        stroke="#22d3ee" strokeWidth="0.75" fill="none" opacity="0.28"
        className="draw-md" style={{ animationDelay: '0.5s' }} />
      <line x1="528" y1="362" x2="690" y2="362"
        stroke="#22d3ee" strokeWidth="0.5" opacity="0.18"
        className="fade" style={{ animationDelay: '0.9s' }} />
      {[
        { y: 356, text: 'BLOQER · PLANO TIPO', size: 6.5, op: 0.62 },
        { y: 374, text: 'ESC. 1:100  REV.03', size: 5.5, op: 0.38 },
        { y: 387, text: 'TORRE CENTRAL · PTY', size: 5.5, op: 0.38 },
        { y: 400, text: '2025', size: 5.5, op: 0.28 },
        { y: 438, text: 'APROBADO: ARQ. RAMÍREZ', size: 4.8, op: 0.22 },
      ].map((t, i) => (
        <text key={t.text} x="609" y={t.y}
          fill="#22d3ee" fontSize={t.size} fontFamily="ui-monospace,monospace"
          textAnchor="middle" opacity={t.op}
          className="fade" style={{ animationDelay: `${1.1 + i * 0.12}s` }}>
          {t.text}
        </text>
      ))}

      {/* North arrow (top-right of blueprint area) */}
      <g transform="translate(620, 245)">
        <circle cx="0" cy="0" r="17"
          stroke="#22d3ee" strokeWidth="0.75" fill="none" opacity="0.28"
          className="draw-md" style={{ animationDelay: '3.5s' }} />
        <path d="M0,-14 L5,7 L0,3 L-5,7 Z"
          fill="#22d3ee" opacity="0.72"
          className="pop" style={{ transformOrigin: '620px 245px', animationDelay: '3.6s' }} />
        <text y="-21" x="0" fill="#22d3ee" fontSize="10" fontFamily="ui-monospace,monospace"
          textAnchor="middle" fontWeight="bold" opacity="0.55"
          className="fade" style={{ animationDelay: '3.7s' }}>N</text>
      </g>

      {/* Live indicator (top-right corner) */}
      <circle cx="665" cy="178" r="5" fill="#4ade80" className="pulse" style={{ animationDelay: '3.5s' }} />
      <circle cx="665" cy="178" r="5" fill="none" stroke="#4ade80" strokeWidth="1" opacity="0.4">
        <animate attributeName="r" from="5" to="18" dur="2.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" from="0.4" to="0" dur="2.8s" repeatCount="indefinite" />
      </circle>
      <text x="677" y="182" fill="#4ade80" fontSize="8" fontFamily="ui-monospace,monospace"
        opacity="0.75" className="fade" style={{ animationDelay: '3.9s' }}>
        EN VIVO
      </text>

      {/* Scan line sweeping across floor plan */}
      <rect x="30" y="155" width="2.5" height="355"
        fill="rgba(34,211,238,0.07)" className="scan" />

      {/* Moving dot on flow path (bottom of blueprint) */}
      <circle r="5" fill="#22d3ee" opacity="0.7">
        <animateMotion dur="5s" repeatCount="indefinite" rotate="auto">
          <mpath href="#flow-path" />
        </animateMotion>
        <animate attributeName="opacity" values="0.4;0.85;0.4" dur="1.2s" repeatCount="indefinite" />
      </circle>
      {/* Flow path label */}
      <text x="30" y="503" fill="#22d3ee" fontSize="7" fontFamily="ui-monospace,monospace" opacity="0.3"
        className="fade" style={{ animationDelay: '4s' }}>PRELIMINAR</text>
      <text x="448" y="503" fill="#22d3ee" fontSize="7" fontFamily="ui-monospace,monospace" opacity="0.3"
        className="fade" style={{ animationDelay: '4s' }}>ENTREGA</text>

      {/* Vignette layer (softens area where text overlay sits) */}
      <rect x="0" y="0" width="720" height="540" fill="url(#vignette)" />

      {/* ─────────────────────────────────────────
          ZONE B: AREA CHART (y 545–730, left half)
      ───────────────────────────────────────── */}

      {/* Container */}
      <rect x="28" y="545" width="328" height="178" rx="10"
        stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="rgba(255,255,255,0.035)"
        className="fade" style={{ animationDelay: '1.8s' }} />

      {/* Chart header */}
      <text x="44" y="568" fill="rgba(255,255,255,0.72)" fontSize="11" fontWeight="600"
        fontFamily="system-ui,sans-serif"
        className="fade" style={{ animationDelay: '2.0s' }}>
        Flujo de Caja
      </text>
      <text x="44" y="580" fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="ui-monospace,monospace"
        className="fade" style={{ animationDelay: '2.1s' }}>
        Ingresos vs Egresos — 6 meses
      </text>

      {/* Grid lines */}
      {[602, 620, 638, 656, 675, 693, 710].map((y, i) => (
        <line key={`cg${i}`} x1="44" y1={y} x2="348" y2={y}
          stroke="rgba(255,255,255,0.04)" strokeWidth="1"
          className="fade" style={{ animationDelay: '2.0s' }} />
      ))}

      {/* Area fill (static, fades in after line draws) */}
      <path
        d="M 44,710 60,692 95,678 135,655 175,660 215,640 255,632 295,618 335,624 348,614 348,715 44,715 Z"
        fill="url(#grad-chart)"
        className="fade" style={{ animationDelay: '3.4s' }} />

      {/* Chart polyline (draws) */}
      <polyline
        points="44,710 60,692 95,678 135,655 175,660 215,640 255,632 295,618 335,624 348,614"
        fill="none" stroke="#60a5fa" strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round"
        className="draw-chart" style={{ animationDelay: '2.2s' }} />

      {/* Live dot at chart end */}
      <circle cx="348" cy="614" r="4.5" fill="#60a5fa"
        className="fade" style={{ animationDelay: '4.2s' }} />
      <circle cx="348" cy="614" r="4.5" fill="none" stroke="#60a5fa" strokeWidth="1">
        <animate attributeName="r" from="4.5" to="14" dur="2.4s" begin="4.3s" repeatCount="indefinite" />
        <animate attributeName="opacity" from="0.5" to="0" dur="2.4s" begin="4.3s" repeatCount="indefinite" />
      </circle>

      {/* Month labels */}
      {['Oct', 'Nov', 'Dic', 'Ene', 'Feb', 'Mar'].map((m, i) => (
        <text key={m} x={44 + i * 61} y={726}
          fill="rgba(255,255,255,0.22)" fontSize="8" fontFamily="ui-monospace,monospace"
          className="fade" style={{ animationDelay: `${2.3 + i * 0.06}s` }}>
          {m}
        </text>
      ))}

      {/* ─────────────────────────────────────────
          ZONE C: BUDGET BARS (y 742–818, left half)
      ───────────────────────────────────────── */}

      <rect x="28" y="742" width="328" height="70" rx="10"
        stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="rgba(255,255,255,0.03)"
        className="fade" style={{ animationDelay: '2.0s' }} />

      <text x="44" y="761" fill="rgba(255,255,255,0.4)" fontSize="8.5"
        fontFamily="ui-monospace,monospace"
        className="fade" style={{ animationDelay: '2.2s' }}>
        PRESUPUESTO VS REAL
      </text>

      {/* Budget bar */}
      <rect x="44" y="769" width="298" height="10" rx="5" fill="rgba(255,255,255,0.07)"
        className="fade" style={{ animationDelay: '2.2s' }} />
      <rect x="44" y="769" height="10" rx="5" fill="#60a5fa" opacity="0.82" width="0">
        <animate attributeName="width" from="0" to="218"
          dur="1.2s" begin="2.8s" fill="freeze"
          calcMode="spline" keySplines="0.22 0 0.36 1" keyTimes="0;1" />
      </rect>

      {/* Real bar */}
      <rect x="44" y="784" width="298" height="10" rx="5" fill="rgba(255,255,255,0.07)"
        className="fade" style={{ animationDelay: '2.3s' }} />
      <rect x="44" y="784" height="10" rx="5" fill="#4ade80" opacity="0.75" width="0">
        <animate attributeName="width" from="0" to="178"
          dur="1.2s" begin="3.0s" fill="freeze"
          calcMode="spline" keySplines="0.22 0 0.36 1" keyTimes="0;1" />
      </rect>

      {/* Bar labels */}
      <text x="268" y="778" fill="rgba(96,165,250,0.85)" fontSize="7.5"
        fontFamily="ui-monospace,monospace"
        className="fade" style={{ animationDelay: '3.5s' }}>
        PPTO $1.2M
      </text>
      <text x="228" y="793" fill="rgba(74,222,128,0.85)" fontSize="7.5"
        fontFamily="ui-monospace,monospace"
        className="fade" style={{ animationDelay: '3.7s' }}>
        REAL $0.98M  −18%
      </text>

      {/* ─────────────────────────────────────────
          ZONE D: KPI CARDS (y 545–850, right half)
      ───────────────────────────────────────── */}

      {[
        { y: 545, label: 'Proyectos Activos', value: '3', sub: '+1 este mes', color: '#60a5fa', barW: 310 },
        { y: 655, label: 'Presupuesto Total', value: '$1.2M', sub: '3 proyectos activos', color: '#60a5fa', barW: 310 },
        { y: 765, label: 'Avance Promedio', value: '67%', sub: '+8% vs mes anterior', color: '#4ade80', barW: 310 },
      ].map((card, i) => (
        <g key={card.label} className="fade" style={{ animationDelay: `${2.0 + i * 0.2}s` }}>
          {/* Card background */}
          <rect x="368" y={card.y} width="324" height="98" rx="10"
            stroke="rgba(255,255,255,0.07)" strokeWidth="1"
            fill="rgba(255,255,255,0.04)" />

          {/* Animated top accent bar */}
          <rect x="368" y={card.y} height="2.5" rx="1"
            fill={card.color} opacity="0.65" width="0">
            <animate attributeName="width" from="0" to={`${card.barW}`}
              dur="0.9s" begin={`${2.3 + i * 0.2}s`} fill="freeze"
              calcMode="spline" keySplines="0.22 0 0.36 1" keyTimes="0;1" />
          </rect>

          {/* Label */}
          <text x="386" y={card.y + 22}
            fill="rgba(255,255,255,0.38)" fontSize="9" fontFamily="ui-monospace,monospace">
            {card.label}
          </text>

          {/* Value */}
          <text x="386" y={card.y + 58}
            fill="white" fontSize="32" fontWeight="800"
            fontFamily="system-ui,sans-serif" letterSpacing="-1">
            {card.value}
          </text>

          {/* Sub label */}
          <text x="386" y={card.y + 76}
            fill="rgba(255,255,255,0.28)" fontSize="8.5" fontFamily="ui-monospace,monospace">
            {card.sub}
          </text>

          {/* Status dot */}
          <circle cx="672" cy={card.y + 22} r="4"
            fill={i === 2 ? '#4ade80' : '#60a5fa'} opacity="0.8">
            <animate attributeName="opacity" values="0.8;0.3;0.8"
              dur="3s" begin={`${i * 0.9}s`} repeatCount="indefinite" />
          </circle>
        </g>
      ))}

      {/* ─────────────────────────────────────────
          ZONE E: ACTIVITY LOG (y 870–895)
      ───────────────────────────────────────── */}
      <g className="fade" style={{ animationDelay: '4.0s' }}>
        <rect x="28" y="832" width="664" height="50" rx="8"
          stroke="rgba(255,255,255,0.05)" strokeWidth="1" fill="rgba(255,255,255,0.025)" />

        {[
          { x: 44, label: '14:32 · Compra aprobada', color: '#60a5fa' },
          { x: 220, label: '14:18 · Avance registrado', color: '#4ade80' },
          { x: 418, label: '13:55 · Partida actualizada', color: '#f59e0b' },
          { x: 590, label: '13:30 · Reporte enviado', color: '#a78bfa' },
        ].map((item) => (
          <g key={item.label}>
            <circle cx={item.x} cy="857" r="3" fill={item.color} opacity="0.8" />
            <text x={item.x + 8} y="861"
              fill="rgba(255,255,255,0.32)" fontSize="8" fontFamily="ui-monospace,monospace">
              {item.label}
            </text>
          </g>
        ))}

        {/* Rotating numbers for financial panel */}
        <g textAnchor="end" fontFamily="ui-monospace,monospace" fontSize="8">
          <text x="692" y="853" fill="rgba(255,255,255,0.5)" className="c1">$ 12.450 ↑</text>
          <text x="692" y="853" fill="rgba(255,255,255,0.5)" className="c2">$ 18.920 ↑</text>
          <text x="692" y="853" fill="rgba(255,255,255,0.5)" className="c3">$ 24.100 ↑</text>
        </g>
      </g>

    </svg>
  )
}
