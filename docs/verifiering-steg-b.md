# Verifiering: inloggning och företagsuppgifter

Genomfört 2026-10-02 mot den lokala Next.js-appen och den konfigurerade Atlas-testdatabasen.
Better Auth 1.7.7, MongoDB-drivrutin 7.7.0 och Node 24.21.0.

## Resultat

- MongoDB-anslutning, ping och replica set kontrollerade. Databasrollen är bredare
  än appdatabasen och bör begränsas till `readWrite` för `arbetsrapporter_dev` inför pilot.
- Produktionsbygget, TypeScript och ESLint passerar.
- Integrationstesterna passerar (nio deltester samt övergripande test).
- Riktig inloggning/utloggning med HttpOnly-sessionscookie verifierade.
- Självregistrering och globala admin-endpoints är otillgängliga via webb-API:t.
- Felaktig Origin avvisas och upprepade inloggningsförsök ger HTTP 429.
- Företag A kan inte läsa eller ändra företag B, eller tvärtom, via ändrade API-ID:n.
- Företagslistan innehåller bara användarens aktiva medlemskap i aktiva företag.
- Saknad session, förfalskad sessionscookie, fel roll, spärrat/taget bort medlemskap
  och spärrat företag nekas. Rolländringar slår igenom för redan inloggade konton.
- Uppdatering av eget företags namn sparas med en historikhändelse.
- Utloggning gör att den tidigare sessionscookien inte längre ger åtkomst.

Playwright/Chromium användes också mot den byggda appen: fel lösenord, lyckad
inloggning, företagsval, sparande/omladdning av företagsnamn, byte av arbetsyta och
utloggning passerade. Företagsval, rapportörsöversikt och företagsinställningar ryms
utan horisontell sidscroll vid 320, 390 och 1440 px. Skärmbilder granskades visuellt.
Ingen fysisk telefon eller full skärmläsargranskning ingick.

## Kör integrationstesterna igen

Tester skriver till utvecklingsdatabasen. De skapar två tillfälliga företag med
slumpade ID:n, e-postadresser under `example.invalid` och slumpade lösenord. Efteråt
rensas bara testets egna företag, medlemskap, historik, användare, konton och sessioner.
Databasen och samlingarna tas aldrig bort. Authbibliotekets index och kortlivade
begränsningsräknare för inloggningsförsök kan finnas kvar.

Terminal 1:

```powershell
npm run build
$env:BETTER_AUTH_URL='http://localhost:3100'
npm run start -- --hostname 127.0.0.1 --port 3100
```

Terminal 2:

```powershell
$env:BETTER_AUTH_URL='http://localhost:3100'
$env:AUTH_TEST_BASE_URL='http://localhost:3100'
npm run test:auth
```

Testkommandot tillåter bara lokal appadress och databasnamn som slutar på `_dev`
eller `_test`. Miljövariablerna ovan gäller respektive terminal; använd en ny terminal
för normal utveckling på port 3000. Webbläsarkontrollen använde lokalt installerad
Playwright och ligger som tillfällig kontroll i `.next/qa`.

## Avgränsning

Företagsgränsen är verifierad för de operationer som finns nu: företagsval,
åtkomst till arbetsytor samt läsning och ändring av företagsnamn. Kundregister,
rapporter, mallar, rapporthistorik och PDF finns ännu inte; deras datagränser måste
testas separat när de byggs. Rapportlistorna innehåller fortfarande inga rapporter.

Inför pilot återstår konto-/rolladministration, kontrollerad lösenordsåterställning,
bedömning av e-postverifiering, Atlas-region/IP-lista, begränsad databasroll samt
driftkonfiguration för HTTPS, betrodd proxy/IP-information och säkerhetskopiering.
Ingen publicering eller produktionsanslutning har gjorts.
