// ===== 1. API configuration and shared state =====
const api = "https://pokeapi.co/api/v2";
let pokemons = [];
let generationNames = null;
let typeNames = null;
const generationCache = new Map();
const typeCache = new Map();
const pokemonTypeCache = new Map();
const pokemonTypeRequests = new Map();
const typeTranslations = {
  normal: "normal",
  fire: "fogo",
  water: "água",
  electric: "elétrico",
  grass: "planta",
  ice: "gelo",
  fighting: "lutador",
  poison: "veneno",
  ground: "terra",
  flying: "voador",
  psychic: "psíquico",
  bug: "inseto",
  rock: "pedra",
  ghost: "fantasma",
  dragon: "dragão",
  dark: "sombrio",
  steel: "aço",
  fairy: "fada"
};
const typeCardColors = {
  normal: "#e5e5d7",
  fire: "#f8d3c4",
  water: "#cbdcf8",
  electric: "#f7e9ae",
  grass: "#d0e8d0",
  ice: "#cce9ec",
  fighting: "#f2cccc",
  poison: "#e3d0eb",
  ground: "#ead9c5",
  flying: "#d7dcf3",
  psychic: "#f3d0dc",
  bug: "#e0e7c2",
  rock: "#e4deca",
  ghost: "#d9d3e8",
  dragon: "#d8d1f2",
  dark: "#d8d1cd",
  steel: "#d5dce0",
  fairy: "#f0d4e0"
};

// ===== 2. Page elements =====
const grid = document.getElementById("grid");
const searchInput = document.getElementById("search");
const generationSelect = document.getElementById("gen");
const typeSelect = document.getElementById("type");
let typeObserver;

// Extracts the Pokémon ID from a PokéAPI resource URL.
function getId(url) {
  return new URL(url).pathname.split("/").filter(Boolean).pop();
}

