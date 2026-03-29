use super::types::WebhookMessageOutput;
use serde::Deserialize;

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
    merged: Option<bool>,
    head: Option<Branch>,
    base: Option<Branch>,
}

#[derive(Deserialize, Default)]
struct Branch {
    #[serde(rename = "ref")]
    ref_: Option<String>,
}

#[derive(Deserialize, Default)]
struct Issue {
    number: Option<i64>,
    title: Option<String>,
    body: Option<String>,
    html_url: Option<String>,
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
struct WorkflowRun {
    name: Option<String>,
    conclusion: Option<String>,
    html_url: Option<String>,
    head_branch: Option<String>,
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
    workflow_run: Option<WorkflowRun>,
}

pub fn parse_forgejo_event(event_type: &str, body: &[u8]) -> Option<WebhookMessageOutput> {
    let payload: Payload = serde_json::from_slice(body).unwrap_or_default();

    // Skip non-completed workflow runs (GitHub/Forgejo send requested, in_progress, completed)
    if matches!(event_type, "workflow_run" | "workflow_job") {
        let action = payload.action.as_deref().unwrap_or("");
        if action != "completed" {
            return None;
        }
    }

    let repo = payload
        .repository
        .as_ref()
        .and_then(|r| r.full_name.as_deref())
        .unwrap_or("unknown");
    let sender = payload
        .sender
        .as_ref()
        .and_then(|s| s.login.as_deref())
        .unwrap_or("unknown");

    Some(match event_type {
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
            message: format!(
                "Received `{}` event from **{}** by {}",
                event_type, repo, sender
            ),
            priority: 5,
            click_url: payload.repository.as_ref().and_then(|r| r.html_url.clone()),
            tags: vec![event_type.to_string()],
            content_type: Some("text/markdown".to_string()),
        },
    })
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        format!("{}...", &s[..max])
    }
}

