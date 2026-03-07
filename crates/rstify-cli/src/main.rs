mod config;

use clap::{Parser, Subcommand};
use std::io::{self, Read};

#[derive(Parser)]
#[command(
    name = "rstify",
    version,
    about = "rstify CLI — send and receive notifications"
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Send a notification message
    Send {
        /// Message body (reads from stdin if omitted)
        #[arg(short, long)]
        message: Option<String>,
        /// Message title
        #[arg(short, long)]
        title: Option<String>,
        /// Priority (0-10)
        #[arg(short, long, default_value = "5")]
        priority: i32,
        /// Tags (comma-separated)
        #[arg(long)]
        tag: Option<String>,
        /// Topic name (sends via ntfy-style publish)
        #[arg(long)]
        topic: Option<String>,
    },
    /// List recent messages
    Messages {
        /// Application ID to filter by
        #[arg(long)]
        app: Option<i64>,
        /// Maximum number of messages
        #[arg(short, long, default_value = "20")]
        limit: i64,
    },
    /// Subscribe to real-time messages via WebSocket
    Subscribe {
        /// Topic name to subscribe to
        #[arg(long)]
        topic: Option<String>,
    },
    /// Configure server URL and token
    Config {
        /// Server URL (e.g., https://notify.example.com)
        #[arg(long)]
        server: Option<String>,
        /// Authentication token (client or app token)
        #[arg(long)]
        token: Option<String>,
    },
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();
    let cfg = config::Config::load();

    match cli.command {
        Commands::Config { server, token } => {
            let mut cfg = cfg.unwrap_or_default();
            if let Some(s) = server {
                cfg.server = s;
            }
            if let Some(t) = token {
                cfg.token = t;
            }
            if let Err(e) = cfg.save() {
                eprintln!("Error saving config: {}", e);
                std::process::exit(1);
            }
            println!("Configuration saved to {}", config::config_path().display());
            println!("  Server: {}", cfg.server);
            println!("  Token:  {}...", &cfg.token[..cfg.token.len().min(8)]);
        }
        Commands::Send {
            message,
            title,
            priority,
            tag,
            topic,
        } => {
            let cfg = cfg.unwrap_or_else(|e| {
                eprintln!("Error: {}. Run `rstify config` first.", e);
                std::process::exit(1);
            });

            // Read message from stdin if not provided
            let body = match message {
                Some(m) => m,
                None => {
                    let mut buf = String::new();
                    io::stdin().read_to_string(&mut buf).unwrap_or_default();
                    let trimmed = buf.trim().to_string();
                    if trimmed.is_empty() {
                        eprintln!("Error: no message provided. Use --message or pipe to stdin.");
                        std::process::exit(1);
                    }
                    trimmed
                }
            };

            if let Err(e) = send_message(
                &cfg,
                &body,
                title.as_deref(),
                priority,
                tag.as_deref(),
                topic.as_deref(),
            )
            .await
            {
                eprintln!("Error: {}", e);
                std::process::exit(1);
            }
        }
        Commands::Messages { app, limit } => {
            let cfg = cfg.unwrap_or_else(|e| {
                eprintln!("Error: {}. Run `rstify config` first.", e);
                std::process::exit(1);
            });
            if let Err(e) = list_messages(&cfg, app, limit).await {
                eprintln!("Error: {}", e);
                std::process::exit(1);
            }
        }
        Commands::Subscribe { topic } => {
            let cfg = cfg.unwrap_or_else(|e| {
                eprintln!("Error: {}. Run `rstify config` first.", e);
                std::process::exit(1);
            });
            if let Err(e) = subscribe(&cfg, topic.as_deref()) {
                eprintln!("Error: {}", e);
                std::process::exit(1);
            }
        }
    }
}

