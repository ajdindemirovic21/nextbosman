export function LogoMark() {
  return (
    <svg
      className="mark-ball"
      viewBox="0 0 48 48"
      width={40}
      height={40}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="nb-leather" cx="32%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#e8e8e8" />
          <stop offset="100%" stopColor="#c4c4c4" />
        </radialGradient>
        <radialGradient id="nb-shade" cx="30%" cy="26%" r="78%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="62%" stopColor="#020617" stopOpacity="0" />
          <stop offset="100%" stopColor="#020617" stopOpacity="0.42" />
        </radialGradient>
        <clipPath id="nb-sphere">
          <circle cx="24" cy="24" r="21.2" />
        </clipPath>
      </defs>

      <circle cx="24" cy="24" r="22" fill="#020617" />
      <g clipPath="url(#nb-sphere)">
        <circle cx="24" cy="24" r="21.2" fill="url(#nb-leather)" />

        <polygon
          fill="#111111"
          points="4.10,29.94 4.66,31.34 9.45,38.30 11.86,41.19 8.55,36.03"
        />
        <polygon
          fill="#111111"
          points="19.67,44.46 25.07,44.84 32.92,43.17 32.37,41.77 24.18,42.57"
        />
        <polygon
          fill="#111111"
          points="8.66,20.05 12.05,12.29 9.64,9.39 4.76,15.36 4.15,21.95"
        />
        <polygon
          fill="#111111"
          points="33.94,30.63 37.25,35.80 42.68,31.23 42.74,23.25 37.33,22.87"
        />
        <polygon
          fill="#111111"
          points="32.54,15.91 33.15,9.33 25.33,6.06 19.90,10.62 24.35,16.71"
        />
        <polygon
          fill="#111111"
          points="20.87,37.40 25.75,31.43 20.96,24.47 13.11,26.14 13.06,34.13"
        />

        <g
          fill="none"
          stroke="#0a0a0a"
          strokeWidth="0.9"
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <polygon points="43.85,26.05 43.90,18.06 43.34,16.66 42.74,23.25 42.68,31.23 43.24,32.64" />
          <polygon points="32.92,43.17 38.36,38.61 43.24,32.64 42.68,31.23 37.25,35.80 32.37,41.77" />
          <polygon points="22.93,3.16 25.33,6.06 33.15,9.33 38.55,9.70 36.14,6.81 28.33,3.54" />
          <polygon points="15.08,4.83 9.64,9.39 12.05,12.29 19.90,10.62 25.33,6.06 22.93,3.16" />
          <polygon points="13.06,34.13 8.55,36.03 11.86,41.19 19.67,44.46 24.18,42.57 20.87,37.40" />
          <polygon points="32.54,15.91 37.33,22.87 42.74,23.25 43.34,16.66 38.55,9.70 33.15,9.33" />
          <polygon points="13.11,26.14 8.66,20.05 4.15,21.95 4.10,29.94 8.55,36.03 13.06,34.13" />
          <polygon points="20.87,37.40 24.18,42.57 32.37,41.77 37.25,35.80 33.94,30.63 25.75,31.43" />
          <polygon points="20.96,24.47 24.35,16.71 19.90,10.62 12.05,12.29 8.66,20.05 13.11,26.14" />
          <polygon points="25.75,31.43 33.94,30.63 37.33,22.87 32.54,15.91 24.35,16.71 20.96,24.47" />
          <polygon points="4.10,29.94 4.66,31.34 9.45,38.30 11.86,41.19 8.55,36.03" />
          <polygon points="19.67,44.46 25.07,44.84 32.92,43.17 32.37,41.77 24.18,42.57" />
          <polygon points="8.66,20.05 12.05,12.29 9.64,9.39 4.76,15.36 4.15,21.95" />
          <polygon points="33.94,30.63 37.25,35.80 42.68,31.23 42.74,23.25 37.33,22.87" />
          <polygon points="32.54,15.91 33.15,9.33 25.33,6.06 19.90,10.62 24.35,16.71" />
          <polygon points="20.87,37.40 25.75,31.43 20.96,24.47 13.11,26.14 13.06,34.13" />
        </g>

        <circle cx="24" cy="24" r="21.2" fill="url(#nb-shade)" />
        <ellipse cx="16.5" cy="14.5" rx="7.2" ry="4.4" fill="#fff" opacity="0.22" />
      </g>
      <circle cx="24" cy="24" r="21.2" fill="none" stroke="#e2e8f0" strokeWidth="1.15" />
    </svg>
  );
}
