# VPS Build Log

Server: `46.225.78.10` — Hetzner CX22, Falkenstein Germany, Ubuntu 24.04

---

## 2026-05-05

### ✅ Step 1 — Provision server
- Hetzner CX22 (~$5/mo), Germany datacenter
- Ubuntu 24.04, 2 vCPU, 4GB RAM
- SSH key added at creation

<details>
<summary>💬 Is it okay to put it in Germany?</summary>

Yes — Germany (Falkenstein/Nuremberg) is Hetzner's home datacenter, their most reliable region. Only downside is ~120ms extra latency from the US, which doesn't matter for a personal dashboard you're hitting a few times a day.

</details>

<details>
<summary>💬 Can I add SSH keys later?</summary>

Yes. Hetzner → your server → Security tab → add the key there anytime. You'd then manually copy it into `~/.ssh/authorized_keys` on the server. Easier to add at creation though.

</details>

---

### ✅ Step 2 — Base setup
```bash
apt update && apt upgrade -y && apt install -y curl git ufw fail2ban
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
adduser dima && usermod -aG sudo dima
rsync --archive --chown=dima:dima ~/.ssh /home/dima
```

<details>
<summary>💬 What does -y do?</summary>

Automatically answers "yes" to any prompts during installation. Without it, `apt` would pause and ask "Do you want to continue? [Y/n]" for every package — `-y` skips all of that.

</details>

<details>
<summary>💬 What do all the ufw commands do?</summary>

`ufw` = Uncomplicated Firewall. Controls which ports accept incoming connections.

- `ufw allow OpenSSH` — allow port 22 (SSH). Without this, enabling ufw would lock you out immediately.
- `ufw allow 80` — allow HTTP. Needed for Caddy to serve the site and handle SSL certificate challenges.
- `ufw allow 443` — allow HTTPS. The secure version of your site.
- `ufw enable` — turn the firewall on. Everything not explicitly allowed is now blocked.

`adduser dima` — creates a non-root user. You don't want to run everything as root because a mistake or compromised process has unlimited power.

`usermod -aG sudo dima` — adds `dima` to the sudo group so you can run `sudo <command>` when you need root privileges.

`rsync --archive --chown=dima:dima ~/.ssh /home/dima` — copies your SSH keys from root into dima's home directory with correct ownership. This is what lets you `ssh dima@46.225.78.10` instead of `ssh root@...`.

The whole point of step 2: lock the server down, create a safe user, and make sure you can get back in as that user before you stop using root.

</details>

---

### ✅ Step 3 — Postgres 16 + pgvector

```bash
sudo apt install -y postgresql postgresql-contrib postgresql-server-dev-16 build-essential
cd /tmp && git clone --branch v0.8.0 https://github.com/pgvector/pgvector.git
cd pgvector && make && sudo make install
sudo -u postgres psql # created user, DB, enabled vector extension
psql -U jobsearch -d jobsearch -h localhost -c "SELECT '[1,2,3]'::vector;"
# → [1,2,3] ✅
```

<details>
<summary>💬 What is pgvector? What did we just do?</summary>

pgvector is a Postgres extension that lets you store and search **vectors** — arrays of numbers that represent the "meaning" of a piece of text.

When you run text through an embedding model, it converts it to a vector like `[0.12, -0.84, 0.33, ...]` — 768 numbers. Texts that mean similar things end up with similar vectors, even if they use completely different words.

So instead of `WHERE notes LIKE '%AI automation%'`, you can ask "find me everything semantically similar to this job posting" — pgvector finds the closest vectors.

**What we did:**
1. Installed Postgres — the database
2. Installed pgvector — adds vector storage + similarity search to Postgres
3. Created a `jobsearch` database and user
4. Enabled the `vector` type in that database
5. Tested it — `[1,2,3]::vector` confirmed it works

**Where it shows up:** paste a job posting → Deepseek extracts text → nomic-embed-text converts to a 768-number vector → stored in Postgres → later, searching for similar vectors surfaces everything you already know about related companies, roles, and conversations. That's the RAG part.

SQL answers "who haven't I followed up with?" — pgvector answers "what do I already know that's relevant to this?"

</details>

### ✅ Step 4 — Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```
### ✅ Step 5 — Local embedding model (nomic-embed-text)

```bash
sudo apt install -y python3-pip python3-venv
mkdir ~/embeddings && cd ~/embeddings
python3 -m venv venv
source venv/bin/activate
pip install sentence-transformers fastapi uvicorn einops
# model downloaded: nomic-ai/nomic-embed-text-v1 (547MB, 768 dimensions)
# tested: m.encode('test').shape → (768,) ✅
```

Created `server.py` — FastAPI microservice on `127.0.0.1:8000`.
Registered as systemd service, starts on boot, restarts on crash.

<details>
<summary>💬 What is systemd? What does each part of the .service file do?</summary>

systemd manages processes on Linux — what starts on boot, what restarts on crash, what user runs what.

A `.service` file tells systemd how to run a program:

- `After=network.target` — don't start until network is up
- `User=dima` — run as dima, not root (safer)
- `WorkingDirectory` — cd here before starting
- `ExecStart` — the full command to run
- `Restart=always` — if it crashes, restart automatically
- `WantedBy=multi-user.target` — start this when the server boots normally

Commands:
- `systemctl enable` — register to start on boot
- `systemctl start` — start right now
- `systemctl status` — show if running + recent logs

</details>

