// Low-level example: explicit connected sensor polling and publish loop.
import { Ino } from "@inojs/core";
import { DHT } from "@inojs/dht";
import { MQTT } from "@inojs/mqtt";
import { SDCard } from "@inojs/sd";
import { WiFiConnection } from "@inojs/wifi";

const core = new Ino({ serialMonitor: true, baudRate: 115200 });
const serial = core.serial();
const wifi = new WiFiConnection();
const mqtt = new MQTT();
const sensor = new DHT(4, "DHT22");
const card = new SDCard(5);

core.setup(() => {
  wifi.begin("SSID", "PASSWORD");
  mqtt.setServer("broker.hivemq.com", 1883);
  mqtt.connect("inojs-iot-monitor");
  sensor.begin();
  card.begin(5);
});

core.loop(() => {
  const temperature = sensor.readTemperature();
  const humidity = sensor.readHumidity();
  mqtt.loop();
  mqtt.publish("inojs/temperature", `${temperature}`);
  mqtt.publish("inojs/humidity", `${humidity}`);

  serial.print("WiFi ");
  serial.println(wifi.status());
  serial.print("Temp ");
  serial.println(temperature);
  serial.print("Humidity ");
  serial.println(humidity);
  core.delay(5000);
});
