variable "cloudflare_api_token" {
  description = "Cloudflare API token. Needs Account: Cloudflare Pages Edit, Zone: Zone Read, Zone: DNS Edit."
  type        = string
  sensitive   = true
}

variable "account_id" {
  description = "Cloudflare account ID."
  type        = string
}

variable "project_name" {
  description = "Cloudflare Pages project name."
  type        = string
  default     = "pmservers-dashboard"
}

variable "production_branch" {
  description = "Git branch for production deploys."
  type        = string
  default     = "main"
}

variable "github_owner" {
  description = "GitHub user or organization that owns the repository."
  type        = string
  default     = "pretty-manageable-servers"
}

variable "github_repo_name" {
  description = "GitHub repository name."
  type        = string
  default     = "pmservers-dashboard"
}

variable "zone_name" {
  description = "Cloudflare zone that holds the domain. The infra repo owns this zone."
  type        = string
  default     = "pmservers.org"
}

variable "domain" {
  description = "Custom domain for the dashboard. console.pmservers.org is the working name."
  type        = string
  default     = "console.pmservers.org"
}

variable "supabase_url" {
  description = "Supabase project URL. Public."
  type        = string
}

variable "supabase_anon_key" {
  description = "Supabase anon (publishable) key. It is safe in the browser."
  type        = string
}

variable "api_url" {
  description = "Base URL of the PMS Cloud API."
  type        = string
  default     = "https://api.pmservers.org"
}

variable "api_mock" {
  description = "1 starts the mock API in the browser. Use 1 until the backend exists."
  type        = string
  default     = "1"
}
