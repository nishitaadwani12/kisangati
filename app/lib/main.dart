import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:image_picker/image_picker.dart';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import 'api.dart';
import 'i18n.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Api.loadToken();
  await loadLang();
  runApp(const KisanGatiApp());
}

const green = Color(0xFF1F7A4D);

Color _statusColor(String s) {
  switch (s) {
    case 'QUOTED': return const Color(0xFFB7791F);
    case 'PAID': return const Color(0xFF0B6B53);
    case 'PACKED': return const Color(0xFF1D4ED8);
    case 'DISPATCHED': return const Color(0xFF6D28D9);
    case 'DELIVERED': return green;
    case 'CANCELLED': return const Color(0xFFB91C1C);
    default: return const Color(0xFF6B7280); // RECEIVED / unknown
  }
}

class StatusChip extends StatelessWidget {
  final String status;
  const StatusChip(this.status, {super.key});
  @override
  Widget build(BuildContext context) {
    final c = _statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(color: c.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20), border: Border.all(color: c.withValues(alpha: 0.4))),
      child: Text(t('status.$status'), style: TextStyle(color: c, fontWeight: FontWeight.w600, fontSize: 12)),
    );
  }
}

class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? hint;
  const EmptyState({super.key, required this.icon, required this.title, this.hint});
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 56, color: Colors.black26),
          const SizedBox(height: 12),
          Text(title, style: const TextStyle(fontSize: 16, color: Colors.black54), textAlign: TextAlign.center),
          if (hint != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(hint!, style: const TextStyle(color: Colors.black38), textAlign: TextAlign.center)),
        ]),
      ),
    );
  }
}

class KisanGatiApp extends StatefulWidget {
  const KisanGatiApp({super.key});
  @override
  State<KisanGatiApp> createState() => _KisanGatiAppState();
}

class _KisanGatiAppState extends State<KisanGatiApp> {
  bool get loggedIn => Api.token != null;

  void _refresh() => setState(() {});

  @override
  Widget build(BuildContext context) {
    // Rebuild the whole app when the language changes.
    return ValueListenableBuilder<String>(
      valueListenable: appLang,
      builder: (_, _, _) => MaterialApp(
        title: 'KisanGati',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(colorSchemeSeed: green, useMaterial3: true),
        home: loggedIn ? HomeScreen(onLogout: _refresh) : LoginScreen(onLoggedIn: _refresh),
      ),
    );
  }
}

