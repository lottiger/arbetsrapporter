# Rapportering utan täckning

## Så används det

1. Logga in med täckning, välj företag och öppna en rapportmall.
2. Välj **Aktivera offline på den här enheten**. Vänta tills förberedelsen är klar
   och texten **Sparat på den här enheten – inte skickat till servern** visas.
3. Öppna även andra mallar eller befintliga utkast som behövs innan du lämnar täckning.
4. Fyll i rapporterna. Ändringar sparas automatiskt lokalt när offline är aktiverat.
5. Vid omladdning utan nät öppnas **Lokala utkast**. Där kan du fortsätta med utkast
   eller skapa nya rapporter från sparade mallar, även efter att en flik stängts.
6. Med täckning: öppna utkastet och välj **Spara utkast** eller **Skicka in**.
   Inskick kräver samma bekräftelse som online. Ingen bakgrundssändning sker.

Offline fungerar på HTTPS och på localhost. Telefoner som ansluter direkt till
datorns vanliga HTTP/IP-adress kan inte aktivera service worker. För fälttest på
telefon behövs en HTTPS-miljö. Privat läge och rensning/automatisk borttagning av
webbplatsdata kan ta bort lokala utkast; lokal lagring är inte en serverbackup.
Webbläsaren tillfrågas om beständig lagring men kan neka det.

## Integritet och åtkomst

- Aktivering är ett uttryckligt val på en personlig enhet. Den som använder samma
  webbläsarprofil kan läsa lokala rapportuppgifter utan en ny serverinloggning.
  Telefonens skärmlås skyddar den lokala åtkomsten; inget separat offline-lösenord finns.
- Ett lokalt konto åt gången. Utkast och mallar innehåller användar- och företags-ID.
  Ny inloggning med ett annat konto rensar tidigare lokala data.
- Utloggning varnar om lokala utkast och rensar dem vid bekräftad utloggning.
  **Rensa enheten och stäng av offline** kan användas även utan täckning. Det rensar
  lokal data men återkallar inte serverns session; vanlig utloggning kräver nät.
- API-data, skyddad HTML och Nexts RSC-svar cachas inte av offlineläget. Service worker
  lagrar bara den offentliga offlinesidan utan användardata och appens statiska resurser.
- Innan sparande kontrolleras att sessionen tillhör utkastets användare. Ordinarie
  serverkontroller för företag, roller, rapportägare och mallregler gäller alltid.
  Utgången session eller nekad behörighet lämnar lokala uppgifter kvar.

## Lagring och konflikter

Inga nya MongoDB-collections används. Lokala kopior ligger i webbläsarens localStorage
under `arbetsrapporter.offline.v1.`. En kopia innehåller malldefinition, mallversions-ID,
svar, automatiskt/manuellt tidsläge, konto/företag, stabilt rapport-ID och ursprunglig
serverrevision. Sparade mallar innehåller inga rapportsvar.

Samma rapport-ID används vid återförsök efter förlorade serversvar. Vid konflikt visas
ett fel och lokala uppgifter behålls. Öppning av serverversionen kräver uttryckligt val
att ersätta lokala uppgifter. Rapportens ursprungliga serverrevision behålls vid lokal
återställning; nyare serverdata skrivs därför inte över tyst.

Web Locks samordnar lokala formulärskrivningar mellan flikar. Lokal revision stoppar
en äldre flik från att skriva över en nyare kopia. Fel eller full lagring visas tydligt;
appen får då inte påstå att de senaste ändringarna är sparade lokalt.

Offline sparar bara mallar som öppnats efter aktivering. En tidigare sparad mall kan
ha ersatts eller avpublicerats medan telefonen var offline. Servern kan då neka en ny
rapport från den gamla mallen. Utkastet behålls så att uppgifterna kan föras över till
en aktuell mall; automatisk konvertering mellan mallversioner ingår inte.

## Verifiering

`npm run test:offline` kontrollerar isolering, rensning, revisionskonflikt och lagringsfel.
`scripts/offline.browser.mjs` körs mot en lokal produktionsserver med samma miljö som
rapporttesterna. Ange `AUTH_TEST_BASE_URL`, motsvarande `BETTER_AUTH_URL`, och vid behov
`PLAYWRIGHT_MODULE` samt `PLAYWRIGHT_CHANNEL=chrome` för befintlig Chrome-installation.
Skriptet skapar ett eget testföretag och konto och rensar endast deras dokument.

Webbläsartestet omfattar verkligt offline-läge, omladdning, stängd/ny flik, tidsläge,
återanslutning, nytt utkast från sparad mall, förlorat serversvar, lokala och serverbaserade
revisionskonflikter, utgången session och utloggning. Det kontrollerar att cache saknar
privat HTML/API-svar, att mobilvyn inte får horisontell scroll och att inga JavaScript-fel
uppstår. Fysisk telefon ingår ännu inte i verifieringen.

Verifierat 2026-10-22: offlineflödet passerar i Chrome både mot `next dev` på port
3001 och produktionsbygget på separat testport. Även befintliga rapportflödets
webbläsartester, 11 lokala offline-/malltester, ESLint, TypeScript och produktionsbygget
passerar. Utvecklingslägets React-debugkanal är avstängd eftersom dess data kräver en
levande anslutning vid hydrering av cachad HTML. Offlinesidan laddas en gång i en dold
ram vid aktivering så att även extra JavaScript-filer hinner sparas före frånkoppling.
