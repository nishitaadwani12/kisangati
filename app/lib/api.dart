import 'dart:convert';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Thin client for the KisanGati customer API. Money is in paise.
class Api {
  // Web (Chrome) reaches the host directly; the Android emulator reaches the host via 10.0.2.2.
  static const String base = kIsWeb ? 'http://localhost:3000' : 'http://10.0.2.2:3000';
  static String? token;

  static Future<void> loadToken() async {
    final p = await SharedPreferences.getInstance();
    token = p.getString('kg_token');
  }

  static Future<void> _saveToken(String? t) async {
    final p = await SharedPreferences.getInstance();
    if (t == null) {
      await p.remove('kg_token');
    } else {
      await p.setString('kg_token', t);
    }
    token = t;
  }

  static Future<void> logout() => _saveToken(null);

  static Map<String, String> _headers({bool json = true}) {
    final h = <String, String>{};
    if (json) h['Content-Type'] = 'application/json';
    if (token != null) h['Authorization'] = 'Bearer $token';
    return h;
  }

  static dynamic _handle(http.Response r) {
    final data = r.body.isNotEmpty ? jsonDecode(r.body) : null;
    if (r.statusCode >= 200 && r.statusCode < 300) return data;
    final msg = (data is Map && data['error'] != null) ? data['error'] : 'Request failed (${r.statusCode})';
    throw Exception(msg);
  }

  static Future<dynamic> _get(String path) async =>
      _handle(await http.get(Uri.parse('$base$path'), headers: _headers(json: false)));

  static Future<dynamic> _post(String path, Map<String, dynamic> body) async =>
      _handle(await http.post(Uri.parse('$base$path'), headers: _headers(), body: jsonEncode(body)));

  static Future<List> shops() async => await _get('/app/auth/shops') as List;

  static Future<Map> requestOtp(String shopId, String phone) async =>
      await _post('/app/auth/request-otp', {'shopId': shopId, 'phone': phone}) as Map;

  static Future<void> verifyOtp(String shopId, String phone, String code, String name) async {
    final res = await _post('/app/auth/verify-otp', {'shopId': shopId, 'phone': phone, 'code': code, 'name': name}) as Map;
    await _saveToken(res['token'] as String);
  }

  static Future<Map> me() async => await _get('/app/me') as Map;

  static Future<List> catalog(String q) async =>
      await _get('/app/catalog${q.isEmpty ? '' : '?q=${Uri.encodeQueryComponent(q)}'}') as List;

  static Future<Map> placeOrder({List<Map<String, dynamic>>? items, String? rawText}) async {
    final body = <String, dynamic>{};
    if (items != null) body['items'] = items;
    if (rawText != null) body['rawText'] = rawText;
    return await _post('/app/orders', body) as Map;
  }

  static Future<List> orders() async => await _get('/app/orders') as List;

  static Future<Map> wallet() async => await _get('/app/wallet') as Map;
}

String rupees(num paise) => '₹${(paise / 100).toStringAsFixed((paise % 100 == 0) ? 0 : 2)}';
