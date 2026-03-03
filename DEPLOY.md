# Monaclick Deployment Runbook

## 1) Pre-Deploy Checklist
- Confirm latest code is committed and pushed.
- Take backup of:
  - Database
  - `storage/app/public` (uploaded images)
- Confirm production `.env` values are ready.

## 2) Required Production `.env` Settings
Use production-safe values:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.com

LOG_LEVEL=error

BCRYPT_ROUNDS=12

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=your_db
DB_USERNAME=your_user
DB_PASSWORD=your_password

SESSION_DRIVER=file
CACHE_STORE=file
QUEUE_CONNECTION=sync

FILESYSTEM_DISK=public
```

## 3) Deploy Commands (Server)
Run from project root:

```bash
composer install --no-dev --optimize-autoloader
npm ci
npm run build

php artisan optimize:clear
php artisan migrate --force
php artisan storage:link
php artisan optimize
```

## 4) Web Server Requirements
- Document root must point to: `public/`
- URL rewrite must be enabled (Laravel routing)
- PHP `intl` extension enabled
- `storage/` and `bootstrap/cache/` writable

## 5) Post-Deploy Smoke Test
Check these URLs:
- `/contractors`
- `/real-estate`
- `/cars`
- `/events`
- `/listings/contractors`
- `/listings/real-estate`
- `/listings/cars`
- `/listings/events`
- `/admin`

API checks:
- `/api/monaclick/listings?module=contractors`
- `/api/monaclick/listings?module=real-estate`
- `/api/monaclick/listings?module=cars`
- `/api/monaclick/listings?module=events`

Functional checks:
- Create/edit/delete one listing in admin.
- Confirm listing reflects on frontend.
- Open listing detail page and confirm no wrong-content flash.

## 6) Rollback Plan
If deploy fails:
1. Put app in maintenance mode:
   ```bash
   php artisan down
   ```
2. Restore previous code release.
3. Restore DB backup (if migration/data issue).
4. Re-run:
   ```bash
   php artisan optimize:clear
   php artisan optimize
   php artisan up
   ```

## 7) Optional (Recommended)
- Set up a queue worker + supervisor if async jobs are introduced.
- Move cache/session/queue to Redis for higher traffic.
- Add uptime monitoring and error alerts.
