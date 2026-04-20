// convert.js → node convert.js
import fs from "fs";

const raw = JSON.parse(
  fs.readFileSync("countries+states+cities.json", "utf8")
);

const result = raw.map((country) => ({
  id: country.id,
  name: country.name,
  iso2: country.iso2,
  states: (country.states || []).map((state) => ({
    id: state.id,
    name: state.name,
    cities: (state.cities || []).map((city) => ({
      id: city.id,
      name: city.name,
    })),
  })),
}));

const output = `// Base de datos mundial: Países → Regiones → Ciudades
// Fuente: dr5hn/countries-states-cities-database
export const WORLD_DATA = ${JSON.stringify(result, null, 2)};

export const COUNTRIES = WORLD_DATA.map(c => ({ code: c.iso2, name: c.name }));

export function getStatesByCountry(iso2) {
  const country = WORLD_DATA.find(c => c.iso2 === iso2);
  return country ? country.states : [];
}

export function getCitiesByState(iso2, stateId) {
  const states = getStatesByCountry(iso2);
  const state = states.find(s => s.id === stateId);
  return state ? state.cities : [];
}
`;

fs.writeFileSync("src/data/worldData.js", output, "utf8");

console.log("✅ worldData.js generado con", result.length, "países");
console.log(
  "Regiones:",
  result.reduce((a, c) => a + c.states.length, 0)
);
console.log(
  "Ciudades:",
  result.reduce(
    (a, c) =>
      a +
      c.states.reduce((b, s) => b + s.cities.length, 0),
    0
  )
);