// Prices are stored as integer öre throughout the stack; formatting to
// kronor happens only here, at the display boundary.
const sek = new Intl.NumberFormat('sv-SE', {
  style: 'currency',
  currency: 'SEK',
  maximumFractionDigits: 0,
});

export const formatPrice = (ore: number) => sek.format(ore / 100);
