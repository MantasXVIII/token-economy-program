let token = null;
let role = null;
let tasks = [];

async function fetchTasks() {
  const response = await fetch('/tasks');
  tasks = await response.json();
}

function generateTableHeader(containerId) {
  const thead = document.getElementById(containerId);
  let headerHTML = '<tr><th class="border p-2">Day</th>';
  tasks.forEach((task, index) => {
    headerHTML += `<th class="border p-2">Task ${index + 1}</th>`;
  });
  headerHTML += '</tr>';
  thead.innerHTML = headerHTML;
}

async function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const response = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json();
  if (data.token) {
    token = data.token;
    role = data.role;
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    await fetchTasks();
    generateTableHeader('grid-header');
    generateTableHeader('history-header');
    loadGrid();
  } else {
    alert('Login failed');
  }
}

async function loadGrid() {
  const response = await fetch('/grid', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const grid = await response.json();
  const tbody = document.getElementById('grid-body');
  tbody.innerHTML = '';
  for (const [day, taskStates] of Object.entries(grid)) {
    const row = document.createElement('tr');
    row.innerHTML = `<td class="border p-2">${day}</td>`;
    tasks.forEach((task, index) => {
      const taskKey = `task${index + 1}`;
      const checked = taskStates[taskKey] ? 'checked' : '';
      const disabled = role === 'viewer' ? 'disabled' : '';
      row.innerHTML += `<td class="border p-2 text-center"><input type="checkbox" ${checked} ${disabled} onchange="updateTask('grid', '${day}', '${taskKey}', this.checked)"></td>`;
    });
    tbody.appendChild(row);
  }
}

async function updateTask(endpoint, day, task, value) {
  await fetch(`/${endpoint}${endpoint === 'history' ? '/' + document.getElementById('history-select').value : ''}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ day, task, value }),
  });
  if (endpoint === 'grid') loadGrid();
  else loadHistory();
}

async function viewHistory() {
  const historyDiv = document.getElementById('history');
  historyDiv.classList.toggle('hidden');
  if (!historyDiv.classList.contains('hidden')) {
    const response = await fetch('/history', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const history = await response.json();
    const select = document.getElementById('history-select');
    select.innerHTML = '<option value="">Select a week</option>';
    history.forEach(({ week }) => {
      const option = document.createElement('option');
      option.value = week;
      option.textContent = week;
      select.appendChild(option);
    });
  }
}

async function loadHistory() {
  const week = document.getElementById('history-select').value;
  if (!week) return;
  const response = await fetch(`/history/${week}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const grid = await response.json();
  const tbody = document.getElementById('history-body');
  tbody.innerHTML = '';
  for (const [day, taskStates] of Object.entries(grid)) {
    const row = document.createElement('tr');
    row.innerHTML = `<td class="border p-2">${day}</td>`;
    tasks.forEach((task, index) => {
      const taskKey = `task${index + 1}`;
      const checked = taskStates[taskKey] ? 'checked' : '';
      const disabled = role === 'viewer' ? 'disabled' : '';
      row.innerHTML += `<td class="border p-2 text-center"><input type="checkbox" ${checked} ${disabled} onchange="updateTask('history', '${day}', '${taskKey}', this.checked)"></td>`;
    });
    tbody.appendChild(row);
  }
}