// ---------------- Login ----------------
class LoginScreen extends StatefulWidget {
  final VoidCallback onLoggedIn;
  const LoginScreen({super.key, required this.onLoggedIn});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  List _shops = [];
  String? _shopId;
  final _phone = TextEditingController();
  final _name = TextEditingController();
  final _code = TextEditingController();
  bool _otpSent = false;
  String _err = '';
  String _info = '';
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    Api.shops().then((s) { if (!mounted) return; setState(() { _shops = s; if (s.isNotEmpty) _shopId = s.first['id']; }); })
        .catchError((e) { if (mounted) setState(() => _err = '$e'); });
  }

  @override
  void dispose() { _phone.dispose(); _name.dispose(); _code.dispose(); super.dispose(); }

  // Farmers type only their 10 digits; we always send E.164 with the India +91 prefix.
  String get _fullPhone {
    final digits = _phone.text.replaceAll(RegExp(r'\D'), '');
    final ten = digits.length > 10 ? digits.substring(digits.length - 10) : digits;
    return '+91$ten';
  }

  Future<void> _requestOtp() async {
    setState(() { _err = ''; _info = ''; _busy = true; });
    try {
      final r = await Api.requestOtp(_shopId!, _fullPhone);
      if (!mounted) return;
      setState(() { _otpSent = true; if (r['devCode'] != null) { _code.text = r['devCode']; _info = 'Dev code: ${r['devCode']}'; } });
    } catch (e) { if (mounted) setState(() => _err = '$e'); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  Future<void> _verify() async {
    setState(() { _err = ''; _busy = true; });
    try {
      await Api.verifyOtp(_shopId!, _fullPhone, _code.text.trim(), _name.text.trim());
      widget.onLoggedIn();
    } catch (e) { if (mounted) setState(() => _err = '$e'); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 380),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Align(alignment: Alignment.centerRight, child: LangToggle(color: green)),
              const Text('KisanGati', style: TextStyle(fontSize: 34, fontWeight: FontWeight.bold, color: green)),
              const SizedBox(height: 4),
              Text(t('tagline'), style: const TextStyle(color: Colors.black54)),
              const SizedBox(height: 24),
              if (_err.isNotEmpty) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(_err, style: const TextStyle(color: Colors.red))),
              if (_info.isNotEmpty) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(_info, style: const TextStyle(color: green))),
              DropdownButtonFormField<String>(
                initialValue: _shopId,
                decoration: InputDecoration(labelText: t('shop'), border: const OutlineInputBorder()),
                items: _shops.map<DropdownMenuItem<String>>((s) => DropdownMenuItem(value: s['id'], child: Text(s['name']))).toList(),
                onChanged: (v) => setState(() => _shopId = v),
              ),
              const SizedBox(height: 12),
              TextField(controller: _phone, keyboardType: TextInputType.phone, decoration: InputDecoration(labelText: t('phone'), prefixText: '+91 ', hintText: t('phoneHint'), border: const OutlineInputBorder())),
              if (!_otpSent) ...[
                const SizedBox(height: 16),
                FilledButton(onPressed: _busy || _shopId == null ? null : _requestOtp, child: Text(t('sendCode'))),
              ] else ...[
                const SizedBox(height: 12),
                TextField(controller: _name, decoration: InputDecoration(labelText: t('nameOptional'), border: const OutlineInputBorder())),
                const SizedBox(height: 12),
                TextField(controller: _code, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: t('enterCode'), border: const OutlineInputBorder())),
                const SizedBox(height: 16),
                FilledButton(onPressed: _busy ? null : _verify, child: Text(t('verifySignIn'))),
              ],
            ]),
          ),
        ),
      ),
    );
  }
}

// ---------------- Home ----------------
class HomeScreen extends StatefulWidget {
  final VoidCallback onLogout;
  const HomeScreen({super.key, required this.onLogout});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Map? _me;
  String _err = '';

  @override
  void initState() {
    super.initState();
    Api.me().then((m) { if (mounted) setState(() => _me = m); }).catchError((e) { if (mounted) setState(() => _err = '$e'); });
  }

  Future<void> _logout() async { await Api.logout(); widget.onLogout(); }

