# Firebase Setup Guide

## 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard

## 2. Enable Authentication

1. In Firebase Console, go to **Authentication**
2. Click **Get started**
3. Enable the following sign-in methods:
   - **Email/Password** (Enable)
   - **Google** (Enable)

## 3. Create Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (for development) or configure security rules
4. Select a location for your database

## 4. Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to **Your apps** section
3. Click on **Web** icon (`</>`) or add a web app
4. Copy the Firebase configuration values

## 5. Set Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## 6. Create Admin User

### Method 1: Using Setup Page (Easiest - Development Only)

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Go to `http://localhost:3000/admin/setup`

3. Fill in the form:
   - **Email**: Your admin email (e.g., `admin@editaja.com`)
   - **Password**: Your admin password (min 6 characters)
   - **Confirm Password**: Confirm your password

4. Click **Create Admin Account**

5. The system will automatically:
   - Create user in Firebase Authentication
   - Create admin document in Firestore
   - Set admin privileges

6. You can now login at `/admin` with the email and password you just created

⚠️ **Note**: Remove or protect the `/admin/setup` route in production!

### Method 2: Using Firebase Console

1. **Create User in Authentication**:
   - Go to **Authentication** > **Users**
   - Click **Add user**
   - Enter email and password
   - Click **Add user**
   - **Copy the UID** (click on the user to see UID)

2. **Create Admin Document in Firestore**:
   - Go to **Firestore Database**
   - Create a collection named `admins` (if not exists)
   - Click **Add document**
   - **Document ID**: Paste the UID from step 1 (NOT the email!)
   - Add fields:
     - `email` (string): User's email
     - `isAdmin` (boolean): `true`
     - `createdAt` (timestamp): Current timestamp
   - Click **Save**

3. Login at `/admin` with the email and password

### Method 3: Using Script

1. First, create a user account through Firebase Console > Authentication
2. Get the user's UID from Firebase Console
3. Run the script:
   ```bash
   npx ts-node scripts/create-admin.ts <uid> <email>
   ```
   Example:
   ```bash
   npx ts-node scripts/create-admin.ts abc123xyz456 admin@editaja.com
   ```

📖 **For detailed instructions, see [SETUP-ADMIN.md](./SETUP-ADMIN.md)**

## 7. Firestore Security Rules

**⚠️ PENTING:** Rules yang benar diperlukan agar aplikasi bisa check admin status!

Update your Firestore security rules di Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is admin
    function isAdmin() {
      return request.auth != null && 
             exists(/databases/$(database)/documents/admins/$(request.auth.uid)) &&
             get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.isAdmin == true;
    }
    
    // Users collection - users can read/write their own data
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Admins collection
    match /admins/{adminId} {
      // ⚠️ PENTING: Allow users to read their own admin document (to check if they are admin)
      allow read: if request.auth != null && request.auth.uid == adminId;
      
      // Only existing admins can read other admin documents
      allow read: if isAdmin();
      
      // Allow creation for admin setup (development)
      allow create: if request.auth != null;
      
      // Only admins can update/delete admin documents
      allow update, delete: if isAdmin();
    }
    
    // Deny all other collections by default
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Cara Update:**
1. Buka Firebase Console → Firestore Database → Rules
2. Copy rules di atas
3. Paste ke editor
4. Klik **Publish**
5. Tunggu beberapa detik untuk rules di-deploy

📖 **Untuk penjelasan lengkap, lihat [FIX-FIRESTORE-RULES.md](./FIX-FIRESTORE-RULES.md)**

## 8. Authentication Setup

### Google Sign-In Setup

1. In Firebase Console, go to **Authentication** > **Sign-in method**
2. Enable **Google** provider
3. Add your project's support email
4. **⚠️ PENTING untuk Production:** Add authorized domains
   - Go to **Authentication** > **Settings** > **Authorized domains**
   - Click **Add domain**
   - Add your production domain (e.g., `editaja.com`, `www.editaja.com`)
   - Without this, Google login will fail with "unauthorized-domain" error

### Email/Password Setup

1. In Firebase Console, go to **Authentication** > **Sign-in method**
2. Enable **Email/Password** provider
3. Enable "Email link (passwordless sign-in)" if needed

## 9. Testing

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Test user login:
   - Go to `/login`
   - Try signing up with email/password
   - Try signing in with Google

3. Test admin login:
   - Go to `/admin`
   - Sign in with admin credentials
   - You should be redirected to `/admin/dashboard`

## Troubleshooting

### "Access denied. Admin privileges required."
- Make sure the user exists in the `admins` collection
- Check that `isAdmin` field is set to `true`
- Verify the UID matches the user's authentication UID

### Firebase not initialized
- Check that all environment variables are set correctly
- Make sure `.env.local` file is in the root directory
- Restart the development server after changing environment variables

### Google Sign-In not working
- Check that Google provider is enabled in Firebase Console
- Verify authorized domains are set correctly
- Check browser console for errors

## Next Steps

- Set up Firebase Storage for image uploads
- Configure Firebase Hosting for production deployment
- Set up Cloud Functions for server-side operations
- Configure Firebase Analytics for tracking