async fn send_message(
    cfg: &config::Config,
    message: &str,
    title: Option<&str>,
    priority: i32,
    tag: Option<&str>,
    topic: Option<&str>,
) -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();

    if let Some(topic) = topic {
        // ntfy-style publish to topic
        let url = format!("{}/{}", cfg.server.trim_end_matches('/'), topic);
        let mut req = client
            .post(&url)
            .header("Authorization", format!("Bearer {}", cfg.token))
            .header("X-Priority", priority.to_string())
            .body(message.to_string());

        if let Some(t) = title {
            req = req.header("X-Title", t);
        }
        if let Some(tags) = tag {
            req = req.header("X-Tags", tags);
        }

        let resp = req.send().await?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Server returned {}: {}", status, body).into());
        }

        let msg: serde_json::Value = resp.json().await?;
        println!("Message sent (id: {})", msg["id"]);
    } else {
        // Gotify-style publish via app token
        let url = format!("{}/message", cfg.server.trim_end_matches('/'));
        let mut body_json = serde_json::json!({
            "message": message,
            "priority": priority,
        });
        if let Some(t) = title {
            body_json["title"] = serde_json::Value::String(t.to_string());
        }

        let resp = client
            .post(&url)
            .header("Authorization", format!("Bearer {}", cfg.token))
            .json(&body_json)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Server returned {}: {}", status, body).into());
        }

        let msg: serde_json::Value = resp.json().await?;
        println!("Message sent (id: {})", msg["id"]);
    }

    Ok(())
}

async fn list_messages(
    cfg: &config::Config,
    app: Option<i64>,
    limit: i64,
) -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let url = if let Some(app_id) = app {
        format!(
            "{}/application/{}/messages?limit={}",
            cfg.server.trim_end_matches('/'),
            app_id,
            limit
        )
    } else {
        format!(
            "{}/message?limit={}",
            cfg.server.trim_end_matches('/'),
            limit
        )
    };

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", cfg.token))
        .send()
        .await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Server returned {}: {}", status, body).into());
    }

    let data: serde_json::Value = resp.json().await?;
    let messages = data["messages"].as_array();

    match messages {
        Some(msgs) if !msgs.is_empty() => {
            for msg in msgs {
                let id = msg["id"].as_i64().unwrap_or(0);
                let title = msg["title"].as_str().unwrap_or("");
                let message = msg["message"].as_str().unwrap_or("");
                let priority = msg["priority"].as_i64().unwrap_or(0);
                let date = msg["date"].as_str().unwrap_or("");
                let topic = msg["topic"].as_str().unwrap_or("");

                if !title.is_empty() {
                    println!("[{}] P{} {} — {}", date, priority, title, message);
                } else if !topic.is_empty() {
                    println!("[{}] P{} #{} {}", date, priority, topic, message);
                } else {
                    println!("[{}] P{} (#{}) {}", date, priority, id, message);
                }
            }
        }
        _ => println!("No messages found."),
    }

    Ok(())
}

fn subscribe(cfg: &config::Config, topic: Option<&str>) -> Result<(), Box<dyn std::error::Error>> {
    let ws_url = if let Some(topic) = topic {
        format!(
            "{}/api/topics/{}/ws?token={}",
            cfg.server
                .trim_end_matches('/')
                .replace("http://", "ws://")
                .replace("https://", "wss://"),
            topic,
            cfg.token
        )
    } else {
        format!(
            "{}/stream?token={}",
            cfg.server
                .trim_end_matches('/')
                .replace("http://", "ws://")
                .replace("https://", "wss://"),
            cfg.token
        )
    };

    println!("Subscribing to {}...", topic.unwrap_or("all messages"));

    let (mut socket, _) = tungstenite::connect(&ws_url)?;

    loop {
        let msg = socket.read()?;
        match msg {
            tungstenite::Message::Text(text) => {
                if let Ok(data) = serde_json::from_str::<serde_json::Value>(&text) {
                    let title = data["title"].as_str().unwrap_or("");
                    let message = data["message"].as_str().unwrap_or("");
                    let priority = data["priority"].as_i64().unwrap_or(0);
                    let topic = data["topic"].as_str().unwrap_or("");

                    if !title.is_empty() {
                        println!("P{} {} — {}", priority, title, message);
                    } else if !topic.is_empty() {
                        println!("P{} #{} {}", priority, topic, message);
                    } else {
                        println!("P{} {}", priority, message);
                    }
                } else {
                    println!("{}", text);
                }
            }
            tungstenite::Message::Close(_) => {
                println!("Connection closed.");
                break;
            }
            _ => {}
        }
    }

    Ok(())
}
