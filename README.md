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

Öppna [http://localhost:3000](http://localhost:3000). Logga in och välj företag.
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

Öppna [inloggningen](http://localhost:3000/logga-in), logga in och välj ditt företag.
Starta om utvecklingsservern om den var igång innan miljövariablerna ändrades.

Kontrollera att appen verkligen kör på porten i `BETTER_AUTH_URL`. Om port 3000 är
upptagen av ett annat projekt väljer Next en annan port, och inloggningen avvisas då
med fel ursprung (HTTP 403) som visas som misslyckad inloggning. Stäng det andra
projektet eller starta med `--port 3000`.

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
| `/rapportor/ny` | Företagets publicerade mallar (TMA och bärgning) med version och antal fält. |
| `/rapportor/ny/tma`, `/rapportor/ny/bargning` | Formulär byggt från mallen. Fyll i och **Kontrollera uppgifterna**: obligatoriska fält, format, arbetad tid över midnatt och varning vid avvikande debiterbar tid. Inget sparas ännu. |
| `/rapportor/rapporter` | Tom rapportlista med statusval. |
| `/admin/granskning` | Granskningskö med statusval och beskrivning av arbetsflödet. |
| `/admin/underlag` | Separata vyer för underlag att hantera och redan hanterade. |
| `/admin/mallar` | Företagets mallar med version, publiceringstid, alla fält per sektion och reglerna i klartext. |
| `/admin/foretag` | Läs och ändra valt företags namn; ändringen sparas med aktör och tid. |

1. Öppna rapportörsvyn i smal webbläsare, cirka 390 px. Prova bottennavigationen.
2. Välj **Att komplettera**. Statusvyn och webbadressen ändras. Prova andra statusar,
   uppdatera sidan och använd webbläsarens bakåtknapp.
3. Välj **Skapa ny rapport** och öppna **Underlag TMA**. Ange starttid 22:30, sluttid 00:30
   och 2 debiterbara timmar: arbetad tid beräknas till 2 h över midnatt. Ändra till 3 timmar
   så visas en varning, men värdet behålls. Inga uppgifter kan sparas ännu.
4. Välj **Administratörsvy** i kontoraden. Prova granskningsstatusar
   och gå vidare till **Faktureringsunderlag**.
5. Använd Tab och Enter. Första länken är **Hoppa till innehållet**, fokus ska synas
   och aktuell sida/status anges även för skärmläsare.

Navigation, statusval och responsiva layouter fungerar. Listorna innehåller ingen
data; statusvalen filtrerar därför ännu inga verkliga rapporter. Okända eller
upprepade statusparametrar visar standardvyn. Okända sidor ger en svensk 404-sida.
Arbetsytorna kräver nu inloggning och aktivt företagsmedlemskap. Företagsadministratör
kan granska och ändra företagsnamn, faktureringsansvarig kan öppna underlagsvyn och
rapportör kan använda rapportörsvyn. Roller kombineras per företag. Serverkontrollerna
gäller även när någon skriver en adress eller anropar API:t direkt.

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

Integrationstester mot Atlas beskrivs i [verifieringen av steg B](docs/verifiering-steg-b.md).
De skapar tillfälliga testkonton/företag och rensar endast dokument med testets egna ID:n.

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

**Inte byggt:** sparande av rapporter (utkast och inskick), kundregister, rapportredigering,
kompletteringsflöde, rapporthistorik, godkännande, PDF, bilduppladdning, strukturerade
kostnadsrader för bärgning, markering i Fortnox eller installerbar PWA/offlinestöd.
Mallarna för TMA och bärgning finns och formuläret kan fyllas i och kontrolleras.
Användar-/rolladministration i webbgränssnittet, återställning av lösenord via e-post och
systemadministratörens arbetsyta återstår också. Inloggning och företagsuppgifter är
verifierade; rapporternas företagsseparering måste testas när rapportlagringen byggs.
Mobilanpassningen är testad i webbläsare men ännu inte på en fysisk telefon.

Se [arkitektur och byggordning](docs/arkitektur.md) för förslag på Better Auth,
MongoDB, serverkontroller, versionshistorik och rapport-/faktureringsstatus.

Nästa steg är att spara rapporter: utkast, inskick och granskning mot företagets
publicerade mallversion. Mallarna bygger på originalblanketterna för TMA och
bärgning; priser, moms, bruttoviktens enhet och baksidan för utlandskund är
fortfarande markerade **ATT VERIFIERA** i arkitekturdokumentet.
