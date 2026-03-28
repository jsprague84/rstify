# Forgejo + GitHub Webhook Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add native Forgejo/Gitea webhook support with HMAC-SHA256 signature verification, and upgrade the existing basic GitHub handler to the same standard — both producing rich markdown notifications with click_url, priority mapping, and tags. Enables receiving CI build notifications, PR reviews, releases, etc.

**Architecture:** Add a `secret` column to webhook_configs, create a shared signature verification module, build parallel payload parsers for Forgejo and GitHub events that produce a common `WebhookMessageOutput` struct, then wire everything into the existing `receive_webhook` handler by switching from `Json<Value>` to raw `Bytes` for pre-parse signature checking.

**Tech Stack:** Rust (Axum), SQLite (sqlx), hmac + sha2 crates, serde/serde_json. Frontend: React 19 + TypeScript (web UI), React Native + Expo (mobile)

---

## File Map

### New Files — Backend
- `migrations/026_webhook_secret.sql` — Add `secret` column
- `crates/rstify-api/src/webhooks/mod.rs` — Module declaration
- `crates/rstify-api/src/webhooks/signature.rs` — HMAC verification for GitHub and Gitea
- `crates/rstify-api/src/webhooks/forgejo.rs` — Forgejo/Gitea payload parser
- `crates/rstify-api/src/webhooks/github.rs` — GitHub payload parser (upgrade)
- `crates/rstify-api/src/webhooks/types.rs` — Shared `WebhookMessageOutput` struct

### Modified Files — Backend
- `crates/rstify-api/Cargo.toml` — Add `hmac`, `sha2` dependencies
- `crates/rstify-api/src/lib.rs` — Declare `webhooks` module
- `crates/rstify-core/src/models/attachment.rs` — Add `secret` field to webhook structs
- `crates/rstify-db/src/repositories/message.rs` — Add `secret` to SQL queries
- `crates/rstify-api/src/routes/webhooks.rs` — Change extractor, add forgejo/github branches

### Modified Files — Frontend
- `web-ui/src/api/types.ts` — Add `secret` to webhook types
- `web-ui/src/pages/Webhooks.tsx` — Add forgejo/gitea to type dropdown, add secret field to forms
- `client/src/api/types.ts` — Add `secret` to mobile webhook types
- `client/app/hub/webhooks.tsx` — Add forgejo/gitea type option, secret field

---

## Task 1: Database Migration — Add Secret Column

**Files:**
- Create: `migrations/026_webhook_secret.sql`

- [ ] **Step 1: Create migration**

```sql
-- migrations/026_webhook_secret.sql
ALTER TABLE webhook_configs ADD COLUMN secret TEXT DEFAULT NULL;
```

- [ ] **Step 2: Verify migration applies**

Run: `cargo build`
Expected: Compiles (migration auto-applied on next server start)

- [ ] **Step 3: Commit**

```bash
git add migrations/026_webhook_secret.sql
git commit -m "feat(backend): add secret column to webhook_configs for HMAC verification"
```

---

## Task 2: Update Backend Models — Secret Field

**Files:**
- Modify: `crates/rstify-core/src/models/attachment.rs`

- [ ] **Step 1: Add secret to WebhookConfig**

Find the `WebhookConfig` struct (around line 18). Add after `group_name`:

```rust
    #[serde(alias = "secret")]
    pub secret: Option<String>,
```

- [ ] **Step 2: Add secret to CreateWebhookConfig**

Find `CreateWebhookConfig` (around line 42). Add:

```rust
    #[serde(alias = "secret")]
    pub secret: Option<String>,
```

- [ ] **Step 3: Add secret to UpdateWebhookConfig**

Find `UpdateWebhookConfig` (around line 75). Add:

```rust
    #[serde(alias = "secret")]
    pub secret: Option<String>,
```

- [ ] **Step 4: Verify compiles**

Run: `cargo build`
Expected: May have errors in DB layer — that's Task 3.

- [ ] **Step 5: Commit**

```bash
git add crates/rstify-core/src/models/attachment.rs
git commit -m "feat(backend): add secret field to webhook config models"
```

---

## Task 3: Update DB Repository — Secret in SQL

**Files:**
- Modify: `crates/rstify-db/src/repositories/message.rs`

- [ ] **Step 1: Update create_webhook_config INSERT**

Find the `create_webhook_config` function (around line 412). Add `secret` to the INSERT column list and values:

In the SQL string, add `secret` after `group_name` in the column list and add a `?` placeholder.

Add the bind:
```rust
.bind(&config.secret)
```

- [ ] **Step 2: Update update_webhook_config**

Find `update_webhook_config` (around line 491). In the merge logic where current values are overridden by new values, add:

```rust
let secret = update.secret.or(current.secret.clone());
```

