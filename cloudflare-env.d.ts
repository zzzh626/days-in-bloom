declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    SITE_ADMIN_USERNAME?: string;
    SITE_ADMIN_PASSWORD_HASH?: string;
    SITE_SESSION_SECRET?: string;
  }
}
