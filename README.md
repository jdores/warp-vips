This Cloudflare worker will make a mapping of device ids to virtual IPs

Optional: if we want the output to be saved to R2, config wrangler.toml appropriately
 If STORE_R2 = true, the output will be saved to the bucket specified in the R2 bindings of wrangler.toml
 If STORE_R2 = false, the output will not be saved to an R2 bucket