In the UPDATE SQL, add `secret = ?` to the SET clause. Add the bind:
```rust
.bind(&secret)
```

- [ ] **Step 3: Verify compiles**

Run: `cargo build`
Expected: Clean compilation

- [ ] **Step 4: Commit**

```bash
git add crates/rstify-db/src/repositories/message.rs
git commit -m "feat(backend): include secret column in webhook config SQL queries"
```

---

## Task 4: Create Webhook Module Structure + Shared Types

**Files:**
- Create: `crates/rstify-api/src/webhooks/mod.rs`
- Create: `crates/rstify-api/src/webhooks/types.rs`
- Modify: `crates/rstify-api/src/lib.rs`

- [ ] **Step 1: Create module declaration**

```rust
// crates/rstify-api/src/webhooks/mod.rs
pub mod forgejo;
pub mod github;
pub mod signature;
pub mod types;
```

- [ ] **Step 2: Create shared output type**

```rust
// crates/rstify-api/src/webhooks/types.rs

/// Common output from all webhook parsers. Used by receive_webhook
/// to create a message with rich content.
pub struct WebhookMessageOutput {
    pub title: String,
    pub message: String,
    pub priority: i32,
    pub click_url: Option<String>,
    pub tags: Vec<String>,
    pub content_type: Option<String>,
}

impl WebhookMessageOutput {
    /// Build the extras JSON for markdown content type
    pub fn extras_json(&self) -> Option<String> {
        if self.content_type.as_deref() == Some("text/markdown") {
            Some(r#"{"client::display":{"contentType":"text/markdown"}}"#.to_string())
        } else {
            None
        }
    }

    /// Build tags as JSON array string for storage
    pub fn tags_json(&self) -> Option<String> {
        if self.tags.is_empty() {
            None
        } else {
            serde_json::to_string(&self.tags).ok()
        }
    }
}
```

- [ ] **Step 3: Declare module in lib.rs**

In `crates/rstify-api/src/lib.rs`, add:

```rust
pub mod webhooks;
```

- [ ] **Step 4: Verify compiles**

Run: `cargo build`
Expected: May fail on missing forgejo.rs/github.rs/signature.rs — create empty stubs:

```rust
// crates/rstify-api/src/webhooks/forgejo.rs
// Forgejo/Gitea webhook payload parser — implemented in Task 6

// crates/rstify-api/src/webhooks/github.rs
// GitHub webhook payload parser — implemented in Task 7

// crates/rstify-api/src/webhooks/signature.rs
// HMAC signature verification — implemented in Task 5
```

Run: `cargo build`
Expected: Clean compilation

- [ ] **Step 5: Commit**

```bash
git add crates/rstify-api/src/webhooks/ crates/rstify-api/src/lib.rs
git commit -m "feat(backend): create webhooks module structure with shared types"
```

---

## Task 5: HMAC Signature Verification

**Files:**
- Modify: `crates/rstify-api/Cargo.toml`
- Modify: `crates/rstify-api/src/webhooks/signature.rs`

- [ ] **Step 1: Add dependencies**

In `crates/rstify-api/Cargo.toml`, add to `[dependencies]`:

```toml
hmac = "0.12"
sha2 = "0.10"
```

- [ ] **Step 2: Implement signature verification**

```rust
// crates/rstify-api/src/webhooks/signature.rs
use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

/// Verify a Gitea/Forgejo HMAC-SHA256 signature.
/// Gitea sends raw lowercase hex in X-Gitea-Signature (no prefix).
pub fn verify_gitea_signature(secret: &str, body: &[u8], provided_hex: &str) -> bool {
    let Ok(mut mac) = HmacSha256::new_from_slice(secret.as_bytes()) else {
        return false;
    };
    mac.update(body);
    let computed = mac.finalize().into_bytes();
    let computed_hex: String = computed.iter().map(|b| format!("{:02x}", b)).collect();
    constant_time_eq(computed_hex.as_bytes(), provided_hex.as_bytes())
}

/// Verify a GitHub HMAC-SHA256 signature.
/// GitHub sends "sha256=<hex>" in X-Hub-Signature-256.
pub fn verify_github_signature(secret: &str, body: &[u8], header_value: &str) -> bool {
    let provided_hex = match header_value.strip_prefix("sha256=") {
        Some(hex) => hex,
        None => return false,
    };
    let Ok(mut mac) = HmacSha256::new_from_slice(secret.as_bytes()) else {
        return false;
    };
    mac.update(body);
    let computed = mac.finalize().into_bytes();
    let computed_hex: String = computed.iter().map(|b| format!("{:02x}", b)).collect();
    constant_time_eq(computed_hex.as_bytes(), provided_hex.as_bytes())
}

/// Constant-time byte comparison to prevent timing attacks.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b.iter()).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gitea_signature() {
        // echo -n '{"action":"push"}' | openssl dgst -sha256 -hmac "mysecret"
        let body = b"{\"action\":\"push\"}";
        let secret = "mysecret";
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(body);
        let expected: String = mac.finalize().into_bytes().iter().map(|b| format!("{:02x}", b)).collect();

        assert!(verify_gitea_signature(secret, body, &expected));
        assert!(!verify_gitea_signature(secret, body, "wrong"));
        assert!(!verify_gitea_signature("wrongsecret", body, &expected));
    }

    #[test]
    fn test_github_signature() {
        let body = b"{\"action\":\"push\"}";
        let secret = "mysecret";
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(body);
        let hex: String = mac.finalize().into_bytes().iter().map(|b| format!("{:02x}", b)).collect();
        let header = format!("sha256={}", hex);

        assert!(verify_github_signature(secret, body, &header));
        assert!(!verify_github_signature(secret, body, "sha256=wrong"));
        assert!(!verify_github_signature(secret, body, "noprefixhex"));
    }
}
```

