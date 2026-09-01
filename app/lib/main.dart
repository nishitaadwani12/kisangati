import 'package:flutter/material.dart';
import 'api.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Api.loadToken();
  runApp(const KisanGatiApp());
}

const green = Color(0xFF1F7A4D);

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
    return MaterialApp(
      title: 'KisanGati',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(colorSchemeSeed: green, useMaterial3: true),
      home: loggedIn ? HomeScreen(onLogout: _refresh) : LoginScreen(onLoggedIn: _refresh),
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
    Api.shops().then((s) => setState(() { _shops = s; if (s.isNotEmpty) _shopId = s.first['id']; }))
        .catchError((e) => setState(() => _err = '$e'));
  }

  Future<void> _requestOtp() async {
    setState(() { _err = ''; _info = ''; _busy = true; });
    try {
      final r = await Api.requestOtp(_shopId!, _phone.text.trim());
      setState(() { _otpSent = true; if (r['devCode'] != null) { _code.text = r['devCode']; _info = 'Dev code: ${r['devCode']}'; } });
    } catch (e) { setState(() => _err = '$e'); }
    finally { setState(() => _busy = false); }
  }

  Future<void> _verify() async {
    setState(() { _err = ''; _busy = true; });
    try {
      await Api.verifyOtp(_shopId!, _phone.text.trim(), _code.text.trim(), _name.text.trim());
      widget.onLoggedIn();
    } catch (e) { setState(() => _err = '$e'); }
    finally { setState(() => _busy = false); }
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
              const Text('KisanGati', style: TextStyle(fontSize: 34, fontWeight: FontWeight.bold, color: green)),
              const SizedBox(height: 4),
              const Text('Order tractor parts from your shop', style: TextStyle(color: Colors.black54)),
              const SizedBox(height: 24),
              if (_err.isNotEmpty) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(_err, style: const TextStyle(color: Colors.red))),
              if (_info.isNotEmpty) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(_info, style: const TextStyle(color: green))),
              DropdownButtonFormField<String>(
                initialValue: _shopId,
                decoration: const InputDecoration(labelText: 'Shop', border: OutlineInputBorder()),
                items: _shops.map<DropdownMenuItem<String>>((s) => DropdownMenuItem(value: s['id'], child: Text(s['name']))).toList(),
                onChanged: (v) => setState(() => _shopId = v),
              ),
              const SizedBox(height: 12),
              TextField(controller: _phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone', hintText: '+9198…', border: OutlineInputBorder())),
              if (!_otpSent) ...[
                const SizedBox(height: 16),
                FilledButton(onPressed: _busy || _shopId == null ? null : _requestOtp, child: const Text('Send code')),
              ] else ...[
                const SizedBox(height: 12),
                TextField(controller: _name, decoration: const InputDecoration(labelText: 'Your name (optional)', border: OutlineInputBorder())),
                const SizedBox(height: 12),
                TextField(controller: _code, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Enter code', border: OutlineInputBorder())),
                const SizedBox(height: 16),
                FilledButton(onPressed: _busy ? null : _verify, child: const Text('Verify & sign in')),
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
    Api.me().then((m) => setState(() => _me = m)).catchError((e) => setState(() => _err = '$e'));
  }

  Future<void> _logout() async { await Api.logout(); widget.onLogout(); }

  @override
  Widget build(BuildContext context) {
    if (_err.isNotEmpty) return Scaffold(body: Center(child: Text(_err)));
    if (_me == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final isMistri = _me!['userType'] == 'MISTRI';
    final tabs = <Tab>[
      const Tab(text: 'My Orders'),
      const Tab(text: 'New Order'),
      if (isMistri) const Tab(text: 'Catalog'),
      if (isMistri) const Tab(text: 'Wallet'),
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
          actions: [IconButton(onPressed: _logout, icon: const Icon(Icons.logout))],
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
    try { final o = await Api.orders(); setState(() => _orders = o); } catch (e) { setState(() => _err = '$e'); }
  }
  @override
  void initState() { super.initState(); _load(); }
  @override
  Widget build(BuildContext context) {
    if (_err.isNotEmpty) return Center(child: Text(_err));
    if (_orders == null) return const Center(child: CircularProgressIndicator());
    if (_orders!.isEmpty) return const Center(child: Text('No orders yet.'));
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        children: _orders!.map<Widget>((o) {
          final total = (o['total'] ?? 0) as int;
          return ListTile(
            title: Text(o['rawText'] ?? '${(o['items'] as List).length} item(s)'),
            subtitle: Text(o['status']),
            trailing: Text(total > 0 ? rupees(total) : '—'),
          );
        }).toList(),
      ),
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
  String _msg = '';
  String _err = '';
  bool _busy = false;

  Future<void> _send() async {
    setState(() { _msg = ''; _err = ''; _busy = true; });
    try {
      await Api.placeOrder(rawText: _text.text.trim());
      setState(() { _msg = 'Order sent! The shop will confirm the price shortly.'; _text.clear(); });
    } catch (e) { setState(() => _err = '$e'); }
    finally { setState(() => _busy = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Text('Describe the part you need', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        TextField(controller: _text, maxLines: 4, decoration: const InputDecoration(hintText: 'e.g. Swaraj 855 clutch plate', border: OutlineInputBorder())),
        const SizedBox(height: 12),
        FilledButton.icon(onPressed: _busy ? null : _send, icon: const Icon(Icons.send), label: const Text('Send order')),
        const SizedBox(height: 8),
        const Text('Voice note & photo ordering coming soon.', style: TextStyle(color: Colors.black45, fontSize: 12)),
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
  Future<void> _load() async {
    try { final s = await Api.catalog(''); setState(() => _skus = s); } catch (e) { setState(() => _err = '$e'); }
  }
  @override
  void initState() { super.initState(); _load(); }

  Future<void> _order(Map sku) async {
    try {
      await Api.placeOrder(items: [{'skuId': sku['id'], 'qty': 1}]);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Ordered ${sku['name']} — check My Orders')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_err.isNotEmpty) return Center(child: Text(_err));
    if (_skus == null) return const Center(child: CircularProgressIndicator());
    if (_skus!.isEmpty) return const Center(child: Text('No parts in the catalog yet.'));
    return ListView(
      children: _skus!.map<Widget>((s) => ListTile(
        title: Text(s['name']),
        subtitle: Text([s['brand'], s['modelCompat']].where((x) => x != null).join(' · ')),
        trailing: Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 8, children: [
          Text(rupees(s['price'])),
          FilledButton(onPressed: () => _order(s), child: const Text('Order')),
        ]),
      )).toList(),
    );
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
    Api.wallet().then((w) => setState(() => _w = w)).catchError((e) => setState(() => _err = '$e'));
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
          const Text('Cashback balance', style: TextStyle(color: Colors.black54)),
          Text(rupees(_w!['balance']), style: const TextStyle(fontSize: 30, fontWeight: FontWeight.bold, color: green)),
        ]),
      ),
      Expanded(child: txns.isEmpty
          ? const Center(child: Text('No transactions yet.'))
          : ListView(children: txns.map<Widget>((t) => ListTile(
              title: Text(t['type'] == 'CASHBACK' ? 'Cashback' : 'Payout'),
              subtitle: Text(t['ref'] ?? ''),
              trailing: Text('${t['type'] == 'CASHBACK' ? '+' : '−'}${rupees(t['amount'])}'),
            )).toList())),
    ]);
  }
}
