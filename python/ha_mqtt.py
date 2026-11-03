"""
Integracja Home Assistant: Webhooki oraz Klient MQTT z Auto-Discovery
Umożliwia przesyłanie telemetrii i odczytów PV do Home Assistanta oraz brokera MQTT (np. Mosquitto).
"""

import json
from typing import Dict, Any, Optional
import requests

try:
    import paho.mqtt.client as mqtt
except ImportError:
    mqtt = None

def send_pv_webhook(
    webhook_url: str,
    metrics_payload: Dict[str, Any],
    installation_name: str = "Instalacja PV Dom",
    peak_power_kwp: float = 3.8
) -> Dict[str, Any]:
    """
    Wysyła zdarzenie pv_reading_saved do Home Assistanta, Node-RED lub n8n.
    """
    payload = {
        "event": "pv_reading_saved",
        "installation": {
            "name": installation_name,
            "peakPowerKwp": peak_power_kwp,
            "billingType": "Net-metering 0.8"
        },
        "metrics": metrics_payload
    }

    try:
        resp = requests.post(
            webhook_url,
            json=payload,
            headers={"Content-Type": "application/json", "User-Agent": "MonitorPV-Python/1.0"},
            timeout=10
        )
        return {
            "success": resp.status_code < 400,
            "status_code": resp.status_code,
            "message": resp.text[:200]
        }
    except Exception as e:
        return {
            "success": False,
            "status_code": 0,
            "message": f"Błąd połączenia z webhookiem: {str(e)}"
        }

class HomeAssistantMQTT:
    """
    Klient MQTT z obsługą automatycznego wykrywania sensorów w Home Assistant (MQTT Discovery).
    """
    def __init__(
        self,
        broker_host: str = "localhost",
        broker_port: int = 1883,
        username: Optional[str] = None,
        password: Optional[str] = None,
        discovery_prefix: str = "homeassistant",
        node_id: str = "monitor_pv"
    ):
        self.broker_host = broker_host
        self.broker_port = broker_port
        self.username = username
        self.password = password
        self.discovery_prefix = discovery_prefix
        self.node_id = node_id
        self.client = None

        if mqtt is not None:
            self.client = mqtt.Client(client_id=f"monitor_pv_{node_id}")
            if self.username and self.password:
                self.client.username_pw_set(self.username, self.password)

    def publish_discovery(self):
        """Wysyła konfigurację sensorów Home Assistant MQTT Discovery"""
        if not self.client:
            raise RuntimeError("Biblioteka paho-mqtt nie jest zainstalowana.")

        self.client.connect(self.broker_host, self.broker_port, 60)

        sensors = [
            ("production_kwh", "Produkcja Miesięczna", "kWh", "energy", "total_increasing"),
            ("import_kwh", "Pobór z Sieci 1.8.0", "kWh", "energy", "total_increasing"),
            ("export_kwh", "Oddanie do Sieci 2.8.0", "kWh", "energy", "total_increasing"),
            ("self_consumption_percent", "Autokonsumpcja", "%", None, "measurement"),
            ("grid_balance_kwh", "Bilans Sieci (0.8)", "kWh", "energy", "measurement"),
            ("financial_balance_pln", "Saldo Finansowe", "PLN", "monetary", "measurement"),
            ("forecast_today_kwh", "Prognoza Generacji Dziś", "kWh", "energy", "measurement"),
            ("forecast_tomorrow_kwh", "Prognoza Generacji Jutro", "kWh", "energy", "measurement"),
        ]

        state_topic = f"{self.discovery_prefix}/sensor/{self.node_id}/state"

        for key, name, unit, dev_class, state_class in sensors:
            disc_topic = f"{self.discovery_prefix}/sensor/{self.node_id}_{key}/config"
            config_payload = {
                "name": f"PV {name}",
                "unique_id": f"pv_{self.node_id}_{key}",
                "state_topic": state_topic,
                "value_template": f"{{{{ value_json.{key} }}}}",
                "device": {
                    "identifiers": [f"monitor_pv_{self.node_id}"],
                    "name": "Monitor Instalacji PV",
                    "model": "Net-metering 0.8 Engine",
                    "manufacturer": "Monitor PV App"
                }
            }
            if unit:
                config_payload["unit_of_measurement"] = unit
            if dev_class:
                config_payload["device_class"] = dev_class
            if state_class:
                config_payload["state_class"] = state_class

            self.client.publish(disc_topic, json.dumps(config_payload), retain=True)

        self.client.disconnect()

    def publish_state(self, metrics: Dict[str, Any]):
        """Publikuje najnowszy stan metryk do Home Assistanta"""
        if not self.client:
            raise RuntimeError("Biblioteka paho-mqtt nie jest zainstalowana.")

        self.client.connect(self.broker_host, self.broker_port, 60)
        state_topic = f"{self.discovery_prefix}/sensor/{self.node_id}/state"
        self.client.publish(state_topic, json.dumps(metrics), retain=True)
        self.client.disconnect()
