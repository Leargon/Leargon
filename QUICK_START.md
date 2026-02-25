# Quick Start Guide - Léargon Authentication System

## Prerequisites
- Docker and Docker Compose installed
Is- OR: Java 21, Gradle, Node.js 24+, MySQL 8

## Option 1: Docker Compose (Easiest)

### Start Everything
```bash
docker compose up --build
```

### Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8081 (direct) or http://localhost:3000/api (via nginx proxy)
- **Health Check**: http://localhost:8081/health

### Stop Everything
```bash
docker compose down
```

### Clean Up (Remove Database)
```bash
docker compose down -v
```

---

## Option 2: Local Development

### Step 1: Start MySQL
```bash
docker run -d \
  --name leargon-mysql \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=rootpassword \
  -e MYSQL_DATABASE=leargon \
  -e MYSQL_USER=leargon \
  -e MYSQL_PASSWORD=leargon \
  mysql:8.4
```

### Step 2: Start Backend (New Terminal)
```bash
cd leargon-backend
./gradlew run
```

Backend will be available at: http://localhost:8080

### Step 3: Start Frontend (New Terminal)
```bash
cd leargon-frontend
npm run dev
```

Frontend will be available at: http://localhost:5173

---

## Testing the Application

### 1. Create an Account
1. Go to http://localhost:3000 (or :5173)
2. Click "Get Started" or "Sign Up" in the navbar
3. Fill in the form:
   - Email: your@email.com
   - Username: yourusername
   - Password: password123 (minimum 8 characters)
   - First Name: Your Name
   - Last Name: Last Name
4. Click "Sign Up"
5. You should be redirected to the Dashboard

### 2. View Your Profile
- The Dashboard displays your profile information
- Shows your username, email, first names, last names
- Shows when you created your account and last login time

### 3. Logout and Login
1. Click "Logout" in the navbar
2. Click "Login" in the navbar
3. Enter your email and password
4. Click "Sign In"
5. You should be redirected back to the Dashboard

### 4. Test Protected Routes
1. While logged out, try to access: http://localhost:3000/dashboard
2. You should be automatically redirected to the login page
3. After logging in, you'll be redirected to the Dashboard

---

## API Testing with curl

### Health Check
```bash
curl http://localhost:8081/health
```

### Sign Up
```bash
curl -X POST http://localhost:8081/authentication/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'
```

Expected response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": {
    "id": 1,
    "email": "test@example.com",
    "username": "testuser",
    "firstName": "Test",
    "lastName": "User",
    "enabled": true,
    "createdAt": "2026-02-04T18:00:00Z",
    "lastLoginAt": null
  }
}
```

### Login
```bash
curl -X POST http://localhost:8081/authentication/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Get Current User
```bash
# First, save the token from login/signup response
TOKEN="paste_your_token_here"

curl http://localhost:8081/users/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## Database Access

### Connect to MySQL
```bash
# If using Docker Compose
docker exec -it leargon-mysql mysql -u leargon -pleargon leargon

# If using standalone MySQL container
docker exec -it leargon-mysql mysql -u leargon -pleargon leargon
```

### Useful SQL Queries
```sql
-- View all users
SELECT id, email, username, first_name, last_name, enabled, created_at, last_login_at
FROM users;

-- Check database migrations
SELECT * FROM DATABASECHANGELOG;

-- View database structure
DESCRIBE users;
```

---

## Troubleshooting

### Backend won't start
**Problem**: "Could not connect to MySQL"
**Solution**:
- Make sure MySQL is running: `docker ps | grep mysql`
- Check MySQL logs: `docker logs leargon-mysql`
- Wait for MySQL healthcheck to pass

### Frontend shows connection errors
**Problem**: "Network Error" or "Cannot connect to backend"
**Solution**:
- Verify backend is running: `curl http://localhost:8081/health`
- Check browser console for CORS errors
- Verify environment variable: Check `.env.development` has correct `VITE_API_URL`

### 401 Unauthorized after login
**Problem**: Token not being sent with requests
**Solution**:
- Open browser DevTools → Application → Local Storage
- Verify `auth_token` exists
- Try logging out and logging back in
- Clear browser cache and local storage

### Duplicate email/username errors
**Problem**: "Email already exists" when signing up
**Solution**:
- Email and username must be unique
- Use a different email/username
- Or delete the user from database:
  ```sql
  DELETE FROM users WHERE email = 'test@example.com';
  ```

### Build errors
**Problem**: Gradle or npm build fails
**Solution**:
- Backend: `cd leargon-backend && ./gradlew clean build`
- Frontend: `cd leargon-frontend && rm -rf node_modules && npm install`

---

## Development Tips

### Hot Reload
- **Frontend**: Vite provides instant hot reload
- **Backend**: Use `./gradlew run --continuous` for auto-restart on changes

### View Logs
```bash
# Docker Compose logs
docker compose logs -f

# Specific service logs
docker compose logs -f backend
docker compose logs -f mysql

# Local development
# Backend logs appear in terminal
# Frontend logs appear in terminal and browser console
```

### Reset Database
```bash
# Docker Compose
docker compose down -v
docker compose up -d mysql

# Wait for MySQL to be ready, then start backend
docker compose up backend
```

---

## Environment Variables

### Backend (application.properties)
- `datasources.default.url` - MySQL connection URL
- `datasources.default.username` - Database user
- `datasources.default.password` - Database password
- `micronaut.security.token.jwt.signatures.secret.generator.secret` - JWT secret

### Frontend (.env.development / .env.production)
- `VITE_API_URL` - Backend API base URL

---

## Next Steps

1. ✅ Test the authentication flow
2. ✅ Create a few test users
3. ✅ Verify protected routes work
4. ✅ Check database persistence
5. 🔧 Customize the UI theme (src/App.jsx)
6. 🔧 Add more user fields if needed
7. 🔧 Implement password reset functionality
8. 🔧 Add email verification
9. 🔧 Implement refresh tokens
10. 🔧 Add user profile editing

---

## Important Security Notes

### For Production Deployment

1. **Change JWT Secret**
   ```bash
   # Generate a secure secret
   openssl rand -base64 32
   ```
   Update in `application.properties` and `docker compose.yml`

2. **Change Database Passwords**
   - Use strong, randomly generated passwords
   - Store in environment variables or secrets manager

3. **Update CORS Origins**
   - Replace localhost URLs with your actual businessDomain
   - Be specific, don't use wildcards

4. **Use HTTPS**
   - Configure SSL/TLS certificates
   - Force HTTPS redirects

5. **Consider httpOnly Cookies**
   - Instead of localStorage for tokens
   - Better protection against XSS

6. **Add Rate Limiting**
   - Protect against brute force attacks
   - Use tools like fail2ban or application-level rate limiting

7. **Enable Database Backups**
   - Regular automated backups
   - Test restore procedures

8. **Monitor and Log**
   - Set up application monitoring
   - Log authentication attempts
   - Alert on suspicious activity

---

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review logs for error messages
3. Verify all prerequisites are installed
4. Ensure ports 3000, 3306, and 8080/8081 are available
5. Check that MySQL is fully started before running backend

## Success!

You should now have a fully functional authentication system with:
- User registration and login
- JWT token authentication
- Protected routes
- User profile management
- Professional Material-UI interface
- MySQL persistence

Happy coding! 🚀
