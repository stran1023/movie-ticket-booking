# CineBook Backend

## 1. Prerequisites

Before you begin, ensure you have the following installed `uv`

```bash
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

---

## 2. Installation

### Step 1: Navigate to the backend directory

```bash
cd backend
```

### Step 2: Initialize Environment

```bash
# This command creates the virtual environment and installs all dependencies from uv.lock
uv sync
# If you are not using uv (Not recommended), run:
python -m venv venv
pip install -r requirements.txt
```

### Step 3: Environment Configuration

- Create your local environment file:

```bash
copy .env.example .env
```

- Open the .env file and update the Database credentials to match your local PostgreSQL setup:

```bash
DB_NAME=cinebook_db
DB_USER=postgres        <-- Update this
DB_PASSWORD=password    <-- Update this
DB_HOST=localhost
DB_PORT=5432
```

## 3. Database Setup

### Step 1: Create Empty Database

- Open pgAdmin4 or psql terminal and run:

```bash
CREATE DATABASE cinebook_db;
```

### Step 2: Run Migrations

```bash
# Run via uv (automatically uses venv)
uv run python manage.py migrate
# If not using uv, activate your venv first:
# Windows (PowerShell):
venv\Scripts\activate
# Then run:
python manage.py migrate
```

### Step 3: (Optional) Seed Initial Data

```bash
## Only run when have initial_data.json with seed data
uv run python manage.py loaddata initial_data.json
```

### Step 4: Create Superuser (for admin access)

```bash
uv run python manage.py createsuperuser
```

## 4. Running the Development Server

```bash
uv run python manage.py runserver
```

- API root: http://localhost:8000/api/
- Admin panel: http://localhost:8000/admin/
- Swagger docs: http://localhost:8000/api/schema/swagger-ui/ (Check urls.py if link differs)

## 5. Development Guidelines

### Rule for creating new apps

- If you need to create a new app(e.g., payments), must follow those steps:

1. Run command:

```bash
cd apps
uv run django-admin startapp payment
cd ..
```

2. CRITICAL: Open apps/payment/apps.py, change:

```bash
class PaymentConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = 'apps.payment' # must be have apps. before the name of app
```

3. Open config/settings.py, add "apps.payment" to INSTALLED_APPS:

### Rule for add new libraries:

```bash
uv add <library-name>
```

- This command will automatically update uv.lock and pyproject.toml with the new library, remember to commit both files to version control.

- If you need to update requirement.txt for non-uv user:

```bash
uv pip compile pyproject.toml -o requirements.txt
```

### Rule for Migrations:

- After making changes to models.py in any app, run:

```bash
# 1. Create migration files
uv run python manage.py makemigrations
# 2. Apply migrations to the database
uv run python manage.py migrate
```

### Rule for Seeding data

- Please seed the data if you haven't yet

```bash

# Movie
uv run python manage.py loaddata movies_data
# Cinema
uv run python manage.py loaddata rooms
# Promotion
uv run python manage.py loaddata promotion-fixture
# Concession
uv run python manage.py loaddata concessions
# User
# admin admin
# staff !Staff123!
# member !Member123!
uv run python manage.py loaddata user

# -------- or without uv ---------

# Movie
python manage.py loaddata movies_data.json
# Cinema
python manage.py loaddata rooms.json
# Promotion
python manage.py loaddata promotions.json
# Concession
python manage.py loaddata concessions.json
# User
python manage.py loaddata user.json

```

- Consider truncate the user table or use flush if seed data have been updated

```bash
uv run python manage.py flush
```

## 6. Testing

- Run tests:

```bash
uv run pytest
```


## 7. Data Fixture for Testing Statistics in Admin Panel
```bash
uv run python manage.py loaddata user-profile
uv run python manage.py loaddata showtimes
uv run python manage.py loaddata bookings
uv run python manage.py loaddata tickets
```

## Feature: export charts
`Required`
```
1. uv add weasyprint / pip install weasyprint
2. Download and install MSYS2 from msys2.org. Use the default installation options.
3. Open the "MSYS2 UCRT64" terminal from the Start Menu.
4. Run the installation command provided in the docs:
pacman -S mingw-w64-ucrt-x86_64-pango
5. Close the MSYS2 terminal.
```
`Then`
```
1. Open new terminal(PowerShell)
setx WEASYPRINT_DLL_DIRECTORIES "C:\msys64\ucrt64\bin"
2. Close your current terminal
```
`Finally`
```
Run your Django server again:
    uv run python manage.py runserver
```