- [ ] **Step 3: Run tests**

Run: `cargo test -p rstify-api -- webhooks::signature`
Expected: 2 tests pass

- [ ] **Step 4: Commit**

```bash
git add crates/rstify-api/Cargo.toml crates/rstify-api/src/webhooks/signature.rs
git commit -m "feat(backend): add HMAC-SHA256 signature verification for GitHub and Gitea"
```

---

## Task 6: Forgejo Payload Parser

**Files:**
- Modify: `crates/rstify-api/src/webhooks/forgejo.rs`

Parses 8 Forgejo/Gitea event types into rich markdown messages.

- [ ] **Step 1: Define shared payload structs and parser**

```rust
// crates/rstify-api/src/webhooks/forgejo.rs
use serde::Deserialize;
use super::types::WebhookMessageOutput;

#[derive(Deserialize, Default)]
struct Repo {
    full_name: Option<String>,
    html_url: Option<String>,
    default_branch: Option<String>,
}

#[derive(Deserialize, Default)]
struct Sender {
    login: Option<String>,
}

#[derive(Deserialize, Default)]
struct Commit {
    id: Option<String>,
    message: Option<String>,
    url: Option<String>,
    author: Option<CommitAuthor>,
}

#[derive(Deserialize, Default)]
struct CommitAuthor {
    name: Option<String>,
}

#[derive(Deserialize, Default)]
struct PullRequest {
    title: Option<String>,
    body: Option<String>,
    html_url: Option<String>,
    state: Option<String>,
    merged: Option<bool>,
    head: Option<Branch>,
    base: Option<Branch>,
}

#[derive(Deserialize, Default)]
struct Branch {
    #[serde(rename = "ref")]
    ref_: Option<String>,
    label: Option<String>,
}

#[derive(Deserialize, Default)]
struct Issue {
    number: Option<i64>,
    title: Option<String>,
    body: Option<String>,
    html_url: Option<String>,
    state: Option<String>,
}

#[derive(Deserialize, Default)]
struct Release {
    tag_name: Option<String>,
    name: Option<String>,
    body: Option<String>,
    html_url: Option<String>,
    prerelease: Option<bool>,
    draft: Option<bool>,
}

#[derive(Deserialize, Default)]
struct Comment {
    body: Option<String>,
    html_url: Option<String>,
}

#[derive(Deserialize, Default)]
struct Payload {
    action: Option<String>,
    #[serde(rename = "ref")]
    ref_: Option<String>,
    ref_type: Option<String>,
    compare_url: Option<String>,
    commits: Option<Vec<Commit>>,
    total_commits: Option<i64>,
    repository: Option<Repo>,
    sender: Option<Sender>,
    pull_request: Option<PullRequest>,
    issue: Option<Issue>,
    release: Option<Release>,
    comment: Option<Comment>,
    forkee: Option<Repo>,
    // CI/CD status (Forgejo Actions)
    workflow_run: Option<WorkflowRun>,
}

#[derive(Deserialize, Default)]
struct WorkflowRun {
    name: Option<String>,
    conclusion: Option<String>,
    html_url: Option<String>,
    head_branch: Option<String>,
}

/// Parse a Forgejo/Gitea webhook event into a message.
pub fn parse_forgejo_event(event_type: &str, body: &[u8]) -> WebhookMessageOutput {
    let payload: Payload = serde_json::from_slice(body).unwrap_or_default();
    let repo = payload.repository.as_ref().map(|r| r.full_name.as_deref().unwrap_or("unknown")).unwrap_or("unknown");
    let sender = payload.sender.as_ref().map(|s| s.login.as_deref().unwrap_or("unknown")).unwrap_or("unknown");

    match event_type {
        "push" => parse_push(&payload, repo, sender),
        "pull_request" => parse_pull_request(&payload, repo, sender),
        "issues" => parse_issue(&payload, repo, sender),
        "release" => parse_release(&payload, repo, sender),
        "create" => parse_create(&payload, repo, sender),
        "delete" => parse_delete(&payload, repo, sender),
        "fork" => parse_fork(&payload, repo, sender),
        "issue_comment" => parse_issue_comment(&payload, repo, sender),
        "workflow_run" | "workflow_job" => parse_workflow(&payload, repo, sender),
        _ => WebhookMessageOutput {
            title: format!("[{}] {} event", repo, event_type),
            message: format!("Received `{}` event from **{}** by {}", event_type, repo, sender),
            priority: 5,
            click_url: payload.repository.as_ref().and_then(|r| r.html_url.clone()),
            tags: vec![event_type.to_string()],
            content_type: Some("text/markdown".to_string()),
        },
    }
}

fn parse_push(p: &Payload, repo: &str, sender: &str) -> WebhookMessageOutput {
    let ref_ = p.ref_.as_deref().unwrap_or("unknown");
    let branch = ref_.strip_prefix("refs/heads/").unwrap_or(ref_);
    let total = p.total_commits.unwrap_or(0);
    let commits = p.commits.as_deref().unwrap_or(&[]);

    let mut body = format!("**{} commit{}** to `{}` ", total, if total == 1 { "" } else { "s" }, branch);
    if let Some(url) = &p.compare_url {
        body.push_str(&format!("([compare]({}))\n\n", url));
    } else {
        body.push('\n');
    }

    for (i, c) in commits.iter().take(10).enumerate() {
        let sha = c.id.as_deref().unwrap_or("???????").get(..7).unwrap_or("???????");
        let msg = c.message.as_deref().unwrap_or("(no message)").lines().next().unwrap_or("(no message)");
        let author = c.author.as_ref().and_then(|a| a.name.as_deref()).unwrap_or(sender);
        if let Some(url) = &c.url {
            body.push_str(&format!("- [`{}`]({}) {} — {}\n", sha, url, msg, author));
        } else {
            body.push_str(&format!("- `{}` {} — {}\n", sha, msg, author));
        }
        if i == 9 && total > 10 {
            body.push_str(&format!("\n...and {} more commits\n", total - 10));
        }
    }

    let is_default = p.repository.as_ref()
        .and_then(|r| r.default_branch.as_deref())
        .map(|db| branch == db)
        .unwrap_or(false);

    WebhookMessageOutput {
        title: format!("[{}] Push to {} by {}", repo, branch, sender),
        message: body,
        priority: if is_default && total > 5 { 7 } else { 5 },
        click_url: p.compare_url.clone(),
        tags: vec!["push".to_string(), branch.to_string()],
        content_type: Some("text/markdown".to_string()),
    }
}

fn parse_pull_request(p: &Payload, repo: &str, sender: &str) -> WebhookMessageOutput {
    let action = p.action.as_deref().unwrap_or("unknown");
    let pr = p.pull_request.as_ref();
    let number = pr.and_then(|pr| pr.title.as_deref()).unwrap_or("?");
    let title = pr.and_then(|pr| pr.title.as_deref()).unwrap_or("Untitled");
    let url = pr.and_then(|pr| pr.html_url.clone());
    let merged = pr.and_then(|pr| pr.merged).unwrap_or(false);
    let head = pr.and_then(|pr| pr.head.as_ref()).and_then(|b| b.ref_.as_deref()).unwrap_or("?");
    let base = pr.and_then(|pr| pr.base.as_ref()).and_then(|b| b.ref_.as_deref()).unwrap_or("?");

    let display_action = if action == "closed" && merged { "merged" } else { action };

    let mut body = format!("**{}** {} PR from `{}` → `{}`", sender, display_action, head, base);
    if let Some(pr_body) = pr.and_then(|pr| pr.body.as_deref()) {
        if !pr_body.is_empty() {
            let truncated = if pr_body.len() > 500 { &pr_body[..500] } else { pr_body };
            body.push_str(&format!("\n\n{}{}", truncated, if pr_body.len() > 500 { "..." } else { "" }));
        }
    }

    // Extract PR number from URL or action payload
    let pr_num_str = url.as_deref()
        .and_then(|u| u.rsplit('/').next())
        .unwrap_or("?");

    WebhookMessageOutput {
        title: format!("[{}] PR #{}: {} [{}]", repo, pr_num_str, title, display_action),
        message: body,
        priority: 7,
        click_url: url,
        tags: vec!["pull_request".to_string(), display_action.to_string()],
        content_type: Some("text/markdown".to_string()),
    }
}

fn parse_issue(p: &Payload, repo: &str, sender: &str) -> WebhookMessageOutput {
    let action = p.action.as_deref().unwrap_or("unknown");
    let issue = p.issue.as_ref();
    let number = issue.and_then(|i| i.number).unwrap_or(0);
    let title = issue.and_then(|i| i.title.as_deref()).unwrap_or("Untitled");
    let url = issue.and_then(|i| i.html_url.clone());

    let mut body = format!("**{}** {} issue in {}", sender, action, repo);
    if let Some(issue_body) = issue.and_then(|i| i.body.as_deref()) {
        if !issue_body.is_empty() {
            let truncated = if issue_body.len() > 500 { &issue_body[..500] } else { issue_body };
            body.push_str(&format!("\n\n{}{}", truncated, if issue_body.len() > 500 { "..." } else { "" }));
        }
    }

    WebhookMessageOutput {
        title: format!("[{}] Issue #{}: {} [{}]", repo, number, title, action),
        message: body,
        priority: 5,
        click_url: url,
        tags: vec!["issue".to_string(), action.to_string()],
        content_type: Some("text/markdown".to_string()),
    }
}

fn parse_release(p: &Payload, repo: &str, sender: &str) -> WebhookMessageOutput {
    let action = p.action.as_deref().unwrap_or("published");
    let rel = p.release.as_ref();
    let tag = rel.and_then(|r| r.tag_name.as_deref()).unwrap_or("?");
    let name = rel.and_then(|r| r.name.as_deref()).unwrap_or(tag);
    let url = rel.and_then(|r| r.html_url.clone());
    let prerelease = rel.and_then(|r| r.prerelease).unwrap_or(false);
    let draft = rel.and_then(|r| r.draft).unwrap_or(false);

    let mut body = format!("**{}** {} by {}", name, action, sender);
    if prerelease { body.push_str(" *(pre-release)*"); }
    if draft { body.push_str(" *(draft)*"); }
    if let Some(rel_body) = rel.and_then(|r| r.body.as_deref()) {
        if !rel_body.is_empty() {
            let truncated = if rel_body.len() > 500 { &rel_body[..500] } else { rel_body };
            body.push_str(&format!("\n\n{}{}", truncated, if rel_body.len() > 500 { "..." } else { "" }));
        }
    }

    WebhookMessageOutput {
        title: format!("[{}] Released {}", repo, tag),
        message: body,
        priority: if draft { 4 } else if prerelease { 6 } else { 8 },
        click_url: url,
        tags: vec!["release".to_string(), tag.to_string()],
        content_type: Some("text/markdown".to_string()),
    }
}

fn parse_create(p: &Payload, repo: &str, sender: &str) -> WebhookMessageOutput {
    let ref_ = p.ref_.as_deref().unwrap_or("unknown");
    let ref_type = p.ref_type.as_deref().unwrap_or("branch");
    let url = p.repository.as_ref().and_then(|r| r.html_url.clone());

    WebhookMessageOutput {
        title: format!("[{}] {} {} created", repo, ref_type, ref_),
        message: format!("{} created {} **{}** in {}", sender, ref_type, ref_, repo),
        priority: 3,
        click_url: url,
        tags: vec!["create".to_string(), ref_type.to_string()],
        content_type: Some("text/markdown".to_string()),
    }
}

fn parse_delete(p: &Payload, repo: &str, sender: &str) -> WebhookMessageOutput {
    let ref_ = p.ref_.as_deref().unwrap_or("unknown");
    let ref_type = p.ref_type.as_deref().unwrap_or("branch");
    let url = p.repository.as_ref().and_then(|r| r.html_url.clone());

    WebhookMessageOutput {
        title: format!("[{}] {} {} deleted", repo, ref_type, ref_),
        message: format!("{} deleted {} **{}** in {}", sender, ref_type, ref_, repo),
        priority: 3,
        click_url: url,
        tags: vec!["delete".to_string(), ref_type.to_string()],
        content_type: Some("text/markdown".to_string()),
    }
}

fn parse_fork(p: &Payload, repo: &str, sender: &str) -> WebhookMessageOutput {
    let forkee = p.forkee.as_ref();
    let fork_name = forkee.and_then(|f| f.full_name.as_deref()).unwrap_or("unknown");
    let fork_url = forkee.and_then(|f| f.html_url.clone());

    WebhookMessageOutput {
        title: format!("[{}] Forked by {}", repo, sender),
        message: format!("{} forked {} → {}", sender, repo, fork_name),
        priority: 4,
        click_url: fork_url,
        tags: vec!["fork".to_string()],
        content_type: Some("text/markdown".to_string()),
    }
}

fn parse_issue_comment(p: &Payload, repo: &str, sender: &str) -> WebhookMessageOutput {
    let action = p.action.as_deref().unwrap_or("created");
    let issue = p.issue.as_ref();
    let number = issue.and_then(|i| i.number).unwrap_or(0);
    let issue_title = issue.and_then(|i| i.title.as_deref()).unwrap_or("?");
    let comment = p.comment.as_ref();
    let comment_body = comment.and_then(|c| c.body.as_deref()).unwrap_or("");
    let comment_url = comment.and_then(|c| c.html_url.clone());

    let truncated = if comment_body.len() > 300 { &comment_body[..300] } else { comment_body };
    let body = format!(
        "**{}** {} a comment on issue #{} in {}\n\n> {}{}",
        sender, action, number, repo,
        truncated,
        if comment_body.len() > 300 { "..." } else { "" }
    );

    WebhookMessageOutput {
        title: format!("[{}] Comment on #{}: {}", repo, number, issue_title),
        message: body,
        priority: 4,
        click_url: comment_url,
        tags: vec!["issue_comment".to_string()],
        content_type: Some("text/markdown".to_string()),
    }
}

fn parse_workflow(p: &Payload, repo: &str, sender: &str) -> WebhookMessageOutput {
    let action = p.action.as_deref().unwrap_or("completed");
    let wf = p.workflow_run.as_ref();
    let name = wf.and_then(|w| w.name.as_deref()).unwrap_or("CI");
    let conclusion = wf.and_then(|w| w.conclusion.as_deref()).unwrap_or("unknown");
    let url = wf.and_then(|w| w.html_url.clone());
    let branch = wf.and_then(|w| w.head_branch.as_deref()).unwrap_or("?");

    let (emoji, priority) = match conclusion {
        "success" => ("✅", 5),
        "failure" => ("❌", 8),
        "cancelled" => ("⚠️", 4),
        _ => ("🔄", 5),
    };

    WebhookMessageOutput {
        title: format!("[{}] {} {} {} on {}", repo, emoji, name, conclusion, branch),
        message: format!("Workflow **{}** {} on branch `{}` by {}", name, conclusion, branch, sender),
        priority,
        click_url: url,
        tags: vec!["ci".to_string(), conclusion.to_string()],
        content_type: Some("text/markdown".to_string()),
    }
}
```

