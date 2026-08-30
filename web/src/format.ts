// Money helpers — the API speaks paise; the UI speaks rupees.
export const paiseToRupees = (paise: number) => paise / 100;

export const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

// Rupees typed in a form → integer paise for the API.
export const rupeesToPaise = (r: string | number) => Math.round(Number(r) * 100);

export const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
