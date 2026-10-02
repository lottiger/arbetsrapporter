# Arkitektur och nästa byggsteg

## Läget efter inloggningssteget

Det öppna huvudprojektet används: Next.js 16.3.8, React 19.2.8, TypeScript,
Tailwind CSS 4 och App Router under `src/app`. Zip-prototypen är inte importerad.

Implementerat: separata layouter för rapportör och administratör, navigation,
statusval i webbadressen, tomma listvyer, svensk metadata, tangentbordsfokus och
responsiv layout. Gemensamma komponenter ligger i `src/components`.
Sidorna är Server Components; bara aktiv huvudnavigation behöver klientkod.
Systemets lokala typsnitt används så att bygget inte behöver hämta Google Fonts.

Better Auth-inloggning och MongoDB-lagring för konton, sessioner, företag och
medlemskap är nu implementerade. Arbetsytorna kontrollerar aktivt medlemskap och
roller på servern. Den gamla växlingen i förhandsvisningen är ersatt av kontonavigation.
Företagsnamn kan sparas av företagsadministratören med en historikhändelse i samma
transaktion. Företagsval och företags-API är testade med två separata testföretag.
Se [verifieringen av inloggningssteget](verifiering-steg-b.md) för vad som faktiskt testats.

2026-10-02: Mallarna **Underlag TMA** och **Bärgningsbesked/underlag** är inlagda utifrån
originalblanketterna. Malldefinitionerna ligger i `src/domain/templates/` och är deklarativa:
sektioner, fält med typ och krav samt tre regeltyper (tidsspann, villkorat krav och minst ett
av flera fält). `npm run templates:publish` publicerar dem per företag till `templates` och
`templateVersions`; en ändrad definition ger en ny version och publicerade versioner ändras
aldrig. Rapportören ser företagets mallar under Ny rapport och kan fylla i och kontrollera
formuläret; administratören ser fält och regler under Mallar. Arbetad tid beräknas även över
midnatt och visas bredvid debiterbara timmar utan att ersätta dem. Sparande av rapporter,
kundregister och bilder är inte implementerade.

## Verifierade krav från briefen

- Flera företag ska vara åtskilda även vid direkta serveranrop och ändrade ID:n.
- Rapportören arbetar med egna rapporter; administratören granskar företagets.
- Inskickad rapport är låst. Komplettering kräver en kommentar och öppnar rapporten
  för rapportören. Nytt inskick går tillbaka till granskning.
- Tidigare versioner och kommentarer bevaras med vem och när.
- Faktureringsstatus hålls separat från rapportstatus.
- Mallar tillhör företag och versionsstyrs. Gamla rapporter behåller sin mallversion.
- TMA ska kunna hantera tid över midnatt. Beräknad tid får inte tyst ersätta angiven
  debiterbar tid.
- PDF ska använda en sparad, godkänd version. Fortnox-integration kommer senare.

## Val av inloggning och lagring i steg B

2026-10-02: Better Auth är valt och en ny, separat testdatabas i MongoDB Atlas är
beslutad. Better Auth 1.7.7, dess MongoDB-adapter 1.7.7 och MongoDB-drivrutinen 7.7.0
är installerade. Auth-API, inloggning/utloggning, företagsval, serverkontroller och
databasanslutning är inkopplade. `npm run admin:create` skapar ett nytt företag och
dess första administratör från den lokala operatörsterminalen.
Se [integrationsguiden](integration-guide.md) för nästa steg.

Inloggningen använder e-post/lösenord med databaslagrade sessioner.
Biblioteket hanterar lösenord och sessioner. Företagsmedlemskap och roller hanteras
i appens serverkod. Atlas-testdatabasen är ansluten; ingen produktionsmiljö används.
Better Auths globala administratörsplugin används endast i lokalt provisioneringskommando
och är inte monterad i webb-API:t. Företagsadministratörer får företagsbundna roller.

