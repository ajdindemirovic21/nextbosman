export function getDonationUrl() {
  return process.env.NEXT_PUBLIC_DONATION_URL?.trim() || null;
}
