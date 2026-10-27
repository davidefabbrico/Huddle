# Huddle

App per organizzare eventi con i propri gruppi di amici, sapere chi c'è e conoscere gente nuova.
Pensata per tutti, con un occhio di riguardo per chi è **nuovo in città** e vuole entrare in gruppi che esistono già.

Un'unica base di codice Expo che gira come app (Expo Go) e come sito web pubblicato su GitHub Pages,
con i dati su **Supabase** (login, database, file, tempo reale).

**Sito:** https://davidefabbrico.github.io/Huddle/

## Funzioni

- **Account**: registrazione con conferma email, login, password dimenticata (link via email), cambio password.
  La sessione resta attiva anche chiudendo e riaprendo l'app.
- **Barra in basso** (stile Instagram): Gruppi · Eventi · ➕ Crea · Chat · Profilo
- **Versione computer**: dal browser di un computer (finestra larga almeno 900px) la barra diventa un menu laterale
  fisso, gruppi ed eventi si dispongono a griglia, gruppo/evento/profilo su due colonne, login con pannello di presentazione.
  Sotto i 900px (telefono) resta il layout a una colonna. Soglia in [hooks/useLayout.ts](hooks/useLayout.ts).
- **Icona del gruppo**: un'emoji su un riquadro colorato, scelta da una lista fissa (78 emoji in 8 categorie,
  8 colori: [lib/groupIcons.ts](lib/groupIcons.ts)); finché nessuno la sceglie, viene suggerita dal nome.
- **Gruppi**: chiunque crea un gruppo (ne diventa admin) e invita gli amici con un link;
  chi vuole entrare chiede, l'admin accetta. Campanella **Attività** per le notifiche.
  L'admin può **eliminare** il gruppo, i membri possono **uscire**.
- **Gruppi pubblici o privati**: i pubblici li trovano tutti; i privati (con eventi e membri) li vede solo chi ne fa
  parte e si entra solo con il **link d'invito** (`/invite/<codice>`), sempre con l'approvazione dell'admin.
  L'admin può creare un link nuovo: quello vecchio smette di funzionare. Un link aperto senza essere
  loggati si riapre dopo il login.
- **Eventi**: qualunque membro organizza un evento; tutti rispondono **"Ci sono" / "Non ci sono"**
  e vedono chi non ha ancora risposto. Check-in **"Sono qui"** durante l'evento. Locandina PDF o immagine.
  Ogni evento ha i suoi argomenti (dalla lista degli interessi; se mancano si ricavano dal titolo).
- **Eventi ricorrenti** (es. palestra lun, mer, ven alle 19): le date si creano da sole due settimane in anticipo.
  Con **"Ci sono ogni volta"** le tue scelte (auto, posti, partenza, il passaggio accettato) valgono anche per le
  prossime date: le auto si organizzano una volta sola. Chi l'ha creato (o l'admin) può fermare la ricorrenza.