Better Auth beskriver [e-post/lösenord](https://better-auth.com/docs/authentication/email-password)
och sin [MongoDB-adapter](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/adapters/mongo.mdx).
Next.js rekommenderar att behörighetskontroller samlas nära dataåtkomsten i sin
[guide om autentisering](https://nextjs.org/docs/app/guides/authentication).
Paketversionernas kompatibilitet och adapterkonfigurationen har verifierats mot Atlas.

- Konton provisioneras av behörig administratör. Ingen öppen självregistrering.
- Sessionen verifieras på servern. Cookies hanteras av authbiblioteket med HttpOnly,
  SameSite och Secure i HTTPS-miljö. Inloggning ska ha begränsning av upprepade försök.
- Ett aktivt företag måste motsvara ett aktivt medlemskap. Ett företags-ID från
  URL eller formulär är aldrig bevis på behörighet.
- Rollerna är `reporter`, `company_admin` och `billing`. En person kan ha flera roller.
  `system_admin` är en separat systembehörighet för anslutning och mallkonfiguration,
  utan automatisk åtkomst till alla företagsrapporter.
- Bestäm kontoprovisionering, återställning och eventuell befintlig Microsoft-inloggning
  med första företaget innan inloggningslösningen låses för pilot.
- Session, medlemskap och roll kontrolleras vid varje skyddad operation. En spärrad
  användare får inte fortsatt åtkomst via en äldre sessionscookie.

## Förslag: MongoDB och företagets datagräns

Använd en databas med företagsbundna samlingar. Företagskopplingen är obligatorisk i
varje affärsdokument. Inloggningsbibliotekets användare och sessioner är globala;
åtkomst till affärsdata kräver dessutom medlemskap.

| Samling | Innehåll och avgränsning |
| --- | --- |
| `organizations` | Företagets identitet och inställningar. |
| `memberships` | `organizationId`, `userId`, roller, aktiv/spärrad. Unikt par företag + användare. |
| `customers` | `organizationId`, kunduppgifter, valfritt framtida `fortnoxCustomerId`. |
| `templates` | `organizationId`, rapporttyp och referens till publicerad mallversion. |
| `templateVersions` | `organizationId`, `templateId`, versionsnummer, fält, regler och beräkningsversion. Publicerade versioner ändras inte. |
| `reports` | `organizationId`, skapare, kundreferens, mallversionsreferens, utkast, rapportstatus, låsversion, referens till inskickad/godkänd version, separat faktureringsstatus. |
| `reportVersions` | `organizationId`, `reportId`, versionsnummer, sparade svar, mallversion och snapshot av företag/kund, aktör och tid. Oföränderliga inskickade versioner. |
| `reportEvents` | `organizationId`, `reportId`, händelse, version, aktör, tid och eventuell kommentar. Händelser läggs till; tidigare händelser skrivs inte över. |

Förslag på serverstruktur för steg B och C:

```text
src/server/auth/         session och behörighetskontext
src/server/db/           anslutning och index
src/server/repositories/ alla företagsavgränsade databasfrågor
src/server/reports/      validering och statusövergångar
src/domain/             domäntyper utan databas- eller klientberoende
```

Servermoduler markeras `server-only`. Varje repository får ett serververifierat
sammanhang med användare, företag och roller, aldrig bara ett fritt företags-ID.
Läsning och ändring av rapport använder både `_id` och `organizationId` i frågan.
Rapportören avgränsas dessutom till `createdBy = currentUserId`.
Kund-, mall- och versionsreferenser kontrolleras mot samma företag.
Listor, historik, summeringar och PDF följer samma datagräns.
Server Actions och Route Handlers kontrollerar identitet, medlemskap, roll och
indata; en skyddad layout eller dolda knappar räcker inte.

Index börjar med `organizationId` där frågan är företagsbunden. Unika index för
mall- och rapportversioner inkluderar företag och versionsnummer. Kontrollerad
versionsräknare används vid ändringar för att upptäcka samtidig redigering.
Ingen gemensam cache för företagsdata införs i första flödet.

Status, ny rapportversion och historikhändelse ska sparas atomiskt i en transaktion.
Den föreslagna lagringen kräver därför MongoDB med stöd för transaktioner, även lokalt
(exempelvis en lokal replica set; se [MongoDB:s transaktionskrav](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/)). Vi går igenom databasval och konfiguration innan
någon anslutning görs. Saknad konfiguration ska stoppa skyddade operationer tydligt;
den får aldrig ge en tyst reservlösning med demoidentitet eller publik data.

## Planerade statusövergångar (ännu inte implementerade)

Behåll briefens fyra rapportstatusar. Spara varje inskick som en oföränderlig version.
Vid komplettering utgår ett redigerbart utkast från föregående version, som bevaras.

| Från | Händelse | Till | Serverkrav |
| --- | --- | --- | --- |
| `draft` | Spara utkast | `draft` | Rapportens ägare; rätt företag. Partiellt ifyllda svar tillåts. |
| `draft` | Skicka in | `submitted` | Ägare; validering mot rapportens publicerade mallversion; ny snapshot. |
| `submitted` | Begär komplettering | `needs_completion` | Företagsadministratör; kommentar med innehåll efter trimning; referens till granskad version. |
| `needs_completion` | Spara komplettering | `needs_completion` | Ägare; tidigare versioner och kommentarer bevaras. |
| `needs_completion` | Skicka in igen | `submitted` | Ägare; ny validering och ny snapshot; nytt inskick loggas. |
| `submitted` | Godkänn | `approved` | Företagsadministratör; precis den inskickade version som granskats. |

Andra övergångar avslås. `submitted` och `approved` kan inte redigeras normalt.
Vid samtidig ändring ska anropet misslyckas med konflikt så att granskaren får läsa
den aktuella versionen. Dubbelklick får inte skapa dubbla versioner eller händelser.
Eventuell rättelse efter godkännande kräver ett separat beslut och flöde senare.

### Separat faktureringsstatus

Förslag: `not_ready` före godkännande, `ready` vid godkännande och `handled` när
faktureringsansvarig markerat underlaget som hanterat i Fortnox. Rapportstatus förblir
`approved`. Spara vem, när och valfri Fortnox-referens. Tillåt bara övergången från
`ready` till `handled` en gång, med villkorad uppdatering och historikhändelse.
PDF-hämtning ska inte ändra faktureringsstatus. En framtida export behöver dessutom
en unik exportnyckel så att upprepade försök inte ger dubbla överföringar.

## Mallarna och vad som återstår att verifiera

Fältuppsättningen följer originalblanketterna. Så här är de tolkade i version 1:

| Underlag | Beslut i version 1 |
| --- | --- |
| TMA | Regnr TMA-bil, datum, kund, märkning, vägnummer, arbetsplats, start- och sluttid, rast i minuter, debiterbara timmar, kontroll före avfärd (ja/nej), arbetsuppgifter, avvikelser, tillbud (ja/nej) med obligatorisk beskrivning vid ja, samt namn. Pappersunderskriften ersätts av den inloggade rapportören vid inskick. |
| TMA-tid | Klockslag utan datum; sluttid före starttid tolkas som nästa dygn. Arbetad tid = spann minus rast och visas med två decimaler. Lika start- och sluttid ger en varning. Debiterbara timmar anges alltid manuellt; avvikelse mot arbetad tid ger en varning men blockerar inte. |
| Bärgning | Kund, förare, telefon, person-/orgnr, körkort 4d, försäkringsbolag, självrisk, skadenummer, fakturamail, regnr bil och/eller släp, objekt/märke, fordonstyp, last i ton, bruttovikt, mätarställning, olycksplats, bärgad till/KPP, datum, förare bärgaren, extra man, tiderna start, ankomst, lastad, utfört/KPP och åter station, använd tid, total körsträcka, orsak (flerval, annan orsak kräver text), uppdrag (flerval) och övrig information. |

| Underlag | Behöver fortfarande verifieras |
| --- | --- |
| TMA-tid | Om avvikelse mellan arbetad och debiterbar tid ska kräva en förklaring för att kunna skickas in, samt jobb längre än ett dygn (hanteras i dag som högst 24 timmar). |
| Bärgning | Enheten för bärgad bruttovikt (sparas som text tills vidare), baksidan för utlandskund, och om bilder ska vara obligatoriska. |
| Bärgning-belopp | Uppställningsdygn, transport, kranbil och skrotning skrivs i dag i övrig information som på pappret. Strukturerade kostnadsrader kräver verifierade prisregler, valuta, moms och avrundning. |
| Roller | Om rapportör även kan granska, om egen rapport får godkännas och vilka som får se underlag. |

Mallar ska först konfigureras internt med sektioner, fälttyper, etiketter, obligatoriska
fält och tillåtna validerings-/beräkningsregler. Publicering valideras på servern.
Ingen godtycklig JavaScript från en mall får köras. Belopp ska hanteras som exakta
decimaler eller heltal i minsta valutaenhet efter att pris- och momsregler verifierats.
Originalens namn, registreringsnummer och priser ska inte användas som produktdata.

## Genomfört och nästa vertikala steg

1. Atlas-testdatabasen är ansluten och inloggning, kontoprovisionering och medlemskap finns.
2. Befintliga arbetsytor och företagsoperationer har serverkontroller.
3. Två fiktiva företag har använts för att testa ändrade ID:n, direkta API-anrop,
   otillåten roll, saknad session och spärrat/borttaget medlemskap. Testdata är rensad.
4. Första administratörskontot är skapat lokalt. Mallarna för TMA och bärgning är publicerade
   för företaget och formuläret kan fyllas i och kontrolleras; se verifieringen nedan.
5. Användar-/rolladministration på webben och återställning av lösenord återstår i steg B.
6. Bygg därefter sparande av rapporter (steg C): utkast, inskick och granskning mot
   rapportens mallversion, och testa rapporters företagsgräns och ägarskap för varje
   läsning och ändring.

Verifierat 2026-10-02 för mallsteget: `npm run test:templates` (sex tester, bland annat
22:30–00:30 = 2 h över midnatt och att avvikande debiterbara timmar behålls med varning),
`npm run typecheck`, `npm run lint` och `npm run build`. Mot den lokala dev-servern och
Atlas-testdatabasen verifierades med ett tillfälligt företag att publicering ger version 1,
att ompublicering utan ändring lämnar mallarna orörda, att Ny rapport listar båda mallarna,
att formulären renderar 16 respektive 33 fält, att okänd mall ger 404, att Mallar visas för
företagsadministratör, att anonym åtkomst omdirigeras och att ett främmande företags-ID
nekas. Testföretaget och dess mallar rensades efteråt.

Databasuppgifter sparas lokalt i `.env`/`.env.local`, aldrig i klientkod, chattexempel
eller Git. `.env.example` innehåller platshållare och ofarliga lokala standardvärden.
Ingen publicering har gjorts. Atlas-behörigheten bör begränsas till appdatabasen före pilot.
