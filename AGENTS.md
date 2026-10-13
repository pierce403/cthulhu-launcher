# Cthulhu migration

Preserve the public XMTP frontend, its local identity format, original source,
GitHub Pages recovery and four Postgres tables. Use native Cloudflare main builds,
D1 metadata and private R2 file bytes. Keep credentials in Cloudflare. Staging
must have separate databases/buckets, synthetic records and mocked AI only.

Do not send messages to the existing XMTP peer or call paid AI for acceptance.
The old fixed OpenAI assistant is already missing and Assistants was retired;
report its repair separately. Preserve file-upload API paths and response shapes.
Remove raw user/document logging. Never publish private exports or record data.

Disable Heroku automatic Git deploys before pushing main. Freeze its writer and
take/reconcile a final managed backup before Cloudflare writes. Rehearse reverse
transfer including exact binary files. Keep original deployments and source data;
permanent deletion is a separate step.