  @override
  Widget build(BuildContext context) {
    if (_err.isNotEmpty) return Scaffold(body: Center(child: Text(_err)));
    if (_me == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final isMistri = _me!['userType'] == 'MISTRI';
    final tabs = <Tab>[
      Tab(text: t('myOrders')),
      Tab(text: t('newOrder')),
      if (isMistri) Tab(text: t('catalog')),
      if (isMistri) Tab(text: t('wallet')),
    ];
    final views = <Widget>[
      const OrdersTab(),
      NewOrderTab(isMistri: isMistri),
      if (isMistri) const CatalogTab(),
      if (isMistri) const WalletTab(),
    ];
    return DefaultTabController(
      length: tabs.length,
      child: Scaffold(
        appBar: AppBar(
          backgroundColor: green,
          foregroundColor: Colors.white,
          title: Text('${_me!['shopName']} · ${_me!['name'] ?? _me!['phone']}'),
          actions: [const LangToggle(), IconButton(onPressed: _logout, icon: const Icon(Icons.logout))],
          bottom: TabBar(tabs: tabs, labelColor: Colors.white, indicatorColor: Colors.white),
        ),
        body: TabBarView(children: views),
      ),
    );
  }
}

class OrdersTab extends StatefulWidget {
  const OrdersTab({super.key});
  @override
  State<OrdersTab> createState() => _OrdersTabState();
}

class _OrdersTabState extends State<OrdersTab> {
  List? _orders;
  String _err = '';
  Future<void> _load() async {
    try { final o = await Api.orders(); if (mounted) setState(() => _orders = o); } catch (e) { if (mounted) setState(() => _err = '$e'); }
  }
  @override
  void initState() { super.initState(); _load(); }
  @override
  Widget build(BuildContext context) {
    if (_err.isNotEmpty) return Center(child: Text(_err));
    if (_orders == null) return const Center(child: CircularProgressIndicator());
    if (_orders!.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(children: [SizedBox(height: 120), EmptyState(icon: Icons.receipt_long, title: t('noOrders'), hint: t('ordersEmptyHint'))]),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        children: _orders!.map<Widget>((o) {
          final total = (o['total'] ?? 0) as int;
          final media = (o['media'] as List?) ?? [];
          final hasVoice = media.any((m) => m['kind'] == 'voice');
          final leadingIcon = media.isEmpty ? Icons.receipt_long : (hasVoice ? Icons.mic : Icons.image);
          return ListTile(
            leading: Icon(leadingIcon, color: media.isEmpty ? Colors.black26 : green),
            title: Text(o['rawText'] ?? t('nItems').replaceFirst('{n}', '${(o['items'] as List).length}')),
            subtitle: Padding(padding: const EdgeInsets.only(top: 4), child: Align(alignment: Alignment.centerLeft, child: StatusChip(o['status']))),
            trailing: Text(total > 0 ? rupees(total) : '—', style: const TextStyle(fontWeight: FontWeight.w600)),
            onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => OrderDetailScreen(order: o))),
          );
        }).toList(),
      ),
    );
  }
}

class OrderDetailScreen extends StatefulWidget {
  final Map order;
  const OrderDetailScreen({super.key, required this.order});
  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  final _player = AudioPlayer();
  String? _playingUrl;

  @override
  void initState() {
    super.initState();
    _player.onPlayerComplete.listen((_) { if (mounted) setState(() => _playingUrl = null); });
  }

  @override
  void dispose() { _player.dispose(); super.dispose(); }

