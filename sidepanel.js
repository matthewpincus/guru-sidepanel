let USER_NAME = '';
let USER_TOKEN = '';
const API_URL = 'https://api.getguru.com/api/v1';

// Collection tokens
const COLLECTION_TOKENS = {
  default: 'f055fdba-e132-47fe-92de-a9eac2218ba2',
  collection2: '29647c42-4c94-45a1-8a9a-a95c290a794d',
  collection3: 'b86f6798-00c6-4fc2-908c-a63ddc933909',
  collection4: '87e018a0-cec0-4e48-8e31-b68d75cddb6a'
};

// Currently selected collection
let currentCollection = 'default';

function debounce(func, delay) {
  let debounceTimer;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => func.apply(context, args), delay);
  };
}

// Add this function to create a loading indicator
function showLoading(element) {
    element.innerHTML = '<div class="loading">Loading...</div>';
}

let isResultsCollapsed = false;

function toggleSuggestions() {
    const suggestionsContainer = document.getElementById('suggestions');
    const collapseButton = document.getElementById('collapse-button');
    
    isResultsCollapsed = !isResultsCollapsed;
    
    if (isResultsCollapsed) {
        suggestionsContainer.style.display = 'none';
        collapseButton.textContent = 'Show Results';
    } else {
        suggestionsContainer.style.display = 'block';
        collapseButton.textContent = 'Hide Results';
    }
}

function displaySuggestions(cards) {
    const suggestionsContainer = document.getElementById('suggestions');
    const collapseButton = document.getElementById('collapse-button');
    
    suggestionsContainer.innerHTML = '';
    
    if (cards.length === 0) {
        suggestionsContainer.innerHTML = '<div class="suggestion">No results found</div>';
    } else {
        cards.slice(0, 5).forEach((card, index) => {
            const suggestion = document.createElement('div');
            suggestion.className = 'suggestion';
            suggestion.innerHTML = `<strong>${card.preferredPhrase}</strong>`;
            suggestion.addEventListener('click', () => addCard(card));
            suggestionsContainer.appendChild(suggestion);
        });
    }

    collapseButton.style.display = 'block';
    collapseButton.textContent = 'Hide Results';
    suggestionsContainer.style.display = 'block';
    isResultsCollapsed = false;
}

const performSearch = debounce(async () => {
    const query = document.getElementById('search-input').value;
    const suggestionsElement = document.getElementById('suggestions');
    const collapseButton = document.getElementById('collapse-button');
    
    if (query.length > 2) {
        showLoading(suggestionsElement);
        collapseButton.style.display = 'block';
        const cards = await fetchGuruCards(query);
        displaySuggestions(cards);
    } else {
        suggestionsElement.innerHTML = '';
        collapseButton.style.display = 'none';
    }
}, 300);