- [ ] **Step 2: Verify compiles**

Run: `cargo build`
Expected: Clean compilation

- [ ] **Step 3: Commit**

```bash
git add crates/rstify-api/src/webhooks/forgejo.rs
git commit -m "feat(backend): add Forgejo/Gitea webhook payload parser with 9 event types"
```

---

## Task 7: GitHub Payload Parser Upgrade

**Files:**
- Modify: `crates/rstify-api/src/webhooks/github.rs`

The existing GitHub handler in `receive_webhook` only extracts action + repo name. Upgrade it to produce the same rich output as Forgejo. GitHub and Gitea payloads are nearly identical in structure, so this reuses the same patterns.

- [ ] **Step 1: Implement GitHub parser**

The code structure is identical to the Forgejo parser since GitHub and Gitea/Forgejo share the same payload format. The only differences are:
- GitHub uses `X-GitHub-Event` header (vs `X-Gitea-Event`)
- GitHub uses `sha256=<hex>` signature format (vs raw hex)
- Minor field differences (GitHub has `workflow_run.conclusion` in the same format)

```rust
// crates/rstify-api/src/webhooks/github.rs
use super::types::WebhookMessageOutput;

/// Parse a GitHub webhook event. GitHub and Gitea payloads are nearly
/// identical, so this delegates to the Forgejo parser.
pub fn parse_github_event(event_type: &str, body: &[u8]) -> WebhookMessageOutput {
    // GitHub and Forgejo/Gitea share the same payload format
    super::forgejo::parse_forgejo_event(event_type, body)
}
```

