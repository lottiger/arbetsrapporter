# Better Auth och MongoDB Atlas: steg för steg

## Beslut och nuläge

Vi använder Better Auth och en ny, separat testdatabas i MongoDB Atlas.
Första inloggningssättet är e-post/lösenord med administratörsskapade konton.
Ett konto i Atlas är för den som administrerar databasen; rapportörerna ska bara
ha konton i Arbetsrapporter.

Implementerat och verifierat 2026-10-02:

- Better Auth 1.7.7, MongoDB-adapter 1.7.7 och MongoDB-drivrutin 7.7.0 installerade.
- `.env.local` skapad med en egen slumpgenererad authnyckel och lokala inställningar.
- MongoDB-adressen hämtas från `.env`. En tom överskrivning i `.env.local` är borttagen;
  den genererade authnyckeln är bevarad där. Båda filerna ignoreras av Git.
- `npm run config:check` kontrollerar format utan nätverksanslutning eller utskrift
  av hemligheter. Det är inte ett test av att databaslösenordet fungerar.

Auth-API, inloggning, utloggning, företagsval och företagskontroller är inkopplade.
Anslutning, sparande och åtkomst har testats mot Atlas. Företagsnamn kan ändras av
företagsadministratör; ändringen loggas med vem och när. Rapportflödet återstår.
Två tillfälliga testföretag användes för att verifiera företagsgränsen och rensades
efter testen. Ditt riktiga administratörskonto skapas separat med steg 6 nedan.

Kvar i Atlas: databasanvändaren har bredare rättigheter än appen behöver. Begränsa
den till `readWrite` för `arbetsrapporter_dev` enligt steg 2 före pilot.
Klusterregion och exakt IP-lista går inte att fastställa med appens anslutning;
kontrollera dessa inställningar i Atlas inför pilot. Ingen publicering har gjorts.

## 1. Skapa Atlas-projekt och kluster

