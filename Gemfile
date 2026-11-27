source "https://rubygems.org"

# === Rails et base de données ===
gem "rails", "~> 8.1.4", ">= 8.1.4.1"
gem "pg", "~> 1.1"                    # Base de données PostgreSQL
gem "bootsnap", require: false        # Réduit le temps de démarrage grâce au cache

# === Serveur web et déploiement ===
gem "puma", ">= 5.0"                  # Serveur web
gem "thruster", require: false        # Cache HTTP et compression pour Puma
gem "kamal", require: false           # Déploiement en conteneur Docker

# === Frontend (JS, CSS, assets) ===
gem "importmap-rails"                 # JS avec import maps (sans bundler JS)
gem "turbo-rails"                     # Hotwire : accélérateur de pages
gem "stimulus-rails"                  # Hotwire : mini-framework JS
gem "jbuilder"                        # Construction de vues JSON
gem "sprockets-rails"                 # Pipeline d'assets classique
gem "bootstrap", "~> 5.3"             # Framework CSS Bootstrap
gem "autoprefixer-rails"              # Préfixes CSS automatiques
gem "font-awesome-sass", "~> 6.1"     # Icônes Font Awesome
gem "sassc-rails"                     # Compilation SCSS
gem "image_processing", "~> 2.2"      # Variantes d'images (Active Storage)

# === Authentification et formulaires ===
gem "devise"                          # Authentification (inscription, connexion)
gem "simple_form", github: "heartcombo/simple_form" # Formulaires simplifiés

# === IA (RubyLLM) ===
gem "ruby_llm", "~> 2.2"              # Interface unifiée vers les IA (OpenAI, etc.)
gem "kramdown"                        # Conversion Markdown -> HTML
gem "kramdown-parser-gfm"             # Support du Markdown "GitHub-flavored"
gem "rouge"                           # Coloration syntaxique des blocs de code

# === Divers ===
gem "tzinfo-data", platforms: %i[ windows jruby ] # Fuseaux horaires (Windows/JRuby)
gem "ruby-vips", "~> 2.3"             # Traitement d'images (évite un warning Heroku)

# === Cache, jobs temps réel (solid suite) ===
gem "solid_cache"                     # Cache en base de données
gem "solid_queue"                     # Jobs en arrière-plan
gem "solid_cable"                     # Action Cable en base de données

# === Développement ET test ===
group :development, :test do
  gem "dotenv-rails"                  # Charge les variables du fichier .env (secrets locaux)
  gem "debug", platforms: %i[ mri windows ], require: "debug/prelude" # Débogage
  gem "bundler-audit", require: false # Détecte les failles de sécurité dans les gemmes
  gem "brakeman", require: false      # Analyse statique de sécurité Rails
  gem "rubocop-rails-omakase", require: false # Style de code Ruby (linting)
end

# === Développement uniquement ===
group :development do
  gem "web-console"                   # Console interactif sur les pages d'erreur
end

# === Test uniquement ===
group :test do
  gem "capybara"                      # Tests d'interface simulés
  gem "selenium-webdriver"            # Pilote navigateur pour Capybara
end