Since the payload formats are the same, we avoid code duplication entirely. The only difference (signature format) is handled in the `receive_webhook` dispatcher, not the parser.

- [ ] **Step 2: Verify compiles**

Run: `cargo build`
Expected: Clean compilation

- [ ] **Step 3: Commit**

```bash
git add crates/rstify-api/src/webhooks/github.rs
git commit -m "feat(backend): upgrade GitHub webhook parser to use shared Forgejo format"
```

---

## Task 8: Wire Parsers into receive_webhook Handler

**Files:**
- Modify: `crates/rstify-api/src/routes/webhooks.rs`

Change extractor from `Json<Value>` to `Bytes` + `HeaderMap`, add signature verification, wire Forgejo and GitHub parsers.

- [ ] **Step 1: Change the function signature**

Find `receive_webhook` (around line 323). Change from:

```rust
pub async fn receive_webhook(
    State(state): State<AppState>,
    Path(token): Path<String>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, ApiError> {
```

To:

```rust
pub async fn receive_webhook(
    State(state): State<AppState>,
    Path(token): Path<String>,
    headers: axum::http::HeaderMap,
    body: axum::body::Bytes,
) -> Result<Json<serde_json::Value>, ApiError> {
```

- [ ] **Step 2: Parse JSON from bytes at the top of the function**

