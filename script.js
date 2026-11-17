const api = "https://pokeapi.co/api/v2";

const state = {
  pokemons: [],
  generationNames: null,
  typeNames: null
};

const cache = {
  generation: new Map(),
  typeList: new Map(),
  pokemonTypes: new Map(),
  pokemonTypeRequests: new Map()
};

const typeTranslations = Object.freeze({
  normal: "normal",
  fire: "fire",
  water: "water",
  electric: "electric",
  grass: "grass",
  ice: "ice",
  fighting: "fighting",
  poison: "poison",
  ground: "ground",
  flying: "flying",
  psychic: "psychic",
  bug: "bug",
  rock: "rock",
  ghost: "ghost",
  dragon: "dragon",
  dark: "dark",
  steel: "steel",
  fairy: "fairy"
});

const grid = document.getElementById("grid");
const searchInput = document.getElementById("search");
const generationSelect = document.getElementById("gen");
const typeSelect = document.getElementById("type");

let typeObserver;

function getIdFromUrl(url) {
  return new URL(url).pathname.split("/").filter(Boolean).pop();
}

async function getJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${url}`);
  }

  return response.json();
}

function cardMatchesFilters(pokemon) {
  const query = searchInput.value.trim().toLowerCase();
  const id = getIdFromUrl(pokemon.url);
  const searchValue = pokemon.name || "";

  const matchesQuery = !query || searchValue.includes(query) || id.includes(query);
  const matchesGeneration = !state.generationNames || state.generationNames.has(pokemon.name);
  const matchesType = !state.typeNames || state.typeNames.has(pokemon.name);

  return matchesQuery && matchesGeneration && matchesType;
}

function buildTypeBadges(types) {
  return types
    .map((type) => `<span class="type-badge type-${type}">${typeTranslations[type] || type}</span>`)
    .join("");
}

function renderPokemonCards() {
  const filteredPokemons = state.pokemons.filter(cardMatchesFilters);

  if (typeObserver) {
    typeObserver.disconnect();
  }

  grid.innerHTML = filteredPokemons
    .map((pokemon) => {
      const id = getIdFromUrl(pokemon.url);
      return `
        <div class="card" data-pokemon-id="${id}">
          <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png" alt="${pokemon.name}">
          <p>${pokemon.name}</p>
          <div class="pokemon-types" aria-label="Pokémon types">Loading types...</div>
        </div>`;
    })
    .join("") || "<p>No Pokémon found.</p>";

  typeObserver = new IntersectionObserver((entries) => {
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

function render() {
  renderPokemonCards();
}

async function getPokemonTypes(id) {
  if (!cache.pokemonTypes.has(id)) {
    if (!cache.pokemonTypeRequests.has(id)) {
      const request = getJson(`${api}/pokemon/${id}`)
        .then((pokemon) => {
          const types = pokemon.types.map((entry) => entry.type.name);
          cache.pokemonTypes.set(id, types);
          return types;
        })
        .finally(() => cache.pokemonTypeRequests.delete(id));

      cache.pokemonTypeRequests.set(id, request);
    }

    await cache.pokemonTypeRequests.get(id);
  }

  return cache.pokemonTypes.get(id);
}

async function loadPokemonTypes(card) {
  const id = card.dataset.pokemonId;
  const typesElement = card.querySelector(".pokemon-types");

  try {
    const types = await getPokemonTypes(id);

    if (!typesElement || !typesElement.isConnected) return;

    typesElement.innerHTML = buildTypeBadges(types);
  } catch (error) {
    console.error(`Could not load Pokémon types for ${id}:`, error);

    if (typesElement && typesElement.isConnected) {
      typesElement.textContent = "Types unavailable";
    }
  }
}

async function loadFilters() {
  try {
    const [pokemonData, typeData] = await Promise.all([
      getJson(`${api}/pokemon-species?limit=2000`),
      getJson(`${api}/type?limit=100`)
    ]);

    state.pokemons = pokemonData.results;
    typeSelect.innerHTML = "<option value=\"all\">All</option>" +
      typeData.results
        .map((type) => `<option value="${type.name}">${typeTranslations[type.name] || type.name}</option>`)
        .join("");

    render();
  } catch (error) {
    console.error("Could not load Pokémon filters:", error);
    grid.textContent = "Could not load Pokémon. Check your internet connection and try again.";
  }
}

async function getGenerationNames(generation) {
  if (!cache.generation.has(generation)) {
    const data = await getJson(`${api}/generation/${generation}`);
    const names = new Set(data.pokemon_species.map((species) => species.name));
    cache.generation.set(generation, names);
  }

  return cache.generation.get(generation);
}

async function handleGenerationChange() {
  const generation = generationSelect.value;
  state.generationNames = null;

  if (generation === "all") {
    render();
    return;
  }

  try {
    const names = await getGenerationNames(generation);

    if (generationSelect.value !== generation) return;

    state.generationNames = names;
    render();
  } catch (error) {
    if (generationSelect.value !== generation) return;
    console.error("Could not load generation:", error);
    grid.textContent = "Could not load this generation. Please try again.";
  }
}

async function getTypeNames(type) {
  if (!cache.typeList.has(type)) {
    const data = await getJson(`${api}/type/${type}`);
    const names = new Set(data.pokemon.map((entry) => entry.pokemon.name));
    cache.typeList.set(type, names);
  }

  return cache.typeList.get(type);
}

async function handleTypeChange() {
  const type = typeSelect.value;
  state.typeNames = null;

  if (type === "all") {
    render();
    return;
  }

  try {
    const names = await getTypeNames(type);

    if (typeSelect.value !== type) return;

    state.typeNames = names;
    render();
  } catch (error) {
    if (typeSelect.value !== type) return;
    console.error("Could not load Pokémon type:", error);
    grid.textContent = "Could not load this type. Please try again.";
  }
}

function getDescription(species) {
  const entries = species?.flavor_text_entries || [];
  const entry = entries.find((item) => item.language.name === "pt")
    || entries.find((item) => item.language.name === "en");

  if (!entry) return "Description unavailable.";

  return entry.flavor_text.replace(/[\n\f\r]/g, " ").replace(/\s+/g, " ").trim();
}

function buildStatsMarkup(stats) {
  return stats
    .map((stat) => `
      <div class="pokemon-stat">
        <span>${stat.stat.name}</span>
        <strong>${stat.base_stat}</strong>
        <progress value="${stat.base_stat}" max="200"></progress>
      </div>`)
    .join("");
}

async function showPokemonDetails(id) {
  try {
    const [pokemon, species] = await Promise.all([
      getJson(`${api}/pokemon/${id}`),
      getJson(`${api}/pokemon-species/${id}`).catch((error) => {
        console.error(`Could not load Pokémon description for ${id}:`, error);
        return null;
      })
    ]);

    const info = document.getElementById("info");
    const statsMarkup = buildStatsMarkup(pokemon.stats);

    info.innerHTML = `
      <div class="pokemon-details">
        <img src="${pokemon.sprites.other["official-artwork"].front_default}" alt="${pokemon.name}">
        <section class="pokemon-info">
          <h2>${pokemon.name}</h2>
          <p class="pokemon-description"></p>
          <div class="pokemon-stats">${statsMarkup}</div>
          <button type="button" data-close-details>Close</button>
        </section>
      </div>`;

    info.querySelector(".pokemon-description").textContent = getDescription(species);
    info.showModal();
  } catch (error) {
    console.error("Could not open Pokémon details:", error);
    grid.textContent = "Could not load Pokémon details. Please try again.";
  }
}

function handleGridClick(event) {
  const card = event.target.closest(".card");

  if (card && grid.contains(card)) {
    showPokemonDetails(card.dataset.pokemonId);
  }
}

function handleDetailsClick(event) {
  if (event.target.closest("[data-close-details]")) {
    document.getElementById("info").close();
  }
}

function setupBackgroundMusic() {
  const music = document.getElementById("musica");
  const audioToggle = document.getElementById("audio-toggle");

  if (!music || !audioToggle) return;

  music.volume = 0.3;
  audioToggle.addEventListener("click", () => {
    music.muted = !music.muted;
    audioToggle.textContent = music.muted ? "Unmute audio" : "Mute audio";
    audioToggle.setAttribute("aria-pressed", String(music.muted));

    if (!music.muted && music.paused) {
      music.play().catch((error) => {
        console.error("Could not play background music:", error);
      });
    }
  });

  music.play().catch(() => {
    document.addEventListener("click", () => {
      if (!music.muted) {
        music.play().catch((error) => {
          console.error("Could not play background music:", error);
        });
      }
    }, { once: true });
  });
}

function initializePokedex() {
  searchInput.addEventListener("input", render);
  generationSelect.addEventListener("change", handleGenerationChange);
  typeSelect.addEventListener("change", handleTypeChange);
  grid.addEventListener("click", handleGridClick);
  document.getElementById("info").addEventListener("click", handleDetailsClick);

  setupBackgroundMusic();
  loadFilters();
}

initializePokedex();
