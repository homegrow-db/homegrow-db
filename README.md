# Homegrow DB

Cannabis Grow & Seed Tracker – Document your strains, seeds, and grows with images, a weekly journal, and harvest tracking.

## Features

- **Strain Management** – Name, breeder, genetics, effects, aroma, THC/CBD, flowering time
- **Seed Tracking** – Quantity, source, purchase date, sorting and search, inline editing, PDF export
- **Grow Journal** – Weekly entries with fertilizer, watering, light and temperature, photos per week, harvest with weight, PDF export
- **Image Gallery** – Lightbox with arrow navigation per grow
- **Dashboard** – Stat cards, active grows, global search
- **2FA** – Two-factor authentication via TOTP (Google Authenticator, Authy)
- **Internationalization** – English (default) and German, switchable in profile
- **Dark Mode** – Toggle in the sidebar
- **User Management** – First user becomes admin automatically, can disable registration

## Tech Stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 19, TypeScript, Vite, react-router-dom, react-i18next |
| Backend  | Python 3.11, FastAPI, SQLAlchemy (async), SQLite |
| Auth     | JWT (python-jose), bcrypt, pyotp |
| PDF      | jsPDF, jsPDF-AutoTable |
| Other    | Pillow, aiosqlite |

## Development

### Prerequisites

- Python 3.11+
- Node.js 20+

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The backend runs at `http://localhost:8000`. API documentation is available at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` and proxies API requests to the backend.

### Environment Variables

Configuration is done via `.env` in `backend/` or environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | `CHANGE_ME_TO_A_SECURE_RANDOM_KEY` | JWT signing key |
| `DATABASE_URL` | `sqlite+aiosqlite:///./cannabis_tracker.db` | Database URL |
| `IMAGE_STORAGE_PATH` | `uploads` | Image storage directory |

## Docker Deployment

```bash
# Build and start
docker compose up -d

# With a custom secret key
SECRET_KEY=your-secure-secret docker compose up -d

# View logs
docker compose logs -f
```

The application will be available at `http://localhost:8000`.

### Docker Volumes

- `app_data` – SQLite database (`/app/data/cannabis_tracker.db`)
- `app_uploads` – Uploaded images (`/app/uploads`)

For direct filesystem access to uploads, you can use a bind mount in `docker-compose.yml`:

```yaml
volumes:
  - ./uploads:/app/uploads
```

## First-Time Setup

1. Start the application and open `http://localhost:8000`
2. Register the first user (becomes admin automatically)
3. Optional: Set up 2FA in your profile
4. Create strains → add seeds → start grows

## License

MIT