After the config lookup and enabled check, add:

```rust
    let payload: serde_json::Value = serde_json::from_slice(&body)
        .map_err(|_| ApiError::from(CoreError::Validation("Invalid JSON body".to_string())))?;
```

- [ ] **Step 3: Add forgejo/gitea branch to the match**

Replace the existing `match config.webhook_type.as_str()` body. Keep `github`, `grafana`, and default cases but upgrade them:

```rust
    let (title, message, priority, click_url, tags_json, extras_json) = match config.webhook_type.as_str() {
        "forgejo" | "gitea" => {
            // Signature verification
            if let Some(ref secret) = config.secret {
                if !secret.is_empty() {
                    let sig = headers.get("X-Gitea-Signature")
                        .or_else(|| headers.get("X-Forgejo-Signature"))
                        .and_then(|v| v.to_str().ok())
                        .unwrap_or("");
                    if sig.is_empty() || !crate::webhooks::signature::verify_gitea_signature(secret, &body, sig) {
                        return Err(ApiError::from(CoreError::Forbidden("Invalid webhook signature".to_string())));
                    }
                }
            }
            let event = headers.get("X-Gitea-Event")
                .or_else(|| headers.get("X-Forgejo-Event"))
                .and_then(|v| v.to_str().ok())
                .unwrap_or("unknown");
            let output = crate::webhooks::forgejo::parse_forgejo_event(event, &body);
            (Some(output.title), output.message, output.priority,
             output.click_url, output.tags_json(), output.extras_json())
        }
        "github" => {
            // Signature verification
            if let Some(ref secret) = config.secret {
                if !secret.is_empty() {
                    let sig = headers.get("X-Hub-Signature-256")
                        .and_then(|v| v.to_str().ok())
                        .unwrap_or("");
                    if sig.is_empty() || !crate::webhooks::signature::verify_github_signature(secret, &body, sig) {
                        return Err(ApiError::from(CoreError::Forbidden("Invalid webhook signature".to_string())));
                    }
                }
            }
            let event = headers.get("X-GitHub-Event")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("unknown");
            let output = crate::webhooks::github::parse_github_event(event, &body);
            (Some(output.title), output.message, output.priority,
             output.click_url, output.tags_json(), output.extras_json())
        }
        "grafana" => {
            // Keep existing grafana logic
            let title = payload.get("title").and_then(|v| v.as_str()).map(String::from);
            let message = payload.get("message").and_then(|v| v.as_str()).unwrap_or("Grafana alert").to_string();
            (title, message, 5, None, None, None)
        }
        _ => {
            // Generic/custom webhook — extract title and message
            let title = payload.get("title").and_then(|v| v.as_str()).map(String::from);
            let message = payload.get("message").and_then(|v| v.as_str())
                .or_else(|| payload.get("text").and_then(|v| v.as_str()))
                .unwrap_or("Webhook received").to_string();
            (title, message, 5, None, None, None)
        }
    };
```