  Future<void> _togglePlay(String url) async {
    try {
      if (_playingUrl == url) { await _player.pause(); if (mounted) setState(() => _playingUrl = null); }
      else { await _player.stop(); await _player.play(UrlSource(url)); if (mounted) setState(() => _playingUrl = url); }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _reorder() async {
    final o = widget.order;
    final items = (o['items'] as List?) ?? [];
    try {
      if (items.isNotEmpty) {
        await Api.placeOrder(items: items.map<Map<String, dynamic>>((it) => {'skuId': it['skuId'], 'qty': it['qty']}).toList());
      } else {
        final urls = ((o['media'] as List?) ?? []).map<String>((m) => m['url'] as String).toList();
        await Api.placeOrder(rawText: o['rawText'] as String?, mediaUrls: urls);
      }
      if (mounted) { ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('reordered')))); Navigator.of(context).pop(); }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final o = widget.order;
    final media = (o['media'] as List?) ?? [];
    final items = (o['items'] as List?) ?? [];
    final payment = o['payment'] as Map?;
    final total = (o['total'] ?? 0) as int;

    return Scaffold(
      appBar: AppBar(backgroundColor: green, foregroundColor: Colors.white, title: Text('${t('orderTitle')} #${(o['id'] as String).substring((o['id'] as String).length - 6)}')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Row(children: [
          StatusChip(o['status']),
          const Spacer(),
          if (total > 0) Text(rupees(total), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        ]),
        if (o['rawText'] != null) Padding(padding: const EdgeInsets.symmetric(vertical: 10), child: Text('“${o['rawText']}”', style: const TextStyle(fontSize: 16))),

        // Attached media (photos + voice notes)
        ...media.map<Widget>((m) {
          final url = '${Api.base}${m['url']}';
          if (m['kind'] == 'photo') {
            return Padding(padding: const EdgeInsets.only(top: 8),
              child: ClipRRect(borderRadius: BorderRadius.circular(10), child: Image.network(url, height: 240, fit: BoxFit.cover,
                errorBuilder: (_, _, _) => const Text('Could not load photo'))));
          }
          if (m['kind'] == 'voice') {
            final playing = _playingUrl == url;
            return Padding(padding: const EdgeInsets.only(top: 8), child: Card(child: ListTile(
              leading: Icon(playing ? Icons.pause_circle : Icons.play_circle, color: green, size: 40),
              title: Text(t('voiceLabel')),
              subtitle: Text(playing ? t('pause') : t('play')),
              onTap: () => _togglePlay(url),
            )));
          }
          return const SizedBox.shrink();
        }),

        if (items.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text(t('items'), style: const TextStyle(fontWeight: FontWeight.w600)),
          ...items.map<Widget>((it) {
            final sku = it['sku'] as Map?;
            return ListTile(
              dense: true,
              title: Text(sku?['name'] ?? 'part'),
              subtitle: Text('${t('qty')}: ${it['qty']}'),
              trailing: Text(rupees((it['qty'] as int) * (it['unitPrice'] as int))),
            );
          }),
        ],

        if (payment != null) Padding(
          padding: const EdgeInsets.only(top: 16),
          child: Text('${t('payment')}: ${payment['status']}', style: const TextStyle(color: Colors.black54)),
        ),

        const SizedBox(height: 24),
        FilledButton.icon(onPressed: _reorder, icon: const Icon(Icons.replay), label: Text(t('reorder'))),
      ]),
    );
  }
}

class NewOrderTab extends StatefulWidget {
  final bool isMistri;
  const NewOrderTab({super.key, required this.isMistri});
  @override
  State<NewOrderTab> createState() => _NewOrderTabState();
}

class _NewOrderTabState extends State<NewOrderTab> {
  final _text = TextEditingController();
  final _recorder = AudioRecorder();
  final List<({List<int> bytes, String name, String kind})> _attachments = [];
  bool _recording = false;
  String _msg = '';
  String _err = '';
  bool _busy = false;

  @override
  void dispose() { _text.dispose(); _recorder.dispose(); super.dispose(); }

  Future<void> _pickPhoto(ImageSource source) async {
    setState(() { _err = ''; });
    try {
      final XFile? img = await ImagePicker().pickImage(source: source, imageQuality: 70, maxWidth: 1600);
      if (img == null) return;
      final b = await img.readAsBytes();
      if (mounted) setState(() => _attachments.add((bytes: b, name: img.name, kind: 'photo')));
    } catch (e) { if (mounted) setState(() => _err = '$e'); }
  }

  Future<void> _toggleRecord() async {
    setState(() { _err = ''; });
    try {
      if (_recording) {
        final out = await _recorder.stop();
        if (mounted) setState(() => _recording = false);
        if (out != null) {
          final b = await XFile(out).readAsBytes();
          if (mounted) setState(() => _attachments.add((bytes: b, name: 'voice_${DateTime.now().millisecondsSinceEpoch}.m4a', kind: 'voice')));
        }
      } else {
        if (!await _recorder.hasPermission()) { if (mounted) setState(() => _err = t('micDenied')); return; }
        String path = '';
        if (!kIsWeb) { final dir = await getTemporaryDirectory(); path = '${dir.path}/order_${DateTime.now().millisecondsSinceEpoch}.m4a'; }
        await _recorder.start(const RecordConfig(), path: path);
        if (mounted) setState(() { _recording = true; });
      }
    } catch (e) { if (mounted) setState(() { _err = '$e'; _recording = false; }); }
  }

