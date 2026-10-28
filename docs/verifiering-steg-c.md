# Verifiering: rapporter, komplettering och godkännande

Uppdaterat och verifierat 2026-10-20 mot den byggda lokala appen och Atlas-testdatabasen.

## Levererat

- TMA och bärgning: skicka in direkt eller spara ofullständiga utkast för att fortsätta
  senare. Skicka in är huvudknappen även för nya rapporter. Bekräftelsen inför låsning finns kvar.
- Uppgifterna kontrolleras när användaren väljer Skicka in. Formuläret har två huvudval:
  Skicka in och Spara utkast (Spara komplettering vid en begärd komplettering).
- Gränssnittet visar inga mall- eller rapportversionsnummer. Historiklänkar visar datum
  och klockslag, godkännandeknappen heter Godkänn rapport. Tekniska instruktioner för
  mallpublicering har ersatts av användarvägledning. Utvecklingsindikatorn är avstängd.
- Ny rapport får ett stabilt ID från klienten för säkra återförsök. Upprepad skapning
  av samma rapport skriver aldrig över tidigare sparade uppgifter.
- Utkast får innehålla ofullständiga svar. Servern kontrollerar alltid kända fältnamn,
  typer och storleksgränser. Inskick kontrollerar även alla mallregler och giltiga datum.
- Varje rapport behåller sin ursprungliga mallversion även om en ny mall publiceras.
- Inskick skapar en oföränderlig version med mall, normaliserade svar, företagsnamn,
  verifierad användare, tid, beräkningar och varningar. Angivna debiterbara timmar bevaras.
- Status, version och historikhändelse sparas i en MongoDB-transaktion. En villkorad
  uppdatering med `revision` avvisar gamla redigeringar och dubbla inskick med HTTP 409.
- Rapportören ser sina egna rapporter. Granskaren ser företagets inskickade rapporter.
  Utkast är privata för rapportören även när en annan användare är företagsadministratör.
- Listor har statusfilter och visar 50 rapporter per sida. Detaljvyn visar de senaste
  100 historikhändelserna; äldre händelser finns kvar i databasen.
- Formuläret varnar vid omladdning/stängning och klick på länkar med osparade ändringar.
  Nätfel och konflikter behåller formulärinnehållet. Sparande sker manuellt.
- Debiterbar tid (TMA) och använd tid (bärgning) fylls i automatiskt från mallens
  tidsregel. Manuella ändringar behålls. Knappen **Använd beräknad tid** återaktiverar
  beräkningen. Valet sparas med rapporten; servern räknar om automatiska fält vid skrivning.
- Administratören begär komplettering med en obligatorisk kommentar på högst 2000
  tecken. Rapportören kan spara ändringar och skicka in en ny version. Granskaren ser
  endast inskickade uppgifter, även medan rapportören arbetar med kompletteringen.
- Godkännande kräver aktuell revision och den granskade versionsreferensen.
  Administratörer får godkänna egna rapporter enligt användarens beslut.
- Godkänd rapport låses och får faktureringsstatus `ready`. Faktureringsansvarig och
  administratör kan läsa den godkända versionen under Fakturaunderlag.
- Tidigare inskick, kommentarer och beslut bevaras. Rapportör och granskare kan öppna
  inskickade versioner i historiken. De senaste 100 versionerna listas; alla sparas.
- En gemensam menyflik, **Fakturaunderlag**, ersätter Granskning och Faktureringsunderlag.
  Listan visar Alla, Att hantera och Helt klara. Äldre länkar omdirigeras till den nya vyn.
- Faktureringsansvarig och administratör kan välja **Markera som inlagd** direkt på ett
  godkänt kort. Hela kortet blir grönt med texten **Inlagd / helt klar**. Det finns kvar i
  Alla och visas även under Helt klara. Användare, tid och version sparas i historiken.

## Automatiserade kontroller

`scripts/reports.integration.test.mjs` passerar: 22 deltester och ett övergripande test.
Testerna använder tre tillfälliga konton och företag, samt extra medlemskap i samma
företag för att skilja ägarskap från företagsåtkomst.

- Riktig inloggning; anonym och förfalskad session nekas.
- Gamla gransknings- och underlagslänkar ger HTTP 308 till Fakturaunderlag med bevarade
  versions-, status- och sidparametrar. Sidor och listfilter kontrolleras för båda rollerna.
- Fel Origin, fel roll, främmande mallversion, okända fält, fel värdetyper och för
  stora anrop avvisas. Klienten kan inte ange en annan skapare eller status.
- Ofullständigt utkast sparas och kan hämtas. Samtidig dubbel skapning ger en rapport
  och en skapandehändelse.
