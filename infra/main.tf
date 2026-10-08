locals {
  # All values are public. They are built into the static files.
  env_vars = {
    NEXT_PUBLIC_SUPABASE_URL      = { type = "plain_text", value = var.supabase_url }
    NEXT_PUBLIC_SUPABASE_ANON_KEY = { type = "plain_text", value = var.supabase_anon_key }
    NEXT_PUBLIC_API_URL           = { type = "plain_text", value = var.api_url }
    NEXT_PUBLIC_API_MOCK          = { type = "plain_text", value = var.api_mock }
    NEXT_PUBLIC_AUTH_MOCK         = { type = "plain_text", value = "0" }
    NODE_VERSION                  = { type = "plain_text", value = "22" }
  }
}

resource "cloudflare_pages_project" "dashboard" {
  account_id        = var.account_id
  name              = var.project_name
  production_branch = var.production_branch

  build_config = {
    build_command   = "pnpm build"
    destination_dir = "out"
  }

  # Git-connected source. Cloudflare builds on push.
  # The Cloudflare GitHub app must be installed on the repository first.
  source = {
    type = "github"
    config = {
      owner                          = var.github_owner
      repo_name                      = var.github_repo_name
      production_branch              = var.production_branch
      production_deployments_enabled = true
      preview_deployment_setting     = "all"
      pr_comments_enabled            = true
    }
  }

  deployment_configs = {
    production = { env_vars = local.env_vars }
    preview    = { env_vars = local.env_vars }
  }
}

# The zone is shared. The infra repo owns it. Here we only read it.
data "cloudflare_zone" "main" {
  filter = {
    name = var.zone_name
  }
}

resource "cloudflare_pages_domain" "dashboard" {
  account_id   = var.account_id
  project_name = cloudflare_pages_project.dashboard.name
  name         = var.domain
}

# Pages does not create the DNS record when you use the API.
resource "cloudflare_dns_record" "dashboard" {
  zone_id = data.cloudflare_zone.main.zone_id
  name    = var.domain
  type    = "CNAME"
  content = cloudflare_pages_project.dashboard.subdomain
  proxied = true
  ttl     = 1
}
