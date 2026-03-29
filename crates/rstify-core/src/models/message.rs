use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use super::action::MessageAction;
use super::attachment::Attachment;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow, ToSchema)]
pub struct Message {
    pub id: i64,
    pub application_id: Option<i64>,
    pub topic_id: Option<i64>,
    pub user_id: Option<i64>,
    pub title: Option<String>,
    pub message: String,
    pub priority: i32,
    pub tags: Option<String>,
    pub click_url: Option<String>,
    pub icon_url: Option<String>,
    pub actions: Option<String>,
    pub extras: Option<String>,
    pub content_type: Option<String>,
    pub scheduled_for: Option<String>,
    pub delivered_at: Option<String>,
    pub source: Option<String>,
    pub created_at: String,
}

/// Gotify-compatible message creation (via app token)
#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateAppMessage {
    pub title: Option<String>,
    pub message: String,
    pub priority: Option<i32>,
    pub extras: Option<serde_json::Value>,
}

/// Enhanced message creation (via topic)
#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateTopicMessage {
    pub title: Option<String>,
    pub message: String,
    pub priority: Option<i32>,
    pub tags: Option<Vec<String>>,
    pub click_url: Option<String>,
    pub icon_url: Option<String>,
    pub actions: Option<Vec<MessageAction>>,
    pub scheduled_for: Option<String>,
}

/// Update an existing message
#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateMessage {
    pub title: Option<String>,
    pub message: Option<String>,
    pub priority: Option<i32>,
    pub extras: Option<serde_json::Value>,
}

/// Lightweight attachment info included in message responses
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct AttachmentInfo {
    pub id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub content_type: Option<String>,
    pub size: i64,
    pub url: String,
}

impl AttachmentInfo {
    pub fn from_attachment(a: &Attachment) -> Self {
        Self {
            id: a.id,
            name: a.filename.clone(),
            content_type: a.content_type.clone(),
            size: a.size_bytes,
            url: format!("/api/attachments/{}", a.id),
        }
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct MessageResponse {
    pub id: i64,
    pub appid: Option<i64>,
    pub topic: Option<String>,
    pub title: Option<String>,
    pub message: String,
    pub priority: i32,
    pub tags: Option<Vec<String>>,
    pub click_url: Option<String>,
    pub icon_url: Option<String>,
    pub actions: Option<Vec<MessageAction>>,
    pub extras: Option<serde_json::Value>,
    pub content_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attachments: Option<Vec<AttachmentInfo>>,
    pub date: String,
}

impl Message {
    pub fn to_response(&self, topic_name: Option<String>) -> MessageResponse {
        MessageResponse {
            id: self.id,
            appid: self.application_id,
            topic: topic_name,
            title: self.title.clone(),
            message: self.message.clone(),
            priority: self.priority,
            tags: self
                .tags
                .as_ref()
                .and_then(|t| serde_json::from_str(t).ok()),
            click_url: self.click_url.clone(),
            icon_url: self.icon_url.clone(),
            actions: self
                .actions
                .as_ref()
                .and_then(|a| serde_json::from_str(a).ok()),
            extras: self
                .extras
                .as_ref()
                .and_then(|e| serde_json::from_str(e).ok()),
            content_type: self.content_type.clone(),
            source: self.source.clone(),
            attachments: None,
            date: if self.created_at.ends_with('Z') || self.created_at.contains('+') {
                self.created_at.clone()
            } else {
                format!("{}Z", self.created_at)
            },
        }
    }

    pub fn to_response_with_attachments(
        &self,
        topic_name: Option<String>,
        attachments: Vec<Attachment>,
    ) -> MessageResponse {
        let mut resp = self.to_response(topic_name);
        if !attachments.is_empty() {
            resp.attachments = Some(
                attachments
                    .iter()
                    .map(AttachmentInfo::from_attachment)
                    .collect(),
            );
        }
        resp
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PagedMessages {
    pub messages: Vec<MessageResponse>,
    pub paging: Paging,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct Paging {
    pub size: i64,
    pub since: i64,
    pub limit: i64,
}