- **Cerca** (lente in Gruppi ed Eventi, "Cerca" nel menu laterale su computer): eventi e gruppi per testo,
  **distanza** (dalla tua zona impostata nel profilo, o dalla posizione presa una volta sul sito, mai salvata),
  **età** (la tua o una fascia: confrontata con la fascia d'età del gruppo) e **interessi** ([lib/search.ts](lib/search.ts)).
- **Fascia d'età dei gruppi**: l'admin indica per che età è il gruppo (es. 25–35, anche solo "da" o "a"), insieme a
  zona (con coordinate, per le distanze) e argomenti. L'anno di nascita delle persone resta privato (`user_settings`).
- **Affidabilità**: dai punti nasce un livello (Da conoscere → Affidabile → Molto affidabile → Una garanzia,
  [lib/reliability.ts](lib/reliability.ts)) visibile sul profilo, accanto ai membri e sui gruppi (media dei membri).
- **Locali e aziende**: alla registrazione si sceglie "Una persona" o "Un locale o un'azienda". Il locale ha una
  pagina (un gruppo speciale) dove pubblica i suoi eventi, a cui chiunque può dire "Ci sono" senza entrare nel gruppo.
  Punti diversi: evento organizzato +5, ogni persona che viene +2, grazie +2. Con **20 punti** può mandare un suo evento
  ai membri dei gruppi entro 5/10/25 km (una volta per evento; chi non vuole inviti dei locali lo disattiva nel profilo).
- **Newsletter** "📰 La tua settimana": in cima a "Per te" e una volta a settimana in Attività, gli eventi dei prossimi
  7 giorni vicini alla tua zona o con i tuoi interessi. Si disattiva nel profilo. (Per riceverla anche via email
  servirà un servizio di invio, vedi "Login ed email".)
- **Ci vado** (scheda Eventi): la tua agenda, cioè gli eventi e le vacanze a cui hai detto "Ci sono", con un calendario
  del mese (un pallino nei giorni impegnati; toccando un giorno vedi cosa c'è) e l'elenco dei prossimi.
- **Vacanze** (Crea → Nuova vacanza): più giorni insieme, scelti sul calendario. Hanno una **scaletta** di cose da fare
  e da vedere (anche giorno per giorno) che ogni membro può aggiungere, spuntare, rinominare e togliere.
- **Foto**: in ogni evento, una foto a testa da quando inizia. Le vede chi vede il gruppo: per un gruppo pubblico
  anche le persone di altri gruppi. L'admin può rimuoverle.
- **Spese condivise** (stile Splitwise): l'admin le attiva per gli eventi del gruppo (alla creazione o in Modifica
  gruppo); nelle vacanze ci sono sempre. Si segna chi ha pagato cosa e tra chi dividerla; l'app calcola chi deve
  quanto a chi con meno pagamenti possibile ([lib/expenses.ts](lib/expenses.ts)) e si segna "saldato".
- **La nostra storia** (pagina del gruppo): la linea del tempo dalla nascita del gruppo a oggi, con chi è entrato,
  eventi e vacanze passati, quante persone c'erano e le loro foto.
- **Per te** (scheda Eventi): eventi suggeriti con un punteggio trasparente ([lib/recommendations.ts](lib/recommendations.ts))
  che unisce i tuoi interessi e cosa piace a chi è nei tuoi gruppi (filtro collaborativo, per uscire dalla bolla),
  con una riga che spiega il perché e uno spazio "Fuori dal solito". Per chi è nuovo in città pesano di più
  i gruppi che accolgono persone nuove. Si vedono solo numeri, mai nomi; nel profilo si può nascondere la propria attività.
- **Grazie e punti** (le regole per i locali sono diverse, vedi sotto): dopo l'evento si ringraziano l'organizzatore e chi c'era.
  Punti: organizzare +10 (non a ogni data di un evento ricorrente), partecipare +5, ricevere un grazie +2.
  Classifica in ogni gruppo.
- **Gradi** in ogni gruppo: Volto nuovo → Faccia nota → Prezzemolo → Anima della festa →
  Colonna portante → Leggenda vivente. **Traguardi** nel profilo.
- **Come ci arrivi?**: in ogni evento chi va in auto offre posti e dice da che zona e a che ora parte (mai la posizione);
  chi cerca un passaggio lo chiede e l'autista accetta o rifiuta, con notifica (+5 punti all'autista per ogni passeggero).
  L'autista può mostrare ai passeggeri accettati dove ha lasciato l'auto.
