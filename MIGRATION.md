# Cthulhu on Cloudflare

Build at the repository root with npm ci and npm run build. Native Cloudflare
main builds publish with npx wrangler deploy --env "". Preview builds are disabled;
Cloudflare holds deployment credentials. The prior Heroku commit
e1dd5f0b2b9fd7be04a9aa70f3a2a6798e8b55ac and GitHub Pages remain recovery sources.
The heroku-recovery directory retains the old CRA and Python installer metadata
as .snapshot files. They are historical recovery documents, not active manifests.
The root lockfile defines the active Vite/Worker build; Cloudflare no longer
installs the unused legacy Python runtime during builds.

The React18/XMTP3.1.2 UI and local identity format remain. Ethers6 retains its
EOA signer interface. XMTP protocol3.88 is pinned to remove a vulnerable Node
HTTP dependency without replacing the SDK. No existing peer messages or wallet
transactions are required to verify hosting. Serve WASM with application/wasm.

Native D1 stores the original user, conversation, message and file metadata,
including imported IDs, relationships and timestamps. Private R2 stores exact
file bytes; file_key is the internal lookup field replacing the Postgres bytea.
No public file download or public bucket URL is exposed. Preserve original ID
sequence high-water marks and reverse them into PostgreSQL during recovery.

Runtime requires DB, FILES and, for file processing, OPENAI_API_KEY in Cloudflare.
Staging has separate D1/R2 resources and STAGING=true, which mocks file processing
without any external provider requests. It contains only synthetic data. Private
forward/reverse rehearsals use resources that are never bound to a published app.

READ_ONLY=true blocks every mutation before parsing or accessing storage. Keep it
on until the source writer is frozen, its final managed backup is reconciled, and
custom-host reads, DNS/TLS and browser acceptance pass. Heroku automatic deploys
must be disabled before main changes. Preserve all original source deployments.

The fixed OpenAI assistant is already missing and Assistants has been retired.
The validated legacy chat endpoint returns503 and keeps historical conversations
intact; repairing it with Responses is separate work. File upload preserves the
existing provider purpose/model, response shape and score-zero fallback. Its new
10MiB request limit protects Worker memory and returns413. Tests use mocked AI.

After Cloudflare accepts writes, rollback first freezes it, transfers accepted
D1 rows and R2 bytes back into PostgreSQL, reconciles records and sequence state,
then restores source routing/writes. A DNS-only rollback would lose accepted data.
