import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'PazSuma — Sistema Institucional',
    template: '%s | PazSuma',
  },
  description: 'Sistema institucional de gestión de tareas, agendas y comunicaciones.',
  keywords: ['gestión', 'municipal', 'tareas', 'agenda', 'PazSuma'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
