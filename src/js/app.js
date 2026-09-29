// 🌟 ESTADO CENTRAL DEL PROYECTO (Mapeado a LocalStorage)
let boardState = JSON.parse(localStorage.getItem('trello_state')) || {
    todo: [
        { id: '1', text: 'Welcome to Trello!' },
        { id: '2', text: 'This is a card.' }
    ],
    in_progress: [
        { id: '3', text: 'Make as many lists as you need!' }
    ],
    done: [
        { id: '4', text: 'To learn more tricks, check out the guide.' }
    ]
};

function saveState() {
    localStorage.setItem('trello_state', JSON.stringify(boardState));
}

// 🎨 РЕНДЕРИНГ ДОСКИ ИЗ СОСТОЯНИЯ LOCALSTORAGE
export function renderBoard() {
    Object.keys(boardState).forEach(status => {
        const container = document.querySelector(`[data-status="${status}"] .cards-container`);
        if (!container) return;
        container.innerHTML = '';

        boardState[status].forEach(item => {
            const card = document.createElement('div');
            card.className = 'card-element text-sm text-gray-700 font-medium font-sans';
            card.dataset.id = item.id;
            card.innerText = item.text;

            // Кнопка удаления карточки (\E951 simplificado a X)
            const deleteX = document.createElement('span');
            deleteX.className = 'delete-card-x';
            deleteX.innerText = '×';
            deleteX.addEventListener('click', (e) => {
                e.stopPropagation();
                boardState[status] = boardState[status].filter(c => c.id !== item.id);
                saveState();
                renderBoard();
            });

            card.appendChild(deleteX);
            container.appendChild(card);
        });
    });
}

// ➕ ФУНКЦИОНАЛ ДОБАВЛЕНИЯ КАРТОЧЕК
document.querySelectorAll('.column').forEach(column => {
    const addBtn = column.querySelector('.add-card-btn');
    const container = column.querySelector('.cards-container');
    const status = column.dataset.status;

    addBtn.addEventListener('click', () => {
        if (column.querySelector('.add-form-container')) return;

        // Ocultamos el botón temporalmente
        addBtn.style.display = 'none';

        const formDiv = document.createElement('div');
        formDiv.className = 'add-form-container bg-white p-3 rounded-xl border border-gray-300 space-y-2 mt-2';
        formDiv.innerHTML = `
            <textarea placeholder="Enter a title for this card..." class="w-full border p-2 text-xs rounded-lg resize-none outline-none focus:ring-1 focus:ring-blue-500" rows="2"></textarea>
            <div class="flex items-center gap-2">
                <button class="submit-add-btn bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs">Add Card</button>
                <button class="cancel-add-btn text-gray-500 hover:text-gray-700 text-lg font-bold">×</button>
            </div>
        `;

        formDiv.querySelector('.submit-add-btn').addEventListener('click', () => {
            const text = formDiv.querySelector('textarea').value.trim();
            if (text) {
                boardState[status].push({ id: String(Date.now()), text });
                saveState();
                renderBoard();
            }
            formDiv.remove();
            addBtn.style.display = 'flex';
        });

        formDiv.querySelector('.cancel-add-btn').addEventListener('click', () => {
            formDiv.remove();
            addBtn.style.display = 'flex';
        });

        column.insertBefore(formDiv, addBtn);
        formDiv.querySelector('textarea').focus();
    });
});

// Inicialización de la app
document.addEventListener('DOMContentLoaded', renderBoard);

// 🔨 ЛОГИКА ДРАГ-ЭНД-ДРОП С КООРДИНАТАМИ И СДВИГОМ (NATIVE DND)
let draggedElement = null;
let ghostElement = null; // Elemento flotante para el cursor
let placeholder = null; // Marcador de posición
let shiftX = 0;
let shiftY = 0;

document.addEventListener('mousedown', (e) => {
    const card = e.target.closest('.card-element');
    if (!card || e.target.classList.contains('delete-card-x')) return;

    e.preventDefault();
    draggedElement = card;

    // Calcular el punto exacto de agarre del mouse dentro de la tarjeta
    const box = card.getBoundingClientRect();
    shiftX = e.clientX - box.left;
    shiftY = e.clientY - box.top;

    // Crear el clon flotante (Ghost) para moverlo con el cursor
    ghostElement = card.cloneNode(true);
    ghostElement.style.width = `${box.width}px`;
    ghostElement.style.height = `${box.height}px`;
    ghostElement.classList.add('dragging');
    document.body.appendChild(ghostElement);

    // Crear el marcador de posición (Placeholder)
    placeholder = document.createElement('div');
    placeholder.className = 'dnd-placeholder';
    placeholder.style.height = `${box.height}px`;

    // Posicionar el Ghost inicialmente
    moveAt(e.pageX, e.pageY);

    // Ocultar temporalmente el original sustituyéndolo por el placeholder
    card.style.display = 'none';
    card.parentNode.insertBefore(placeholder, card);

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
});

function moveAt(pageX, pageY) {
    ghostElement.style.left = `${pageX - shiftX}px`;
    ghostElement.style.top = `${pageY - shiftY}px`;
}

function onMouseMove(e) {
    moveAt(e.pageX, e.pageY);

    // Ocultar momentáneamente el Ghost para saber qué hay debajo real en esa coordenada
    ghostElement.style.display = 'none';
    const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
    ghostElement.style.display = 'block';

    if (!elementBelow) return;

    // Buscar si estamos sobre una columna o sobre otra tarjeta
    const containerBelow = elementBelow.closest('.cards-container');
    const cardBelow = elementBelow.closest('.card-element');

    if (containerBelow) {
        if (cardBelow) {
            const box = cardBelow.getBoundingClientRect();
            const relativeY = e.clientY - box.top;

            // Determinar si insertar antes o после basándose en la mitad de la tarjeta objetivo
            if (relativeY < box.height / 2) {
                containerBelow.insertBefore(placeholder, cardBelow);
            } else {
                containerBelow.insertBefore(placeholder, cardBelow.nextSibling);
            }
        } else {
            // Si la columna está vacía o pasamos por encima del fondo
            containerBelow.appendChild(placeholder);
        }
    }
}

function onMouseUp() {
    if (!draggedElement) return;

    // Identificar a qué columna cayó el placeholder
    const targetContainer = placeholder.parentNode;
    if (targetContainer && targetContainer.classList.contains('cards-container')) {
        // Mover físicamente el nodo original a la posición del placeholder
        targetContainer.insertBefore(draggedElement, placeholder);
    }

    // Re-estructurar el boardState leyendo el nuevo orden del DOM
    const newBoardState = { todo: [], in_progress: [], done: [] };
    document.querySelectorAll('.column').forEach(column => {
        const status = column.dataset.status;
        column.querySelectorAll('.card-element').forEach(cardNode => {
            const id = cardNode.dataset.id;
            const text = cardNode.childNodes[0].textContent; // Extraer solo el texto, ignorando la X
            newBoardState[status].push({ id, text });
        });
    });

    // Guardar cambios
    boardState = newBoardState;
    localStorage.setItem('trello_state', JSON.stringify(boardState));

    // Limpieza de memoria y eliminación de nodos fantasma
    draggedElement.style.display = 'block';
    if (ghostElement) ghostElement.remove();
    if (placeholder) placeholder.remove();

    draggedElement = null;
    ghostElement = null;
    placeholder = null;

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    // Re-renderizar para limpiar nodos y asegurar eventos limpios
    renderBoard();
}
