# AWS Deployment Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         CloudFront                          │
│                    (CDN + SSL Certificate)                  │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌───────────────┐    ┌──────────────────┐
│   S3 Bucket   │    │  API Gateway     │
│   (Frontend)  │    │  (Optional)      │
└───────────────┘    └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │   EC2 / Lambda   │
                     │    (Backend)     │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │  Aurora MySQL    │
                     │   (Database)     │
                     └──────────────────┘
```

## Step 1: Setup AWS Aurora Database

### Create Aurora Cluster

1. **Navigate to RDS Console**
   - Go to AWS Console → RDS
   - Click "Create database"

2. **Configuration**
   ```
   Engine type: Aurora (MySQL Compatible)
   Version: Aurora MySQL 3.04.0 (MySQL 8.0 compatible)
   Templates: Production or Dev/Test
   
   Settings:
   - DB cluster identifier: parking-app-db
   - Master username: admin
   - Password: [Generate strong password]
   
   Instance configuration:
   - Burstable classes: db.t3.medium (dev) or db.r6g.large (prod)
   
   Connectivity:
   - VPC: Default or create new
   - Public access: Yes (for initial setup, restrict later)
   - VPC security group: Create new "parking-app-sg"
   
   Additional configuration:
   - Initial database name: parking_app
   - Backup retention: 7 days
   - Enable encryption
   ```

3. **Security Group Configuration**
   - Edit "parking-app-sg"
   - Inbound rules:
     ```
     Type: MySQL/Aurora
     Port: 3306
     Source: Your IP (for setup)
            EC2 Security Group (for production)
     ```

4. **Save Connection Details**
   ```
   Endpoint: parking-app-db.cluster-xxxxx.us-west-2.rds.amazonaws.com
   Port: 3306
   Username: admin
   Password: [your password]
   ```

5. **Initialize Database**
   ```bash
   # From your local machine
   mysql -h parking-app-db.cluster-xxxxx.us-west-2.rds.amazonaws.com \
         -u admin -p parking_app < backend/database/schema.sql
   ```

## Step 2: Deploy Backend to EC2

### Launch EC2 Instance

1. **Create Instance**
   ```
   AMI: Amazon Linux 2023
   Instance type: t3.small or larger
   Key pair: Create new or use existing
   Network settings:
   - VPC: Same as Aurora
   - Auto-assign public IP: Enable
   - Security group: Create "backend-sg"
     - Port 22 (SSH): Your IP
     - Port 3001 (API): 0.0.0.0/0 or ALB security group
     - Port 443 (HTTPS): 0.0.0.0/0
   ```

2. **Connect to Instance**
   ```bash
   ssh -i your-key.pem ec2-user@your-ec2-public-ip
   ```

3. **Install Dependencies**
   ```bash
   # Update system
   sudo yum update -y
   
   # Install Node.js
   curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
   sudo yum install -y nodejs
   
   # Install Git
   sudo yum install -y git
   
   # Install PM2 globally
   sudo npm install -g pm2
   ```

4. **Deploy Application**
   ```bash
   # Clone repository (or upload via SCP)
   git clone https://github.com/your-username/parking-app.git
   cd parking-app/backend
   
   # Install dependencies
   npm install
   
   # Create .env file
   nano .env
   ```

5. **Configure Environment**
   ```env
   NODE_ENV=production
   PORT=3001
   
   # Your frontend CloudFront URL
   FRONTEND_URL=https://d123456.cloudfront.net
   
   # Aurora connection
   DB_HOST=parking-app-db.cluster-xxxxx.us-west-2.rds.amazonaws.com
   DB_USER=admin
   DB_PASSWORD=your-password
   DB_NAME=parking_app
   DB_PORT=3306
   
   # Generate: openssl rand -hex 32
   ADMIN_API_KEY=your-secret-key
   ```

6. **Start with PM2**
   ```bash
   # Start application
   pm2 start server.js --name parking-backend
   
   # Configure PM2 to start on reboot
   pm2 startup
   pm2 save
   
   # Monitor
   pm2 status
   pm2 logs parking-backend
   ```

7. **Setup Nginx Reverse Proxy (Optional but Recommended)**
   ```bash
   sudo yum install -y nginx
   
   # Create Nginx config
   sudo nano /etc/nginx/conf.d/parking-api.conf
   ```
   
   ```nginx
   server {
       listen 80;
       server_name api.yourparkingapp.com;
   
       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }
   }
   ```
   
   ```bash
   # Start Nginx
   sudo systemctl start nginx
   sudo systemctl enable nginx
   ```

### Add SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo yum install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d api.yourparkingapp.com

# Auto-renewal is configured automatically
sudo certbot renew --dry-run
```

## Step 3: Deploy Frontend to S3 + CloudFront

### Build Frontend

```bash
# On your local machine
cd frontend

# Update .env.production
echo "VITE_MAPBOX_TOKEN=your-token" > .env.production
echo "VITE_API_URL=https://api.yourparkingapp.com/api" >> .env.production

# Build
npm run build
```

### Create S3 Bucket

1. **Navigate to S3 Console**
   - Click "Create bucket"
   - Bucket name: `parking-app-frontend` (must be globally unique)
   - Region: Same as your backend
   - Uncheck "Block all public access"
   - Enable versioning

