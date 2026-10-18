# Template photography

The category catalog in `public/catalog.js` records each image's Unsplash photo ID and a descriptive alt text. Direct CDN links are used when a local cached photo is not present. These are photographs, not AI-generated humans. They are illustrative stock content, never owner/team portraits or customer endorsements. Product placeholders for real owners remain placeholders until they upload their actual products.

Source: `https://unsplash.com` and `https://images.unsplash.com/photo-<photo ID>`.
License reference: https://unsplash.com/license. Photos are used under the free Unsplash license. Do not resell unmodified photos, imply endorsement, or present stock models as actual customers. A photograph may contain third-party brands or recognizable people; choose an appropriate use and replace it with owner images where needed. This project is a website builder, not a competing stock-photo service.

**Verification status (18 October 2026):** all 30 category photographs have been downloaded, decoded and visually reviewed. The unavailable toy-photo reference was replaced with a verified toy display, and the bags image was replaced with a backpack. Alt descriptions for the baby, kitchen and coffee photos were corrected to match the photographs. Total bundled photo size is 5,568,714 bytes (about 5.3 MiB), reused by all stores. Real people appear where relevant, including fashion, baby, fitness, wellness, wedding and creative-work categories. Section defaults and sample previews reuse a curated group of related category photos so the same hero photograph is not repeated throughout the page; owner-uploaded product images remain unchanged.

The public ThemeForest eCommerce category listing at https://themeforest.net/category/ecommerce was accessible and inspected for category/industry organization and multipurpose-template presentation. No marketplace code, purchased templates or preview assets were copied. This was a listing reference review, not an inspection of every commercial theme demo.

The Unsplash image CDN is accessible. The license-page endpoint returned “Authorization required” in this environment even though the image downloads succeeded; therefore current license-page text was not independently retrieved during this run. The public Unsplash license reference above remains the source for terms. No paid stock account or API key was used.

After allowing `images.unsplash.com`, run `npm run cache:stock` from the repository root. This downloads one optimized WebP per category, maximum 700 KB each (maximum total 21 MB), and writes `public/stock-manifest.js`. The script preserves existing successful downloads and reports failures with a nonzero exit status. It is a one-time development action, not a Railway startup or per-user operation. Review the photos, then commit the cached shared assets. All stores reuse these files; they do not consume each owner's upload quota.

All current category defaults are cached and served from `/stock/`; no external photo request is needed for them. If future categories are added without a cache entry, their fallback uses Unsplash and depends on the visitor's network. The app labels failed stock-image slots and continues to work. Owner-uploaded images remain on the existing persistent volume and are included in backups.

## Matched product samples

Product cards now use a separate set of 36 visually checked product photographs, with sources in `PRODUCT_PHOTOS.json`. Captions/names were corrected after inspection (for example: the knit photo is a wrap, one decor photo shows vases, the dinnerware photo shows plates/bowls, one shoe photo is green and another is brown, and gift-wrap photography is not labelled as an invitation). Lifestyle photos are no longer arbitrarily assigned to unrelated retail product names. A few examples with no suitable photograph use an honest photo placeholder. Owner inventory is never filled with sample items.

The 30 section/category photos plus these product photographs total about 8 MiB of shared static assets. They are bundled once, use no owner-upload quota, and require no external photo request in the current kits.
