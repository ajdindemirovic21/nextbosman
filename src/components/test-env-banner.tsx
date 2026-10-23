export function TestEnvBanner() {
  if (process.env.NEXT_PUBLIC_TEST_INSTANCE !== "1") return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-[80] bg-amber-400 px-3 py-2 text-center text-sm font-extrabold tracking-wide text-black"
    >
      TESTNO OKRUŽENJE — nije produkcija
    </div>
  );
}
