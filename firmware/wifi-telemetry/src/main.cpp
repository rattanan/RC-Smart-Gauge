#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <esp_timer.h>
#include <time.h>

// Safe prototype: no GPIO reads/writes, PWM output, servo or ESC control.
// Replace only readTelemetry() after confirming the receiver protocol/voltage.
struct Config { String ssid, password, url, secret, deviceId, ca; uint32_t interval; } config;
struct Telemetry { float throttle, steering; bool valid; const char* source; };
Preferences preferences;
WiFiClientSecure tls;
HTTPClient http;
bool httpReady = false, authBlocked = false;
uint64_t sequence = 0;
uint32_t nextUpload = 0, nextReconnect = 0, retryMs = 1000;
String bootId;

String randomToken(size_t length) {
  const char alphabet[] = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  String value; value.reserve(length);
  for(size_t i=0;i<length;i++) value += alphabet[esp_random() % (sizeof(alphabet)-1)];
  return value;
}
String escapeHtml(String value) {
  value.replace("&","&amp;"); value.replace("<","&lt;"); value.replace(">","&gt;"); value.replace("\"","&quot;"); value.replace("'","&#39;"); return value;
}
bool validId(const String& value) {
  if(value.length()<1 || value.length()>64) return false;
  for(char c:value) if(!isalnum(static_cast<unsigned char>(c)) && c!='_' && c!='-') return false;
  return true;
}
bool validEndpoint(const String& url) {
  if(!url.startsWith("https://") || url.length()>512) return false;
  String host=url.substring(8,url.indexOf('/',8)<0 ? url.length() : url.indexOf('/',8));
  if(host.length()<1 || host.indexOf('@')>=0) return false;
  for(char c:url) if(static_cast<unsigned char>(c)<=32 || c=='#') return false;
  return true;
}
bool completeConfig() { return config.ssid.length() && validEndpoint(config.url) && config.secret.length()>=32 && validId(config.deviceId) && config.ca.indexOf("BEGIN CERTIFICATE")>=0; }
void loadConfig() {
  preferences.begin("rcsg",true);
  config={preferences.getString("ssid"),preferences.getString("wifi-pass"),preferences.getString("url"),preferences.getString("secret"),preferences.getString("device","rc-01"),preferences.getString("ca"),preferences.getUInt("interval",250)};
  preferences.end();
}
void enterSetup() {
  http.end(); httpReady=false; WiFi.disconnect(); WiFi.mode(WIFI_AP);
  String apName="RC-Smart-Gauge-"+String(static_cast<uint32_t>(ESP.getEfuseMac()),HEX).substring(0,4);
  String apPassword=randomToken(12), csrf=randomToken(32);
  WiFi.softAP(apName.c_str(),apPassword.c_str(),1,false,1);
  Serial.println("\n--- Temporary ESP32 setup network ---"); Serial.println("Wi-Fi: "+apName); Serial.println("Setup Wi-Fi password: "+apPassword); Serial.println("Open http://192.168.4.1 (expires in 15 minutes)");
  WebServer server(80); const uint32_t opened=millis();
  server.on("/",HTTP_GET,[&]() {
    String html=R"HTML(<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>RC Smart Gauge Setup</title><style>body{background:#061622;color:#e9f8ff;font:15px Arial;max-width:580px;margin:35px auto;padding:20px}h1,b{color:#00dfe9}label{display:block;margin-top:20px}input,textarea,button{box-sizing:border-box;width:100%;padding:13px;margin-top:7px;border:1px solid #315468;border-radius:6px;background:#0a2534;color:white}button{background:#00dfe9;color:#04202b;font-weight:bold;margin-top:25px}small{color:#90b8ca;line-height:1.6}textarea{height:150px}p{line-height:1.6}</style></head><body><h1>RC Smart Gauge</h1><b>ESP32 / Wi-Fi uploader</b><p>Configure your internet destination. This firmware sends explicitly labeled DEMO telemetry. No receiver pins are configured.</p><form method="post" action="/save"><input type="hidden" name="csrf" value=")HTML"+csrf+R"HTML("><label>Wi-Fi name (SSID)<input name="ssid" maxlength="32" required value=")HTML"+escapeHtml(config.ssid)+R"HTML("></label><label>Wi-Fi password<input type="password" name="wifi" maxlength="63" autocomplete="new-password"></label><small>Leave blank to keep the saved Wi-Fi password. Use a new SSID for an open network.</small><label>Complete HTTPS destination URL<input name="url" type="url" maxlength="512" required placeholder="https://your-app.vercel.app/api/ingest" value=")HTML"+escapeHtml(config.url)+R"HTML("></label><label>Device ID<input name="device" maxlength="64" required value=")HTML"+escapeHtml(config.deviceId)+R"HTML("></label><label>Device secret<input type="password" name="secret" minlength="32" maxlength="128" autocomplete="new-password"></label><small>Use the same DEVICE_SECRET as the Vercel server. Leave blank to keep the saved secret.</small><label>Trusted root CA certificate (PEM)<textarea name="ca" maxlength="8192" placeholder="-----BEGIN CERTIFICATE-----"></textarea></label><small>Leave blank to keep the saved CA. TLS verification is always enabled; confirm the CA for your actual domain.</small><label>Upload interval (ms)<input type="number" name="interval" min="200" max="10000" value=")HTML"+String(config.interval)+R"HTML("></label><button>Save & restart</button></form><p><small>Configuration is stored in the board's NVS. This prototype does not enable NVS encryption. Protect physical access to the board.</small></p></body></html>)HTML";
    server.sendHeader("Cache-Control","no-store");server.sendHeader("X-Content-Type-Options","nosniff");server.send(200,"text/html",html);
  });
  server.on("/save",HTTP_POST,[&]() {
    if(server.arg("csrf")!=csrf || server.header("Content-Length").toInt()>14000) {server.send(403,"text/plain","Invalid setup request");return;}
    Config next=config; next.ssid=server.arg("ssid");next.url=server.arg("url");next.deviceId=server.arg("device");next.interval=server.arg("interval").toInt();
    if(server.arg("wifi").length() || next.ssid!=config.ssid)next.password=server.arg("wifi");
    if(server.arg("secret").length())next.secret=server.arg("secret");
    if(server.arg("ca").length())next.ca=server.arg("ca");
    bool secretValid=next.secret.length()>=32 && next.secret.length()<=128;
    for(char c:next.secret) if(static_cast<unsigned char>(c)<=32 || static_cast<unsigned char>(c)>126) secretValid=false;
    if(next.ssid.length()<1 || next.ssid.length()>32 || (next.password.length()!=0 && (next.password.length()<8 || next.password.length()>63)) || !validEndpoint(next.url) || !validId(next.deviceId) || !secretValid || next.ca.length()>8192 || next.ca.indexOf("BEGIN CERTIFICATE")<0 || next.ca.indexOf("END CERTIFICATE")<0 || next.interval<200 || next.interval>10000) {
      server.send(400,"text/plain","Invalid settings. Check SSID, Wi-Fi password, HTTPS URL, device ID, 32+ character secret, CA PEM and interval.");return;
    }
    preferences.begin("rcsg",false);preferences.putString("ssid",next.ssid);preferences.putString("wifi-pass",next.password);preferences.putString("url",next.url);preferences.putString("device",next.deviceId);preferences.putString("secret",next.secret);preferences.putString("ca",next.ca);preferences.putUInt("interval",next.interval);preferences.end();
    server.sendHeader("Cache-Control","no-store");server.send(200,"text/plain","Saved. Restarting. Return to your regular Wi-Fi and open your dashboard.");delay(1000);ESP.restart();
  });
  const char* headers[]={"Content-Length"}; server.collectHeaders(headers,1);server.begin();
  while(static_cast<uint32_t>(millis()-opened)<15*60*1000) {server.handleClient();delay(5);}
  server.stop();WiFi.softAPdisconnect(true);WiFi.mode(WIFI_STA);
  Serial.println("Setup closed. Type setup in Serial Monitor to reopen it.");
}
Telemetry readTelemetry() {
  const double seconds=esp_timer_get_time()/1000000.0;
  return {static_cast<float>(.42+.27*sin(seconds*.7)),static_cast<float>(.85*sin(seconds*.43)),true,"demo"};
}
void setup() {
  Serial.begin(115200);Serial.setTimeout(100);delay(300);bootId=randomToken(24);loadConfig();
  if(!completeConfig())enterSetup();
  WiFi.mode(WIFI_STA);WiFi.setAutoReconnect(true);
  if(completeConfig())WiFi.begin(config.ssid.c_str(),config.password.c_str());
  configTime(0,0,"pool.ntp.org","time.google.com");
  Serial.println("RC Smart Gauge uploader ready. DEMO DATA ONLY. Type setup to configure.");
}
void loop() {
  if(Serial.available()) {String command=Serial.readStringUntil('\n');command.trim();if(command.equalsIgnoreCase("setup")){enterSetup();loadConfig();authBlocked=false;nextReconnect=0;}}
  if(!completeConfig()) {delay(50);return;}
  const uint32_t now=millis();
  if(WiFi.status()!=WL_CONNECTED) {
    if(httpReady){http.end();httpReady=false;}
    if(static_cast<int32_t>(now-nextReconnect)>=0) {WiFi.begin(config.ssid.c_str(),config.password.c_str());nextReconnect=now+retryMs;retryMs=std::min<uint32_t>(retryMs*2,30000);}
    delay(10);return;
  }
  if(authBlocked || time(nullptr)<1700000000) {delay(50);return;}
  if(static_cast<int32_t>(now-nextUpload)<0) {delay(5);return;}
  if(!httpReady) {
    tls.setCACert(config.ca.c_str());tls.setHandshakeTimeout(5);
    httpReady=http.begin(tls,config.url);http.setTimeout(4500);http.setReuse(true);http.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);
    if(!httpReady) {nextUpload=now+5000;return;}
  }
  const auto reading=readTelemetry();const uint64_t capture=esp_timer_get_time();
  struct timeval tv;gettimeofday(&tv,nullptr);
  JsonDocument doc;doc["schema"]=1;doc["device_id"]=config.deviceId;doc["boot_id"]=bootId;doc["seq"]=sequence++;doc["t_capture_us"]=capture;
  doc["sent_at_ms"]=static_cast<uint64_t>(tv.tv_sec)*1000+tv.tv_usec/1000;
  doc["throttle"]=reading.throttle;doc["steering"]=reading.steering;doc["signal_valid"]=reading.valid;doc["source"]=reading.source;
  doc["speed_mps"]=nullptr;doc["battery_v"]=nullptr;doc["motor_temp_c"]=nullptr;
  String body;serializeJson(doc,body);
  http.addHeader("Authorization","Bearer "+config.secret);http.addHeader("Content-Type","application/json");
  const int status=http.POST(body);
  if(status==200) {
    if(http.getSize()>=0 && http.getSize()<=512)http.getString();else{http.end();httpReady=false;}
    retryMs=1000;nextUpload=millis()+config.interval;
  } else {
    Serial.printf("Upload status %d; dropping frame\n",status);http.end();httpReady=false;
    if(status==401 || status==403) {authBlocked=true;Serial.println("Authorization rejected. Type setup to check URL, device ID and secret.");}
    if(status==400)configTime(0,0,"pool.ntp.org","time.google.com");
    nextUpload=millis()+retryMs;retryMs=std::min<uint32_t>(retryMs*2,30000);
  }
}