### ✅ Step 6 — Caddy reverse proxy
*Needs a domain first — add an A record pointing to `46.225.78.10` then come back to this.*

**Domain:** `jobsearch.dmytropetryshchuk.com`

DNS record to add (in registrar's DNS settings for `dmytropetryshchuk.com`):
```
Type:  A
Name:  jobsearch
Value: 46.225.78.10
TTL:   300
```

Verify propagation:
```bash
nslookup jobsearch.dmytropetryshchuk.com
# should return 46.225.78.10
```

<details>
<summary>💬 Why a subdomain instead of the root domain?</summary>

`dmytropetryshchuk.com` is your personal domain — you might want it pointing at a portfolio site or LinkedIn. Using `jobsearch.dmytropetryshchuk.com` keeps the VPS app isolated without touching what the root domain does.

A DNS `A` record on `Name: jobsearch` only affects that subdomain. The root domain (`@`) and any other subdomains (`www`, etc.) are completely unaffected.

</details>

<details>
<summary>💬 What is Caddy and how does it work?</summary>

Your server is running two processes internally:
- Node.js app on port `3456`
- Python embedding service on port `8000`

Neither of these is exposed to the internet directly. They only listen on `localhost` — meaning only the server itself can talk to them.

Caddy sits in front of both of them and acts as the public face of the server. It's the only thing listening on ports 80 (HTTP) and 443 (HTTPS) — the ports the outside world uses.

**Reverse proxy** — when a request comes in for `jobsearch.dmytropetryshchuk.com`, Caddy looks at the path and decides where to send it:
- `/embed/*` → forwards to `localhost:8000` (Python embedding service)
- everything else → forwards to `localhost:3456` (Node.js app)

The browser thinks it's talking directly to your app. It has no idea Caddy is in the middle. That's what "reverse proxy" means — a proxy the client doesn't see.

**Automatic HTTPS** — SSL certificates are what make `https://` work. Normally you'd have to:
1. Prove you own the domain (DNS challenge)
2. Download the certificate
3. Configure your web server to use it
4. Set a reminder to renew it every 90 days or your site breaks

Caddy does all of that automatically. The moment you give it a domain name and that domain resolves to the server, it contacts Let's Encrypt (a free certificate authority), gets a cert, installs it, and schedules renewals forever. Zero manual work.

**Why Caddy over Nginx:** Nginx is the industry standard but its config is verbose and HTTPS requires extra tooling (certbot). Caddy's entire config for this project is 5 lines and HTTPS is zero config. Right call for a personal project.

</details>

<details>
<summary>💬 Should I write CLI stuff in TypeScript? What is TypeScript good for?</summary>

TypeScript is JavaScript with types. You annotate your variables and function signatures (`name: string`, `count: number`) and the TypeScript compiler catches mismatches before you run the code. It compiles down to plain JavaScript — the server never sees TypeScript, only JS.

**What it's genuinely good for:**
- Large codebases where you can't hold everything in your head — types tell you what a function expects and returns without reading the implementation
- Complex data shapes — like the scrapers here, where a job posting has specific fields and you don't want to accidentally pass the wrong thing
- Refactoring — change a field name and TypeScript tells you everywhere that breaks

**For CLI scripts specifically:** totally fine. In this project you're already running TypeScript scripts with `tsx` (e.g. `tsx tools/query.ts`). `tsx` compiles and runs in one step — no separate build needed. So there's no real overhead.

**What TypeScript is NOT:** it doesn't make JavaScript faster, it doesn't change how the code runs, and it doesn't help with runtime errors (a bad API response, a missing file). It only catches type errors at compile time.

**In this project:** the scrapers, server, and tools are all `.ts`. Stay consistent — write new tools in TypeScript. The VPS-specific stuff (systemd service files, post-receive hook) is shell/config, not code, so TypeScript doesn't apply there.

</details>

### ✅ Step 7 — App systemd service

```bash
sudo nano /etc/systemd/system/jobsearch.service
sudo systemctl daemon-reload
sudo systemctl enable jobsearch
sudo systemctl restart jobsearch
```

Service runs `npx mastra dev --port 4111` as user `dima`, loads env from `/home/dima/jobsearch/.env`, restarts automatically on crash. Added passwordless sudo for `systemctl restart jobsearch` via `/etc/sudoers.d/jobsearch` so GitHub Actions can restart without a password.

### ✅ Step 8 — Git push-to-deploy

GitHub Actions workflow at `.github/workflows/deploy.yml`. Triggers on push to `master`. SSHes into VPS using a dedicated ed25519 deploy key (stored as `VPS_SSH_KEY` GitHub secret), runs `git pull && npm install && sudo systemctl restart jobsearch`. Deploy key public half is in `~/.ssh/authorized_keys` on VPS.

### ✅ Step 9 — Migrate SQLite → Postgres

Migrated 26 companies and 36 contacts from `jobsearch/db/jobsearch.sqlite` into VPS Postgres via `node db/migrate-pg.js` over SSH tunnel (`ssh -L 5432:localhost:5432 dima@46.225.78.10`). Job postings not migrated — scraped noise, re-scrape instead.

### ⬜ Step 10 — Wire frontend to VPS (Caddy + AGENT_URL)
### ⬜ Step 11 — Langfuse observability (traces showing in dashboard)
### ⬜ Step 12 — pgvector embeddings pipeline
### ⬜ Step 13 — /context RAG endpoint
### ⬜ Step 14 — Caddy basic auth
### ⬜ Step 15 — Chrome extension
