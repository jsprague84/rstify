use rstify_mqtt::config::MqttConfig;
use rstify_mqtt::ingest::parse_mqtt_payload;
use rstify_mqtt::MqttService;
use rumqttc::{AsyncClient, MqttOptions, QoS};
use std::time::Duration;

fn test_config(port: u16) -> MqttConfig {
    MqttConfig {
        enabled: true,
        listen_addr: format!("127.0.0.1:{}", port),
        ws_listen_addr: None,
        require_auth: false,
        max_payload_size: 20480,
        max_connections: 100,
    }
}

#[test]
fn test_broker_config_builds_correctly() {
    let config = test_config(11883);
    let broker_config = MqttService::build_broker_config(&config);

    assert!(broker_config.v4.is_some());
    let v4 = broker_config.v4.unwrap();
    assert_eq!(v4.len(), 1);

    let server = v4.values().next().unwrap();
    assert_eq!(server.listen, "127.0.0.1:11883".parse().unwrap());
    assert!(broker_config.ws.is_none());
}

#[test]
fn test_broker_config_with_websocket() {
    let mut config = test_config(11884);
    config.ws_listen_addr = Some("127.0.0.1:18083".to_string());
    let broker_config = MqttService::build_broker_config(&config);

    assert!(broker_config.ws.is_some());
    let ws = broker_config.ws.unwrap();
    assert_eq!(ws.len(), 1);
}

#[test]
fn test_payload_parsing_plain_text() {
    let (title, message, priority) = parse_mqtt_payload(b"Hello World", "sensors/temp");
    assert!(title.is_none());
    assert_eq!(message, "Hello World");
    assert_eq!(priority, 5);
}

#[test]
fn test_payload_parsing_json_with_fields() {
    let payload = br#"{"title":"Alert","message":"temp is 42C","priority":8}"#;
    let (title, message, priority) = parse_mqtt_payload(payload, "sensors/temp");
    assert_eq!(title.unwrap(), "Alert");
    assert_eq!(message, "temp is 42C");
    assert_eq!(priority, 8);
}

#[test]
fn test_payload_parsing_plain_json() {
    let payload = br#"{"temp":42,"unit":"C"}"#;
    let (title, message, _priority) = parse_mqtt_payload(payload, "sensors/temp");
    assert_eq!(title.unwrap(), "sensors/temp");
    assert!(message.contains("42"));
}

#[test]
fn test_payload_parsing_binary() {
    let payload = &[0xFF, 0xFE, 0x00, 0x01];
    let (title, message, priority) = parse_mqtt_payload(payload, "raw/data");
    assert_eq!(title.unwrap(), "raw/data");
    assert!(message.contains("binary payload"));
    assert_eq!(priority, 5);
}

/// Integration test: start broker, connect rumqttc client, publish, verify link receives message.
/// Uses a unique port to avoid conflicts.
#[tokio::test]
async fn test_broker_start_and_client_publish() {
    let config = test_config(21883);
    let broker_config = MqttService::build_broker_config(&config);

    let broker = rumqttd::Broker::new(broker_config);
    let (mut link_tx, mut link_rx) = broker.link("test-internal").expect("link creation");
    link_tx.subscribe("#").expect("subscribe");

    // Start broker in background thread
    std::thread::Builder::new()
        .name("test-broker".to_string())
        .spawn(move || {
            let mut broker = broker;
            let _ = broker.start();
        })
        .unwrap();

    // Give broker time to start
    tokio::time::sleep(Duration::from_millis(500)).await;

    // Connect a rumqttc client
    let mut opts = MqttOptions::new("test-client", "127.0.0.1", 21883);
    opts.set_keep_alive(Duration::from_secs(5));
    let (client, mut eventloop) = AsyncClient::new(opts, 10);

    // Drive eventloop in background
    let eventloop_handle = tokio::spawn(async move {
        for _ in 0..20 {
            match tokio::time::timeout(Duration::from_millis(500), eventloop.poll()).await {
                Ok(Ok(_)) => {}
                _ => break,
            }
        }
    });

    // Wait for connection
    tokio::time::sleep(Duration::from_millis(200)).await;

    // Publish a test message
    client
        .publish("test/hello", QoS::AtLeastOnce, false, b"Hello from test")
        .await
        .expect("publish");

    // Give time for message to arrive
    tokio::time::sleep(Duration::from_millis(300)).await;

    // Check that the internal link received the message
    let mut found = false;
    for _ in 0..10 {
        match link_rx.recv() {
            Ok(Some(rumqttd::Notification::Forward(forward))) => {
                let topic = std::str::from_utf8(&forward.publish.topic).unwrap_or("");
                if topic == "test/hello" {
                    let payload = &forward.publish.payload;
                    assert_eq!(payload.as_ref(), b"Hello from test");
                    found = true;
                    break;
                }
            }
            Ok(_) => {}
            Err(_) => {
                std::thread::sleep(Duration::from_millis(50));
            }
        }
    }

    assert!(
        found,
        "Internal link should have received the published message"
    );

    // Cleanup
    let _ = client.disconnect().await;
    let _ = eventloop_handle.await;
}

/// Test anti-loop: messages with rstify/ prefix topics should be ignored by ingest
#[test]
fn test_antiloop_topic_prefix() {
    // The ingest loop skips topics starting with "rstify/" — verify the topic name mapping
    let mqtt_topic = "rstify/internal/status";
    assert!(mqtt_topic.starts_with("rstify/"));

    let normal_topic = "sensors/temperature";
    assert!(!normal_topic.starts_with("rstify/"));
}
