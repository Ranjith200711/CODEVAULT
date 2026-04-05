// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
// import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-analytics.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyB0tlHU74S9HAWt2fKok1vYbPjt9ZiuWRM",
    authDomain: "codevault-6c5e6.firebaseapp.com",
    projectId: "codevault-6c5e6",
    storageBucket: "codevault-6c5e6.firebasestorage.app",
    messagingSenderId: "746561724898",
    appId: "1:746561724898:web:86ac14566a5b1b837699bb",
    measurementId: "G-BN2QDQ7H2V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const snippetsCol = collection(db, 'snippets');

let snippets = [];
let initialLoad = true;
let unlockedCount = parseInt(localStorage.getItem('vault_unlocked_count')) || 1;

// DOM Elements
const snippetGrid = document.getElementById('snippet-grid');
const emptyState = document.getElementById('empty-state');

// Code Modal Elements
const codeModal = document.getElementById('code-modal');
const closeCodeModalBtn = document.getElementById('close-modal');
const modalTitle = document.getElementById('modal-title');
const modalCode = document.getElementById('modal-code');
const copyBtn = document.getElementById('copy-btn');
const editBtn = document.getElementById('edit-btn');
const deleteBtn = document.getElementById('delete-btn');
const toast = document.getElementById('toast');

// Form Modal Elements
const formModal = document.getElementById('form-modal');
const closeFormBtn = document.getElementById('close-form-btn');
const addSnippetBtn = document.getElementById('add-snippet-btn');
const snippetForm = document.getElementById('snippet-form');
const formId = document.getElementById('form-id');
const formTitle = document.getElementById('form-title-input');
const formLang = document.getElementById('form-lang-input');
const formCode = document.getElementById('form-code-input');
const formTitleHeading = document.getElementById('form-title');
const saveBtn = document.getElementById('save-btn');
const unlockBtn = document.getElementById('unlock-btn');

// Initialize State
let currentSnippetId = null;

// Fetch Live Data from Firestore
function startListening() {
    onSnapshot(snippetsCol, (snapshot) => {
        snippets = [];
        snapshot.forEach((doc) => {
            snippets.push({ id: doc.id, ...doc.data() });
        });

        // Sort snippets so the "first saved" (oldest) appears first
        snippets.sort((a, b) => {
            const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(0);
            const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(0);
            return dateA - dateB;
        });

        initialLoad = false;
        renderGrid();
    }, (error) => {
        console.error("Error fetching live snippets: ", error);
        alert("Could not connect to the database. Make sure your Firestore rules allow reading and writing.");
    });
}

// Render the grid
function renderGrid() {
    snippetGrid.innerHTML = '';

    if (snippets.length === 0) {
        snippetGrid.style.display = 'none';
        emptyState.classList.remove('hidden');
        return;
    } else {
        snippetGrid.style.display = 'grid';
        emptyState.classList.add('hidden');
    }

    snippets.forEach((snippet, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.id = snippet.id;

        // Add a staggered delay to unlock them one by one
        card.style.animationDelay = `${index * 0.1}s`;

        const codeLines = snippet.code.split('\n');
        const previewCode = codeLines.slice(0, 5).join('\n') + (codeLines.length > 5 ? '\n...' : '');

        card.innerHTML =
            '<div class="card-header">' +
            '<span class="card-title">' + snippet.title + '</span>' +
            '<span class="card-lang">' + snippet.lang.toUpperCase() + '</span>' +
            '</div>' +
            '<div class="card-preview">' +
            '<pre><code class="language-' + snippet.lang + '">' + previewCode + '</code></pre>' +
            '</div>';

        if (index < unlockedCount) {
            card.addEventListener('click', () => openCodeModal(snippet, index));
        }
        snippetGrid.appendChild(card);
    });

    Prism.highlightAll();
}

let copyTimeout;

// Code View Modal
function openCodeModal(snippet, index) {
    currentSnippetId = snippet.id;
    modalTitle.textContent = snippet.title;
    modalCode.textContent = snippet.code;
    modalCode.className = `language-${snippet.lang}`;

    // Hide copy button initially
    copyBtn.style.display = 'none';

    // Clear any existing timeout if they open a different snippet
    if (copyTimeout) clearTimeout(copyTimeout);

    // Show copy button after 3 minutes (180000 milliseconds)
    copyTimeout = setTimeout(() => {
        copyBtn.style.display = 'flex';
    }, 3 * 60 * 1000);

    // sequential unlock logic
    if (index === unlockedCount - 1 && unlockedCount < snippets.length) {
        unlockBtn.classList.remove('hidden');
    } else {
        unlockBtn.classList.add('hidden');
    }

    codeModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    Prism.highlightElement(modalCode);
}