fn parse_push(p: &Payload, repo: &str, sender: &str) -> WebhookMessageOutput {
    let ref_ = p.ref_.as_deref().unwrap_or("unknown");
    let branch = ref_.strip_prefix("refs/heads/").unwrap_or(ref_);
    let total = p.total_commits.unwrap_or(0);
    let commits = p.commits.as_deref().unwrap_or(&[]);

    let mut body = format!(
        "**{} commit{}** to `{}`",
        total,
        if total == 1 { "" } else { "s" },
        branch
    );
    if let Some(url) = &p.compare_url {
        body.push_str(&format!(" ([compare]({}))\n\n", url));
    } else {
        body.push_str("\n\n");
    }

    for (i, c) in commits.iter().take(10).enumerate() {
        let sha =
            c.id.as_deref()
                .unwrap_or("???????")
                .get(..7)
                .unwrap_or("???????");
        let msg = c
            .message
            .as_deref()
            .unwrap_or("(no message)")
            .lines()
            .next()
            .unwrap_or("(no message)");
        let author = c
            .author
            .as_ref()
            .and_then(|a| a.name.as_deref())
            .unwrap_or(sender);
        if let Some(url) = &c.url {
            body.push_str(&format!("- [`{}`]({}) {} — {}\n", sha, url, msg, author));
        } else {
            body.push_str(&format!("- `{}` {} — {}\n", sha, msg, author));
        }
        if i == 9 && total > 10 {
            body.push_str(&format!("\n...and {} more commits\n", total - 10));
        }
    }

    let is_default = p
        .repository
        .as_ref()
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
    let title = pr.and_then(|pr| pr.title.as_deref()).unwrap_or("Untitled");
    let url = pr.and_then(|pr| pr.html_url.clone());
    let merged = pr.and_then(|pr| pr.merged).unwrap_or(false);
    let head = pr
        .and_then(|pr| pr.head.as_ref())
        .and_then(|b| b.ref_.as_deref())
        .unwrap_or("?");
    let base = pr
        .and_then(|pr| pr.base.as_ref())
        .and_then(|b| b.ref_.as_deref())
        .unwrap_or("?");
    let display_action = if action == "closed" && merged {
        "merged"
    } else {
        action
    };

    let mut body = format!(
        "**{}** {} PR from `{}` → `{}`",
        sender, display_action, head, base
    );
    if let Some(pr_body) = pr.and_then(|pr| pr.body.as_deref()) {
        if !pr_body.is_empty() {
            body.push_str(&format!("\n\n{}", truncate(pr_body, 500)));
        }
    }

    let pr_num = url
        .as_deref()
        .and_then(|u| u.rsplit('/').next())
        .unwrap_or("?");

    WebhookMessageOutput {
        title: format!("[{}] PR #{}: {} [{}]", repo, pr_num, title, display_action),
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
            body.push_str(&format!("\n\n{}", truncate(issue_body, 500)));
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
    if prerelease {
        body.push_str(" *(pre-release)*");
    }
    if draft {
        body.push_str(" *(draft)*");
    }
    if let Some(rel_body) = rel.and_then(|r| r.body.as_deref()) {
        if !rel_body.is_empty() {
            body.push_str(&format!("\n\n{}", truncate(rel_body, 500)));
        }
    }

    WebhookMessageOutput {
        title: format!("[{}] Released {}", repo, tag),
        message: body,
        priority: if draft {
            4
        } else if prerelease {
            6
        } else {
            8
        },
        click_url: url,
        tags: vec!["release".to_string(), tag.to_string()],
        content_type: Some("text/markdown".to_string()),
    }
}

fn parse_create(p: &Payload, repo: &str, sender: &str) -> WebhookMessageOutput {
    let ref_ = p.ref_.as_deref().unwrap_or("unknown");
    let ref_type = p.ref_type.as_deref().unwrap_or("branch");
    WebhookMessageOutput {
        title: format!("[{}] {} {} created", repo, ref_type, ref_),
        message: format!("{} created {} **{}** in {}", sender, ref_type, ref_, repo),
        priority: 3,
        click_url: p.repository.as_ref().and_then(|r| r.html_url.clone()),
        tags: vec!["create".to_string(), ref_type.to_string()],
        content_type: Some("text/markdown".to_string()),
    }
}

fn parse_delete(p: &Payload, repo: &str, sender: &str) -> WebhookMessageOutput {
    let ref_ = p.ref_.as_deref().unwrap_or("unknown");
    let ref_type = p.ref_type.as_deref().unwrap_or("branch");
    WebhookMessageOutput {
        title: format!("[{}] {} {} deleted", repo, ref_type, ref_),
        message: format!("{} deleted {} **{}** in {}", sender, ref_type, ref_, repo),
        priority: 3,
        click_url: p.repository.as_ref().and_then(|r| r.html_url.clone()),
        tags: vec!["delete".to_string(), ref_type.to_string()],
        content_type: Some("text/markdown".to_string()),
    }
}

fn parse_fork(p: &Payload, repo: &str, sender: &str) -> WebhookMessageOutput {
    let fork_name = p
        .forkee
        .as_ref()
        .and_then(|f| f.full_name.as_deref())
        .unwrap_or("unknown");
    let fork_url = p.forkee.as_ref().and_then(|f| f.html_url.clone());
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

    let body = format!(
        "**{}** {} a comment on issue #{} in {}\n\n> {}",
        sender,
        action,
        number,
        repo,
        truncate(comment_body, 300)
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
    let wf = p.workflow_run.as_ref();
    let name = wf.and_then(|w| w.name.as_deref()).unwrap_or("CI");
    let conclusion = wf
        .and_then(|w| w.conclusion.as_deref())
        .unwrap_or("unknown");
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
        message: format!(
            "Workflow **{}** {} on branch `{}` by {}",
            name, conclusion, branch, sender
        ),
        priority,
        click_url: url,
        tags: vec!["ci".to_string(), conclusion.to_string()],
        content_type: Some("text/markdown".to_string()),
    }
}
