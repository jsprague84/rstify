use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct Config {
    pub server: String,
    pub token: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server: "http://localhost:8080".to_string(),
            token: String::new(),
        }
    }
}

pub fn config_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("rstify")
        .join("config.toml")
}

impl Config {
    pub fn load() -> Result<Self, String> {
        let path = config_path();
        if !path.exists() {
            return Err(format!("Config file not found at {}", path.display()));
        }
        let content =
            std::fs::read_to_string(&path).map_err(|e| format!("Failed to read config: {}", e))?;
        toml::from_str(&content).map_err(|e| format!("Failed to parse config: {}", e))
    }

    pub fn save(&self) -> Result<(), String> {
        let path = config_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config dir: {}", e))?;
        }
        let content = toml::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;
        std::fs::write(&path, content).map_err(|e| format!("Failed to write config: {}", e))
    }
}