1. Öppna [MongoDB Atlas](https://cloud.mongodb.com) och skapa konto eller logga in.
2. Skapa ett separat projekt, föreslaget namn **Arbetsrapporter – utveckling**.
3. Välj **Create / Build a Database** och nivån **Free (M0)**. Kontrollera att
   sammanfattningen visar Free innan du skapar klustret.
4. Välj exempelvis AWS som leverantör och en tillgänglig **EU-region**.
5. Namnge klustret `arbetsrapporter-dev` och skapa det. Exempeldata behövs inte.

Ett kluster är databasservern. Själva appdatabasen får namnet `arbetsrapporter_dev`;
den behöver inte innehålla någon samling än. Atlas kan visa en säkerhetsguide direkt
efter att klustret skapats. Vi går då vidare till steg 2 och 3 nedan.
Etiketter och ordning i Atlas kan variera med välkomstflödet.

[Atlas instruktion för Free-kluster](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/).

## 2. Skapa appens databasanvändare

Under **Database Access / Database Users**, skapa en användare med
lösenordsinloggning. Föreslaget namn är `arbetsrapporter_app`.

- Generera ett unikt lösenord och spara det i en lösenordshanterare.
- Under **Specific Privileges**, välj rollen `readWrite` för databasen
  `arbetsrapporter_dev`. Lämna samlingsnamn tomt för åtkomst inom den databasen.
- Begränsa användaren till testklustret om valet **Restrict Access to Specific
  Clusters** visas.
- Atlas-kontot, appens databasanvändare och framtida personalinloggningar är tre
  olika saker. Appen använder databasanvändaren bakom kulisserna.

Behörigheten kan justeras under Database Access om välkomstguiden skapade en
användare med en bredare standardroll.
[Atlas dokumentation om databasanvändare](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/).

## 3. Tillåt datorns anslutning

Under **Network Access / IP Access List**, välj **Add Current IP Address**.
Det tillåter anslutningar från din aktuella publika IP-adress.
Använd den adressen för utvecklingen. `0.0.0.0/0` ger åtkomst från hela internet
och behövs inte här. Om internetanslutning eller VPN ändras kan adressen behöva
uppdateras.
[Atlas dokumentation om IP-listan](https://www.mongodb.com/docs/atlas/security/ip-access-list/).

## 4. Lägg anslutningssträngen i projektet

1. Välj klustrets **Connect → Drivers**, språket **Node.js** och en drivrutinsversion
   som passar installerade MongoDB-drivrutinen 7.7.0.
2. Kopiera Atlas anslutningssträng som börjar med `mongodb+srv://`.
3. Öppna `.env.local` i projektets rot i VS Code vid en ny installation. I din nuvarande
   konfiguration används `.env` för MongoDB-adressen; den behöver inte flyttas.
4. Fyll i adressen mellan citattecknen på raden `MONGODB_URI=""`.
5. Ersätt användar-/lösenordsplatshållarna med databasanvändarens riktiga uppgifter.
   Om lösenordet innehåller specialtecken måste dessa URL-kodas i adressen. Detta
   gör vi lokalt om det behövs; dela inte lösenordet i chatten.
6. Behåll `MONGODB_DB=arbetsrapporter_dev`, den genererade `BETTER_AUTH_SECRET` och
   `BETTER_AUTH_URL=http://localhost:3000`.

Behåll Atlas URI-parametrar. Databasnamnet anges separat av appen,
så det behöver inte läggas in i URI:n. Öppna appen med `http://localhost:3000` när
inloggning testas, så att adressen stämmer med Better Auth-konfigurationen.

`.env.local` ignoreras av Git. Dela bara att filen är ifylld, aldrig hela innehållet.
[Atlas guide till drivrutinsanslutning](https://www.mongodb.com/docs/atlas/driver-connection/).

## 5. Kontrollera anslutningen

```powershell
npm run config:check
npm run db:check
```

`config:check` kontrollerar format utan att ansluta. `db:check` ansluter, kontrollerar
att MongoDB svarar och läser databasrollen. Det senare kommandot ändrar inga dokument
och visar inga lösenord. Båda kontrollerna har körts i den nuvarande miljön.

## 6. Skapa ditt administratörskonto

```powershell
npm run admin:create
```

Ange företagsnamn, ditt namn och e-postadress i terminalen. Välj därefter ett
lösenord på 12–128 tecken och bekräfta det. Inga tecken visas medan lösenordet skrivs.
Kommandot skapar ett nytt företag och ger det nya kontot företagets tre roller.
Det ger ingen global systemadministratörsbehörighet och ändrar inga befintliga konton.

Starta eller starta om utvecklingsservern:

```powershell
npm run dev -- --hostname 127.0.0.1
```

Öppna [http://localhost:3000/logga-in](http://localhost:3000/logga-in). Logga in,
välj ditt företag och prova **Företagsuppgifter**. Namnändringen sparas i MongoDB.
Prova sedan **Rapportörsvy** och **Logga ut**.

Kommandot är avsett för den som driver tjänsten och har tillgång till serverns
konfiguration. Kunden ska senare hantera sina användare via ett skyddat gränssnitt.
E-postverifiering, lösenordsåterställning och webbgränssnitt för kontoadministration
återstår. De måste ordnas inför en bredare pilot; inga e-postfunktioner är aktiverade nu.

Better Auth körs i Next.js-appen och kräver inget separat Better Auth-konto för
detta upplägg. Biblioteket tar hand om lösenord och sessioner. Våra serverkontroller
ansvarar för vilket företags data och vilka funktioner en inloggad person får använda.
Ingen öppen självregistrering eller reservinloggning med demoidentitet införs.

Tekniska referenser: [Better Auth-installation](https://better-auth.com/docs/installation),
[MongoDB-adapter](https://better-auth.com/docs/adapters/mongo) och
[Next.js-integration](https://better-auth.com/docs/integrations/next).

Om inloggningen misslyckas trots rätt lösenord: kontrollera att dev-servern verkligen
kör på port 3000. Är porten upptagen av ett annat projekt väljer Next en annan port, och
Better Auth avvisar då anropet med fel ursprung. Stäng det andra projektet eller starta
med `npm run dev -- --hostname 127.0.0.1 --port 3000`.

## 7. Publicera mallarna för företaget

```powershell
npm run templates:publish -- "Företagsnamn"
```

Kommandot publicerar mallarna **Underlag TMA** och **Bärgningsbesked/underlag** för det
angivna företaget. Utan argument listas aktiva företag och namnet efterfrågas. Mallarna
sparas som version 1 i `templates` och `templateVersions`. Körs kommandot igen utan att
malldefinitionen ändrats händer ingenting; en ändrad definition får nästa versionsnummer
och tidigare versioner behålls oförändrade.

Öppna därefter **Ny rapport** i rapportörsvyn och välj en mall. Fyll i och tryck
**Kontrollera uppgifterna**. Under **Mallar** i administratörsvyn visas alla fält och regler.
Rapporter kan ännu inte sparas.

## Skapa lokal konfiguration på en ny dator

```powershell
npm ci
npm run setup:local
```

Setup skapar filen endast om den saknas. En befintlig fil och dess hemligheter skrivs
aldrig över. Varje utvecklingsmiljö får en egen slumpgenererad nyckel.
Kontrollskripten kan testas med `npm run test:config`; testerna ansluter inte till Atlas.
