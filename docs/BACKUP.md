# Backup & Restore Guide

## What to Back Up

1. **SQLite database** — contains all users, messages, applications, topics, webhooks
2. **Uploads directory** — contains application icons and message attachments

## Backup

### Option 1: Stop and Copy (safest)

```bash
docker compose stop rstify
cp /data/rstify.db /backups/rstify-$(date +%Y%m%d).db
cp -r /uploads /backups/uploads-$(date +%Y%m%d)
docker compose start rstify
```

### Option 2: SQLite Online Backup (no downtime)

```bash
sqlite3 /data/rstify.db ".backup '/backups/rstify-$(date +%Y%m%d).db'"
rsync -a /uploads/ /backups/uploads-$(date +%Y%m%d)/
```

### Option 3: Automated Cron

Add to crontab (`crontab -e`):

```cron
# Daily backup at 3 AM, keep 30 days
0 3 * * * sqlite3 /data/rstify.db ".backup '/backups/rstify-$(date +\%Y\%m\%d).db'" && find /backups -name 'rstify-*.db' -mtime +30 -delete
0 3 * * * rsync -a --delete /uploads/ /backups/uploads-latest/
```

## Restore

1. Stop the server:
   ```bash
   docker compose stop rstify
   ```

2. Replace the database:
   ```bash
   cp /backups/rstify-20250101.db /data/rstify.db
   ```

3. Restore uploads:
   ```bash
   cp -r /backups/uploads-20250101/* /uploads/
   ```

4. Start the server:
   ```bash
   docker compose start rstify
   ```

## Docker Volumes

If using Docker, ensure persistent volumes are configured:

```yaml
volumes:
  - ./data:/data
  - ./uploads:/uploads
```

## Verification

After restore, verify the database:

```bash
sqlite3 /data/rstify.db "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM messages;"
```
