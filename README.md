# T.S. Serviceleistungen: Digitale Lösungen

Eigenständige Demo-Anwendung für Kundenverwaltung, Angebote, Rechnungen und Auswertungen.

## Voraussetzungen
- Node.js 20 oder neuer
- npm
- GitHub-Repository
- Separates Supabase-Projekt für diese Demo

## Lokal starten
1. `npm install`
2. `.env.example` nach `.env.local` kopieren.
3. `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` aus dem neuen Supabase-Projekt eintragen.
4. `npm run dev`

## Build prüfen
- `npm run build`

## Sicherheit
- Niemals Service-Role-Keys, Datenbankpasswörter oder andere Geheimnisse in `.env`-Dateien committen.
- Die Browser-App setzt korrekt konfigurierte RLS-Policies voraus.
- Diese Demo ist ein Entwicklungsstand, keine freigegebene Buchhaltungssoftware.
- Vor produktivem Einsatz sind Berechtigungen, Nummernkreise, Steuerlogik, unveränderbare ausgestellte Dokumente, Backups und rechtliche Anforderungen zu testen.