- **SmartPark** (l'app dei parcheggi, vedi sotto): "Trova parcheggio" dall'evento, arrivo rilevato da SmartPark,
  parcheggi condivisi nel gruppo.
- **Chat** del gruppo in tempo reale, più il link al gruppo WhatsApp/Telegram (visibile solo ai membri).
- **Avatar**: foto profilo, avatar a pixel stile GitHub o iniziali.
- **Icona app**: salvando il sito nella schermata Home (iPhone: Condividi → Aggiungi a Home) compare l'icona di Huddle.

## Collegamento con SmartPark

Huddle e [SmartPark](https://davidefabbrico.github.io/parking_test/) hanno server separati e si parlano **solo con link**,
sempre perché l'utente tocca qualcosa:

| Da → a | Cosa succede |
|---|---|
| Evento Huddle → SmartPark | **Trova parcheggio** apre Trova sul luogo dell'evento (`?meta=lat,lon&nome=…&arrivo=…`), con la stima dei posti **per l'ora dell'evento** e il pulsante "Torna all'evento su Huddle". |
| SmartPark → evento Huddle | Quando SmartPark rileva che hai parcheggiato vicino all'evento (entro ~1,2 km, da 3 ore prima a 6 ore dopo), propone "Segnami su Huddle": l'evento si apre con `?smartpark=arrivato&auto=lat,lon` e lì scegli se fare il check-in e se mostrare l'auto ai tuoi passeggeri. |
| Gruppo Huddle → SmartPark | Se l'admin inserisce il **codice del gruppo SmartPark**, i membri vedono "Parcheggi del gruppo su SmartPark" (`?gruppo=CODICE`): così gli amici scoprono insieme dove si parcheggia e non finiscono tutti nello stesso posto. |

Il luogo dell'evento si sceglie dai suggerimenti di indirizzo (OpenStreetMap), che salvano le coordinate.
L'indirizzo di SmartPark è in [lib/smartpark.ts](lib/smartpark.ts); il lato SmartPark è nel repo `parking_test` (`js/huddle.js`).

## Stack

- Expo SDK 58 + Expo Router (TypeScript), react-native-web
- NativeWind 4 (Tailwind) per lo stile, Zustand per lo stato
- Supabase: Auth, Postgres con Row Level Security, Storage, Realtime

## Struttura

```
app/                         schermate (Expo Router)
  login.tsx, signup.tsx, forgot-password.tsx, reset-password.tsx
  (app)/(tabs)/              barra in basso: Gruppi · Eventi · Crea · Chat · Profilo
  (app)/group/[id]/index.tsx gruppo: entra, organizza, invita, classifica, gestione admin
  (app)/group/[id]/chat.tsx  chat del gruppo
  (app)/group/[id]/history.tsx  la storia del gruppo (linea del tempo)
  (app)/invite/[code].tsx    link d'invito (anche per i gruppi privati)
  (app)/event/[id].tsx       evento: Ci sono / Non ci sono, check-in, grazie, locandina
  (app)/activity.tsx         notifiche
  (app)/search.tsx           cerca eventi e gruppi (distanza, età, interessi)
  (app)/create-group.tsx, edit-group.tsx, create-event.tsx, edit-profile.tsx, change-password.tsx
components/                  componenti UI
hooks/                       store Zustand e hook (useAuth, useJoinStore, useChat, useAsync)
lib/
  api.ts                     UNICO punto di accesso ai dati (Supabase)
  supabase.ts                client Supabase (URL e chiave da variabili d'ambiente)
  types.ts                   tipi = tabelle del database
  points.ts, ranks.ts, achievements.ts   punti, gradi, traguardi
  recommendations.ts         "Per te": punteggio e motivazione dei suggerimenti
  expenses.ts                spese condivise: saldi e "chi deve a chi"
  search.ts, reliability.ts  filtri di ricerca; livelli di affidabilità dai punti
supabase/schema.sql          schema completo: tabelle, trigger, Row Level Security, Storage
```

## Mettere online con Supabase (una volta sola)

### 1. Progetto e database

1. Crea un progetto su [supabase.com](https://supabase.com) (regione consigliata: Europa, es. Frankfurt).
2. **SQL Editor** → incolla tutto [supabase/schema.sql](supabase/schema.sql) → **Run**.
3. **Table Editor**: ogni tabella deve risultare con **RLS enabled** (lo schema la attiva già).

### Aggiornamenti del database

Se il progetto esiste già, **non** rieseguire `schema.sql`: esegui una volta, in ordine, gli script nuovi di
[supabase/migrations/](supabase/migrations/) (SQL Editor → incolla → Run). Si possono rieseguire senza danni.

| Script | Cosa aggiunge |
|---|---|
| `20261027_group_icons.sql` | icona (emoji) e colore dei gruppi |
| `20261027_private_groups.sql` | gruppi pubblici/privati e link d'invito |
| `20261028_per_te_passaggi_ricorrenti.sql` | "Per te", passaggi su richiesta, eventi ricorrenti, nuovo nome del primo grado |
| `20261029_vacanze_foto_spese_storia.sql` | vacanze con scaletta, foto degli eventi, spese condivise, storia del gruppo |
| `20261030_cerca_eta_affidabilita_locali.sql` | ricerca (zona e fascia d'età dei gruppi), affidabilità, locali/aziende e promozioni, newsletter |

### 2. Login ed email

4. **Authentication → URL Configuration**
   - **Site URL**: `https://davidefabbrico.github.io/Huddle/`
   - **Redirect URLs**: aggiungi `https://davidefabbrico.github.io/Huddle/**` e `http://localhost:8081/**`
5. **Email** (importante per gli amici): il servizio email incluso in Supabase serve solo per prove,
   spedisce pochissime email all'ora e solo agli indirizzi del team del progetto. Per far registrare gli amici:
   - **subito**: Authentication → Sign In / Providers → Email → disattiva **Confirm email**
     (ci si registra e si entra senza email di conferma);
   - **meglio**: Authentication → Emails → **SMTP Settings** con un servizio email
     (es. Brevo, Resend, o Gmail con una "password per le app"). Serve anche per "Password dimenticata".
   - Facoltativo: in Authentication → Emails → Templates puoi tradurre le email in italiano.

### 3. Chiavi e pubblicazione

6. **Project Settings → API Keys**: copia il **Project URL** e la **Publishable key** (`sb_publishable_…`).
   Non usare mai la secret/service_role key nell'app.
7. GitHub → repo → **Settings → Secrets and variables → Actions → Variables** → crea:
   - `EXPO_PUBLIC_SUPABASE_URL` = Project URL
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = Publishable key
8. Fai `git push` (o Actions → "Deploy to GitHub Pages" → **Run workflow**): dopo 1–2 minuti il sito usa Supabase.

La publishable key finisce nel JavaScript pubblico: è previsto, i dati sono protetti dalle regole RLS.
Per questo la RLS deve restare sempre attiva (e va scritta per ogni tabella nuova).

## Avvio in locale

Serve Node.js 22.13 o più recente (consigliato 24, lo stesso usato dalla GitHub Action).

```bash
npm install
cp .env.example .env.local   # poi inserisci URL e publishable key del progetto Supabase
npx expo start --web         # browser: http://localhost:8081
npx expo start               # telefono: scansiona il QR con Expo Go (versione per SDK 58)
```

Senza `.env.local` l'app mostra la schermata "Supabase non configurato".

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

A ogni `git push` sul branch `main` la GitHub Action [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
controlla il codice (TypeScript + lint), fa la build (`npm run build:web`) e pubblica la cartella `dist/`.

Da fare una sola volta: GitHub → **Settings → Pages → Source: GitHub Actions**. La repo deve essere pubblica
(con un account gratuito Pages non funziona sulle repo private).

Dettagli tecnici:

- `app.json` → `experiments.baseUrl: "/Huddle"`: il sito vive in `davidefabbrico.github.io/Huddle/`.
- `web.output: "single"`: la build produce un solo `index.html` (Single Page Application).
- `404.html` è una copia di `index.html`: GitHub Pages la serve per gli indirizzi che non esistono come file
  (es. `/Huddle/group/…` o `/Huddle/reset-password`), così i link diretti, i link delle email e il refresh funzionano.
- `.nojekyll` evita che GitHub ignori la cartella `_expo/`.
