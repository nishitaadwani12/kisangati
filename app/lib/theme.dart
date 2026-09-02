import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// KisanGati app theming. A palette can be swapped at runtime; the root
/// MaterialApp listens to [appTheme] and rebuilds. Kept in sync with the
/// dashboard's palettes (web/src/theme.tsx + styles.css).
class AppPalette {
  final String id;      // "" = default (Kisan Modern)
  final String label;
  final Color seed;     // primary brand / CTAs
  final Color amber;    // secondary accent (highlights, cashback)
  final Color header;   // app bar background
  final Color onHeader; // app bar foreground (text/icons)
  final Color bg;       // scaffold background
  final Color surface;  // cards / sheets
  final Color tint;     // soft info panels (e.g. new-order hint, wallet card)
  final Color muted;    // secondary text
  final Brightness brightness;
  final Map<String, Color> status;

  const AppPalette({
    required this.id,
    required this.label,
    required this.seed,
    required this.amber,
    required this.header,
    required this.onHeader,
    required this.bg,
    required this.surface,
    required this.tint,
    required this.muted,
    required this.brightness,
    required this.status,
  });

  Color statusColor(String s) => status[s] ?? (s == 'DELIVERED' ? seed : status['RECEIVED']!);
}

const _lightStatus = {
  'RECEIVED': Color(0xFF6B7280), 'QUOTED': Color(0xFFB7791F), 'PAID': Color(0xFF0B7A5B),
  'PACKED': Color(0xFF1D4ED8), 'DISPATCHED': Color(0xFF6D28D9), 'CANCELLED': Color(0xFFC0392B),
};
const _darkStatus = {
  'RECEIVED': Color(0xFF94A3B8), 'QUOTED': Color(0xFFEAB308), 'PAID': Color(0xFF34D399),
  'PACKED': Color(0xFF60A5FA), 'DISPATCHED': Color(0xFFA78BFA), 'CANCELLED': Color(0xFFF87171),
};

const kisanModern = AppPalette(
  id: '', label: 'Kisan Modern',
  seed: Color(0xFF0F7A54), amber: Color(0xFFE08A2E),
  header: Color(0xFF0F7A54), onHeader: Colors.white,
  bg: Color(0xFFF5F9F6), surface: Color(0xFFFFFFFF), tint: Color(0xFFE7F3EC),
  muted: Color(0xFF5F7169), brightness: Brightness.light, status: _lightStatus,
);
const harvestEarth = AppPalette(
  id: 'harvest', label: 'Harvest Earth',
  seed: Color(0xFFC2410C), amber: Color(0xFFB45309),
  header: Color(0xFFC2410C), onHeader: Colors.white,
  bg: Color(0xFFFAF6F0), surface: Color(0xFFFFFDFA), tint: Color(0xFFF6E9DE),
  muted: Color(0xFF7C6A5C), brightness: Brightness.light, status: _lightStatus,
);
const trustIndigo = AppPalette(
  id: 'indigo', label: 'Trust Indigo',
  seed: Color(0xFF4F46E5), amber: Color(0xFF0D9488),
  header: Color(0xFF4F46E5), onHeader: Colors.white,
  bg: Color(0xFFF7F8FC), surface: Color(0xFFFFFFFF), tint: Color(0xFFE8EAFB),
  muted: Color(0xFF64748B), brightness: Brightness.light, status: _lightStatus,
);
const slateDark = AppPalette(
  id: 'dark', label: 'Slate Dark',
  seed: Color(0xFF34D399), amber: Color(0xFFFBBF24),
  header: Color(0xFF17201C), onHeader: Color(0xFFE6EDEA),
  bg: Color(0xFF0F1512), surface: Color(0xFF17201C), tint: Color(0xFF14261E),
  muted: Color(0xFF93A49C), brightness: Brightness.dark, status: _darkStatus,
);

const palettes = [kisanModern, harvestEarth, trustIndigo, slateDark];

/// Active palette. The root MaterialApp rebuilds when this changes.
final ValueNotifier<AppPalette> appTheme = ValueNotifier<AppPalette>(kisanModern);

AppPalette _byId(String id) => palettes.firstWhere((p) => p.id == id, orElse: () => kisanModern);

Future<void> loadTheme() async {
  final p = await SharedPreferences.getInstance();
  appTheme.value = _byId(p.getString('kg_theme') ?? '');
}

Future<void> setTheme(String id) async {
  appTheme.value = _byId(id);
  final p = await SharedPreferences.getInstance();
  await p.setString('kg_theme', id);
}

ThemeData buildTheme(AppPalette p) {
  final scheme = ColorScheme.fromSeed(seedColor: p.seed, brightness: p.brightness).copyWith(
    primary: p.seed,
    surface: p.surface,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: p.bg,
    appBarTheme: AppBarTheme(backgroundColor: p.header, foregroundColor: p.onHeader, elevation: 0),
    cardTheme: CardThemeData(
      color: p.surface, elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: scheme.outlineVariant.withValues(alpha: 0.5)),
      ),
    ),
    inputDecorationTheme: const InputDecorationTheme(border: OutlineInputBorder()),
  );
}

/// A palette icon that opens a bottom sheet to switch themes. Use in AppBar actions.
class ThemePaletteButton extends StatelessWidget {
  const ThemePaletteButton({super.key});
  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Theme',
      icon: const Icon(Icons.palette_outlined),
      onPressed: () => showModalBottomSheet(
        context: context,
        showDragHandle: true,
        builder: (_) => ValueListenableBuilder<AppPalette>(
          valueListenable: appTheme,
          builder: (_, active, _) => SafeArea(
            child: Column(mainAxisSize: MainAxisSize.min, children: palettes.map((p) {
              return ListTile(
                leading: CircleAvatar(backgroundColor: p.seed, radius: 13,
                  child: Container(width: 10, height: 10,
                    decoration: BoxDecoration(color: p.amber, shape: BoxShape.circle))),
                title: Text(p.label),
                trailing: active.id == p.id ? Icon(Icons.check, color: p.seed) : null,
                onTap: () { setTheme(p.id); Navigator.of(context).pop(); },
              );
            }).toList()),
          ),
        ),
      ),
    );
  }
}

/// Inline palette dots (used on the login screen).
class ThemeDots extends StatelessWidget {
  const ThemeDots({super.key});
  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<AppPalette>(
      valueListenable: appTheme,
      builder: (_, active, _) => Row(mainAxisAlignment: MainAxisAlignment.center, mainAxisSize: MainAxisSize.min,
        children: palettes.map((p) {
          final on = active.id == p.id;
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 5),
            child: GestureDetector(
              onTap: () => setTheme(p.id),
              child: Container(
                width: 26, height: 26,
                decoration: BoxDecoration(
                  color: p.seed, shape: BoxShape.circle,
                  border: Border.all(color: on ? p.seed : Colors.transparent, width: 2),
                  boxShadow: on ? [BoxShadow(color: p.seed.withValues(alpha: 0.4), blurRadius: 6)] : null,
                ),
                child: on ? const Icon(Icons.check, size: 14, color: Colors.white) : null,
              ),
            ),
          );
        }).toList()),
    );
  }
}
