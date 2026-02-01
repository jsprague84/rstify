use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(tag = "action")]
pub enum MessageAction {
    #[serde(rename = "view")]
    View {
        label: String,
        url: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        clear: Option<bool>,
    },
    #[serde(rename = "http")]
    Http {
        label: String,
        url: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        method: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        headers: Option<serde_json::Value>,
        #[serde(skip_serializing_if = "Option::is_none")]
        body: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        clear: Option<bool>,
    },
    #[serde(rename = "broadcast")]
    Broadcast {
        label: String,
        intent: Option<String>,
        extras: Option<serde_json::Value>,
        #[serde(skip_serializing_if = "Option::is_none")]
        clear: Option<bool>,
    },
}