- [ ] **Step 4: Pass click_url, tags, extras to message creation**

Update the `message_repo.create(...)` call to pass the new fields. Find where `click_url: None`, `tags: None`, `extras: None` are passed and replace with the variables from the match.

- [ ] **Step 5: Verify compiles**

Run: `cargo build`
Expected: Clean compilation

- [ ] **Step 6: Commit**

```bash
git add crates/rstify-api/src/routes/webhooks.rs
git commit -m "feat(backend): wire Forgejo+GitHub parsers into receive_webhook with signature verification"
```

---

## Task 9: Frontend — Add Forgejo Type + Secret Field

**Files:**
- Modify: `web-ui/src/api/types.ts`
- Modify: `web-ui/src/pages/Webhooks.tsx`
- Modify: `client/src/api/types.ts` (mobile)
- Modify: `client/app/hub/webhooks.tsx` (mobile)

- [ ] **Step 1: Add secret to web UI types**

In `web-ui/src/api/types.ts`, add `secret?: string | null` to `WebhookConfig`, `secret?: string` to `CreateWebhookConfig`, and `secret?: string` to `UpdateWebhookConfig`.

- [ ] **Step 2: Add forgejo to web UI webhook type dropdown**

In `web-ui/src/pages/Webhooks.tsx`, find the webhook type `<select>` (around line 742). Add:

