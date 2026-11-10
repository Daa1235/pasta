const api = "https://pokeapi.co/api/v2";
let pokemons = [];
let generationNames = null;
let typeNames = null;
const generationCache = new Map();
const typeCache = new Map();

const grid = document.getElementById("grid");
const searchInput = document.getElementById("search");
const generationSelect = document.getElementById("gen");
const typeSelect = document.getElementById("type");

function getId(url) {
  return new URL(url).pathname.split("/").filter(Boolean).pop();
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed (${response.status}): ${url}`);
  return response.json();
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const matches = pokemons.filter(pokemon => {
    const id = getId(pokemon.url);
    const nameMatches = !query || pokemon.name.includes(query) || id.includes(query);
    const generationMatches = !generationNames || generationNames.has(pokemon.name);
    const typeMatches = !typeNames || typeNames.has(pokemon.name);
    return nameMatches && generationMatches && typeMatches;
  });

  grid.innerHTML = matches.map(pokemon => {
    const id = getId(pokemon.url);
    return `
      <div class="card" onclick="detalhes(${id})">
        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png" alt="${pokemon.name}">
        <p>${pokemon.name}</p>
      </div>`;
  }).join("") || "<p>No Pokémon found.</p>";
}

async function loadFilters() {
  try {
    const [pokemonData, typeData] = await Promise.all([
      getJson(`${api}/pokemon-species?limit=2000`),
      getJson(`${api}/type?limit=100`)
    ]);

    pokemons = pokemonData.results;
    typeSelect.innerHTML = '<option value="all">All</option>' +
      typeData.results.map(type => `<option value="${type.name}">${type.name}</option>`).join("");
    render();
  } catch (error) {
    console.error("Could not load Pokémon filters:", error);
    grid.textContent = "Could not load Pokémon. Check your internet connection and try again.";
  }
}

searchInput.addEventListener("input", render);

async function getGenerationNames(generation) {
  if (!generationCache.has(generation)) {
    const data = await getJson(`${api}/generation/${generation}`);
    generationCache.set(generation, new Set(data.pokemon_species.map(species => species.name)));
  }
  return generationCache.get(generation);
}

generationSelect.addEventListener("change", async () => {
  const generation = generationSelect.value;
  generationNames = null;
  if (generation === "all") {
    render();
    return;
  }

  try {
    const names = await getGenerationNames(generation);
    if (generationSelect.value !== generation) return;
    generationNames = names;
    render();
  } catch (error) {
    if (generationSelect.value !== generation) return;
    console.error("Could not load generation:", error);
    grid.textContent = "Could not load this generation. Please try again.";
  }
});

typeSelect.addEventListener("change", async () => {
  const type = typeSelect.value;
  typeNames = null;
  if (type === "all") {
    render();
    return;
  }

  try {
    if (!typeCache.has(type)) {
      const data = await getJson(`${api}/type/${type}`);
      typeCache.set(type, new Set(data.pokemon.map(entry => entry.pokemon.name)));
    }
    if (typeSelect.value !== type) return;
    typeNames = typeCache.get(type);
    render();
  } catch (error) {
    if (typeSelect.value !== type) return;
    console.error("Could not load Pokémon type:", error);
    grid.textContent = "Could not load this type. Please try again.";
  }
});

async function detalhes(id) {
  try {
    const pokemon = await getJson(`${api}/pokemon/${id}`);
    let html = `
      <img src="${pokemon.sprites.other["official-artwork"].front_default}" alt="${pokemon.name}">
      <h2>${pokemon.name}</h2>`;

    for (const stat of pokemon.stats) {
      html += `<p>${stat.stat.name}: ${stat.base_stat} <progress value="${stat.base_stat}" max="200"></progress></p>`;
    }

    html += '<button onclick="info.close()">Fechar</button>';
    document.getElementById("info").innerHTML = html;
    document.getElementById("info").showModal();
  } catch (error) {
    console.error("Could not load Pokémon details:", error);
    grid.textContent = "Could not load Pokémon details. Please try again.";
  }
}

loadFilters();
