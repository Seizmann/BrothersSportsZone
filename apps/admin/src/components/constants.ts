// Day keys follow getDay(): 0=Sunday..6=Saturday, matching the day_prices /
// slot_config days keys and calculateBookingCost's lookup convention.
export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
