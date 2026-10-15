export const nbMarkPlate =
  "M7 2h13.5L30 11.5V25a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Z";
export const nbMarkN =
  "M5.4 8.1h2.85L11.7 16.4V8.1h2.7v15.8h-2.85L8.1 15.5v8.4H5.4V8.1Z";
export const nbMarkB =
  "M16.9 8.1h4.15c2.45 0 4 1.3 4 3.35 0 1.15-.65 2.1-1.75 2.55 1.3.4 2.15 1.4 2.15 3.05 0 2.2-1.8 3.85-4.55 3.85H16.9V8.1Zm2.7 2.2v3.15h.95c.95 0 1.5-.5 1.5-1.58 0-1.05-.55-1.57-1.48-1.57H19.6Zm0 5.3v4.5h1.2c1.15 0 1.85-.6 1.85-2.28 0-1.22-.7-2.22-1.85-2.22H19.6Z";

type GraphicProps = {
  size: number;
  color?: string;
};

export function NbMarkGraphic({ size, color = "#eef3f8" }: GraphicProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path d={nbMarkPlate} fill={color} fillOpacity="0.2" />
      <path d={nbMarkN} fill={color} />
      <path d={nbMarkB} fill={color} fillRule="evenodd" />
    </svg>
  );
}

export function LogoMark() {
  return (
    <svg
      className="mark-nb"
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <path className="mark-nb-plate" d={nbMarkPlate} />
      <path className="mark-nb-letters" d={nbMarkN} />
      <path className="mark-nb-letters" fillRule="evenodd" d={nbMarkB} />
    </svg>
  );
}
