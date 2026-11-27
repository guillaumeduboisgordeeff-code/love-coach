# Version of your assets
Rails.application.config.assets.version = "1.0"

# Add additional assets to the asset load path.
# Rails.application.config.assets.paths << Emoji.images_path

# Assets to precompile
Rails.application.config.assets.precompile += %w(
  bootstrap.min.js
  popper.js
  application.css
)
