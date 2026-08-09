# PrintWithQR

PrintWithQR is a modern, contactless printing platform that bridges the gap between local print shops and their customers. 

By simply scanning a QR code at a participating shop, customers can instantly upload documents, configure print settings (B&W/Color, page ranges), and place print orders directly from their mobile browser without installing any apps.

## 🚀 Features

### For Shop Owners (Admins)
- **Instant Setup**: Register your shop and instantly get a unique QR Code poster to print and stick on your counter.
- **Order Dashboard**: A real-time dashboard to manage incoming print requests, view files, and mark orders as complete.
- **Subscription Plans**: 
  - **Free Trial**: New shops get a limited free trial (10 prints) to test the platform.
  - **Premium Plans**: ₹99/month or ₹599/year for unlimited prints, custom shop branding, and full analytics.
- **Shop Configuration**: Set custom rates for B&W and Color printing.

### For Customers
- **No App Required**: Works entirely in the mobile web browser.
- **Easy Uploads**: Support for PDF, PNG, JPG, and JPEG files (up to 100MB per file).
- **Print Preview**: Built-in document previewer to review pages before ordering.
- **Custom Print Ranges**: Choose all pages, odd/even only, or a custom range (e.g., `1-3, 5, 7-10`).
- **Fraud Prevention**: Smart device-fingerprinting prevents abuse of the free trial system.

## 🛠 Tech Stack

- **Frontend**: React.js, Vite, Context API
- **Styling**: Vanilla CSS, Modern Glassmorphism, CSS Animations
- **Backend / Database**: [Supabase](https://supabase.com/) (PostgreSQL, Authentication, Realtime Subscriptions, Storage)
- **Deployment**: [Vercel](https://vercel.com/) (Frontend Hosting)
- **Security**: FingerprintJS (Device Fingerprinting & Anti-Fraud)

## 💻 Running Locally

### Prerequisites
- Node.js (v18+)
- A Supabase Project (with URL and Anon Key)

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/itsshashank09/PrintWithQR.git
   cd PrintWithQR
   ```

2. **Install dependencies**
   Navigate into the frontend directory and install the packages:
   ```bash
   cd frontend
   npm install
   ```

3. **Environment Variables**
   Create a `.env` file in the `frontend` folder and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start the Development Server**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`.

## 🗄️ Database Schema

The platform relies on a PostgreSQL schema managed by Supabase. To set up the database, run the SQL commands found in `schema_update.sql` in your Supabase SQL Editor. 
Key tables include:
- `shops` (Shop details, owner references, subscription status)
- `orders` (Print jobs, file URLs, customer names, status)
- `subscriptions` (Payment tracking and plan details)
- `device_logs` (Security and free-trial tracking)

## 🔒 Security & Rate Limiting
To prevent abuse of the "Free Trial" mode, PrintWithQR implements robust device fingerprinting. The platform generates a unique hardware hash for the customer's device. If a customer attempts to place an order, the system checks the `device_logs` table to ensure they haven't exceeded the free trial limits, even if they clear their browser cache or use Incognito Mode!

## 📜 License
This project is proprietary and intended for commercial deployment under the PrintWithQR brand.