// Fetches JSON from the API and throws an error when the request fails.
async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed (${response.status}): ${url}`);
  return response.json();
}

// ===== 3. Pokémon list and card rendering =====
// Applies the selected search and filters, then renders the matching Pokémon cards.
function render() {
  const query = searchInput.value.trim().toLowerCase();
  const matches = pokemons.filter(pokemon => { // Keep Pokémon matching all active criteria.
    const id = getId(pokemon.url);
    const nameMatches = !query || pokemon.name.includes(query) || id.includes(query);
    const generationMatches = !generationNames || generationNames.has(pokemon.name);
    const typeMatches = !typeNames || typeNames.has(pokemon.name);
    return nameMatches && generationMatches && typeMatches;
  });

  if (typeObserver) typeObserver.disconnect();
  grid.innerHTML = matches.map(pokemon => { // Build one card for each matching Pokémon.
    const id = getId(pokemon.url);
    return `
      <div class="card" data-pokemon-id="${id}" onclick="detalhes(${id})">
        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png" alt="${pokemon.name}">
        <p>${pokemon.name}</p>
        <div class="pokemon-types" aria-label="Tipos do Pokémon">A carregar tipos...</div>
      </div>`;
  }).join("") || "<p>No Pokémon found.</p>";

  typeObserver = new IntersectionObserver(entries => { // Load card types only when cards approach the viewport.
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      typeObserver.unobserve(entry.target);
      loadPokemonTypes(entry.target);
    }
  });
  for (const card of grid.querySelectorAll(".card")) {
    typeObserver.observe(card);
  }
}

// Loads and displays a card's types, reusing cached or in-progress requests when possible.
async function loadPokemonTypes(card) {
  const id = card.dataset.pokemonId;
  const typesElement = card.querySelector(".pokemon-types");

  try {
    if (!pokemonTypeCache.has(id)) {
      if (!pokemonTypeRequests.has(id)) {
        pokemonTypeRequests.set(id, getJson(`${api}/pokemon/${id}`).then(pokemon => {
          // Save the API type names so future cards do not need another request.
          const types = pokemon.types.map(entry => entry.type.name);
          pokemonTypeCache.set(id, types);
          return types;
        }).finally(() => pokemonTypeRequests.delete(id)));
      }
      await pokemonTypeRequests.get(id);
    }

    if (!typesElement.isConnected) return;
    const types = pokemonTypeCache.get(id);
    typesElement.innerHTML = types
      .map(type => `<span class="type-badge type-${type}">${typeTranslations[type] || type}</span>`)
      .join("");

    const colors = types.map(type => typeCardColors[type] || "#e5e5d7");
    card.style.background = colors.length > 1
      ? `linear-gradient(135deg, ${colors[0]} 50%, ${colors[1]} 50%)`
      : colors[0];
  } catch (error) {
    console.error(`Could not load types for Pokémon ${id}:`, error);
    if (typesElement.isConnected) typesElement.textContent = "Tipos indisponíveis";
  }
}

// ===== 4. Initial data and filter options =====
// Loads the Pokémon list and available types, then renders the initial list.
async function loadFilters() {
  try {
    const [pokemonData, typeData] = await Promise.all([
      getJson(`${api}/pokemon-species?limit=2000`),
      getJson(`${api}/type?limit=100`)
    ]);

    pokemons = pokemonData.results;
    typeSelect.innerHTML = '<option value="all">Todos</option>' +
      typeData.results.map(type => { // Create an option for each API Pokémon type.
        const label = typeTranslations[type.name] || type.name;
        return `<option value="${type.name}">${label}</option>`;
      }).join("");
    render();
  } catch (error) {
    console.error("Could not load Pokémon filters:", error);
    grid.textContent = "Could not load Pokémon. Check your internet connection and try again.";
  }
}

// ===== 5. Search and filter handlers =====
// Retrieves and caches all Pokémon species names belonging to a generation.
async function getGenerationNames(generation) {
  if (!generationCache.has(generation)) {
    const data = await getJson(`${api}/generation/${generation}`);
    generationCache.set(generation, new Set(data.pokemon_species.map(species => species.name)));
  }
  return generationCache.get(generation);
}

// Updates the list when the selected generation changes.
async function handleGenerationChange() {
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
}

// Updates the list when the selected Pokémon type changes.
async function handleTypeChange() {
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
}

// ===== 6. Pokémon details dialog =====
// Fetches a Pokémon's stats and displays them in the details dialog.
async function detalhes(id) {
  try {
    const [pokemon, species] = await Promise.all([
      getJson(`${api}/pokemon/${id}`),
      getJson(`${api}/pokemon-species/${id}`).catch(error => {
        console.error(`Could not load Pokémon description for ${id}:`, error);
        return null;
      })
    ]);
    const descriptions = species?.flavor_text_entries || [];
    const descriptionEntry = descriptions.find(entry => entry.language.name === "pt")
      || descriptions.find(entry => entry.language.name === "en");
    const description = descriptionEntry
      ? descriptionEntry.flavor_text.replace(/[\n\f\r]/g, " ").replace(/\s+/g, " ").trim()
      : "Descrição indisponível.";

    const stats = pokemon.stats.map(stat => `
      <div class="pokemon-stat">
        <span>${stat.stat.name}</span>
        <strong>${stat.base_stat}</strong>
        <progress value="${stat.base_stat}" max="200"></progress>
      </div>`).join("");

    const info = document.getElementById("info");
    info.innerHTML = `
      <div class="pokemon-details">
        <img src="${pokemon.sprites.other["official-artwork"].front_default}" alt="${pokemon.name}">
        <section class="pokemon-info">
          <h2>${pokemon.name}</h2>
          <p class="pokemon-description"></p>
          <div class="pokemon-stats">${stats}</div>
          <button type="button" onclick="info.close()">Fechar</button>
        </section>
      </div>`;
    info.querySelector(".pokemon-description").textContent = description;
    info.showModal();
  } catch (error) {
    console.error("Could not load Pokémon details:", error);
    grid.textContent = "Could not load Pokémon details. Please try again.";
  }
}

// ===== 7. Event listeners and startup =====
// Refreshes the list as the user types or changes a filter.
searchInput.addEventListener("input", render);
generationSelect.addEventListener("change", handleGenerationChange);
typeSelect.addEventListener("change", handleTypeChange);

// Loads the initial data required to display the Pokédex.
loadFilters();
