use lettre::message::header::ContentType;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use tracing::{error, info, warn};

#[derive(Clone)]
pub struct EmailConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub from: String,
}

impl EmailConfig {
    pub fn from_env() -> Option<Self> {
        let host = std::env::var("SMTP_HOST").ok()?;
        let port = std::env::var("SMTP_PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(587);
        let username = std::env::var("SMTP_USER").unwrap_or_default();
        let password = std::env::var("SMTP_PASS").unwrap_or_default();
        let from = std::env::var("SMTP_FROM").unwrap_or_else(|_| format!("rstify@{}", host));

        Some(Self {
            host,
            port,
            username,
            password,
            from,
        })
    }
}

pub async fn send_email(config: &EmailConfig, to: &str, subject: &str, body: &str) {
    let email = match Message::builder()
        .from(config.from.parse().unwrap_or_else(|_| {
            "rstify@localhost".parse().unwrap()
        }))
        .to(match to.parse() {
            Ok(addr) => addr,
            Err(e) => {
                warn!("Invalid email address '{}': {}", to, e);
                return;
            }
        })
        .subject(subject)
        .header(ContentType::TEXT_PLAIN)
        .body(body.to_string())
    {
        Ok(email) => email,
        Err(e) => {
            error!("Failed to build email: {}", e);
            return;
        }
    };

    let creds = Credentials::new(config.username.clone(), config.password.clone());

    let mailer = match AsyncSmtpTransport::<Tokio1Executor>::relay(&config.host) {
        Ok(builder) => builder.port(config.port).credentials(creds).build(),
        Err(e) => {
            error!("Failed to create SMTP transport: {}", e);
            return;
        }
    };

    match mailer.send(email).await {
        Ok(_) => info!("Email sent to {}", to),
        Err(e) => error!("Failed to send email to {}: {}", to, e),
    }
}