  Future<void> _send() async {
    setState(() { _msg = ''; _err = ''; _busy = true; });
    try {
      final text = _text.text.trim();
      if (text.isEmpty && _attachments.isEmpty) { setState(() { _err = t('addSomething'); _busy = false; }); return; }
      final urls = <String>[];
      for (final a in _attachments) { urls.add(await Api.uploadMedia(a.bytes, a.name)); }
      await Api.placeOrder(rawText: text.isEmpty ? null : text, mediaUrls: urls);
      if (mounted) setState(() { _msg = t('orderSent'); _text.clear(); _attachments.clear(); });
    } catch (e) { if (mounted) setState(() => _err = '$e'); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Container(
          padding: const EdgeInsets.all(12),
          margin: const EdgeInsets.only(bottom: 16),
          decoration: BoxDecoration(color: const Color(0xFFE6F6F0), borderRadius: BorderRadius.circular(10)),
          child: Row(children: [
            const Icon(Icons.info_outline, color: green),
            const SizedBox(width: 10),
            Expanded(child: Text(t('newOrderHint'), style: const TextStyle(color: Colors.black87))),
          ]),
        ),
        Text(t('describePart'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        TextField(controller: _text, maxLines: 3, decoration: InputDecoration(hintText: t('hintPart'), border: const OutlineInputBorder())),
        const SizedBox(height: 12),
        Text(t('orAttach'), style: const TextStyle(color: Colors.black54)),
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, children: [
          if (!kIsWeb) OutlinedButton.icon(onPressed: _busy ? null : () => _pickPhoto(ImageSource.camera), icon: const Icon(Icons.photo_camera), label: Text(t('camera'))),
          OutlinedButton.icon(onPressed: _busy ? null : () => _pickPhoto(ImageSource.gallery), icon: const Icon(Icons.image), label: Text(t('photo'))),
          OutlinedButton.icon(
            onPressed: _busy ? null : _toggleRecord,
            icon: Icon(_recording ? Icons.stop : Icons.mic, color: _recording ? Colors.red : null),
            label: Text(_recording ? t('stop') : t('voiceNote')),
          ),
        ]),
        if (_attachments.isNotEmpty) Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Wrap(spacing: 8, runSpacing: 8, children: _attachments.asMap().entries.map((e) => Chip(
            avatar: Icon(e.value.kind == 'voice' ? Icons.mic : Icons.image, size: 18),
            label: Text(e.value.kind == 'voice' ? t('voiceAttached') : e.value.name),
            onDeleted: () => setState(() => _attachments.removeAt(e.key)),
          )).toList()),
        ),
        const SizedBox(height: 16),
        FilledButton.icon(onPressed: _busy ? null : _send, icon: const Icon(Icons.send), label: Text(_busy ? t('sending') : t('sendOrder'))),
        if (_msg.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_msg, style: const TextStyle(color: green))),
        if (_err.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_err, style: const TextStyle(color: Colors.red))),
      ]),
    );
  }
}

class CatalogTab extends StatefulWidget {
  const CatalogTab({super.key});
  @override
  State<CatalogTab> createState() => _CatalogTabState();
}

class _CatalogTabState extends State<CatalogTab> {
  List? _skus;
  String _err = '';
  final Map<String, int> _cart = {}; // skuId → qty
  bool _placing = false;

  Future<void> _load() async {
    try { final s = await Api.catalog(''); if (mounted) setState(() => _skus = s); } catch (e) { if (mounted) setState(() => _err = '$e'); }
  }
  @override
  void initState() { super.initState(); _load(); }

  Map? _skuById(String id) { for (final s in _skus!) { if (s['id'] == id) return s as Map; } return null; }
  int get _cartCount => _cart.values.fold(0, (a, b) => a + b);
  int get _cartTotalPaise => _cart.entries.fold(0, (sum, e) => sum + (e.value * ((_skuById(e.key)?['price'] ?? 0) as int)));