```tsx
<option value="forgejo">Forgejo / Gitea</option>
```

- [ ] **Step 3: Add secret field to web UI create/edit forms**

In the webhook create form, after the webhook type selector, add:

```tsx
<div>
  <label className={labelCls}>Webhook Secret (optional)</label>
  <input
    type="password"
    placeholder="HMAC signing secret for signature verification"
    value={form.secret || ''}
    onChange={e => setForm(f => ({ ...f, secret: e.target.value || undefined }))}
    className={inputCls}
  />
  <p className="text-xs text-gray-400 mt-1">Set a secret in Forgejo/GitHub webhook settings to enable signature verification</p>
</div>
```

Same field in the edit form.

- [ ] **Step 4: Add secret to mobile types**

In `client/src/api/types.ts`, add `secret?: string | null` to `WebhookConfig` and `secret?: string` to `CreateWebhookConfig` and `UpdateWebhookConfig`.

- [ ] **Step 5: Add forgejo type option to mobile webhooks**

In `client/app/hub/webhooks.tsx`, find the webhook type selector. Add `forgejo` as an option.

- [ ] **Step 6: Verify both build**

Run: `cd web-ui && npm run build` and `cd client && npx tsc --noEmit`
Expected: No errors for both

- [ ] **Step 7: Commit**

```bash
git add web-ui/src/api/types.ts web-ui/src/pages/Webhooks.tsx client/src/api/types.ts client/app/hub/webhooks.tsx
git commit -m "feat(frontend): add Forgejo webhook type and secret field to web UI and mobile"
```

---

## Task 10: Integration Test + Documentation

**Files:**
- Modify: `USER_GUIDE.md` or create `docs/FORGEJO_SETUP.md`

- [ ] **Step 1: Test with curl**

Simulate a Forgejo push event:

```bash
# Generate signature
SECRET="testsecret"
BODY='{"ref":"refs/heads/main","compare_url":"https://forgejo.example.com/repo/compare/abc...def","total_commits":1,"commits":[{"id":"abc1234567890","message":"test commit","url":"https://forgejo.example.com/repo/commit/abc","author":{"name":"alice"}}],"repository":{"full_name":"owner/repo","html_url":"https://forgejo.example.com/owner/repo","default_branch":"main"},"sender":{"login":"alice"}}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

# Send to local server (create a forgejo webhook first via API)
curl -X POST http://localhost:8080/api/wh/YOUR_TOKEN \
  -H "Content-Type: application/json" \
  -H "X-Gitea-Event: push" \
  -H "X-Gitea-Signature: $SIG" \
  -d "$BODY"
```

Expected: 200 with message_id, message appears in inbox with markdown formatting.

- [ ] **Step 2: Test signature rejection**

```bash
curl -X POST http://localhost:8080/api/wh/YOUR_TOKEN \
  -H "Content-Type: application/json" \
  -H "X-Gitea-Event: push" \
  -H "X-Gitea-Signature: wrongsignature" \
  -d "$BODY"
```

Expected: 403 Forbidden

- [ ] **Step 3: Test GitHub format**

```bash
SECRET="testsecret"
BODY='{"ref":"refs/heads/main","compare":"https://github.com/owner/repo/compare/abc...def","commits":[{"id":"abc1234567890","message":"test commit","url":"https://github.com/owner/repo/commit/abc","author":{"name":"alice"}}],"repository":{"full_name":"owner/repo","html_url":"https://github.com/owner/repo","default_branch":"main"},"sender":{"login":"alice"}}'
SIG="sha256=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')"

curl -X POST http://localhost:8080/api/wh/YOUR_TOKEN \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-Hub-Signature-256: $SIG" \
  -d "$BODY"
```

- [ ] **Step 4: Commit**

```bash
git commit -m "docs: add Forgejo/GitHub webhook integration tests and documentation"
```

---

## Verification Checklist

- [ ] `cargo build --release` — zero errors
- [ ] `cargo test -p rstify-api` — signature tests pass
- [ ] `cd web-ui && npm run build` — zero errors
- [ ] `cd client && npx tsc --noEmit` — zero errors
- [ ] Forgejo push event produces markdown message with commit list
- [ ] Forgejo PR event produces message with title, action, description excerpt
- [ ] Forgejo release event produces message with tag and changelog
- [ ] Forgejo workflow_run event produces CI build notification with ✅/❌
- [ ] GitHub events produce identical output format
- [ ] Wrong signature returns 403
- [ ] No secret configured = verification skipped (backwards compatible)
- [ ] Web UI shows "Forgejo / Gitea" in webhook type dropdown
- [ ] Web UI has secret field in create/edit forms
- [ ] Mobile app has forgejo type option
