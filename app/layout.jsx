import './globals.css';

export const metadata = {
  title: 'LoL Video Auto-Generator | Studio',
  description: 'AI-Powered Patch Notes Video Generator',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <body>
        <main className="appRoot">
          {children}
        </main>
      </body>
    </html>
  );
}