  void _add(String id) => setState(() => _cart[id] = (_cart[id] ?? 0) + 1);
  void _remove(String id) => setState(() { final q = (_cart[id] ?? 0) - 1; if (q <= 0) { _cart.remove(id); } else { _cart[id] = q; } });

  Future<void> _placeOrder() async {
    setState(() => _placing = true);
    try {
      final items = _cart.entries.map((e) => {'skuId': e.key, 'qty': e.value}).toList();
      await Api.placeOrder(items: items);
      setState(() => _cart.clear());
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('orderPlaced'))));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally { if (mounted) setState(() => _placing = false); }
  }

  @override
  Widget build(BuildContext context) {
    if (_err.isNotEmpty) return Center(child: Text(_err));
    if (_skus == null) return const Center(child: CircularProgressIndicator());
    if (_skus!.isEmpty) return EmptyState(icon: Icons.inventory_2_outlined, title: t('noParts'));
    return Column(children: [
      Expanded(child: ListView(
        children: _skus!.map<Widget>((s) {
          final id = s['id'] as String;
          final qty = _cart[id] ?? 0;
          return ListTile(
            title: Text(s['name']),
            subtitle: Text([s['brand'], s['modelCompat']].where((x) => x != null).join(' · ')),
            trailing: Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 6, children: [
              Text(rupees(s['price'])),
              if (qty == 0)
                FilledButton(onPressed: () => _add(id), child: Text(t('add')))
              else ...[
                IconButton(onPressed: () => _remove(id), icon: const Icon(Icons.remove_circle_outline)),
                Text('$qty', style: const TextStyle(fontWeight: FontWeight.bold)),
                IconButton(onPressed: () => _add(id), icon: const Icon(Icons.add_circle_outline)),
              ],
            ]),
          );
        }).toList(),
      )),
      if (_cart.isNotEmpty) Material(
        elevation: 8,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(children: [
            Expanded(child: Text(t('cartSummary').replaceFirst('{n}', '$_cartCount').replaceFirst('{total}', rupees(_cartTotalPaise)),
                style: const TextStyle(fontWeight: FontWeight.w600))),
            FilledButton.icon(onPressed: _placing ? null : _placeOrder, icon: const Icon(Icons.shopping_cart_checkout), label: Text(t('placeOrder'))),
          ]),
        ),
      ),
    ]);
  }
}

class WalletTab extends StatefulWidget {
  const WalletTab({super.key});
  @override
  State<WalletTab> createState() => _WalletTabState();
}

class _WalletTabState extends State<WalletTab> {
  Map? _w;
  String _err = '';
  @override
  void initState() {
    super.initState();
    Api.wallet().then((w) { if (mounted) setState(() => _w = w); }).catchError((e) { if (mounted) setState(() => _err = '$e'); });
  }
  @override
  Widget build(BuildContext context) {
    if (_err.isNotEmpty) return Center(child: Text(_err));
    if (_w == null) return const Center(child: CircularProgressIndicator());
    final txns = _w!['txns'] as List;
    return Column(children: [
      Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        color: const Color(0xFFE6F6F0),
        child: Column(children: [
          Text(t('cashbackBalance'), style: const TextStyle(color: Colors.black54)),
          Text(rupees(_w!['balance']), style: const TextStyle(fontSize: 30, fontWeight: FontWeight.bold, color: green)),
        ]),
      ),
      Expanded(child: txns.isEmpty
          ? Center(child: Text(t('noTxns')))
          : ListView(children: txns.map<Widget>((tx) => ListTile(
              title: Text(tx['type'] == 'CASHBACK' ? t('cashback') : t('payout')),
              subtitle: Text(tx['ref'] ?? ''),
              trailing: Text('${tx['type'] == 'CASHBACK' ? '+' : '−'}${rupees(tx['amount'])}'),
            )).toList())),
    ]);
  }
}
