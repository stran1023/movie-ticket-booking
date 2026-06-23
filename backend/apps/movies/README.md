# Background Tasks Setup (Celery & Redis)
 
We are using Celery to handle background tasks including updating Movie statuses (Coming Soon -> Now Showing) at midnight and sending Release Day email blasts!
 
To run the backend locally, you now need to spin up Redis and Celery alongside the Django server.
 
### 1. Start Redis (Message Broker)
Celery needs Redis to pass messages. The easiest way is via Docker:
\`\`\`bash
docker run -d -p 6379:6379 redis
\`\`\`
*(Make sure Docker Desktop is running before you do this!)*

### 2. Start the Celery Beat (Task Watcher)
Open a **new terminal window**, activate your virtual environment, and run:
\`\`\`bash
uv run celery -A config beat -l info
\`\`\`
 
### 3. Start the Celery Worker (Task Executor)
Open a **new terminal window**, activate your virtual environment, and run:
\`\`\`bash
# Note: If you are on Windows, you MUST include --pool=solo
uv run celery -A config worker -l info --pool=solo
\`\`\`
 
### 4. Testing the status updating locally
To test scheduled tasks (like the midnight movie status update), open a **third terminal window**, activate your virtual environment, and run:
\`\`\`bash
uv run py manage.py shell
from apps.movies.tasks import update_movie_statuses
update_movie_statuses.delay()
\`\`\`
 
### 5. Testing the Email Blast locally:
We are using Django's console email backend. If you click "Remind Me" on the frontend and trigger an email, it will not actually send a real email. Instead, it will print the fully formatted email text directly into your Celery Worker terminal window!
\`\`\`bash
uv run py manage.py shell
from apps.movies.tasks import send_release_day_emails
send_release_day_emails.delay(<!--id of chosen movie-->)
\`\`\`