2. **Configure Static Website Hosting**
   - Bucket → Properties → Static website hosting
   - Enable
   - Index document: `index.html`
   - Error document: `index.html` (for SPA routing)

3. **Bucket Policy**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::parking-app-frontend/*"
       }
     ]
   }
   ```

4. **Upload Build Files**
   ```bash
   aws s3 sync dist/ s3://parking-app-frontend --delete
   ```

### Create CloudFront Distribution

1. **Navigate to CloudFront Console**
   - Click "Create distribution"

2. **Configuration**
   ```
   Origin domain: parking-app-frontend.s3.amazonaws.com
   Origin path: (leave empty)
   Name: S3-parking-app
   
   Origin access: Origin access control settings (recommended)
   - Create new OAC
   
   Default cache behavior:
   - Viewer protocol policy: Redirect HTTP to HTTPS
   - Allowed HTTP methods: GET, HEAD, OPTIONS
   - Cache policy: CachingOptimized
   
   Settings:
   - Price class: Use all edge locations
   - Alternate domain names (CNAMEs): www.yourparkingapp.com
   - Custom SSL certificate: Request certificate (ACM)
   - Default root object: index.html
   ```

3. **Update S3 Bucket Policy for OAC**
   - Copy the policy from CloudFront
   - Update S3 bucket policy

4. **Create Error Pages**
   - CloudFront → Error pages
   - Add custom error response:
     - HTTP error code: 403, 404
     - Customize error response: Yes
     - Response page path: `/index.html`
     - HTTP response code: 200

### Configure DNS (Route 53)

1. **Create Hosted Zone**
   - Domain: yourparkingapp.com

2. **Add Records**
   ```
   Type: A
   Name: (root) or www
   Alias: Yes
   Alias target: CloudFront distribution
   
   Type: A
   Name: api
   Value: EC2 Elastic IP
   ```

3. **Update Nameservers**
   - Copy Route 53 nameservers
   - Update at your domain registrar

## Step 4: Security Hardening

### EC2 Security

```bash
# Enable automatic security updates
sudo yum install -y yum-cron
sudo systemctl start yum-cron
sudo systemctl enable yum-cron

# Configure firewall
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

# Disable password authentication
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
sudo systemctl restart sshd
```

### Aurora Security

1. **Disable Public Access** (after setup)
   - RDS Console → Modify DB cluster
   - Connectivity → Public access → No

2. **Security Group**
   - Only allow inbound from backend security group
   ```
   Type: MySQL/Aurora
   Source: sg-xxxxx (backend-sg)
   ```

3. **Enable IAM Authentication** (Optional)
   - Modify cluster → Enable IAM DB authentication

### Application Security

```bash
# On EC2, create restricted user
sudo useradd -m -s /bin/bash parking-app
sudo su - parking-app

# Move app to user directory
sudo mv /home/ec2-user/parking-app /home/parking-app/
sudo chown -R parking-app:parking-app /home/parking-app

# Run PM2 as this user
pm2 start server.js
```

## Step 5: Monitoring & Logging

### CloudWatch

1. **EC2 Metrics**
   - Install CloudWatch agent
   ```bash
   sudo yum install -y amazon-cloudwatch-agent
   ```

2. **Application Logs**
   ```bash
   # Configure PM2 logs to CloudWatch
   pm2 install pm2-cloudwatch
   pm2 set pm2-cloudwatch:log_group_name /aws/ec2/parking-app
   pm2 set pm2-cloudwatch:log_stream_name backend
   ```

3. **RDS Enhanced Monitoring**
   - Enable in RDS console
   - View in CloudWatch

### Alarms

```bash
# CPU Usage alarm
aws cloudwatch put-metric-alarm \
  --alarm-name parking-app-high-cpu \
  --alarm-description "Alert when CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

## Step 6: Backups & Disaster Recovery

### Database Backups

- Automated backups: Enabled (7 days retention)
- Manual snapshots: Create before major changes
```bash
aws rds create-db-cluster-snapshot \
  --db-cluster-snapshot-identifier parking-app-manual-snapshot-$(date +%Y%m%d) \
  --db-cluster-identifier parking-app-db
```

### Application Backups

```bash
# Create AMI of EC2 instance
aws ec2 create-image \
  --instance-id i-xxxxx \
  --name "parking-backend-$(date +%Y%m%d)" \
  --description "Parking app backend snapshot"
```

## Estimated Costs (Monthly)

```
Aurora db.t3.medium: $50-70
EC2 t3.small: $15-20
S3 + CloudFront: $1-5 (low traffic)
Route 53: $0.50
Data Transfer: $5-10

Total: ~$70-105/month (dev/test)
Production with larger instances: $150-300/month
```

## Troubleshooting

### Backend can't connect to Aurora
- Check security groups
- Verify endpoint and credentials
- Test with mysql client
- Check VPC configuration

### Frontend can't reach backend
- Verify CORS settings
- Check API Gateway/NGINX config
- Verify SSL certificates
- Check CloudFront behavior settings

### Map not loading
- Verify Mapbox token in build
- Check browser console
- Verify HTTPS (Mapbox requires HTTPS)

---

**Next Steps:**
1. Setup CI/CD with GitHub Actions or AWS CodePipeline
2. Add automated testing
3. Configure auto-scaling
4. Implement caching (ElastiCache)
