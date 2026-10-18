# e0 · Error Alerts

<p align="center">
<a href="../README.md">Toolkit</a> ·
<a href="../c1-toolkit-core/README.md">c1 Core</a>
</p>

The error workflow every tool points to. When a production run fails, it emails:
- the workflow and the node that failed
- the error message
- a **Check first** hint matched to the error
- a button that opens the failed execution

The email takes the failing tool's colour.

## Check-first hints

| Error looks like | Hint |
|---|---|
| expired Google sign-in (`invalid_grant`, 401/403, "token has been expired") | Reconnect the Google Sheets credential (Testing-mode OAuth lasts about a week) |
| SerpApi out of searches, 429 | Check the SerpApi dashboard; the free tier resets monthly |
| "Only N usable listings" | The keyword returned too few real products; drop the word it names |
| no keyword entered | Nothing to fix |
| all keywords failed | Check the SerpApi key and searches left |
| network timeout | Usually temporary; run again |
| Sheets range or column error | A header changed: refresh the Sheets node's columns, then Save → Publish |
| anything else | Open the execution and read the red node |

It sends through an SMTP node with a Gmail app password rather than Gmail OAuth. That way, alerts still arrive in the week the Google sign-in expires, which is exactly when they matter.

Runs started from the editor don't trigger error workflows. Only production runs (forms) do.

## Setup

1. **Import from File** → `e0-error-alerts.json`.
2. **Send an Email** → your SMTP credential. Replace `you@example.com` in From and To.
3. **Save**, then **Publish**. In every other workflow: **⋯ → Settings → Error workflow** → `e0 · error-alerts`.
