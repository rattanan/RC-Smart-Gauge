"use client";
export default function Gauge({
  rpm,
  gear,
  active,
}: {
  rpm: number;
  gear: number;
  active: boolean;
}) {
  const angle = (value: number) => 135 + (value / 8000) * 270;
  const point = (degrees: number, r: number) => ({
    x: Number((180 + Math.cos((degrees * Math.PI) / 180) * r).toFixed(3)),
    y: Number((180 + Math.sin((degrees * Math.PI) / 180) * r).toFixed(3)),
  });
  const needle = point(angle(rpm), 126);
  return (
    <div className={`dial ${active ? "" : "dial-stale"}`}>
      <svg
        viewBox="0 0 360 340"
        aria-label={`Simulated RPM ${Math.round(rpm)}, simulated gear ${gear}`}
        role="img"
      >
        <defs>
          <linearGradient id="arcColor">
            <stop stopColor="#00e7ee" />
            <stop offset=".54" stopColor="#00d5fb" />
            <stop offset=".76" stopColor="#b05ce9" />
            <stop offset="1" stopColor="#ff3657" />
          </linearGradient>
        </defs>
        <path
          d="M 68.3 291.7 A 158 158 0 1 1 291.7 291.7"
          fill="none"
          stroke="#183646"
          strokeWidth="14"
        />
        <path
          d="M 68.3 291.7 A 158 158 0 1 1 291.7 291.7"
          fill="none"
          stroke="url(#arcColor)"
          strokeWidth="4"
        />
        {Array.from({ length: 65 }, (_, i) => {
          const a = angle(i * 125),
            p = point(a, 148),
            q = point(a, i % 8 === 0 ? 132 : 140);
          return (
            <line
              key={i}
              x1={p.x}
              y1={p.y}
              x2={q.x}
              y2={q.y}
              stroke={i < 36 ? "#00dfe9" : i < 49 ? "#ad6de9" : "#ff355c"}
              strokeWidth={i % 8 === 0 ? 4 : 2}
            />
          );
        })}
        {[0, 2, 4, 6, 8].map((n) => {
          const p = point(angle(n * 1000), 111);
          return (
            <text
              key={n}
              x={p.x}
              y={p.y + 7}
              textAnchor="middle"
              fill="#e7f3f9"
              fontSize="22"
              fontWeight="700"
            >
              {n}
            </text>
          );
        })}
        {active && (
          <>
            <line
              x1="180"
              y1="180"
              x2={needle.x}
              y2={needle.y}
              stroke="#8cfcff"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <circle cx="180" cy="180" r="7" fill="#00dfe9" />
          </>
        )}
        <text
          x="180"
          y="256"
          textAnchor="middle"
          fill="#45f5fc"
          fontSize="43"
          fontWeight="750"
          fontFamily="monospace"
        >
          {active ? Math.round(rpm).toLocaleString("en-US") : "—"}
        </text>
        <text
          x="180"
          y="277"
          textAnchor="middle"
          fill="#66b9d1"
          fontSize="13"
          letterSpacing="2"
        >
          SIM RPM
        </text>
        <text
          x="180"
          y="311"
          textAnchor="middle"
          fill="#00dfe9"
          fontSize="28"
          fontWeight="700"
        >
          {active ? gear : "—"}
          <tspan fontSize="11" dx="8">
            SIM GEAR
          </tspan>
        </text>
      </svg>
    </div>
  );
}
