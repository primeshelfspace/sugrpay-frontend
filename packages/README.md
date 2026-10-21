# Shared packages

| Package               | Owned here? | What it is                                                    |
| --------------------- | ----------- | ------------------------------------------------------------- |
| `ui`                  | **yes**     | React components (toasts, pagination)                         |
| `kernel`              | copy        | Money, validation, design tokens, the role/permission matrix  |
| `platform-contracts`  | copy        | Request schemas, roles, products, the session-cookie contract |
| `invoicing-contracts` | copy        | Invoice schemas, statuses, email and PDF renderers            |

The three **copies** come from the backend repository
([primeshelfspace/platform](https://github.com/primeshelfspace/platform),
`packages/`), where they are the source of truth: the API validates every
request with the same schemas and enforces the same permission matrix. The
front end keeps a copy so it can validate forms and show the right screens
without depending on the backend's code.

**When the backend changes one of them, copy it across.** From this
repository's root, with the backend checked out beside it:

```bash
for p in kernel platform-contracts invoicing-contracts; do rm -rf packages/$p && cp -r ../platform/packages/$p packages/$p && rm -rf packages/$p/node_modules packages/$p/dist; done
```

Then run `pnpm install && pnpm check`. Never edit a copy here directly — the
next sync would overwrite the change.
