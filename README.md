# Huddle

App per chi si è trasferito per lavoro: invece di cercare amici da zero, trovi ed entri in **gruppi che esistono già** nella tua città.

Un'unica base di codice Expo che gira come app (Expo Go) e come sito web pubblicato su GitHub Pages.

**Sito:** https://davidefabbrico.github.io/Huddle/

> L'MVP usa dati finti (mock) in memoria: ricaricando la pagina tutto torna allo stato iniziale. Per entrare velocemente usa gli account demo nella schermata di login.

## Funzioni

- **Barra in basso** (stile Instagram): Gruppi · Eventi · ➕ Crea · Chat · Profilo
- **Gruppi**: elenco con filtri e la campanella **Attività** (notifiche) in alto a destra
- **Join flow**: "Chiedi di unirti" → in attesa → accettazione (simulata) → chat
- **Eventi**: "Ci sarò" e check-in **"Sono qui"** mentre l'evento è in corso
- **Gradi** in ogni gruppo, che salgono con i check-in: Turista per caso → Faccia nota → Prezzemolo → Anima della festa → Colonna portante → Leggenda vivente
- **Profilo**: data di arrivo in città, traguardi, gradi, modifica profilo
- **➕ Crea**: nuovo gruppo (chiunque), nuovo evento e richieste da approvare (admin)
- **Chat esterna**: l'admin può collegare il gruppo WhatsApp/Telegram/Signal/Discord; il link lo vedono solo membri e ospiti
- **Locandine**: PDF o immagine allegati agli eventi (gli eventi demo "Aperitivo di benvenuto" e "Anello del Monte Barro" ne hanno una)
- **Avatar**: foto profilo, avatar a pixel stile GitHub (predefinito per i nuovi utenti) o iniziali
- **Icona app**: quando salvi il sito nella schermata Home (iPhone: Condividi → Aggiungi a Home) compare l'icona di Huddle

Account demo: **Giulia** (nuova in città, nessun gruppo) e **Sofia** (admin dei Runners dei Navigli, ha una richiesta da approvare).
L'evento "Allenamento libero in Darsena" è sempre "in corso", per provare subito il check-in.

## Stack

- Expo SDK 58 + Expo Router (TypeScript), react-native-web
- NativeWind 4 (Tailwind) per lo stile
- Zustand per lo stato (sessione, flusso di join)
- Supabase (Auth, Postgres, Realtime) — predisposto, non ancora collegato

## Struttura

```
app/                 schermate (Expo Router)
  login.tsx, signup.tsx
  (app)/(tabs)/              barra in basso: Gruppi · Eventi · Crea · Chat · Profilo
  (app)/group/[id]/index.tsx dettaglio gruppo + "Chiedi di unirti" + gestione admin
  (app)/group/[id]/chat.tsx  lobby/chat del gruppo
  (app)/event/[id].tsx       dettaglio evento, "Ci sarò", check-in
  (app)/activity.tsx         notifiche
  (app)/create-group.tsx, create-event.tsx, edit-profile.tsx
components/          componenti UI
hooks/               store Zustand e hook (useAuth, useJoinStore, useChat, useAsync)
lib/
  api.ts             UNICO punto di accesso ai dati (oggi mock, domani Supabase)
  mockData.ts        dati finti
  types.ts           tipi = tabelle del database
  ranks.ts           scala dei gradi nei gruppi (da "Turista per caso" a "Leggenda vivente")
  achievements.ts    traguardi del profilo
  eventTiming.ts     quando un evento è "in corso" e accetta check-in
  supabase.ts        client Supabase (letto da variabili d'ambiente)
supabase/schema.sql  schema completo con Row Level Security
```

## Avvio in locale

Serve Node.js 22.13 o più recente (consigliato 24, lo stesso usato dalla GitHub Action).

```bash
npm install
npx expo start --web      # browser: http://localhost:8081
npx expo start            # telefono: scansiona il QR con Expo Go (versione per SDK 58)
```

Controlli utili:

```bash
npm run typecheck         # TypeScript
npm run lint              # ESLint (config Expo)
npm run build:web         # build di produzione in dist/ (come su GitHub Pages)
```

L'icona nasce da [assets/icon.svg](assets/icon.svg); i PNG in `assets/` (app) e `public/` (sito: apple-touch-icon,
icone del manifest) ne sono l'esportazione. `public/index.html` e `public/manifest.json` contengono il percorso
`/Huddle/`: se rinomini la repo aggiornali insieme a `baseUrl`.

## Pubblicazione su GitHub Pages

La pubblicazione è automatica: a ogni `git push` sul branch `main` la GitHub Action
[.github/workflows/deploy.yml](.github/workflows/deploy.yml) esegue la build (`npm run build:web`)
e pubblica la cartella `dist/`.

### Da fare una sola volta

1. Su GitHub apri la repo → **Settings → Pages**.
2. In **Build and deployment → Source** scegli **GitHub Actions** (non "Deploy from a branch").
3. La repo deve essere **pubblica** (con un account gratuito Pages non funziona sulle repo private).

### A ogni aggiornamento

```bash
git add .
git commit -m "Descrizione della modifica"
git push
```

Segui l'avanzamento nella tab **Actions**; dopo 1–2 minuti il sito è aggiornato.
Puoi anche rilanciare la pubblicazione a mano: Actions → "Deploy to GitHub Pages" → **Run workflow**.

### Come funziona (dettagli tecnici)

- `app.json` → `experiments.baseUrl: "/Huddle"`: il sito vive in `davidefabbrico.github.io/Huddle/`.
  Se rinomini la repo, aggiorna questo valore.
- `web.output: "single"`: la build produce un solo `index.html` (Single Page Application).
- `404.html` è una copia di `index.html`: GitHub Pages la serve per gli indirizzi che non esistono
  come file (es. `/Huddle/group/g1`), così i link diretti e il refresh funzionano.
- `.nojekyll` evita che GitHub ignori la cartella `_expo/` (inizia con un underscore).

## Supabase (quando sarà il momento)

1. Crea un progetto su [supabase.com](https://supabase.com).
2. **SQL Editor** → incolla ed esegui [supabase/schema.sql](supabase/schema.sql).
3. **Controlla che la Row Level Security sia attiva su tutte le tabelle** (Table Editor → ogni tabella deve mostrare "RLS enabled").
   Lo schema la abilita già, ma se aggiungi tabelle nuove dovrai abilitarla e scrivere le policy.
4. In locale: copia `.env.example` in `.env.local` e inserisci URL e anon key (Project Settings → API).
5. Su GitHub (Settings → Secrets and variables → Actions):
   - **Variables**: `EXPO_PUBLIC_SUPABASE_URL`
   - **Secrets**: `EXPO_PUBLIC_SUPABASE_ANON_KEY`
6. Riscrivi le funzioni di `lib/api.ts` con le query indicate nei commenti
   (l'upload dei file è in `uploadFile`: oggi tiene il file in memoria, con Supabase va su Storage).

Lo schema crea anche i bucket di **Storage**: `avatars` (ognuno scrive solo nella propria cartella) e
`event-posters` (solo l'admin del gruppo), entrambi leggibili pubblicamente tramite URL.

Note di sicurezza:

- **Mai** committare `.env.local` né la `service_role` key. Nell'app va solo la **anon key**.
- La anon key finisce comunque nel JavaScript pubblico: è normale, i dati sono protetti dalle policy RLS.
  Per questo la RLS deve restare sempre attiva.
