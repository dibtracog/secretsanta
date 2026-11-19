# secretsanta

A Secret Santa gift shop theme for Shopify (Online Store 2.0), built for a soft-toy and plushie store.

The headline feature is the **Secret Santa matchmaker**: a five-question quiz that decodes the recipient's
personality and matches them with plush toys from your own Shopify catalogue. It runs in the shopper's browser,
so no server or API key is needed and answers are never stored.

## What's included

- **Home page:** Christmas hero with live countdown, trust badges, the matchmaker, how it works, featured products, FAQ.
- **Matchmaker:** playful personality reveal, three matches that respect the budget, a budget switcher,
  "show different picks", one-click add to cart (saves "Secret Santa for" on the order), a downloadable reveal
  card and WhatsApp sharing.
- **Product page:** gallery, size pills, sale badge, "Perfect for" personality chips, and a Secret Santa box
  (recipient, gift message, stay anonymous) saved as line item properties.
- **Cart:** free-shipping progress bar, gift wrap add-on, Christmas delivery date picker, anonymous delivery,
  and a gift note. All of these show up on the Shopify order.
- Floating WhatsApp button, announcement bar, mobile menu, search, collections, blog and password page.

## Setup

1. **Connect the theme:** Shopify admin → Online Store → Themes → Add theme → Connect from GitHub → this repo,
   branch `main`.
2. **Import products:** Products → Import → upload [`shopify-import/products.csv`](shopify-import/products.csv).
   Images load from this GitHub repo, so the repo must be **public** during the import. If it's private, import
   anyway and add images from [`shopify-import/images`](shopify-import/images) by hand.
3. **Gift wrap:** Customize theme → Theme settings → Christmas → pick "Christmas Gift Wrap & Card".
4. **Menus:** Online Store → Navigation → make sure `main-menu` and `footer` exist.
5. **Optional dedicated page:** Pages → Add page "Secret Santa" → Template `page.secret-santa`.

## Tagging products for the matchmaker

| Tag | Meaning |
| --- | --- |
| `vibe-mischief`, `vibe-cuddle`, `vibe-adventure`, `vibe-sunshine`, `vibe-sleepy`, `vibe-social`, `vibe-dreamer`, `vibe-perfectionist`, `vibe-foodie`, `vibe-drama` | Personality types the toy suits |
| `gift-desk`, `gift-bedtime`, `gift-keepsake`, `gift-nostalgia` | Where the gift will live |
| `christmas` | Small festive boost in the matchmaker |
| `bestseller` | Shows a Bestseller badge |
| `gift-wrap` | Hidden from product grids and matches |

The CSV already has these tags on every product.

## Structure

```
assets/          base.css, theme.js (cart, variants, countdown), secret-santa.js (matchmaker)
config/          theme settings
layout/          theme.liquid, password.liquid
locales/         storefront text
sections/        page sections
snippets/        product card, icons, shared head
templates/       JSON templates
shopify-import/  product CSV and images (ignored by Shopify's theme sync)
```
