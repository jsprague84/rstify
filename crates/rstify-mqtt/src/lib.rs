pub mod auth;
pub mod bridge;
pub mod config;
pub mod ingest;
pub mod publish;

pub use config::MqttConfig;

use rstify_db::repositories::client::SqliteClientRepo;
use rumqttd::local::{LinkRx, LinkTx};
use rumqttd::{Broker, Config, ConnectionSettings, RouterConfig, ServerSettings};
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::net::SocketAddr;
use tracing::{error, info};

pub struct MqttService;

impl MqttService {
    pub fn build_broker_config(config: &MqttConfig) -> Config {
        let listen_addr: SocketAddr = config
            .listen_addr
            .parse()
            .unwrap_or_else(|_| "0.0.0.0:1883".parse().unwrap());

        let connection_settings = ConnectionSettings {
            connection_timeout_ms: 60000,
            max_payload_size: config.max_payload_size,
            max_inflight_count: 100,
            auth: None,
            external_auth: None,
            dynamic_filters: true,
        };

        let v4_server = ServerSettings {
            name: "rstify-mqtt-v4".to_string(),
            listen: listen_addr,
            tls: None,
            next_connection_delay_ms: 1,
            connections: connection_settings.clone(),
        };

        let mut v4 = HashMap::new();
        v4.insert("1".to_string(), v4_server);

        let mut broker_config = Config {
            id: 0,
            router: RouterConfig {
                max_connections: config.max_connections,
                max_outgoing_packet_count: 200,
                max_segment_size: 104857600,
                max_segment_count: 10,
                ..Default::default()
            },
            v4: Some(v4),
            ..Default::default()
        };

        // Add WebSocket server if configured
        if let Some(ref ws_addr) = config.ws_listen_addr {
            if let Ok(ws_listen) = ws_addr.parse::<SocketAddr>() {
                let ws_connection = ConnectionSettings {
                    connection_timeout_ms: 60000,
                    max_payload_size: config.max_payload_size,
                    max_inflight_count: 100,
                    auth: None,
                    external_auth: None,
                    dynamic_filters: true,
                };

                let ws_server = ServerSettings {
                    name: "rstify-mqtt-ws".to_string(),
                    listen: ws_listen,
                    tls: None,
                    next_connection_delay_ms: 1,
                    connections: ws_connection,
                };

                let mut ws = HashMap::new();
                ws.insert("1".to_string(), ws_server);
                broker_config.ws = Some(ws);
            }
        }

        broker_config
    }

    /// Start the MQTT broker and return the internal link handles.
    /// The broker runs in a separate thread. The returned LinkTx/LinkRx
    /// are used by ingest and publish tasks.
    pub fn start(
        config: MqttConfig,
        pool: SqlitePool,
        jwt_secret: String,
    ) -> anyhow::Result<(LinkTx, LinkRx)> {
        let mut broker_config = Self::build_broker_config(&config);

        // Set auth handler on all server configs
        if config.require_auth {
            let client_repo = SqliteClientRepo::new(pool);
            Self::set_auth_handlers(&mut broker_config, client_repo, jwt_secret);
        }

        let broker = Broker::new(broker_config);
        let (mut link_tx, link_rx) = broker
            .link("rstify-internal")
            .map_err(|e| anyhow::anyhow!("Failed to create internal MQTT link: {:?}", e))?;

        // Subscribe to all topics so we receive all messages
        link_tx
            .subscribe("#")
            .map_err(|e| anyhow::anyhow!("Failed to subscribe to all MQTT topics: {:?}", e))?;

        info!("MQTT broker starting on {}", config.listen_addr);
        if let Some(ref ws) = config.ws_listen_addr {
            info!("MQTT WebSocket starting on {}", ws);
        }

        // Start broker in a separate thread (rumqttd uses its own tokio runtimes)
        std::thread::Builder::new()
            .name("mqtt-broker".to_string())
            .spawn(move || {
                let mut broker = broker;
                if let Err(e) = broker.start() {
                    error!("MQTT broker error: {:?}", e);
                }
            })
            .map_err(|e| anyhow::anyhow!("Failed to spawn MQTT broker thread: {}", e))?;

        Ok((link_tx, link_rx))
    }

    fn set_auth_handlers(
        broker_config: &mut Config,
        client_repo: SqliteClientRepo,
        jwt_secret: String,
    ) {
        // Set auth on v4 servers
        if let Some(ref mut v4) = broker_config.v4 {
            for (_, server) in v4.iter_mut() {
                let repo = client_repo.clone();
                let secret = jwt_secret.clone();
                server.set_auth_handler(move |client_id, username, password| {
                    let repo = repo.clone();
                    let secret = secret.clone();
                    async move {
                        auth::authenticate(client_id, username, password, repo, secret).await
                    }
                });
            }
        }

        // Set auth on v5 servers
        if let Some(ref mut v5) = broker_config.v5 {
            for (_, server) in v5.iter_mut() {
                let repo = client_repo.clone();
                let secret = jwt_secret.clone();
                server.set_auth_handler(move |client_id, username, password| {
                    let repo = repo.clone();
                    let secret = secret.clone();
                    async move {
                        auth::authenticate(client_id, username, password, repo, secret).await
                    }
                });
            }
        }

        // Set auth on WebSocket servers
        if let Some(ref mut ws) = broker_config.ws {
            for (_, server) in ws.iter_mut() {
                let repo = client_repo.clone();
                let secret = jwt_secret.clone();
                server.set_auth_handler(move |client_id, username, password| {
                    let repo = repo.clone();
                    let secret = secret.clone();
                    async move {
                        auth::authenticate(client_id, username, password, repo, secret).await
                    }
                });
            }
        }
    }
}
