# La Biblia Explicada

A migration of labibliaexplicada.com from Webflow to Directus CMS + Astro.

## Project Structure

```
LBE/
├── astro-site/           # Astro frontend
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── layouts/      # Page layouts
│   │   ├── lib/          # Directus SDK client
│   │   └── pages/        # Route pages
│   └── public/           # Static assets
├── backup/               # Scraped HTML/data backup
├── webflow-backup/       # Webflow CMS API export
│   ├── collections/      # CMS items (JSON)
│   ├── schemas/          # Collection field definitions
│   └── styles/           # CSS/JS files
├── docker-compose.yml    # Directus + Postgres + Redis
├── directus-schema.json  # Directus collection definitions
└── migrate-to-directus.js # Migration script
```

## Quick Start

### 1. Start Directus

```bash
docker-compose up -d
```

Access Directus Admin at http://localhost:8055
- Email: admin@labibliaexplicada.com
- Password: admin123

### 2. Import Schema

Create collections in Directus Admin or use the API to import from `directus-schema.json`.

### 3. Migrate Data

```bash
# Get an admin token from Directus Admin > Settings > Access Tokens
export DIRECTUS_TOKEN=your-token-here
node migrate-to-directus.js
```

### 4. Run Astro

```bash
cd astro-site
cp .env.example .env
npm install
npm run dev
```

## CMS Collections

| Collection | Items | Description |
|------------|-------|-------------|
| Autores | 1 | Content authors |
| Categorías | 3 | Article categories |
| Libros | 69 | Bible books |
| Capítulos | 1,190 | Bible chapters |
| Artículos | 45 | Blog articles |
| Conceptos | 3 | Biblical concepts |
| Personajes | 1 | Biblical characters |

## Webflow Backup

The `webflow-backup/` directory contains:
- Full CMS data export via Webflow API
- Collection schemas with field definitions
- All static assets (CSS, JS)

## Technology Stack

- **CMS**: Directus 10.x
- **Frontend**: Astro 4.x
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL
- **Cache**: Redis

## Deployment

### Directus (Backend)
- Deploy to any Docker host
- Or use Directus Cloud

### Astro (Frontend)
- Deploy to Vercel, Netlify, or Cloudflare Pages
- Configure `DIRECTUS_URL` environment variable

## License

Private - La Biblia Explicada