async function fetchGuruCards(query = '') {
  try {
    const searchableFields = ['title', 'content', 'preferredPhrase', 'alternatePhrase', 'tags'];
    const url = `${API_URL}/search/query?searchTerms=${encodeURIComponent(query)}&searchableFields=${searchableFields.join(',')}`;
    console.log('Fetching from URL:', url);
    
    const allResults = [];

    for (const [collectionName, collectionToken] of Object.entries(COLLECTION_TOKENS)) {
      const headers = {
        'Authorization': `Basic ${btoa(USER_NAME + ':' + USER_TOKEN)}`,
        'X-Guru-Collection-Token': collectionToken
      };
      console.log(`Request headers for ${collectionName}:`, headers);
      
      const response = await fetch(url, { headers });
      
      console.log(`Response status for ${collectionName}:`, response.status);
      
      if (!response.ok) {
        console.error(`HTTP error for ${collectionName}! status: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      console.log(`Full parsed data for ${collectionName}:`, data);
      
      if (Array.isArray(data)) {
        console.log(`Number of results for ${collectionName}:`, data.length);
        allResults.push(...data);
      } else {
        console.log(`Unexpected data structure for ${collectionName}`);
      }
    }

    console.log('All results:', allResults);
    return allResults;
  } catch (error) {
    console.error('Error fetching Guru cards:', error);
    return [];
  }
}

function addCard(card) {
    const cardsContainer = document.getElementById('cards-container');
    
    // Check if the card is already open
    const existingCard = Array.from(cardsContainer.children).find(
        cardElement => cardElement.dataset.cardId === card.id
    );

    if (existingCard) {
        // If the card is already open, move it to the top
        cardsContainer.prepend(existingCard);
        // Scroll to the top of the cards container
        cardsContainer.scrollTop = 0;
    } else {
        // If it's a new card, create and add it
        const cardElement = document.createElement('div');
        cardElement.className = 'card';
        cardElement.dataset.cardId = card.id; // Store the card ID for future reference
        cardElement.innerHTML = `
            <div class="card-header">
                <h3>${card.preferredPhrase}</h3>
                <button class="close-btn">&times;</button>
            </div>
            <div class="card-content"></div>
            <button class="back-to-results-btn">Back to Results</button>
        `;

        const cardContent = cardElement.querySelector('.card-content');
        cardContent.innerHTML = sanitizeAndFormatContent(card.content);

        cardElement.querySelector('.close-btn').addEventListener('click', () => cardElement.remove());
        cardElement.querySelector('.back-to-results-btn').addEventListener('click', () => {
            cardElement.remove();
            toggleSuggestions();
        });

        // Intercept clicks on Guru card links
        cardContent.addEventListener('click', async (e) => {
            if (e.target.tagName === 'A' && e.target.href.includes('app.getguru.com/card/')) {
                e.preventDefault();
                const cardId = e.target.href.split('/').pop();
                const newCard = await fetchGuruCardBySlug(cardId);
                if (newCard) {
                    addCard(newCard); // This will either add the new card or move an existing one to the top
                }
            }
        });

        cardsContainer.prepend(cardElement);
    }

    document.getElementById('search-input').value = '';
    toggleSuggestions();
}

function sanitizeAndFormatContent(content) {
    // Create a new div element to parse the HTML content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;

    // Remove any script tags for security
    const scripts = tempDiv.getElementsByTagName('script');
    for (let i = scripts.length - 1; i >= 0; i--) {
        scripts[i].parentNode.removeChild(scripts[i]);
    }

    // Add custom classes to elements for styling
    const tables = tempDiv.getElementsByTagName('table');
    for (let table of tables) {
        table.classList.add('guru-table');
    }

    const lists = tempDiv.querySelectorAll('ul, ol');
    for (let list of lists) {
        list.classList.add('guru-list');
    }

    // Return the sanitized and formatted HTML
    return tempDiv.innerHTML;
}

async function fetchGuruCardBySlug(slug) {
  try {
    const url = `${API_URL}/search/query?searchTerms=${encodeURIComponent(slug)}`;
    const headers = {
      'Authorization': `Basic ${btoa(USER_NAME + ':' + USER_TOKEN)}`
    };
    console.log('Fetching card from URL:', url);
    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
      const text = await response.text();
      console.error('Response text:', text);
      return null;
    }
    const data = await response.json();
    console.log('Fetched data:', data);
    if (Array.isArray(data) && data.length > 0) {
      return data[0]; // Return the first card that matches the slug
    }
    console.error('No matching card found');
    return null;
  } catch (error) {
    console.error('Error fetching Guru card:', error);
    return null;
  }
}

// Function to change the current collection
function changeCollection(collectionKey) {
  if (COLLECTION_TOKENS[collectionKey]) {
    currentCollection = collectionKey;
    // Optionally, you can trigger a new search or update the UI here
  } else {
    console.error('Invalid collection key');
  }
}

// Simple drag and drop functionality
function dragStart(e) {
  e.dataTransfer.setData('text/plain', e.target.id);
  setTimeout(() => e.target.classList.add('dragging'), 0);
}

function dragOver(e) {
  e.preventDefault();
  const draggingElement = document.querySelector('.dragging');
  const cardContainer = document.getElementById('cards-container');
  const afterElement = getDragAfterElement(cardContainer, e.clientY);
  if (afterElement == null) {
    cardContainer.appendChild(draggingElement);
  } else {
    cardContainer.insertBefore(draggingElement, afterElement);
  }
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.card:not(.dragging)')];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function drop(e) {
  e.preventDefault();
  document.querySelector('.dragging').classList.remove('dragging');
}

document.addEventListener('DOMContentLoaded', async () => {
  const credentials = await getCredentials();
  if (credentials) {
    USER_NAME = credentials.username;
    USER_TOKEN = credentials.token;
    showMainContent();
  } else {
    showLoginForm();
  }
});

function showLoginForm() {
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('main-content').style.display = 'none';
  document.getElementById('credentials-form').addEventListener('submit', handleCredentialSubmit);
}

function showMainContent() {
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('main-content').style.display = 'block';
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', performSearch);
}

async function handleCredentialSubmit(event) {
  event.preventDefault();
  const username = document.getElementById('username').value;
  const token = document.getElementById('token').value;
  await saveCredentials(username, token);
  USER_NAME = username;
  USER_TOKEN = token;
  showMainContent();
}

function saveCredentials(username, token) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ guruCredentials: { username, token } }, resolve);
    });
}

function getCredentials() {
    return new Promise((resolve) => {
        chrome.storage.local.get('guruCredentials', (result) => {
            resolve(result.guruCredentials);
        });
    });
}

// Make sure this event listener is added when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const collapseButton = document.getElementById('collapse-button');
    collapseButton.addEventListener('click', toggleSuggestions);
});

// To add more collections:
// 1. Add the new collection token to the COLLECTION_TOKENS object
// 2. Create a UI element (e.g., a dropdown) to allow users to select the collection
// 3. Call changeCollection(newCollectionKey) when the user selects a different collection
