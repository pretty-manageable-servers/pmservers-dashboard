output "pages_subdomain" {
  description = "The pages.dev subdomain of the project."
  value       = cloudflare_pages_project.dashboard.subdomain
}

output "url" {
  description = "The dashboard URL."
  value       = "https://${var.domain}"
}
