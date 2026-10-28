# Arbetsrapporter

Mobil webbvy för rapportörer och separat arbetsyta för granskning och
faktureringsunderlag. Byggs stegvis för flera företag.

## Starta lokalt

Använd Node.js 24 (installerad version: 24.21.0) och npm.

```powershell
node --version
npm ci
npm run dev -- --hostname 127.0.0.1
```

Öppna [http://localhost:3001](http://localhost:3001). Logga in och välj företag.
På Windows kan `npm.cmd` användas om PowerShell blockerar
`npm.ps1`. Om paketen redan finns behöver `npm ci` inte köras igen.

Appen använder Better Auth för inloggning och MongoDB Atlas för konton,
sessioner, företag och medlemskap. `.env.example` visar inställningarna utan
hemligheter. Publicering ska gås igenom separat.

## Sätt upp Better Auth och MongoDB Atlas

Vi har valt Better Auth och en separat testdatabas i MongoDB Atlas.
Följ [integrationsguiden](docs/integration-guide.md) för konto, kluster,
databasanvändare, IP-lista och anslutningssträng.

```powershell
npm run setup:local
npm run config:check
npm run db:check
```

`setup:local` skapar `.env.local` med en slumpgenererad authnyckel och tom Atlas-adress.
En befintlig fil lämnas oförändrad. Både `.env` och `.env.local` ignoreras av Git.
`config:check` kontrollerar bara format och visar inga hemliga värden; det ansluter
inte till Atlas. Saknad databasadress är ett väntat fel tills den har fyllts i.
`db:check` ansluter till konfigurerad Atlas-databas för ett lästest.
Testa formatkontrollen med `npm run test:config`.

I nuvarande lokala konfiguration ligger MongoDB-adressen i `.env`, medan authnyckeln
ligger i `.env.local`. En tom variabel i `.env.local` tar företräde över `.env` och ska
inte läggas tillbaka. `MONGO_USER_NAME` och `MONGO_PASSWORD` är inte appinställningar;
appen använder den kompletta anslutningssträngen i `MONGODB_URI`.

## Skapa första administratören

Kör i en interaktiv terminal i projektmappen:

```powershell
npm run admin:create
```

Ange företagsnamn, ditt namn, e-post och ett lösenord på 12–128 tecken.
Lösenordet visas inte medan du skriver och anges två gånger. Kommandot skapar ett
nytt företag och ett konto med rollerna rapportör, företagsadministratör och
faktureringsansvarig i just det företaget. Befintliga konton och företag skrivs inte över.
Kontot får ingen global systemadministratörsroll. Självregistrering via webben är avstängd.

Öppna [inloggningen](http://localhost:3001/logga-in), logga in och välj ditt företag.
Starta om utvecklingsservern om den var igång innan miljövariablerna ändrades.

Kontrollera att appen verkligen kör på porten i `BETTER_AUTH_URL`. Om port 3001 är
upptagen av ett annat projekt väljer Next en annan port, och inloggningen avvisas då
med fel ursprung (HTTP 403) som visas som misslyckad inloggning. Stäng det andra
projektet eller starta med `--port 3001`.

## Glömt lösenord (lokalt)

Kör `npm.cmd run account:reset-password` i en interaktiv terminal i projektmappen.
Ange kontots e-postadress och ett nytt lösenord på 12–128 tecken två gånger.
Lösenordet döljs och ska inte anges i chatten eller som kommandoradsargument.
Kommandot använder Better Auths lösenordshashning och byter lösenord samt tar bort
kontots gamla sessioner i samma databastransaktion. Företag, roller och rapporter
ändras inte. Detta är ett lokalt operatörskommando med databasåtkomst, inte en
publik återställningsfunktion. Återställning via e-post återstår.

## Publicera mallarna för TMA och bärgning

```powershell
npm run templates:publish -- "Företagsnamn"
```

Kommandot publicerar de inbyggda mallarna **Underlag TMA** och **Bärgningsbesked/underlag**
för det angivna företaget. Utan argument listas aktiva företag och namnet efterfrågas.
En ändrad malldefinition får ett nytt versionsnummer vid nästa publicering; tidigare
versioner ändras aldrig. Oförändrade mallar lämnas orörda. Mallarna definieras i
`src/domain/templates/` och kontrolleras med `npm run test:templates`.

## Prova appen

| Adress | Innehåll |
| --- | --- |
| `/logga-in` | Inloggning med e-post och lösenord. |
| `/foretag` | Välj bland kontots aktiva företagsmedlemskap. |
| `/rapportor` | Översikt med ny rapport, utkast, kompletteringar och inskickade rapporter. |
| `/rapportor/ny` | Företagets rapportmallar (TMA och bärgning) med beskrivning och antal fält. |
| `/rapportor/ny/tma`, `/rapportor/ny/bargning` | Fyll i och skicka in direkt, eller spara ett utkast för att fortsätta senare. Ofullständiga utkast tillåts. |
| `/rapportor/rapporter` | Egna rapporter från databasen med statusfilter och sidindelning. |
| `/rapportor/rapporter/[id]` | Redigera ett eget utkast eller en begärd komplettering. Läs inskickade versioner och kommentarer i historiken. |
| `/admin/fakturaunderlag` | Gemensam lista med Alla, Att hantera och Helt klara. Klarmarkera godkända underlag direkt på kortet. Klara kort är gröna. |
| `/admin/fakturaunderlag/[id]` | Läs, begär komplettering, godkänn och klarmarkera på samma detaljsida. Historik och versioner finns kvar. |
| `/admin/mallar` | Företagets mallar med publiceringstid, alla fält per sektion och reglerna i klartext. |
| `/admin/foretag` | Läs och ändra valt företags namn; ändringen sparas med aktör och tid. |

1. Öppna rapportörsvyn i smal webbläsare, cirka 390 px. Prova bottennavigationen.
2. Välj **Att komplettera**. Statusvyn och webbadressen ändras. Prova andra statusar,
   uppdatera sidan och använd webbläsarens bakåtknapp.
3. Välj **Skapa ny rapport** och öppna **Underlag TMA**. Ange starttid 22:30, sluttid 00:30
   och rast 0: debiterbara timmar fylls automatiskt i med 2 h. Med rast 30 blir det 1,5 h.
   Du kan skriva ett eget värde som sedan behålls även när tiderna ändras eller utkastet
   öppnas igen. **Använd beräknad tid** slår på automatiken igen. Ändra till 3 timmar
   så visas en varning, men värdet behålls. **Spara utkast** är valfritt om du vill
   fortsätta senare. Prova då att ladda om och kontrollera att uppgifterna finns kvar.
4. Fyll i de obligatoriska uppgifterna. Välj **Skicka in** och **Bekräfta och skicka in**.
   Uppgifterna sparas och rapporten låses, även om du aldrig sparat ett utkast.
   Välj **Administratörsvy** i kontoraden och öppna den under **Fakturaunderlag**.
5. Välj **Begär komplettering**, skriv en kommentar och välj **Skicka begäran**.
   Rapportören hittar den under **Att komplettera**, ändrar uppgifterna och väljer
   **Spara komplettering**. När allt är klart: **Skicka in igen** och bekräfta.
6. Öppna rapporten under **Fakturaunderlag**. Historiken visar tidigare versioner och kommentarer.
   Välj **Godkänn rapport** och **Bekräfta godkännande**. Administratörer får godkänna
   sina egna rapporter. Kortet får status **Att lägga in**.
7. När rapporten är administrerad i bokföringssystemet: välj **Markera som inlagd**
   direkt på kortet. Hela kortet blir grönt och visar **Inlagd / helt klar**.
   Det ligger kvar i **Alla** och finns även under **Helt klara**. Detaljsidan visar vem och när.
8. Använd Tab och Enter. Första länken är **Hoppa till innehållet**, fokus ska synas
   och aktuell sida/status anges även för skärmläsare.

Navigation, statusval och responsiva layouter fungerar. Rapportlistorna visar sparade
rapporter för valt företag och rätt användare. Okända eller upprepade statusparametrar
visar standardvyn. Okända eller otillgängliga rapporter ger en svensk 404-sida.
Versionsnummer visas inte i gränssnittet; historikens inskick känns igen på datum,
tid och rapportör. Utvecklingsindikatorn är avstängd även vid lokal utveckling.
Arbetsytorna kräver nu inloggning och aktivt företagsmedlemskap. Företagsadministratör
kan granska och ändra företagsnamn, faktureringsansvarig ser godkända rapporter i samma vy och
rapportör kan använda rapportörsvyn. Roller kombineras per företag. Serverkontrollerna
gäller även när någon skriver en adress eller anropar API:t direkt.
De tidigare adresserna `/admin/granskning` och `/admin/underlag`, inklusive detaljlänkar,
omdirigeras till Fakturaunderlag. Versions- och sidparametrar följer med.

## Kontroller

```powershell
npm run lint
npm run typecheck
npm run build
npm run test:config
npm run test:templates
```

För att prova den byggda appen lokalt efter `build`:

```powershell
npm run start -- --hostname 127.0.0.1
```

Integrationstester mot Atlas beskrivs i [verifieringen av steg B](docs/verifiering-steg-b.md)
och [rapportflödets verifiering](docs/verifiering-steg-c.md). `npm run test:reports`
testar utkast, komplettering, inskick, godkännande, klarmarkering, faktureringsåtkomst, ägarskap,
företagsgränser och samtidiga ändringar mot en lokal server.
Testerna skapar tillfälliga testkonton/företag och rensar endast dokument med testets egna ID:n.

## Rapportera utan täckning

Öppna ett rapportformulär med uppkoppling och välj **Aktivera offline på den här enheten**.
Öppnade mallar och utkast kan sedan användas via **Lokala utkast**, även efter omladdning
utan nät. Med täckning väljer rapportören själv Spara utkast eller Skicka in.
Utloggning rensar lokala uppgifter efter varning. HTTPS krävs på telefon.
Se [offlineinstruktioner, datalagring och verifiering](docs/offline.md).

## Struktur och fortsättning

```text
src/app/rapportor/          rapportörens mobilanpassade sidor och layout
src/app/admin/              administratörens sidor och layout
src/components/navigation/ navigation och statusval
src/components/ui/         gemensamma visuella komponenter
src/components/reports/    formulär som byggs från en mall
src/domain/                malltyper, malldefinitioner (TMA, bärgning) och utvärdering av svar
src/server/                MongoDB, Better Auth, medlemskap, mallpublicering och serverkontroller
scripts/                   konfiguration, lokal kontoprovisionering, mallpublicering och tester
docs/arkitektur.md          krav, förslag, datamodell och nästa byggsteg
```

**Inte byggt:** kundregister, PDF, bilduppladdning, strukturerade
kostnadsrader för bärgning, automatisk Fortnox-integration eller installationsstöd för PWA.
TMA och bärgning kan skickas in direkt eller först sparas som utkast, kompletteras och godkännas.
Inskickade versioner är låsta; mall, svar, företagsnamn, aktör, beräkningar och varningar
bevaras. Historiken registrerar vem som skapade, sparade, skickade in och fattade beslut.
Varje nytt inskick sparas som en ny version. Godkännande gäller den granskade versionen
och gör den klar för fakturering. Administratörer får godkänna egna rapporter.
Faktureringsansvarig och administratör kan därefter markera rapporten som helt klar,
administrerad i bokföringssystemet. Markeringen sparas med användare och tid i historiken.
Användar-/rolladministration i webbgränssnittet, återställning av lösenord via e-post och
systemadministratörens arbetsyta återstår också. Inloggning, företagsuppgifter och
rapporternas ägarskap/företagsseparering är verifierade för de operationer som finns.
Mobilanpassningen är testad i webbläsare men ännu inte på en fysisk telefon.

Se [arkitektur och byggordning](docs/arkitektur.md) för förslag på Better Auth,
MongoDB, serverkontroller, versionshistorik och rapport-/faktureringsstatus.

PDF avvaktar enligt användarens önskemål. Klarmarkering i appen är implementerad;
arbetet i bokföringssystemet görs separat. Mallarna bygger på originalblanketterna för TMA och
bärgning; priser, moms, bruttoviktens enhet och baksidan för utlandskund är
fortfarande markerade **ATT VERIFIERA** i arkitekturdokumentet.
