# Template photography

The category catalog in `public/catalog.js` records each image's Unsplash photo ID and a descriptive alt text. Direct CDN links are used when a local cached photo is not present. These are photographs, not AI-generated humans. They are illustrative stock content, never owner/team portraits or customer endorsements. Product placeholders for real owners remain placeholders until they upload their actual products.

Source: `https://unsplash.com` and `https://images.unsplash.com/photo-<photo ID>`.
License reference: https://unsplash.com/license. Photos are used under the free Unsplash license. Do not resell unmodified photos, imply endorsement, or present stock models as actual customers. A photograph may contain third-party brands or recognizable people; choose an appropriate use and replace it with owner images where needed. This project is a website builder, not a competing stock-photo service.

**Verification status:** this cloud's proxy currently blocks Unsplash and ThemeForest. No claim is made that each remote URL, individual photo content or current source page has been visually verified. Category mappings must be reviewed after access is enabled. ThemeForest was requested as inspiration; no proprietary template code or images were copied, and its pages could not be inspected from this environment.

After allowing `images.unsplash.com`, run `npm run cache:stock` from the repository root. This downloads one optimized WebP per category, maximum 700 KB each (maximum total 21 MB), and writes `public/stock-manifest.js`. The script preserves existing successful downloads and reports failures with a nonzero exit status. It is a one-time development action, not a Railway startup or per-user operation. Review the photos, then commit the cached shared assets. All stores reuse these files; they do not consume each owner's upload quota.

Until cached, the visitor's browser downloads stock images from Unsplash; slow or blocked connections can affect these images. The app labels failed stock-image slots and continues to work. Owner-uploaded images remain on the existing persistent volume and are included in backups.
