# ✂️ קטיפה - מערכת קביעת תורים

מערכת קביעת תורים לקטיפה עם אתר מעוצב ובוט Discord.

---

## 🚀 התקנה

### 1. התקן תלויות
```bash
npm install
```

### 2. הגדר משתני סביבה
```bash
cp .env.example .env
```
ערוך את `.env` עם הפרטים שלך.

### 3. הגדרת Discord Application

1. לך ל-[Discord Developer Portal](https://discord.com/developers/applications)
2. צור Application חדש
3. לך ל-**Bot** → צור Bot → העתק את ה-Token
4. לך ל-**OAuth2** → העתק Client ID ו-Client Secret
5. ב-**OAuth2 → Redirects** הוסף: `http://localhost:3000/auth/discord/callback`
6. ב-**Bot → Privileged Gateway Intents** הפעל:
   - Server Members Intent
   - Message Content Intent

### 4. הזמן את הבוט לשרת
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=274877908992&scope=bot%20applications.commands
```

### 5. הפעל

**שרת האתר:**
```bash
npm start
```

**בוט Discord (בטרמינל נפרד):**
```bash
node bot.js
```

---

## ⚙️ משתני סביבה

| משתנה | תיאור |
|-------|-------|
| `DISCORD_BOT_TOKEN` | טוקן הבוט |
| `DISCORD_CLIENT_ID` | Client ID של האפליקציה |
| `DISCORD_CLIENT_SECRET` | Client Secret |
| `GUILD_ID` | מזהה השרת שלך |
| `APPROVAL_CHANNEL_ID` | `1495891503988477992` - ערוץ האישורים |
| `MEMBER_ROLE_ID` | `1495891020901126204` - רול קביעת תורים |
| `ADMIN_ROLE_ID` | `1487800359341785213` - רול מנהל |
| `MONGODB_URI` | כתובת MongoDB |
| `SESSION_SECRET` | מחרוזת סודית לסשן |
| `CALLBACK_URL` | `http://localhost:3000/auth/discord/callback` |

---

## 🔐 הרשאות

| רול | גישה |
|-----|------|
| `1495891020901126204` | קביעת תורים |
| `1487800359341785213` | קביעת תורים + ניהול מלא |

---

## 📋 תהליך קביעת תור

1. משתמש נכנס לאתר ומתחבר עם Discord
2. הבוט בודק שהמשתמש בשרת ויש לו את הרול הנדרש
3. המשתמש בוחר תור ותאריך
4. הבוט שולח הודעה לערוץ `1495891503988477992` עם כפתורי אישור/דחייה
5. מנהל לוחץ על אישור/דחייה
6. הבוט שולח DM למשתמש עם התוצאה