function closeCodeModal() {
    codeModal.classList.add('hidden');
    document.body.style.overflow = '';
}

// Form Modal 
function openFormModal(editSnippet = null) {
    if (editSnippet) {
        formTitleHeading.textContent = "Edit Code Snippet";
        formId.value = editSnippet.id;
        formTitle.value = editSnippet.title;
        formLang.value = editSnippet.lang;
        formCode.value = editSnippet.code;
    } else {
        formTitleHeading.textContent = "Add New Code";
        snippetForm.reset();
        formId.value = '';
        formLang.value = 'python';
    }

    formModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeFormModal() {
    formModal.classList.add('hidden');
    // If the code modal was previously open, we stay overflow hidden.
    if (codeModal.classList.contains('hidden')) {
        document.body.style.overflow = '';
    }
}

// Form Submission (Save to Firestore)
snippetForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const isEdit = formId.value !== '';
    const newSnippetData = {
        title: formTitle.value,
        lang: formLang.value.toLowerCase(),
        code: formCode.value,
        updatedAt: new Date().toISOString()
    };

    // UI update
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = 'Saving...';
    saveBtn.disabled = true;

    try {
        if (isEdit) {
            const docRef = doc(db, 'snippets', formId.value);
            await updateDoc(docRef, newSnippetData);
        } else {
            await addDoc(snippetsCol, newSnippetData);
        }

        closeFormModal();

        if (isEdit) {
            // Refresh code modal view (the snapshot will update the grid in the background automatically!)
            const updatedSnippet = { id: formId.value, ...newSnippetData };
            openCodeModal(updatedSnippet);
        }
    } catch (err) {
        console.error("Error saving to Firestore: ", err);
        alert("Failed to save. Did you allow read/write in your Firestore Rules?");
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
});

// Delete Logic
deleteBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete this snippet globally?')) {
        const originalText = deleteBtn.innerHTML;
        deleteBtn.innerHTML = 'Deleting...';
        deleteBtn.disabled = true;

        try {
            const docRef = doc(db, 'snippets', currentSnippetId);
            await deleteDoc(docRef);
            closeCodeModal();
        } catch (err) {
            console.error("Error deleting from Firestore: ", err);
            alert("Failed to delete snippet.");
        } finally {
            deleteBtn.innerHTML = originalText;
            deleteBtn.disabled = false;
        }
    }
});

// Edit Button Logic (while inside Code Modal)
editBtn.addEventListener('click', () => {
    const snippet = snippets.find(s => s.id === currentSnippetId);
    if (snippet) {
        openFormModal(snippet);
    }
});

// Event Listeners for Closing Modals
closeCodeModalBtn.addEventListener('click', closeCodeModal);
closeFormBtn.addEventListener('click', closeFormModal);

codeModal.addEventListener('click', (e) => {
    if (e.target === codeModal) closeCodeModal();
});

formModal.addEventListener('click', (e) => {
    if (e.target === formModal) closeFormModal();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (!formModal.classList.contains('hidden')) {
            closeFormModal();
        } else if (!codeModal.classList.contains('hidden')) {
            closeCodeModal();
        }
    }
});

// Add New Snippet Trigger
addSnippetBtn.addEventListener('click', () => openFormModal(null));

// Copy Logic
function showToast(msg = 'Copied to clipboard!') {
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => { toast.classList.add('hidden'); }, 2500);
}

copyBtn.addEventListener('click', async () => {
    const snippet = snippets.find(s => s.id === currentSnippetId);
    if (snippet) {
        try {
            await navigator.clipboard.writeText(snippet.code);
            showToast('Copied to clipboard!');
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    }
});

// Unlock Logic
unlockBtn.addEventListener('click', () => {
    unlockedCount++;
    localStorage.setItem('vault_unlocked_count', unlockedCount);
    
    // Hide the button since it's no longer the latest
    unlockBtn.classList.add('hidden');
    
    // Re-render grid to visually unlock the next one
    renderGrid();
    showToast('Next snippet unlocked!');
});

// Init
document.addEventListener('DOMContentLoaded', () => {
    startListening();
});
