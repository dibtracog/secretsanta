# secretsanta

A Secret Santa gift shop theme for Shopify (Online Store 2.0).

## Structure

Shopify only accepts a branch whose root uses the standard theme folders:

```
assets/      CSS
config/      Theme settings (settings_schema.json, settings_data.json)
layout/      theme.liquid and password.liquid
locales/     Translations (en.default.json)
sections/    Page sections (header, hero, product, cart, ...)
snippets/    Reusable pieces (product-card)
templates/   JSON templates for each page type
```

## Connecting to Shopify

1. Push this branch to GitHub.
2. In Shopify admin, go to **Online Store → Themes → Add theme → Connect from GitHub**.
3. Pick this repository and the `main` branch.
4. Customize the theme in the theme editor. Changes made there are committed back to the branch.
