# Tech Rabbit Calc — appen

Räkneassistenten för iOS och Android. En fråga på vanlig svenska in, ett
räknat svar ut.

Det här repot bär **appen**: `apps/mobile` (Expo, React Native) och
`packages/engine` (räknemotorn, ren TypeScript utan beroenden).

Tolkningstjänsten — instruktionerna till modellen, talkontrollen och
granskningen av förklaringen — ligger i ett privat repo. Appen känner bara
tjänstens adress, och adressen sätts vid bygget.

## Bygga

```
npm install
npm test
npm run typecheck
npx expo export --platform ios
```

Ett TestFlight-bygge startas under **Actions → TestFlight → Run workflow**.

## Licens

Ingen. Koden är läsbar, inte fri att återanvända.
