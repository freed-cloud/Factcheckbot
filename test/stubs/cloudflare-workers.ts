// Vervanger voor de module "cloudflare:workers", die alleen bij Cloudflare bestaat.
export class DurableObject<Env = unknown> {
  protected ctx: unknown;
  protected env: Env;

  constructor(ctx: unknown, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }
}
