interface Env {
  GOOGLE_CLIENT_SECRET: string;
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_APP_SLUG?: string;
  GITHUB_APP_CLIENT_ID?: string;
  GITHUB_APP_CLIENT_SECRET?: string;
  KOMO_HOSTED?: string;
  KOMO_PAUSED?: string;
  EDGE_LIMIT?: RateLimit;
  KOMO_VERSION?: { id: string };
}

declare module "*.txt" {
  const content: string;
  export default content;
}