- Direkt inskick kontrollerar behörighet, företag, Origin, anropsstorlek och mallregler.
  Ogiltiga uppgifter lämnar inga rapporter, versioner eller händelser. Korrigerade uppgifter
  kan skickas med samma ID. Manuellt angiven tid och tillhörande varningar bevaras.
- Samtidiga direkta inskick skapar en låst rapport med revision 1, en version och en
  inskickshändelse. Automatisk tid räknas om; aktören kommer från sessionen. Återförsök
  med ändrade uppgifter skriver inte över inskicket och andra företag/ägare nekas.
- Samtidigt första utkast och direkt inskick ger en enda rapport med sammanhängande
  status och historik. Det senare anropet skriver inte över det första.
- Annan rapportör kan inte läsa, ändra eller skicka in rapporten. Granskaren kan inte
  läsa utkast. Företags-ID och rapport-ID kan inte kombineras för att korsa företagsgränsen.
- Saknade obligatoriska uppgifter, ogiltigt kalenderdatum, tillbud utan beskrivning
  och för lång rast avvisas vid inskick utan att utkast eller historik ändras.
- Samtidiga sparningar ger en lyckad ändring och en konflikt. Återförsök med gammal
  revision kan inte skriva över den senaste versionen.
- Ny mallpublicering ändrar inte befintliga utkast eller deras regler.
- Automatisk tid räknas om på servern och sparas med rätt läge. Manuellt värde behålls
  även om det ursprungligen är lika med beräknad tid. Okända fält och fel typ för läget nekas.
- Dubbelt inskick ger exakt en inskickad version och händelse. Efter inskick avvisas
  ändring och nytt inskick. Aktören hämtas från sessionen, oberoende av namnfältet.
- Rapportlistor, statusfilter, sidindelning, rapportörens sida och granskarens sida
  visar rätt data. Ändrad roll, borttaget medlemskap, spärrat företag och borttagen
  session slår igenom på nya anrop.
- Granskningsbeslut kontrollerar administratörsroll, företag, Origin, kommentar,
  aktuell revision och versionsreferens. Tom eller för lång kommentar avvisas.
- Samtidiga kompletteringsbegäranden ger en händelse. Pågående ändringar syns endast
  för rapportören; granskarens lista och detaljvy visar föregående inskick.
- Nytt inskick valideras igen och skapar version 2 med ursprunglig mallversion och
  sparat tidsläge. Version 1 och tidigare kommentarer förblir oförändrade.
- Äldre versioner kan bara läsas av rätt ägare/granskare och företag. Ogiltiga eller
  saknade versioner avvisas. En äldre version kan inte godkännas.
- Egen rapport kan godkännas av administratör. Samtidiga godkännanden ger ett beslut,
  med rätt aktör och version, och faktureringsstatus `ready`. Godkänd rapport är låst.
- Faktureringsrollen kan läsa godkänd version men inte andra versioner, granska eller
  redigera. I faktureringsvyn visas godkännande och klarmarkering för godkänd version.
- Samtidigt godkännande och begäran om komplettering kan inte båda lyckas. Status,
  faktureringsstatus och historik följer det vinnande beslutet i samma transaktion.
- Klarmarkering kräver godkänd rapport, rätt företagsroll, rätt Origin och uttrycklig
  bekräftelse. Utkast, inskickade rapporter och pågående kompletteringar kan inte klarmarkeras.
- Fel version, gammal revision, förfalskad aktör/status och bekräftelse av fel typ avvisas.
- Två samtidiga klarmarkeringar ger en sparad markering och en konflikt. Användare och
  tid kommer från servern; rapportstatus, godkännande och sparade versioner bevaras.
  Underlaget försvinner från Att hantera och visas under Helt klara. Omladdning och
  nya försök ändrar inte den ursprungliga markeringens användare eller tid.

Inloggningstesterna passerar också (nio deltester och ett övergripande test).
Malltesterna har passerat (åtta tester). TypeScript, ESLint och
produktionsbygget passerar. `git diff --check` passerar.

## Webbläsare

Playwright med lokal Chromium kördes i bakgrunden med ett tillfälligt testkonto:

- Inloggning, företagsval, nytt TMA-utkast, sparande, omladdning och ändring.
- Tid över midnatt, avvikande debiterbar tid, Ja/Nej och varning vid osparad navigation.
- Automatisk ifyllnad, rastavdrag, ogiltiga tider, manuell ändring, återgång till
  beräknad tid samt bevarat automatiskt/manuellt läge efter sparande och omladdning.
- Två flikar: den äldre visar konflikt och behåller sina osparade uppgifter.
  Ett uttryckligt val öppnar därefter den senaste sparade rapporten.
