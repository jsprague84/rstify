use async_trait::async_trait;
use rstify_core::error::CoreError;
use rstify_core::models::{Attachment, Message, WebhookConfig};
use rstify_core::repositories::MessageRepository;
use sqlx::SqlitePool;

#[derive(Clone)]
pub struct SqliteMessageRepo {
    pool: SqlitePool,
}

impl SqliteMessageRepo {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl MessageRepository for SqliteMessageRepo {
    async fn create(
        &self,
        application_id: Option<i64>,
        topic_id: Option<i64>,
        user_id: Option<i64>,
        title: Option<&str>,
        message: &str,
        priority: i32,
        tags: Option<&str>,
        click_url: Option<&str>,
        icon_url: Option<&str>,
        actions: Option<&str>,
        extras: Option<&str>,
        content_type: Option<&str>,
        scheduled_for: Option<&str>,
        source: Option<&str>,
    ) -> Result<Message, CoreError> {
        sqlx::query_as::<_, Message>(
            r#"INSERT INTO messages
                (application_id, topic_id, user_id, title, message, priority, tags, click_url, icon_url, actions, extras, content_type, scheduled_for, source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING *"#,
        )
        .bind(application_id)
        .bind(topic_id)
        .bind(user_id)
        .bind(title)
        .bind(message)
        .bind(priority)
        .bind(tags)
        .bind(click_url)
        .bind(icon_url)
        .bind(actions)
        .bind(extras)
        .bind(content_type)
        .bind(scheduled_for)
        .bind(source)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn find_by_id(&self, id: i64) -> Result<Option<Message>, CoreError> {
        sqlx::query_as::<_, Message>("SELECT * FROM messages WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn list_by_application(
        &self,
        app_id: i64,
        limit: i64,
        since: i64,
    ) -> Result<Vec<Message>, CoreError> {
        sqlx::query_as::<_, Message>(
            "SELECT * FROM messages WHERE application_id = ? AND id > ? ORDER BY id DESC LIMIT ?",
        )
        .bind(app_id)
        .bind(since)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn list_by_user_apps(
        &self,
        user_id: i64,
        limit: i64,
        since: i64,
    ) -> Result<Vec<Message>, CoreError> {
        sqlx::query_as::<_, Message>(
            r#"SELECT m.* FROM messages m
               JOIN applications a ON m.application_id = a.id
               WHERE a.user_id = ? AND m.id > ?
               ORDER BY m.id DESC LIMIT ?"#,
        )
        .bind(user_id)
        .bind(since)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn list_by_topic(
        &self,
        topic_id: i64,
        limit: i64,
        since: i64,
    ) -> Result<Vec<Message>, CoreError> {
        sqlx::query_as::<_, Message>(
            "SELECT * FROM messages WHERE topic_id = ? AND id > ? ORDER BY id DESC LIMIT ?",
        )
        .bind(topic_id)
        .bind(since)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn update(
        &self,
        id: i64,
        title: Option<&str>,
        message: Option<&str>,
        priority: Option<i32>,
        extras: Option<&str>,
    ) -> Result<Message, CoreError> {
        let current = self
            .find_by_id(id)
            .await?
            .ok_or_else(|| CoreError::NotFound(format!("Message {} not found", id)))?;

        let new_title = title.or(current.title.as_deref());
        let new_message = message.unwrap_or(&current.message);
        let new_priority = priority.unwrap_or(current.priority);
        let new_extras = extras.map(|s| s.to_string()).or(current.extras);

        sqlx::query_as::<_, Message>(
            "UPDATE messages SET title = ?, message = ?, priority = ?, extras = ? WHERE id = ? RETURNING *",
        )
        .bind(new_title)
        .bind(new_message)
        .bind(new_priority)
        .bind(&new_extras)
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn search(
        &self,
        user_id: i64,
        query: Option<&str>,
        tag: Option<&str>,
        priority_min: Option<i32>,
        priority_max: Option<i32>,
        since: Option<&str>,
        until: Option<&str>,
        app_id: Option<i64>,
        limit: i64,
    ) -> Result<Vec<Message>, CoreError> {
        let mut qb = sqlx::QueryBuilder::<sqlx::Sqlite>::new(
            "SELECT m.* FROM messages m WHERE (m.application_id IN (SELECT id FROM applications WHERE user_id = ",
        );
        qb.push_bind(user_id);
        qb.push(") OR m.user_id = ");
        qb.push_bind(user_id);
        qb.push(")");

        if let Some(q) = query {
            qb.push(" AND m.id IN (SELECT rowid FROM messages_fts WHERE messages_fts MATCH ");
            qb.push_bind(q.to_string());
            qb.push(")");
        }
        if let Some(t) = tag {
            qb.push(" AND m.tags LIKE ");
            qb.push_bind(format!("%{t}%"));
        }
        if let Some(pmin) = priority_min {
            qb.push(" AND m.priority >= ");
            qb.push_bind(pmin);
        }
        if let Some(pmax) = priority_max {
            qb.push(" AND m.priority <= ");
            qb.push_bind(pmax);
        }
        if let Some(s) = since {
            qb.push(" AND m.created_at >= ");
            qb.push_bind(s.to_string());
        }
        if let Some(u) = until {
            qb.push(" AND m.created_at <= ");
            qb.push_bind(u.to_string());
        }
        if let Some(aid) = app_id {
            qb.push(" AND m.application_id = ");
            qb.push_bind(aid);
        }
        qb.push(" ORDER BY m.created_at DESC LIMIT ");
        qb.push_bind(limit);

        qb.build_query_as::<Message>()
            .fetch_all(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn delete_batch(&self, ids: &[i64], user_id: i64) -> Result<u64, CoreError> {
        if ids.is_empty() {
            return Ok(0);
        }
        let placeholders: Vec<&str> = ids.iter().map(|_| "?").collect();
        let sql = format!(
            "DELETE FROM messages WHERE id IN ({}) AND (application_id IN (SELECT id FROM applications WHERE user_id = ?) OR user_id = ?)",
            placeholders.join(",")
        );
        let mut q = sqlx::query(&sql);
        for id in ids {
            q = q.bind(id);
        }
        q = q.bind(user_id).bind(user_id);
        let result = q
            .execute(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))?;
        Ok(result.rows_affected())
    }

    async fn delete_by_id(&self, id: i64) -> Result<(), CoreError> {
        let result = sqlx::query("DELETE FROM messages WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(CoreError::NotFound(format!("Message {} not found", id)));
        }
        Ok(())
    }

    async fn delete_all_for_user(&self, user_id: i64) -> Result<(), CoreError> {
        // Delete messages from user's applications AND messages posted by user to topics
        sqlx::query(
            r#"DELETE FROM messages WHERE
                application_id IN (SELECT id FROM applications WHERE user_id = ?)
                OR (user_id = ? AND topic_id IS NOT NULL)"#,
        )
        .bind(user_id)
        .bind(user_id)
        .execute(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))?;
        Ok(())
    }

    async fn delete_all_for_application(&self, app_id: i64) -> Result<(), CoreError> {
        sqlx::query("DELETE FROM messages WHERE application_id = ?")
            .bind(app_id)
            .execute(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))?;
        Ok(())
    }

    async fn list_scheduled_due(&self) -> Result<Vec<Message>, CoreError> {
        sqlx::query_as::<_, Message>(
            "SELECT * FROM messages WHERE scheduled_for IS NOT NULL AND scheduled_for <= datetime('now') AND delivered_at IS NULL",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn count(&self) -> Result<i64, CoreError> {
        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM messages")
            .fetch_one(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))?;
        Ok(count)
    }

    async fn count_since(&self, since: &str) -> Result<i64, CoreError> {
        let (count,): (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM messages WHERE created_at >= ?")
                .bind(since)
                .fetch_one(&self.pool)
                .await
                .map_err(|e| CoreError::Database(e.to_string()))?;
        Ok(count)
    }

    async fn set_expires_at(&self, id: i64, expires_at: &str) -> Result<(), CoreError> {
        sqlx::query("UPDATE messages SET expires_at = ? WHERE id = ?")
            .bind(expires_at)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))?;
        Ok(())
    }

    async fn delete_expired_messages(&self) -> Result<u64, CoreError> {
        let result = sqlx::query(
            "DELETE FROM messages WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))?;
        Ok(result.rows_affected())
    }

    async fn mark_delivered(&self, id: i64) -> Result<(), CoreError> {
        sqlx::query("UPDATE messages SET delivered_at = datetime('now') WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))?;
        Ok(())
    }

    // Attachments
    async fn create_attachment(
        &self,
        message_id: i64,
        filename: &str,
        content_type: Option<&str>,
        size_bytes: i64,
        storage_type: &str,
        storage_path: &str,
        expires_at: Option<&str>,
    ) -> Result<Attachment, CoreError> {
        sqlx::query_as::<_, Attachment>(
            "INSERT INTO attachments (message_id, filename, content_type, size_bytes, storage_type, storage_path, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *",
        )
        .bind(message_id)
        .bind(filename)
        .bind(content_type)
        .bind(size_bytes)
        .bind(storage_type)
        .bind(storage_path)
        .bind(expires_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn list_attachments_by_message(
        &self,
        message_id: i64,
    ) -> Result<Vec<Attachment>, CoreError> {
        sqlx::query_as::<_, Attachment>("SELECT * FROM attachments WHERE message_id = ?")
            .bind(message_id)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn list_attachments_by_messages(
        &self,
        message_ids: &[i64],
    ) -> Result<Vec<Attachment>, CoreError> {
        if message_ids.is_empty() {
            return Ok(vec![]);
        }
        let placeholders: Vec<String> = message_ids.iter().map(|_| "?".to_string()).collect();
        let sql = format!(
            "SELECT * FROM attachments WHERE message_id IN ({})",
            placeholders.join(",")
        );
        let mut query = sqlx::query_as::<_, Attachment>(&sql);
        for id in message_ids {
            query = query.bind(id);
        }
        query
            .fetch_all(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn find_attachment(&self, id: i64) -> Result<Option<Attachment>, CoreError> {
        sqlx::query_as::<_, Attachment>("SELECT * FROM attachments WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn list_expired_attachments(&self) -> Result<Vec<Attachment>, CoreError> {
        sqlx::query_as::<_, Attachment>(
            "SELECT * FROM attachments WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn delete_attachment(&self, id: i64) -> Result<(), CoreError> {
        sqlx::query("DELETE FROM attachments WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))?;
        Ok(())
    }

    // Webhook configs
    async fn create_webhook_config(
        &self,
        user_id: i64,
        name: &str,
        token: &str,
        webhook_type: &str,
        target_topic_id: Option<i64>,
        target_application_id: Option<i64>,
        template: &str,
        enabled: bool,
        direction: &str,
        target_url: Option<&str>,
        http_method: Option<&str>,
        headers: Option<&str>,
        body_template: Option<&str>,
        max_retries: Option<i32>,
        retry_delay_secs: Option<i32>,
        timeout_secs: Option<i32>,
        follow_redirects: Option<bool>,
        group_name: Option<&str>,
        secret: Option<&str>,
    ) -> Result<WebhookConfig, CoreError> {
        sqlx::query_as::<_, WebhookConfig>(
            "INSERT INTO webhook_configs (user_id, name, token, webhook_type, target_topic_id, target_application_id, template, enabled, direction, target_url, http_method, headers, body_template, max_retries, retry_delay_secs, timeout_secs, follow_redirects, group_name, secret) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
        )
        .bind(user_id)
        .bind(name)
        .bind(token)
        .bind(webhook_type)
        .bind(target_topic_id)
        .bind(target_application_id)
        .bind(template)
        .bind(enabled)
        .bind(direction)
        .bind(target_url)
        .bind(http_method.unwrap_or("POST"))
        .bind(headers)
        .bind(body_template)
        .bind(max_retries.unwrap_or(3))
        .bind(retry_delay_secs.unwrap_or(60))
        .bind(timeout_secs.unwrap_or(15))
        .bind(follow_redirects.unwrap_or(true))
        .bind(group_name)
        .bind(secret)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn find_webhook_config_by_id(&self, id: i64) -> Result<Option<WebhookConfig>, CoreError> {
        sqlx::query_as::<_, WebhookConfig>("SELECT * FROM webhook_configs WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn find_webhook_config_by_token(
        &self,
        token: &str,
    ) -> Result<Option<WebhookConfig>, CoreError> {
        sqlx::query_as::<_, WebhookConfig>("SELECT * FROM webhook_configs WHERE token = ?")
            .bind(token)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn list_webhook_configs_by_user(
        &self,
        user_id: i64,
    ) -> Result<Vec<WebhookConfig>, CoreError> {
        sqlx::query_as::<_, WebhookConfig>(
            "SELECT * FROM webhook_configs WHERE user_id = ? ORDER BY id",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn update_webhook_config(
        &self,
        id: i64,
        name: Option<&str>,
        template: Option<&str>,
        enabled: Option<bool>,
        target_url: Option<&str>,
        http_method: Option<&str>,
        headers: Option<&str>,
        body_template: Option<&str>,
        max_retries: Option<i32>,
        retry_delay_secs: Option<i32>,
        timeout_secs: Option<i32>,
        follow_redirects: Option<bool>,
        group_name: Option<&str>,
        secret: Option<&str>,
    ) -> Result<WebhookConfig, CoreError> {
        let current = self
            .find_webhook_config_by_id(id)
            .await?
            .ok_or_else(|| CoreError::NotFound(format!("Webhook config {} not found", id)))?;

        let new_name = name.unwrap_or(&current.name);
        let new_template = template.unwrap_or(&current.template);
        let new_enabled = enabled.unwrap_or(current.enabled);
        let new_http_method = http_method.unwrap_or(&current.http_method);
        let new_max_retries = max_retries.unwrap_or(current.max_retries);
        let new_retry_delay_secs = retry_delay_secs.unwrap_or(current.retry_delay_secs);
        let new_timeout_secs = timeout_secs.unwrap_or(current.timeout_secs);
        let new_follow_redirects = follow_redirects.unwrap_or(current.follow_redirects);
        let new_group_name = group_name.map(|s| s.to_string()).or(current.group_name);
        // For Option<String> fields, use provided value or fall back to current
        let new_target_url = target_url.map(|s| s.to_string()).or(current.target_url);
        let new_headers = headers.map(|s| s.to_string()).or(current.headers);
        let new_body_template = body_template
            .map(|s| s.to_string())
            .or(current.body_template);
        let new_secret = secret.map(|s| s.to_string()).or(current.secret);

        sqlx::query_as::<_, WebhookConfig>(
            "UPDATE webhook_configs SET name = ?, template = ?, enabled = ?, target_url = ?, http_method = ?, headers = ?, body_template = ?, max_retries = ?, retry_delay_secs = ?, timeout_secs = ?, follow_redirects = ?, group_name = ?, secret = ? WHERE id = ? RETURNING *",
        )
        .bind(new_name)
        .bind(new_template)
        .bind(new_enabled)
        .bind(&new_target_url)
        .bind(new_http_method)
        .bind(&new_headers)
        .bind(&new_body_template)
        .bind(new_max_retries)
        .bind(new_retry_delay_secs)
        .bind(new_timeout_secs)
        .bind(new_follow_redirects)
        .bind(&new_group_name)
        .bind(&new_secret)
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| CoreError::Database(e.to_string()))
    }

    async fn delete_webhook_config(&self, id: i64) -> Result<(), CoreError> {
        let result = sqlx::query("DELETE FROM webhook_configs WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(CoreError::NotFound(format!(
                "Webhook config {} not found",
                id
            )));
        }
        Ok(())
    }

    async fn regenerate_webhook_token(
        &self,
        id: i64,
        new_token: &str,
    ) -> Result<WebhookConfig, CoreError> {
        let result = sqlx::query("UPDATE webhook_configs SET token = ? WHERE id = ?")
            .bind(new_token)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| CoreError::Database(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(CoreError::NotFound(format!(
                "Webhook config {} not found",
                id
            )));
        }
        self.find_webhook_config_by_id(id)
            .await?
            .ok_or_else(|| CoreError::NotFound(format!("Webhook config {} not found", id)))
    }
}
