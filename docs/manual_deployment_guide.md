# Manual Deployment Guide (Without Docker)

This guide walks you through deploying the AutoReach stack manually on a Linux VPS (Ubuntu/Debian) using Node.js, PostgreSQL, PM2, and Nginx.

## 1. Install Prerequisites

SSH into your server and install the required system packages:

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx & Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Install PM2 (Process Manager) globally
sudo npm install -pm2 -g
```

## 2. Configure PostgreSQL

Create a database and user for AutoReach:

```bash
sudo -u postgres psql
```

Inside the PostgreSQL prompt:
```sql
CREATE DATABASE autoreach;
CREATE USER autoreach_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE autoreach TO autoreach_user;
ALTER DATABASE autoreach OWNER TO autoreach_user;
\q
```

Your `DATABASE_URL` will be:
`postgresql://autoreach_user:your_secure_password@localhost:5432/autoreach?schema=public`

## 3. Clone and Setup the Project

Clone your repository to `/var/www/autoreach`:

```bash
sudo mkdir -p /var/www/autoreach
sudo chown -R $USER:$USER /var/www/autoreach
# Clone your code here
cd /var/www/autoreach
```

## 4. Deploy the Express API

1. **Navigate and Install**:
   ```bash
   cd /var/www/autoreach/api
   npm install
   ```

2. **Environment Variables**:
   Create a `.env` file in `api/`:
   ```env
   NODE_ENV=production
   PORT=3070
   DATABASE_URL="postgresql://autoreach_user:your_secure_password@localhost:5432/autoreach?schema=public"
   APP_BASE_URL="https://leads.creativecomet.tn"
   ENCRYPTION_KEY="32_CHARACTER_RANDOM_STRING_HERE"
   ```

3. **Migrate and Build**:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   npm run build
   ```

4. **Start with PM2**:
   ```bash
   pm2 start dist/index.js --name "autoreach-api"
   ```

## 5. Deploy the Next.js Dashboard

1. **Navigate and Install**:
   ```bash
   cd /var/www/autoreach/dashboard
   npm install
   ```

2. **Environment Variables**:
   Create a `.env` file in `dashboard/`:
   ```env
   NODE_ENV=production
   PORT=3040
   NEXT_PUBLIC_API_URL="https://leads.creativecomet.tn/api"
   NEXTAUTH_URL="https://leads.creativecomet.tn"
   NEXTAUTH_SECRET="your_nextauth_secret"
   
   # OAuth Keys
   GITHUB_CLIENT_ID="your_github_id"
   GITHUB_CLIENT_SECRET="your_github_secret"
   GOOGLE_CLIENT_ID="your_google_id"
   GOOGLE_CLIENT_SECRET="your_google_secret"
   ```

3. **Build**:
   ```bash
   npm run build
   ```

4. **Start with PM2**:
   ```bash
   pm2 start npm --name "autoreach-dashboard" -- start
   ```

5. **Save PM2 State**:
   Make sure PM2 restarts on server reboot:
   ```bash
   pm2 save
   pm2 startup
   # Run the command PM2 gives you
   ```

## 6. Configure Nginx and SSL

1. **Setup SSL**:
   Run certbot to generate an SSL certificate for your domain:
   ```bash
   sudo certbot certonly --standalone -d leads.creativecomet.tn
   ```

2. **Nginx Configuration**:
   Copy the provided Nginx configuration to `/etc/nginx/sites-available/autoreach`:
   ```bash
   sudo cp /var/www/autoreach/nginx/autoreach.conf /etc/nginx/sites-available/autoreach
   ```

3. **Enable Site and Restart**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/autoreach /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

Your dashboard and API should now be live at `https://leads.creativecomet.tn`.
