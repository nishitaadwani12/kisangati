import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Current app language. The root MaterialApp listens to this and rebuilds on change.
final ValueNotifier<String> appLang = ValueNotifier<String>('en');

Future<void> loadLang() async {
  final p = await SharedPreferences.getInstance();
  appLang.value = p.getString('kg_lang') ?? 'en';
}

Future<void> setLang(String l) async {
  final p = await SharedPreferences.getInstance();
  await p.setString('kg_lang', l);
  appLang.value = l;
}

String t(String key) => _dict[appLang.value]?[key] ?? _dict['en']![key] ?? key;

const Map<String, Map<String, String>> _dict = {
  'en': {
    'tagline': 'Order tractor parts from your shop',
    'shop': 'Shop', 'phone': 'Phone', 'phoneHint': '10-digit mobile', 'sendCode': 'Send code',
    'nameOptional': 'Your name (optional)', 'enterCode': 'Enter code', 'verifySignIn': 'Verify & sign in',
    'myOrders': 'My Orders', 'newOrder': 'New Order', 'catalog': 'Catalog', 'wallet': 'Wallet',
    'noOrders': 'No orders yet.', 'nItems': '{n} item(s)',
    'ordersEmptyHint': 'Tap "New Order" to place your first one.',
    'newOrderHint': 'Type, photograph, or record the part you need. The shop confirms the price and messages you.',
    'describePart': 'Describe the part you need', 'hintPart': 'e.g. Swaraj 855 clutch plate',
    'orAttach': '…or attach a photo / voice note', 'camera': 'Camera', 'photo': 'Photo',
    'voiceNote': 'Voice note', 'stop': 'Stop', 'voiceAttached': 'Voice note attached',
    'sendOrder': 'Send order', 'sending': 'Sending…',
    'addSomething': 'Add a description, a photo, or a voice note.',
    'orderSent': 'Order sent! The shop will confirm the price shortly.',
    'micDenied': 'Microphone permission denied',
    'noParts': 'No parts in the catalog yet.', 'order': 'Order', 'ordered': 'Ordered {name} — check My Orders',
    'add': 'Add', 'placeOrder': 'Place order', 'cartSummary': '{n} item(s) · {total}', 'orderPlaced': 'Order placed — check My Orders',
    'cashbackBalance': 'Cashback balance', 'noTxns': 'No transactions yet.', 'cashback': 'Cashback', 'payout': 'Payout',
    'orderTitle': 'Order', 'items': 'Items', 'total': 'Total', 'payment': 'Payment', 'qty': 'Qty',
    'reorder': 'Reorder', 'reordered': 'Re-ordered — check My Orders',
    'play': 'Play voice note', 'pause': 'Pause', 'photoLabel': 'Photo', 'voiceLabel': 'Voice note',
    'status.RECEIVED': 'Received', 'status.QUOTED': 'Quoted', 'status.PAID': 'Paid',
    'status.PACKED': 'Packed', 'status.DISPATCHED': 'Dispatched', 'status.DELIVERED': 'Delivered', 'status.CANCELLED': 'Cancelled',
  },
  'hi': {
    'tagline': 'अपनी दुकान से ट्रैक्टर पार्ट्स ऑर्डर करें',
    'shop': 'दुकान', 'phone': 'फ़ोन', 'phoneHint': '10 अंकों का मोबाइल', 'sendCode': 'कोड भेजें',
    'nameOptional': 'आपका नाम (वैकल्पिक)', 'enterCode': 'कोड डालें', 'verifySignIn': 'सत्यापित करें और साइन इन करें',
    'myOrders': 'मेरे ऑर्डर', 'newOrder': 'नया ऑर्डर', 'catalog': 'कैटलॉग', 'wallet': 'वॉलेट',
    'noOrders': 'अभी कोई ऑर्डर नहीं।', 'nItems': '{n} वस्तु',
    'ordersEmptyHint': 'पहला ऑर्डर करने के लिए "नया ऑर्डर" दबाएँ।',
    'newOrderHint': 'जो पार्ट चाहिए उसे लिखें, फ़ोटो लें या बोलकर रिकॉर्ड करें। दुकान कीमत बताकर आपको मैसेज करेगी।',
    'describePart': 'जो पार्ट चाहिए उसे बताएँ', 'hintPart': 'जैसे: Swaraj 855 क्लच प्लेट',
    'orAttach': '…या फ़ोटो / वॉइस नोट लगाएँ', 'camera': 'कैमरा', 'photo': 'फ़ोटो',
    'voiceNote': 'वॉइस नोट', 'stop': 'रोकें', 'voiceAttached': 'वॉइस नोट लगा',
    'sendOrder': 'ऑर्डर भेजें', 'sending': 'भेजा जा रहा है…',
    'addSomething': 'विवरण, फ़ोटो या वॉइस नोट जोड़ें।',
    'orderSent': 'ऑर्डर भेज दिया! दुकान जल्दी कीमत बताएगी।',
    'micDenied': 'माइक्रोफ़ोन अनुमति नहीं मिली',
    'noParts': 'अभी कैटलॉग में कोई पार्ट नहीं।', 'order': 'ऑर्डर करें', 'ordered': '{name} ऑर्डर किया — मेरे ऑर्डर देखें',
    'add': 'जोड़ें', 'placeOrder': 'ऑर्डर करें', 'cartSummary': '{n} वस्तु · {total}', 'orderPlaced': 'ऑर्डर हो गया — मेरे ऑर्डर देखें',
    'cashbackBalance': 'कैशबैक बैलेंस', 'noTxns': 'अभी कोई लेन-देन नहीं।', 'cashback': 'कैशबैक', 'payout': 'पेआउट',
    'orderTitle': 'ऑर्डर', 'items': 'सामान', 'total': 'कुल', 'payment': 'भुगतान', 'qty': 'मात्रा',
    'reorder': 'फिर से ऑर्डर करें', 'reordered': 'फिर से ऑर्डर किया — मेरे ऑर्डर देखें',
    'play': 'वॉइस नोट सुनें', 'pause': 'रोकें', 'photoLabel': 'फ़ोटो', 'voiceLabel': 'वॉइस नोट',
    'status.RECEIVED': 'मिला', 'status.QUOTED': 'कोटेड', 'status.PAID': 'भुगतान',
    'status.PACKED': 'पैक', 'status.DISPATCHED': 'भेजा', 'status.DELIVERED': 'डिलीवर', 'status.CANCELLED': 'रद्द',
  },
};

/// Small HI | EN toggle used on the login screen and in the app bar.
class LangToggle extends StatelessWidget {
  final Color? color;
  const LangToggle({super.key, this.color});
  @override
  Widget build(BuildContext context) {
    final c = color ?? Colors.white;
    Widget btn(String code, String label) => TextButton(
          onPressed: () => setLang(code),
          style: TextButton.styleFrom(
            minimumSize: const Size(40, 36),
            foregroundColor: c,
            backgroundColor: appLang.value == code ? c.withValues(alpha: 0.22) : null,
          ),
          child: Text(label),
        );
    return Row(mainAxisSize: MainAxisSize.min, children: [btn('hi', 'हिं'), btn('en', 'EN')]);
  }
}