- Avbrutet nätanrop: formuläret behåller uppgifterna och återförsök fungerar.
- Förlorat svar efter att ett nytt utkast redan sparats: ett återförsök visar vad som
  hänt och låter användaren välja att öppna den sparade rapporten. Senare ändringar
  i formuläret försvinner inte automatiskt och skapar inte en andra rapport.
- Ny TMA-rapport skickas in direkt utan något anrop för att skapa utkast. Ofullständiga
  uppgifter stoppas redan i formuläret. Nätfel behåller uppgifter och återförsök fungerar.
  Resultatet är en inskickad rapport med en enda version och inskickshändelse.
- Förlorat svar efter lyckat direkt inskick: återförsöket berättar att rapporten redan
  skickats in. Lokala ändringar behålls tills användaren väljer att öppna den låsta rapporten.
  Det ursprungliga inskicket skrivs inte över och inga extra versioner eller händelser skapas.
- Bekräftat inskick, låst detaljvy, statusfilter och öppning från granskningskön.
- Obligatorisk kompletteringskommentar, avbrutet beslutsanrop med bevarad kommentar
  och fungerande återförsök. Rapportören sparar komplettering, laddar om och skickar in igen.
- Historiklänk visar version 1 utan redigeringsfält. Återgång till aktuell rapport
  visar kompletteringen. Version 2 kan granskas och godkännas av dess egen administratör.
- En äldre granskningsflik får konflikt och behåller kommentaren. Efter uttryckligt
  val öppnas den aktuella rapporten med det nya beslutet.
- Navigationen har en enda flik för Fakturaunderlag. Godkänd rapport visar godkännare
  och tid. Historiklänkarna med datum öppnar rätt inskick. Administratören kan öppna tidigare versioner;
  faktureringsrollens begränsning till godkänd version kontrolleras i integrationstestet.
- Knappen **Markera som inlagd** fungerar direkt i listan. Ingen checkbox eller extra
  bekräftelse krävs. Nätfel visar ett fel och återförsök fungerar. Efter klick och omladdning
  är hela kortet grönt och texten **Inlagd / helt klar** syns. Kortet ligger kvar i Alla,
  utan dubblett, och visas även under Helt klara. Detaljsidan visar användare och tid.
- En äldre faktureringsflik får konflikt och kan öppna aktuell rapport. Filter och
  bakåtlänk leder till rätt lista; exakt en klarmarkeringshändelse sparas.
- Bärgningsutkast, bevarade val/flerval efter omladdning och lyckat inskick.
- Rapportformulär, granskningsdetalj, beslutsformulär, godkänd rapport och klarmarkering utan
  horisontell sidscroll vid 320, 390 och 1440 px.
- Inga JavaScript-fel i webbläsaren. Mobil- och skrivbordsskärmbilder granskades.

Webbläsarkontrollen finns i `scripts/reports.browser.mjs`. Den kräver en separat
Playwright-installation med Chromium; inga nya webbläsarpaket behövs för appens drift.
Med samma serveradress och miljövariabler som integrationstestet körs den så här:

```powershell
node --conditions=react-server scripts/reports.browser.mjs
```

Som standard importeras paketet `playwright`. För en befintlig extern installation
kan `PLAYWRIGHT_MODULE` sättas till modulens absoluta `file:///`-adress.
Skärmbilder sparas under `.next/qa` och ignoreras av Git. Ingen fysisk telefon ingick.

## Kör integrationstestet igen

Terminal 1:

```powershell
npm run build
$env:BETTER_AUTH_URL='http://localhost:3107'
npm run start -- --hostname 127.0.0.1 --port 3107
```

Terminal 2:

```powershell
$env:BETTER_AUTH_URL='http://localhost:3107'
$env:AUTH_TEST_BASE_URL='http://localhost:3107'
npm run test:reports
```

Om testverktygets barnprocess blockeras av sandlådan kan samma tester köras i en process:

```powershell
node --conditions=react-server --test --test-isolation=none scripts/reports.integration.test.mjs
```

Kör inloggnings- och rapporttesterna i varsin process när `--test-isolation=none` används.
Varje testfil stänger sin MongoDB-klient efter körningen.

Tester kräver lokal serveradress och databasnamn med `_dev` eller `_test`. De rensar
bara data i företag och konton som skapats av just testet. Inga befintliga kundföretag
eller rapporter ändras. Index och kortlivade inloggningsbegränsningar kan finnas kvar.

## Nästa del

PDF avvaktar enligt användarens önskemål. Klarmarkeringen är implementerad.
Kundregister, bilder, automatisk koppling till bokföringssystem och offline/PWA återstår.
Appen är inte publicerad.
