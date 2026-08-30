import { createContext, useContext, useState, ReactNode } from "react";

export type Lang = "en" | "hi";

// Flat translation dictionary. Keys are used across the dashboard; {vars} are interpolated.
const dict: Record<Lang, Record<string, string>> = {
  en: {
    adminDashboard: "Admin dashboard",
    "nav.home": "Home", "nav.orders": "Orders", "nav.catalog": "Catalog", "nav.customers": "Customers",

    today: "Today", ordersToday: "Orders today", confirmedSalesToday: "Confirmed sales today",
    ordersByStatus: "Orders by status (all time)", noOrdersYet: "No orders yet.",

    orders: "Orders", filterByStatus: "Filter by status", all: "All",
    created: "Created", customer: "Customer", source: "Source", summary: "Summary",
    total: "Total", status: "Status", noOrders: "No orders.", nItems: "{n} item(s)",

    partsAndPrice: "Parts & price", part: "Part", qty: "Qty", unit: "Unit ₹", line: "Line",
    noPartsMatched: "No parts matched yet.", addPartOption: "+ add part…", saveItems: "Save items",
    pricesShownMistri: "Prices shown are the mistri rate.", pricesShownFarmer: "Prices shown are the farmer rate.",
    subtotalDelivery: "Subtotal {s} + delivery {d}", totalLabel: "Total {t}",
    quoteAndUpi: "Quote & UPI", generateUpi: "Generate UPI link / QR", quoteSent: "Quote sent — share the UPI QR",
    sendToCustomer: "Send this to the customer:",
    confirmPaymentReceived: "Confirm payment received",
    verifyPaymentMsg: "Verify the amount actually landed in your UPI app, then enter the UPI reference (UTR). A screenshot is not proof.",
    utrLabel: "UTR / UPI ref", confirmedByLabel: "Confirmed by", yourName: "your name",
    markPaid: "Mark paid", paymentConfirmed: "Payment confirmed",
    dispatchOnBus: "Dispatch on bus", busRoute: "Bus route", conductor: "Conductor",
    dispatchGenerateOtp: "Dispatch & generate OTP", giveOtp: "Give this OTP to the customer (they show it at the bus stop):",
    confirmDeliveryOtp: "Confirm delivery (OTP)", onBusConductor: "On bus {route} · conductor {name}",
    otpFromCustomer: "OTP from customer", confirmDelivered: "Confirm delivered",
    payment: "Payment", by: "by",
    deliveredCashback: "Delivered ✓ · mistri cashback {amt}", deliveredOk: "Delivered ✓", loading: "Loading…",

    catalog: "Catalog", addPartTitle: "Add a part", name: "Name", brand: "Brand", modelFit: "Model fit",
    tier: "Tier", farmerPrice: "Farmer ₹", mistriPrice: "Mistri ₹", wholesale: "Wholesale ₹",
    stock: "Stock", add: "Add", autoDiscount: "auto −10%", searchParts: "Search parts…",
    search: "Search", noParts: "No parts yet.", fit: "Fit", auto: "auto",

    customers: "Customers", onboardWalkin: "Onboard a customer (walk-in)", phone: "Phone",
    type: "Type", channel: "Channel", searchNamePhone: "Search by name or phone…",
    ordersCol: "Orders", wallet: "Wallet",
    customerAdded: "Customer added — introduce both the app and WhatsApp at the counter.",
    noCustomers: "No customers yet.",

    signIn: "Sign in", email: "Email", password: "Password", logout: "Log out",
    loginTagline: "Shop admin — sign in to manage orders", allShops: "All shops",
    "type.FARMER": "Farmer", "type.MISTRI": "Mistri",
    "status.RECEIVED": "RECEIVED", "status.QUOTED": "QUOTED", "status.PAID": "PAID",
    "status.PACKED": "PACKED", "status.DISPATCHED": "DISPATCHED", "status.DELIVERED": "DELIVERED",
    "status.CANCELLED": "CANCELLED",
  },
  hi: {
    adminDashboard: "एडमिन डैशबोर्ड",
    "nav.home": "होम", "nav.orders": "ऑर्डर", "nav.catalog": "कैटलॉग", "nav.customers": "ग्राहक",

    today: "आज", ordersToday: "आज के ऑर्डर", confirmedSalesToday: "आज की पुष्ट बिक्री",
    ordersByStatus: "स्थिति अनुसार ऑर्डर (कुल)", noOrdersYet: "अभी कोई ऑर्डर नहीं।",

    orders: "ऑर्डर", filterByStatus: "स्थिति से छाँटें", all: "सभी",
    created: "बनाया गया", customer: "ग्राहक", source: "स्रोत", summary: "विवरण",
    total: "कुल", status: "स्थिति", noOrders: "कोई ऑर्डर नहीं।", nItems: "{n} वस्तु",

    partsAndPrice: "पार्ट्स और कीमत", part: "पार्ट", qty: "मात्रा", unit: "प्रति ₹", line: "योग",
    noPartsMatched: "अभी कोई पार्ट नहीं जोड़ा।", addPartOption: "+ पार्ट जोड़ें…", saveItems: "आइटम सेव करें",
    pricesShownMistri: "दिखाई गई कीमतें मिस्त्री रेट हैं।", pricesShownFarmer: "दिखाई गई कीमतें किसान रेट हैं।",
    subtotalDelivery: "उप-योग {s} + डिलीवरी {d}", totalLabel: "कुल {t}",
    quoteAndUpi: "कोटेशन और UPI", generateUpi: "UPI लिंक / QR बनाएँ", quoteSent: "कोटेशन भेजा — UPI QR साझा करें",
    sendToCustomer: "ग्राहक को यह भेजें:",
    confirmPaymentReceived: "भुगतान प्राप्ति की पुष्टि करें",
    verifyPaymentMsg: "पहले अपने UPI ऐप में राशि आना सुनिश्चित करें, फिर UPI रेफरेंस (UTR) डालें। स्क्रीनशॉट प्रमाण नहीं है।",
    utrLabel: "UTR / UPI रेफ", confirmedByLabel: "किसने पुष्टि की", yourName: "आपका नाम",
    markPaid: "भुगतान दर्ज करें", paymentConfirmed: "भुगतान की पुष्टि हुई",
    dispatchOnBus: "बस से भेजें", busRoute: "बस रूट", conductor: "कंडक्टर",
    dispatchGenerateOtp: "भेजें और OTP बनाएँ", giveOtp: "यह OTP ग्राहक को दें (वे बस स्टॉप पर दिखाएँगे):",
    confirmDeliveryOtp: "डिलीवरी की पुष्टि (OTP)", onBusConductor: "बस {route} पर · कंडक्टर {name}",
    otpFromCustomer: "ग्राहक से OTP", confirmDelivered: "डिलीवरी पुष्टि करें",
    payment: "भुगतान", by: "द्वारा",
    deliveredCashback: "डिलीवर ✓ · मिस्त्री कैशबैक {amt}", deliveredOk: "डिलीवर ✓", loading: "लोड हो रहा है…",

    catalog: "कैटलॉग", addPartTitle: "पार्ट जोड़ें", name: "नाम", brand: "ब्रांड", modelFit: "मॉडल फिट",
    tier: "श्रेणी", farmerPrice: "किसान ₹", mistriPrice: "मिस्त्री ₹", wholesale: "थोक ₹",
    stock: "स्टॉक", add: "जोड़ें", autoDiscount: "ऑटो −10%", searchParts: "पार्ट्स खोजें…",
    search: "खोजें", noParts: "अभी कोई पार्ट नहीं।", fit: "फिट", auto: "ऑटो",

    customers: "ग्राहक", onboardWalkin: "ग्राहक जोड़ें (वॉक-इन)", phone: "फोन",
    type: "प्रकार", channel: "चैनल", searchNamePhone: "नाम या फोन से खोजें…",
    ordersCol: "ऑर्डर", wallet: "वॉलेट",
    customerAdded: "ग्राहक जोड़ा गया — काउंटर पर ऐप और WhatsApp दोनों बताएँ।",
    noCustomers: "अभी कोई ग्राहक नहीं।",

    signIn: "साइन इन", email: "ईमेल", password: "पासवर्ड", logout: "लॉग आउट",
    loginTagline: "शॉप एडमिन — ऑर्डर प्रबंधन के लिए साइन इन करें", allShops: "सभी शॉप",
    "type.FARMER": "किसान", "type.MISTRI": "मिस्त्री",
    "status.RECEIVED": "मिला", "status.QUOTED": "कोटेड", "status.PAID": "भुगतान",
    "status.PACKED": "पैक", "status.DISPATCHED": "भेजा", "status.DELIVERED": "डिलीवर",
    "status.CANCELLED": "रद्द",
  },
};

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string, vars?: Record<string, string | number>) => string };
const LangContext = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (k) => k });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>((localStorage.getItem("kg_lang") as Lang) || "en");
  const setLang = (l: Lang) => { localStorage.setItem("kg_lang", l); setLangState(l); };
  const t = (key: string, vars?: Record<string, string | number>) => {
    let s = dict[lang][key] ?? dict.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  };
  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export const useI18n = () => useContext(LangContext);
