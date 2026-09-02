import 'package:flutter/material.dart';

/// KisanGati app theme — a single modern palette (emerald→teal brand gradient,
/// soft depth). Kept in sync with the dashboard (web/src/styles.css).
class AppPalette {
  final Color seed;      // primary brand / CTAs
  final Color amber;     // secondary accent (highlights, cashback)
  final Color onHeader;  // app bar / gradient foreground
  final Color bg;        // scaffold background
  final Color surface;   // cards / sheets
  final Color tint;      // soft info panels (hint, wallet card)
  final Color muted;     // secondary text
  final Map<String, Color> status;

  const AppPalette({
    required this.seed, required this.amber, required this.onHeader,
    required this.bg, required this.surface, required this.tint,
    required this.muted, required this.status,
  });

  Color statusColor(String s) => status[s] ?? (s == 'DELIVERED' ? seed : status['RECEIVED']!);

  LinearGradient get brandGradient => const LinearGradient(
        colors: [Color(0xFF16B981), Color(0xFF0B8F63)],
        begin: Alignment.topLeft, end: Alignment.bottomRight,
      );
}

/// The single active palette.
const AppPalette kg = AppPalette(
  seed: Color(0xFF0F9D63), amber: Color(0xFFF59E0B), onHeader: Colors.white,
  bg: Color(0xFFF1F7F4), surface: Color(0xFFFFFFFF), tint: Color(0xFFE7F5EE),
  muted: Color(0xFF5B6F67),
  status: {
    'RECEIVED': Color(0xFF64748B), 'QUOTED': Color(0xFFD97706), 'PAID': Color(0xFF0F9D63),
    'PACKED': Color(0xFF2563EB), 'DISPATCHED': Color(0xFF7C3AED), 'CANCELLED': Color(0xFFE5484D),
  },
);

ThemeData buildTheme(AppPalette p) {
  final scheme = ColorScheme.fromSeed(seedColor: p.seed).copyWith(primary: p.seed, surface: p.surface);
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: p.bg,
    appBarTheme: AppBarTheme(
      backgroundColor: p.seed, foregroundColor: p.onHeader, elevation: 0, scrolledUnderElevation: 0,
    ),
    cardTheme: CardThemeData(
      color: p.surface, elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: scheme.outlineVariant.withValues(alpha: 0.5)),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true, fillColor: p.surface,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: scheme.outlineVariant),
      ),
    ),
  );
}

/// A gradient app bar bottom decoration. Set as AppBar.flexibleSpace to give the
/// header the brand gradient instead of a flat fill.
Widget gradientHeader() => Container(decoration: BoxDecoration(gradient: kg.brandGradient));
