// ============================================
// ThinkMark — M5StickC Plus 2
// Step 1: Basic WiFi + Web Server Test
// Team Firefox | Ideathon 2026
// ============================================
// BEFORE UPLOADING:
// 1. Board Manager URL: https://m5stack.oss-cn-shenzhen.aliyuncs.com/resource/arduino/package_m5stack_index.json
// 2. Tools → Board → M5Stack → M5StickC Plus2
// 3. Tools → Port → Select your COM port
// 4. Library: M5StickCPlus2 (install from Library Manager)
// ============================================

#include <M5StickCPlus2.h>
#include <WiFi.h>
#include <WebServer.h>

// ============================================
// CHANGE THESE TO YOUR WIFI DETAILS
// ============================================
const char* WIFI_SSID     = "YourWiFiName";
const char* WIFI_PASSWORD = "YourWiFiPassword";

// Backend URL — change after Render deploy
const char* BACKEND_URL = "https://thinkmark-api.onrender.com";

WebServer server(80);

// ============================================
// SETUP
// ============================================
void setup() {
  // Start M5StickC Plus 2
  M5.begin();
  
  // Screen setup
  M5.Lcd.setRotation(3);
  M5.Lcd.fillScreen(BLACK);
  M5.Lcd.setTextColor(WHITE);
  M5.Lcd.setTextSize(2);
  M5.Lcd.setCursor(10, 10);
  M5.Lcd.println("ThinkMark");
  M5.Lcd.setTextSize(1);
  M5.Lcd.setCursor(10, 40);
  M5.Lcd.println("Connecting WiFi...");

  Serial.begin(115200);
  Serial.println("ThinkMark Starting...");

  // Connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    // Show IP on screen
    M5.Lcd.fillScreen(BLACK);
    M5.Lcd.setTextColor(GREEN);
    M5.Lcd.setTextSize(2);
    M5.Lcd.setCursor(10, 10);
    M5.Lcd.println("ThinkMark");
    M5.Lcd.setTextColor(WHITE);
    M5.Lcd.setTextSize(1);
    M5.Lcd.setCursor(10, 40);
    M5.Lcd.println("WiFi Connected!");
    M5.Lcd.setCursor(10, 55);
    M5.Lcd.println("Open browser:");
    M5.Lcd.setTextColor(GREEN);
    M5.Lcd.setTextSize(1);
    M5.Lcd.setCursor(10, 70);
    M5.Lcd.println(WiFi.localIP().toString());

    Serial.println("\nWiFi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    // WiFi failed
    M5.Lcd.fillScreen(BLACK);
    M5.Lcd.setTextColor(RED);
    M5.Lcd.setCursor(10, 10);
    M5.Lcd.println("WiFi Failed!");
    M5.Lcd.setTextColor(WHITE);
    M5.Lcd.setCursor(10, 30);
    M5.Lcd.println("Check SSID/Password");
    Serial.println("WiFi connection failed!");
  }

  // Setup web server routes
  server.on("/", handleRoot);
  server.on("/status", handleStatus);
  server.begin();
  Serial.println("Web server started!");
}

// ============================================
// LOOP
// ============================================
void loop() {
  M5.update();
  server.handleClient();

  // Button A (big button) — show IP again
  if (M5.BtnA.wasPressed()) {
    M5.Lcd.fillScreen(BLACK);
    M5.Lcd.setTextColor(GREEN);
    M5.Lcd.setTextSize(2);
    M5.Lcd.setCursor(10, 10);
    M5.Lcd.println("ThinkMark");
    M5.Lcd.setTextColor(WHITE);
    M5.Lcd.setTextSize(1);
    M5.Lcd.setCursor(10, 40);
    M5.Lcd.println("IP Address:");
    M5.Lcd.setTextColor(GREEN);
    M5.Lcd.setCursor(10, 55);
    M5.Lcd.println(WiFi.localIP().toString());
  }
}

// ============================================
// WEB SERVER ROUTES
// ============================================

// Root page — simple status page
void handleRoot() {
  String html = R"(
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ThinkMark</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: sans-serif; 
      background: #0a0a0a; 
      color: #e5e5e5; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: #111;
      border: 1px solid #222;
      border-radius: 12px;
      padding: 32px;
      text-align: center;
      max-width: 360px;
      width: 100%;
    }
    .logo { 
      font-size: 28px; 
      font-weight: bold; 
      margin-bottom: 8px;
    }
    .logo span.g { color: #16a34a; }
    .logo span.r { color: #dc2626; }
    .status { 
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(22,163,74,0.1); 
      color: #16a34a; 
      border: 1px solid rgba(22,163,74,0.2);
      border-radius: 20px; 
      padding: 4px 14px; 
      font-size: 13px;
      margin: 12px 0 24px;
    }
    .dot { 
      width: 7px; height: 7px; 
      border-radius: 50%; 
      background: #16a34a;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.3} }
    .btn {
      display: block;
      background: #16a34a;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 12px;
      width: 100%;
      font-size: 15px;
      cursor: pointer;
      text-decoration: none;
      margin-bottom: 10px;
    }
    .btn.r { background: #dc2626; }
    .info { font-size: 12px; color: #6b7280; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <span class="g">Think</span><span class="r">Mark</span>
    </div>
    <div class="status">
      <div class="dot"></div>
      Device Online
    </div>
    <a href=")" + String(BACKEND_URL) + R"(" class="btn">
      Open Dashboard
    </a>
    <a href="/status" class="btn r">
      Device Status
    </a>
    <div class="info">
      ThinkMark v0.1 — Team Firefox<br>
      Erode Sengunthar Engineering College
    </div>
  </div>
</body>
</html>
  )";
  server.send(200, "text/html", html);
}

// Status endpoint — returns JSON for backend
void handleStatus() {
  String json = "{";
  json += "\"device\":\"ThinkMark v0.1\",";
  json += "\"team\":\"Firefox\",";
  json += "\"ip\":\"" + WiFi.localIP().toString() + "\",";
  json += "\"rssi\":" + String(WiFi.RSSI()) + ",";
  json += "\"uptime\":" + String(millis() / 1000) + ",";
  json += "\"status\":\"online\"";
  json += "}";
  server.send(200, "application/json", json);
}
